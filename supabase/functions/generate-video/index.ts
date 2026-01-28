import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Buffer } from 'node:buffer'

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
        const baseScene = "The subject is INSTANTLY in the target environment. The background IS NOT black; it is the target scene from the very first frame. FIXED CAMERA, NO ZOOM, NO ROTATION. The subject faces forward. Lips sealed, gentle smile. Cinematic vertical video. High quality, photorealistic, 4k. Background sound: emotive music.";

        if (ageRange === '18-30') {
            scenarioPrompt = `The subject is already laughing manually and warmly in a vibrant green park. Green background. Natural daylight. Gentle head tilting in joy, but camera stays fixed. ${baseScene}`;
        } else if (ageRange === '55+') {
            scenarioPrompt = `The subject is already smiling at a warm family celebration. Warm indoor lighting. Background of a dining room. Continuous gentle movement. ${baseScene}`;
        } else {
            // Default 30-55 or others
            scenarioPrompt = `The subject is already on a stylish urban rooftop terrace. City sunset background. They are holding a drink. Continuous light activity. ${baseScene}`;
        }

        const negativePrompt = "black background, dark background, studio background, black void, morphing face, changing teeth, closing mouth, distortion, cartoon, low quality, glitchy motion, talking, flashing lights, extra limbs, blurry face, flickering teeth, floating objects, static start, frozen face, pause before moving, camera rotation, spinning camera, zoom out, open mouth";

        // 4. Call Google Veo API
        const apiKey = Deno.env.get('GOOGLE_API_KEY')
        if (!apiKey) throw new Error("GOOGLE_API_KEY missing")

        // Endpoint for Veo 3.1 - Defined later after scene generation
        // const endpoint = ...

        // Clean path: if it's a full URL, extract the relative path
        let storagePath = generation.output_path;
        if (storagePath.startsWith('http')) {
            const urlObj = new URL(storagePath);
            // URL format: .../storage/v1/object/public/generated/PATH...
            // We want PATH...
            const pathParts = urlObj.pathname.split('/generated/');
            if (pathParts.length > 1) {
                storagePath = decodeURIComponent(pathParts[1]);
            }
        }

        console.log(`Original path: ${generation.output_path}, Parsed storage path: ${storagePath}`);

        // Get Signed URL for the image (safer if bucket is private)
        const { data: signedUrlData, error: signError } = await supabase
            .storage
            .from('generated')
            .createSignedUrl(storagePath, 60); // Valid for 60 seconds

        if (signError || !signedUrlData) {
            console.error("Signed URL Error:", signError, "Path:", storagePath);
            throw new Error(`Failed to create signed URL for ${generation.output_path}`);
        }

        const imageUrl = signedUrlData.signedUrl;
        console.log(`Fetching image from: ${imageUrl}`);

        // Download image to send as bytes
        const imgResponse = await fetch(imageUrl);
        if (!imgResponse.ok) {
            throw new Error(`Failed to fetch source image: ${imgResponse.statusText}`);
        }

        const imgBlob = await imgResponse.blob();
        const arrayBuffer = await imgBlob.arrayBuffer();
        // Use Buffer for safer/faster base64 encoding (Deno/Supabase support Node Buffer)
        const imgBase64 = Buffer.from(arrayBuffer).toString('base64');
        const mimeType = imgBlob.type || 'image/jpeg';

        // ... (lines 1-103 same as before, preserving fetch logic)

        console.log(`Starting video generation for ${lead.name} (${ageRange})... Image Type: ${mimeType}`);

        // --- NEW STEP: SCENE GENERATION via Imagen 4 ---
        console.log("Generating intermediate scene image via Imagen 4...");
        const imagenEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-fast-generate-001:predict?key=${apiKey}`;

        // Prompt for background replacement (Scene Generation)
        let bgPrompt = `A photorealistic portrait of the subject in ${ageRange === '18-30' ? "a vibrant green park" : (ageRange === '55+' ? "a warm family dining room" : "a stylish urban rooftop")}. The background is fully visible. The subject maintains their EXACT facial features and smile. High quality, 8k. Background replacement.`;

        let sceneImgBase64 = imgBase64; // Default to original if fails
        let sceneImgMimeType = mimeType;
        let scenePath = generation.output_path; // Default

        try {
            const imagenResponse = await fetch(imagenEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    instances: [
                        {
                            prompt: bgPrompt,
                            image: {
                                bytesBase64Encoded: imgBase64,
                                mimeType: mimeType
                            }
                        }
                    ],
                    parameters: {
                        sampleCount: 1,
                        aspectRatio: "9:16",
                        storageUri: "gs://mock-bucket" // Not used, receiving base64
                    }
                })
            });

            if (imagenResponse.ok) {
                const imgData = await imagenResponse.json();
                // Check response structure for Imagen 4 - typically predictions[0].bytesBase64Encoded
                if (imgData.predictions?.[0]?.bytesBase64Encoded) {
                    sceneImgBase64 = imgData.predictions[0].bytesBase64Encoded;
                    sceneImgMimeType = imgData.predictions[0].mimeType || 'image/png';
                    console.log("Scene image generated successfully.");

                    // Upload SCENE image to storage to inspect it / use it
                    const sceneFileName = `${generation.output_path.split('/').pop()?.split('.')[0]}_scene.png`;
                    const sceneBuffer = Buffer.from(sceneImgBase64, 'base64');

                    const { data: uploadData, error: uploadError } = await supabase
                        .storage
                        .from('generated')
                        .upload(`${lead_id}/${sceneFileName}`, sceneBuffer, {
                            contentType: sceneImgMimeType,
                            upsert: true
                        });

                    if (!uploadError && uploadData) {
                        scenePath = uploadData.path;
                        console.log(`Scene image uploaded to: ${scenePath}`);
                    }
                }
            } else {
                console.warn(`Imagen 4 generation failed: ${await imagenResponse.text()}`);
                // Fallback to original image, Veo will try.
            }
        } catch (err) {
            console.error("Error generating scene image:", err);
        }

        // --- CALL VEO WITH SCENE IMAGE ---
        // Use Veo Preview as per revert decision
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-fast-generate-preview:predictLongRunning?key=${apiKey}`;

        const aiResponse = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                instances: [
                    {
                        prompt: scenarioPrompt,
                        image: {
                            bytesBase64Encoded: sceneImgBase64, // Use the NEW scene image
                            mimeType: sceneImgMimeType
                        }
                    }
                ],
                parameters: {
                    sampleCount: 1,
                    aspectRatio: "9:16",
                    resolution: "1080p", // Keeping param
                    durationSeconds: 5,  // Keeping param
                    negativePrompt: negativePrompt
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
                status: 'processing',
                input_path: generation.output_path,
                metadata: {
                    operation_name: operationName,
                    scenario: ageRange,
                    prompt: scenarioPrompt,
                    negative_prompt: negativePrompt
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
