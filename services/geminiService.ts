
import { GoogleGenAI } from "@google/genai";
import type { AspectRatio } from "../types";

const POLLING_INTERVAL_MS = 10000; // 10s polling interval

const getAiClient = () => {
  const apiKey = process.env.API_KEY ? process.env.API_KEY.replace(/["']/g, "").trim() : "";
  return new GoogleGenAI({ apiKey });
};

// Helper function to wait
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function for Exponential Backoff Retry
async function retryWithBackoff<T>(
  operation: () => Promise<T>, 
  retries: number = 5, 
  delay: number = 2000,
  operationName: string = "Operation"
): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    // Check if error is 503 (Service Unavailable / Overloaded) or 429 (Too Many Requests)
    const isOverloaded = 
      error.status === 503 || 
      error.code === 503 || 
      (error.message && (error.message.includes('503') || error.message.includes('overloaded') || error.message.includes('UNAVAILABLE')));

    if (retries > 0 && isOverloaded) {
      console.warn(`${operationName} failed (Model Overloaded). Retrying in ${delay/1000}s... (${retries} attempts left)`);
      await wait(delay);
      // Retry with double the delay (Exponential Backoff)
      return retryWithBackoff(operation, retries - 1, delay * 2, operationName);
    }
    
    // If not a 503 or no retries left, throw the error
    throw error;
  }
}

export const generateVideoFromImage = async (
  prompt: string,
  imageBase64: string,
  mimeType: string,
  aspectRatio: AspectRatio
): Promise<string> => {
  const ai = getAiClient();

  let validAspectRatio = aspectRatio;
  if (aspectRatio !== '16:9' && aspectRatio !== '9:16') {
     validAspectRatio = '16:9'; 
  }

  console.log("Starting video generation...");

  // Wrap the initial generation request in retry logic
  let operation = await retryWithBackoff(
    async () => {
      return await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt,
        image: {
          imageBytes: imageBase64,
          mimeType: mimeType,
        },
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: validAspectRatio,
        }
      });
    },
    5, // 5 Retries
    3000, // Start with 3s delay
    "Video Generation Request"
  );

  console.log("Video generation operation started. Polling for completion...");

  while (!operation.done) {
    await wait(POLLING_INTERVAL_MS);
    
    // Wrap the polling request in retry logic as well
    operation = await retryWithBackoff(
      async () => {
        return await ai.operations.getVideosOperation({ operation: operation });
      },
      5, 
      3000,
      "Polling Status"
    );
    
    console.log("Polling...", operation.metadata);
  }

  if (operation.error) {
    const errorMsg = operation.error.message || JSON.stringify(operation.error);
    throw new Error(`Video generation failed: ${errorMsg}`);
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;

  if (!downloadLink) {
    console.error("Video Generation Operation completed without video data:", JSON.stringify(operation, null, 2));
    throw new Error("Video generation failed. The model completed the operation but returned no video.");
  }
  
  const rawKey = process.env.API_KEY || "";
  const cleanKey = rawKey.replace(/["']/g, "").trim();
  
  try {
    const url = new URL(downloadLink);
    if (cleanKey) {
        url.searchParams.set("key", cleanKey);
    }
    
    const headers: Record<string, string> = {};
    if (cleanKey) {
        headers['x-goog-api-key'] = cleanKey;
    }

    // Wrap download in retry logic too, just in case
    const response = await retryWithBackoff(
        async () => await fetch(url.toString(), { headers }),
        3,
        1000,
        "Video Download"
    );
    
    if (!response.ok) {
      const errorBody = await response.text();
      try {
          const errJson = JSON.parse(errorBody);
          if (errJson.error && errJson.error.message) {
              throw new Error(`Download Error: ${errJson.error.message}`);
          }
      } catch (e) {
          // If not JSON, use full body
      }
      throw new Error(`Failed to download video: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    const videoBlob = await response.blob();
    return URL.createObjectURL(videoBlob);
  } catch (error: any) {
      console.error("Download failed:", error);
      throw error;
  }
};

export const renderArchitecturalImage = async (
  prompt: string,
  imageBase64: string,
  mimeType: string,
  aspectRatio: AspectRatio,
  referenceImages: string[] = []
): Promise<string> => {
  const ai = getAiClient();

  const parts: any[] = [
    {
      inlineData: {
        data: imageBase64,
        mimeType: mimeType,
      },
    }
  ];

  referenceImages.forEach((refBase64) => {
    parts.push({
      inlineData: {
        data: refBase64,
        mimeType: "image/png", 
      },
    });
  });

  parts.push({
    text: prompt,
  });

  // Wrap image generation in retry logic
  const response = await retryWithBackoff(
    async () => {
      return await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: {
          parts: parts,
        },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio,
            imageSize: '2K',
          },
        },
      });
    },
    3, // 3 retries for images (usually faster)
    2000,
    "Image Generation Request"
  );

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      const base64EncodeString = part.inlineData.data;
      return `data:image/png;base64,${base64EncodeString}`;
    }
  }

  throw new Error("Image generation failed. No image data received.");
};
