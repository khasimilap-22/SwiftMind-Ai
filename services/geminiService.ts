import { GoogleGenAI, Chat, GenerateContentResponse, Content, Modality } from "@google/genai";
import { SYSTEM_INSTRUCTION } from '../constants';
import { Message, Role } from '../types';

let client: GoogleGenAI | null = null;
let chatSession: Chat | null = null;
let currentModel: string = 'gemini-2.5-flash';

const getClient = (): GoogleGenAI => {
  if (!client) {
    if (!process.env.API_KEY) {
      console.error("API_KEY is missing from environment variables.");
    }
    client = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return client;
};

export const initializeChat = (history?: Message[], modelName: string = 'gemini-2.5-flash') => {
  const ai = getClient();
  currentModel = modelName;
  
  // Convert internal Message type to Gemini Content type
  let historyContent: Content[] | undefined = undefined;
  if (history && history.length > 0) {
    // Filter out messages that are completely empty (no text, no attachments) to avoid 400 errors
    historyContent = history
      .filter(msg => (msg.content && msg.content.trim() !== '') || (msg.attachments && msg.attachments.length > 0) || msg.mediaUrl)
      .map(msg => {
        // Fallback for empty text content in history (Gemini requires non-empty text parts usually)
        const textContent = msg.content || (msg.attachments?.length ? "Sent attachments" : (msg.mediaUrl ? "Generated media" : "..."));
        
        const parts: any[] = [{ text: textContent }];

        if (msg.attachments) {
            msg.attachments.forEach(att => {
                parts.push({
                    inlineData: {
                        mimeType: att.type,
                        data: att.data.split(',')[1] || att.data
                    }
                });
            });
        }

        return {
          role: msg.role === Role.USER ? 'user' : 'model',
          parts: parts
        };
      });
  }

  chatSession = ai.chats.create({
    model: modelName,
    history: historyContent,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.7,
      topP: 0.95,
      topK: 64,
    }
  });
};

export const sendMessageStream = async (
  message: string, 
  context?: string,
  onChunk?: (text: string) => void,
  attachments?: { data: string, mimeType: string }[]
): Promise<string> => {
  if (!chatSession) {
    initializeChat(undefined, currentModel);
  }

  if (!chatSession) {
    throw new Error("Failed to initialize chat session");
  }

  // Construct message parts
  let messageParts: any[] = [];
  
  // Add system note if context exists
  if (context) {
    messageParts.push({ text: `[SYSTEM NOTE: ${context}]\n\nUser Request: ${message}` });
  } else {
    // Only push text part if it's not empty, OR if there are no attachments.
    if (message.trim() !== '') {
        messageParts.push({ text: message });
    }
  }

  // Add attachments if provided
  if (attachments && attachments.length > 0) {
    attachments.forEach(att => {
        const base64Data = att.data.split(',')[1] || att.data;
        messageParts.push({
          inlineData: {
            mimeType: att.mimeType,
            data: base64Data
          }
        });
    });
  }

  // Fallback: If absolutely no parts, send a space
  if (messageParts.length === 0) {
      messageParts.push({ text: " " });
  }

  try {
    // Correct API Usage: 'message' expects string | Part[]
    const resultStream = await chatSession.sendMessageStream({ 
      message: messageParts.length === 1 && typeof messageParts[0].text === 'string' 
        ? messageParts[0].text 
        : messageParts 
    });
    
    let fullResponse = "";
    
    for await (const chunk of resultStream) {
      const c = chunk as GenerateContentResponse;
      if (c.text) {
        fullResponse += c.text;
        if (onChunk) {
          onChunk(c.text);
        }
      }
    }
    
    return fullResponse;
  } catch (error) {
    console.error("Error in sendMessageStream:", error);
    throw error;
  }
};

export const resetSession = () => {
  chatSession = null;
};

export const generateChatTitle = async (message: string): Promise<string> => {
  const ai = getClient();
  try {
    const prompt = message.trim() || "New Session";
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Generate a very short, memorable 3-5 word title for a chat that starts with this user message: "${prompt}". Do not use quotes. Just the title.`,
    });
    return response.text?.trim() || "New Session";
  } catch (error) {
    console.warn("Failed to generate chat title:", error);
    return message.slice(0, 30) || "New Session";
  }
};

// --- Helper for API Key Recovery ---

const handleAuthError = async (error: any, retryAction: () => Promise<any>) => {
  const isAuthError = error.message?.includes("Requested entity was not found") || 
                      error.toString().includes("Requested entity was not found") ||
                      error.status === 404 || error.status === 403;

  if (isAuthError && (window as any).aistudio?.openSelectKey) {
    console.warn("Authentication/Entity error detected. Prompting for key selection...");
    try {
      await (window as any).aistudio.openSelectKey();
      return await retryAction();
    } catch (retryError) {
      console.error("Retry failed after key selection:", retryError);
      throw retryError;
    }
  }
  throw error;
};

// --- Image Generation ---

export interface ImageGenerationResult {
  imageUrl: string;
  mimeType: string;
}

export const generateImage = async (
  prompt: string,
  size: '1K' | '2K' | '4K' = '1K'
): Promise<ImageGenerationResult> => {
  
  const attemptGeneration = async (): Promise<ImageGenerationResult> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts: [{ text: prompt }] },
      config: {
        imageConfig: {
          imageSize: size
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        const base64EncodeString: string = part.inlineData.data;
        return {
          imageUrl: `data:${part.inlineData.mimeType};base64,${base64EncodeString}`,
          mimeType: part.inlineData.mimeType
        };
      }
    }
    throw new Error("No image generated");
  };

  try {
    return await attemptGeneration();
  } catch (error) {
    return handleAuthError(error, attemptGeneration);
  }
};

export const editImage = async (
    prompt: string,
    imageBase64: string
): Promise<ImageGenerationResult> => {

    const attemptEdit = async (): Promise<ImageGenerationResult> => {
         const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
         const base64Data = imageBase64.split(',')[1] || imageBase64;

         const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image', 
            contents: {
              parts: [
                {
                  inlineData: {
                    data: base64Data,
                    mimeType: 'image/png', 
                  },
                },
                {
                  text: prompt,
                },
              ],
            },
          });

          for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
              const base64EncodeString: string = part.inlineData.data;
              return {
                imageUrl: `data:${part.inlineData.mimeType};base64,${base64EncodeString}`,
                mimeType: part.inlineData.mimeType
              };
            }
          }
          throw new Error("No edited image generated");
    }

    try {
        return await attemptEdit();
    } catch (error) {
        return handleAuthError(error, attemptEdit);
    }
}


// --- Video Generation ---

export interface VideoGenerationResult {
  videoUrl: string;
}

export const generateVideo = async (
  prompt: string,
  aspectRatio: '16:9' | '9:16',
  inputImageBase64?: string
): Promise<VideoGenerationResult> => {

  const attemptGeneration = async (): Promise<VideoGenerationResult> => {
    const currentKey = process.env.API_KEY || '';
    const ai = new GoogleGenAI({ apiKey: currentKey });
    
    const requestOptions: any = {
      model: 'veo-3.1-fast-generate-preview',
      prompt: prompt,
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: aspectRatio
      }
    };

    if (inputImageBase64) {
      const base64Data = inputImageBase64.split(',')[1] || inputImageBase64;
      requestOptions.image = {
        imageBytes: base64Data,
        mimeType: 'image/png'
      };
    }

    let operation = await ai.models.generateVideos(requestOptions);

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    
    if (!videoUri) {
      throw new Error("Video generation failed: No URI returned.");
    }

    const authenticatedUri = `${videoUri}&key=${currentKey}`;
    const response = await fetch(authenticatedUri);
    if (!response.ok) {
        throw new Error(`Failed to download generated video. Status: ${response.status}`);
    }
    const blob = await response.blob();
    const videoUrl = URL.createObjectURL(blob);
    
    return { videoUrl };
  };

  try {
    return await attemptGeneration();
  } catch (error) {
    return handleAuthError(error, attemptGeneration);
  }
};

// --- Text to Speech ---

export interface SpeechGenerationResult {
  audioUrl: string;
}

export const generateSpeech = async (
  text: string
): Promise<SpeechGenerationResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error("No audio generated");
    }

    const binaryString = atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const wavBytes = addWavHeader(bytes, 24000, 1);
    const wavBlob = new Blob([wavBytes], { type: 'audio/wav' });
    const audioUrl = URL.createObjectURL(wavBlob);

    return { audioUrl };

  } catch (error) {
    console.error("Error generating speech:", error);
    throw error;
  }
};

function addWavHeader(samples: Uint8Array, sampleRate: number, numChannels: number) {
  const buffer = new ArrayBuffer(44 + samples.length);
  const view = new DataView(buffer);

  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length, true);

  const dataView = new Uint8Array(buffer, 44);
  dataView.set(samples);

  return buffer;
}