
import { GoogleGenAI } from "@google/genai";
import type { AspectRatio } from "../types";

const POLLING_INTERVAL_MS = 10000; // Increased to 10s to ensure operation completion and avoid rate limits

const getAiClient = () => {
  // Use the environment variable if present, otherwise default to empty string.
  // We do NOT throw an error here to allow the AI Studio environment to inject the key
  // or handle the request interception gracefully.
  const apiKey = process.env.API_KEY ? process.env.API_KEY.replace(/["']/g, "").trim() : "";
  return new GoogleGenAI({ apiKey });
};

export const generateVideoFromImage = async (
  prompt: string,
  imageBase64: string,
  mimeType: string,
  aspectRatio: AspectRatio
): Promise<string> => {
  const ai = getAiClient();

  // Veo strictly requires 16:9 or 9:16. Ensure we pass valid values.
  let validAspectRatio = aspectRatio;
  if (aspectRatio !== '16:9' && aspectRatio !== '9:16') {
     // Default fallback if invalid aspect ratio is somehow passed
     validAspectRatio = '16:9'; 
  }

  console.log("Starting video generation...");
  let operation = await ai.models.generateVideos({
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

  console.log("Video generation operation started. Polling for completion...");

  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL_MS));
    operation = await ai.operations.getVideosOperation({ operation: operation });
    console.log("Polling...", operation.metadata);
  }

  // Check for API errors explicitly
  if (operation.error) {
    const errorMsg = operation.error.message || JSON.stringify(operation.error);
    throw new Error(`Video generation failed: ${errorMsg}`);
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;

  if (!downloadLink) {
    // Log the operation object to console for debugging
    console.error("Video Generation Operation completed without video data:", JSON.stringify(operation, null, 2));
    throw new Error("Video generation failed. The model completed the operation but returned no video. This may be due to safety filters blocking the content.");
  }
  
  // Clean API Key logic for download URL
  const rawKey = process.env.API_KEY || "";
  const cleanKey = rawKey.replace(/["']/g, "").trim();
  
  // Note: For download, we attempt to use the key if available, but some proxies might handle it automatically.
  // We won't block purely on missing key here to allow fallback behaviors.

  try {
    const url = new URL(downloadLink);
    if (cleanKey) {
        // Append key to URL parameters as per documentation
        url.searchParams.set("key", cleanKey);
    }
    
    // Additionally pass as header to ensure acceptance if URL param parsing is strict/failing
    const headers: Record<string, string> = {};
    if (cleanKey) {
        headers['x-goog-api-key'] = cleanKey;
    }

    const response = await fetch(url.toString(), { headers });
    
    if (!response.ok) {
      const errorBody = await response.text();
      // Try to parse JSON error for cleaner message
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
  referenceImages: string[] = [] // New parameter for additional reference images
): Promise<string> => {
  const ai = getAiClient();

  // Construct parts: Main Image, Reference Images, Text Prompt
  const parts: any[] = [
    {
      inlineData: {
        data: imageBase64,
        mimeType: mimeType,
      },
    }
  ];

  // Add reference images
  referenceImages.forEach((refBase64) => {
    parts.push({
      inlineData: {
        data: refBase64,
        mimeType: "image/png", // Assuming PNG for simplicity/conversion
      },
    });
  });

  // Add text prompt last
  parts.push({
    text: prompt,
  });

  const response = await ai.models.generateContent({
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

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      const base64EncodeString = part.inlineData.data;
      return `data:image/png;base64,${base64EncodeString}`;
    }
  }

  throw new Error("Image generation failed. No image data received.");
};
