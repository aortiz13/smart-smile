
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env.production' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Missing Supabase environment variables.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBuckets() {
    console.log("Checking Supabase Storage Buckets...");
    const { data, error } = await supabase.storage.listBuckets();

    if (error) {
        console.error("❌ Error listing buckets:", error.message);
        return;
    }

    if (data && data.length > 0) {
        console.log("✅ Available Buckets:");
        data.forEach(b => console.log(`- ${b.name} (ID: ${b.id}, Public: ${b.public})`));
    } else {
        console.log("⚠️ No buckets found in this project.");
    }
}

checkBuckets();
