import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }


    try {
        const { image_path, image_base64, analysisAsync, prompt_options } = await req.json()
        if (!image_path && !image_base64) throw new Error('Image path or Base64 data is required')

        // Initialize Supabase
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        const supabase = createClient(supabaseUrl, supabaseKey)

        let base64Image = image_base64;

        if (!base64Image && image_path) {
            // Download original image
            const { data: fileData, error: downloadError } = await supabase.storage.from('uploads').download(image_path)
            if (downloadError) throw new Error(`Download failed: ${downloadError.message}`)

            const arrayBuffer = await fileData.arrayBuffer()
            base64Image = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
        }

        // Construct Prompt
        const finalPrompt = `
      Subject: Close up portrait of the person.
      Action: Smiling confidently with a perfect, natural smile.
      Style: Photorealistic, cinematic lighting, 8k resolution, spa dental aesthetic being extremely high quality.
      Target: ${JSON.stringify(prompt_options || {})}
      Editing Input: Replace the teeth with high quality veneers, keeping the face structure exactly the same.
    `

        // Call Imaging API (Gemini/Imagen via Google AI Studio)
        const apiKey = Deno.env.get('GOOGLE_API_KEY')
        if (!apiKey) throw new Error("GOOGLE_API_KEY missing")

        // User requested "gemini-3-pro-image-preview" for smile design
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`
        // NOTE: Keeping 2.0-flash for DESCRIPTION generation as 'generate-smile' currently generates text description of improvements,
        // or a mock image. If the INTENT is to generate an actual image via 3-pro, the endpoint/body would need to change to an image generation endpoint
        // which might not be fully supported via 'generateContent' for all models or requires 'imagen'.
        // However, to satisfy the user request "Use gemini-3-pro-image-preview for Smile Design", I will use it.
        // BUT, 3-pro-image-preview might NOT support text-to-text 'describe improvements'.
        // If this function is meant to generate the IMAGE, it should use the image generation prompt/response handling.
        // Current code mocks the return.

        // Let's stick to 2.0-Flash for the *text description* part if that is what this does.
        // BUT the user says "Para diseñar la sonrisa".
        // Use the model requested. If it fails, we fall back to mock.
        const modelEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`

        const response = await fetch(modelEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: `Generate a photorealistic image based on: ${finalPrompt}` },
                        { inline_data: { mime_type: 'image/jpeg', data: base64Image } }
                    ]
                }],
                generationConfig: {
                    response_mime_type: "image/jpeg"
                }
            })
        })

        if (!response.ok) {
            const err = await response.text();
            console.error("Gemini API Error:", err);
            throw new Error(`Gemini API Failed: ${err}`)
        }

        const result = await response.json();
        const candidates = result.candidates;

        let generatedBase64 = null;
        let mimeType = "image/jpeg";

        if (candidates && candidates[0]?.content?.parts) {
            for (const part of candidates[0].content.parts) {
                const inlineData = part.inline_data || part.inlineData;
                if (inlineData) {
                    generatedBase64 = inlineData.data;
                    mimeType = inlineData.mime_type || inlineData.mimeType || "image/jpeg";
                    break;
                }
            }
        }

        if (!generatedBase64) {
            console.error("No image in response:", JSON.stringify(result));
            throw new Error("AI did not return an image.");
        }

        // Upload to Supabase Storage
        const fileName = `smile_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
        const binaryString = atob(generatedBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        // Assuming 'generated' bucket exists and is public
        const { data: uploadData, error: uploadError } = await supabase
            .storage
            .from('generated')
            .upload(fileName, bytes, {
                contentType: mimeType,
                upsert: false
            });

        if (uploadError) {
            console.error("Upload failed:", uploadError);
            throw new Error(`Failed to upload generated image: ${uploadError.message}`);
        }

        const { data: { publicUrl } } = supabase
            .storage
            .from('generated')
            .getPublicUrl(fileName);

        return new Response(JSON.stringify({
            success: true,
            public_url: publicUrl
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (error) {
        console.error("Edge Function Error:", error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500, // Return 500 so client knows it failed
        })
    }
})
