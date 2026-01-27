import { checkServerHealth } from './app/actions/health.js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function runHealth() {
    try {
        const result = await checkServerHealth();
        console.log("Health Check Result:", JSON.stringify(result, null, 2));
    } catch (e) {
        console.error("Health Check Action Failed:", e);
    }
}

runHealth();
