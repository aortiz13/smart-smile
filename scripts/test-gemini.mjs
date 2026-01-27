import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function test() {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        console.error("API_KEY not found in .env.local");
        return;
    }

    try {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: [{ parts: [{ text: 'Hola, responde con "OK" si recibes esto.' }] }]
        });
        console.log("Response:", response.text);
    } catch (error) {
        console.error("Gemini API Error:", error);
    }
}

test();
