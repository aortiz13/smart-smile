
import { GoogleGenAI } from "@google/genai";
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load env vars
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env.production' });
dotenv.config();

const apiKey = process.env.API_KEY;

if (!apiKey) {
    console.error("❌ API_KEY not found in environment variables.");
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

async function testModel(modelName: string, method: 'generateContent' | 'generateImages' | 'editImage') {
    console.log(`\n🧪 Testing Model: ${modelName} | Method: ${method}`);
    try {
        let response;
        if (method === 'generateContent') {
            response = await ai.models.generateContent({
                model: modelName,
                contents: {
                    parts: [{ text: "Generate a photorealistic image of a futuristic dental clinic with blue lighting." }]
                }
            });

            const parts = response.candidates?.[0]?.content?.parts || [];
            if (parts.length > 0 && parts[0].inlineData) {
                console.log("🎉 Found Image Data (Inline)!");
                const data = parts[0].inlineData.data;
                const buffer = Buffer.from(data, 'base64');
                fs.writeFileSync(`test_${modelName}_${method}.png`, buffer);
                console.log(`✅ Image saved to test_${modelName}_${method}.png`);
            } else if (response.text) {
                console.log(`ℹ️ No image data found. Text response: ${response.text.slice(0, 50)}...`);
            } else {
                console.log("⚠️ Response empty or unknown format.");
            }

        } else if (method === 'generateImages') {
            try {
                response = await ai.models.generateImages({
                    model: modelName,
                    prompt: "Futuristic dental clinic, high quality, 4k",
                    config: {
                        numberOfImages: 1,
                        aspectRatio: "1:1"
                    }
                });

                if (response.generatedImages && response.generatedImages.length > 0) {
                    console.log("🎉 Found Image Data (GeneratedImages)!");
                    const img = response.generatedImages[0];
                    const b64 = img.imageBytes;
                    if (b64) {
                        const buffer = Buffer.from(b64, 'base64');
                        fs.writeFileSync(`test_${modelName}_${method}.png`, buffer);
                        console.log(`✅ Image saved to test_${modelName}_${method}.png`);
                    }
                } else {
                    console.log("⚠️ No generated images found in response.");
                }
            } catch (imgErr: any) {
                console.error(`❌ generateImages FAILED: ${imgErr.message}`);
            }
        }
    } catch (error: any) {
        console.error(`❌ FAILED: ${JSON.stringify(error.message || error)}`);
        if (error.status) console.error(`   Status: ${error.status}`);
    }
}

async function runTests() {
    console.log("🚀 Starting Image Gen Tests...");

    // Test 1: Gemini 3 Pro (Content Gen) - Confirmed working locally
    await testModel('gemini-3-pro-image-preview', 'generateContent');

    // Test 2: Imagen 3 (Image Gen)
    await testModel('imagen-3.0-generate-001', 'generateImages');

    // Test 3: Imagen 3 Fast (Image Gen)
    await testModel('imagen-3.0-fast-generate-001', 'generateImages');

    // Test 4: Gemini 2.0 Flash (Fallback?)
    await testModel('gemini-2.0-flash-exp', 'generateContent');
}

runTests();
