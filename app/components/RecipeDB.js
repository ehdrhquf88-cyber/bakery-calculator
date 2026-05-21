import { useState, useMemo } from "react";

import { InputField } from "./common";



export default function RecipeDB({ recipes, setRecipes, costItems }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingRecipe, setEditingRecipe] = useState(null);
  
  const displayedRecipes = useMemo(() => {
    return recipes.filter(r => r.productName.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [recipes, searchTerm]);
  return (
    <main className="max-w-6xl mx-auto px-4 md:px-8 text-black">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b-2 border-black pb-4 mb-6 gap-4">
        <h1 className="text-3xl md:text-4xl font-black tracking-tighter uppercase">Recipe DB</h1>
        <div className="flex gap-2 w-full md:w-auto">
          <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex-1 md:w-48 bg-white border border-gray-200 rounded-full px-4 py-2 text-sm outline-none shadow-inner" />
          <button onClick={() => { setEditingRecipe(null); setIsModalOpen(true); }} className="bg-black text-white px-6 py-2 rounded-full font-bold text-sm uppercase tracking-tighter">+ Add</button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {displayedRecipes.map(recipe => (
          <div key={recipe.id} onClick={() => { setEditingRecipe(recipe); setIsModalOpen(true); }} className="bg-white p-5 rounded-2xl border border-gray-100 flex justify-between items-center cursor-pointer hover:border-black group transition-all">
            <div>
              <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{recipe.category}</div>
              <div className="text-xl font-black tracking-tighter uppercase">{recipe.productName}</div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); if (confirm("삭제하시겠습니까?")) setRecipes(prev => prev.filter(r => r.id !== recipe.id)); }} className="text-gray-300 hover:text-red-500">x</button>
          </div>
        ))}
      </div>
      {isModalOpen && <RecipeModal initialData={editingRecipe} costItems={costItems} onSave={(data) => {
        if (editingRecipe) setRecipes(prev => prev.map(r => r.id === editingRecipe.id ? { ...data, id: r.id } : r));
        else setRecipes(prev => [...prev, { ...data, id: Date.now() }]);
        setIsModalOpen(false);
      }} onClose={() => setIsModalOpen(false)} />}
    </main>
  );
}

function RecipeModal({ initialData, costItems, onSave, onClose }) {
  const [category, setCategory] = useState(initialData?.category || "하드계열");
  const [productName, setProductName] = useState(initialData?.productName || "");
  const [ingredients, setIngredients] = useState(initialData?.ingredients || [{ type: "밀", name: "", percent: "", cost: "" }]);
  const updateIng = (i, f, v) => setIngredients(ingredients.map((ing, idx) => {
    if (idx !== i) return ing;

    const nextValue = f === "percent" ? v.replace(',', '.') : v;
    const nextIng = { ...ing, [f]: nextValue };

    if (f === "name") {
      delete nextIng.ingredientId;
      delete nextIng.costUnit;
    }

    return nextIng;
  }));
  const selectCostItem = (i, item) => {
    setIngredients(ingredients.map((ing, idx) => idx === i ? {
      ...ing,
      ingredientId: item.id,
      name: item.name,
      cost: item.cost,
      costUnit: item.unit,
    } : ing));
  };
  const saveRecipe = () => {
    const knownItems = [...costItems];

    const nextIngredients = ingredients.map((ing) => {
      const trimmedName = ing.name.trim();
      if (!trimmedName) return ing;

      const linkedItem = knownItems.find(item => item.id === ing.ingredientId);
      if (linkedItem) {
        return {
          ...ing,
          name: linkedItem.name,
          cost: linkedItem.cost,
          costUnit: linkedItem.unit,
        };
      }

      const exactItem = knownItems.find(item => item.name.trim().toLowerCase() === trimmedName.toLowerCase());
      if (exactItem) {
        return {
          ...ing,
          ingredientId: exactItem.id,
          name: exactItem.name,
          cost: exactItem.cost,
          costUnit: exactItem.unit,
        };
      }

      return {
        ...ing,
        name: trimmedName,
        cost: "",
        costUnit: "g",
      };
    });

    onSave({ category, productName, ingredients: nextIngredients });
  };
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-[#f7f6f3] w-full max-w-4xl rounded-[2rem] p-6 md:p-12 shadow-2xl max-h-[90vh] overflow-y-auto relative">
        <button onClick={onClose} className="absolute top-6 right-6 text-xl">x</button>
        <h2 className="text-2xl md:text-3xl font-black tracking-tighter mb-8 uppercase">Recipe Editor</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <InputField label="분류"><select value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-transparent border-b-2 border-black py-2 outline-none font-bold"><option value="하드계열">하드계열</option><option value="소프트계열">소프트계열</option><option value="사전반죽">사전반죽</option></select></InputField>
          <InputField label="제품명"><input value={productName} onChange={e => setProductName(e.target.value)} className="w-full bg-transparent border-b-2 border-black py-2 outline-none font-bold" /></InputField>
        </div>
        <div className="space-y-3">
          {ingredients.map((ing, i) => {
            const linkedCostItem = costItems.find(item => item.id === ing.ingredientId);
            const displayCost = linkedCostItem ? linkedCostItem.cost : ing.cost;
            const isCostLinked = Boolean(linkedCostItem || displayCost);

            return (
              <div key={i} className="grid grid-cols-2 md:grid-cols-[120px_1fr_80px_100px_40px] gap-2 md:gap-4 items-center bg-white p-3 md:p-4 rounded-xl shadow-sm">
                <select value={ing.type} onChange={e => updateIng(i, "type", e.target.value)} className="bg-gray-50 p-2 rounded-lg text-xs font-bold"><option>밀</option><option>수분</option><option>사전반죽</option><option>소금</option><option>기타</option></select>
                <IngredientNameInput
                  value={ing.name}
                  costItems={costItems}
                  selectedIngredientId={ing.ingredientId}
                  onChange={(value) => updateIng(i, "name", value)}
                  onSelect={(item) => selectCostItem(i, item)}
                />
                <input value={ing.percent} onChange={e => updateIng(i, "percent", e.target.value)} className="bg-gray-50 p-2 rounded-lg text-xs text-right font-mono font-bold" placeholder="%" type="text" inputMode="decimal" />
                <input
                  value={displayCost ? `${displayCost}원 / g` : ""}
                  readOnly
                  title="원가는 원가 리스트 DB에서 자동으로 연결됩니다."
                  className={`bg-gray-50 p-2 rounded-lg text-xs text-right font-mono font-bold text-gray-400 cursor-not-allowed ${isCostLinked ? "" : "placeholder:text-gray-300"}`}
                  placeholder="원가 미등록"
                  type="text"
                />
                <button onClick={() => setIngredients(ingredients.filter((_, idx) => idx !== i))} className="text-red-300 font-bold">x</button>
              </div>
            );
          })}
          <button onClick={() => setIngredients([...ingredients, { type: "밀", name: "", percent: "", cost: "" }])} className="w-full py-4 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 font-black uppercase tracking-widest">+ Add Ingredient</button>
        </div>
        <div className="mt-10 flex gap-3">
          <button onClick={onClose} className="flex-1 bg-white border border-gray-200 py-4 rounded-xl font-bold uppercase tracking-tighter">Close</button>
          <button onClick={saveRecipe} className="flex-1 bg-black text-white py-4 rounded-xl font-bold uppercase tracking-tighter">Save Recipe</button>
        </div>
      </div>
    </div>
  );
}

function IngredientNameInput({ value, costItems, selectedIngredientId, onChange, onSelect }) {
  const [isFocused, setIsFocused] = useState(false);
  const keyword = value.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!keyword) return [];
    return costItems
      .filter(item => item.name.toLowerCase().includes(keyword))
      .slice(0, 6);
  }, [costItems, keyword]);
  const selectedItem = costItems.find(item => item.id === selectedIngredientId);
  const shouldShowMatches = isFocused && matches.length > 0;

  return (
    <div className="relative">
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setTimeout(() => setIsFocused(false), 120)}
        className="w-full bg-gray-50 p-2 rounded-lg text-xs font-bold"
        placeholder="Ingredient Name"
      />
      {selectedItem && (
        <div className="mt-1 text-[9px] font-black text-gray-400 uppercase tracking-tight">
          Cost DB 연결됨 · {selectedItem.cost || 0}원 / g
        </div>
      )}
      {shouldShowMatches && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 max-h-48 overflow-y-auto rounded-xl border border-gray-100 bg-white shadow-xl">
          {matches.map(item => (
            <button
              key={item.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onSelect(item)}
              className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b border-gray-50 last:border-b-0"
            >
              <div className="text-xs font-black tracking-tight">{item.name}</div>
              <div className="mt-0.5 flex justify-between text-[9px] font-bold text-gray-400 uppercase tracking-tight">
                <span>{item.category}</span>
                <span className="font-mono text-black">{item.cost || 0}원 / g</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
