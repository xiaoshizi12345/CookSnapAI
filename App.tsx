
import React, { useRef, useState, useMemo, useCallback } from 'react';
import { Home, Camera, Book, ShoppingBag, Plus, Trash2, ChevronLeft, Star, Clock, Flame, Send, Check, ChefHat, Recycle, Image as ImageIcon, Loader2, Filter, Compass, Save, Sparkles, ListPlus, X, PlusCircle, MinusCircle, Upload, Download, ChevronDown, Award, Link as LinkIcon, ExternalLink, User, ChevronUp } from 'lucide-react';
import { useStore } from './hooks/useStore';
import { View, Recipe, Ingredient, ScanSession, ShoppingItem } from './types';
import { generateRecipeFromPantry, scanImageForIngredients, getChefAdvice, importRecipeFromUrl } from './services/geminiService';

const UNITS = ['g', 'ml', 'Stk.', 'TL', 'EL', 'Prise', 'Pkg.', 'Becher', 'Bund', 'Liter'];

/**
 * Liste von Zutaten, die für den Match-Score ignoriert werden.
 * Diese Zutaten sind "Standard" und sollten kein Match triggern.
 */
const TRIVIAL_INGREDIENTS = [
  'salz', 'pfeffer', 'wasser', 'leitungswasser', 'prise salz', 
  'öl', 'olivenöl', 'speiseöl', 'pflanzenöl', 'butter', 'margarine',
  'zucker', 'mehl'
];

/**
 * Präzise Matching-Logik zur Vermeidung von False-Positives.
 */
const checkAvailability = (ingredientName: string, pantry: string[]): boolean => {
  const target = ingredientName.toLowerCase().trim();
  if (!target) return false;

  return pantry.some(p => {
    const item = p.toLowerCase().trim();
    // Exakter Treffer
    if (item === target) return true;
    
    // Strenge Prüfung für kurze Wörter (verhindert "Ei" in "Fleisch")
    if (target.length <= 3 || item.length <= 3) {
      return item === target;
    }

    // Teil-Treffer nur bei eindeutigen Wortanfängen oder Wortenden
    // Verhindert willkürliche Substring-Matches
    const isFullWordMatch = new RegExp(`\\b${target}\\b`, 'i').test(item) || 
                           new RegExp(`\\b${item}\\b`, 'i').test(target);
    
    if (isFullWordMatch) return true;

    // Fallback für Pluralformen (e.g. "Tomate" vs "Tomaten")
    if (item.startsWith(target) && item.length <= target.length + 2) return true;
    if (target.startsWith(item) && target.length <= item.length + 2) return true;

    return false;
  });
};

const Logo: React.FC<{ className?: string }> = ({ className = "" }) => (
  <div className={`relative flex items-center justify-center ${className}`}>
    <div className="absolute inset-0 bg-emerald-100 rounded-full animate-pulse opacity-50"></div>
    <div className="relative p-3 bg-white rounded-full shadow-sm border border-emerald-50">
      <ChefHat size={32} className="text-emerald-600" strokeWidth={2.5} />
      <div className="absolute -bottom-1 -right-1 bg-emerald-600 text-white p-1 rounded-full border-2 border-white">
        <Recycle size={14} strokeWidth={3} />
      </div>
    </div>
  </div>
);

const App: React.FC = () => {
  const store = useStore();

  const renderView = () => {
    switch (store.view) {
      case 'home': return <HomeView store={store} />;
      case 'scan': return <ScanView store={store} />;
      case 'recipe-list': return <RecipeListView store={store} />;
      case 'recipe-detail': return <RecipeDetailView store={store} />;
      case 'shopping-list': return <ShoppingListView store={store} />;
      case 'create-recipe': return <CreateRecipeView store={store} />;
      default: return <HomeView store={store} />;
    }
  };

  return (
    <div className="min-h-screen max-w-md mx-auto relative shadow-2xl overflow-hidden flex flex-col bg-[#FDFCF8]">
      <main className="flex-1 overflow-y-auto scrollbar-hide pb-24">
        {renderView()}
      </main>
      
      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white/90 backdrop-blur-xl border-t border-emerald-50 py-4 px-6 flex justify-between items-center z-50 rounded-t-[2.5rem] shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
        <NavButton active={store.view === 'home'} onClick={() => store.setView('home')} icon={<Home size={26} strokeWidth={2.5} />} />
        <NavButton active={store.view === 'scan'} onClick={() => store.setView('scan')} icon={<Camera size={26} strokeWidth={2.5} />} />
        
        <div className="w-14" />
        
        <NavButton active={store.view === 'recipe-list' || store.view === 'recipe-detail' || store.view === 'create-recipe'} onClick={() => store.setView('recipe-list')} icon={<Book size={26} strokeWidth={2.5} />} />
        <NavButton active={store.view === 'shopping-list'} onClick={() => store.setView('shopping-list')} icon={<ShoppingBag size={26} strokeWidth={2.5} />} />
        
        <div className="absolute -top-7 left-1/2 -translate-x-1/2">
           <button 
            className="p-5 rounded-full shadow-xl transition-all active:scale-95 bg-white text-emerald-600 border-2 border-emerald-50 flex items-center justify-center"
            aria-label="Profil"
           >
             <User size={30} strokeWidth={3} />
           </button>
        </div>
      </nav>
    </div>
  );
};

const NavButton: React.FC<{ active: boolean, icon: React.ReactNode, onClick: () => void }> = ({ active, icon, onClick }) => (
  <button 
    onClick={(e) => {
      e.preventDefault();
      onClick();
    }}
    className={`p-4 transition-all active:scale-90 flex items-center justify-center ${active ? 'text-emerald-600' : 'text-gray-400 hover:text-emerald-400'}`}
  >
    {icon}
  </button>
);

// --- SCAN VIEW ---

const ScanView: React.FC<{ store: any }> = ({ store }) => {
  const [activeTab, setActiveTab] = React.useState<'Scan' | 'Zusammenfassung'>('Scan');
  const [isScanning, setIsScanning] = React.useState(false);
  const [manualInput, setManualInput] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setIsScanning(true);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const parts = base64.split(',');
      const cleanedBase64 = parts.length > 1 ? parts[1] : parts[0];
      const detected = await scanImageForIngredients(cleanedBase64);
      
      if (detected && detected.length > 0) {
        store.addScanSession(base64, detected);
      } else {
        alert("Entschuldigung, ich konnte keine Lebensmittel erkennen.");
      }
    } catch (error) {
      console.error("Analysis failed:", error);
      alert("Fehler bei der Bildanalyse.");
    } finally {
      setIsScanning(false);
      setPreviewUrl(null);
      URL.revokeObjectURL(objectUrl);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleManualAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      store.addPantryItems([manualInput.trim()]);
      setManualInput('');
      setShowManual(false);
    }
  };

  const triggerCamera = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="p-6 space-y-6 animate-in slide-in-from-bottom-10 duration-500">
      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" capture="environment" style={{ display: 'none' }} />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => store.setView('home')} className="p-2 text-gray-400 bg-white rounded-full shadow-sm active:scale-90 transition-transform">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-2xl font-black text-gray-800">Vorrat-Scan</h1>
        </div>
      </div>
      
      <div className="flex p-1 bg-gray-100 rounded-full">
        {(['Scan', 'Zusammenfassung'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-3 px-6 rounded-full text-sm font-bold transition-all ${activeTab === tab ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500'}`}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Scan' ? (
        <div className="space-y-6">
          <div onClick={!isScanning ? triggerCamera : undefined} className={`relative h-80 rounded-[3rem] border-4 border-dashed overflow-hidden flex flex-col items-center justify-center cursor-pointer transition-all active:scale-95 ${isScanning ? 'border-emerald-500 bg-black cursor-wait' : 'border-emerald-100 bg-white hover:border-emerald-300'}`}>
            {isScanning ? (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px]">
                 {previewUrl && <img src={previewUrl} className="absolute inset-0 w-full h-full object-cover opacity-60 grayscale-[0.5] contrast-125" alt="Scanning" />}
                 <div className="absolute inset-0 scan-grid opacity-30 pointer-events-none"></div>
                 <div className="scanner-line"></div>
                 <div className="relative z-30 flex flex-col items-center gap-4">
                    <div className="p-4 bg-white/20 backdrop-blur-md rounded-full"><Loader2 size={48} className="text-white animate-spin" /></div>
                    <div className="text-center px-6">
                      <p className="font-black text-white text-xl drop-shadow-md">KI analysiert...</p>
                      <p className="text-emerald-300 font-bold text-xs uppercase tracking-widest mt-1">Zutaten werden identifiziert</p>
                    </div>
                 </div>
              </div>
            ) : (
              <>
                <div className="p-6 bg-emerald-50 rounded-full text-emerald-600 mb-4 shadow-inner"><Camera size={48} strokeWidth={2.5} /></div>
                <p className="text-xl font-black text-gray-800">Foto aufnehmen</p>
                <p className="text-[12px] text-gray-400 mt-2 uppercase tracking-[0.2em] font-black">Intelligente Analyse</p>
              </>
            )}
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-black text-gray-800 px-2 flex items-center gap-2">
              <span className="w-1.5 h-5 bg-emerald-600 rounded-full"></span>
              Gescannte Zutaten
            </h2>
            <div className="space-y-4">
              {store.scanSessions.map((session: ScanSession) => (
                <div key={session.id} className="bg-white p-4 rounded-[2.5rem] border border-emerald-50 flex gap-5 animate-in slide-in-from-right-5 duration-300 shadow-sm relative overflow-hidden group">
                  <img src={session.imageUrl} className="w-24 h-24 rounded-3xl object-cover shrink-0 shadow-md" alt="Scan" />
                  <div className="flex-1 py-1">
                    <div className="flex flex-wrap gap-1.5">
                      {session.detectedItems.map((item, idx) => (
                        <span key={idx} className="bg-emerald-50 text-emerald-700 text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-tighter">{item}</span>
                      ))}
                    </div>
                    <p className="text-[10px] text-gray-300 font-black mt-3 uppercase tracking-widest flex items-center gap-1"><Clock size={10} /> {new Date(session.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <button onClick={() => store.removeScanSession(session.id)} className="absolute top-4 right-4 p-2 text-gray-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"><X size={20} /></button>
                </div>
              ))}
              {store.scanSessions.length === 0 && <div className="text-center py-16 bg-white/50 rounded-[2.5rem] border border-dashed border-gray-200"><p className="text-gray-300 font-bold italic">Noch keine Scans vorhanden.</p></div>}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="bg-emerald-50 p-6 rounded-[2.5rem] border border-emerald-100/50">
            <h2 className="text-sm font-black text-emerald-800 uppercase tracking-widest mb-4">Aktueller Bestand</h2>
            <div className="flex flex-wrap gap-2">
              {store.allIngredients.map((item: string) => (
                <div key={item} className="bg-white text-emerald-700 py-2.5 px-5 rounded-full font-black text-xs shadow-sm border border-emerald-100">{item}</div>
              ))}
              {store.allIngredients.length === 0 && <p className="text-emerald-600/50 text-sm font-bold italic">Dein Vorrat ist noch leer.</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {showManual ? (
              <form onSubmit={handleManualAdd} className="flex gap-2 animate-in slide-in-from-top-2 duration-300">
                <input autoFocus type="text" value={manualInput} onChange={(e) => setManualInput(e.target.value)} placeholder="Zutat eingeben..." className="flex-1 bg-white border-2 border-emerald-50 rounded-full px-6 py-4 font-black text-gray-800 outline-none shadow-sm focus:border-emerald-200 transition-colors" />
                <button type="submit" className="bg-emerald-600 text-white p-4 rounded-full shadow-lg active:scale-90 transition-transform"><Plus size={24}/></button>
              </form>
            ) : (
              <button onClick={() => setShowManual(true)} className="w-full bg-white border-2 border-emerald-50 py-5 rounded-[2rem] font-black text-gray-800 flex items-center justify-center gap-3 active:scale-95 transition-all shadow-sm"><Plus size={20} className="text-emerald-600" /> Manuell hinzufügen</button>
            )}
            <button onClick={() => store.setView('recipe-list')} className="w-full bg-emerald-600 text-white py-6 rounded-[2.5rem] font-black text-xl shadow-xl shadow-emerald-100 flex items-center justify-center gap-3 active:scale-95 transition-all"><Sparkles size={24} /> Rezeptvorschläge</button>
          </div>
        </div>
      )}
    </div>
  );
};

// --- RECIPE LIST VIEW ---

const RecipeListView: React.FC<{ store: any }> = ({ store }) => {
  const [filterType, setFilterType] = useState<string>('Alle');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  
  const pantryNames = store.allIngredients as string[];
  
  /**
   * Logiktreuer Match-Score:
   * 1. Basis-Zutaten (Salz, Wasser, etc.) werden aus der Rechnung entfernt.
   * 2. Nur wenn Core-Zutaten (Fleisch, Gemüse, Nudeln) vorhanden sind, steigt der Score.
   */
  const getMatchScore = useCallback((recipe: Recipe) => {
    if (pantryNames.length === 0) return 0;
    
    const ingredients = recipe.ingredients || [];
    // Filtere triviale Basis-Zutaten für die Prozentrechnung heraus
    const coreIngredients = ingredients.filter(i => !TRIVIAL_INGREDIENTS.includes(i.name.toLowerCase().trim()));
    
    // Wenn das Rezept nur aus trivialen Dingen bestehen würde (unwahrscheinlich), zeige 0
    if (coreIngredients.length === 0) return 0;

    const matches = coreIngredients.filter(ing => checkAvailability(ing.name, pantryNames));
    
    // Wenn keine Core-Zutat gematcht wurde, ist der Score IMMER 0% (auch wenn man Salz hat)
    if (matches.length === 0) return 0;

    return Math.round((matches.length / coreIngredients.length) * 100);
  }, [pantryNames]);

  const recipesWithScores = useMemo(() => {
    return (store.recipes as Recipe[] || []).map((r: Recipe) => ({ ...r, matchScore: getMatchScore(r) }))
      .sort((a: any, b: any) => b.matchScore - a.matchScore);
  }, [store.recipes, getMatchScore]);

  const filteredRecipes = useMemo(() => {
    return recipesWithScores.filter((r: any) => filterType === 'Alle' || r.dietaryType === filterType);
  }, [recipesWithScores, filterType]);

  const top5Recipes = useMemo(() => {
    return [...filteredRecipes].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 5);
  }, [filteredRecipes]);

  const handleImport = async () => {
    if (!importUrl.includes('chefkoch.de')) {
      alert("Aktuell unterstützen wir nur den Import von Chefkoch.de");
      return;
    }
    setIsImporting(true);
    try {
      const imported = await importRecipeFromUrl(importUrl);
      if (imported) {
        store.addRecipe(imported);
        setShowImportDialog(false);
        setImportUrl('');
        alert("Rezept erfolgreich importiert!");
      } else {
        alert("Import fehlgeschlagen. Bitte prüfe den Link.");
      }
    } catch (e) {
      alert("Ein Fehler ist aufgetreten.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="p-0 pb-6 animate-in fade-in duration-500">
      <div className="p-6 flex justify-between items-center bg-white/80 backdrop-blur-md sticky top-0 z-10 border-b border-emerald-50/50">
        <div className="flex items-center gap-3">
           <button onClick={() => store.setView('home')} className="p-2 text-gray-400 bg-white shadow-sm rounded-full active:scale-90 transition-transform"><ChevronLeft size={20} /></button>
           <h1 className="text-2xl font-black text-gray-800">Inspiration</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowImportDialog(true)} className="p-3 bg-emerald-50 text-emerald-600 rounded-full shadow-sm active:scale-90 transition-transform"><LinkIcon size={20} strokeWidth={3} /></button>
          <button onClick={() => store.setView('create-recipe')} className="p-3 bg-emerald-600 text-white rounded-full shadow-lg active:scale-90 transition-transform flex items-center gap-2"><Plus size={20} strokeWidth={3} /><span className="text-xs font-black uppercase hidden sm:block">Neu</span></button>
        </div>
      </div>

      {showImportDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-black text-gray-800">Chefkoch Import</h2>
              <button onClick={() => !isImporting && setShowImportDialog(false)} className="text-gray-300"><X size={24}/></button>
            </div>
            <p className="text-sm text-gray-500 font-bold">Füge einen Link von Chefkoch.de ein, um das Rezept inklusive Foto automatisch zu erfassen.</p>
            <div className="space-y-4">
              <input type="url" placeholder="https://www.chefkoch.de/..." value={importUrl} onChange={(e) => setImportUrl(e.target.value)} disabled={isImporting} className="w-full bg-gray-50 border-2 border-emerald-50 rounded-2xl px-4 py-4 font-bold text-sm outline-none focus:border-emerald-200" />
              <button onClick={handleImport} disabled={isImporting || !importUrl} className="w-full bg-emerald-600 text-white py-4 rounded-full font-black text-lg shadow-lg flex items-center justify-center gap-2 disabled:opacity-50">
                {isImporting ? <Loader2 size={24} className="animate-spin" /> : <><Download size={20} /> Importieren</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="px-6 py-4">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide -mx-6 px-6">
          {['Alle', 'Vegan', 'Vegetarisch', 'Fleisch'].map((type: string) => (
            <button key={type} onClick={() => setFilterType(type)} className={`whitespace-nowrap px-6 py-3 rounded-full font-black text-sm transition-all ${filterType === type ? 'bg-emerald-600 text-white shadow-md' : 'bg-white text-gray-500 border border-gray-100 hover:border-emerald-100'}`}>{type}</button>
          ))}
        </div>
      </div>

      {top5Recipes.length > 0 && (
        <section className="mb-10">
          <div className="px-6 mb-4 flex items-center justify-between"><h2 className="text-lg font-black text-gray-800 flex items-center gap-2 italic"><Award size={20} className="text-amber-500" /> Top 5 Favoriten</h2></div>
          <div className="flex gap-4 overflow-x-auto scrollbar-hide px-6 pb-2">
            {top5Recipes.map((recipe) => (
              <div key={recipe.id} onClick={() => store.setView('recipe-detail', recipe)} className="w-64 shrink-0 bg-white rounded-[2.5rem] border border-emerald-50 shadow-md relative overflow-hidden active:scale-95 transition-all">
                <div className="h-40 relative">
                  <img src={recipe.image} className="w-full h-full object-cover" alt={recipe.name} />
                  <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full flex items-center gap-1 shadow-sm"><Star size={12} fill="#fbbf24" className="text-amber-400" /><span className="text-[10px] font-black text-gray-800">{recipe.rating}</span></div>
                  {recipe.isImported && <div className="absolute bottom-3 left-3 bg-emerald-600 text-white px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest shadow-sm">Import</div>}
                </div>
                <div className="p-4 space-y-2">
                  <h3 className="font-black text-gray-800 line-clamp-1 text-sm leading-tight">{recipe.name}</h3>
                  <div className="flex items-center justify-between text-[10px] font-black text-gray-400 uppercase tracking-tighter"><span className="flex items-center gap-1"><Clock size={10} /> {recipe.time}</span><span className="text-emerald-500">{recipe.matchScore}% Match</span></div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="px-6 space-y-4">
        <h2 className="text-lg font-black text-gray-800 px-1 mb-2">Alle Entdeckungen</h2>
        {filteredRecipes.map((recipe: any) => (
          <div key={recipe.id} onClick={() => store.setView('recipe-detail', recipe)} className="flex flex-col gap-4 p-5 bg-white rounded-[2.5rem] border border-emerald-50/50 shadow-sm active:scale-[0.98] transition-all cursor-pointer relative overflow-hidden group hover:border-emerald-200">
            <div className="flex gap-4">
              <div className="w-24 h-24 rounded-3xl overflow-hidden shrink-0 shadow-sm border border-emerald-50 relative">
                <img src={recipe.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={recipe.name} />
                {recipe.isImported && <div className="absolute top-1 right-1 p-1 bg-emerald-600 rounded-full text-white shadow-sm"><LinkIcon size={10} /></div>}
              </div>
              <div className="flex-1 flex flex-col justify-between py-1">
                <div>
                  <div className="flex justify-between items-start">
                    <h3 className="font-black text-gray-800 leading-tight pr-4 line-clamp-1">{recipe.name}</h3>
                    <div className="flex gap-1">{recipe.isAiGenerated && <Sparkles size={14} className="text-emerald-500 mt-0.5 shrink-0" />}</div>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className={`w-2 h-2 rounded-full ${recipe.matchScore > 70 ? 'bg-emerald-500' : recipe.matchScore > 30 ? 'bg-orange-400' : 'bg-gray-300'}`} />
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">{recipe.matchScore}% Übereinstimmung</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[10px] font-black text-gray-400">
                  <div className="flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded-full"><Clock size={12} /> {recipe.time}</div>
                  <div className="flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-full"><Star size={12} fill="#fbbf24" className="text-amber-400" /> {recipe.rating}</div>
                </div>
              </div>
            </div>
          </div>
        ))}
        {filteredRecipes.length === 0 && <div className="text-center py-24 flex flex-col items-center gap-4"><div className="p-6 bg-gray-50 rounded-full text-gray-200"><Compass size={48} /></div><p className="text-gray-300 font-bold italic">Keine passenden Rezepte gefunden.</p></div>}
      </div>
    </div>
  );
};

// --- RECIPE DETAIL VIEW ---

const RecipeDetailView: React.FC<{ store: any }> = ({ store }) => {
  const recipe = store.selectedRecipe as Recipe;
  const [showShoppingCheck, setShowShoppingCheck] = useState(false);

  if (!recipe) return null;

  const pantryNames = store.allIngredients as string[];
  const missingIngredients = (recipe.ingredients || []).filter((ing: Ingredient) => 
    !checkAvailability(ing.name, pantryNames)
  );

  return (
    <div className="animate-in slide-in-from-bottom-20 duration-500 pb-12">
      <div className="relative h-96 rounded-b-[4rem] overflow-hidden shadow-2xl">
        <img src={recipe.image} className="w-full h-full object-cover" alt={recipe.name} />
        <button onClick={() => store.setView('recipe-list')} className="absolute top-10 left-6 p-4 bg-white/95 backdrop-blur-md rounded-full text-gray-800 shadow-xl active:scale-90 transition-transform"><ChevronLeft size={24} strokeWidth={3} /></button>
      </div>

      <div className="p-8 space-y-10">
        <div>
          <div className="flex items-center gap-3 mb-4">
            {recipe.isAiGenerated && <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5"><Sparkles size={12} /> KI Generiert</span>}
            {recipe.isImported && <span className="bg-emerald-600 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-sm"><LinkIcon size={12} /> Importiert</span>}
            <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">{recipe.cuisine}</span>
          </div>
          <h1 className="text-4xl font-black text-gray-800 mb-6 leading-tight">{recipe.name}</h1>
          <div className="flex justify-between items-center bg-emerald-50 p-8 rounded-[3rem] shadow-inner">
            <div className="flex flex-col items-center"><Clock className="text-emerald-600 mb-1" size={24} /><span className="text-sm font-black text-gray-800">{recipe.time}</span></div>
            <div className="w-px h-10 bg-emerald-200" /><div className="flex flex-col items-center"><Star className="text-amber-400 mb-1" size={24} fill="currentColor" /><span className="text-sm font-black text-gray-800">{recipe.rating}</span></div>
            <div className="w-px h-10 bg-emerald-200" /><div className="flex flex-col items-center"><Flame className="text-orange-500 mb-1" size={24} /><span className="text-sm font-black text-gray-800">{recipe.difficulty}</span></div>
          </div>
        </div>

        <button onClick={() => setShowShoppingCheck(true)} className="w-full bg-emerald-600 text-white py-6 rounded-[2.5rem] font-black text-xl flex items-center justify-center gap-3 active:scale-95 transition-all shadow-xl shadow-emerald-100"><ListPlus size={24} /> Einkaufsliste erstellen</button>

        {showShoppingCheck && (
          <div className="bg-orange-50 p-6 rounded-[2.5rem] border border-orange-100 animate-in slide-in-from-top-4 duration-300 shadow-sm">
            <div className="flex justify-between items-center mb-5"><h2 className="text-lg font-black text-orange-800">Was dir fehlt</h2><button onClick={() => setShowShoppingCheck(false)} className="text-orange-300 active:scale-90 transition-transform"><X size={24}/></button></div>
            <div className="space-y-3">
              {missingIngredients.length > 0 ? (
                <>
                  {missingIngredients.map((ing, i) => (
                    <div key={i} className="flex justify-between items-center bg-white p-4 rounded-3xl shadow-sm border border-orange-100/50"><span className="font-black text-orange-900">{ing.name}</span><button onClick={() => store.addToShoppingList(ing.name)} className="bg-orange-500 text-white p-2.5 rounded-full active:scale-90 shadow-md shadow-orange-100"><Plus size={18} /></button></div>
                  ))}
                  <button onClick={() => { missingIngredients.forEach(i => store.addToShoppingList(i.name)); alert("Alle fehlenden Zutaten zur Liste hinzugefügt!"); setShowShoppingCheck(false); }} className="w-full bg-orange-600 text-white py-5 rounded-full font-black text-lg mt-4 shadow-xl shadow-orange-200 active:scale-95 transition-all">Alle hinzufügen</button>
                </>
              ) : (
                <div className="py-4 text-center"><p className="text-emerald-700 font-black italic">Du hast bereits alles im Vorrat! ✨</p></div>
              )}
            </div>
          </div>
        )}

        <section>
          <h2 className="text-2xl font-black text-gray-800 mb-6 flex items-center gap-3"><span className="w-2 h-7 bg-emerald-600 rounded-full"></span>Zutaten</h2>
          <div className="grid grid-cols-1 gap-3">
            {recipe.ingredients.map((ing, idx) => {
              const isMissing = !checkAvailability(ing.name, pantryNames);
              return (
                <div key={idx} className={`flex justify-between items-center p-4 rounded-3xl border ${isMissing ? 'bg-white border-orange-50' : 'bg-emerald-50/20 border-emerald-50'}`}>
                  <div className="flex items-center gap-4"><div className={`w-3 h-3 rounded-full ${isMissing ? 'bg-orange-400 shadow-md shadow-orange-100' : 'bg-emerald-500 shadow-md shadow-emerald-100'}`} /><span className={`font-bold text-lg ${isMissing ? 'text-gray-400' : 'text-gray-800'}`}>{ing.name}</span></div>
                  <span className={`font-black ${isMissing ? 'text-gray-300' : 'text-emerald-600'}`}>{ing.amount} {ing.unit}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="pb-8">
          <h2 className="text-2xl font-black text-gray-800 mb-6 flex items-center gap-3"><span className="w-2 h-7 bg-emerald-600 rounded-full"></span>Zubereitung</h2>
          <div className="space-y-8">
            {recipe.steps.map((step, idx) => (
              <div key={idx} className="flex gap-6 relative">
                <div className="flex flex-col items-center"><div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0"><span className="text-emerald-600 font-black text-lg">{idx + 1}</span></div>{idx !== recipe.steps.length - 1 && <div className="w-0.5 flex-1 bg-emerald-50 my-2" />}</div>
                <p className="text-gray-700 font-semibold leading-relaxed text-lg pt-1">{step}</p>
              </div>
            ))}
          </div>
        </section>

        {recipe.isImported && recipe.sourceUrl && (
          <div className="mt-8 p-6 bg-emerald-50 rounded-[2rem] border border-emerald-100 flex items-center justify-between"><div className="space-y-1"><p className="text-xs font-black text-emerald-800 uppercase tracking-widest">Original-Quelle</p><p className="text-sm font-bold text-emerald-600/80 truncate max-w-[200px]">{recipe.sourceUrl}</p></div><a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer" className="bg-white p-3 rounded-full text-emerald-600 shadow-sm active:scale-90 transition-transform"><ExternalLink size={20} /></a></div>
        )}
      </div>
    </div>
  );
};

// --- REMAINING VIEWS (Create, Home, Shopping) ---
const CreateRecipeView: React.FC<{ store: any }> = ({ store }) => {
  const [name, setName] = useState('');
  const [time, setTime] = useState('20 Min');
  const [difficulty, setDifficulty] = useState<'Leicht' | 'Mittel' | 'Schwer'>('Leicht');
  const [dietaryType, setDietaryType] = useState<'Vegan' | 'Vegetarisch' | 'Fleisch'>('Vegetarisch');
  const [ingredients, setIngredients] = useState<Ingredient[]>([{ name: '', amount: '', unit: 'Stk.' }]);
  const [steps, setSteps] = useState<string[]>(['']);
  const [image, setImage] = useState<string>('https://images.unsplash.com/photo-1495521821757-a1efb6729352?auto=format&fit=crop&q=80&w=800');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (!name.trim() || ingredients[0].name === '') {
      alert("Bitte gib zumindest einen Namen und eine Zutat an.");
      return;
    }
    const newRecipe: Recipe = { id: Math.random().toString(36).substr(2, 9), name, time, difficulty, dietaryType, ingredients: ingredients.filter(i => i.name !== ''), steps: steps.filter(s => s !== ''), rating: 5.0, reviewCount: 0, cuisine: 'Hausgemacht', image: image };
    store.addRecipe(newRecipe);
    store.setView('recipe-list');
  };

  return (
    <div className="p-6 space-y-8 animate-in slide-in-from-bottom-10 duration-500">
      <div className="flex items-center gap-4"><button onClick={() => store.setView('recipe-list')} className="p-2 text-gray-400 bg-white shadow-sm rounded-full active:scale-90 transition-transform"><ChevronLeft size={24} /></button><h1 className="text-2xl font-black text-gray-800">Neues Rezept</h1></div>
      <div className="space-y-6">
        <div className="space-y-2"><label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Rezeptfoto</label><div onClick={() => fileInputRef.current?.click()} className="relative h-60 w-full rounded-[3rem] overflow-hidden bg-gray-50 border-4 border-dashed border-emerald-100 cursor-pointer group active:scale-[0.98] transition-all"><img src={image} className="w-full h-full object-cover group-hover:opacity-75 transition-opacity" alt="Preview" /><div className="absolute inset-0 flex flex-col items-center justify-center text-emerald-600 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity"><Camera size={48} /><span className="font-black uppercase text-xs mt-2 tracking-widest">Foto ändern</span></div><input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" capture="environment" className="hidden" /></div></div>
        <div className="space-y-2"><label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Rezeptname</label><input type="text" placeholder="z.B. Omas Apfelkuchen" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-white border-2 border-emerald-50 rounded-[1.5rem] px-6 py-4 font-bold text-gray-800 outline-none focus:border-emerald-200 transition-colors shadow-sm" /></div>
        <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Zeit</label><input type="text" value={time} onChange={(e) => setTime(e.target.value)} className="w-full bg-white border-2 border-emerald-50 rounded-[1.5rem] px-6 py-4 font-bold text-gray-800 outline-none shadow-sm" /></div><div className="space-y-2"><label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Schwierigkeit</label><div className="relative"><select value={difficulty} onChange={(e) => setDifficulty(e.target.value as any)} className="w-full bg-white border-2 border-emerald-50 rounded-[1.5rem] px-6 py-4 font-bold text-gray-800 outline-none shadow-sm appearance-none pr-10"><option>Leicht</option><option>Mittel</option><option>Schwer</option></select><ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-600 pointer-events-none" size={20} /></div></div></div>
        <button onClick={handleSave} className="w-full bg-emerald-600 text-white py-6 rounded-[2.5rem] font-black text-xl shadow-xl shadow-emerald-100 flex items-center justify-center gap-3 active:scale-95 transition-all mt-4 mb-10"><Save size={24} /> Rezept speichern</button>
      </div>
    </div>
  );
};

const HomeView: React.FC<{ store: any }> = ({ store }) => (
  <div className="p-6 space-y-10 animate-in fade-in duration-500">
    <div className="flex flex-col items-center gap-5 py-6"><Logo className="w-20 h-20" /><div className="text-center space-y-2"><h2 className="text-4xl font-black text-gray-800 tracking-tight leading-tight">CookSnapAI</h2><p className="text-base font-bold text-emerald-600/80 px-4">Dein nachhaltiger Küchen-Assistent</p></div></div>
    <div className="relative h-72 rounded-[3.5rem] overflow-hidden shadow-2xl group active:scale-[0.98] transition-transform"><img src="https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&q=80&w=1000" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" alt="Hero" /><div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent p-10 flex flex-col justify-end"><h1 className="text-4xl font-black text-white italic drop-shadow-lg tracking-tight">Hallo Chef!</h1><p className="text-white/90 font-bold text-lg">Was zaubern wir heute?</p></div></div>
    <div className="space-y-12 pb-6"><div className="grid grid-cols-2 gap-5"><button onClick={() => store.setView('scan')} className="bg-white p-8 rounded-[3rem] shadow-sm border border-emerald-50 flex flex-col items-center gap-4 transition-all active:scale-95 text-center group hover:shadow-xl hover:shadow-emerald-50"><div className="p-5 bg-emerald-50 rounded-[2rem] text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300"><Camera size={36} strokeWidth={2.5} /></div><span className="font-black text-gray-800 text-lg">Vorrats-Check</span></button><button onClick={() => store.setView('recipe-list')} className="bg-white p-8 rounded-[3rem] shadow-sm border border-emerald-50 flex flex-col items-center gap-4 transition-all active:scale-95 text-center group hover:shadow-xl hover:shadow-emerald-50"><div className="p-5 bg-emerald-50 rounded-[2rem] text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300"><Book size={36} strokeWidth={2.5} /></div><span className="font-black text-gray-800 text-lg">Rezeptbuch</span></button></div><div className="flex justify-center pt-4"><div className="bg-emerald-600 text-white px-10 py-6 rounded-[2rem] shadow-[0_15px_40px_-10px_rgba(5,150,105,0.4)] transform -rotate-1 hover:rotate-0 transition-all duration-500 cursor-default border-2 border-emerald-400"><p className="text-base font-black tracking-widest uppercase italic text-center leading-relaxed">Nichts verschwenden,<br/><span className="text-2xl text-emerald-200">alles verwenden</span></p></div></div></div>
  </div>
);

const ShoppingListView: React.FC<{ store: any }> = ({ store }) => {
  const [inputValue, setInputValue] = useState('');
  const [showCompleted, setShowCompleted] = useState(true);
  const handleManualAdd = (e: React.FormEvent) => { e.preventDefault(); if (inputValue.trim()) { store.addToShoppingList(inputValue.trim()); setInputValue(''); } };
  const activeItems = useMemo(() => store.shoppingList.filter((item: ShoppingItem) => !item.completed), [store.shoppingList]);
  const completedItems = useMemo(() => store.shoppingList.filter((item: ShoppingItem) => item.completed), [store.shoppingList]);
  return (
    <div className="p-6 space-y-6 animate-in slide-in-from-bottom-20 duration-500 h-full flex flex-col"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><button onClick={() => store.setView('home')} className="p-2 text-gray-400 bg-white shadow-sm rounded-full active:scale-90 transition-transform"><ChevronLeft size={20} /></button><h1 className="text-2xl font-black text-gray-800 tracking-tight">Einkaufsliste</h1></div>{completedItems.length > 0 && <button onClick={() => { completedItems.forEach((item: ShoppingItem) => store.removeShoppingItem(item.id)); }} className="text-[10px] font-black text-red-400 uppercase tracking-widest bg-red-50 px-3 py-1.5 rounded-full flex items-center gap-1 active:scale-95 transition-all"><Trash2 size={12} /> Alles löschen</button>}</div>
      <form onSubmit={handleManualAdd} className="flex gap-2"><input type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder="Neu..." className="flex-1 bg-white border border-emerald-50 rounded-2xl px-5 py-3.5 font-bold text-gray-800 outline-none shadow-sm focus:border-emerald-200 transition-colors text-sm" /><button type="submit" className="bg-emerald-600 text-white px-5 rounded-2xl shadow-lg active:scale-90 transition-transform flex items-center justify-center"><Plus size={20} strokeWidth={3} /></button></form>
      <div className="space-y-8 overflow-y-auto scrollbar-hide pb-10"><div className="space-y-3"><h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2 px-1"><span className="w-5 h-[1px] bg-gray-200"></span>Noch zu besorgen ({activeItems.length})<span className="flex-1 h-[1px] bg-gray-200"></span></h2><div className="space-y-2">{activeItems.map((item: ShoppingItem) => <ShoppingItemRow key={item.id} item={item} store={store} />)}{activeItems.length === 0 && <div className="py-10 flex flex-col items-center justify-center bg-emerald-50/20 rounded-[2.5rem] border border-dashed border-emerald-100/50 opacity-60"><Check size={32} className="text-emerald-300 mb-2" /><p className="text-xs font-bold text-emerald-600 italic">Alles erledigt!</p></div>}</div></div>
      {completedItems.length > 0 && <div className="space-y-3"><button onClick={() => setShowCompleted(!showCompleted)} className="w-full text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2 px-1 hover:text-gray-600 transition-colors"><span className="w-5 h-[1px] bg-gray-200"></span>Erledigt ({completedItems.length}){showCompleted ? <ChevronUp size={12} /> : <ChevronDown size={12} />}<span className="flex-1 h-[1px] bg-gray-200"></span></button>{showCompleted && <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">{completedItems.map((item: ShoppingItem) => <ShoppingItemRow key={item.id} item={item} store={store} />)}</div>}</div>}</div>
      {store.shoppingList.length === 0 && <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-10 opacity-30 text-center"><ShoppingBag size={80} strokeWidth={1} className="text-gray-300 mb-4" /><p className="font-bold text-gray-400">Deine Einkaufsliste ist leer.</p></div>}
    </div>
  );
};

const ShoppingItemRow: React.FC<{ item: ShoppingItem, store: any }> = ({ item, store }) => (
  <div onClick={() => store.toggleShoppingItem(item.id)} className={`group flex justify-between items-center p-4 rounded-2xl bg-white border transition-all duration-300 cursor-pointer active:scale-[0.98] ${item.completed ? 'opacity-40 grayscale border-gray-100' : 'border-emerald-50 shadow-sm hover:border-emerald-200'}`}><div className="flex items-center gap-3"><div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${item.completed ? 'bg-emerald-600 border-emerald-600 text-white shadow-emerald-100 shadow-md' : 'border-emerald-200 bg-white text-transparent'}`}><Check size={14} strokeWidth={4} /></div><span className={`font-bold text-sm transition-all duration-300 ${item.completed ? 'line-through text-gray-500' : 'text-gray-800'}`}>{item.name}</span></div><button onClick={(e) => { e.stopPropagation(); store.removeShoppingItem(item.id); }} className="text-gray-200 hover:text-red-400 p-1.5 transition-colors active:scale-90"><Trash2 size={16} /></button></div>
);

export default App;
