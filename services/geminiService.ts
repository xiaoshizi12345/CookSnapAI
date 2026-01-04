
import { GoogleGenAI, Type } from "@google/genai";
import { Recipe, Ingredient } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Generiert ein Rezept basierend auf Vorratsartikeln.
 * Optimiert für Logiktreue: Verwendet strikt nur vorhandene Zutaten.
 */
export const generateRecipeFromPantry = async (pantryItems: string[]): Promise<Recipe | null> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Erstelle ein kreatives, nachhaltiges Rezept AUSSCHLIEẞLICH basierend auf diesen vorhandenen Zutaten: ${pantryItems.join(', ')}. 
      WICHTIG: Füge KEINE weiteren Zutaten hinzu, die nicht in der Liste stehen (wie Knoblauch, Zwiebeln, Öl oder Butter), es sei denn, sie sind explizit gelistet. 
      Einzige erlaubte Ausnahmen bei Bedarf: Wasser, Salz, Pfeffer. 
      Antworte im JSON-Format.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            ingredients: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  amount: { type: Type.STRING },
                  unit: { type: Type.STRING }
                },
                required: ['name', 'amount', 'unit']
              }
            },
            steps: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            time: { type: Type.STRING },
            difficulty: { type: Type.STRING, enum: ['Leicht', 'Mittel', 'Schwer'] },
            cuisine: { type: Type.STRING },
            dietaryType: { type: Type.STRING, enum: ['Vegan', 'Vegetarisch', 'Fleisch'] },
          },
          required: ['name', 'ingredients', 'steps', 'time', 'difficulty', 'cuisine', 'dietaryType']
        }
      }
    });

    const text = response.text;
    if (!text) return null;
    const data = JSON.parse(text);
    return {
      ...data,
      id: Math.random().toString(36).substr(2, 9),
      rating: 5.0,
      reviewCount: 0,
      image: `https://picsum.photos/seed/${encodeURIComponent(data.name || 'recipe')}/800/600`,
      isAiGenerated: true
    };
  } catch (error) {
    console.error("Gemini Error:", error);
    return null;
  }
};

/**
 * Importiert ein Rezept von einer URL (z.B. Chefkoch.de) unter Verwendung von Search Grounding.
 */
export const importRecipeFromUrl = async (url: string): Promise<Recipe | null> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Extrahiere das Rezept von dieser URL: ${url}. Falls es sich um Chefkoch.de handelt, achte besonders auf die exakten Mengen, Einheiten und suche nach der URL des Hauptbildes im HTML. Antworte ausschließlich im JSON-Format.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            imageUrl: { type: Type.STRING, description: "Die direkte URL zum Hauptbild des Rezepts, falls auffindbar." },
            ingredients: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  amount: { type: Type.STRING },
                  unit: { type: Type.STRING }
                },
                required: ['name', 'amount', 'unit']
              }
            },
            steps: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            time: { type: Type.STRING },
            difficulty: { type: Type.STRING, enum: ['Leicht', 'Mittel', 'Schwer'] },
            cuisine: { type: Type.STRING },
            dietaryType: { type: Type.STRING, enum: ['Vegan', 'Vegetarisch', 'Fleisch'] },
          },
          required: ['name', 'ingredients', 'steps', 'time', 'difficulty', 'cuisine', 'dietaryType']
        }
      }
    });

    const text = response.text;
    if (!text) return null;
    const data = JSON.parse(text);
    
    return {
      ...data,
      id: Math.random().toString(36).substr(2, 9),
      rating: 4.5,
      reviewCount: 1,
      image: data.imageUrl || `https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=800`,
      isImported: true,
      sourceUrl: url
    };
  } catch (error) {
    console.error("Import Error:", error);
    return null;
  }
};

/**
 * Fotoanalyse für Lebensmittel.
 */
export const scanImageForIngredients = async (base64Image: string): Promise<string[]> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { data: base64Image, mimeType: 'image/jpeg' } },
          { text: "Analysiere dieses Bild akribisch. Identifiziere JEDES Lebensmittel. Gib NUR eine kommagetrennte Liste der Namen zurück. Sei präzise. Wenn nichts erkennbar ist, gib einen leeren String zurück." }
        ]
      }
    });
    
    const text = response.text || "";
    if (!text.trim()) return [];
    return text.split(',')
      .map(s => s.trim())
      .filter(s => s.length > 1)
      .filter(s => !s.toLowerCase().includes("keine"));
  } catch (error) {
    console.error("Vision Error:", error);
    return [];
  }
};

/**
 * Koch-Tipps.
 */
export const getChefAdvice = async (recipe: Recipe, question: string): Promise<string> => {
  try {
    const chat = ai.chats.create({
      model: 'gemini-3-pro-preview',
      config: {
        systemInstruction: `Du bist ein professioneller Koch-Assistent. Motto: "Nichts verschwenden, alles verwenden".`,
      }
    });
    
    const response = await chat.sendMessage({ message: question });
    return response.text || "Entschuldigung, ich konnte darauf keine Antwort finden.";
  } catch (error) {
    console.error("Chat Error:", error);
    return "Ups, da ist etwas schief gelaufen.";
  }
};
