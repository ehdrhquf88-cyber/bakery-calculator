export function isRecipeImageKey(key) {
  return typeof key === "string" && key.startsWith("images/recipes/");
}

export function isOwnedRecipeImageKey(key, userId) {
  return isRecipeImageKey(key) && key.startsWith(`images/recipes/${userId}/`);
}

export async function canReadRecipeImage({ key, user, supabase }) {
  if (!isRecipeImageKey(key)) return false;
  if (isOwnedRecipeImageKey(key, user.id)) return true;

  const { data, error } = await supabase
    .from("recipes")
    .select("user_id, id")
    .eq("is_public", true)
    .eq("recipe_data->>communityImageKey", key)
    .limit(1);

  if (error) throw error;
  return (data || []).length > 0;
}
