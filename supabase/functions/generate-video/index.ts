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

        // Clean path... (existing)
        let storagePath = generation.output_path;
        if (storagePath.startsWith('http')) {
            const urlObj = new URL(storagePath);
            const pathParts = urlObj.pathname.split('/generated/');
            if (pathParts.length > 1) {
                storagePath = decodeURIComponent(pathParts[1]);
            }
        }
        console.log(`Original path: ${generation.output_path}, Parsed storage path: ${storagePath}`);

        // Get Signed URL
        const { data: signedUrlData, error: signError } = await supabase
            .storage
            .from('generated')
            .createSignedUrl(storagePath, 60);

        if (signError || !signedUrlData) {
            console.error("Signed URL Error:", signError);
            throw new Error(`Failed to create signed URL`);
        }

        const imageUrl = signedUrlData.signedUrl;

        // Download image
        const imgResponse = await fetch(imageUrl);
        if (!imgResponse.ok) throw new Error("Failed to fetch source image");

        const imgBlob = await imgResponse.blob();
        const arrayBuffer = await imgBlob.arrayBuffer();
        const imgBase64 = Buffer.from(arrayBuffer).toString('base64');
        const mimeType = imgBlob.type || 'image/jpeg';

        console.log(`Starting video generation for ${lead.name} (${ageRange})... Image Type: ${mimeType}`);

        // STEP 1: GENERATE SMILE IMAGE with Gemini 3 Pro (Nano Banana)
        console.log("Generating Smile Image with Gemini 3 Pro...");

        // 4. Call Google Veo API
        const apiKey = Deno.env.get('GOOGLE_API_KEY')
        if (!apiKey) throw new Error("GOOGLE_API_KEY missing")

        let sceneImgBase64 = imgBase64; // Default to original
        let sceneImgMimeType = mimeType;
        let generatedScenePath = generation.output_path;

        // Use same key for Vision Model
        const visionEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/nano-banana-pro-preview:generateContent?key=${apiKey}`;

        const analysisSystemPrompt = `
    [System] Enforcing Clinical Landmarks:
    1. Interpupillary Horizon (Eyes)
    2. Alar Base Width Guide (Nose)
    3. Upper Facial Frame Balance (Brows/Hair)

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
        `;

        try {
            const analysisResponse = await fetch(visionEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: analysisSystemPrompt },
                            { inline_data: { mime_type: mimeType, data: imgBase64 } }
                        ]
                    }],
                })
            });

            if (analysisResponse.ok) {
                const analysisData = await analysisResponse.json();
                console.log("Gemini 3 Pro Response received.");

                // Attempt to find Image Data in the response
                // Option 1: Inline Base64 in content (Rare for generateContent but possible for Image models)
                // Option 2: JSON output containing base64 string (User prompt asks for JSON)

                const part = analysisData.candidates?.[0]?.content?.parts?.[0];

                if (part?.inline_data) {
                    // Direct Image Response
                    console.log("Image Data Found in Response (inline_data).");
                    sceneImgBase64 = part.inline_data.data;
                    sceneImgMimeType = part.inline_data.mime_type;
                } else if (part?.text) {
                    // Check if JSON text contains image data
                    try {
                        const json = JSON.parse(part.text);
                        // Look for common keys: image_custom, generated_image, base64, etc.
                        // Or if the prompt implies the output IS the image description, we might fail here.
                        // But user insists this GENERATES the image.
                        // Let's check for 'original_bg' having a specific image field?
                        // If not, we log.
                        console.log("Text response received:", part.text.substring(0, 100) + "...");
                    } catch (e) {
                        // Not JSON
                    }
                }

                // If we got a NEW image (and it's different/updated), upload it.
                if (sceneImgBase64 !== imgBase64) {
                    console.log("New Scene Image Generated. Uploading...");
                    const sceneFileName = `${generation.output_path.split('/').pop()?.split('.')[0]}_smile_gen.png`;
                    const sceneBuffer = Buffer.from(sceneImgBase64, 'base64');

                    const { data: uploadData, error: uploadError } = await supabase
                        .storage
                        .from('generated')
                        .upload(`${lead_id}/${sceneFileName}`, sceneBuffer, {
                            contentType: sceneImgMimeType,
                            upsert: true
                        });

                    if (!uploadError && uploadData) {
                        generatedScenePath = uploadData.path;
                        console.log(`Smile Image uploaded to: ${generatedScenePath}`);
                    }
                } else {
                    console.warn("No new image data found in Gemini 3 response. Proceeding with original image.");
                }

            } else {
                console.warn("Gemini 3 Pro Request Failed:", await analysisResponse.text());
            }
        } catch (err) {
            console.error("Error in Smile Generation Step:", err);
        }

        // 3. Prepare Prompts based on Scenarios
        // (Simplified Veo prompt since we hopefully have the smile image now)
        const baseInstructions = `
        - Subject: "The person from the input image."
        - Composition: "9:16 Vertical Portrait. FIXED CAMERA. NO ROTATION."
        `;

        let scenarioDetails = "";
        if (ageRange === '18-30') {
            scenarioDetails = `- Location: "Vibrant green park. Natural daylight. Green background."\n- Action: "Laughing naturally and warmly. Gentle head tilting in joy."`;
        } else if (ageRange === '55+') {
            scenarioDetails = `- Location: "Warm family dining room. Indoor lighting."\n- Action: "Smiling and interacting. Continuous gentle movement."`;
        } else {
            scenarioDetails = `- Location: "Stylish urban rooftop terrace. City sunset background."\n- Action: "Holding a drink and chatting naturally. Continuous light activity."`;
        }

        const scenarioPrompt = `${baseInstructions}\n${scenarioDetails}\n- Style: "Cinematic, Photorealistic, 4k High Quality."\n- NOTE: The video must start INSTANTLY in the target location (${ageRange === '18-30' ? 'Park' : 'Room/Roof'}). Do NOT fade in from the input image background.`;

        const negativePrompt = "black background, dark background, studio background, black void, morphing face, changing teeth, closing mouth, distortion, cartoon, low quality, glitchy motion, talking, flashing lights, extra limbs, blurry face, flickering teeth, floating objects, static start, frozen face, pause before moving, camera rotation, spinning camera, zoom out, open mouth";

        // 4. Call Google Veo API
        // apiKey already retrieved above.

        // Endpoint for Veo 3.1
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-fast-generate-preview:predictLongRunning?key=${apiKey}`;

        console.log(`Starting video generation for ${lead.name} (${ageRange})... Image Type: ${mimeType}`);

        // Proceeding to Veo with Enhanced Prompt and (potentially) New Scene Image

        // SKIP IMAGEN GENERATION (Not supported by available API models)
        // Proceeding directly to Veo with Enhanced Prompt

        const aiResponse = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                instances: [
                    {
                        prompt: scenarioPrompt,
                        image: {
                            bytesBase64Encoded: sceneImgBase64, // Use the NEW (or original) scene image
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
                input_path: generatedScenePath, // Track which input was used
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
