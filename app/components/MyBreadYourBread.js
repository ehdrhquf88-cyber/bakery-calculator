"use client";

import { useEffect, useMemo, useState } from "react";

import AuthImage from "./AuthImage";
import { RECIPE_CATEGORY_LABEL_KEYS, labelFromMap } from "./i18nHelpers";

function getCommunityRecipeKey(recipe) {
  return `${recipe.ownerUserId || recipe.sourceUserId || "unknown"}:${Number(recipe.id) || recipe.id}`;
}

function getRecipeSearchText(t, recipe) {
  return [
    recipe.productName,
    recipe.category,
    labelFromMap(t, RECIPE_CATEGORY_LABEL_KEYS, recipe.category),
    recipe.communityText,
    recipe.authorDisplayName,
    ...(recipe.ingredients || []).map(ingredient => ingredient.name),
  ].filter(Boolean).join(" ").toLowerCase();
}

export default function MyBreadYourBread({
  t,
  recipes = [],
  bookmarkedRecipeKeys = [],
  saveCounts = {},
  onSaveCommunityRecipe,
  onToggleBookmark,
}) {
  const [savedRecipeId, setSavedRecipeId] = useState(null);
  const [savingRecipeId, setSavingRecipeId] = useState(null);
  const [bookmarkingRecipeId, setBookmarkingRecipeId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showBookmarkedOnly, setShowBookmarkedOnly] = useState(false);
  const [previewRecipe, setPreviewRecipe] = useState(null);

  const publicRecipes = useMemo(() => {
    return (Array.isArray(recipes) ? recipes : [])
      .filter(recipe => recipe.isPublic)
      .slice()
      .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
  }, [recipes]);

  const categories = useMemo(() => {
    const categoryValues = publicRecipes.map(recipe => recipe.category).filter(Boolean);
    return [...new Set(categoryValues)].sort();
  }, [publicRecipes]);

  const filteredRecipes = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();
    const bookmarkedSet = new Set(bookmarkedRecipeKeys);

    return publicRecipes.filter((recipe) => {
      const recipeKey = getCommunityRecipeKey(recipe);
      const matchesCategory = categoryFilter === "all" || recipe.category === categoryFilter;
      const matchesBookmark = !showBookmarkedOnly || bookmarkedSet.has(recipeKey);
      const matchesSearch = !normalizedSearchTerm || getRecipeSearchText(t, recipe).includes(normalizedSearchTerm);
      return matchesCategory && matchesBookmark && matchesSearch;
    });
  }, [bookmarkedRecipeKeys, categoryFilter, publicRecipes, searchTerm, showBookmarkedOnly, t]);

  useEffect(() => {
    if (!savedRecipeId) return undefined;

    const timer = window.setTimeout(() => {
      setSavedRecipeId(null);
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [savedRecipeId]);

  const saveRecipeToDb = async (recipe) => {
    if (!onSaveCommunityRecipe || savingRecipeId) return;

    const recipeKey = getCommunityRecipeKey(recipe);
    setSavingRecipeId(recipeKey);
    try {
      const didSave = await onSaveCommunityRecipe(recipe);
      if (didSave) {
        setSavedRecipeId(recipeKey);
      }
    } finally {
      setSavingRecipeId(null);
    }
  };

  const toggleBookmark = async (recipe) => {
    if (!onToggleBookmark || bookmarkingRecipeId) return;

    const recipeKey = getCommunityRecipeKey(recipe);
    setBookmarkingRecipeId(recipeKey);
    try {
      await onToggleBookmark(recipe);
    } finally {
      setBookmarkingRecipeId(null);
    }
  };

  const renderRecipeImage = (recipe, fit = "cover") => {
    const imageClassName = fit === "contain"
      ? "block h-full w-full bg-contain bg-center bg-no-repeat"
      : "block h-full w-full bg-cover bg-center";

    return (
    recipe.communityImage || recipe.communityImageKey ? (
      <AuthImage imageKey={recipe.communityImageKey} fallbackImage={recipe.communityImage} className={imageClassName}>
        <div className="h-full w-full flex items-center justify-center px-6 text-center text-xs font-black text-gray-400 uppercase tracking-widest">
          {t("noBreadPhoto")}
        </div>
      </AuthImage>
    ) : (
      <div className="h-full w-full flex items-center justify-center px-6 text-center text-xs font-black text-gray-400 uppercase tracking-widest">
        {t("noBreadPhoto")}
      </div>
    )
    );
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

      <section className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px_auto]">
        <input
          type="search"
          value={searchTerm}
          onChange={event => setSearchTerm(event.target.value)}
          className="h-12 rounded-xl border border-gray-200 bg-white px-4 text-sm font-bold outline-none focus:border-black"
          placeholder={t("communitySearchPlaceholder")}
        />
        <select
          value={categoryFilter}
          onChange={event => setCategoryFilter(event.target.value)}
          className="h-12 rounded-xl border border-gray-200 bg-white px-4 text-sm font-black outline-none focus:border-black"
        >
          <option value="all">{t("allCategories")}</option>
          {categories.map(category => (
            <option key={category} value={category}>{labelFromMap(t, RECIPE_CATEGORY_LABEL_KEYS, category)}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setShowBookmarkedOnly(prev => !prev)}
          className={`h-12 rounded-xl border px-4 text-xs font-black uppercase tracking-tight transition-colors ${showBookmarkedOnly ? "border-black bg-black text-white" : "border-gray-200 bg-white text-gray-500"}`}
        >
          {showBookmarkedOnly ? t("bookmarkedOnly") : t("bookmarks")}
        </button>
      </section>

      {publicRecipes.length === 0 ? (
        <section className="bg-white rounded-2xl border border-gray-100 p-8 md:p-12 text-center">
          <h2 className="text-2xl font-black tracking-tighter">{t("emptyCommunityTitle")}</h2>
          <p className="mt-3 text-sm font-bold text-gray-400">{t("emptyCommunityDescription")}</p>
        </section>
      ) : filteredRecipes.length === 0 ? (
        <section className="bg-white rounded-2xl border border-gray-100 p-8 md:p-12 text-center">
          <h2 className="text-2xl font-black tracking-tighter">{t("communityNoMatches")}</h2>
          <p className="mt-3 text-sm font-bold text-gray-400">{t("communityNoMatchesDescription")}</p>
        </section>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRecipes.map(recipe => {
            const recipeKey = getCommunityRecipeKey(recipe);
            const saveCount = saveCounts[recipeKey] || 0;
            const authorDisplayName = recipe.authorDisplayName || t("anonymousBaker");

            return (
            <article key={recipeKey} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              {savedRecipeId === recipeKey && <span className="sr-only" aria-live="polite">{t("communityRecipeSaved")}</span>}
              <div className="h-44 bg-[#efece5] md:h-52">
                {renderRecipeImage(recipe, "contain")}
              </div>

              <div className="p-5 md:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      {labelFromMap(t, RECIPE_CATEGORY_LABEL_KEYS, recipe.category)}
                    </div>
                    <h2 className="mt-1 text-2xl font-black tracking-tighter uppercase">{recipe.productName}</h2>
                    <p className="mt-2 text-[11px] font-black text-gray-400">
                      {t("originalAuthor")}: {authorDisplayName}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span className="rounded-full bg-black px-3 py-1 text-[10px] font-black text-white uppercase tracking-tight">
                      {saveCount}{t("breadCountSuffix")}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setPreviewRecipe(recipe)}
                  disabled={savingRecipeId === recipeKey}
                  className={`mt-5 w-full rounded-xl py-3 text-sm font-black uppercase tracking-tight transition-colors disabled:cursor-wait disabled:opacity-70 ${savedRecipeId === recipeKey ? "bg-emerald-600 text-white" : "bg-black text-white"}`}
                >
                  {savingRecipeId === recipeKey ? t("saving") : savedRecipeId === recipeKey ? t("communityRecipeSaved") : t("viewBread")}
                </button>
              </div>
            </article>
            );
          })}
        </div>
      )}

      {previewRecipe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <section className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white text-black shadow-2xl">
            <button
              type="button"
              onClick={() => setPreviewRecipe(null)}
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-lg font-black text-black shadow-sm"
              aria-label={t("close")}
            >
              x
            </button>
            <div className="h-72 bg-[#efece5] md:h-[420px]">
              {renderRecipeImage(previewRecipe, "contain")}
            </div>
            <div className="p-5 md:p-6">
              {(() => {
                const previewRecipeKey = getCommunityRecipeKey(previewRecipe);
                const isBookmarked = bookmarkedRecipeKeys.includes(previewRecipeKey);
                const isSaved = savedRecipeId === previewRecipeKey;

                return (
              <>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    {labelFromMap(t, RECIPE_CATEGORY_LABEL_KEYS, previewRecipe.category)}
                  </div>
                  <h2 className="mt-1 text-2xl font-black tracking-tighter uppercase">{previewRecipe.productName}</h2>
                  <p className="mt-2 text-xs font-black text-gray-400">
                    {t("originalAuthor")}: {previewRecipe.authorDisplayName || t("anonymousBaker")}
                  </p>
                  <p className="mt-1 text-xs font-black text-gray-400">
                    {t("source")}: {t("communityTitle")}
                  </p>
                </div>
                <span className="rounded-full bg-black px-3 py-1 text-[10px] font-black text-white uppercase tracking-tight">
                  {(saveCounts[previewRecipeKey] || 0)}{t("breadCountSuffix")}
                </span>
              </div>

              <button
                type="button"
                onClick={() => toggleBookmark(previewRecipe)}
                disabled={bookmarkingRecipeId === previewRecipeKey}
                className={`mt-5 rounded-full border px-4 py-2 text-xs font-black uppercase tracking-tight ${isBookmarked ? "border-black bg-black text-white" : "border-gray-200 bg-white text-gray-500"}`}
              >
                {isBookmarked ? t("bookmarked") : t("bookmark")}
              </button>

              {previewRecipe.communityText && (
                <p className="mt-4 whitespace-pre-wrap text-sm font-bold leading-6 text-gray-600">{previewRecipe.communityText}</p>
              )}

              <div className="mt-5 rounded-2xl bg-[#f7f6f3] p-4">
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">{t("ingredient")}</div>
                <div className="space-y-2">
                  {previewRecipe.ingredients?.map((ing, index) => (
                    <div key={`${ing.name}-${index}`} className="flex justify-between gap-3 text-xs font-bold">
                      <span className="truncate">{ing.name || t("unspecified")}</span>
                      <span className="font-mono text-gray-500">{ing.percent || 0}%</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewRecipe(null)}
                  className="rounded-xl border border-gray-200 bg-white py-3 text-sm font-black uppercase tracking-tight text-gray-500"
                >
                  {t("cancel")}
                </button>
                <button
                  type="button"
                  onClick={() => saveRecipeToDb(previewRecipe)}
                  disabled={savingRecipeId === previewRecipeKey || isSaved}
                  className={`rounded-xl py-3 text-sm font-black uppercase tracking-tight text-white disabled:cursor-wait disabled:opacity-70 ${isSaved ? "bg-emerald-600" : "bg-black"}`}
                >
                  {savingRecipeId === previewRecipeKey ? t("saving") : isSaved ? t("communityRecipeSaved") : t("saveCommunityRecipe")}
                </button>
              </div>
              </>
                );
              })()}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
