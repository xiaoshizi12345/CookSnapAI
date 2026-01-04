
export interface Ingredient {
  name: string;
  amount: string;
  unit: string;
}

export interface Recipe {
  id: string;
  name: string;
  ingredients: Ingredient[];
  steps: string[];
  time: string;
  difficulty: 'Leicht' | 'Mittel' | 'Schwer';
  rating: number;
  reviewCount: number;
  cuisine: string;
  dietaryType: 'Vegan' | 'Vegetarisch' | 'Fleisch';
  image: string;
  isAiGenerated?: boolean;
  isImported?: boolean;
  sourceUrl?: string;
}

export interface ScanSession {
  id: string;
  imageUrl: string;
  detectedItems: string[];
  timestamp: number;
}

export interface PantryItem {
  id: string;
  name: string;
  category: 'Kühlschrank' | 'Gewürze';
}

export interface ShoppingItem {
  id: string;
  name: string;
  completed: boolean;
}

export type View = 'home' | 'scan' | 'recipe-list' | 'recipe-detail' | 'shopping-list' | 'create-recipe';
