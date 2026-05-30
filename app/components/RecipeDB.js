import { useState, useMemo } from "react";

import AuthImage from "./AuthImage";
import { InputField } from "./common";
import { RECIPE_CATEGORY_LABEL_KEYS, labelFromMap } from "./i18nHelpers";
import { supabase } from "../lib/supabaseClient";

const IMAGE_UPLOAD_MAX_EDGE = 1800;
const IMAGE_UPLOAD_QUALITY = 0.82;

function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Image load failed."));
    };
    image.src = objectUrl;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Image compression failed."));
    }, type, quality);
  });
}

async function optimizeImageForUpload(file) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Image upload failed.");
  }

  if (file.type === "image/gif") {
    throw new Error("GIF uploads are not supported.");
  }

  const image = await loadImageElement(file);
  const scale = Math.min(1, IMAGE_UPLOAD_MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image compression failed.");

  context.drawImage(image, 0, 0, width, height);

  const blob = await canvasToBlob(canvas, "image/webp", IMAGE_UPLOAD_QUALITY);

  return {
    blob,
    fileName: "bread-photo.webp",
  };
}

export default function RecipeDB({ t, recipes, setRecipes, costItems, setCostItems, isOnline, isMediaDisabled, onRequireOnline, onToggleCommunityVisibility }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingRecipe, setEditingRecipe] = useState(null);
  const [savingVisibilityId, setSavingVisibilityId] = useState(null);
  
  const displayedRecipes = useMemo(() => {
    return recipes.filter(r => r.productName.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [recipes, searchTerm]);
  const toggleCommunityVisibility = async (recipe) => {
    if (!isOnline) {
      alert(t("communityOnlineRequired"));
      return;
    }

    setSavingVisibilityId(recipe.id);

    try {
      await onToggleCommunityVisibility(recipe.id, !recipe.isPublic);
    } catch (error) {
      alert(error.message || t("communityVisibilitySaveFailed"));
    } finally {
      setSavingVisibilityId(null);
    }
  };
  const deleteRecipe = async (recipe) => {
    if (!confirm(t("deleteConfirm"))) return;

    if (recipe.communityImageKey && supabase && !isMediaDisabled) {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        alert(sessionError.message);
        return;
      }

      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        alert("Login session is missing.");
        return;
      }

      const response = await fetch("/api/r2/delete", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ key: recipe.communityImageKey }),
      });
      const result = await response.json();

      if (!response.ok) {
        alert(result.error || "Image delete failed.");
        return;
      }
    }

    setRecipes(prev => prev.filter(r => r.id !== recipe.id));
  };

  return (
    <main className="max-w-6xl mx-auto px-4 md:px-8 text-black">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b-2 border-black pb-4 mb-6 gap-4">
        <h1 className="text-3xl md:text-4xl font-black tracking-tighter uppercase">{t("recipeDbTitle")}</h1>
        <div className="flex gap-2 w-full md:w-auto">
          <input type="text" placeholder={t("search")} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex-1 md:w-48 bg-white border border-gray-200 rounded-full px-4 py-2 text-sm outline-none shadow-inner" />
          <button onClick={() => { setEditingRecipe(null); setIsModalOpen(true); }} className="bg-black text-white px-6 py-2 rounded-full font-bold text-sm uppercase tracking-tighter">{t("add")}</button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {displayedRecipes.map(recipe => (
          <div key={recipe.id} onClick={() => { setEditingRecipe(recipe); setIsModalOpen(true); }} className="bg-white p-5 rounded-2xl border border-gray-100 flex flex-col md:flex-row md:justify-between md:items-center gap-4 cursor-pointer hover:border-black group transition-all">
            <div>
              <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{labelFromMap(t, RECIPE_CATEGORY_LABEL_KEYS, recipe.category)}</div>
              <div className="text-xl font-black tracking-tighter uppercase">{recipe.productName}</div>
              {recipe.sourceUserId && (
                <p className="mt-1 text-[11px] font-black text-gray-400">
                  {t("source")}: {recipe.sourceAuthorDisplayName || t("anonymousBaker")}
                </p>
              )}
              {recipe.communityText && <p className="mt-1 text-xs font-bold text-gray-400 line-clamp-1">{recipe.communityText}</p>}
            </div>
            <div className="flex items-center gap-2 self-end md:self-auto">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleCommunityVisibility(recipe);
                }}
                disabled={savingVisibilityId === recipe.id}
                className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-tight border transition-all disabled:cursor-wait disabled:opacity-60 ${recipe.isPublic ? "bg-black text-white border-black" : "bg-white text-gray-400 border-gray-200 hover:border-black hover:text-black"}`}
              >
                {savingVisibilityId === recipe.id ? t("saving") : recipe.isPublic ? t("publicRecipe") : t("privateRecipe")}
              </button>
              <button onClick={(e) => { e.stopPropagation(); deleteRecipe(recipe); }} className="text-gray-300 hover:text-red-500">x</button>
            </div>
          </div>
        ))}
      </div>
      {isModalOpen && <RecipeModal t={t} initialData={editingRecipe} costItems={costItems} isMediaDisabled={isMediaDisabled} onRequireOnline={onRequireOnline} onImageDeleted={(deletedKey) => {
        if (!editingRecipe || !deletedKey) return;
        setRecipes(prev => prev.map(recipe => (
          recipe.id === editingRecipe.id && recipe.communityImageKey === deletedKey
            ? { ...recipe, communityImage: "", communityImageKey: "" }
            : recipe
        )));
      }} onSave={(data, newCostItems) => {
        if (newCostItems.length > 0) setCostItems(prev => [...prev, ...newCostItems]);
        if (editingRecipe) setRecipes(prev => prev.map(r => r.id === editingRecipe.id ? { ...data, id: r.id, publishedAt: data.isPublic ? r.publishedAt || new Date().toISOString() : r.publishedAt } : r));
        else setRecipes(prev => [...prev, { ...data, id: Date.now() }]);
        setIsModalOpen(false);
      }} onClose={() => setIsModalOpen(false)} />}
    </main>
  );
}

function RecipeModal({ t, initialData, costItems, isMediaDisabled, onRequireOnline, onImageDeleted, onSave, onClose }) {
  const [category, setCategory] = useState(initialData?.category || "하드계열");
  const [productName, setProductName] = useState(initialData?.productName || "");
  const [ingredients, setIngredients] = useState(initialData?.ingredients || [{ type: "밀", name: "", percent: "", cost: "" }]);
  const [isPublic, setIsPublic] = useState(Boolean(initialData?.isPublic));
  const [communityText, setCommunityText] = useState(initialData?.communityText || "");
  const [communityImage, setCommunityImage] = useState(initialData?.communityImage || "");
  const [communityImageKey, setCommunityImageKey] = useState(initialData?.communityImageKey || "");
  const [pendingUploadedImageKeys, setPendingUploadedImageKeys] = useState([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isDeletingImage, setIsDeletingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState("");
  const toggleModalVisibility = async () => {
    try {
      await onRequireOnline();
    } catch {
      alert(t("communityOnlineRequired"));
      return;
    }

    setIsPublic(prev => !prev);
  };
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
    if (Boolean(initialData?.isPublic) !== isPublic) {
      try {
        await onRequireOnline();
      } catch {
        alert(t("communityOnlineRequired"));
        return;
      }
    }

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
      isPublic,
      communityText,
      communityImage,
      communityImageKey,
      sourceRecipeId: initialData?.sourceRecipeId,
      savedFromCommunityAt: initialData?.savedFromCommunityAt,
    }, newCostItems);
    setPendingUploadedImageKeys([]);
  };
  const deleteR2ImageKey = async (key) => {
    if (!key || !supabase) return;

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;

    const accessToken = sessionData.session?.access_token;
    if (!accessToken) throw new Error("Login session is missing.");

    const response = await fetch("/api/r2/delete", {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ key }),
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Image delete failed.");
    }
  };
  const closeWithoutSaving = async () => {
    const keysToDelete = pendingUploadedImageKeys.filter(key => key !== initialData?.communityImageKey);

    if (keysToDelete.length > 0) {
      setIsDeletingImage(true);
      setImageUploadError("");
      try {
        await Promise.all(keysToDelete.map(deleteR2ImageKey));
      } catch (error) {
        setImageUploadError(error.message || "Image delete failed.");
        setIsDeletingImage(false);
        return;
      }
      setIsDeletingImage(false);
    }

    onClose();
  };
  const updateCommunityImage = async (file) => {
    if (!file) return;

    if (isMediaDisabled) {
      setImageUploadError(t("offlineMediaDisabled"));
      return;
    }

    if (!supabase) {
      setImageUploadError(t("supabaseClientMissing"));
      return;
    }

    setIsUploadingImage(true);
    setImageUploadError("");

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Login session is missing.");

      const optimizedFile = await optimizeImageForUpload(file);
      const formData = new FormData();
      formData.append("file", optimizedFile.blob, optimizedFile.fileName);

      const response = await fetch("/api/r2/images", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Image upload failed.");
      }

      if (communityImageKey && communityImageKey !== initialData?.communityImageKey) {
        await deleteR2ImageKey(communityImageKey);
        setPendingUploadedImageKeys(prev => prev.filter(key => key !== communityImageKey));
      }

      setCommunityImage("");
      setCommunityImageKey(result.key);
      setPendingUploadedImageKeys(prev => [...new Set([...prev, result.key])]);
    } catch (error) {
      setImageUploadError(error.message || "Image upload failed.");
    } finally {
      setIsUploadingImage(false);
    }
  };
  const deleteCommunityImage = async () => {
    if (isMediaDisabled) {
      setImageUploadError(t("offlineMediaDisabled"));
      return;
    }

    if (!communityImageKey) {
      setCommunityImage("");
      return;
    }

    if (!confirm(t("deletePhotoConfirm"))) return;

    if (!supabase) {
      setImageUploadError(t("supabaseClientMissing"));
      return;
    }

    setIsDeletingImage(true);
    setImageUploadError("");

    try {
      const deletedKey = communityImageKey;
      await deleteR2ImageKey(deletedKey);

      setCommunityImage("");
      setCommunityImageKey("");
      setPendingUploadedImageKeys(prev => prev.filter(key => key !== deletedKey));
      if (deletedKey === initialData?.communityImageKey) {
        onImageDeleted?.(deletedKey);
      }
    } catch (error) {
      setImageUploadError(error.message || "Image delete failed.");
    } finally {
      setIsDeletingImage(false);
    }
  };
  const imagePreview = communityImageKey || communityImage;
  const isImageBusy = isUploadingImage || isDeletingImage;
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-[#f7f6f3] w-full max-w-4xl rounded-[2rem] p-6 md:p-12 shadow-2xl max-h-[90vh] overflow-y-auto relative">
        <button onClick={closeWithoutSaving} disabled={isImageBusy} className="absolute top-6 right-6 text-xl disabled:cursor-wait disabled:opacity-50">x</button>
        <h2 className="text-2xl md:text-3xl font-black tracking-tighter mb-8 uppercase">{t("recipeEditor")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <InputField label={t("category")}><select value={category} onChange={e => setCategory(e.target.value)} className="w-full h-10 bg-transparent border-b-2 border-black py-2 outline-none font-bold leading-normal"><option value="하드계열">{t("hardCategory")}</option><option value="소프트계열">{t("softCategory")}</option><option value="사전반죽">{t("prefermentCategory")}</option></select></InputField>
          <InputField label={t("productName")}><input value={productName} onChange={e => setProductName(e.target.value)} className="w-full bg-transparent border-b-2 border-black py-2 outline-none font-bold" /></InputField>
        </div>
        <section className="mb-8 bg-white rounded-2xl border border-gray-100 p-4 md:p-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t("communityPublish")}</div>
              <p className="mt-1 text-xs font-bold text-gray-400">{t("communityPublishDescription")}</p>
            </div>
            <button
              type="button"
              onClick={toggleModalVisibility}
              className={`px-5 py-3 rounded-xl text-sm font-black uppercase tracking-tight ${isPublic ? "bg-black text-white" : "bg-[#f7f6f3] text-gray-400 border border-gray-200"}`}
            >
              {isPublic ? t("publicRecipe") : t("privateRecipe")}
            </button>
          </div>
          <div className="mt-5 grid grid-cols-1 md:grid-cols-[180px_1fr] gap-4">
            <label className="min-h-36 rounded-2xl border border-dashed border-gray-200 bg-[#f7f6f3] flex items-center justify-center overflow-hidden cursor-pointer">
              {isMediaDisabled ? (
                <span className="px-4 text-center text-xs font-black text-gray-400 uppercase tracking-tight">{t("offlineMediaDisabled")}</span>
              ) : imagePreview ? (
                <AuthImage imageKey={communityImageKey} fallbackImage={communityImage} className="block h-full min-h-36 w-full bg-cover bg-center">
                  <span className="px-4 text-center text-xs font-black text-gray-400 uppercase tracking-tight">{t("noBreadPhoto")}</span>
                </AuthImage>
              ) : isImageBusy ? (
                <span className="px-4 text-center text-xs font-black text-gray-400 uppercase tracking-tight">{isDeletingImage ? t("imageDeleting") : t("imageUploading")}</span>
              ) : (
                <span className="px-4 text-center text-xs font-black text-gray-400 uppercase tracking-tight">{t("uploadBreadPhoto")}</span>
              )}
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => updateCommunityImage(e.target.files?.[0])} className="sr-only" disabled={isImageBusy || isMediaDisabled} />
            </label>
            <textarea
              value={communityText}
              onChange={e => setCommunityText(e.target.value)}
              placeholder={t("communityPostPlaceholder")}
              className="min-h-36 w-full resize-none rounded-2xl border border-gray-100 bg-[#f7f6f3] p-4 text-sm font-bold outline-none focus:border-black"
            />
          </div>
          {imagePreview && !isMediaDisabled && (
            <button
              type="button"
              onClick={deleteCommunityImage}
              disabled={isImageBusy}
              className="mt-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-black text-red-500 uppercase tracking-tight disabled:cursor-wait disabled:opacity-60"
            >
              {isDeletingImage ? t("imageDeleting") : t("deletePhoto")}
            </button>
          )}
          {imageUploadError && <p className="mt-3 text-xs font-bold text-red-500">{imageUploadError}</p>}
        </section>
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
          <button onClick={closeWithoutSaving} disabled={isImageBusy} className="flex-1 bg-white border border-gray-200 py-4 rounded-xl font-bold uppercase tracking-tighter disabled:cursor-wait disabled:opacity-60">{isDeletingImage ? t("imageDeleting") : t("close")}</button>
          <button onClick={saveRecipe} disabled={isImageBusy} className="flex-1 bg-black text-white py-4 rounded-xl font-bold uppercase tracking-tighter disabled:cursor-wait disabled:opacity-60">{isDeletingImage ? t("imageDeleting") : isUploadingImage ? t("imageUploading") : t("saveRecipe")}</button>
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
