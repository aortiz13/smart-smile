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
        try {
            const { image_path, image_base64, mode = 'analyze' } = await req.json()

            if (!image_path && !image_base64) {
                throw new Error('Image path or Base64 data is required')
            }

            // Initialize Supabase Client
            const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
            const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
            const supabase = createClient(supabaseUrl, supabaseKey)

            let base64Image = image_base64;

            // If no base64 provided, download from Storage
            if (!base64Image && image_path) {
                const { data: fileData, error: downloadError } = await supabase
                    .storage
                    .from('uploads') // Assuming 'uploads' bucket
                    .download(image_path)

                if (downloadError) {
                    throw new Error(`Failed to download image: ${downloadError.message}`)
                }
                // Convert to Base64
                const arrayBuffer = await fileData.arrayBuffer()
                base64Image = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
            }

            // Prepare Gemini Request
            const apiKey = Deno.env.get('GOOGLE_API_KEY')
            if (!apiKey) {
                throw new Error("GOOGLE_API_KEY is not configured")
            }

            // Use Gemini 1.5 Flash for speed and analysis
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`

            let prompt = "";

            if (mode === 'validate') {
                prompt = `
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
            } else {
                // Default "analyze" mode
                prompt = `
          Analyze this image strictly. 
          1. Gatekeeper: Is this a real human face? Is it unobscured? Is it facing forward? 
          2. Clinical: If yes, extract facial landmarks (eyes, nose, lips, chin) coordinates and smile description.
          
          Return JSON format:
          {
            "valid": boolean,
            "reason": string (if invalid),
            "landmarks": { ... },
            "analysis": string
          }
        `;
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: prompt },
                            { inlineData: { mimeType: 'image/jpeg', data: base64Image } }
                        ]
                    }],
                    generationConfig: {
                        responseMimeType: "application/json"
                    }
                })
            })

            if (!response.ok) {
                const errText = await response.text()
                throw new Error(`Gemini API Error: ${errText}`)
            }

            const result = await response.json()
            const analysisText = result.candidates?.[0]?.content?.parts?.[0]?.text;

            // Ensure we handle cases where text might be missing or malformed
            if (!analysisText) {
                throw new Error("Empty response from AI")
            }

            return new Response(analysisText, {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })

        } catch (error) {
            return new Response(JSON.stringify({ error: error.message }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            })
        }
    })
