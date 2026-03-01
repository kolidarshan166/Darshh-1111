import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function generateWeeklySummary(violations: any) {
  if (!process.env.GEMINI_API_KEY) return "AI Summary unavailable (API Key missing).";

  const prompt = `
    As a trading discipline coach, analyze these rule violations from the past week:
    - Broke Stop Loss: ${violations.broke_sl} times
    - Overtraded: ${violations.overtraded} times
    - Revenge Trade: ${violations.revenge_trade} times
    - No Valid Setup: ${violations.no_valid_setup} times
    - Emotional Entry: ${violations.emotional_entry} times

    Provide a concise 3-line summary:
    1. Top mistake.
    2. Biggest behavioral leak.
    3. One clear improvement suggestion.
    
    Keep it professional, encouraging, and focused ONLY on discipline. Do NOT predict profits.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Error generating AI summary.";
  }
}
