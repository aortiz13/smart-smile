// Node.js compatible test script
// Run with: node test-veo.js

const apiKey = "AIzaSyCmcVkqgqvOaROBIrxZj6XQMaasa0hbmfU"; // Hardcoded for test
const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-fast-generate-preview:predictLongRunning?key=${apiKey}`;

const prompt = "A cinematic shot of a futuristic city at sunset.";
const dummyImageBase64 = "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD//2Q==";

console.log("Testing Veo API with Node.js...");

async function runTest() {
    const body = {
        instances: [
            {
                prompt: prompt,
                image: {
                    bytesBase64Encoded: dummyImageBase64,
                    mimeType: "image/jpeg"
                }
            }
        ],
        parameters: {
            sampleCount: 1,
            aspectRatio: "16:9",
            resolution: "720p"
            // includeAudio: false // explicit error before, so keep commented
        }
    };

    console.log("Sending body:", JSON.stringify(body, null, 2));

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const text = await response.text();
            console.error("API Error Status:", response.status);
            console.error("API Error Body:", text);
        } else {
            const data = await response.json();
            console.log("Success!");
            console.log(JSON.stringify(data, null, 2));
        }
    } catch (err) {
        console.error("Fetch Error:", err);
    }
}

runTest();
