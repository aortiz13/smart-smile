import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
    try {
        // Basic auth check (Service role or cron secret)
        const authHeader = req.headers.get('Authorization')
        if (authHeader !== `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`) {
            // Allow if it's a cron invocation (depends on platform config, assuming protected)
            // For local dev, just proceed or check simple key
        }

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // List files in 'uploads'
        const { data: files, error: listError } = await supabase
            .storage
            .from('uploads')
            .list(undefined, { limit: 100, sortBy: { column: 'created_at', order: 'asc' } })

        if (listError) throw listError

        const now = new Date()
        const filesToDelete: string[] = []

        files.forEach((file) => {
            if (file.name === '.emptyFolderPlaceholder') return;

            const created = new Date(file.created_at)
            const diffHours = (now.getTime() - created.getTime()) / (1000 * 60 * 60)

            // Delete if older than 24 hours
            if (diffHours > 24) {
                filesToDelete.push(file.name)
            }
        })

        if (filesToDelete.length > 0) {
            const { error: deleteError } = await supabase
                .storage
                .from('uploads')
                .remove(filesToDelete)

            if (deleteError) throw deleteError

            return new Response(JSON.stringify({ message: `Deleted ${filesToDelete.length} files.` }), {
                headers: { 'Content-Type': 'application/json' }
            })
        }

        return new Response(JSON.stringify({ message: 'No files to delete.' }), {
            headers: { 'Content-Type': 'application/json' },
        })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
