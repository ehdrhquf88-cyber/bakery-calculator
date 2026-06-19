export function isRecipeImageKey(key) {
  return typeof key === "string" && key.startsWith("images/recipes/");
}

export function isOwnedRecipeImageKey(key, userId) {
  return isRecipeImageKey(key) && key.startsWith(`images/recipes/${userId}/`);
}

export async function canReadRecipeImage({ key, user }) {
  if (!isRecipeImageKey(key)) return false;
  return isOwnedRecipeImageKey(key, user.id);
}
