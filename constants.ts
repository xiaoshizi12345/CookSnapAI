
import { Recipe } from './types';

export const INITIAL_RECIPES: Recipe[] = [
  {
    id: '1',
    name: 'Tomaten-Omelett',
    ingredients: [
      { name: 'Ei', amount: '2', unit: 'Stück' },
      { name: 'Tomate', amount: '1', unit: 'Stück' },
      { name: 'Zwiebel', amount: '0.5', unit: 'Stück' },
      { name: 'Salz', amount: '1', unit: 'Prise' }
    ],
    steps: [
      'Eier in einer Schüssel verquirlen.',
      'Tomaten und Zwiebeln klein schneiden.',
      'Zwiebeln in der Pfanne glasig dünsten, Tomaten hinzufügen.',
      'Eimasse darübergeben und stocken lassen.'
    ],
    time: '15 Min',
    difficulty: 'Leicht',
    rating: 4.8,
    reviewCount: 124,
    cuisine: 'Deutsch',
    dietaryType: 'Vegetarisch',
    image: 'https://images.unsplash.com/photo-1510629954389-c1e0da47d414?auto=format&fit=crop&q=80&w=800'
  },
  {
    id: '2',
    name: 'Mediterrane Pasta',
    ingredients: [
      { name: 'Pasta', amount: '200', unit: 'g' },
      { name: 'Knoblauch', amount: '2', unit: 'Zehen' },
      { name: 'Olivenöl', amount: '3', unit: 'EL' },
      { name: 'Chili', amount: '1', unit: 'Prise' }
    ],
    steps: [
      'Nudeln al dente kochen.',
      'Knoblauch in feine Scheiben schneiden.',
      'Öl in der Pfanne erhitzen, Knoblauch und Chili kurz anbraten.',
      'Pasta unterheben und mit etwas Nudelwasser vermengen.'
    ],
    time: '20 Min',
    difficulty: 'Leicht',
    rating: 4.5,
    reviewCount: 89,
    cuisine: 'Italienisch',
    dietaryType: 'Vegan',
    image: 'https://images.unsplash.com/photo-1473093226795-af9932fe5856?auto=format&fit=crop&q=80&w=800'
  }
];

export const CATEGORIES = {
  REFRIGERATOR: 'Kühlschrank',
  SPICES: 'Gewürze'
} as const;
