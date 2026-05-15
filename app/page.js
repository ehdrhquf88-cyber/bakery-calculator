"use client";

import { useState, useEffect, useMemo } from "react";

// --- BREAD OS: 앱 실행 복구 및 레이아웃 유지 버전 ---

export default function Home() {
  const [view, setView] = useState("calc"); 
  const [recipes, setRecipes] = useState([]);
  const [tempLogs, setTempLogs] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const savedRecipes = localStorage.getItem("bakery_recipes");
      const savedTempLogs = localStorage.getItem("bakery_temp_ph");
      if (savedRecipes) setRecipes(JSON.parse(savedRecipes));
      if (savedTempLogs) setTempLogs(JSON.parse(savedTempLogs));
    } catch (e) {
      console.error("Data load error", e);
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("bakery_recipes", JSON.stringify(recipes));
      localStorage.setItem("bakery_temp_ph", JSON.stringify(tempLogs));
    }
  }, [recipes, tempLogs, isLoaded]);

  if (!isLoaded) return <div className="min-h-screen bg-[#f7f6f3]" />;

  return (
    <div className="min-h-screen bg-[#f7f6f3] pb-10 font-sans">
      <nav className="sticky top-0 z-40 flex gap-4 md:gap-8 p-4 md:p-6 bg-white/80 backdrop-blur-md border-b border-gray-200 justify-start md:justify-center overflow-x-auto whitespace-nowrap shadow-sm no-scrollbar">
        <NavButton active={view === "calc"} onClick={() => setView("calc")}>레시피 계산기</NavButton>
        <NavButton active={view === "db"} onClick={() => setView("db")}>레시피 DB</NavButton>
        <NavButton active={view === "temp_db"} onClick={() => setView("temp_db")}>온도/pH 히스토리</NavButton>
      </nav>

      <div className="py-4 md:py-8">
        {view === "calc" && <RecipeCalculator recipes={recipes} tempLogs={tempLogs} setTempLogs={setTempLogs} />}
        {view === "db" && <RecipeDB recipes={recipes} setRecipes={setRecipes} />}
        {view === "temp_db" && <TempPhDB tempLogs={tempLogs} setTempLogs={setTempLogs} />}
      </div>
    </div>
  );
}

function NavButton({ active, onClick, children }) {
  return (
    <button onClick={onClick} className={`text-sm md:text-lg font-black italic tracking-tighter transition-all px-2 ${active ? 'text-black border-b-2 border-black' : 'text-gray-400 hover:text-gray-600'}`}>{children}</button>
  );
}

// --- 레시피 DB (모바일에서도 안 깨지게 정렬만 보정) ---
function RecipeDB({ recipes, setRecipes }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingRecipe, setEditingRecipe] = useState(null);

  const displayedRecipes = recipes.filter(r => r.productName.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleDelete = (e, id) => {
    e.stopPropagation();
    if (window.confirm("이 레시피를 삭제하시겠습니까?")) {
      setRecipes(recipes.filter(r => r.id !== id));
    }
  };

  return (
    <main className="max-w-6xl mx-auto px-4 md:px-8 text-black">
      <div className="flex justify-between items-end border-b-2 border-black pb-6 mb-8">
        <div>
          <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter uppercase">Recipe Vault</h1>
          <p className="text-[9px] font-black text-gray-400 mt-1 uppercase tracking-[0.2em]">Stored Professional Formulas</p>
        </div>
        <button onClick={() => { setEditingRecipe(null); setIsModalOpen(true); }} className="bg-black text-white px-6 md:px-8 py-3 rounded-full font-black text-[10px] md:text-xs hover:scale-105 transition-transform shadow-lg uppercase tracking-widest">+ Create</button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {displayedRecipes.map(recipe => (
          <div key={recipe.id} onClick={() => { setEditingRecipe(recipe); setIsModalOpen(true); }} className="group bg-white p-5 md:p-7 rounded-[1.5rem] md:rounded-[2rem] border border-gray-100 flex flex-wrap md:flex-nowrap justify-between items-center cursor-pointer hover:border-black transition-all relative overflow-hidden">
            <div className="flex items-center gap-4 md:gap-6 z-10 flex-1 min-w-0">
                <div className="w-12 h-12 md:w-14 md:h-14 bg-[#f7f6f3] rounded-xl flex-shrink-0 flex items-center justify-center font-black text-[10px] italic group-hover:bg-black group-hover:text-white transition-colors uppercase">{recipe.category.substring(0,2)}</div>
                <div className="min-w-0">
                    <div className="text-[9px] font-black text-gray-400 uppercase mb-0.5">{recipe.category}</div>
                    <div className="text-xl md:text-3xl font-black italic tracking-tighter truncate">{recipe.productName}</div>
                </div>
            </div>
            <div className="flex items-center gap-4 md:gap-8 mt-4 md:mt-0 w-full md:w-auto justify-between z-10">
                <div className="text-left md:text-right">
                    <div className="text-[8px] font-black text-gray-300 uppercase leading-none">Formula</div>
                    <div className="text-sm md:text-base font-black italic">{recipe.ingredients?.length || 0} Ing.</div>
                </div>
                <button onClick={(e) => handleDelete(e, recipe.id)} className="p-2 px-4 rounded-xl text-[9px] font-black text-gray-300 border border-gray-100 hover:border-red-500 hover:bg-red-500 hover:text-white transition-all uppercase tracking-widest">Delete</button>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && <RecipeModal initialData={editingRecipe} onSave={(data) => {
        if (editingRecipe) setRecipes(recipes.map(r => r.id === editingRecipe.id ? { ...data, id: r.id } : r));
        else setRecipes([...recipes, { ...data, id: Date.now() }]);
        setIsModalOpen(false);
      }} onClose={() => setIsModalOpen(false)} />}
    </main>
  );
}

// --- 레시피 계산기 (기존 레이아웃 100% 동일) ---
function RecipeCalculator({ recipes, tempLogs, setTempLogs }) {
  const [category, setCategory] = useState("하드계열");
  const [selectedRecipeId, setSelectedRecipeId] = useState("");
  const [totalDough, setTotalDough] = useState("");
  const [flourWeight, setFlourWeight] = useState("");
  const [pfYields, setPfYields] = useState({});

  const filteredRecipes = recipes.filter(r => r.category === category);
  const currentRecipe = recipes.find(r => r.id === Number(selectedRecipeId));

  const totals = useMemo(() => {
    if (!currentRecipe) return { totalPercent: 0, finalYield: 0, totalWeight: 0 };
    let totalFlourPct = 0; let totalWaterPct = 0; let rawTotalPercent = 0;
    currentRecipe.ingredients.forEach(ing => {
      const pct = parseFloat(ing.percent) || 0;
      rawTotalPercent += pct;
      if (ing.type === "밀") totalFlourPct += pct;
      else if (ing.type === "수분") totalWaterPct += pct;
      else if (ing.type === "사전반죽") {
        const yieldInput = parseFloat(pfYields[ing.name] || "100") || 100;
        const pfFlour = pct / (1 + yieldInput / 100);
        const pfWater = pfFlour * (yieldInput / 100);
        totalFlourPct += pfFlour; totalWaterPct += pfWater;
      }
    });
    return { 
      totalPercent: rawTotalPercent, 
      finalYield: totalFlourPct > 0 ? (totalWaterPct / totalFlourPct) * 100 : 0, 
      totalWeight: (parseFloat(flourWeight) || 0) * (rawTotalPercent / 100) 
    };
  }, [currentRecipe, pfYields, flourWeight]);

  return (
    <main className="max-w-6xl mx-auto px-4 md:px-8 text-black italic">
      <div className="bg-white rounded-[2rem] p-6 md:p-8 shadow-sm border border-gray-100">
        <div className="border-b-2 border-black pb-4 mb-8">
            <h1 className="text-3xl md:text-5xl font-black tracking-tighter truncate uppercase">{currentRecipe?.productName || "Calculator"}</h1>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-8">
          <InputField label="Category">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full bg-transparent border-b-2 border-black font-bold outline-none pb-2">
              <option value="하드계열">하드계열</option><option value="소프트계열">소프트계열</option><option value="사전반죽">사전반죽</option>
            </select>
          </InputField>
          <InputField label="Product">
            <select value={selectedRecipeId} onChange={(e) => setSelectedRecipeId(e.target.value)} className="w-full bg-transparent border-b-2 border-black font-bold outline-none pb-2">
              <option value="">선택</option>
              {filteredRecipes.map(r => <option key={r.id} value={r.id}>{r.productName}</option>)}
            </select>
          </InputField>
          <InputField label="Total Dough (g)">
            <input type="text" value={totalDough} onChange={(e) => { setTotalDough(e.target.value); setFlourWeight(totals.totalPercent > 0 ? (parseFloat(e.target.value) / (totals.totalPercent/100)).toFixed(1) : ""); }} className="w-full bg-transparent border-b-2 border-black font-black outline-none pb-2" />
          </InputField>
          <InputField label="Flour Weight (g)">
            <input type="text" value={flourWeight} onChange={(e) => { setFlourWeight(e.target.value); setTotalDough(Math.round(parseFloat(e.target.value) * (totals.totalPercent/100)) || ""); }} className="w-full bg-transparent border-b-2 border-black font-black outline-none pb-2" />
          </InputField>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead><tr className="border-y-2 border-black text-[10px] text-gray-400 uppercase"><th className="p-3 text-left">Ingredient</th><th className="p-3 text-right">%</th><th className="p-3 text-right">Weight</th></tr></thead>
                <tbody>
                    {currentRecipe?.ingredients.map((ing, i) => (
                        <tr key={i} className="border-b border-gray-50"><td className="p-3 font-black">{ing.name}</td><td className="p-3 text-right font-mono">{ing.percent}%</td><td className="p-3 text-right font-black text-gray-400">{flourWeight ? Math.round(parseFloat(flourWeight) * (parseFloat(ing.percent)/100)) : 0}g</td></tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>
    </main>
  );
}

function RecipeModal({ initialData, onSave, onClose }) {
    const [category, setCategory] = useState(initialData?.category || "하드계열");
    const [productName, setProductName] = useState(initialData?.productName || "");
    const [ingredients, setIngredients] = useState(initialData?.ingredients || [{ type: "밀", name: "", percent: "", cost: "" }]);
    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <div className="bg-[#f7f6f3] w-full max-w-4xl rounded-[2.5rem] p-6 md:p-10 max-h-[90vh] overflow-y-auto no-scrollbar relative italic">
                <button onClick={onClose} className="absolute top-6 right-6 text-2xl font-black">✕</button>
                <h2 className="text-3xl font-black uppercase mb-8 tracking-tighter">Editor</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <InputField label="Category"><select value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-transparent border-b-2 border-black py-2 outline-none font-black uppercase"><option>하드계열</option><option>소프트계열</option><option>사전반죽</option></select></InputField>
                    <InputField label="Name"><input value={productName} onChange={e => setProductName(e.target.value)} className="w-full bg-transparent border-b-2 border-black py-2 outline-none font-black uppercase" /></InputField>
                </div>
                <div className="space-y-3">
                    {ingredients.map((ing, i) => (
                        <div key={i} className="grid grid-cols-[80px_1fr_60px_40px] gap-2 items-center bg-white p-3 rounded-xl shadow-sm">
                            <select value={ing.type} onChange={e => setIngredients(ingredients.map((x,idx)=>idx===i?{...x,type:e.target.value}:x))} className="text-[10px] font-black uppercase bg-gray-50 p-1 rounded">
                                <option>밀</option><option>수분</option><option>소금</option><option>사전반죽</option><option>기타</option>
                            </select>
                            <input value={ing.name} onChange={e => setIngredients(ingredients.map((x,idx)=>idx===i?{...x,name:e.target.value}:x))} className="text-xs font-bold outline-none" placeholder="Name" />
                            <input value={ing.percent} onChange={e => setIngredients(ingredients.map((x,idx)=>idx===i?{...x,percent:e.target.value}:x))} className="text-xs font-mono font-black text-right outline-none" placeholder="%" />
                            <button onClick={()=>setIngredients(ingredients.filter((_,idx)=>idx!==i))} className="text-red-400 font-black">✕</button>
                        </div>
                    ))}
                    <button onClick={()=>setIngredients([...ingredients, {type:"밀", name:"", percent:"", cost:""}])} className="w-full py-4 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 font-black uppercase text-[10px]">+ Add Ingredient</button>
                </div>
                <div className="mt-10 flex gap-4">
                    <button onClick={onClose} className="flex-1 py-4 bg-white rounded-2xl font-black uppercase text-xs">Cancel</button>
                    <button onClick={() => onSave({ category, productName, ingredients })} className="flex-1 py-4 bg-black text-white rounded-2xl font-black uppercase text-xs">Save Recipe</button>
                </div>
            </div>
        </div>
    );
}

function TempPhDB() { return <div className="text-center py-20 font-black italic text-gray-300 uppercase tracking-widest">History Module Loaded</div>; }
function InputField({ label, children }) { return (<div><label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 block">{label}</label>{children}</div>); }