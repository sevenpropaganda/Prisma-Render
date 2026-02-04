
export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | 'Original';
export type GenerationMode = 'video' | 'image';
export type Language = 'pt-BR' | 'en' | 'es';

export type Mood = 'Original' | 'Day' | 'Dusk' | 'Night' | 'Summer' | 'Spring' | 'Rainy' | 'Sunny' | 'Starry Night';

export type ElementType = 'person' | 'animal' | 'vehicle' | 'plant' | 'lighting' | 'furniture';

export type Pose = 'auto' | 'standing' | 'sitting' | 'lying';
export type DrawingMode = 'line' | 'freehand';
export type LightingPosition = 'front' | 'back';

export interface SceneElement {
  id: string;
  type: ElementType;
  subtype: string; // Used as the description/prompt
  x: number; // Percentage 0-100 (Start X or First Point X)
  y: number; // Percentage 0-100 (Start Y or First Point Y)
  endX?: number; // Percentage 0-100 (End X for linear elements)
  endY?: number; // Percentage 0-100 (End Y for linear elements)
  points?: {x: number, y: number}[]; // Array of points for freehand paths
  referenceImage?: string; // Base64 string of the reference image
  colorTemperature?: number; // Kelvin value (e.g., 3000, 4000, 6500)
  pose?: Pose; // Pose for people
  lightingPosition?: LightingPosition; // Front (Direct) or Back (Retro)
}

export interface SavedCharacter {
  id: string;
  name: string;
  type: ElementType;
  description: string;
  referenceImage?: string; // Optional reference image
}

export interface GlobalReference {
  id: string;
  url: string; // Base64
}

export interface RenderResult {
  id: string;
  url: string | null; // Null if pending
  type: GenerationMode;
  timestamp: number;
  thumbnail?: string; // Can be the input image for pending state
  status: 'pending' | 'completed' | 'failed';
}

// Changed to singular
export const PEOPLE_OPTIONS = ['Man', 'Woman', 'Child', 'Elderly', 'Business Person', 'Cyclist'];
export const ANIMAL_OPTIONS = ['Dog', 'Cat', 'Birds', 'Deer', 'Horse'];
export const VEHICLE_OPTIONS = ['Luxury Car', 'SUV', 'Sports Car', 'Motorcycle', 'Bus', 'Truck'];
export const PLANT_OPTIONS = ['Tree', 'Bush', 'Flower Bed', 'Grass', 'Potted Plant', 'Hanging Pot', 'Hedge', 'Palm Tree'];
export const LIGHTING_OPTIONS = ['Sconce', 'Spotlight', 'General Area Light', 'LED Strip', 'LED Profile'];
export const FURNITURE_OPTIONS = ['Bench', 'Chair', 'Table', 'Sofa', 'Sun Lounger', 'Parasol', 'Outdoor Dining Set', 'Trash Bin', 'Bollard'];
