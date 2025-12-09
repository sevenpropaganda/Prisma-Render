import React, { useState, useEffect, useCallback } from 'react';
import { generateVideoFromImage, renderArchitecturalImage } from './services/geminiService';
import { fileToBase64, base64ToFile } from './utils/fileUtils';
import { getTranslation } from './utils/translations';
import type { 
  AspectRatio, 
  GenerationMode, 
  Mood,
  SceneElement,
  ElementType,
  SavedCharacter,
  Language,
  RenderResult,
  Pose,
  LightingPosition
} from './types';

import Header from './components/Header';
import ImageUploader from './components/ImageUploader';
import SceneEditor from './components/SceneEditor';
import Controls from './components/Controls';
import LoadingDisplay from './components/LoadingDisplay';
import VideoPlayer from './components/VideoPlayer';
import ErrorDisplay from './components/ErrorDisplay';

const App: React.FC = () => {
  const [language, setLanguage] = useState<Language>('pt-BR');
  const t = useCallback((key: string) => getTranslation(language, key), [language]);

  // API Key State
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const [isCheckingKey, setIsCheckingKey] = useState<boolean>(true);
  
  // Changed default mode to 'image'
  const [mode, setMode] = useState<GenerationMode>('image');
  
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{width: number, height: number} | null>(null);
  
  // Base prompt
  const [prompt, setPrompt] = useState<string>('');

  // Enhanced Controls State
  const [mood, setMood] = useState<Mood>('Original'); 
  const [profLighting, setProfLighting] = useState<boolean>(false);
  const [profLandscaping, setProfLandscaping] = useState<boolean>(false);
  const [enhanceRealism, setEnhanceRealism] = useState<boolean>(false);
  
  // Preservation States
  const [preserveLighting, setPreserveLighting] = useState<boolean>(false);
  const [preserveView, setPreserveView] = useState<boolean>(false);
  const [preserveBranding, setPreserveBranding] = useState<boolean>(false);
  const [customPreservation, setCustomPreservation] = useState<string>('');

  const [videoDuration, setVideoDuration] = useState<string>('5'); // Default 5s
  const [customDuration, setCustomDuration] = useState<string>('');
  
  // Dynamic Elements State
  const [sceneElements, setSceneElements] = useState<SceneElement[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  
  // History State for Undo/Redo
  const [history, setHistory] = useState<SceneElement[][]>([]);
  const [future, setFuture] = useState<SceneElement[][]>([]);

  // Drawing Mode State for linear elements
  const [activeDrawingTool, setActiveDrawingTool] = useState<{type: ElementType, subtype: string} | null>(null);
  
  // Library State
  const [savedCharacters, setSavedCharacters] = useState<SavedCharacter[]>([]);

  // Default Aspect Ratio is Original
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('Original');
  
  // Results & History
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [renderHistory, setRenderHistory] = useState<RenderResult[]>([]);
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Check for API Key on mount
  useEffect(() => {
    const checkKey = async () => {
      try {
        const win = window as any;
        if (win.aistudio && win.aistudio.hasSelectedApiKey) {
          const hasKey = await win.aistudio.hasSelectedApiKey();
          setHasApiKey(hasKey);
        } else {
          // Fallback for environments without the wrapper (assume dev/env var set)
          setHasApiKey(true);
        }
      } catch (e) {
        console.error("Error checking API key:", e);
        setHasApiKey(true); // Default to true to not block if check fails
      } finally {
        setIsCheckingKey(false);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    const win = window as any;
    if (win.aistudio?.openSelectKey) {
      try {
        await win.aistudio.openSelectKey();
      } catch (e) {
        console.error("Error opening key selector:", e);
      }
    }
    // Optimistically assume success to proceed immediately as per instructions
    setHasApiKey(true);
  };

  // Load Saved Characters
  useEffect(() => {
    const stored = localStorage.getItem('prismaRender_characters');
    if (stored) {
      try {
        setSavedCharacters(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse saved characters", e);
      }
    }
  }, []);

  const handleSaveCharacter = (name: string, type: ElementType, description: string) => {
    const newChar: SavedCharacter = {
      id: Date.now().toString(),
      name,
      type,
      description
    };
    const updated = [...savedCharacters, newChar];
    setSavedCharacters(updated);
    localStorage.setItem('prismaRender_characters', JSON.stringify(updated));
  };

  const handleDeleteSavedCharacter = (id: string) => {
    const updated = savedCharacters.filter(c => c.id !== id);
    setSavedCharacters(updated);
    localStorage.setItem('prismaRender_characters', JSON.stringify(updated));
  };

  // --- History Management ---
  const saveHistory = useCallback(() => {
    setHistory(prev => [...prev, sceneElements]);
    setFuture([]);
  }, [sceneElements]);

  const undo = useCallback(() => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    const newHistory = history.slice(0, -1);
    
    setFuture(prev => [sceneElements, ...prev]);
    setSceneElements(previous);
    setHistory(newHistory);
  }, [history, sceneElements]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    const newFuture = future.slice(1);

    setHistory(prev => [...prev, sceneElements]);
    setSceneElements(next);
    setFuture(newFuture);
  }, [future, sceneElements]);

  const handleImageUpload = (file: File, keepElements: boolean = false) => {
    setUploadedImage(file);
    setGeneratedVideoUrl(null);
    setGeneratedImageUrl(null);
    setError(null);
    setRenderHistory([]); // Clear history on new base image
    
    if (!keepElements) {
      setSceneElements([]);
      setSelectedElementId(null);
      setHistory([]); // Clear undo stack
      setFuture([]); // Clear redo stack
    }
    
    setActiveDrawingTool(null);
    
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setImagePreview(result);
      
      const img = new Image();
      img.onload = () => {
        setImageDimensions({ width: img.width, height: img.height });
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  };

  const handleAddElement = (type: ElementType, subtype: string) => {
    // Check if it's a linear element (LED Strip or LED Profile)
    const isLinear = subtype === 'LED Strip' || subtype === 'LED Profile';

    if (isLinear) {
      // Instead of adding immediately, activate drawing mode.
      // History will be saved when drawing completes.
      setActiveDrawingTool({ type, subtype });
    } else {
      // Add standard point element immediately
      saveHistory(); // Save state before adding
      const newElement: SceneElement = {
        id: Date.now().toString() + Math.random().toString(),
        type,
        subtype,
        x: 50, 
        y: 50,
        // Default 3000K for lighting elements
        colorTemperature: type === 'lighting' ? 3000 : undefined,
        // Default Auto pose for people
        pose: type === 'person' ? 'auto' : undefined,
        lightingPosition: 'front' // Default
      };
      setSceneElements(prev => [...prev, newElement]);
      setSelectedElementId(newElement.id);
    }
  };

  const handleDrawComplete = (start: {x: number, y: number}, end: {x: number, y: number}, points?: {x: number, y: number}[]) => {
    if (!activeDrawingTool) return;
    
    saveHistory(); // Save state before adding drawn line

    const newElement: SceneElement = {
      id: Date.now().toString() + Math.random().toString(),
      type: activeDrawingTool.type,
      subtype: activeDrawingTool.subtype,
      x: start.x,
      y: start.y,
      endX: end.x,
      endY: end.y,
      points: points, // Add freehand points if present
      // Default 3000K for lighting elements
      colorTemperature: activeDrawingTool.type === 'lighting' ? 3000 : undefined,
      pose: activeDrawingTool.type === 'person' ? 'auto' : undefined,
      lightingPosition: 'front' // Default
    };

    setSceneElements(prev => [...prev, newElement]);
    setSelectedElementId(newElement.id);
    setActiveDrawingTool(null);
  };

  const handleRemoveElement = (id: string) => {
    saveHistory(); // Save state before removing
    setSceneElements(prev => prev.filter(el => el.id !== id));
    if (selectedElementId === id) {
        setSelectedElementId(null);
    }
  };
  
  const handleUpdateElementReferenceImage = async (id: string, file: File) => {
    saveHistory();
    try {
      const { base64 } = await fileToBase64(file);
      setSceneElements(prev => prev.map(el => 
        el.id === id ? { ...el, referenceImage: base64 } : el
      ));
    } catch (e) {
      console.error("Error uploading reference image", e);
      setError("Failed to upload reference image");
    }
  };

  const handleRemoveElementReferenceImage = (id: string) => {
    saveHistory();
    setSceneElements(prev => prev.map(el => 
      el.id === id ? { ...el, referenceImage: undefined } : el
    ));
  };

  const handleUpdateElementTemperature = (id: string, temp: number) => {
     setSceneElements(prev => prev.map(el => 
        el.id === id ? { ...el, colorTemperature: temp } : el
     ));
  };

  const handleUpdateElementPose = (id: string, pose: Pose) => {
     setSceneElements(prev => prev.map(el => 
        el.id === id ? { ...el, pose } : el
     ));
  };

  const handleUpdateLightingPosition = (id: string, position: LightingPosition) => {
      setSceneElements(prev => prev.map(el => 
        el.id === id ? { ...el, lightingPosition: position } : el
      ));
  };

  // Capture history snapshot before starting an interaction (drag)
  const handleInteractionStart = () => {
    saveHistory();
  };

  // Modified to handle both start and end points
  const handleUpdateElementPosition = (id: string, x: number, y: number, isEndPoint: boolean = false) => {
    setSceneElements(prev => prev.map(el => {
      if (el.id === id) {
        // We only allow moving straight lines start/end for now to keep it simple
        if (el.points) {
           // For freehand, maybe moving the whole shape in future.
           // For now, freehand paths are static (can only be deleted).
           return el; 
        }
        if (isEndPoint) {
          return { ...el, endX: x, endY: y };
        } else {
          return { ...el, x, y };
        }
      }
      return el;
    }));
  };
  
  const getPositionDescription = (x: number, y: number): string => {
    // Using 2D coordinates (top/bottom/left/right) is more precise for image editing 
    // than 3D depth terms (background/foreground) which can be ambiguous.
    let v = 'middle';
    let h = 'center';

    if (y < 35) v = 'top'; 
    else if (y > 65) v = 'bottom';

    if (x < 35) h = 'left';
    else if (x > 65) h = 'right';

    if (v === 'middle' && h === 'center') return 'exact center';
    if (v === 'middle') return `${h} area`;
    if (h === 'center') return `${v} area`;
    
    return `${v} ${h} area`;
  };

  // Helper to extract clean base64 data for the prompt logic
  const extractBase64Data = (dataUrl: string) => {
      return dataUrl.split(',')[1] || dataUrl;
  };

  const constructFullPrompt = (processedElements: SceneElement[]) => {
    let finalPrompt = prompt.trim();
    if (!finalPrompt) {
        finalPrompt = "Architectural scene";
    }

    const enhancements: string[] = [];
    
    // Mood Handling
    if (mood === 'Original') {
      enhancements.push("Maintain original lighting, atmosphere, time of day and color grading of the source image");
    } else {
      // Use English keys for Prompt generation regardless of UI language
      enhancements.push(`Atmosphere: ${mood}`);
    }

    if (profLighting) enhancements.push("Professional cinematic lighting, global illumination");
    if (profLandscaping) enhancements.push("Professional landscape architecture, lush vegetation");
    
    if (enhanceRealism) {
      enhancements.push("Focus on hyper-realistic rendering of people, animals, and vehicles, ensuring they look like a real photograph with perfect lighting integration, shadows and reflections");
    }

    // Preservation Instructions
    if (preserveLighting) {
      enhancements.push("Strictly preserve the original quantity, position, and style of all existing light fixtures, lamps, and chandeliers. Do not add or remove lighting fixtures");
    }
    
    if (preserveView) {
      enhancements.push("Keep the original external landscape views seen through windows and doors exactly as they appear in the source image. Do not alter the outside scenery");
    }

    if (preserveBranding) {
      enhancements.push("Strictly preserve all original signage, text, logos, branding, and street signs visible in the image. Do not distort text or logos");
    }

    if (customPreservation.trim()) {
      enhancements.push(`Do not alter the following characteristics: ${customPreservation.trim()}`);
    }

    // Process positioned elements
    if (processedElements.length > 0) {
      let refImageIndex = 0; // The prompt parts will have main image (0), then refs (1, 2...)
      // But in the parts array, the MAIN image is 0. The first REF image is 1.

      const descriptions = processedElements.map(el => {
        const startPos = getPositionDescription(el.x, el.y);
        let desc = "";
        
        // Build basic description
        // Handle Linear Elements Prompt with STRICT Constraints
        if (el.points) {
           // Freehand path
           const installType = el.lightingPosition === 'back' ? "backlighting/cove lighting hidden behind the structure" : "direct surface installation";
           desc = `a curved ${el.subtype.toLowerCase()} roughly following the white guide curve (${installType}) starting at ${startPos}`;
        } else if (el.endX !== undefined && el.endY !== undefined) {
           const endPos = getPositionDescription(el.endX, el.endY);
           const installType = el.lightingPosition === 'back' ? "backlighting/cove lighting" : "direct surface installation";
           desc = `a linear ${el.subtype.toLowerCase()} (${installType}) installed strictly extending from the ${startPos} to the ${endPos}`;
        } else {
            // Standard Elements with potential pose injection
            let posePrefix = "";
            if (el.type === 'person' && el.pose && el.pose !== 'auto') {
                if (el.pose === 'standing') posePrefix = "standing ";
                if (el.pose === 'sitting') posePrefix = "sitting ";
                if (el.pose === 'lying') posePrefix = "lying down ";
            }
            desc = `a ${posePrefix}${el.subtype.toLowerCase()} placed ${startPos}`;
        }

        // Add Light Temperature info
        if (el.type === 'lighting' && el.colorTemperature) {
            desc += ` (Light Color Temperature strictly: ${el.colorTemperature} Kelvin)`;
        }

        // If the element has a reference image, bind it in the prompt
        if (el.referenceImage) {
            refImageIndex++;
            // We refer to the reference image order.
            // "Use reference image #1 for the style of this object"
            desc += ` (Use the provided reference image #${refImageIndex} for the visual style, color, and details of this ${el.subtype})`;
        }

        return desc;
      });
      enhancements.push("Include exactly: " + descriptions.join(', '));

      // STRICT Constraint for LED elements to prevent hallucination in other areas
      const hasLed = processedElements.some(el => el.subtype.includes('LED'));
      if (hasLed) {
        enhancements.push("IMPORTANT: The input image contains BRIGHT WHITE GUIDE LINES. Render lighting effects where these lines are. For freehand curves, treat the white line as a general reference path, smoothing out jagged edges. STRICT CONSTRAINT: DO NOT ADD any other LED strips, cove lighting, or linear lights anywhere else in the scene.");
      }
    }

    // Video Duration for Prompt
    if (mode === 'video') {
       const duration = videoDuration === 'custom' ? customDuration : videoDuration;
       if (duration) {
         enhancements.push(`Video duration: approximately ${duration} seconds`);
       }
    }

    return `${finalPrompt}. ${enhancements.join('. ')}. High quality, photorealistic, 8k.`;
  };

  const resolveAspectRatio = (): AspectRatio => {
    if (aspectRatio !== 'Original') return aspectRatio;
    
    if (imageDimensions) {
      const ratio = imageDimensions.width / imageDimensions.height;
      
      // Define supported ratios and their values
      const supportedRatios = [
        { key: '1:1', value: 1.0 },
        { key: '3:4', value: 0.75 },
        { key: '4:3', value: 1.33 },
        { key: '9:16', value: 0.5625 },
        { key: '16:9', value: 1.777 }
      ];

      // Find the closest ratio
      const closest = supportedRatios.reduce((prev, curr) => {
        return (Math.abs(curr.value - ratio) < Math.abs(prev.value - ratio) ? curr : prev);
      });

      return closest.key as AspectRatio;
    }
    return '16:9'; 
  };

  // Helper function to draw LED guides onto the image before sending to AI
  const processImageWithGuides = async (file: File, elements: SceneElement[]): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
             resolve(e.target?.result as string);
             return;
          }

          // Draw the original image
          ctx.drawImage(img, 0, 0);

          // Draw Linear LED Guides
          elements.forEach(el => {
             const isLinearType = el.subtype === 'LED Strip' || el.subtype === 'LED Profile';
             
             if (isLinearType) {
                // Setup common styles
                ctx.save();
                ctx.lineCap = "round";
                ctx.lineJoin = "round";

                // Draw function for the path with smoothing
                const drawPath = (isGlow: boolean) => {
                    ctx.beginPath();
                    if (el.points && el.points.length > 0) {
                        // Smooth Curve (Quadratic Bezier)
                        const pts = el.points;
                        const w = canvas.width;
                        const h = canvas.height;
                        
                        // Move to first point
                        ctx.moveTo((pts[0].x / 100) * w, (pts[0].y / 100) * h);
                        
                        // Draw curves between midpoints
                        for (let i = 1; i < pts.length - 2; i++) {
                            const p1 = pts[i];
                            const p2 = pts[i+1];
                            const midX = (p1.x + p2.x) / 2;
                            const midY = (p1.y + p2.y) / 2;
                            
                            const cpX = (p1.x / 100) * w;
                            const cpY = (p1.y / 100) * h;
                            const endX = (midX / 100) * w;
                            const endY = (midY / 100) * h;
                            
                            ctx.quadraticCurveTo(cpX, cpY, endX, endY);
                        }
                        
                        // Connect the last two points with a straight line or curve
                        if (pts.length > 2) {
                            const lastP = pts[pts.length - 1];
                             const secondLastP = pts[pts.length - 2];
                            // Simple line to the end for the very last segment
                             ctx.lineTo((lastP.x / 100) * w, (lastP.y / 100) * h);
                        } else if (pts.length === 2) {
                             ctx.lineTo((pts[1].x / 100) * w, (pts[1].y / 100) * h);
                        }

                    } else if (el.endX !== undefined && el.endY !== undefined) {
                        // Straight Line
                        ctx.moveTo((el.x / 100) * canvas.width, (el.y / 100) * canvas.height);
                        ctx.lineTo((el.endX / 100) * canvas.width, (el.endY / 100) * canvas.height);
                    }
                    ctx.stroke();
                };

                const isBacklit = el.lightingPosition === 'back';

                // 1. Glow effect (Outer soft light)
                // Backlit should be softer and more diffuse
                ctx.shadowBlur = isBacklit ? 30 : 15;
                ctx.shadowColor = "white";
                ctx.strokeStyle = isBacklit ? "rgba(255, 255, 255, 0.4)" : "rgba(255, 255, 255, 0.6)";
                ctx.lineWidth = Math.max(4, canvas.width * (isBacklit ? 0.012 : 0.008)); 
                drawPath(true);

                // 2. Core (Bright center)
                // Backlit has a less intense core
                ctx.shadowBlur = 0;
                ctx.strokeStyle = isBacklit ? "rgba(255, 255, 255, 0.6)" : "rgba(255, 255, 255, 1.0)";
                ctx.lineWidth = Math.max(2, canvas.width * (isBacklit ? 0.004 : 0.003));
                drawPath(false);

                ctx.restore();
             }
          });

          resolve(canvas.toDataURL(file.type));
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleGenerate = useCallback(async () => {
    if (!uploadedImage) {
      setError('Please upload an image first.');
      return;
    }

    setIsLoading(true);
    setGeneratedVideoUrl(null);
    setGeneratedImageUrl(null);
    setError(null);

    // Filter elements that have a reference image to extract them in order
    const elementsWithRefs = sceneElements.filter(el => !!el.referenceImage);
    const referenceImagesBase64 = elementsWithRefs.map(el => extractBase64Data(el.referenceImage!));

    const fullPrompt = constructFullPrompt(sceneElements);
    const resolvedRatio = resolveAspectRatio();
    
    // Video Generation Logic Enforcement
    let targetVideoRatio: AspectRatio = '16:9';
    if (mode === 'video') {
       if (resolvedRatio === '16:9' || resolvedRatio === '9:16') {
         targetVideoRatio = resolvedRatio;
       } else {
         if (imageDimensions && imageDimensions.height > imageDimensions.width) {
            targetVideoRatio = '9:16';
         } else {
            targetVideoRatio = '16:9';
         }
       }
    }

    console.log("Generating with prompt:", fullPrompt);
    console.log("Mode:", mode);

    try {
      // Logic Check: Do we need to process the image with guides?
      const hasLinearLights = sceneElements.some(el => 
        (el.subtype === 'LED Strip' || el.subtype === 'LED Profile')
      );

      let base64Data: string;
      let mimeTypeData: string;

      if (hasLinearLights) {
         // Use the processed image with visual guides
         const processedBase64 = await processImageWithGuides(uploadedImage, sceneElements);
         const [header, data] = processedBase64.split(',');
         base64Data = data;
         mimeTypeData = header.match(/:(.*?);/)?.[1] || uploadedImage.type;
      } else {
         // Use original
         const result = await fileToBase64(uploadedImage);
         base64Data = result.base64;
         mimeTypeData = result.mimeType;
      }
      
      let newResult: RenderResult;

      if (mode === 'video') {
        const videoUrl = await generateVideoFromImage(fullPrompt, base64Data, mimeTypeData, targetVideoRatio);
        setGeneratedVideoUrl(videoUrl);
        newResult = {
          id: Date.now().toString(),
          url: videoUrl,
          type: 'video',
          timestamp: Date.now(),
        };
      } else {
        const imageUrl = await renderArchitecturalImage(
            fullPrompt, 
            base64Data, 
            mimeTypeData, 
            resolvedRatio, 
            referenceImagesBase64 // Pass collected references
        );
        setGeneratedImageUrl(imageUrl);
        newResult = {
           id: Date.now().toString(),
           url: imageUrl,
           type: 'image',
           timestamp: Date.now(),
        };
      }
      
      setRenderHistory(prev => [newResult, ...prev]);

    } catch (err: any) {
      console.error(err);
      let errorMessage = err.message || 'An unknown error occurred.';
      
      // Handle 403 Permission Denied by resetting key state
      if (err.message && (err.message.includes('403') || err.message.includes('Permission denied') || err.message.includes('PERMISSION_DENIED'))) {
         setHasApiKey(false); 
         errorMessage = 'Permission Denied. Please select a valid API Key.';
      } else if (errorMessage.includes('API_KEY environment variable is not set')) {
          setHasApiKey(false);
          errorMessage = 'API Configuration Error: API Key missing. Please select one.';
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [uploadedImage, prompt, aspectRatio, mode, mood, profLighting, profLandscaping, enhanceRealism, preserveLighting, preserveView, preserveBranding, customPreservation, sceneElements, imageDimensions, videoDuration, customDuration, language]);

  const handleSelectHistoryItem = (item: RenderResult) => {
    if (item.type === 'video') {
      setMode('video');
      setGeneratedVideoUrl(item.url);
      setGeneratedImageUrl(null);
    } else {
      setMode('image');
      setGeneratedImageUrl(item.url);
      setGeneratedVideoUrl(null);
    }
    setError(null);
  };

  const handleDeleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenderHistory(prev => prev.filter(item => item.id !== id));
    
    // If deleted item is currently displayed, clear display
    const currentItem = renderHistory.find(item => item.id === id);
    if (currentItem) {
      if (currentItem.type === 'image' && currentItem.url === generatedImageUrl) {
        setGeneratedImageUrl(null);
      }
      if (currentItem.type === 'video' && currentItem.url === generatedVideoUrl) {
        setGeneratedVideoUrl(null);
      }
    }
  };

  const handleUseResultAsInput = async (targetMode: GenerationMode) => {
    if (!generatedImageUrl) return;

    try {
      setIsLoading(true);
      const file = await base64ToFile(generatedImageUrl, "generated-image.png");
      handleImageUpload(file);
      setMode(targetMode);
    } catch (e) {
      setError("Failed to process generated image as input.");
    } finally {
      setIsLoading(false);
    }
  };

  // API Key Blocking Screen
  if (isCheckingKey) {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-teal-500"></div></div>;
  }

  if (!hasApiKey) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl text-center">
            <h2 className="text-2xl font-bold text-teal-400 mb-4">{t('apiKeyTitle')}</h2>
            <p className="text-gray-400 mb-8">{t('apiKeyDesc')}</p>
            
            <button 
                onClick={handleSelectKey}
                className="w-full bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white font-bold py-3 px-6 rounded-lg transition-all shadow-lg hover:shadow-teal-500/20"
            >
                {t('selectKey')}
            </button>
            
            <p className="mt-6 text-xs text-gray-500">
                <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="underline hover:text-teal-400">
                    {t('billingInfo')}
                </a>
            </p>
            
            <div className="mt-4 flex gap-2 justify-center bg-gray-800/50 p-2 rounded">
                 {(['pt-BR', 'en', 'es'] as Language[]).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setLanguage(lang)}
                    className={`px-2 py-1 text-[10px] font-bold rounded uppercase transition-colors ${
                      language === lang ? 'bg-teal-600 text-white' : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {lang === 'pt-BR' ? 'PT' : lang}
                  </button>
                ))}
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans selection:bg-teal-500 selection:text-white">
      <main className="container mx-auto p-4 md:p-8 max-w-7xl">
        <Header 
          language={language} 
          setLanguage={setLanguage} 
          hasApiKey={hasApiKey}
          onEditKey={handleSelectKey}
        />
        
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Controls & Upload */}
          <div className="lg:col-span-5 flex flex-col space-y-6">
            
            {/* Mode Toggle Switch */}
            <div className="bg-gray-800 p-1.5 rounded-xl flex shadow-inner border border-gray-700">
              <button
                onClick={() => setMode('image')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 ${
                  mode === 'image' 
                    ? 'bg-gradient-to-br from-cyan-500 to-cyan-700 text-white shadow-lg' 
                    : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                }`}
              >
                {t('imageMode')}
              </button>
               <button
                onClick={() => {
                  setMode('video');
                  if (aspectRatio !== '9:16') {
                    setAspectRatio('16:9');
                  }
                }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 ${
                  mode === 'video' 
                    ? 'bg-gradient-to-br from-teal-500 to-teal-700 text-white shadow-lg' 
                    : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                }`}
              >
                {t('videoMode')}
              </button>
            </div>

            {/* Interactive Scene Editor */}
            {imagePreview ? (
              <SceneEditor 
                imageSrc={imagePreview}
                elements={sceneElements}
                onUpdateElementPosition={handleUpdateElementPosition}
                onRemoveElement={handleRemoveElement}
                onClearImage={() => {
                  // Save history before clearing? Usually clearing is a reset, but let's allow undoing a clear if desired.
                  // However, handleImageUpload resets history.
                  // For just removing the current image but keeping the App mounted:
                  saveHistory();
                  setUploadedImage(null);
                  setImagePreview(null);
                  setSceneElements([]);
                  setSelectedElementId(null);
                  setRenderHistory([]);
                  setGeneratedImageUrl(null);
                  setGeneratedVideoUrl(null);
                  setActiveDrawingTool(null);
                }}
                onReplaceImage={(file) => handleImageUpload(file, true)}
                activeDrawingTool={activeDrawingTool}
                onDrawComplete={handleDrawComplete}
                language={language}
                onUndo={undo}
                onRedo={redo}
                canUndo={history.length > 0}
                canRedo={future.length > 0}
                onInteractionStart={handleInteractionStart}
                selectedElementId={selectedElementId}
                onSelectElement={setSelectedElementId}
              />
            ) : (
              <ImageUploader onImageUpload={handleImageUpload} imagePreview={null} language={language} />
            )}
            
            <Controls
              prompt={prompt}
              setPrompt={setPrompt}
              aspectRatio={aspectRatio}
              setAspectRatio={setAspectRatio}
              onGenerate={handleGenerate}
              isLoading={isLoading}
              isImageUploaded={!!uploadedImage}
              mode={mode}
              
              // State Props
              mood={mood} setMood={setMood}
              profLighting={profLighting} setProfLighting={setProfLighting}
              profLandscaping={profLandscaping} setProfLandscaping={setProfLandscaping}
              enhanceRealism={enhanceRealism} setEnhanceRealism={setEnhanceRealism}
              
              // Preservation Props
              preserveLighting={preserveLighting} setPreserveLighting={setPreserveLighting}
              preserveView={preserveView} setPreserveView={setPreserveView}
              preserveBranding={preserveBranding} setPreserveBranding={setPreserveBranding}
              customPreservation={customPreservation} setCustomPreservation={setCustomPreservation}

              videoDuration={videoDuration} setVideoDuration={setVideoDuration}
              customDuration={customDuration} setCustomDuration={setCustomDuration}
              
              // Element Props
              sceneElements={sceneElements}
              onAddElement={handleAddElement}
              onRemoveElement={handleRemoveElement}
              
              // Reference Image Props
              onUpdateElementReferenceImage={handleUpdateElementReferenceImage}
              onRemoveElementReferenceImage={handleRemoveElementReferenceImage}
              
              // Temp Prop
              onUpdateElementTemperature={handleUpdateElementTemperature}
              onUpdateElementPose={handleUpdateElementPose}
              onUpdateElementLightingPosition={handleUpdateLightingPosition}

              // Library Props
              savedCharacters={savedCharacters}
              onSaveCharacter={handleSaveCharacter}
              onDeleteSavedCharacter={handleDeleteSavedCharacter}
              
              // Selection Props
              selectedElementId={selectedElementId}
              onSelectElement={setSelectedElementId}
              
              // i18n
              language={language}
            />
          </div>

          {/* Right Column: Output */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="bg-gray-900/50 rounded-2xl flex items-center justify-center min-h-[500px] p-6 border border-gray-800 shadow-2xl relative overflow-hidden flex-1">
               <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-teal-900/10 to-purple-900/10 pointer-events-none" />

              <div className="relative z-10 w-full flex flex-col items-center justify-center">
                {error && <ErrorDisplay message={error} />}
                {isLoading && <LoadingDisplay mode={mode} language={language} />}
                
                {!isLoading && !error && generatedVideoUrl && mode === 'video' && (
                  <VideoPlayer src={generatedVideoUrl} />
                )}
                
                {!isLoading && !error && generatedImageUrl && mode === 'image' && (
                   <div className="w-full flex flex-col items-center animate-fade-in space-y-4">
                     <img 
                       src={generatedImageUrl} 
                       alt="PrismaRender Result" 
                       className="w-full h-auto max-h-[600px] object-contain rounded-lg shadow-2xl border border-gray-700" 
                     />
                     
                     <div className="flex flex-wrap justify-center gap-3">
                        {/* Download Button */}
                        <a 
                          href={generatedImageUrl} 
                          download={`PrismaRender-${Date.now()}.png`} 
                          className="inline-flex items-center px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg transition-all duration-300 border border-gray-600 hover:border-gray-500"
                        >
                          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                          {t('download')}
                        </a>

                        {/* Animate This Button */}
                        <button
                          onClick={() => handleUseResultAsInput('video')}
                          className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-white font-bold rounded-lg transition-all duration-300 shadow-lg hover:shadow-teal-500/20"
                        >
                           <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                           </svg>
                           {t('animateThis')}
                        </button>

                         {/* Use as Base Button */}
                        <button
                          onClick={() => handleUseResultAsInput('image')}
                          className="inline-flex items-center px-6 py-3 bg-cyan-700 hover:bg-cyan-600 text-white font-medium rounded-lg transition-all duration-300 shadow-lg"
                        >
                           <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                           </svg>
                           {t('useAsBase')}
                        </button>
                     </div>
                   </div>
                )}

                {!isLoading && !error && !generatedVideoUrl && !generatedImageUrl && (
                  <div className="text-center text-gray-500">
                    <div className="mb-4 inline-block p-4 rounded-full bg-gray-800/50">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-teal-600/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-medium text-gray-300 mb-2">{t('readyToRender')}</h3>
                    <p className="max-w-xs mx-auto text-sm opacity-70">
                      {t('readyDesc')}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Render History Strip */}
            {renderHistory.length > 0 && (
              <div className="w-full">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">
                  {t('renderHistory')} ({renderHistory.length})
                </h3>
                <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
                  {renderHistory.map((item) => (
                    <div 
                      key={item.id}
                      onClick={() => handleSelectHistoryItem(item)}
                      className={`flex-shrink-0 w-32 cursor-pointer group relative rounded-lg overflow-hidden border-2 transition-all duration-200
                        ${(item.type === 'image' && item.url === generatedImageUrl) || (item.type === 'video' && item.url === generatedVideoUrl)
                          ? 'border-teal-500 shadow-lg scale-105' 
                          : 'border-gray-700 hover:border-gray-500 opacity-70 hover:opacity-100'
                        }`}
                    >
                      {/* Delete Button */}
                      <button 
                        onClick={(e) => handleDeleteHistoryItem(item.id, e)}
                        className="absolute top-1 right-1 z-20 bg-red-600 hover:bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                        title={t('delete')}
                      >
                         <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                         </svg>
                      </button>

                      <div className="aspect-video bg-gray-800 w-full relative">
                        {item.type === 'image' ? (
                          <img src={item.url} alt="History" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gray-900">
                             <svg className="w-8 h-8 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                             </svg>
                             <div className="absolute top-1 right-1">
                               <span className="bg-black/80 text-[10px] text-white px-1 rounded">Vid</span>
                             </div>
                          </div>
                        )}
                      </div>
                      <div className="bg-gray-800 p-1 text-[10px] text-center text-gray-400">
                        {new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;