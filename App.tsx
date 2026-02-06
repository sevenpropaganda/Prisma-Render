

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  LightingPosition,
  GlobalReference
} from './types';

import Header from './components/Header';
import ImageUploader from './components/ImageUploader';
import SceneEditor from './components/SceneEditor';
import Controls from './components/Controls';
import LoadingDisplay from './components/LoadingDisplay';
import VideoPlayer from './components/VideoPlayer';
import ErrorDisplay from './components/ErrorDisplay';

const UNLOCK_CODE = "11075713ALa!";

const App: React.FC = () => {
  const [language, setLanguage] = useState<Language>('pt-BR');
  const t = useCallback((key: string) => getTranslation(language, key), [language]);

  // API Key State
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const [isCheckingKey, setIsCheckingKey] = useState<boolean>(true);
  
  // Changed default mode to 'image'
  const [mode, setMode] = useState<GenerationMode>('image');
  // Video Lock State
  const [isVideoUnlocked, setIsVideoUnlocked] = useState<boolean>(false);
  
  // Unlock Modal State
  const [showUnlockModal, setShowUnlockModal] = useState<boolean>(false);
  const [unlockInput, setUnlockInput] = useState<string>('');
  const [unlockError, setUnlockError] = useState<boolean>(false);
  
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{width: number, height: number} | null>(null);
  
  // Base prompt
  const [prompt, setPrompt] = useState<string>('');

  // Enhanced Controls State
  const [mood, setMood] = useState<Mood>('Original'); 
  const [profLighting, setProfLighting] = useState<boolean>(false);
  const [profLandscaping, setProfLandscaping] = useState<boolean>(false);
  // Realism checkbox removed
  
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
  
  // Library & References State
  const [savedCharacters, setSavedCharacters] = useState<SavedCharacter[]>([]);
  const [globalReferences, setGlobalReferences] = useState<GlobalReference[]>([]);

  // Default Aspect Ratio is Original
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('Original');
  
  // Results & History
  // We no longer use simple URL states, but rely on renderHistory and activeRenderId
  const [renderHistory, setRenderHistory] = useState<RenderResult[]>([]);
  const [activeRenderId, setActiveRenderId] = useState<string | null>(null);
  
  // 'isGenerating' only tracks if the machine is busy to disable the generate button, 
  // NOT to block the view. The view depends on the status of the 'activeRenderId'.
  const [isGenerating, setIsGenerating] = useState<boolean>(false); 
  const [globalError, setGlobalError] = useState<string | null>(null);

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
    } else {
      console.warn("AI Studio API Key selector not found in this environment.");
    }
    setHasApiKey(true);
    setGlobalError(null); 
  };

  const handleVideoModeClick = () => {
      if (isVideoUnlocked) {
          switchToVideoMode();
      } else {
          setShowUnlockModal(true);
          setUnlockInput('');
          setUnlockError(false);
      }
  };

  const switchToVideoMode = () => {
      setMode('video');
      if (imageDimensions) {
          // Auto-detect orientation for Veo (16:9 or 9:16)
          if (imageDimensions.height > imageDimensions.width) {
              setAspectRatio('9:16');
          } else {
              setAspectRatio('16:9');
          }
      } else {
          setAspectRatio('16:9');
      }
  };

  const handleUnlockSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (unlockInput === UNLOCK_CODE) {
          setIsVideoUnlocked(true);
          setShowUnlockModal(false);
          switchToVideoMode();
      } else {
          setUnlockError(true);
      }
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

  const handleSaveCharacter = (name: string, type: ElementType, description: string, referenceImage?: string) => {
    const newChar: SavedCharacter = {
      id: Date.now().toString(),
      name,
      type,
      description,
      referenceImage
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

  // Reference Management
  const handleAddGlobalReference = async (files: FileList) => {
      const newRefs: GlobalReference[] = [];
      for (let i = 0; i < files.length; i++) {
          try {
              const { base64 } = await fileToBase64(files[i]);
              newRefs.push({
                  id: Date.now().toString() + Math.random(),
                  url: base64
              });
          } catch (e) {
              console.error("Failed to upload reference", files[i]);
          }
      }
      setGlobalReferences(prev => [...prev, ...newRefs]);
  };

  const handleDeleteGlobalReference = (id: string) => {
      setGlobalReferences(prev => prev.filter(ref => ref.id !== id));
  };

  const handleSelectGlobalReferenceForElement = (elementId: string, refUrl: string) => {
     saveHistory();
     setSceneElements(prev => prev.map(el => 
        el.id === elementId ? { ...el, referenceImage: refUrl } : el
     ));
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
    setActiveRenderId(null); // Clear active view
    setGlobalError(null);
    setRenderHistory([]); 
    
    if (!keepElements) {
      setSceneElements([]);
      setSelectedElementId(null);
      setHistory([]); 
      setFuture([]); 
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

  const handleAddElement = (type: ElementType, subtype: string, initialPos?: {x: number, y: number}) => {
    const isLinear = subtype === 'LED Strip' || subtype === 'LED Profile';

    if (isLinear) {
      setActiveDrawingTool({ type, subtype });
    } else {
      saveHistory(); 
      const newElement: SceneElement = {
        id: Date.now().toString() + Math.random().toString(),
        type,
        subtype,
        x: initialPos ? initialPos.x : 50, 
        y: initialPos ? initialPos.y : 50,
        colorTemperature: type === 'lighting' ? 3000 : undefined,
        pose: type === 'person' ? 'auto' : undefined,
        lightingPosition: 'front' 
      };
      setSceneElements(prev => [...prev, newElement]);
      setSelectedElementId(newElement.id);
    }
  };

  const handleDuplicateElement = (id: string) => {
    const el = sceneElements.find(e => e.id === id);
    if (!el) return;

    saveHistory();

    const offset = 2; // Offset by 2% so it doesn't perfectly overlap
    const newEl: SceneElement = {
        ...el,
        id: Date.now().toString() + Math.random().toString(),
        x: Math.min(el.x + offset, 100),
        y: Math.min(el.y + offset, 100),
    };

    if (newEl.endX !== undefined) newEl.endX = Math.min(newEl.endX + offset, 100);
    if (newEl.endY !== undefined) newEl.endY = Math.min(newEl.endY + offset, 100);
    if (newEl.points) {
        newEl.points = newEl.points.map(p => ({ 
            x: Math.min(p.x + offset, 100), 
            y: Math.min(p.y + offset, 100) 
        }));
    }

    setSceneElements(prev => [...prev, newEl]);
    setSelectedElementId(newEl.id);
  };

  const handleDrawComplete = (start: {x: number, y: number}, end: {x: number, y: number}, points?: {x: number, y: number}[]) => {
    if (!activeDrawingTool) return;
    
    saveHistory(); 

    const newElement: SceneElement = {
      id: Date.now().toString() + Math.random().toString(),
      type: activeDrawingTool.type,
      subtype: activeDrawingTool.subtype,
      x: start.x,
      y: start.y,
      endX: end.x,
      endY: end.y,
      points: points, 
      colorTemperature: activeDrawingTool.type === 'lighting' ? 3000 : undefined,
      pose: activeDrawingTool.type === 'person' ? 'auto' : undefined,
      lightingPosition: 'front'
    };

    setSceneElements(prev => [...prev, newElement]);
    setSelectedElementId(newElement.id);
    setActiveDrawingTool(null);
  };

  const handleRemoveElement = (id: string) => {
    saveHistory(); 
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
      setGlobalError("Failed to upload reference image");
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

  const handleUpdateElementDescription = (id: string, newDescription: string) => {
    if (!newDescription.trim()) return;
    saveHistory();
    setSceneElements(prev => prev.map(el => 
        el.id === id ? { ...el, subtype: newDescription } : el
    ));
  };

  const handleInteractionStart = () => {
    saveHistory();
  };

  const handleUpdateElementPosition = (id: string, x: number, y: number, isEndPoint: boolean = false) => {
    setSceneElements(prev => prev.map(el => {
      if (el.id === id) {
        if (el.points) {
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
      enhancements.push(`Atmosphere: ${mood}`);
    }

    if (profLighting) enhancements.push("Professional cinematic lighting, global illumination");
    if (profLandscaping) enhancements.push("Professional landscape architecture, lush vegetation");
    
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
      let refImageIndex = 0; 
      const descriptions = processedElements.map(el => {
        const startPos = getPositionDescription(el.x, el.y);
        let desc = "";
        
        if (el.points) {
           const installType = el.lightingPosition === 'back' ? "backlighting/cove lighting hidden behind the structure" : "direct surface installation";
           desc = `a curved ${el.subtype.toLowerCase()} following the exact path of the white guide line (${installType})`;
        } else if (el.endX !== undefined && el.endY !== undefined) {
           const installType = el.lightingPosition === 'back' ? "backlighting/cove lighting" : "direct surface installation";
           desc = `a linear ${el.subtype.toLowerCase()} (${installType}) installed strictly along the white guide line`;
        } else {
            let posePrefix = "";
            if (el.type === 'person' && el.pose && el.pose !== 'auto') {
                if (el.pose === 'standing') posePrefix = "standing ";
                if (el.pose === 'sitting') posePrefix = "sitting ";
                if (el.pose === 'lying') posePrefix = "lying down ";
            }
            desc = `a ${posePrefix}${el.subtype.toLowerCase()} placed ${startPos}`;
        }

        if (el.type === 'lighting' && el.colorTemperature) {
            desc += ` (Light Color Temperature strictly: ${el.colorTemperature} Kelvin)`;
        }

        if (el.referenceImage) {
            refImageIndex++;
            desc += ` (Use the provided reference image #${refImageIndex} for the visual style, color, and details of this ${el.subtype})`;
        }

        return desc;
      });
      enhancements.push("Include exactly: " + descriptions.join(', '));

      const hasLed = processedElements.some(el => el.subtype.includes('LED'));
      if (hasLed) {
        enhancements.push("CRITICAL INSTRUCTION: The input image has been digitally annotated with bright WHITE LINES. These lines MARK THE EXACT POSITION of the LED profiles. You must transform these specific white lines into photorealistic LED light fixtures. DO NOT create new lights where there are no white lines. The white lines are the only source of new lighting.");
      }
    }

    // Video Duration for Prompt
    if (mode === 'video') {
       enhancements.push("Cinematic camera movement, high quality architectural animation");
    }

    return `${finalPrompt}. ${enhancements.join('. ')}. High quality, photorealistic, 8k.`;
  };

  const resolveAspectRatio = (): AspectRatio => {
    // If in video mode, we MUST return 16:9 or 9:16
    if (mode === 'video') {
        if (aspectRatio === '16:9' || aspectRatio === '9:16') return aspectRatio;
        // Fallback calculation for video
        if (imageDimensions && imageDimensions.height > imageDimensions.width) {
            return '9:16';
        }
        return '16:9';
    }

    if (aspectRatio !== 'Original') return aspectRatio;
    if (imageDimensions) {
      const ratio = imageDimensions.width / imageDimensions.height;
      const supportedRatios = [
        { key: '1:1', value: 1.0 },
        { key: '3:4', value: 0.75 },
        { key: '4:3', value: 1.33 },
        { key: '9:16', value: 0.5625 },
        { key: '16:9', value: 1.777 }
      ];
      const closest = supportedRatios.reduce((prev, curr) => {
        return (Math.abs(curr.value - ratio) < Math.abs(prev.value - ratio) ? curr : prev);
      });
      return closest.key as AspectRatio;
    }
    return '16:9'; 
  };

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

          ctx.drawImage(img, 0, 0);

          elements.forEach(el => {
             const isLinearType = el.subtype === 'LED Strip' || el.subtype === 'LED Profile';
             
             if (isLinearType) {
                ctx.save();
                ctx.lineCap = "round";
                ctx.lineJoin = "round";

                const drawPath = (isGlow: boolean) => {
                    ctx.beginPath();
                    if (el.points && el.points.length > 0) {
                        const pts = el.points;
                        const w = canvas.width;
                        const h = canvas.height;
                        
                        ctx.moveTo((pts[0].x / 100) * w, (pts[0].y / 100) * h);
                        
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
                        
                        if (pts.length > 2) {
                            const lastP = pts[pts.length - 1];
                            ctx.lineTo((lastP.x / 100) * w, (lastP.y / 100) * h);
                        } else if (pts.length === 2) {
                             ctx.lineTo((pts[1].x / 100) * w, (pts[1].y / 100) * h);
                        }

                    } else if (el.endX !== undefined && el.endY !== undefined) {
                        ctx.moveTo((el.x / 100) * canvas.width, (el.y / 100) * canvas.height);
                        ctx.lineTo((el.endX / 100) * canvas.width, (el.endY / 100) * canvas.height);
                    }
                    ctx.stroke();
                };

                const isBacklit = el.lightingPosition === 'back';

                // 1. Glow effect (Broader but softer)
                ctx.shadowBlur = isBacklit ? 40 : 25;
                ctx.shadowColor = "white";
                ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
                ctx.lineWidth = Math.max(6, canvas.width * 0.015); 
                drawPath(true);

                // 2. Solid Core (Sharp, opaque white to define the fixture structure)
                ctx.shadowBlur = 0;
                ctx.strokeStyle = "rgba(255, 255, 255, 1.0)";
                ctx.lineWidth = Math.max(3, canvas.width * 0.006);
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
      setGlobalError('Please upload an image first.');
      return;
    }

    setIsGenerating(true);
    setGlobalError(null);

    const fullPrompt = constructFullPrompt(sceneElements);
    const resolvedRatio = resolveAspectRatio();
    
    let targetVideoRatio: AspectRatio = '16:9';
    if (mode === 'video') {
       if (resolvedRatio === '9:16') {
         targetVideoRatio = '9:16';
       } else {
         targetVideoRatio = '16:9';
       }
    }

    // --- OPTIMISTIC UI: Add pending item to history ---
    const tempId = Date.now().toString();
    const newHistoryItem: RenderResult = {
        id: tempId,
        url: null,
        type: mode,
        timestamp: Date.now(),
        thumbnail: imagePreview || undefined, // Use current image as placeholder
        status: 'pending'
    };

    setRenderHistory(prev => [newHistoryItem, ...prev]);
    setActiveRenderId(tempId); // Auto-focus the new rendering item

    // --- START ASYNC PROCESS ---
    (async () => {
        try {
            const elementsWithRefs = sceneElements.filter(el => !!el.referenceImage);
            const referenceImagesBase64 = elementsWithRefs.map(el => extractBase64Data(el.referenceImage!));

            const hasLinearLights = sceneElements.some(el => 
                (el.subtype === 'LED Strip' || el.subtype === 'LED Profile')
            );

            let base64Data: string;
            let mimeTypeData: string;

            if (hasLinearLights) {
                const processedBase64 = await processImageWithGuides(uploadedImage, sceneElements);
                const [header, data] = processedBase64.split(',');
                base64Data = data;
                mimeTypeData = header.match(/:(.*?);/)?.[1] || uploadedImage.type;
            } else {
                const result = await fileToBase64(uploadedImage);
                base64Data = result.base64;
                mimeTypeData = result.mimeType;
            }
            
            let resultUrl: string;

            if (mode === 'video') {
                resultUrl = await generateVideoFromImage(fullPrompt, base64Data, mimeTypeData, targetVideoRatio);
            } else {
                resultUrl = await renderArchitecturalImage(
                    fullPrompt, 
                    base64Data, 
                    mimeTypeData, 
                    resolvedRatio, 
                    referenceImagesBase64 
                );
            }
            
            // --- SUCCESS: Update history item ---
            setRenderHistory(prev => prev.map(item => 
                item.id === tempId 
                ? { ...item, url: resultUrl, status: 'completed' } 
                : item
            ));

        } catch (err: any) {
            console.error(err);
            let errorMessage = err.message || 'An unknown error occurred.';
            if (err.message && (err.message.includes('403') || err.message.includes('Permission denied') || err.message.includes('PERMISSION_DENIED'))) {
                setHasApiKey(false); 
                errorMessage = 'Permission Denied. Please select a valid API Key.';
            } else if (errorMessage.includes('API_KEY environment variable is not set')) {
                setHasApiKey(false);
                errorMessage = 'API Configuration Error: API Key missing. Please select one.';
            }
            // --- FAILURE: Update history item ---
            setRenderHistory(prev => prev.map(item => 
                item.id === tempId 
                ? { ...item, status: 'failed' } 
                : item
            ));
            
            // Only show global error if the user is currently looking at this failed item
            if (activeRenderId === tempId) {
                setGlobalError(errorMessage);
            }

        } finally {
            setIsGenerating(false);
        }
    })();

  }, [uploadedImage, prompt, aspectRatio, mode, mood, profLighting, profLandscaping, preserveLighting, preserveView, preserveBranding, customPreservation, sceneElements, imageDimensions, videoDuration, customDuration, language, imagePreview, activeRenderId]);

  const handleSelectHistoryItem = (item: RenderResult) => {
    setActiveRenderId(item.id);
    // Switch mode based on the history item type to ensure correct viewer
    setMode(item.type);
    setGlobalError(null);
  };

  const handleDeleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenderHistory(prev => prev.filter(item => item.id !== id));
    if (activeRenderId === id) {
        setActiveRenderId(null);
        setGlobalError(null);
    }
  };

  const handleUseResultAsInput = async (targetMode: GenerationMode) => {
    const activeItem = renderHistory.find(item => item.id === activeRenderId);
    if (!activeItem || !activeItem.url) return;

    try {
      setIsGenerating(true); // Temporarily block while loading
      const file = await base64ToFile(activeItem.url, "generated-image.png");
      handleImageUpload(file);
      setMode(targetMode);
    } catch (e) {
      setGlobalError("Failed to process generated image as input.");
    } finally {
        setIsGenerating(false);
    }
  };

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

  // --- DERIVED VIEW STATE ---
  const activeHistoryItem = renderHistory.find(item => item.id === activeRenderId);
  
  // Decide what to show in the main viewer
  let viewerContent: React.ReactNode = null;

  if (activeHistoryItem) {
      if (activeHistoryItem.status === 'pending') {
          viewerContent = <LoadingDisplay mode={activeHistoryItem.type} language={language} />;
      } else if (activeHistoryItem.status === 'failed') {
          viewerContent = (
              <div className="text-center p-8">
                  <div className="text-red-500 text-5xl mb-4">⚠️</div>
                  <h3 className="text-xl font-bold text-gray-200">Rendering Failed</h3>
                  <p className="text-gray-400 mt-2">Please try again or check your settings.</p>
              </div>
          );
      } else if (activeHistoryItem.url) {
          if (activeHistoryItem.type === 'video') {
              viewerContent = <VideoPlayer src={activeHistoryItem.url} />;
          } else {
              viewerContent = (
                <div className="w-full flex flex-col items-center animate-fade-in space-y-4">
                    <img 
                    src={activeHistoryItem.url} 
                    alt="PrismaRender Result" 
                    className="w-full h-auto max-h-[600px] object-contain rounded-lg shadow-2xl border border-gray-700" 
                    />
                    
                    <div className="flex flex-wrap justify-center gap-3">
                        <a 
                            href={activeHistoryItem.url} 
                            download={`PrismaRender-${Date.now()}.png`} 
                            className="inline-flex items-center px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg transition-all duration-300 border border-gray-600 hover:border-gray-500"
                        >
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            {t('download')}
                        </a>

                        <button
                            onClick={() => handleUseResultAsInput('video')}
                            className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-white font-bold rounded-lg transition-all duration-300 shadow-lg hover:shadow-teal-500/20"
                        >
                            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            {t('animateThis')}
                        </button>

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
              );
          }
      }
  } else {
      // Idle State
      viewerContent = (
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
      );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans selection:bg-teal-500 selection:text-white relative">
      
      {/* Unlock Modal */}
      {showUnlockModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-gray-800 border border-gray-600 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <svg className="w-5 h-5 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        {t('videoMode')}
                    </h3>
                    <button onClick={() => setShowUnlockModal(false)} className="text-gray-400 hover:text-white">✕</button>
                </div>
                
                <p className="text-sm text-gray-300 mb-4">
                    {t('enterPasscode')}
                </p>

                <form onSubmit={handleUnlockSubmit} className="space-y-4">
                    <input 
                        type="password" 
                        value={unlockInput}
                        onChange={(e) => {
                            setUnlockInput(e.target.value);
                            setUnlockError(false);
                        }}
                        className={`w-full bg-gray-900 border rounded-lg p-2.5 text-white focus:outline-none focus:ring-2 transition-all ${unlockError ? 'border-red-500 focus:ring-red-500/50' : 'border-gray-600 focus:border-teal-500 focus:ring-teal-500/50'}`}
                        placeholder="••••••••"
                        autoFocus
                    />
                    
                    {unlockError && (
                        <p className="text-xs text-red-400 font-medium">
                            {t('passcodeIncorrect')}
                        </p>
                    )}

                    <button 
                        type="submit"
                        className="w-full bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white font-bold py-2.5 rounded-lg shadow-lg"
                    >
                        {t('confirm')}
                    </button>
                </form>
            </div>
        </div>
      )}

      <main className="container mx-auto p-4 md:p-8 max-w-7xl">
        <Header 
          language={language} 
          setLanguage={setLanguage} 
          hasApiKey={hasApiKey}
          onEditKey={handleSelectKey}
        />
        
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          <div className="lg:col-span-5 flex flex-col space-y-6">
            
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
                onClick={handleVideoModeClick}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 ${
                  mode === 'video' 
                    ? 'bg-gradient-to-br from-teal-500 to-teal-700 text-white shadow-lg' 
                    : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                }`}
              >
                {!isVideoUnlocked && (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                )}
                {isVideoUnlocked ? t('videoMode') : t('videoLocked')}
              </button>
            </div>

            {imagePreview ? (
              <SceneEditor 
                imageSrc={imagePreview}
                elements={sceneElements}
                onUpdateElementPosition={handleUpdateElementPosition}
                onRemoveElement={handleRemoveElement}
                onClearImage={() => {
                  saveHistory();
                  setUploadedImage(null);
                  setImagePreview(null);
                  setSceneElements([]);
                  setSelectedElementId(null);
                  setRenderHistory([]);
                  setActiveRenderId(null);
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
              isLoading={isGenerating} // Disable button if generating
              isImageUploaded={!!uploadedImage}
              mode={mode}
              
              mood={mood} setMood={setMood}
              profLighting={profLighting} setProfLighting={setProfLighting}
              profLandscaping={profLandscaping} setProfLandscaping={setProfLandscaping}
              enhanceRealism={false} setEnhanceRealism={() => {}}
              
              preserveLighting={preserveLighting} setPreserveLighting={setPreserveLighting}
              preserveView={preserveView} setPreserveView={setPreserveView}
              preserveBranding={preserveBranding} setPreserveBranding={setPreserveBranding}
              customPreservation={customPreservation} setCustomPreservation={setCustomPreservation}

              videoDuration={videoDuration} setVideoDuration={setVideoDuration}
              customDuration={customDuration} setCustomDuration={setCustomDuration}
              
              sceneElements={sceneElements}
              onAddElement={handleAddElement}
              onRemoveElement={handleRemoveElement}
              onDuplicateElement={handleDuplicateElement}
              
              onUpdateElementReferenceImage={handleUpdateElementReferenceImage}
              onRemoveElementReferenceImage={handleRemoveElementReferenceImage}
              
              onUpdateElementTemperature={handleUpdateElementTemperature}
              onUpdateElementPose={handleUpdateElementPose}
              onUpdateElementLightingPosition={handleUpdateLightingPosition}
              onUpdateElementDescription={handleUpdateElementDescription}

              savedCharacters={savedCharacters}
              onSaveCharacter={handleSaveCharacter}
              onDeleteSavedCharacter={handleDeleteSavedCharacter}

              globalReferences={globalReferences}
              onAddGlobalReference={handleAddGlobalReference}
              onDeleteGlobalReference={handleDeleteGlobalReference}
              onSelectGlobalReferenceForElement={handleSelectGlobalReferenceForElement}
              
              selectedElementId={selectedElementId}
              onSelectElement={setSelectedElementId}
              
              language={language}
            />
          </div>

          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="bg-gray-900/50 rounded-2xl flex items-center justify-center min-h-[500px] p-6 border border-gray-800 shadow-2xl relative overflow-hidden flex-1">
               <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-teal-900/10 to-purple-900/10 pointer-events-none" />

              <div className="relative z-10 w-full flex flex-col items-center justify-center">
                {globalError && <ErrorDisplay message={globalError} />}
                
                {viewerContent}
                
              </div>
            </div>

            {renderHistory.length > 0 && (
              <div className="w-full">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">
                  {t('renderHistory')} ({renderHistory.length})
                </h3>
                <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
                  {renderHistory.map((item) => {
                    const isActive = item.id === activeRenderId;
                    const isPending = item.status === 'pending';
                    const isFailed = item.status === 'failed';

                    return (
                    <div 
                      key={item.id}
                      onClick={() => handleSelectHistoryItem(item)}
                      className={`flex-shrink-0 w-32 cursor-pointer group relative rounded-lg overflow-hidden border-2 transition-all duration-200
                        ${isActive
                          ? (isFailed ? 'border-red-500 shadow-lg scale-105' : 'border-teal-500 shadow-lg scale-105')
                          : 'border-gray-700 hover:border-gray-500 opacity-70 hover:opacity-100'
                        }`}
                    >
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
                        {isPending ? (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 relative">
                                {item.thumbnail && <img src={item.thumbnail} className="absolute inset-0 w-full h-full object-cover opacity-30 blur-sm" alt="pending" />}
                                <div className="z-10 animate-spin rounded-full h-6 w-6 border-t-2 border-teal-500"></div>
                                <span className="z-10 text-[8px] mt-1 text-teal-400 font-bold uppercase">{t('rendering')}</span>
                            </div>
                        ) : isFailed ? (
                            <div className="w-full h-full flex items-center justify-center bg-gray-900 text-red-500">
                                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        ) : (
                            <>
                                {item.type === 'image' ? (
                                    <img src={item.url!} alt="History" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gray-900 relative group-hover:bg-gray-800 transition-colors">
                                        <div className="absolute inset-0 bg-black/40"></div>
                                        <svg className="w-8 h-8 text-teal-500 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                        <div className="absolute top-1 right-1 z-10">
                                            <span className="bg-black/80 text-[10px] text-white px-1 rounded">Vid</span>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                      </div>
                      <div className="bg-gray-800 p-1 text-[10px] text-center text-gray-400">
                        {new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </div>
                    </div>
                  )})}
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
