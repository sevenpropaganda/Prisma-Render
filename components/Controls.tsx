
import React, { useState, useRef } from 'react';
import { 
  AspectRatio, 
  GenerationMode, 
  Mood, 
  SceneElement, 
  ElementType,
  SavedCharacter,
  Language,
  PEOPLE_OPTIONS,
  ANIMAL_OPTIONS,
  VEHICLE_OPTIONS,
  PLANT_OPTIONS,
  LIGHTING_OPTIONS,
  FURNITURE_OPTIONS,
  Pose,
  LightingPosition,
  GlobalReference
} from '../types';
import { getTranslation } from '../utils/translations';

interface ControlsProps {
  prompt: string;
  setPrompt: (prompt: string) => void;
  aspectRatio: AspectRatio;
  setAspectRatio: (ratio: AspectRatio) => void;
  onGenerate: () => void;
  isLoading: boolean;
  isImageUploaded: boolean;
  mode: GenerationMode;
  
  mood: Mood;
  setMood: (mood: Mood) => void;
  profLighting: boolean;
  setProfLighting: (val: boolean) => void;
  profLandscaping: boolean;
  setProfLandscaping: (val: boolean) => void;
  enhanceRealism: boolean;
  setEnhanceRealism: (val: boolean) => void;

  // Preservation Props
  preserveLighting: boolean;
  setPreserveLighting: (val: boolean) => void;
  preserveView: boolean;
  setPreserveView: (val: boolean) => void;
  preserveBranding: boolean;
  setPreserveBranding: (val: boolean) => void;
  customPreservation: string;
  setCustomPreservation: (val: string) => void;

  videoDuration: string;
  setVideoDuration: (val: string) => void;
  customDuration: string;
  setCustomDuration: (val: string) => void;

  sceneElements: SceneElement[];
  onAddElement: (type: ElementType, subtype: string, initialPos?: {x: number, y: number}) => void;
  onRemoveElement: (id: string) => void;
  onDuplicateElement: (id: string) => void;
  onUpdateElementReferenceImage: (id: string, file: File) => void;
  onRemoveElementReferenceImage: (id: string) => void;
  onUpdateElementTemperature: (id: string, temp: number) => void;
  onUpdateElementPose: (id: string, pose: Pose) => void;
  onUpdateElementLightingPosition: (id: string, position: LightingPosition) => void;
  onUpdateElementDescription: (id: string, desc: string) => void;

  // Library Props
  savedCharacters: SavedCharacter[];
  onSaveCharacter: (name: string, type: ElementType, description: string, referenceImage?: string) => void;
  onDeleteSavedCharacter: (id: string) => void;

  // Reference Props
  globalReferences: GlobalReference[];
  onAddGlobalReference: (files: FileList) => void;
  onDeleteGlobalReference: (id: string) => void;
  onSelectGlobalReferenceForElement: (elementId: string, refUrl: string) => void;
  
  // Selection Props
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;

  language: Language;
}

const moods: Mood[] = ['Original', 'Day', 'Sunny', 'Summer', 'Spring', 'Dusk', 'Night', 'Starry Night', 'Rainy'];

const ObjectManager: React.FC<{
  onAdd: (type: ElementType, desc: string, initialPos?: {x: number, y: number}) => void;
  savedCharacters: SavedCharacter[];
  onSave: (name: string, type: ElementType, description: string, referenceImage?: string) => void;
  onDeleteSaved: (id: string) => void;
  language: Language;
  // Reference Props
  globalReferences: GlobalReference[];
  onAddGlobalReference: (files: FileList) => void;
  onDeleteGlobalReference: (id: string) => void;
}> = ({ onAdd, savedCharacters, onSave, onDeleteSaved, language, globalReferences, onAddGlobalReference, onDeleteGlobalReference }) => {
  const t = (key: string) => getTranslation(language, key);
  const [activeTab, setActiveTab] = useState<'preset' | 'custom' | 'library' | 'references'>('preset');
  const [selectedType, setSelectedType] = useState<ElementType>('person');
  const refFileInput = useRef<HTMLInputElement>(null);
  
  // Preset State
  const [selectedPreset, setSelectedPreset] = useState(PEOPLE_OPTIONS[0]);
  const [quantity, setQuantity] = useState(1);

  // Custom State
  const [customDesc, setCustomDesc] = useState('');
  const [saveName, setSaveName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Library State
  const [selectedSavedId, setSelectedSavedId] = useState<string>('');

  const getOptions = (type: ElementType) => {
    switch(type) {
      case 'person': return PEOPLE_OPTIONS;
      case 'animal': return ANIMAL_OPTIONS;
      case 'vehicle': return VEHICLE_OPTIONS;
      case 'plant': return PLANT_OPTIONS;
      case 'lighting': return LIGHTING_OPTIONS;
      case 'furniture': return FURNITURE_OPTIONS;
      default: return [];
    }
  };

  const handleAddPreset = () => {
    // If person type, handle quantity logic
    if (selectedType === 'person' && quantity > 1) {
        for (let i = 0; i < quantity; i++) {
            // Offset logic: Center is 50. 
            // If 2 people: 48, 52
            // If 3 people: 46, 50, 54
            const offset = (i - (quantity - 1) / 2) * 4; // 4% gap
            onAdd(selectedType, selectedPreset, { x: 50 + offset, y: 50 });
        }
    } else {
        onAdd(selectedType, selectedPreset);
    }
    setQuantity(1); // Reset quantity after add
  };

  const handleAddCustom = () => {
    if (!customDesc.trim()) return;
    onAdd(selectedType, customDesc);
    setCustomDesc('');
  };

  const handleSaveCustom = () => {
    if (!customDesc.trim() || !saveName.trim()) return;
    onSave(saveName, selectedType, customDesc);
    setIsSaving(false);
    setSaveName('');
    setActiveTab('library');
  };

  const handleAddFromLibrary = () => {
    const char = savedCharacters.find(c => c.id === selectedSavedId);
    if (char) {
      onAdd(char.type, char.description);
    }
  };

  const handleRefUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          onAddGlobalReference(e.target.files);
          // Clear input
          e.target.value = '';
      }
  };

  const filteredLibrary = savedCharacters.filter(c => c.type === selectedType);

  const getLabelForType = (type: ElementType) => {
    switch(type) {
        case 'person': return t('addPeople');
        case 'animal': return t('addAnimals');
        case 'vehicle': return t('addVehicles');
        case 'plant': return t('addPlants');
        case 'lighting': return t('addLighting');
        case 'furniture': return t('addFurniture');
    }
    return '';
  }

  return (
    <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700 space-y-4">
      
      {/* Type Selector */}
      <div className="flex flex-wrap gap-1 rounded-md bg-gray-800 p-1.5">
        {(['person', 'animal', 'vehicle', 'plant', 'lighting', 'furniture'] as ElementType[]).map(type => (
          <button
            key={type}
            onClick={() => { setSelectedType(type); setSelectedPreset(getOptions(type)[0]); }}
            className={`flex-1 min-w-[30px] text-[10px] md:text-xs py-1.5 rounded transition-colors ${selectedType === type ? 'bg-teal-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}
          >
            {getLabelForType(type)}
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700 overflow-x-auto">
        <button onClick={() => setActiveTab('preset')} className={`px-3 py-1 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'preset' ? 'border-teal-500 text-teal-400' : 'border-transparent text-gray-500'}`}>{t('presets')}</button>
        <button onClick={() => setActiveTab('custom')} className={`px-3 py-1 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'custom' ? 'border-teal-500 text-teal-400' : 'border-transparent text-gray-500'}`}>{t('custom')}</button>
        <button onClick={() => setActiveTab('library')} className={`px-3 py-1 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'library' ? 'border-teal-500 text-teal-400' : 'border-transparent text-gray-500'}`}>{t('library')} ({filteredLibrary.length})</button>
        <button onClick={() => setActiveTab('references')} className={`px-3 py-1 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'references' ? 'border-teal-500 text-teal-400' : 'border-transparent text-gray-500'}`}>{t('references')} ({globalReferences.length})</button>
      </div>

      {/* Preset Tab */}
      {activeTab === 'preset' && (
        <div className="space-y-2">
            <div className="flex gap-2">
            <select 
                value={selectedPreset}
                onChange={(e) => setSelectedPreset(e.target.value)}
                className="flex-1 bg-gray-800 border border-gray-600 rounded-md text-sm px-2 text-gray-200"
            >
                {getOptions(selectedType).map(o => <option key={o} value={o}>{t(o)}</option>)}
            </select>
            <button onClick={handleAddPreset} className="bg-teal-600 hover:bg-teal-500 text-white px-3 py-1.5 rounded-md text-sm font-bold">+</button>
            </div>
            
            {/* Quantity Input for People */}
            {selectedType === 'person' && (
                <div className="flex items-center gap-2 bg-gray-800/50 p-2 rounded border border-gray-700">
                    <label className="text-xs text-gray-400">{t('quantity')}:</label>
                    <input 
                        type="number" 
                        min="1" 
                        max="10" 
                        value={quantity}
                        onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-14 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-white"
                    />
                    <span className="text-[10px] text-gray-500 italic flex-1 text-right">
                        {quantity > 1 ? t('multiplePinsHint') : ''}
                    </span>
                </div>
            )}
        </div>
      )}

      {/* Custom Tab */}
      {activeTab === 'custom' && (
        <div className="space-y-2">
          <input 
            type="text" 
            placeholder={t('describePrompt')}
            value={customDesc}
            onChange={(e) => setCustomDesc(e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded-md text-sm px-2 py-1.5 text-gray-200 placeholder-gray-500"
          />
          <div className="flex gap-2">
            <button onClick={handleAddCustom} disabled={!customDesc} className="flex-1 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white py-1.5 rounded-md text-sm font-medium">{t('addToScene')}</button>
            <button onClick={() => setIsSaving(!isSaving)} disabled={!customDesc} className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-md text-sm">
              {isSaving ? t('cancel') : t('save')}
            </button>
          </div>
          
          {isSaving && (
            <div className="flex gap-2 animate-fade-in mt-2 pt-2 border-t border-gray-700">
               <input 
                type="text" 
                placeholder={t('namePlaceholder')}
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                className="flex-1 bg-gray-800 border border-gray-600 rounded-md text-xs px-2 py-1 text-gray-200"
              />
              <button onClick={handleSaveCustom} className="bg-cyan-600 text-white text-xs px-3 py-1 rounded-md">{t('confirm')}</button>
            </div>
          )}
        </div>
      )}

      {/* Library Tab */}
      {activeTab === 'library' && (
        <div className="space-y-2">
          {filteredLibrary.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-2">{t('noSavedItems')}</p>
          ) : (
            <div className="flex gap-2">
              <select 
                value={selectedSavedId}
                onChange={(e) => setSelectedSavedId(e.target.value)}
                className="flex-1 bg-gray-800 border border-gray-600 rounded-md text-sm px-2 text-gray-200"
              >
                <option value="">{t('selectSaved')}</option>
                {filteredLibrary.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button onClick={handleAddFromLibrary} disabled={!selectedSavedId} className="bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-md text-sm font-bold">+</button>
            </div>
          )}
          {selectedSavedId && (
            <div className="flex justify-between items-center text-xs text-gray-400 bg-black/20 p-2 rounded">
               <span className="truncate max-w-[150px]">
                 {savedCharacters.find(c => c.id === selectedSavedId)?.description}
               </span>
               <button onClick={() => { onDeleteSaved(selectedSavedId); setSelectedSavedId(''); }} className="text-red-400 hover:text-red-300">{t('delete')}</button>
            </div>
          )}
        </div>
      )}

      {/* References Tab */}
      {activeTab === 'references' && (
          <div className="space-y-3">
              <button 
                  onClick={() => refFileInput.current?.click()}
                  className="w-full py-2 border border-dashed border-gray-500 hover:border-teal-500 rounded-md text-xs text-gray-400 hover:text-teal-400 transition-colors"
              >
                  {t('uploadMultiple')}
              </button>
              <input 
                  type="file" 
                  multiple 
                  accept="image/*" 
                  className="hidden" 
                  ref={refFileInput} 
                  onChange={handleRefUpload}
              />

              {globalReferences.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-2">{t('noReferences')}</p>
              ) : (
                  <div className="grid grid-cols-4 gap-2 max-h-32 overflow-y-auto custom-scrollbar">
                      {globalReferences.map(ref => (
                          <div key={ref.id} className="relative group aspect-square">
                              <img src={ref.url} alt="Reference" className="w-full h-full object-cover rounded border border-gray-700" />
                              <button 
                                  onClick={() => onDeleteGlobalReference(ref.id)}
                                  className="absolute top-0 right-0 bg-red-600 text-white p-0.5 rounded-bl opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                              </button>
                          </div>
                      ))}
                  </div>
              )}
          </div>
      )}
    </div>
  );
};

const ElementItem: React.FC<{
    element: SceneElement;
    isSelected: boolean;
    onSelect: () => void;
    onRemove: (id: string) => void;
    onDuplicate: (id: string) => void;
    onUpdateImage: (id: string, file: File) => void;
    onRemoveImage: (id: string) => void;
    onUpdateTemperature: (id: string, temp: number) => void;
    onUpdatePose: (id: string, pose: Pose) => void;
    onUpdateLightingPosition: (id: string, pos: LightingPosition) => void;
    onUpdateDescription: (id: string, desc: string) => void;
    globalReferences: GlobalReference[];
    onSelectGlobalReference: (elId: string, url: string) => void;
    savedCharacters: SavedCharacter[];
    onSaveCharacter: (name: string, type: ElementType, description: string, referenceImage?: string) => void;
    t: (key: string) => string;
}> = ({ element, isSelected, onSelect, onRemove, onDuplicate, onUpdateImage, onRemoveImage, onUpdateTemperature, onUpdatePose, onUpdateLightingPosition, onUpdateDescription, globalReferences, onSelectGlobalReference, savedCharacters, onSaveCharacter, t }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showRefMenu, setShowRefMenu] = useState(false);
    
    // Edit state
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(element.subtype);

    // Check if this specific configuration is already saved
    // We check type, description (subtype), and reference image equality
    const isSaved = savedCharacters.some(c => 
        c.type === element.type && 
        c.description === element.subtype && 
        c.referenceImage === element.referenceImage
    );

    const handleQuickSave = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isSaved) return;
        
        // Auto-generate name based on subtype and date
        const name = `${element.subtype} ${new Date().toLocaleTimeString()}`;
        onSaveCharacter(name, element.type, element.subtype, element.referenceImage);
    };

    const handleSaveEdit = () => {
        if (editValue.trim()) {
            onUpdateDescription(element.id, editValue);
        } else {
            setEditValue(element.subtype); // Revert if empty
        }
        setIsEditing(false);
    };

    const handleCancelEdit = () => {
        setEditValue(element.subtype);
        setIsEditing(false);
    };

    const getIcon = (type: string) => {
        const iconClass = "w-4 h-4";
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
                ); 
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
    
    // Check if it's an LED element for lighting position control
    const isLED = element.subtype.includes('LED');

    return (
        <div 
            onClick={onSelect}
            className={`flex items-center justify-between text-sm py-1.5 border-b border-gray-700/50 last:border-0 group px-2 rounded transition-colors cursor-pointer relative
                ${isSelected ? 'bg-teal-900/40 border border-teal-500/50' : 'text-gray-300 hover:bg-white/5 border-transparent'}
                ${showRefMenu ? 'z-50' : 'z-auto'}
            `}
        >
            <span className="flex items-center gap-2 truncate pr-2 flex-1">
                <span className={`${isSelected ? 'text-yellow-400' : 'text-teal-400'}`}>
                   {getIcon(element.type)}
                </span>
                
                {isEditing ? (
                    <div className="flex items-center gap-1 flex-1 min-w-0 mr-2" onClick={e => e.stopPropagation()}>
                        <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEdit();
                                if (e.key === 'Escape') handleCancelEdit();
                            }}
                            autoFocus
                            className="w-full bg-gray-900 border border-teal-500 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none"
                        />
                         <button onClick={handleSaveEdit} className="text-green-400 hover:text-green-300">
                             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                         </button>
                         <button onClick={handleCancelEdit} className="text-red-400 hover:text-red-300">
                             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                         </button>
                    </div>
                ) : (
                    <span 
                        className={`truncate ${isSelected ? 'text-white font-medium' : ''}`} 
                        title={element.subtype}
                        onDoubleClick={(e) => {
                             e.stopPropagation();
                             setIsEditing(true);
                        }}
                    >
                        {t(element.subtype)}
                    </span>
                )}
            </span>

            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                {/* Lighting Position for LEDs */}
                {isLED && (
                   <div className="relative">
                      <select 
                         value={element.lightingPosition || 'front'}
                         onChange={(e) => onUpdateLightingPosition(element.id, e.target.value as LightingPosition)}
                         className="bg-gray-800 text-gray-300 text-[10px] rounded border border-gray-600 px-1 py-0.5 focus:outline-none focus:border-teal-500 cursor-pointer max-w-[80px]"
                         title={t('lightingPos')}
                      >
                         <option value="front">{t('front')}</option>
                         <option value="back">{t('back')}</option>
                      </select>
                   </div>
                )}

                {/* Pose Selection for People */}
                {element.type === 'person' && element.pose && (
                   <div className="relative">
                      <select 
                         value={element.pose}
                         onChange={(e) => onUpdatePose(element.id, e.target.value as Pose)}
                         className="bg-gray-800 text-gray-300 text-[10px] rounded border border-gray-600 px-1 py-0.5 focus:outline-none focus:border-teal-500 cursor-pointer"
                         title={t('pose')}
                      >
                         <option value="auto">{t('auto')}</option>
                         <option value="standing">{t('standing')}</option>
                         <option value="sitting">{t('sitting')}</option>
                         <option value="lying">{t('lying')}</option>
                      </select>
                   </div>
                )}

                {/* Temperature Control for Lighting */}
                {element.type === 'lighting' && element.colorTemperature !== undefined && (
                    <div className="flex items-center gap-1 bg-gray-800 rounded px-1" title={t('colorTemperature')}>
                        <input 
                            type="number" 
                            className="w-12 bg-transparent text-right text-xs text-yellow-300 focus:outline-none"
                            value={element.colorTemperature}
                            onChange={(e) => onUpdateTemperature(element.id, parseInt(e.target.value) || 3000)}
                            min={1000}
                            max={10000}
                            step={100}
                        />
                        <span className="text-[10px] text-gray-500 select-none">K</span>
                    </div>
                )}

                {/* Reference Image Control */}
                <div className="relative group/image">
                    {element.referenceImage ? (
                        <>
                            <img 
                                src={element.referenceImage} 
                                alt="Ref" 
                                className="w-6 h-6 object-cover rounded border border-gray-500 cursor-pointer"
                                onClick={() => setShowRefMenu(!showRefMenu)}
                                title={t('replaceReference')}
                            />
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRemoveImage(element.id);
                                }}
                                className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-3 h-3 flex items-center justify-center text-[8px] opacity-0 group-hover/image:opacity-100 transition-opacity"
                                title={t('removeReference')}
                            >
                                ✕
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={() => setShowRefMenu(!showRefMenu)}
                            className="text-gray-500 hover:text-cyan-400 p-1 rounded"
                            title={t('uploadReference')}
                        >
                             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                             </svg>
                        </button>
                    )}

                    {/* Reference Selection Menu */}
                    {showRefMenu && (
                        <>
                            {/* Backdrop to close */}
                            <div className="fixed inset-0 z-40" onClick={() => setShowRefMenu(false)}></div>
                            
                            <div className="absolute right-0 top-8 z-50 bg-gray-800 border border-gray-600 rounded-lg shadow-xl w-48 p-2 space-y-2">
                                <button 
                                    className="w-full text-left text-xs text-white hover:bg-gray-700 p-1.5 rounded flex items-center gap-2"
                                    onClick={() => { fileInputRef.current?.click(); setShowRefMenu(false); }}
                                >
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                    {t('uploadReference')}
                                </button>
                                
                                {globalReferences.length > 0 && (
                                    <>
                                        <div className="h-px bg-gray-700 my-1"></div>
                                        <p className="text-[10px] text-gray-500 px-1">{t('selectFromLibrary')}:</p>
                                        <div className="grid grid-cols-3 gap-1 max-h-24 overflow-y-auto custom-scrollbar">
                                            {globalReferences.map(ref => (
                                                <img 
                                                    key={ref.id} 
                                                    src={ref.url} 
                                                    className="w-full aspect-square object-cover rounded cursor-pointer hover:border-teal-500 border border-transparent"
                                                    onClick={() => {
                                                        onSelectGlobalReference(element.id, ref.url);
                                                        setShowRefMenu(false);
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        </>
                    )}
                </div>
                
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*"
                    onChange={(e) => {
                        if (e.target.files?.[0]) {
                            onUpdateImage(element.id, e.target.files[0]);
                        }
                    }}
                />

                <div className="w-px h-3 bg-gray-700 mx-1"></div>

                 {/* Edit Name Button (Only if not editing) */}
                 {!isEditing && (
                    <button
                        onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
                        className="text-gray-500 hover:text-cyan-400 p-1 transition-colors"
                        title={t('editName')}
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </button>
                )}

                {/* Duplicate Button */}
                {!isEditing && (
                <button
                    onClick={(e) => { e.stopPropagation(); onDuplicate(element.id); }}
                    className="text-gray-500 hover:text-teal-400 p-1 transition-colors"
                    title={t('duplicateElement')}
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                </button>
                )}

                <div className="w-px h-3 bg-gray-700 mx-1"></div>

                {/* Save to Library Button */}
                {!isEditing && (
                <button 
                    onClick={handleQuickSave}
                    disabled={isSaved}
                    className={`p-1 transition-colors ${isSaved ? 'text-green-500 cursor-default' : 'text-gray-500 hover:text-cyan-400'}`}
                    title={isSaved ? t('saved') : t('saveToLibrary')}
                >
                    {isSaved ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                        </svg>
                    )}
                </button>
                )}

                <div className="w-px h-3 bg-gray-700 mx-1"></div>

                {!isEditing && (
                <button 
                    onClick={(e) => { e.stopPropagation(); onRemove(element.id); }}
                    className="text-gray-500 hover:text-red-400 p-1 transition-colors"
                    title={t('removeElement')}
                >
                    ✕
                </button>
                )}
            </div>
        </div>
    );
};

const Controls: React.FC<ControlsProps> = ({ 
  prompt, 
  setPrompt, 
  aspectRatio, 
  setAspectRatio, 
  onGenerate, 
  isLoading, 
  isImageUploaded,
  mode,
  mood, setMood,
  profLighting, setProfLighting,
  profLandscaping, setProfLandscaping,
  enhanceRealism, setEnhanceRealism,
  preserveLighting, setPreserveLighting,
  preserveView, setPreserveView,
  preserveBranding, setPreserveBranding,
  customPreservation, setCustomPreservation,
  videoDuration, setVideoDuration,
  customDuration, setCustomDuration,
  sceneElements,
  onAddElement,
  onRemoveElement,
  onDuplicateElement,
  onUpdateElementReferenceImage,
  onRemoveElementReferenceImage,
  onUpdateElementTemperature,
  onUpdateElementPose,
  onUpdateElementLightingPosition,
  onUpdateElementDescription,
  savedCharacters,
  onSaveCharacter,
  onDeleteSavedCharacter,

  // Reference Props
  globalReferences,
  onAddGlobalReference,
  onDeleteGlobalReference,
  onSelectGlobalReferenceForElement,

  selectedElementId,
  onSelectElement,
  language
}) => {
  const t = (key: string) => getTranslation(language, key);

  const availableRatios: AspectRatio[] = mode === 'video'
    ? ['16:9', '9:16']
    : ['Original', '16:9', '9:16', '1:1', '4:3', '3:4'];

  return (
    <div className="space-y-6 bg-gray-800/40 p-6 rounded-xl border border-gray-700">
      
      {/* 1. Base Prompt */}
      <div>
        <label htmlFor="prompt" className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
          {t('baseDescription')}
        </label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={2}
          className="w-full p-3 bg-gray-900 border border-gray-600 rounded-lg focus:ring-teal-500 focus:border-teal-500 text-sm placeholder-gray-600 transition-colors"
          placeholder={t('basePlaceholder')}
        />
      </div>

      {/* 2. Mood */}
      <div>
        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
          {t('atmosphere')}
        </label>
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
           <button
              onClick={() => setMood('Original')}
              className={`col-span-2 sm:col-span-1 px-1 py-2 text-[10px] md:text-xs font-bold rounded-md transition-all border
                ${mood === 'Original' 
                  ? 'bg-gradient-to-r from-purple-900/50 to-pink-900/50 border-purple-400 text-purple-200 shadow-[0_0_10px_rgba(168,85,247,0.3)]' 
                  : 'bg-gray-800 border-gray-600 text-gray-300 hover:border-gray-400'}`}
            >
              {t('keepOriginal')}
            </button>
          {moods.filter(m => m !== 'Original').map((m) => (
            <button
              key={m}
              onClick={() => setMood(m)}
              className={`px-1 py-2 text-[10px] md:text-xs font-medium rounded-md transition-all border
                ${mood === m 
                  ? 'bg-teal-900/50 border-teal-500 text-teal-300' 
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'}`}
            >
              {t(m)}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Enhancements (Realism Checkbox Removed) */}
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center space-x-2 cursor-pointer group">
          <input 
            type="checkbox" 
            checked={profLighting} 
            onChange={(e) => setProfLighting(e.target.checked)}
            className="w-4 h-4 rounded border-gray-600 text-teal-500 focus:ring-teal-500 bg-gray-700" 
          />
          <span className="text-sm text-gray-300 group-hover:text-teal-400">{t('proLighting')}</span>
        </label>
        
        <label className="flex items-center space-x-2 cursor-pointer group">
          <input 
            type="checkbox" 
            checked={profLandscaping} 
            onChange={(e) => setProfLandscaping(e.target.checked)}
            className="w-4 h-4 rounded border-gray-600 text-teal-500 focus:ring-teal-500 bg-gray-700" 
          />
          <span className="text-sm text-gray-300 group-hover:text-teal-400">{t('landscaping')}</span>
        </label>
      </div>

      {/* 4. Preservation Settings */}
      <div className="bg-black/20 p-3 rounded-lg border border-gray-700/50">
        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
          {t('preservation')}
        </label>
        <div className="space-y-2">
           <label className="flex items-center space-x-2 cursor-pointer group">
            <input 
              type="checkbox" 
              checked={preserveLighting} 
              onChange={(e) => setPreserveLighting(e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 text-cyan-500 focus:ring-cyan-500 bg-gray-700" 
            />
            <span className="text-sm text-gray-300 group-hover:text-cyan-400">{t('keepLightingFixtures')}</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer group">
            <input 
              type="checkbox" 
              checked={preserveView} 
              onChange={(e) => setPreserveView(e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 text-cyan-500 focus:ring-cyan-500 bg-gray-700" 
            />
            <span className="text-sm text-gray-300 group-hover:text-cyan-400">{t('keepExternalView')}</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer group">
            <input 
              type="checkbox" 
              checked={preserveBranding} 
              onChange={(e) => setPreserveBranding(e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 text-cyan-500 focus:ring-cyan-500 bg-gray-700" 
            />
            <span className="text-sm text-gray-300 group-hover:text-cyan-400">{t('keepBranding')}</span>
          </label>
          
          <div className="pt-1">
             <label className="text-xs text-gray-500 block mb-1">{t('keepCustom')}</label>
             <input
              type="text"
              value={customPreservation}
              onChange={(e) => setCustomPreservation(e.target.value)}
              placeholder={t('keepCustomPlaceholder')}
              className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-gray-200 focus:border-cyan-500"
             />
          </div>
        </div>
      </div>

      {/* 5. Scene Objects */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
           <span className="text-xs font-bold text-gray-400 uppercase">{t('sceneObjects')}</span>
           <span className="text-[10px] text-gray-500">{t('dragPins')}</span>
        </div>
        
        <ObjectManager 
          onAdd={onAddElement} 
          savedCharacters={savedCharacters}
          onSave={onSaveCharacter}
          onDeleteSaved={onDeleteSavedCharacter}
          language={language}
          globalReferences={globalReferences}
          onAddGlobalReference={onAddGlobalReference}
          onDeleteGlobalReference={onDeleteGlobalReference}
        />

        {/* Active Elements List */}
        {sceneElements.length > 0 && (
          <div className="mt-2 bg-black/20 rounded-md p-2 flex flex-col gap-1">
            {sceneElements.map(el => (
              <ElementItem 
                key={el.id} 
                element={el} 
                isSelected={selectedElementId === el.id}
                onSelect={() => onSelectElement(el.id)}
                onRemove={onRemoveElement} 
                onDuplicate={onDuplicateElement}
                onUpdateImage={onUpdateElementReferenceImage}
                onRemoveImage={onRemoveElementReferenceImage}
                onUpdateTemperature={onUpdateElementTemperature}
                onUpdatePose={onUpdateElementPose}
                onUpdateLightingPosition={onUpdateElementLightingPosition}
                onUpdateDescription={onUpdateElementDescription}
                globalReferences={globalReferences}
                onSelectGlobalReference={onSelectGlobalReferenceForElement}
                savedCharacters={savedCharacters}
                onSaveCharacter={onSaveCharacter}
                t={t}
              />
            ))}
          </div>
        )}
      </div>
      
      {/* 6. Video Duration (Only in Video Mode) */}
      {mode === 'video' && (
        <div className="border-t border-gray-700 pt-4">
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
            {t('videoDuration')}
          </label>
          <div className="flex gap-2">
             {['3', '5', '10'].map(dur => (
               <button
                  key={dur}
                  onClick={() => setVideoDuration(dur)}
                  className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors ${
                     videoDuration === dur
                     ? 'bg-teal-900/50 border-teal-500 text-teal-300' 
                     : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                  }`}
               >
                 {dur}s
               </button>
             ))}
             <button
                onClick={() => setVideoDuration('custom')}
                className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors ${
                   videoDuration === 'custom'
                   ? 'bg-teal-900/50 border-teal-500 text-teal-300' 
                   : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                }`}
             >
               {t('custom')}
             </button>
          </div>
          {videoDuration === 'custom' && (
            <input 
               type="number"
               min="1"
               max="15"
               value={customDuration}
               onChange={(e) => setCustomDuration(e.target.value)}
               placeholder={t('customDuration')}
               className="mt-2 w-full bg-gray-900 border border-gray-600 rounded-md p-1.5 text-sm text-white"
            />
          )}
        </div>
      )}

      {/* 7. Aspect Ratio */}
      <div className="flex items-center justify-between border-t border-gray-700 pt-4">
        <span className="text-sm font-medium text-gray-400">Aspect Ratio</span>
        <div className="flex bg-gray-900 rounded-md p-1">
          {availableRatios.map((r) => (
            <button
              key={r}
              onClick={() => setAspectRatio(r)}
              className={`px-3 py-1 text-xs rounded transition-colors ${aspectRatio === r ? 'bg-gray-700 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}
            >
              {r === 'Original' ? t('Original') : r}
            </button>
          ))}
        </div>
      </div>
      
      {/* Generate Button */}
      <button
        onClick={onGenerate}
        disabled={isLoading || !isImageUploaded}
        className="w-full relative overflow-hidden bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white font-bold py-3 px-4 rounded-lg transition duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-teal-500/20"
      >
         {isLoading 
          ? (mode === 'video' ? t('generating') : t('rendering')) 
          : (mode === 'video' ? t('generateAnim') : t('generateRender'))}
      </button>
    </div>
  );
};

export default Controls;
