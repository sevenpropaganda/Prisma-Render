
import React, { useRef, useState, useEffect, useCallback } from 'react';
import type { SceneElement, Language, ElementType, DrawingMode } from '../types';
import { getTranslation } from '../utils/translations';

interface SceneEditorProps {
  imageSrc: string;
  elements: SceneElement[];
  onUpdateElementPosition: (id: string, x: number, y: number, isEndPoint?: boolean) => void;
  onRemoveElement: (id: string) => void;
  onClearImage: () => void;
  onReplaceImage: (file: File) => void;
  language: Language;
  
  // Drawing props
  activeDrawingTool: { type: ElementType, subtype: string } | null;
  onDrawComplete: (start: {x: number, y: number}, end: {x: number, y: number}, points?: {x: number, y: number}[]) => void;
  
  // Undo/Redo props
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onInteractionStart: () => void;

  // Selection Props
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;
}

interface DragState {
  id: string;
  handle: 'start' | 'end';
}

interface ImageMetrics {
  width: number;
  height: number;
  top: number;
  left: number;
}

const SceneEditor: React.FC<SceneEditorProps> = ({
  imageSrc,
  elements,
  onUpdateElementPosition,
  onRemoveElement,
  onClearImage,
  onReplaceImage,
  language,
  activeDrawingTool,
  onDrawComplete,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onInteractionStart,
  selectedElementId,
  onSelectElement
}) => {
  const t = (key: string) => getTranslation(language, key);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null); 
  const imageRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [metrics, setMetrics] = useState<ImageMetrics>({ width: 0, height: 0, top: 0, left: 0 });

  // Drawing state
  const [drawingMode, setDrawingMode] = useState<DrawingMode>('line');
  const [isDrawing, setIsDrawing] = useState(false);
  const [tempLine, setTempLine] = useState<{startX: number, startY: number, currentX: number, currentY: number} | null>(null);
  const [tempPath, setTempPath] = useState<{x: number, y: number}[]>([]);

  // Zoom & Pan State
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{x: number, y: number}>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);

  // Refs for navigation to avoid stale state in event listeners
  const lastMousePosRef = useRef<{x: number, y: number} | null>(null);
  const lastTouchRef = useRef<{x: number, y: number} | null>(null);
  const lastPinchDistRef = useRef<number | null>(null);

  // Reset drawing mode when tool changes
  useEffect(() => {
    if (!activeDrawingTool) {
        setDrawingMode('line');
        setTempLine(null);
        setTempPath([]);
        setIsDrawing(false);
    }
  }, [activeDrawingTool]);

  // Keyboard Shortcuts for Undo/Redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        onUndo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
        e.preventDefault();
        onRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onUndo, onRedo]);

  // Calculate the actual rendered dimensions of the image
  const updateMetrics = useCallback(() => {
    if (!containerRef.current || !imageRef.current) return;

    const container = containerRef.current.getBoundingClientRect();
    const img = imageRef.current;
    
    if (!img.naturalWidth) return;

    const naturalRatio = img.naturalWidth / img.naturalHeight;
    const containerRatio = container.width / container.height;

    let renderWidth, renderHeight;

    if (containerRatio > naturalRatio) {
      // Container is wider than image (vertical constraint)
      renderHeight = container.height;
      renderWidth = renderHeight * naturalRatio;
    } else {
      // Container is taller than image (horizontal constraint)
      renderWidth = container.width;
      renderHeight = renderWidth / naturalRatio;
    }

    setMetrics({
      width: renderWidth,
      height: renderHeight,
      // Center the content box
      top: (container.height - renderHeight) / 2,
      left: (container.width - renderWidth) / 2
    });
  }, [imageSrc]);

  useEffect(() => {
    window.addEventListener('resize', updateMetrics);
    return () => window.removeEventListener('resize', updateMetrics);
  }, [updateMetrics]);

  // --- Coordinate Helpers ---

  const getRelativeCoords = (clientX: number, clientY: number) => {
    if (!contentRef.current) return { x: 0, y: 0 };
    const rect = contentRef.current.getBoundingClientRect();
    
    // Calculate position relative to the element's current visual box
    const x = Math.min(Math.max(0, clientX - rect.left), rect.width);
    const y = Math.min(Math.max(0, clientY - rect.top), rect.height);

    // Convert back to percentage
    const xPercent = (x / rect.width) * 100;
    const yPercent = (y / rect.height) * 100;

    return { x: xPercent, y: yPercent };
  };

  // Converts percentage coordinates (0-100) back to pixels for SVG polyline rendering
  const toSvgX = (x: number) => (x / 100) * (metrics.width || 0);
  const toSvgY = (y: number) => (y / 100) * (metrics.height || 0);

  // Generate smooth quadratic bezier path string from points
  const getSmoothPathData = (points: {x: number, y: number}[]) => {
      if (points.length === 0) return "";
      if (points.length === 1) return `M ${toSvgX(points[0].x)} ${toSvgY(points[0].y)}`;

      let d = `M ${toSvgX(points[0].x)} ${toSvgY(points[0].y)}`;
      
      for (let i = 1; i < points.length - 2; i++) {
          const p1 = points[i];
          const p2 = points[i + 1];
          // Midpoint logic for smooth curve
          const endX = (toSvgX(p1.x) + toSvgX(p2.x)) / 2;
          const endY = (toSvgY(p1.y) + toSvgY(p2.y)) / 2;
          // Control point is p1
          d += ` Q ${toSvgX(p1.x)} ${toSvgY(p1.y)} ${endX} ${endY}`;
      }

      // Handle last few points
      if (points.length > 2) {
        const last = points[points.length - 1];
        const secondLast = points[points.length - 2];
        d += ` Q ${toSvgX(secondLast.x)} ${toSvgY(secondLast.y)} ${toSvgX(last.x)} ${toSvgY(last.y)}`;
      } else {
        d += ` L ${toSvgX(points[1].x)} ${toSvgY(points[1].y)}`;
      }

      return d;
  };

  const getDistance = (touch1: React.Touch, touch2: React.Touch) => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // --- Mouse Navigation (Desktop) ---

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const zoomSensitivity = 0.001;
    const delta = -e.deltaY * zoomSensitivity;
    
    setZoom(prevZoom => {
      const newZoom = Math.min(Math.max(1, prevZoom + delta), 4);
      if (newZoom === 1) setPan({ x: 0, y: 0 });
      return newZoom;
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only handle left click for panning if not drawing/dragging
    if (e.button === 0 && !activeDrawingTool && !dragState) {
       setIsPanning(true);
       lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning && lastMousePosRef.current) {
      const dx = e.clientX - lastMousePosRef.current.x;
      const dy = e.clientY - lastMousePosRef.current.y;
      
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    lastMousePosRef.current = null;
  };

  // --- Touch Navigation (Mobile) ---

  const handleTouchStart = (e: React.TouchEvent) => {
    // If interacting with a pin or drawing, don't start nav
    if (dragState || isDrawing) return;

    if (e.touches.length === 1) {
      // Single touch = Pan
      if (!activeDrawingTool) {
         setIsPanning(true);
         lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    } else if (e.touches.length === 2) {
      // Multi touch = Pinch Zoom
      setIsPanning(false); // Stop panning to focus on zoom
      const dist = getDistance(e.touches[0], e.touches[1]);
      lastPinchDistRef.current = dist;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (dragState || isDrawing) return;

    if (e.touches.length === 1 && isPanning && lastTouchRef.current) {
        // Handle Pan
        const dx = e.touches[0].clientX - lastTouchRef.current.x;
        const dy = e.touches[0].clientY - lastTouchRef.current.y;
        
        setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
        lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        
    } else if (e.touches.length === 2 && lastPinchDistRef.current) {
        // Handle Zoom
        const dist = getDistance(e.touches[0], e.touches[1]);
        const scaleFactor = dist / lastPinchDistRef.current;
        
        setZoom(prevZoom => {
           const newZoom = Math.min(Math.max(1, prevZoom * scaleFactor), 4);
           return newZoom;
        });
        
        lastPinchDistRef.current = dist;
    }
  };

  const handleTouchEnd = () => {
    setIsPanning(false);
    lastTouchRef.current = null;
    lastPinchDistRef.current = null;
  };

  // --- Interaction Logic (Pins & Drawing) ---
  // We use Pointer Events for pins/drawing as they unify mouse/touch well for "clicking/dragging items"

  const handlePointerDown = (e: React.PointerEvent) => {
    if (activeDrawingTool) {
      const coords = getRelativeCoords(e.clientX, e.clientY);
      setIsDrawing(true);
      
      if (drawingMode === 'line') {
          setTempLine({
            startX: coords.x,
            startY: coords.y,
            currentX: coords.x,
            currentY: coords.y
          });
      } else {
          // Freehand
          setTempPath([{ x: coords.x, y: coords.y }]);
      }
      
      e.stopPropagation();
      // Capture pointer to track drawing even if cursor leaves container
      (e.target as Element).setPointerCapture(e.pointerId);
    } else if (!dragState) {
        // If not drawing and not dragging a specific pin, check if clicking background to deselect
        if (e.target === contentRef.current || e.target === imageRef.current?.nextElementSibling || (e.target as HTMLElement).tagName === 'IMG') {
            onSelectElement(null);
        }
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
     if (isDrawing) {
        const coords = getRelativeCoords(e.clientX, e.clientY);
        
        if (drawingMode === 'line' && tempLine) {
            setTempLine(prev => prev ? ({ ...prev, currentX: coords.x, currentY: coords.y }) : null);
        } else if (drawingMode === 'freehand') {
            // Add point if distance is sufficient to avoid clutter
            setTempPath(prev => {
                const last = prev[prev.length - 1];
                if (!last) return [{x: coords.x, y: coords.y}];
                const dx = coords.x - last.x;
                const dy = coords.y - last.y;
                if (dx*dx + dy*dy > 0.05) { // Threshold
                    return [...prev, {x: coords.x, y: coords.y}];
                }
                return prev;
            });
        }
        return;
     }

     if (dragState) {
        const coords = getRelativeCoords(e.clientX, e.clientY);
        onUpdateElementPosition(dragState.id, coords.x, coords.y, dragState.handle === 'end');
        return;
     }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDrawing && activeDrawingTool) {
      
      if (drawingMode === 'line' && tempLine) {
          onDrawComplete(
            { x: tempLine.startX, y: tempLine.startY },
            { x: tempLine.currentX, y: tempLine.currentY }
          );
      } else if (drawingMode === 'freehand' && tempPath.length > 1) {
          onDrawComplete(
              tempPath[0], // Start
              tempPath[tempPath.length-1], // End
              tempPath // Points
          );
      }

      setIsDrawing(false);
      setTempLine(null);
      setTempPath([]);
      (e.target as Element).releasePointerCapture(e.pointerId);
      return;
    }
    setDragState(null);
  };

  const handleResetZoom = (e: React.MouseEvent) => {
    e.stopPropagation();
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Helper for file/clear actions
  const handleReplaceClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    fileInputRef.current?.click();
  };
  
  const handleClearClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClearImage();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onReplaceImage(e.target.files[0]);
    }
  };

  const getIcon = (type: string) => {
    const iconClass = "w-5 h-5";
    switch (type) {
      case 'person': 
        return (
          <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        );
      case 'animal': 
        return (
           <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5-9a2 2 0 114 0 2 2 0 01-4 0zm6 0a2 2 0 114 0 2 2 0 01-4 0z" />
           </svg>
        );
      case 'vehicle': 
        return (
          <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        ); // Fallback to simpler or use specific car path
      case 'plant': 
        return (
          <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        );
      case 'lighting': 
        return (
          <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        );
      case 'furniture': 
        return (
          <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        );
      default: 
        return (
           <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
           </svg>
        );
    }
  };

  const cursorStyle = activeDrawingTool 
    ? 'cursor-crosshair' 
    : isPanning 
      ? 'cursor-grabbing' 
      : 'cursor-grab';

  return (
    <div className={`relative w-full rounded-lg overflow-hidden border-2 transition-colors duration-300 group bg-gray-900 shadow-2xl ${activeDrawingTool ? 'border-cyan-400 shadow-cyan-500/20' : 'border-teal-500/50'}`}>
      
      {/* 
         Outer Container - Viewport 
         Must respond to Mouse events for Desktop Nav and Touch events for Mobile Nav
      */}
      <div 
        ref={containerRef} 
        
        /* Desktop Navigation */
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        
        /* Mobile Navigation */
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        
        className={`relative w-full h-[500px] md:h-[600px] flex items-center justify-center bg-gray-950/50 select-none overflow-hidden ${cursorStyle}`}
        style={{ touchAction: 'none' }} /* CRITICAL: Disables browser default scrolling/zooming */
      >
        {/* Hidden Reference Image to calculate natural size */}
        <img 
            ref={imageRef}
            src={imageSrc}
            alt="Reference"
            className="absolute opacity-0 pointer-events-none w-0 h-0"
            onLoad={updateMetrics}
        />

        {/* 
            Content Box: Contains Image + SVG + Pins.
            We apply Zoom and Pan transforms here.
            Also handles Drawing/Pin Interaction via Pointer Events.
        */}
        <div 
            ref={contentRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            style={{ 
                width: metrics.width > 0 ? metrics.width : 'auto', 
                height: metrics.height > 0 ? metrics.height : 'auto',
                opacity: metrics.width > 0 ? 1 : 0,
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transition: isPanning ? 'none' : 'transform 0.1s ease-out' // Smooth zoom, instant pan
            }}
            className="relative will-change-transform"
        >
            {/* Visible Image */}
            <img 
                src={imageSrc} 
                alt="Scene Editor" 
                className="w-full h-full object-contain pointer-events-none select-none"
                draggable={false}
            />
            
            {/* SVG Overlay for Lines */}
            <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-10 overflow-visible">
            {elements.map(el => {
                const isSelected = el.id === selectedElementId;
                
                // Freehand Path
                if (el.points && el.points.length > 0) {
                     // Use smooth path data generator
                     const pathD = getSmoothPathData(el.points);
                     const isBacklit = el.lightingPosition === 'back';
                     
                     return (
                        <path
                            key={`path-${el.id}`}
                            d={pathD}
                            fill="none"
                            stroke={isSelected ? "#facc15" : (isBacklit ? "#c084fc" : "#2dd4bf")} // Yellow if selected
                            strokeWidth={(isSelected ? 5 : 3) / zoom}
                            strokeDasharray={!isSelected && isBacklit ? `${2/zoom},${2/zoom}` : (isSelected ? "0" : `${5/zoom},${5/zoom}`)}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className={`drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] ${isSelected ? 'drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]' : ''}`}
                        />
                     );
                } 
                // Straight Line
                else if (el.endX !== undefined && el.endY !== undefined) {
                    const isBacklit = el.lightingPosition === 'back';
                    return (
                        <line 
                            key={`line-${el.id}`}
                            x1={`${el.x}%`} 
                            y1={`${el.y}%`} 
                            x2={`${el.endX}%`} 
                            y2={`${el.endY}%`} 
                            stroke={isSelected ? "#facc15" : (isBacklit ? "#c084fc" : "#2dd4bf")} 
                            strokeWidth={(isSelected ? 5 : 3) / zoom} 
                            strokeDasharray={!isSelected && isBacklit ? `${2/zoom},${2/zoom}` : (isSelected ? "0" : `${5/zoom},${5/zoom}`)}
                            className={`drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] ${isSelected ? 'drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]' : ''}`}
                        />
                    );
                }
                return null;
            })}

            {/* Temporary Drawing */}
            {isDrawing && (
                <>
                {drawingMode === 'line' && tempLine && (
                    <line 
                        x1={`${tempLine.startX}%`} 
                        y1={`${tempLine.startY}%`} 
                        x2={`${tempLine.currentX}%`} 
                        y2={`${tempLine.currentY}%`} 
                        stroke="#22d3ee" 
                        strokeWidth={4 / zoom}
                        strokeDasharray="0"
                        className="drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]"
                    />
                )}
                {drawingMode === 'freehand' && tempPath.length > 0 && (
                     <path
                        d={getSmoothPathData(tempPath)}
                        fill="none"
                        stroke="#22d3ee"
                        strokeWidth={4 / zoom}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]"
                    />
                )}
                </>
            )}
            </svg>

            {/* Pins Overlay */}
            {elements.map((el) => {
            const isSelected = el.id === selectedElementId;
            const isLinear = (el.endX !== undefined && el.endY !== undefined) || (el.points && el.points.length > 0);
            const isFreehand = !!el.points;
            // Scale pins inversely so they stay the same visual size while zooming
            const pinScale = (isSelected ? 1.2 : 1) / zoom;
            
            // Dynamic bg color based on selection and type
            let bgClass = 'bg-teal-600/90';
            if (isSelected) {
                bgClass = 'bg-yellow-500/90 border-yellow-200';
            } else if (isLinear) {
                bgClass = el.lightingPosition === 'back' ? 'bg-purple-600/90' : 'bg-cyan-600/90';
            }

            return (
                <React.Fragment key={el.id}>
                {/* Start Handle */}
                <div
                    onPointerDown={(e) => {
                        // Prevent dragging existing pins if we are trying to draw a new one
                        if (activeDrawingTool) return;
                        e.stopPropagation(); 
                        onInteractionStart(); // Save history state before drag starts
                        setDragState({ id: el.id, handle: 'start' });
                        onSelectElement(el.id); // Select on click/drag start
                        (e.target as Element).setPointerCapture(e.pointerId);
                    }}
                    onPointerUp={(e) => {
                         setDragState(null);
                         (e.target as Element).releasePointerCapture(e.pointerId);
                    }}
                    style={{ 
                      left: `${el.x}%`, 
                      top: `${el.y}%`, 
                      touchAction: 'none',
                      transform: `translate(-50%, -100%) scale(${pinScale})` // Center on point, scale inverse
                    }}
                    className={`absolute w-10 h-10 flex flex-col items-center z-20 transition-all ${activeDrawingTool ? 'opacity-50' : 'cursor-move hover:brightness-110'} ${dragState?.id === el.id && dragState.handle === 'start' ? 'z-50 brightness-125' : (isSelected ? 'z-40' : 'z-30')}`}
                    title={t(el.subtype)}
                >
                    <div className={`text-white rounded-full p-1.5 shadow-[0_0_10px_rgba(0,0,0,0.5)] border-2 ${isSelected ? 'border-yellow-200 ring-2 ring-yellow-500/50' : 'border-white'} w-full h-full flex items-center justify-center text-sm backdrop-blur-sm transition-colors ${bgClass}`}>
                        {getIcon(el.type)}
                    </div>
                </div>

                {/* End Handle (Only if Linear AND not freehand) */}
                {isLinear && !isFreehand && (
                    <div
                    onPointerDown={(e) => {
                        if (activeDrawingTool) return;
                        e.stopPropagation();
                        onInteractionStart(); // Save history state before drag starts
                        setDragState({ id: el.id, handle: 'end' });
                        onSelectElement(el.id); // Select on click/drag start
                        (e.target as Element).setPointerCapture(e.pointerId);
                    }}
                    onPointerUp={(e) => {
                         setDragState(null);
                         (e.target as Element).releasePointerCapture(e.pointerId);
                    }}
                    style={{ 
                      left: `${el.endX}%`, 
                      top: `${el.endY}%`, 
                      touchAction: 'none',
                      transform: `translate(-50%, -50%) scale(${pinScale})`
                    }}
                    className={`absolute w-8 h-8 flex flex-col items-center z-20 transition-all ${activeDrawingTool ? 'opacity-50' : 'cursor-move hover:brightness-110'} ${dragState?.id === el.id && dragState.handle === 'end' ? 'z-50 brightness-125' : (isSelected ? 'z-40' : 'z-30')}`}
                    title={`Drag end point: ${t(el.subtype)}`}
                    >
                    <div className={`${isSelected ? 'bg-yellow-500/90 border-yellow-200 ring-2 ring-yellow-500/50' : (el.lightingPosition === 'back' ? 'bg-purple-500/90' : 'bg-cyan-500/90')} backdrop-blur-sm text-white rounded-full p-1 shadow-[0_0_10px_rgba(0,0,0,0.5)] border-2 border-white w-full h-full flex items-center justify-center`}>
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                    </div>
                )}
                </React.Fragment>
            );
            })}
        </div>
      </div>

      {/* Reset Zoom Button - Visible only when zoomed */}
      {zoom > 1 && (
        <button
          onClick={handleResetZoom}
          className="absolute bottom-3 right-3 z-50 flex items-center gap-2 bg-teal-900/90 text-teal-100 px-3 py-2 rounded-lg shadow-lg border border-teal-500/50 hover:bg-teal-800 transition-all animate-fade-in"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
          </svg>
          <span className="text-xs font-bold">{t('resetZoom')} ({Math.round(zoom * 100)}%)</span>
        </button>
      )}

      {/* Drawing Mode Toggle - Visible only when Drawing Tool Active */}
      {activeDrawingTool && (
         <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2">
            
            {/* Toggle Switch */}
            <div className="flex bg-gray-800 rounded-full p-1 border border-cyan-500 shadow-xl">
               <button
                  onClick={(e) => { e.stopPropagation(); setDrawingMode('line'); }}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 transition-all ${drawingMode === 'line' ? 'bg-cyan-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
               >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z" className="hidden"/> {/* Fallback */}
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4"/>
                  </svg>
                  {t('toolLine')}
               </button>
               <button
                  onClick={(e) => { e.stopPropagation(); setDrawingMode('freehand'); }}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 transition-all ${drawingMode === 'freehand' ? 'bg-cyan-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
               >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  {t('toolFreehand')}
               </button>
            </div>

            <div className="bg-cyan-600/90 text-white px-4 py-1.5 rounded-full shadow-lg border border-white/20 font-medium text-xs backdrop-blur-sm animate-bounce">
                {drawingMode === 'line' ? t('drawHint') : t('drawFreehandHint')}
            </div>
         </div>
      )}

      {/* Toolbar overlay */}
      <div className="absolute top-3 right-3 flex items-center space-x-2 z-50">
         {/* Undo/Redo Group */}
         <div className="flex bg-gray-800/80 rounded-full shadow-lg backdrop-blur-md border border-gray-600 p-1">
             <button
               onClick={(e) => { e.stopPropagation(); onUndo(); }}
               disabled={!canUndo}
               className="p-1.5 rounded-full hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-transparent text-white transition-colors"
               title={`${t('undo')} (Ctrl+Z)`}
             >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
             </button>
             <div className="w-px bg-gray-600 mx-1"></div>
             <button
               onClick={(e) => { e.stopPropagation(); onRedo(); }}
               disabled={!canRedo}
               className="p-1.5 rounded-full hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-transparent text-white transition-colors"
               title={`${t('redo')} (Ctrl+Y)`}
             >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
                </svg>
             </button>
         </div>

        <button 
          onClick={handleReplaceClick}
          className="bg-gray-800/80 hover:bg-teal-600 text-white p-2.5 rounded-full shadow-lg backdrop-blur-md transition-all border border-gray-600 hover:border-teal-400"
          title={t('replaceImage')}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
        <button 
          onClick={handleClearClick}
          className="bg-gray-800/80 hover:bg-red-600 text-white p-2.5 rounded-full shadow-lg backdrop-blur-md transition-all border border-gray-600 hover:border-red-400"
          title={t('removeImage')}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*" 
        onChange={handleFileChange} 
      />

      <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-medium text-teal-200 pointer-events-none border border-teal-900/50 shadow-lg z-40">
        {elements.length > 0 ? t('editorHint') : t('editorEmpty')} | {t('zoomHint')}
      </div>
    </div>
  );
};

export default SceneEditor;
