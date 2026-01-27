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
        const { generation_id } = await req.json()
        if (!generation_id) throw new Error('Generation ID is required')

        // Initialize Supabase
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        const supabase = createClient(supabaseUrl, supabaseKey)

        // 1. Fetch Generation Info
        const { data: gen, error: genError } = await supabase
            .from('generations')
            .select('*')
            .eq('id', generation_id)
            .single()

        if (genError || !gen) throw new Error('Generation record not found')
        if (gen.status === 'completed') return new Response(JSON.stringify(gen), { headers: corsHeaders })

        const operationName = gen.metadata?.operation_name
        if (!operationName) throw new Error('Operation name missing in metadata')

        // 2. Check Operation Status with Google
        const apiKey = Deno.env.get('GOOGLE_API_KEY')
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${apiKey}`

        const response = await fetch(endpoint)
        if (!response.ok) throw new Error(`Google API Error: ${await response.text()}`)

        const operation = await response.json()

        // 3. Handle Result
        if (operation.done) {
            if (operation.error) {
                await supabase.from('generations').update({ status: 'error', metadata: { ...gen.metadata, error: operation.error } }).eq('id', generation_id)
                throw new Error(`Generation failed: ${operation.error.message}`)
            }

            // Successfully generated!
            // The response for Veo usually contains an array of videos in 'response.videos' or similar
            const videoData = operation.response?.videos?.[0] || operation.response?.outputs?.[0]
            if (!videoData) throw new Error('No video found in response')

            // If it returns bytes/base64 or a temporary URL
            // Assuming it returns an object with 'uri' or 'bytes'
            // For now, let's assume we need to download it if it's a URL or save if bytes
            let videoBlob: Blob;
            if (videoData.uri) {
                const vidRes = await fetch(videoData.uri)
                videoBlob = await vidRes.blob()
            } else if (videoData.bytesBase64) {
                const binary = atob(videoData.bytesBase64)
                const array = new Uint8Array(binary.length)
                for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i)
                videoBlob = new Blob([array], { type: 'video/mp4' })
            } else {
                // Fallback / Log structure
                console.log("Unknown video data structure:", videoData)
                throw new Error('Unsupported video data format')
            }

            // 4. Upload to Supabase Storage
            const fileName = `video_${generation_id}.mp4`
            const filePath = `videos/${fileName}`
            const { error: uploadError } = await supabase.storage
                .from('generations')
                .upload(filePath, videoBlob, { contentType: 'video/mp4', upsert: true })

            if (uploadError) throw uploadError

            // 5. Update Database
            const { data: updatedGen, error: updateError } = await supabase
                .from('generations')
                .update({
                    status: 'completed',
                    output_path: filePath
                })
                .eq('id', generation_id)
                .select()
                .single()

            if (updateError) throw updateError

            return new Response(JSON.stringify(updatedGen), { headers: corsHeaders })
        }

        // Still pending
        return new Response(JSON.stringify({ status: 'pending', id: generation_id }), { headers: corsHeaders })

    } catch (error) {
        console.error(error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
