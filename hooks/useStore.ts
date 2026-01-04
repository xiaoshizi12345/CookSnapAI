
import { useState, useEffect } from 'react';
import { Recipe, PantryItem, ShoppingItem, View, ScanSession } from '../types';
import { INITIAL_RECIPES } from '../constants';

export const useStore = () => {
  const [view, setView] = useState<View>('home');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>(INITIAL_RECIPES);
  const [pantry, setPantry] = useState<PantryItem[]>([]); 
  const [scanSessions, setScanSessions] = useState<ScanSession[]>([]);
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);

  useEffect(() => {
    const savedPantry = localStorage.getItem('pantry');
    if (savedPantry) setPantry(JSON.parse(savedPantry));
    
    const savedShopping = localStorage.getItem('shopping');
    if (savedShopping) setShoppingList(JSON.parse(savedShopping));

    const savedRecipes = localStorage.getItem('recipes');
    if (savedRecipes) setRecipes(JSON.parse(savedRecipes));

    const savedSessions = localStorage.getItem('scanSessions');
    if (savedSessions) setScanSessions(JSON.parse(savedSessions));
  }, []);

  useEffect(() => {
    localStorage.setItem('pantry', JSON.stringify(pantry));
    localStorage.setItem('shopping', JSON.stringify(shoppingList));
    localStorage.setItem('recipes', JSON.stringify(recipes));
    localStorage.setItem('scanSessions', JSON.stringify(scanSessions));
  }, [pantry, shoppingList, recipes, scanSessions]);

  const addScanSession = (imageUrl: string, items: string[]) => {
    const newSession: ScanSession = {
      id: Math.random().toString(36).substr(2, 9),
      imageUrl,
      detectedItems: items,
      timestamp: Date.now()
    };
    setScanSessions(prev => [newSession, ...prev]);
  };

  const removeScanSession = (id: string) => {
    setScanSessions(prev => prev.filter(s => s.id !== id));
  };

  const addPantryItems = (items: string[], category: 'Kühlschrank' | 'Gewürze' = 'Kühlschrank') => {
    const newItems: PantryItem[] = items.map(name => ({
      id: Math.random().toString(36).substr(2, 9),
      name,
      category
    }));
    setPantry(prev => [...prev, ...newItems]);
  };

  const removePantryItem = (id: string) => {
    setPantry(prev => prev.filter(item => item.id !== id));
  };

  const allIngredients: string[] = Array.from(new Set([
    ...pantry.map(i => i.name.toLowerCase()),
    ...scanSessions.flatMap(s => s.detectedItems.map(item => item.toLowerCase()))
  ])).sort();

  const addToShoppingList = (name: string) => {
    if (shoppingList.some(item => item.name.toLowerCase() === name.toLowerCase())) return;
    const newItem: ShoppingItem = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      completed: false
    };
    setShoppingList(prev => [...prev, newItem]);
  };

  const removeShoppingItem = (id: string) => {
    setShoppingList(prev => prev.filter(item => item.id !== id));
  };

  const toggleShoppingItem = (id: string) => {
    setShoppingList(prev => prev.map(item => 
      item.id === id ? { ...item, completed: !item.completed } : item
    ));
  };

  const addRecipe = (recipe: Recipe) => {
    setRecipes(prev => [recipe, ...prev]);
  };

  const navigateTo = (newView: View, recipe?: Recipe) => {
    if (recipe) setSelectedRecipe(recipe);
    setView(newView);
    window.scrollTo(0, 0);
  };

  return {
    view,
    setView: navigateTo,
    selectedRecipe,
    recipes,
    pantry,
    scanSessions,
    shoppingList,
    allIngredients,
    addScanSession,
    removeScanSession,
    addPantryItems,
    removePantryItem,
    addToShoppingList,
    removeShoppingItem,
    toggleShoppingItem,
    addRecipe
  };
};
