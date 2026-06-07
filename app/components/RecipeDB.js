import { useState, useMemo } from "react";

import { InputField } from "./common";
import { RECIPE_CATEGORY_LABEL_KEYS, labelFromMap } from "./i18nHelpers";

const RECIPE_CATEGORIES = ["하드계열", "소프트계열", "사전반죽"];

export default function RecipeDB({ t, recipes, setRecipes, costItems, setCostItems }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingRecipe, setEditingRecipe] = useState(null);
  const [expandedCategory, setExpandedCategory] = useState(null);
  
  const displayedRecipes = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    return recipes.filter(recipe =>
      recipe.productName.toLowerCase().includes(keyword) ||
      recipe.category.toLowerCase().includes(keyword)
    );
  }, [recipes, searchTerm]);
  const recipesByCategory = useMemo(() => {
    return RECIPE_CATEGORIES.reduce((groups, category) => {
      groups[category] = displayedRecipes.filter(recipe => recipe.category === category);
      return groups;
    }, {});
  }, [displayedRecipes]);
  const isSearching = searchTerm.trim().length > 0;
  const deleteRecipe = async (recipe) => {
    if (!confirm(t("deleteConfirm"))) return;
    setRecipes(prev => prev.filter(r => r.id !== recipe.id));
  };

  const renderRecipeRow = (recipe) => (
    <div key={recipe.id} onClick={() => { setEditingRecipe(recipe); setIsModalOpen(true); }} className="bg-white p-5 rounded-2xl border border-gray-100 flex flex-col md:flex-row md:justify-between md:items-center gap-4 cursor-pointer hover:border-black group transition-all">
      <div>
        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{labelFromMap(t, RECIPE_CATEGORY_LABEL_KEYS, recipe.category)}</div>
        <div className="text-xl font-black tracking-tighter uppercase">{recipe.productName}</div>
        {recipe.sourceUserId && (
          <p className="mt-1 text-[11px] font-black text-gray-400">
            {t("source")}: {recipe.sourceAuthorDisplayName || t("anonymousBaker")}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 self-end md:self-auto">
        <button onClick={(e) => { e.stopPropagation(); deleteRecipe(recipe); }} className="text-gray-300 hover:text-red-500">x</button>
      </div>
    </div>
  );

  return (
    <main className="max-w-6xl mx-auto px-4 md:px-8 text-black">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b-2 border-black pb-4 mb-6 gap-4">
        <h1 className="text-3xl md:text-4xl font-black tracking-tighter uppercase">{t("recipeDbTitle")}</h1>
        <div className="flex gap-2 w-full md:w-auto">
          <input type="text" placeholder={t("search")} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex-1 md:w-48 bg-white border border-gray-200 rounded-full px-4 py-2 text-sm outline-none shadow-inner" />
          <button onClick={() => { setEditingRecipe(null); setIsModalOpen(true); }} className="bg-black text-white px-6 py-2 rounded-full font-bold text-sm uppercase tracking-tighter">{t("add")}</button>
        </div>
      </div>
      {isSearching ? (
        <div className="space-y-3">
          {displayedRecipes.map(renderRecipeRow)}
        </div>
      ) : (
        <div className="space-y-3">
          {RECIPE_CATEGORIES.map(category => {
            const categoryRecipes = recipesByCategory[category] || [];
            const isCategoryExpanded = expandedCategory === category;

            return (
              <div key={category} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                <button
                  type="button"
                  onClick={() => setExpandedCategory(isCategoryExpanded ? null : category)}
                  className="w-full p-5 flex justify-between items-center text-left hover:bg-gray-50 transition-all"
                >
                  <div>
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t("recipeCategorySection")}</div>
                    <div className="text-xl font-black tracking-tighter uppercase">{labelFromMap(t, RECIPE_CATEGORY_LABEL_KEYS, category)}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">{categoryRecipes.length} {t("recipeCount")}</span>
                    <span className="text-xs">{isCategoryExpanded ? "▲" : "▼"}</span>
                  </div>
                </button>

                {isCategoryExpanded && (
                  <div className="px-5 pb-5 bg-[#fcfcfb]">
                    <div className="grid grid-cols-1 gap-3 pt-4 border-t border-gray-100">
                      {categoryRecipes.length > 0 ? categoryRecipes.map(renderRecipeRow) : (
                        <div className="rounded-2xl border border-dashed border-gray-200 bg-white/60 p-8 text-center text-xs font-black uppercase tracking-widest text-gray-400">
                          {t("noRecipesInCategory")}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {displayedRecipes.length === 0 && (
        <div className="mt-3 rounded-2xl border border-dashed border-gray-200 bg-white/60 p-8 text-center text-xs font-black uppercase tracking-widest text-gray-400">
          {t("noRecipesInCategory")}
        </div>
      )}
      {isModalOpen && <RecipeModal t={t} initialData={editingRecipe} costItems={costItems} onSave={(data, newCostItems) => {
        if (newCostItems.length > 0) setCostItems(prev => [...prev, ...newCostItems]);
        if (editingRecipe) setRecipes(prev => prev.map(r => r.id === editingRecipe.id ? { ...data, id: r.id } : r));
        else {
          setRecipes(prev => [...prev, { ...data, id: Date.now() }]);
          setExpandedCategory(data.category);
        }
        setIsModalOpen(false);
      }} onClose={() => setIsModalOpen(false)} />}
    </main>
  );
}

function RecipeModal({ t, initialData, costItems, onSave, onClose }) {
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
  const saveRecipe = async () => {
    const knownItems = [...costItems];
    const newCostItems = [];

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

      const newCostItem = {
        id: Date.now() + newCostItems.length + 1,
        category: "미등록",
        name: trimmedName,
        purchasePrice: "",
        unit: "1g",
        cost: "",
        supplier: "",
        memo: "",
        updatedAt: new Date().toISOString().slice(0, 10),
      };

      knownItems.push(newCostItem);
      newCostItems.push(newCostItem);

      return {
        ...ing,
        ingredientId: newCostItem.id,
        name: trimmedName,
        cost: "",
        costUnit: "g",
      };
    });

    onSave({
      category,
      productName,
      ingredients: nextIngredients,
      isPublic: false,
      communityText: "",
      communityImage: "",
      communityImageKey: "",
      sourceRecipeId: initialData?.sourceRecipeId,
      savedFromCommunityAt: initialData?.savedFromCommunityAt,
    }, newCostItems);
  };
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-[#f7f6f3] w-full max-w-4xl rounded-[2rem] p-6 md:p-12 shadow-2xl max-h-[90vh] overflow-y-auto relative">
        <button onClick={onClose} className="absolute top-6 right-6 text-xl">x</button>
        <h2 className="text-2xl md:text-3xl font-black tracking-tighter mb-8 uppercase">{t("recipeEditor")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <InputField label={t("category")}><select value={category} onChange={e => setCategory(e.target.value)} className="w-full h-10 bg-transparent border-b-2 border-black py-2 outline-none font-bold leading-normal"><option value="하드계열">{t("hardCategory")}</option><option value="소프트계열">{t("softCategory")}</option><option value="사전반죽">{t("prefermentCategory")}</option></select></InputField>
          <InputField label={t("productName")}><input value={productName} onChange={e => setProductName(e.target.value)} className="w-full bg-transparent border-b-2 border-black py-2 outline-none font-bold" /></InputField>
        </div>
        <div className="space-y-3">
          {ingredients.map((ing, i) => {
            const linkedCostItem = costItems.find(item => item.id === ing.ingredientId);
            const displayCost = linkedCostItem ? linkedCostItem.cost : ing.cost;
            const isCostLinked = Boolean(linkedCostItem || displayCost);

            return (
              <div key={i} className="grid grid-cols-2 md:grid-cols-[120px_1fr_80px_100px_40px] gap-2 md:gap-4 items-center bg-white p-3 md:p-4 rounded-xl shadow-sm">
                <select value={ing.type} onChange={e => updateIng(i, "type", e.target.value)} className="bg-gray-50 p-2 rounded-lg text-xs font-bold"><option value="밀">{t("typeFlour")}</option><option value="수분">{t("typeWater")}</option><option value="사전반죽">{t("typePreferment")}</option><option value="소금">{t("typeSalt")}</option><option value="기타">{t("typeOther")}</option></select>
                <IngredientNameInput
                  t={t}
                  value={ing.name}
                  costItems={costItems}
                  selectedIngredientId={ing.ingredientId}
                  onChange={(value) => updateIng(i, "name", value)}
                  onSelect={(item) => selectCostItem(i, item)}
                />
                <input value={ing.percent} onChange={e => updateIng(i, "percent", e.target.value)} className="bg-gray-50 p-2 rounded-lg text-xs text-right font-mono font-bold" placeholder="%" type="text" inputMode="decimal" />
                <input
                  value={displayCost ? `${displayCost}${t("won")} / g` : ""}
                  readOnly
                  title={t("costAutoTitle")}
                  className={`bg-gray-50 p-2 rounded-lg text-xs text-right font-mono font-bold text-gray-400 cursor-not-allowed ${isCostLinked ? "" : "placeholder:text-gray-300"}`}
                  placeholder={t("costMissing")}
                  type="text"
                />
                <button onClick={() => setIngredients(ingredients.filter((_, idx) => idx !== i))} className="text-red-300 font-bold">x</button>
              </div>
            );
          })}
          <button onClick={() => setIngredients([...ingredients, { type: "밀", name: "", percent: "", cost: "" }])} className="w-full py-4 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 font-black uppercase tracking-widest">{t("addIngredient")}</button>
        </div>
        <div className="mt-10 flex gap-3">
          <button onClick={onClose} className="flex-1 bg-white border border-gray-200 py-4 rounded-xl font-bold uppercase tracking-tighter">{t("close")}</button>
          <button onClick={saveRecipe} className="flex-1 bg-black text-white py-4 rounded-xl font-bold uppercase tracking-tighter">{t("saveRecipe")}</button>
        </div>
      </div>
    </div>
  );
}

function IngredientNameInput({ t, value, costItems, selectedIngredientId, onChange, onSelect }) {
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
        placeholder={t("ingredientName")}
      />
      {selectedItem && (
        <div className="mt-1 text-[9px] font-black text-gray-400 uppercase tracking-tight">
          {t("costLinked")} · {selectedItem.cost || 0}{t("won")} / g
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
                <span className="font-mono text-black">{item.cost || 0}{t("won")} / g</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
