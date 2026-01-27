
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";

console.log("Checking @google/genai exports...");

console.log("HarmCategory:", HarmCategory);
console.log("HarmBlockThreshold:", HarmBlockThreshold);

if (!HarmCategory) {
    console.error("❌ HarmCategory is undefined!");
} else {
    console.log("✅ HarmCategory is defined.");
}

if (!HarmBlockThreshold) {
    console.error("❌ HarmBlockThreshold is undefined!");
} else {
    console.log("✅ HarmBlockThreshold is defined.");
}
