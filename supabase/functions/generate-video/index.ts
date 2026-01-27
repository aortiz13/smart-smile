import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders, status: 200 })
    }

    try {
        const { lead_id } = await req.json()
        if (!lead_id) throw new Error('Lead ID is required')

        // Initialize Supabase
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        const supabase = createClient(supabaseUrl, supabaseKey)

        // 1. Fetch Lead Survey Data
        const { data: lead, error: leadError } = await supabase
            .from('leads')
            .select('survey_data, name')
            .eq('id', lead_id)
            .single()

        if (leadError || !lead) throw new Error('Lead not found')
        const surveyData = lead.survey_data || {}
        const ageRange = surveyData.ageRange || '30-55'

        // 2. Fetch Smile Image Generation
        const { data: generation, error: genError } = await supabase
            .from('generations')
            .select('output_path')
            .eq('lead_id', lead_id)
            .eq('type', 'image')
            .eq('status', 'completed')
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        if (genError || !generation) throw new Error('No smile image found for this lead')

        // 3. Prepare Prompts based on Scenarios
        let scenarioPrompt = "";
        const baseScene = "The smile is wide, prominent, and STABLE, maintaining the exact dental structure and whiteness from the input image. Cinematic vertical video. High quality, photorealistic, 4k.";

        if (ageRange === '18-30') {
            scenarioPrompt = `The subject from the input image comes to life. They are laughing naturally and warmly with friends in a vibrant green park during a sunny afternoon. The head tilts slightly back in joy. ${baseScene}`;
        } else if (ageRange === '55+') {
            scenarioPrompt = `The subject from the input image comes to life. They are at a warm family celebration dinner table, surrounded by loved ones for a birthday. They are smiling with deep happiness and fulfillment. ${baseScene}`;
        } else {
            // Default 30-55 or others
            scenarioPrompt = `The subject from the input image comes to life. They are on a stylish urban rooftop terrace during sunset after work, holding a drink and chatting naturally. Light activity, warm evening glow. ${baseScene}`;
        }

        const negativePrompt = "morphing face, changing teeth, closing mouth, distortion, cartoon, low quality, glitchy motion, talking, flashing lights, extra limbs, blurry face, flickering teeth, floating objects";

        // 4. Call Google Veo API
        const apiKey = Deno.env.get('GOOGLE_API_KEY')
        if (!apiKey) throw new Error("GOOGLE_API_KEY missing")

        // Endpoint for Veo 3.1
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-fast-generate-preview:predictLongRunning?key=${apiKey}`;

        // Get absolute URL for the image
        const { data: { publicUrl: imageUrl } } = supabase.storage.from('generated').getPublicUrl(generation.output_path)

        // Download image to send as bytes or just use URL if supported?
        // Most Google APIs prefer bytes or GCS. For generativelanguage, we'll try inlineData.
        const imgResponse = await fetch(imageUrl);
        const imgBlob = await imgResponse.blob();
        const imgBase64 = btoa(String.fromCharCode(...new Uint8Array(await imgBlob.arrayBuffer())));

        console.log(`Starting video generation for ${lead.name} (${ageRange})...`);

        const aiResponse = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                instances: [
                    {
                        prompt: scenarioPrompt,
                        image: {
                            bytesBase64Encoded: imgBase64,
                            mimeType: "image/jpeg"
                        }
                    }
                ],
                parameters: {
                    sampleCount: 1,
                    aspectRatio: "9:16",
                    resolution: "720p"
                }
            })
        });

        if (!aiResponse.ok) {
            const errText = await aiResponse.text();
            console.error("AI API Error:", errText);
            throw new Error(`AI API Error: ${errText}`);
        }

        const operation = await aiResponse.json();
        const operationName = operation.name; // ID to poll

        // 5. Initial Generation Record (Pending)
        const { data: newGen, error: insertError } = await supabase
            .from('generations')
            .insert({
                lead_id: lead_id,
                type: 'video',
                status: 'pending',
                input_path: generation.output_path,
                metadata: {
                    operation_name: operationName,
                    scenario: ageRange,
                    prompt: scenarioPrompt
                }
            })
            .select()
            .single()

        if (insertError) throw insertError

        return new Response(JSON.stringify({
            success: true,
            generation_id: newGen.id,
            operation_name: operationName
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (error) {
        console.error(error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
