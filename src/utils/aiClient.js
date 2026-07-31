import { GoogleGenAI } from "@google/genai";

let ai;
function getAiClient() {
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return ai;
}

export default getAiClient;