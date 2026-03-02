import { GoogleGenAI } from '@google/genai';

export const enhancePrompt = async (originalPrompt: string): Promise<string> => {
  // Create a new instance to ensure it uses the latest API key from the dialog
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || process.env.GEMINI_API_KEY });
  
  const response = await ai.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: `Enhance the following image generation prompt to be highly detailed, descriptive, and optimized for a state-of-the-art image generator. Focus on lighting, composition, style, and mood. Return ONLY the enhanced prompt text, nothing else.\n\nOriginal prompt: ${originalPrompt}`,
  });
  
  return response.text || originalPrompt;
};

export const generateImage = async (
  prompt: string, 
  referenceImages: { data: string; mimeType: string }[]
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || process.env.GEMINI_API_KEY });
  
  const parts: any[] = referenceImages.map(img => ({
    inlineData: {
      data: img.data,
      mimeType: img.mimeType,
    }
  }));
  
  parts.push({ text: prompt });
  
  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-image-preview',
    contents: { parts },
    config: {
      imageConfig: {
        aspectRatio: "1:1",
        imageSize: "1K"
      }
    },
  });
  
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      const base64EncodeString = part.inlineData.data;
      return `data:image/png;base64,${base64EncodeString}`;
    }
  }
  
  throw new Error('No image returned from the model');
};
