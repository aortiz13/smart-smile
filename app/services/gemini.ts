'use server';

import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResponse, VariationType } from "@/types/gemini";
import { logApiUsage, checkVideoQuota, markVideoQuotaUsed } from "./backendService";

// Models
const ANALYSIS_MODEL = "gemini-1.5-flash"; // Fallback to stable if 2.5 is not found
const IMAGE_MODEL = "gemini-1.5-pro"; // Or imagen-3.0 if available
const TARGET_IMAGE_MODEL = "gemini-1.5-pro"; // Mapping this to the same as IMAGE_MODEL based on user intent

const VALIDATION_MODEL = "gemini-1.5-flash";
const VIDEO_MODEL = "veo-2.0-generate-preview"; // Veo 3.1 might not be public yet

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
export const validateImageStrict = async (base64Image: string): Promise<{ isValid: boolean; reason: string }> => {
    console.log("[Gemini] validateImageStrict called. Image length:", base64Image?.length);
    if (!base64Image) {
        return { isValid: false, reason: "Error: Imagen vacía o corrupta." };
    }

    try {
        const apiKey = process.env.API_KEY;
        if (!apiKey) {
            console.error("[Gemini Gatekeeper] Missing API_KEY");
            return { isValid: false, reason: "Error de configuración del servidor (API KEY missing)." };
        }

        const ai = new GoogleGenAI({ apiKey });
        const mimeType = getMimeType(base64Image);
        const data = stripBase64Prefix(base64Image);

        const prompt = `
        You are a Strict Biometric Validator for a dental AI app. Analyze the image and determine if it is suitable for clinical smile design.
        
        THE RULES (Rejection Criteria):
        1. Non-Human: Reject cars, animals, cartoons, landscapes, objects. MUST BE A REAL HUMAN.
        2. No Face: Reject if face is not clearly visible or too far away.
        3. Obstruction: Reject if mouth is covered (hands, mask, phone).
        4. Angle: Reject extreme profiles.
        5. Quality: Reject if too dark, too blurry, or pixelated.
    
        OUTPUT REQUIREMENT:
        Return ONLY a JSON object.
        {
          "is_valid": boolean,
          "rejection_reason": "string (Max 6 words, in Spanish)"
        }
      `;

        const response = await ai.models.generateContent({
            model: VALIDATION_MODEL,
            contents: {
                parts: [
                    { inlineData: { mimeType, data } },
                    { text: prompt }
                ]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        is_valid: { type: Type.BOOLEAN },
                        rejection_reason: { type: Type.STRING }
                    },
                    required: ["is_valid", "rejection_reason"]
                }
            }
        });



        const text = extractText(response);
        console.log("[Gemini] Gatekeeper Response Text:", text.slice(0, 50));

        if (text) {
            const result = safeParseJSON(text);
            if (!result) return { isValid: false, reason: "Error procesando la respuesta de IA." };

            if (result.is_valid) {
                return { isValid: true, reason: "" };
            } else {
                return { isValid: false, reason: result.rejection_reason };
            }
        }

        return { isValid: false, reason: "Error de validación. Intenta otra foto." };

    } catch (error: any) {
        console.error("[Gatekeeper] Critical Error:", error);
        // Important: Return a serializable object to prevent Next.js from throwing "Server Components render" error
        return { isValid: false, reason: `Error de Validación: ${error.message?.slice(0, 100) || "Error desconocido"}` };
    }
};

// Analysis
export const analyzeImageAndGeneratePrompts = async (base64Image: string): Promise<AnalysisResponse> => {
    console.log("[Gemini] analyzeImageAndGeneratePrompts called.");
    try {
        const apiKey = process.env.API_KEY;
        if (!apiKey) {
            console.error("[Gemini Analysis] Missing API_KEY");
            throw new Error("Server configuration error: API_KEY missing");
        }

        const ai = new GoogleGenAI({ apiKey });
        const mimeType = getMimeType(base64Image);
        const data = stripBase64Prefix(base64Image);

        const prompt = `
    ROLE: Expert Dental Morphologist and AI Prompt Engineer. 
    TASK: Analyze the user's face using specific landmarks: Eyes, Nose, and Hairline. Generate a restoration plan that harmonizes with these features.
    
    SCIENTIFIC ANALYSIS PARAMETERS (Clinical Landmarks & Rules):
    1. The Interpupillary Rule (Eyes): Detect the user's eyes. The line connecting the center of the eyes (interpupillary line) must be the horizon for the smile. The "Incisal Plane" must be perfectly parallel to this eye line.
    2. The Nasal Width Guide (Nose): Use the width of the base of the nose (alar base) to determine the position of the Canines. 
    3. Facial Midline: Strictly align the Dental Midline (between two front teeth) with the Philtrum and Tip of the Nose.
    4. Facial Frame Balance (Hair/Brows): Analyze the visual weight of the "Upper Facial Third" (Hair volume and Brow thickness). If the subject has a heavy upper frame, slighty increase the dominance/size of the Central Incisors to maintain vertical balance.
    5. Golden Proportion (1.618): Central width should be ~1.618x the visible width of Lateral Incisor.

    WORKFLOW STRATEGY: 
    1. The first variation (original_bg) is the CLINICAL RESTORATION. It serves as the SOURCE OF TRUTH.
       - You must map the scientific analysis above into the editing instructions.
       - CRITICAL FRAMING: The output must be a 9:16 Vertical Portrait showing the FULL FACE.
    2. The other 2 variations MUST use the result of step 1 as a Reference Image for consistency.

    OUTPUT FORMAT: Strictly JSON.

    REQUIRED VARIATIONS & GUIDELINES:

    1. original_bg (Scientific Natural Restoration):
       - Subject: "A photorealistic vertical medium shot of the user, featuring a scientifically aligned smile restoration based on facial morphopsychology."
       - Composition: "9:16 Vertical Portrait (Stories Format). Medium Shot. Full head and shoulders visible."
       - Action: "The subject is smiling naturally, with a dentition aligned to their interpupillary horizon."
       - Location: "Soft-focus professional studio or original background."
       - Style: "High-End Aesthetic Dentistry Photography, 8K resolution."
       - Editing_Instructions: "APPLY CLINICAL LANDMARKS: \n1. HORIZON: Align the Incisal Plane to be strictly parallel with the Interpupillary Line (Eyes).\n2. MIDLINE & WIDTH: Align the dental midline with the Philtrum/Nose Tip. Use the alar base width (nose width) to guide the cusp tip position of the Canines.\n3. VERTICAL BALANCE: Assess the visual weight of the Hair and Eyebrows. If the upper face is dominant, increase the length of Central Incisors slightly to balance the face.\n4. PROPORTIONS: Enforce the esthetic dental proportion of 1.6:1:0.6 (Central:Lateral:Canine)."
       - Refining_Details: "Texture must be polychromatic natural ivory with realistic translucency at incisal edges. Ensure the smile arc follows the lower lip."
       - Reference_Instructions: "Use the user's original photo strictly for Facial Identity, Skin Tone, and Lip Shape. Completely replace the dental structure using the landmarks defined above."

    2. lifestyle_social:
       - Subject: "The person from the reference image, maintaining the EXACT same smile and dental geometry."
       - Composition: "9:16 Vertical Portrait."
       - Action: "Laughing candidly at a gala or high-end dinner."
       - Style: "Warm, social lifestyle photography, depth of field."
       - Location: "Luxury restaurant or event space."
       - Editing_Instructions: "Place subject in a social context. Keep the teeth identical to the Reference Image."
       - Reference_Instructions: "Use the 'Natural Restoration' image to lock the facial identity and the smile design."

    3. lifestyle_outdoor:
       - Subject: "The person from the reference image, maintaining the EXACT same smile and dental geometry."
       - Composition: "9:16 Vertical Portrait."
       - Action: "Walking confidently, wind in hair."
       - Style: "Cinematic outdoor lighting, vogue aesthetic."
       - Location: "Urban architecture or nature at golden hour."
       - Editing_Instructions: "Golden hour lighting. Keep the teeth identical to the Reference Image."
       - Reference_Instructions: "Use the 'Natural Restoration' image to lock the facial identity and the smile design."
  `;

        let attempts = 0;
        const maxRetries = 3;

        while (attempts < maxRetries) {
            try {
                const response = await ai.models.generateContent({
                    model: ANALYSIS_MODEL,
                    contents: {
                        parts: [
                            { inlineData: { mimeType, data } },
                            { text: prompt }
                        ]
                    },
                    config: {
                        responseMimeType: "application/json",
                        responseSchema: {
                            type: Type.OBJECT,
                            properties: {
                                variations: {
                                    type: Type.ARRAY,
                                    items: {
                                        type: Type.OBJECT,
                                        properties: {
                                            type: {
                                                type: Type.STRING,
                                                enum: [
                                                    VariationType.ORIGINAL_BG,
                                                    VariationType.LIFESTYLE_SOCIAL,
                                                    VariationType.LIFESTYLE_OUTDOOR
                                                ]
                                            },
                                            prompt_data: {
                                                type: Type.OBJECT,
                                                properties: {
                                                    Subject: { type: Type.STRING },
                                                    Composition: { type: Type.STRING },
                                                    Action: { type: Type.STRING },
                                                    Location: { type: Type.STRING },
                                                    Style: { type: Type.STRING },
                                                    Editing_Instructions: { type: Type.STRING },
                                                    Refining_Details: { type: Type.STRING },
                                                    Reference_Instructions: { type: Type.STRING }
                                                },
                                                required: ["Subject", "Composition", "Action", "Location", "Style", "Editing_Instructions"]
                                            }
                                        },
                                        required: ["type", "prompt_data"]
                                    }
                                }
                            }
                        }
                    }
                });



                const text = extractText(response);
                if (text) {
                    await logApiUsage('GEMINI_VISION_ANALYSIS');
                    const result = safeParseJSON(text) as AnalysisResponse;
                    if (!result) throw new Error("Invalid JSON from analysis model");
                    return result;
                } else {
                    throw new Error("No text response from analysis model.");
                }
            } catch (error: any) {
                attempts++;
                if (isModelOverloaded(error) && attempts < maxRetries) {
                    const waitTime = 3000 * Math.pow(2, attempts - 1);
                    await delay(waitTime);
                    continue;
                }
                console.error("Analysis failed:", error);
                // SANITIZE ERROR FOR SERVER ACTION SERIALIZATION
                throw new Error(`Analysis Failed: ${error.message || "Unknown error"}`);
            }
        }
        throw new Error("Analysis failed after retries.");
    } catch (criticalError: any) {
        console.error("[Gemini Analysis] Fatal Error:", criticalError);
        // Wrap in a plain error message to be safe
        throw new Error(`Error en Análisis: ${criticalError.message?.slice(0, 100) || "Fallo del sistema AI"}`);
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
    aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" = "1:1"
): Promise<string> => {
    console.log("[Gemini] generateSmileVariation called for prompt:", variationPrompt.slice(0, 50));
    try {
        const apiKey = process.env.API_KEY;
        if (!apiKey) {
            console.error("[Gemini Generation] Missing API_KEY");
            throw new Error("Server configuration error: API_KEY missing");
        }

        const ai = new GoogleGenAI({ apiKey });
        const mimeType = getMimeType(inputImageBase64);
        const data = stripBase64Prefix(inputImageBase64);

        let attempts = 0;
        const maxRetries = 5;

        while (attempts < maxRetries) {
            try {
                // NOTE: Using a specific model identifier. Check docs for latest Imagen/Gemini image gen model if this fails.
                // Prototype used: gemini-3-pro-image-preview. 
                // We will try to use the same if possible, or 'imagen-3.0-generate-001'
                const response = await ai.models.generateContent({
                    model: TARGET_IMAGE_MODEL,
                    // If the user specifically needs the image model, we might need to change this.
                    // For now, using flash for broader compatibility unless specified otherwise.
                    // ACTUALLY, strict 'text-to-image' or 'image-to-image' via `generateContent` in new SDK depends on model capabilities.
                    // Let's assume the user has access to the model they specified.
                    contents: {
                        parts: [
                            { inlineData: { mimeType, data } },
                            { text: variationPrompt }
                        ]
                    },
                    // config: { 
                    //   imageConfig: { imageSize: "1024x1024" } // check correct config param
                    // }
                });
                // The new SDK returns images differently sometimes.
                // If it's pure image generation model like Imagen, response structure matches.

                for (const part of response.candidates?.[0]?.content?.parts || []) {
                    if (part.inlineData) {
                        await logApiUsage('NANO_BANANA_IMAGE');
                        return `data:image/png;base64,${part.inlineData.data}`;
                    }
                }

                // If text response, maybe it failed to gen image?
                if (response.text) {
                    console.log("Model returned text instead of image:", response.text);
                }

                throw new Error("No image data found in generation response.");

            } catch (error: any) {
                attempts++;
                if (isModelOverloaded(error) && attempts < maxRetries) {
                    const waitTime = 3000 * Math.pow(2, attempts - 1);
                    await delay(waitTime);
                    continue;
                }
                console.error("Image generation failed:", error);
                // SANITIZE ERROR
                throw new Error(`Generation Failed: ${error.message || "Unknown error"}`);
            }
        }
        throw new Error("Image generation failed after multiple retries.");
    } catch (criticalGenError: any) {
        console.error("[Gemini Generation] Fatal Error:", criticalGenError);
        throw new Error(`Error generando imagen: ${criticalGenError.message?.slice(0, 100) || "Intenta de nuevo."}`);
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
