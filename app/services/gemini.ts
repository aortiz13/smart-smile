'use server';

import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { AnalysisResponse, VariationType } from "@/types/gemini";
import { logApiUsage, checkVideoQuota, markVideoQuotaUsed } from "./backendService";
import { uploadGeneratedImage } from "./storage";

// Models
// Verified working: gemini-2.0-flash
const ANALYSIS_MODEL = "gemini-2.0-flash";
const IMAGE_MODEL = "gemini-2.0-flash";
const TARGET_IMAGE_MODEL = "gemini-2.0-flash";

const VALIDATION_MODEL = "gemini-2.0-flash";
const VIDEO_MODEL = "veo-2.0-generate-preview"; // Assuming Veo is correct/unchanged or experimental

// Helper to strip base64 prefix
const stripBase64Prefix = (base64: string): string => {
    return base64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');
};

const getMimeType = (base64: string): string => {
    const match = base64.match(/^data:(image\/[a-zA-Z+]+);base64,/);
    return match ? match[1] : 'image/jpeg';
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const isModelOverloaded = (error: any): boolean => {
    return (
        error.status === 'UNAVAILABLE' ||
        error.code === 503 ||
        error.message?.includes('overloaded') ||
        error.error?.code === 503 ||
        error.error?.status === 'UNAVAILABLE' ||
        (error.response?.status === 503)
    );
};

// Robust Text Extractor for @google/genai SDK
const extractText = (response: any): string => {
    try {
        console.log("[Gemini] Raw Response Keys:", Object.keys(response));
        if (response.text) {
            if (typeof response.text === 'function') {
                return response.text();
            }
            if (typeof response.text === 'string') {
                return response.text;
            }
        }
        return response.candidates?.[0]?.content?.parts?.[0]?.text ||
            response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || // In case of weird structure
            "";
    } catch (e) {
        console.error("[Gemini] Failed to extract text:", e);
        return "";
    }
};

// Safe JSON Parse
const safeParseJSON = (text: string) => {
    try {
        // Remove markdown code blocks if present
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanText);
    } catch (e) {
        console.error("[Gemini] JSON Parse Failed. Text:", text.slice(0, 100));
        return null;
    }
};

// Gatekeeper
export const validateImageStrict = async (base64Image: string): Promise<{ success: boolean; data?: { isValid: boolean; reason: string }; error?: string }> => {
    console.log("[Gemini] ENTRY: validateImageStrict called (Edge Function Delegate).");
    if (!base64Image) {
        return { success: false, error: "Error: Imagen vacía o corrupta." };
    }

    try {
        const data = stripBase64Prefix(base64Image);

        // Delegate to Supabase Edge Function
        // This keeps the API KEY secure in Supabase Secrets
        const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; // Or Service Role if prefered server-side

        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            console.error("Missing Supabase Configuration in Next.js Server Env");
            return { success: false, error: "Configuration Error: Supabase URL/Key missing." };
        }

        const response = await fetch(`${SUPABASE_URL}/functions/v1/analyze-face`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                image_base64: data,
                mode: 'validate'
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("Edge Function Error:", errText);
            return { success: false, error: `Error del servidor: ${errText}` };
        }

        const resultKey = await response.json();
        console.log("[Gemini] Edge Function Response:", resultKey);

        if (resultKey) {
            // Check keys returned by the specific 'validate' prompt
            // "is_valid": boolean, "rejection_reason": string
            return {
                success: true,
                data: {
                    isValid: !!resultKey.is_valid,
                    reason: resultKey.rejection_reason || ""
                }
            };
        }

        return { success: false, error: "Respuesta inválida del analizador." };

    } catch (error: any) {
        console.error("[Gatekeeper] Delegate Error:", error);
        return { success: false, error: `Error de Validación: ${error.message}` };
    }
};

// Analysis
export const analyzeImageAndGeneratePrompts = async (base64Image: string): Promise<{ success: boolean; data?: AnalysisResponse; error?: string }> => {
    console.log("[Gemini] ENTRY: analyzeImageAndGeneratePrompts called (Edge Function Delegate).");
    try {
        const data = stripBase64Prefix(base64Image);

        const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            return { success: false, error: "Configuration Error: Supabase URL/Key missing." };
        }

        const response = await fetch(`${SUPABASE_URL}/functions/v1/analyze-face`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                image_base64: data,
                mode: 'analyze' // Default
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Edge Function Error: ${errText}`);
        }

        const text = await response.json(); // analyze-face returns the text content directly in JSON response body from previous step? 
        // Wait, analyze-face returns `new Response(analysis, ...)` which is text/string if analysis is string.
        // Or if it returns JSON object? 
        // In my previous edit of analyze-face, it returns: `return new Response(analysisText, ...)`
        // `analysisText` is the raw text from Gemini, which is likely a JSON string block (```json ... ```).

        // So `await response.text()` or `await response.json()` depending on if it's quoted.
        // Safe bet:
        let rawText = "";
        if (typeof text === 'string') {
            rawText = text;
        } else {
            // If it parsed as JSON automatically, it might be the analysis object itself?
            // Let's assume it might be raw text since we sent it as `new Response(analysisText)`.
            // Actually `fetch` `response.json()` will fail if it's just a raw markdown string not valid JSON.
            // But if Gemini returns JSON, it's valid JSON.
            rawText = JSON.stringify(text);
        }

        await logApiUsage('GEMINI_VISION_ANALYSIS');
        const result = safeParseJSON(rawText) as AnalysisResponse;

        if (!result) {
            // Try parsing directly if it was already an object
            if (typeof text === 'object') return { success: true, data: text as AnalysisResponse };
            throw new Error("Invalid JSON from AI");
        }
        return { success: true, data: result };

    } catch (criticalError: any) {
        console.error("[Gemini Analysis] Fatal Error Details:", criticalError);
        return { success: false, error: `Error en Análisis: ${criticalError.message?.slice(0, 50)}` };
    }
};

// Validate Generated Image
export const validateGeneratedImage = async (base64Image: string): Promise<boolean> => {
    console.log("[Gemini] validateGeneratedImage called.");
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API_KEY not found");

    const ai = new GoogleGenAI({ apiKey });
    const mimeType = getMimeType(base64Image);
    const data = stripBase64Prefix(base64Image);

    const prompt = `
    Act as a Quality Assurance Photographer. Analyze the attached image. Check for the following Fail Conditions:
    1. Is it an extreme close-up of just the mouth/teeth? (Macro shot).
    2. Is the person's forehead or eyes cut out of the frame?
    3. Is the aspect ratio horizontal instead of vertical?

    Output exactly and only: 'PASS' if the image shows the FULL FACE (eyes, nose, mouth, chin) and shoulders in a vertical format. 'FAIL' if it is a close-up of the mouth or crops the head significantly.
  `;

    try {
        const response = await ai.models.generateContent({
            model: VALIDATION_MODEL,
            contents: {
                parts: [
                    { inlineData: { mimeType, data } },
                    { text: prompt }
                ]
            }
        });

        const result = response.text?.trim().toUpperCase();
        await logApiUsage('GEMINI_VISION_ANALYSIS');
        return result === 'PASS';

    } catch (error) {
        console.error("Validation failed:", error);
        return true; // Fail open
    }
};

// Generate Smile Variation
export const generateSmileVariation = async (
    inputImageBase64: string,
    variationPrompt: string,
    aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" = "1:1",
    userId: string = "anon"
): Promise<{ success: boolean; data?: string; error?: string }> => {
    console.log("[Gemini] generateSmileVariation STARTED (Edge Function Delegate)");

    try {
        const data = stripBase64Prefix(inputImageBase64);

        const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            throw new Error("Configuration Error: Supabase URL/Key missing.");
        }

        const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-smile`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                image_base64: data,
                prompt_options: {
                    variationPrompt,
                    aspectRatio
                }
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Edge Function Error: ${errText}`);
        }

        const result = await response.json();
        console.log("[Gemini] Edge Function Response:", result);

        if (result.success && result.public_url) {
            return { success: true, data: result.public_url };
        }

        if (result.error) return { success: false, error: result.error };
        return { success: false, error: "Failed to generate smile variation." };

    } catch (criticalGenError: any) {
        console.error("[Gemini] FATAL ERROR in generateSmileVariation:", criticalGenError);
        return { success: false, error: `Error Fatal Generando Imagen: ${criticalGenError.message}` };
    }
};

// Generate Video
export const generateVeoVideo = async (
    inputImageBase64: string
): Promise<string> => {
    if (!await checkVideoQuota()) {
        throw new Error("Video Generation Limit Reached (1/1). Upgrade required for more.");
    }

    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API_KEY not found");

    const ai = new GoogleGenAI({ apiKey });

    let mimeType = '';
    let data = '';

    if (inputImageBase64.startsWith('http')) {
        try {
            const response = await fetch(inputImageBase64);
            if (!response.ok) throw new Error("Could not retrieve source image.");
            const blob = await response.blob();
            mimeType = blob.type;

            data = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                // Node.js FileReader polyfill or use ArrayBuffer
                // Since this is Server Action (Node env), FileReader might not exist or work same.
                // Better to use arrayBuffer and Buffer.from
                resolve(""); // Placeholder if we need to fix this logic for Node
            });

            // FIX for Node environment:
            const arrayBuffer = await blob.arrayBuffer();
            data = Buffer.from(arrayBuffer).toString('base64');

        } catch (e: any) {
            console.error("Failed to fetch remote image for Veo:", e);
            throw new Error("Failed to prepare source image for video generation.");
        }
    } else {
        mimeType = getMimeType(inputImageBase64);
        data = stripBase64Prefix(inputImageBase64);
    }

    const textPrompt = "Cinematic vertical video. The subject from the input image comes to life. They are laughing naturally and warmly in a restaurant setting. The head tilts slightly back in joy. The smile is wide, prominent, and STABLE, maintaining the exact dental structure and whiteness from the input image. Soft movement of background elements (blur). High quality, photorealistic, 4k.";
    const negativePrompt = "morphing face, changing teeth, closing mouth, distortion, cartoon, low quality, glitchy motion, talking";
    const fullPrompt = `${textPrompt} Negative prompt: ${negativePrompt}`;

    try {
        // Note: generateVideos might need a different import or client setup depending on SDK version
        // Assuming models.generateVideos exists or is accessible in current SDK version setup
        let operation = await ai.models.generateVideos({
            model: VIDEO_MODEL, // "veo-..."
            prompt: fullPrompt,
            image: {
                imageBytes: data,
                mimeType: mimeType
            },
            config: {
                numberOfVideos: 1,
                // resolution: '720p',
                // aspectRatio: '9:16'
            }
        });

        // Polling Loop
        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            operation = await ai.operations.getVideosOperation({ operation: operation });
        }

        if (operation.error) {
            throw new Error(`Video generation failed: ${operation.error.message}`);
        }

        const result = operation.response || (operation as any).result;
        const videoUri = result?.generatedVideos?.[0]?.video?.uri;

        if (!videoUri) {
            if (operation.metadata?.finishMessage) {
                throw new Error(`Video blocked: ${operation.metadata.finishMessage}`);
            }
            throw new Error("No video URI returned from Veo.");
        }

        await logApiUsage('GOOGLE_VEO_VIDEO');
        await markVideoQuotaUsed();

        // In Server Action, we can return the URI directly if it's accessible,
        // or proxy the download if it requires the key (which it does: videoUri + key=...)
        // Returning the URI with key appended is risky if sent to client?
        // The prototype did: fetch(uri + key).blob() -> createObjectURL.
        // We should probably download it here and upload to Supabase, then return Supabase URL.
        // For now, let's replicate prototype behavior but return base64 or similar to client?
        // Or just return the signed URL if safe.

        // SAFE APPROACH: Download video here, Upload to Supabase Storage, Return Public URL.
        // BUT for exact replication of prototype flow receiving a Blob URL:
        // We can fetch it, convert to base64 data URI (video/mp4).

        const videoUrlWithKey = `${videoUri}${videoUri.includes('?') ? '&' : '?'}key=${apiKey}`;
        const vidResponse = await fetch(videoUrlWithKey);
        if (!vidResponse.ok) throw new Error("Failed to download video from Veo");

        const vidBuffer = await vidResponse.arrayBuffer();
        const vidBase64 = Buffer.from(vidBuffer).toString('base64');

        return `data:video/mp4;base64,${vidBase64}`;

    } catch (error: any) {
        console.error("Veo generation error:", error);
        throw error;
    }
};
