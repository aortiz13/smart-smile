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
        const { image_path } = await req.json()
        if (!image_path) {
            throw new Error('Image path is required')
        }

        // Initialize Supabase Client
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        const supabase = createClient(supabaseUrl, supabaseKey)

        // Download image from Storage
        const { data: fileData, error: downloadError } = await supabase
            .storage
            .from('uploads') // Assuming 'uploads' bucket
            .download(image_path)

        if (downloadError) {
            throw new Error(`Failed to download image: ${downloadError.message}`)
        }

        // Convert to Base64
        const arrayBuffer = await fileData.arrayBuffer()
        const base64Image = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))

        // Prepare Gemini Request (Google AI Studio / Generative Language API)
        const apiKey = Deno.env.get('GOOGLE_API_KEY')
        if (!apiKey) {
            throw new Error("GOOGLE_API_KEY is not configured")
        }

        // Use Gemini 1.5 Flash
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`

        const prompt = `
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
    `

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
        const analysis = result.candidates[0].content.parts[0].text

        return new Response(analysis, {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
