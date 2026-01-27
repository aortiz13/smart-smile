import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function testStorage() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
        console.error("Missing Supabase env vars");
        return;
    }

    const supabase = createClient(url, key);
    const { data: buckets, error } = await supabase.storage.listBuckets();

    if (error) {
        console.error("Supabase Storage Error:", error);
    } else {
        console.log("Buckets found:", buckets.map(b => b.name));
    }
}

testStorage();
