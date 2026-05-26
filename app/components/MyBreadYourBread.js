"use client";

import { useEffect, useMemo, useState } from "react";

import { RECIPE_CATEGORY_LABEL_KEYS, labelFromMap } from "./i18nHelpers";

export default function MyBreadYourBread({ t, recipes = [], setRecipes }) {
  const [savedRecipeId, setSavedRecipeId] = useState(null);

  const publicRecipes = useMemo(() => {
    return (Array.isArray(recipes) ? recipes : [])
      .filter(recipe => recipe.isPublic)
      .slice()
      .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
  }, [recipes]);

  useEffect(() => {
    if (!savedRecipeId) return undefined;

    const timer = window.setTimeout(() => {
      setSavedRecipeId(null);
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [savedRecipeId]);

  const saveRecipeToDb = (recipe) => {
    setRecipes(prev => {
      const numericIds = prev.map(item => Number(item.id)).filter(Number.isFinite);
      const nextId = numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1;

      return [
        ...prev,
        {
          ...recipe,
          id: nextId,
          productName: `${recipe.productName} ${t("communityCopySuffix")}`,
          isPublic: false,
          sourceRecipeId: recipe.sourceRecipeId || recipe.id,
          savedFromCommunityAt: recipe.publishedAt || "",
        },
      ];
    });
    setSavedRecipeId(recipe.id);
  };

  return (
    <main className="max-w-6xl mx-auto px-4 md:px-8 text-black">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b-2 border-black pb-4 mb-6 gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tighter uppercase">{t("communityTitle")}</h1>
          <p className="mt-2 text-xs md:text-sm font-bold text-gray-400">{t("communityDescription")}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-full px-4 py-2 text-xs font-black text-gray-400 uppercase tracking-widest">
          {publicRecipes.length} {t("communityPosts")}
        </div>
      </div>

      {publicRecipes.length === 0 ? (
        <section className="bg-white rounded-2xl border border-gray-100 p-8 md:p-12 text-center">
          <h2 className="text-2xl font-black tracking-tighter">{t("emptyCommunityTitle")}</h2>
          <p className="mt-3 text-sm font-bold text-gray-400">{t("emptyCommunityDescription")}</p>
        </section>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {publicRecipes.map(recipe => (
            <article key={recipe.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              {savedRecipeId === recipe.id && <span className="sr-only" aria-live="polite">{t("communityRecipeSaved")}</span>}
              <div className="aspect-[4/3] bg-[#efece5]">
                {recipe.communityImage ? (
                  <div cjalassName="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${recipe.communityImage})` }} />
                ) : (
                  <div className="h-full w-full flex items-center justify-center px-6 text-center text-xs font-black text-gray-400 uppercase tracking-widest">
                    {t("noBreadPhoto")}
                  </div>
                )}
              </div>

              <div className="p-5 md:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      {labelFromMap(t, RECIPE_CATEGORY_LABEL_KEYS, recipe.category)}
                    </div>
                    <h2 className="mt-1 text-2xl font-black tracking-tighter uppercase">{recipe.productName}</h2>
                  </div>
                  <span className="shrink-0 rounded-full bg-black px-3 py-1 text-[10px] font-black text-white uppercase tracking-tight">
                    {t("publicRecipe")}
                  </span>
                </div>

                {recipe.communityText && (
                  <p className="mt-4 text-sm font-bold leading-6 text-gray-600 whitespace-pre-wrap">{recipe.communityText}</p>
                )}

                <div className="mt-5 rounded-2xl bg-[#f7f6f3] p-4">
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">{t("ingredient")}</div>
                  <div className="space-y-2">
                    {recipe.ingredients?.map((ing, index) => (
                      <div key={`${ing.name}-${index}`} className="flex justify-between gap-3 text-xs font-bold">
                        <span className="truncate">{ing.name || t("unspecified")}</span>
                        <span className="font-mono text-gray-500">{ing.percent || 0}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => saveRecipeToDb(recipe)}
                  className={`mt-5 w-full rounded-xl py-3 text-sm font-black uppercase tracking-tight transition-colors ${savedRecipeId === recipe.id ? "bg-emerald-600 text-white" : "bg-black text-white"}`}
                >
                  {savedRecipeId === recipe.id ? t("communityRecipeSaved") : t("saveCommunityRecipe")}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
