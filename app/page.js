"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import BreadVideos from "./components/BreadVideos";
import CostDB from "./components/CostDB";
import MyBreadYourBread from "./components/MyBreadYourBread";
import NavButton from "./components/NavButton";
import RecipeCalculator from "./components/RecipeCalculator";
import RecipeDB from "./components/RecipeDB";
import ServiceWorkerUpdater from "./components/ServiceWorkerUpdater";
import TempPhDB from "./components/TempPhDB";
import { DEFAULT_LANGUAGE, LANGUAGES, getTranslator } from "./i18n";
import { SUPABASE_AUTH_STORAGE_KEY, isSupabaseConfigured, supabase } from "./lib/supabaseClient";

const INVITE_ONLY_MESSAGE = "초대된 사람만 로그인 가능합니다";
const APP_ACCESS_ROLES = ["admin", "user"];
const PROFILE_ROLES = ["admin", "user", ""];
const ADMIN_UNLOCK_STORAGE_PREFIX = "bakery_admin_unlocked";
const BROWSER_SESSION_STORAGE_KEY = "bakery_browser_session_active";
const OFFLINE_USERS_STORAGE_KEY = "bakery_offline_users";
const OFFLINE_LEGACY_USER_STORAGE_KEY = "bakery_offline_user";
const OFFLINE_PIN_STORAGE_PREFIX = "bakery_offline_pin";
const OFFLINE_ALLOWED_VIEWS = ["calc", "db", "cost_db", "temp_db"];
const OFFLINE_PIN_HASH_ALGORITHM = "levain-pin-local-v2";
const OFFLINE_PIN_HASH_ROUNDS = 512;
const LEGACY_OFFLINE_PIN_HASH_ITERATIONS = 100_000;
const OFFLINE_PIN_SAVE_SETTLE_MS = 1500;
const OFFLINE_PIN_REAUTH_AFTER_MS = 60_000;
const LOCAL_UPDATED_AT_FIELD = "_localUpdatedAt";
const REMOTE_UPDATED_AT_FIELD = "_remoteUpdatedAt";
const USER_DATA_STORAGE_KEYS = {
  recipes: "bakery_recipes",
  costItems: "bakery_cost_items",
  tempLogs: "bakery_temp_ph",
};

function getUserDataStorageKey(baseKey, authUser) {
  return `${baseKey}:${authUser.id || authUser.email}`;
}

function getDeletedUserDataStorageKey(baseKey, authUser) {
  return `${getUserDataStorageKey(baseKey, authUser)}:deleted`;
}

function loadUserData(authUser) {
  const nextData = {
    recipes: [],
    costItems: [],
    tempLogs: [],
  };
  const legacyKeysToRemove = [];

  Object.entries(USER_DATA_STORAGE_KEYS).forEach(([name, baseKey]) => {
    const userKey = getUserDataStorageKey(baseKey, authUser);
    const userValue = localStorage.getItem(userKey);
    const legacyValue = localStorage.getItem(baseKey);

    if (userValue) {
      nextData[name] = JSON.parse(userValue);
      return;
    }

    if (legacyValue) {
      nextData[name] = JSON.parse(legacyValue);
      localStorage.setItem(userKey, legacyValue);
      legacyKeysToRemove.push(baseKey);
    }
  });

  legacyKeysToRemove.forEach(key => localStorage.removeItem(key));
  return nextData;
}

function saveUserData(authUser, recipes, costItems, tempLogs) {
  localStorage.setItem(getUserDataStorageKey(USER_DATA_STORAGE_KEYS.recipes, authUser), JSON.stringify(recipes));
  localStorage.setItem(getUserDataStorageKey(USER_DATA_STORAGE_KEYS.costItems, authUser), JSON.stringify(costItems));
  localStorage.setItem(getUserDataStorageKey(USER_DATA_STORAGE_KEYS.tempLogs, authUser), JSON.stringify(tempLogs));
}

function clearUserData(authUser) {
  if (!authUser) return;

  Object.values(USER_DATA_STORAGE_KEYS).forEach(baseKey => {
    localStorage.removeItem(getUserDataStorageKey(baseKey, authUser));
    localStorage.removeItem(getDeletedUserDataStorageKey(baseKey, authUser));
  });
}

function readDeletedUserDataIds(authUser, baseKey) {
  try {
    const storedIds = localStorage.getItem(getDeletedUserDataStorageKey(baseKey, authUser));
    return new Set(storedIds ? JSON.parse(storedIds).map(Number) : []);
  } catch {
    return new Set();
  }
}

function writeDeletedUserDataIds(authUser, baseKey, ids) {
  localStorage.setItem(getDeletedUserDataStorageKey(baseKey, authUser), JSON.stringify([...ids]));
}

function recordDeletedUserDataIds(authUser, baseKey, ids) {
  if (!authUser || ids.length === 0) return;

  const deletedIds = readDeletedUserDataIds(authUser, baseKey);
  ids.forEach(id => deletedIds.add(Number(id)));
  writeDeletedUserDataIds(authUser, baseKey, deletedIds);
}

function clearDeletedUserDataIds(authUser, baseKey) {
  localStorage.removeItem(getDeletedUserDataStorageKey(baseKey, authUser));
}

function normalizeOfflineUser(user) {
  if (!user?.id) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    picture: user.picture,
    role: user.role,
    signedInAt: user.signedInAt,
    pinRecord: user.pinRecord || null,
  };
}

function readOfflineUsers() {
  try {
    const storedUsers = localStorage.getItem(OFFLINE_USERS_STORAGE_KEY);
    const users = storedUsers ? JSON.parse(storedUsers) : [];
    const legacyUser = localStorage.getItem(OFFLINE_LEGACY_USER_STORAGE_KEY);
    const normalizedUsers = Array.isArray(users)
      ? users.map(normalizeOfflineUser).filter(Boolean)
      : [];

    if (legacyUser) {
      const normalizedLegacyUser = normalizeOfflineUser(JSON.parse(legacyUser));
      if (normalizedLegacyUser && !normalizedUsers.some(user => user.id === normalizedLegacyUser.id)) {
        normalizedUsers.push(normalizedLegacyUser);
      }
      localStorage.removeItem(OFFLINE_LEGACY_USER_STORAGE_KEY);
      localStorage.setItem(OFFLINE_USERS_STORAGE_KEY, JSON.stringify(normalizedUsers));
    }

    return normalizedUsers;
  } catch {
    return [];
  }
}

function writeOfflineUser(user) {
  const normalizedUser = normalizeOfflineUser(user);
  if (!normalizedUser) return;

  const users = readOfflineUsers();
  const existingUser = users.find(item => item.id === normalizedUser.id);
  const nextUsers = [
    {
      ...normalizedUser,
      pinRecord: normalizedUser.pinRecord || existingUser?.pinRecord || readOfflinePinRecord(normalizedUser.id),
    },
    ...users.filter(item => item.id !== normalizedUser.id),
  ];

  localStorage.setItem(OFFLINE_USERS_STORAGE_KEY, JSON.stringify(nextUsers));
}

function writeOfflinePinRecord(userId, record) {
  if (!userId || !record) return;

  localStorage.setItem(getOfflinePinStorageKey(userId), JSON.stringify(record));
}

function removeOfflineUser(userId) {
  if (!userId) return;

  const users = readOfflineUsers().filter(user => user.id !== userId);
  localStorage.setItem(OFFLINE_USERS_STORAGE_KEY, JSON.stringify(users));
  localStorage.removeItem(getOfflinePinStorageKey(userId));
}

function getOfflinePinStorageKey(userId) {
  return `${OFFLINE_PIN_STORAGE_PREFIX}:${userId}`;
}

function readOfflinePinRecord(userId) {
  if (!userId) return null;

  try {
    const storedPin = localStorage.getItem(getOfflinePinStorageKey(userId));
    if (storedPin) return JSON.parse(storedPin);

    const offlineUser = readOfflineUsers().find(user => user.id === userId);
    if (offlineUser?.pinRecord) {
      localStorage.setItem(getOfflinePinStorageKey(userId), JSON.stringify(offlineUser.pinRecord));
      return offlineUser.pinRecord;
    }

    return null;
  } catch {
    return null;
  }
}

function bytesToBase64(bytes) {
  let binary = "";
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

async function deriveLegacyOfflinePinHash(pin, saltBytes, iterations) {
  const encodedPin = new TextEncoder().encode(pin);
  const key = await crypto.subtle.importKey("raw", encodedPin, "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: saltBytes,
      iterations,
    },
    key,
    256,
  );

  return bytesToBase64(new Uint8Array(bits));
}

function hashString32(value, seed) {
  let hash = seed >>> 0;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }

  return hash >>> 0;
}

function deriveOfflinePinHash(pin, salt, rounds) {
  const normalizedRounds = Number(rounds) || OFFLINE_PIN_HASH_ROUNDS;
  const segments = [];

  for (let segment = 0; segment < 8; segment += 1) {
    let hash = (2166136261 ^ segment) >>> 0;

    for (let round = 0; round < normalizedRounds; round += 1) {
      hash = hashString32(`${salt}:${pin}:${segment}:${round}:${hash}`, hash);
    }

    segments.push(hash.toString(16).padStart(8, "0"));
  }

  return segments.join("");
}

async function createOfflinePinRecord(pin) {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const salt = bytesToBase64(saltBytes);
  const hash = deriveOfflinePinHash(pin, salt, OFFLINE_PIN_HASH_ROUNDS);

  return {
    algorithm: OFFLINE_PIN_HASH_ALGORITHM,
    salt,
    hash,
    rounds: OFFLINE_PIN_HASH_ROUNDS,
    updatedAt: new Date().toISOString(),
  };
}

async function verifyOfflinePin(pin, record) {
  if (!record?.salt || !record?.hash) return false;
  if (record.algorithm === OFFLINE_PIN_HASH_ALGORITHM) {
    return deriveOfflinePinHash(pin, record.salt, record.rounds) === record.hash;
  }

  const iterations = Number(record.iterations) || LEGACY_OFFLINE_PIN_HASH_ITERATIONS;
  const hash = await deriveLegacyOfflinePinHash(pin, base64ToBytes(record.salt), iterations);
  return hash === record.hash;
}

function normalizeRecipeId(recipe) {
  const numericId = Number(recipe?.id);
  return Number.isFinite(numericId) ? numericId : Date.now();
}

function stripSyncMetadata(item) {
  if (Array.isArray(item)) return item.map(stripSyncMetadata);
  if (!item || typeof item !== "object") return item;
  const cleanItem = { ...item };
  delete cleanItem[LOCAL_UPDATED_AT_FIELD];
  delete cleanItem[REMOTE_UPDATED_AT_FIELD];

  return Object.fromEntries(
    Object.entries(cleanItem).map(([key, value]) => [key, stripSyncMetadata(value)]),
  );
}

function getSyncTimestamp(item, key) {
  const time = Date.parse(item?.[key] || "");
  return Number.isFinite(time) ? time : 0;
}

function hasMeaningfulDiff(leftItem, rightItem) {
  return JSON.stringify(stripSyncMetadata(leftItem)) !== JSON.stringify(stripSyncMetadata(rightItem));
}

function markLocalUpdate(item) {
  return {
    ...item,
    [LOCAL_UPDATED_AT_FIELD]: new Date().toISOString(),
  };
}

function mergeLocalAndRemoteItems(localItems, remoteItems, normalizeId, deletedIds = new Set()) {
  const localById = new Map((localItems || []).map(item => [normalizeId(item), item]));
  const remoteById = new Map((remoteItems || []).map(item => [normalizeId(item), item]));
  const ids = new Set([...localById.keys(), ...remoteById.keys()]);

  return [...ids].map((id) => {
    const localItem = localById.get(id);
    const remoteItem = remoteById.get(id);

    if (!localItem && remoteItem && deletedIds.has(Number(id))) return null;
    if (!remoteItem) return localItem;
    if (!localItem) return remoteItem;

    const localEditedAt = getSyncTimestamp(localItem, LOCAL_UPDATED_AT_FIELD);
    const localRemoteSeenAt = getSyncTimestamp(localItem, REMOTE_UPDATED_AT_FIELD);
    const remoteEditedAt = getSyncTimestamp(remoteItem, REMOTE_UPDATED_AT_FIELD);

    if (localEditedAt > remoteEditedAt) return localItem;
    if (remoteEditedAt > localRemoteSeenAt && localEditedAt === 0) return remoteItem;
    if (remoteEditedAt > localEditedAt) return remoteItem;
    if (hasMeaningfulDiff(localItem, remoteItem)) return localItem;
    return remoteItem;
  }).filter(Boolean);
}

function recipeToSupabaseRow(authUser, recipe) {
  const id = normalizeRecipeId(recipe);
  const recipeData = { ...stripSyncMetadata(recipe), id };

  if (recipeData.isPublic) {
    recipeData.authorDisplayName = recipeData.authorDisplayName || authUser.displayName || "";
  }

  return {
    user_id: authUser.id,
    id,
    recipe_data: recipeData,
    is_public: Boolean(recipeData.isPublic),
    published_at: recipeData.publishedAt || null,
  };
}

function recipeFromSupabaseRow(row) {
  return {
    ...(row.recipe_data || {}),
    id: Number(row.id),
    ownerUserId: row.user_id,
    isPublic: Boolean(row.is_public),
    publishedAt: row.published_at || row.recipe_data?.publishedAt || "",
    [REMOTE_UPDATED_AT_FIELD]: row.updated_at,
  };
}

function getCommunityRecipeKey(recipe) {
  return `${recipe?.ownerUserId || recipe?.sourceUserId || ""}:${normalizeRecipeId(recipe)}`;
}

function normalizeCostItemId(item) {
  const numericId = Number(item?.id);
  return Number.isFinite(numericId) ? numericId : Date.now();
}

function costItemToSupabaseRow(authUser, item) {
  const id = normalizeCostItemId(item);
  const itemData = { ...stripSyncMetadata(item), id };

  return {
    user_id: authUser.id,
    id,
    item_data: itemData,
  };
}

function costItemFromSupabaseRow(row) {
  return {
    ...(row.item_data || {}),
    id: Number(row.id),
    [REMOTE_UPDATED_AT_FIELD]: row.updated_at,
  };
}

function normalizeTempLogId(log) {
  const numericId = Number(log?.id);
  return Number.isFinite(numericId) ? numericId : Date.now();
}

function tempLogToSupabaseRow(authUser, log) {
  const id = normalizeTempLogId(log);
  const logData = { ...stripSyncMetadata(log), id };

  return {
    user_id: authUser.id,
    id,
    log_data: logData,
  };
}

function tempLogFromSupabaseRow(row) {
  return {
    ...(row.log_data || {}),
    id: Number(row.id),
    [REMOTE_UPDATED_AT_FIELD]: row.updated_at,
  };
}

async function loadSupabaseRecipes(authUser) {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("recipes")
    .select("user_id, id, recipe_data, is_public, published_at, created_at, updated_at")
    .eq("user_id", authUser.id)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(recipeFromSupabaseRow);
}

async function loadSupabaseCommunityRecipes() {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("recipes")
    .select("user_id, id, recipe_data, is_public, published_at, created_at, updated_at")
    .eq("is_public", true)
    .order("published_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(recipeFromSupabaseRow);
}

async function loadSupabaseCommunityBookmarks(authUser) {
  if (!supabase || !authUser) return [];

  const { data, error } = await supabase
    .from("community_bookmarks")
    .select("source_user_id, source_recipe_id")
    .eq("user_id", authUser.id);

  if (error) {
    console.warn("내빵니빵 북마크를 읽지 못했습니다.", error.message);
    return [];
  }

  return (data || []).map(row => `${row.source_user_id}:${Number(row.source_recipe_id)}`);
}

async function loadSupabaseCommunitySaveCounts() {
  if (!supabase) return {};

  const { data, error } = await supabase.rpc("get_community_save_counts");

  if (error) {
    console.warn("내빵니빵 저장 횟수를 읽지 못했습니다.", error.message);
    return {};
  }

  return (data || []).reduce((counts, row) => {
    counts[`${row.source_user_id}:${Number(row.source_recipe_id)}`] = Number(row.save_count) || 0;
    return counts;
  }, {});
}

async function loadSupabaseAnnouncements() {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("announcements")
    .select("id, title, body, is_active, created_at, updated_at")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("공지사항을 읽지 못했습니다.", error.message);
    return [];
  }

  return data || [];
}

async function loadSupabaseAnnouncementReads(authUser) {
  if (!supabase || !authUser) return [];

  const { data, error } = await supabase
    .from("announcement_reads")
    .select("announcement_id, read_at")
    .eq("user_id", authUser.id);

  if (error) {
    console.warn("공지사항 읽음 상태를 읽지 못했습니다.", error.message);
    return [];
  }

  return data || [];
}

async function loadSupabaseCostItems() {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("cost_items")
    .select("id, item_data, created_at, updated_at")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(costItemFromSupabaseRow);
}

async function loadSupabaseTempLogs() {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("temp_logs")
    .select("id, log_data, created_at, updated_at")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(tempLogFromSupabaseRow);
}

async function syncSupabaseRecipes(authUser, previousRecipes, nextRecipes) {
  if (!supabase || !authUser) return;

  const previousIds = new Set((previousRecipes || []).map(recipe => normalizeRecipeId(recipe)));
  const nextIds = new Set((nextRecipes || []).map(recipe => normalizeRecipeId(recipe)));
  const removedIds = [...previousIds].filter(id => !nextIds.has(id));
  const rows = (nextRecipes || []).map(recipe => recipeToSupabaseRow(authUser, recipe));

  if (rows.length > 0) {
    const { error } = await supabase
      .from("recipes")
      .upsert(rows, { onConflict: "user_id,id" });

    if (error) throw error;
  }

  if (removedIds.length > 0) {
    const { error } = await supabase
      .from("recipes")
      .delete()
      .eq("user_id", authUser.id)
      .in("id", removedIds);

    if (error) throw error;
  }
}

async function syncSupabaseCostItems(authUser, previousCostItems, nextCostItems) {
  if (!supabase || !authUser) return;

  const previousIds = new Set((previousCostItems || []).map(item => normalizeCostItemId(item)));
  const nextIds = new Set((nextCostItems || []).map(item => normalizeCostItemId(item)));
  const removedIds = [...previousIds].filter(id => !nextIds.has(id));
  const rows = (nextCostItems || []).map(item => costItemToSupabaseRow(authUser, item));

  if (rows.length > 0) {
    const { error } = await supabase
      .from("cost_items")
      .upsert(rows, { onConflict: "user_id,id" });

    if (error) throw error;
  }

  if (removedIds.length > 0) {
    const { error } = await supabase
      .from("cost_items")
      .delete()
      .eq("user_id", authUser.id)
      .in("id", removedIds);

    if (error) throw error;
  }
}

async function syncSupabaseTempLogs(authUser, previousTempLogs, nextTempLogs) {
  if (!supabase || !authUser) return;

  const previousIds = new Set((previousTempLogs || []).map(log => normalizeTempLogId(log)));
  const nextIds = new Set((nextTempLogs || []).map(log => normalizeTempLogId(log)));
  const removedIds = [...previousIds].filter(id => !nextIds.has(id));
  const rows = (nextTempLogs || []).map(log => tempLogToSupabaseRow(authUser, log));

  if (rows.length > 0) {
    const { error } = await supabase
      .from("temp_logs")
      .upsert(rows, { onConflict: "user_id,id" });

    if (error) throw error;
  }

  if (removedIds.length > 0) {
    const { error } = await supabase
      .from("temp_logs")
      .delete()
      .eq("user_id", authUser.id)
      .in("id", removedIds);

    if (error) throw error;
  }
}

function clearStoredAuthSession() {
  localStorage.removeItem(SUPABASE_AUTH_STORAGE_KEY);
  localStorage.removeItem(`${SUPABASE_AUTH_STORAGE_KEY}-user`);
  localStorage.removeItem(`${SUPABASE_AUTH_STORAGE_KEY}-code-verifier`);

  for (let i = localStorage.length - 1; i >= 0; i -= 1) {
    const key = localStorage.key(i);
    if (key?.startsWith("sb-") && key.endsWith("-auth-token")) {
      localStorage.removeItem(key);
      localStorage.removeItem(`${key}-user`);
      localStorage.removeItem(`${key}-code-verifier`);
    }
  }
}

function hasStoredAuthSession() {
  if (localStorage.getItem(SUPABASE_AUTH_STORAGE_KEY)) return true;

  for (let i = localStorage.length - 1; i >= 0; i -= 1) {
    const key = localStorage.key(i);
    if (key?.startsWith("sb-") && key.endsWith("-auth-token")) return true;
  }

  return false;
}

function hasActiveBrowserSession() {
  try {
    return sessionStorage.getItem(BROWSER_SESSION_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function markBrowserSessionActive() {
  try {
    sessionStorage.setItem(BROWSER_SESSION_STORAGE_KEY, "true");
  } catch {
    // sessionStorage can be unavailable in some private browsing contexts.
  }
}

function clearBrowserSessionMarker() {
  try {
    sessionStorage.removeItem(BROWSER_SESSION_STORAGE_KEY);
  } catch {
    // sessionStorage can be unavailable in some private browsing contexts.
  }
}

function isAuthRedirectRequest() {
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));

  return Boolean(
    searchParams.get("code")
    || searchParams.get("error")
    || searchParams.get("error_description")
    || hashParams.get("access_token")
    || hashParams.get("refresh_token")
    || hashParams.get("error")
    || hashParams.get("error_description")
  );
}

function getAuthRedirectError() {
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const message = searchParams.get("error_description")
    || hashParams.get("error_description")
    || searchParams.get("error")
    || hashParams.get("error")
    || "";

  if (message.includes("초대")) return INVITE_ONLY_MESSAGE;
  return message;
}

function getParisDateParts() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const valueByType = Object.fromEntries(parts.map(part => [part.type, part.value]));

  return {
    year: Number(valueByType.year),
    month: Number(valueByType.month),
    day: Number(valueByType.day),
    monthInitial: new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Paris",
      month: "long",
    }).format(new Date()).charAt(0).toUpperCase(),
    dateKey: `${valueByType.year}-${valueByType.month}-${valueByType.day}`,
  };
}

function getAdminUnlockPassword() {
  const { year, month, day, monthInitial } = getParisDateParts();
  const sum = String(year + month + day).padStart(4, "0");
  const firstTwo = Number(sum.slice(0, 2));
  const lastTwo = Number(sum.slice(-2));

  return `${firstTwo * lastTwo}${monthInitial}`;
}

function getAdminUnlockStorageKey(authUser) {
  const { dateKey } = getParisDateParts();
  return `${ADMIN_UNLOCK_STORAGE_PREFIX}:${authUser.id}:${dateKey}`;
}

function clearAdminUnlock(authUser) {
  if (!authUser?.id) return;

  try {
    sessionStorage.removeItem(getAdminUnlockStorageKey(authUser));
  } catch {
    // Session storage is only a convenience; role/RLS still protects admin data.
  }
}

async function getSupabaseAuthUser(session) {
  const user = session?.user;
  if (!user) return null;

  let role = null;
  let displayName = "";
  if (supabase) {
    let { data, error } = await supabase
      .from("profiles")
      .select("id, role, display_name")
      .eq("id", user.id)
      .maybeSingle();

    if (error?.message?.includes("display_name")) {
      const fallback = await supabase
        .from("profiles")
        .select("id, role")
        .eq("id", user.id)
        .maybeSingle();
      data = fallback.data;
      error = fallback.error;
    }

    if (error) console.warn("프로필 정보를 읽지 못해 권한을 미지정으로 표시합니다.", error.message);
    else if (!data) {
      await supabase.auth.signOut({ scope: "local" });
      throw new Error(INVITE_ONLY_MESSAGE);
    } else if (!APP_ACCESS_ROLES.includes(data.role)) {
      await supabase.auth.signOut({ scope: "local" });
      throw new Error(INVITE_ONLY_MESSAGE);
    } else {
      role = data.role || null;
      displayName = data.display_name || "";
    }
  }

  return {
    id: user.id,
    name: user.user_metadata?.full_name || user.user_metadata?.name || user.email,
    email: user.email,
    picture: user.user_metadata?.avatar_url || user.user_metadata?.picture || "",
    role,
    displayName,
    signedInAt: new Date().toISOString(),
  };
}

export default function Home() {
  const [view, setView] = useState("calc");
  const [recipes, setRecipes] = useState([]);
  const [communityRecipes, setCommunityRecipes] = useState([]);
  const [communityBookmarks, setCommunityBookmarks] = useState([]);
  const [communitySaveCounts, setCommunitySaveCounts] = useState({});
  const [announcements, setAnnouncements] = useState([]);
  const [announcementReads, setAnnouncementReads] = useState([]);
  const [costItems, setCostItems] = useState([]);
  const [tempLogs, setTempLogs] = useState([]);
  const [authUser, setAuthUser] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [userDataLoaded, setUserDataLoaded] = useState(false);
  const [userDataOwnerId, setUserDataOwnerId] = useState(null);
  const [skipCalcLeaveCheck, setSkipCalcLeaveCheck] = useState(false);
  const [pendingView, setPendingView] = useState(null);
  const [pendingCalcAction, setPendingCalcAction] = useState(null);
  const [leaveCheckStep, setLeaveCheckStep] = useState(null);
  const [hideLeaveCheck, setHideLeaveCheck] = useState(false);
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [isAdminUnlockOpen, setIsAdminUnlockOpen] = useState(false);
  const [adminUnlockError, setAdminUnlockError] = useState("");
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE);
  const [authError, setAuthError] = useState("");
  const [isOnline, setIsOnline] = useState(true);
  const [hasOfflinePin, setHasOfflinePin] = useState(false);
  const [offlineLoginUsers, setOfflineLoginUsers] = useState([]);
  const recipesSnapshotRef = useRef([]);
  const costItemsSnapshotRef = useRef([]);
  const tempLogsSnapshotRef = useRef([]);
  const lastHiddenAtRef = useRef(null);
  const t = getTranslator(language);
  const isAdmin = authUser?.role === "admin";
  const unreadAnnouncementCount = useMemo(() => {
    const readIds = new Set(announcementReads.map(read => Number(read.announcement_id)));
    return announcements.filter(announcement => announcement.is_active !== false && !readIds.has(Number(announcement.id))).length;
  }, [announcementReads, announcements]);

  const lockOfflineSessionForPin = useCallback(() => {
    if (!authUser?.id || navigator.onLine) return;
    if (!readOfflinePinRecord(authUser.id)) return;

    const cachedUser = readOfflineUsers().find(user => user.id === authUser.id) || normalizeOfflineUser(authUser);
    if (!cachedUser) return;

    setOfflineLoginUsers([cachedUser]);
    setHasOfflinePin(true);
    setAuthError(t("offlinePinPrompt"));
    clearAdminUnlock(authUser);
    setAuthUser(null);
    setUserDataLoaded(false);
    setUserDataOwnerId(null);
    setIsAdminUnlocked(false);
  }, [authUser, t]);

  useEffect(() => {
    const updateOnlineStatus = () => {
      const nextIsOnline = navigator.onLine;
      setIsOnline(nextIsOnline);
      if (!nextIsOnline) {
        setView(prevView => (OFFLINE_ALLOWED_VIEWS.includes(prevView) ? prevView : "calc"));
      }
    };

    updateOnlineStatus();
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);

    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

  useEffect(() => {
    const markAppHidden = () => {
      lastHiddenAtRef.current = Date.now();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        markAppHidden();
        return;
      }

      if (document.visibilityState !== "visible") return;

      const hiddenAt = lastHiddenAtRef.current;
      if (!hiddenAt) return;

      if (Date.now() - hiddenAt >= OFFLINE_PIN_REAUTH_AFTER_MS) {
        lockOfflineSessionForPin();
      }

      lastHiddenAtRef.current = null;
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [lockOfflineSessionForPin]);

  // 로컬스토리지 로드
  useEffect(() => {
    let isMounted = true;

    const loadApp = async () => {
      try {
        const savedSkipCalcLeaveCheck = localStorage.getItem("bakery_skip_calc_leave_check");
        const savedLanguage = localStorage.getItem("bakery_language");
        const redirectError = getAuthRedirectError();
        if (savedSkipCalcLeaveCheck === "true") setSkipCalcLeaveCheck(true);
        if (LANGUAGES.some(lang => lang.code === savedLanguage)) setLanguage(savedLanguage);
        if (redirectError) setAuthError(decodeURIComponent(redirectError.replace(/\+/g, " ")));
        localStorage.removeItem("bakery_auth_user");

        if (!navigator.onLine) {
          const promptTranslator = getTranslator(LANGUAGES.some(lang => lang.code === savedLanguage) ? savedLanguage : DEFAULT_LANGUAGE);
          const offlineUsers = readOfflineUsers().filter(user => readOfflinePinRecord(user.id));
          setIsOnline(false);

          if (offlineUsers.length > 0) {
            setOfflineLoginUsers(offlineUsers);
            setHasOfflinePin(true);
          } else {
            setAuthError(readOfflineUsers().length > 0 ? promptTranslator("offlinePinMissing") : promptTranslator("offlineNoCachedUser"));
          }

          return;
        }

        if (!hasActiveBrowserSession() && !isAuthRedirectRequest() && hasStoredAuthSession()) {
          clearStoredAuthSession();
          await supabase?.auth.signOut({ scope: "local" }).catch(() => {});
        }

        markBrowserSessionActive();

        if (supabase) {
          const { data, error } = await supabase.auth.getSession();
          if (error) throw error;
          const nextUser = await getSupabaseAuthUser(data.session);
          if (nextUser) writeOfflineUser(nextUser);
          if (isMounted) {
            setAuthUser(nextUser);
            setHasOfflinePin(Boolean(nextUser?.id && readOfflinePinRecord(nextUser.id)));
          }
        }
      } catch (e) {
        if (e.message === INVITE_ONLY_MESSAGE) {
          if (isMounted) {
            setAuthUser(null);
            setAuthError(INVITE_ONLY_MESSAGE);
          }
        } else {
          console.error("앱 데이터를 읽는 중 오류가 발생했습니다.", e);
        }
      } finally {
        if (isMounted) setIsLoaded(true);
      }
    };

    loadApp();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isLoaded) return;

    let isMounted = true;

    const loadScopedUserData = async () => {
      await Promise.resolve();
      if (!isMounted) return;

      if (!authUser) {
        setRecipes([]);
        setCommunityRecipes([]);
        setCommunityBookmarks([]);
        setCommunitySaveCounts({});
        setAnnouncements([]);
        setAnnouncementReads([]);
        setCostItems([]);
        setTempLogs([]);
        setUserDataLoaded(false);
        setUserDataOwnerId(null);
        setIsAdminUnlocked(false);
        return;
      }

      try {
        setUserDataLoaded(false);
        const userData = loadUserData(authUser);
        let nextRecipes = userData.recipes;
        let nextCostItems = userData.costItems;
        let nextTempLogs = userData.tempLogs;
        const deletedRecipeIds = readDeletedUserDataIds(authUser, USER_DATA_STORAGE_KEYS.recipes);
        const deletedCostItemIds = readDeletedUserDataIds(authUser, USER_DATA_STORAGE_KEYS.costItems);
        const deletedTempLogIds = readDeletedUserDataIds(authUser, USER_DATA_STORAGE_KEYS.tempLogs);

        if (supabase && !authUser.isOfflineMode && navigator.onLine) {
          try {
            const [
              remoteRecipes,
              remoteCommunityRecipes,
              remoteCostItems,
              remoteTempLogs,
              remoteCommunityBookmarks,
              remoteCommunitySaveCounts,
              remoteAnnouncements,
              remoteAnnouncementReads,
            ] = await Promise.all([
              loadSupabaseRecipes(authUser),
              loadSupabaseCommunityRecipes(),
              loadSupabaseCostItems(),
              loadSupabaseTempLogs(),
              loadSupabaseCommunityBookmarks(authUser),
              loadSupabaseCommunitySaveCounts(),
              loadSupabaseAnnouncements(),
              loadSupabaseAnnouncementReads(authUser),
            ]);

            setCommunityRecipes(remoteCommunityRecipes);
            setCommunityBookmarks(remoteCommunityBookmarks);
            setCommunitySaveCounts(remoteCommunitySaveCounts);
            setAnnouncements(remoteAnnouncements);
            setAnnouncementReads(remoteAnnouncementReads);

            if (remoteRecipes.length > 0) {
              nextRecipes = mergeLocalAndRemoteItems(userData.recipes, remoteRecipes, normalizeRecipeId, deletedRecipeIds);
              if (hasMeaningfulDiff(nextRecipes, remoteRecipes)) {
                await syncSupabaseRecipes(authUser, remoteRecipes, nextRecipes);
              }
            } else if (userData.recipes.length > 0) {
              await syncSupabaseRecipes(authUser, [], userData.recipes);
            }

            if (remoteCostItems.length > 0) {
              nextCostItems = mergeLocalAndRemoteItems(userData.costItems, remoteCostItems, normalizeCostItemId, deletedCostItemIds);
              if (hasMeaningfulDiff(nextCostItems, remoteCostItems)) {
                await syncSupabaseCostItems(authUser, remoteCostItems, nextCostItems);
              }
            } else if (userData.costItems.length > 0) {
              await syncSupabaseCostItems(authUser, [], userData.costItems);
            }

            if (remoteTempLogs.length > 0) {
              nextTempLogs = mergeLocalAndRemoteItems(userData.tempLogs, remoteTempLogs, normalizeTempLogId, deletedTempLogIds);
              if (hasMeaningfulDiff(nextTempLogs, remoteTempLogs)) {
                await syncSupabaseTempLogs(authUser, remoteTempLogs, nextTempLogs);
              }
            } else if (userData.tempLogs.length > 0) {
              await syncSupabaseTempLogs(authUser, [], userData.tempLogs);
            }

            clearDeletedUserDataIds(authUser, USER_DATA_STORAGE_KEYS.recipes);
            clearDeletedUserDataIds(authUser, USER_DATA_STORAGE_KEYS.costItems);
            clearDeletedUserDataIds(authUser, USER_DATA_STORAGE_KEYS.tempLogs);
          } catch (error) {
            console.warn("Supabase 데이터 테이블을 사용할 수 없어 로컬 데이터로 계속합니다.", error?.message || error);
          }
        }

        if (!isMounted) return;
        recipesSnapshotRef.current = nextRecipes;
        costItemsSnapshotRef.current = nextCostItems;
        tempLogsSnapshotRef.current = nextTempLogs;
        setRecipes(nextRecipes);
        setCostItems(nextCostItems);
        setTempLogs(nextTempLogs);
        setUserDataOwnerId(authUser.id);
        setUserDataLoaded(true);
      } catch (e) {
        if (!isMounted) return;
        console.warn("사용자별 앱 데이터를 읽는 중 오류가 발생했습니다.", e?.message || e);
        setRecipes([]);
        setCommunityRecipes([]);
        setCommunityBookmarks([]);
        setCommunitySaveCounts({});
        setAnnouncements([]);
        setAnnouncementReads([]);
        setCostItems([]);
        setTempLogs([]);
        setUserDataOwnerId(authUser.id);
        setUserDataLoaded(true);
      }
    };

    loadScopedUserData();

    return () => {
      isMounted = false;
    };
  }, [authUser, isLoaded]);

  // 로컬스토리지 저장
  useEffect(() => {
    if (isLoaded && authUser && userDataLoaded && userDataOwnerId === authUser.id) {
      try {
        saveUserData(authUser, recipes, costItems, tempLogs);
      } catch (e) {
        console.error("로컬스토리지 데이터 저장 중 오류가 발생했습니다.", e);
      }
    }
  }, [recipes, costItems, tempLogs, authUser, userDataLoaded, userDataOwnerId, isLoaded]);

  useEffect(() => {
    if (!isLoaded || !authUser || authUser.isOfflineMode || !isOnline || !userDataLoaded || userDataOwnerId !== authUser.id || !supabase) return undefined;

    let isCancelled = false;
    const previousRecipes = recipesSnapshotRef.current;
    const nextRecipes = recipes;

    const persistRecipes = async () => {
      try {
        await syncSupabaseRecipes(authUser, previousRecipes, nextRecipes);
        if (!isCancelled) recipesSnapshotRef.current = nextRecipes;
      } catch (error) {
        console.warn("Supabase 레시피 저장 중 오류가 발생했습니다.", error?.message || error);
      }
    };

    persistRecipes();

    return () => {
      isCancelled = true;
    };
  }, [recipes, authUser, userDataLoaded, userDataOwnerId, isLoaded, isOnline]);

  useEffect(() => {
    if (!isLoaded || !authUser || authUser.isOfflineMode || !isOnline || !userDataLoaded || userDataOwnerId !== authUser.id || !supabase) return undefined;

    let isCancelled = false;
    const previousCostItems = costItemsSnapshotRef.current;
    const nextCostItems = costItems;

    const persistCostItems = async () => {
      try {
        await syncSupabaseCostItems(authUser, previousCostItems, nextCostItems);
        if (!isCancelled) costItemsSnapshotRef.current = nextCostItems;
      } catch (error) {
        console.warn("Supabase 재료비 저장 중 오류가 발생했습니다.", error?.message || error);
      }
    };

    persistCostItems();

    return () => {
      isCancelled = true;
    };
  }, [costItems, authUser, userDataLoaded, userDataOwnerId, isLoaded, isOnline]);

  useEffect(() => {
    if (!isLoaded || !authUser || authUser.isOfflineMode || !isOnline || !userDataLoaded || userDataOwnerId !== authUser.id || !supabase) return undefined;

    let isCancelled = false;
    const previousTempLogs = tempLogsSnapshotRef.current;
    const nextTempLogs = tempLogs;

    const persistTempLogs = async () => {
      try {
        await syncSupabaseTempLogs(authUser, previousTempLogs, nextTempLogs);
        if (!isCancelled) tempLogsSnapshotRef.current = nextTempLogs;
      } catch (error) {
        console.warn("Supabase 온도/pH 저장 중 오류가 발생했습니다.", error?.message || error);
      }
    };

    persistTempLogs();

    return () => {
      isCancelled = true;
    };
  }, [tempLogs, authUser, userDataLoaded, userDataOwnerId, isLoaded, isOnline]);

  const updateRecipes = useCallback((nextRecipesOrUpdater) => {
    setRecipes(prev => {
      const nextRecipes = typeof nextRecipesOrUpdater === "function"
        ? nextRecipesOrUpdater(prev)
        : nextRecipesOrUpdater;
      const nextIds = new Set((nextRecipes || []).map(recipe => normalizeRecipeId(recipe)));
      const removedIds = prev
        .map(recipe => normalizeRecipeId(recipe))
        .filter(id => !nextIds.has(id));
      recordDeletedUserDataIds(authUser, USER_DATA_STORAGE_KEYS.recipes, removedIds);

      return (nextRecipes || []).map(recipe => ({
        ...markLocalUpdate(recipe),
        id: normalizeRecipeId(recipe),
      }));
    });
  }, [authUser]);

  const requireOnlineFeature = async () => {
    if (!navigator.onLine) throw new Error(t("communityOnlineRequired"));

    try {
      const response = await fetch("/api/connectivity", {
        method: "POST",
        cache: "no-store",
      });

      if (!response.ok) throw new Error(t("communityOnlineRequired"));
    } catch {
      setIsOnline(false);
      throw new Error(t("communityOnlineRequired"));
    }
  };

  const markAnnouncementsAsRead = useCallback(async (announcementIds) => {
    if (!supabase || !authUser || authUser.isOfflineMode || !navigator.onLine || announcementIds.length === 0) return;

    const rows = announcementIds.map(id => ({
      announcement_id: Number(id),
      user_id: authUser.id,
      read_at: new Date().toISOString(),
    }));

    const { data, error } = await supabase
      .from("announcement_reads")
      .upsert(rows, { onConflict: "announcement_id,user_id" })
      .select("announcement_id, read_at");

    if (error) {
      console.warn("공지사항 읽음 처리에 실패했습니다.", error.message);
      return;
    }

    setAnnouncementReads(prev => {
      const byId = new Map(prev.map(read => [Number(read.announcement_id), read]));
      (data || rows).forEach(read => byId.set(Number(read.announcement_id), read));
      return [...byId.values()];
    });
  }, [authUser]);

  const markUnreadAnnouncementsWhenOpeningSettings = () => {
    if (unreadAnnouncementCount === 0) return;
    const readIds = new Set(announcementReads.map(read => Number(read.announcement_id)));
    const unreadIds = announcements
      .filter(announcement => announcement.is_active !== false && !readIds.has(Number(announcement.id)))
      .map(announcement => announcement.id);

    markAnnouncementsAsRead(unreadIds);
  };

  const toggleRecipeCommunityVisibility = async (recipeId, nextIsPublic) => {
    await requireOnlineFeature();
    if (!supabase || !authUser) throw new Error(t("supabaseClientMissing"));

    const currentRecipe = recipes.find(recipe => recipe.id === recipeId);
    if (!currentRecipe) throw new Error(t("communityVisibilitySaveFailed"));

    const nextRecipe = {
      ...currentRecipe,
      isPublic: nextIsPublic,
      publishedAt: nextIsPublic ? currentRecipe.publishedAt || new Date().toISOString() : currentRecipe.publishedAt,
      authorDisplayName: nextIsPublic ? currentRecipe.authorDisplayName || authUser.displayName || "" : currentRecipe.authorDisplayName || "",
    };
    const { error } = await supabase
      .from("recipes")
      .upsert(recipeToSupabaseRow(authUser, nextRecipe), { onConflict: "user_id,id" });

    if (error) throw error;

    recipesSnapshotRef.current = recipesSnapshotRef.current.map(recipe => (
      recipe.id === recipeId ? nextRecipe : recipe
    ));
    setRecipes(prev => prev.map(recipe => (
      recipe.id === recipeId ? nextRecipe : recipe
    )));
  };

  const visibleCommunityRecipes = useMemo(() => {
    const ownPublicRecipes = recipes
      .filter(recipe => recipe.isPublic)
      .map(recipe => ({
        ...recipe,
        ownerUserId: recipe.ownerUserId || authUser?.id,
        authorDisplayName: recipe.authorDisplayName || authUser?.displayName || "",
      }));
    const ownRecipeKeys = new Set(recipes.map(recipe => `${recipe.ownerUserId || authUser?.id || ""}:${recipe.id}`));
    const remotePublicRecipes = communityRecipes.filter(recipe => !ownRecipeKeys.has(`${recipe.ownerUserId || ""}:${recipe.id}`));

    return [...ownPublicRecipes, ...remotePublicRecipes];
  }, [authUser?.displayName, authUser?.id, communityRecipes, recipes]);

  const refreshCommunitySaveCounts = async () => {
    const nextCounts = await loadSupabaseCommunitySaveCounts();
    setCommunitySaveCounts(nextCounts);
  };

  const recordCommunitySave = async (recipe) => {
    if (!supabase || !authUser || !recipe?.ownerUserId || recipe.ownerUserId === authUser.id) return;

    const { error } = await supabase
      .rpc("record_community_save", {
        p_source_user_id: recipe.ownerUserId,
        p_source_recipe_id: normalizeRecipeId(recipe),
      });

    if (error) {
      console.warn("내빵니빵 저장 횟수를 기록하지 못했습니다.", error.message);
      return;
    }

    const recipeKey = getCommunityRecipeKey(recipe);
    setCommunitySaveCounts(prev => ({
      ...prev,
      [recipeKey]: (prev[recipeKey] || 0) + 1,
    }));
    await refreshCommunitySaveCounts();
  };

  const toggleCommunityBookmark = async (recipe) => {
    try {
      await requireOnlineFeature();
    } catch {
      alert(t("communityOnlineRequired"));
      return false;
    }

    if (!supabase || !authUser) return false;

    const recipeKey = getCommunityRecipeKey(recipe);
    const isBookmarked = communityBookmarks.includes(recipeKey);
    const nextBookmarks = isBookmarked
      ? communityBookmarks.filter(key => key !== recipeKey)
      : [...communityBookmarks, recipeKey];

    setCommunityBookmarks(nextBookmarks);

    const request = isBookmarked
      ? supabase
        .from("community_bookmarks")
        .delete()
        .eq("source_user_id", recipe.ownerUserId)
        .eq("source_recipe_id", normalizeRecipeId(recipe))
        .eq("user_id", authUser.id)
      : supabase
        .from("community_bookmarks")
        .insert({
          source_user_id: recipe.ownerUserId,
          source_recipe_id: normalizeRecipeId(recipe),
          user_id: authUser.id,
        });

    const { error } = await request;

    if (error) {
      setCommunityBookmarks(communityBookmarks);
      console.warn("내빵니빵 북마크를 저장하지 못했습니다.", error.message);
      alert(t("communityBookmarkSaveFailed"));
      return false;
    }

    return true;
  };

  const copyCommunityImage = async (recipe) => {
    if (!recipe.communityImageKey || !supabase) {
      return {
        communityImage: recipe.communityImage?.startsWith("data:image/") ? recipe.communityImage : "",
        communityImageKey: recipe.communityImageKey || "",
      };
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;

    const accessToken = sessionData.session?.access_token;
    if (!accessToken) throw new Error("Login session is missing.");

    const response = await fetch("/api/r2/copy", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sourceKey: recipe.communityImageKey,
      }),
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Image copy failed.");
    }

    return {
      communityImage: "",
      communityImageKey: result.key,
    };
  };

  const saveCommunityRecipeToDb = async (recipe) => {
    try {
      await requireOnlineFeature();
    } catch {
      alert(t("communityOnlineRequired"));
      return false;
    }

    const copiedImage = await copyCommunityImage(recipe);

    updateRecipes(prev => {
      const numericIds = prev.map(item => Number(item.id)).filter(Number.isFinite);
      const nextId = numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1;

      return [
        ...prev,
        {
          ...recipe,
          ...copiedImage,
          id: nextId,
          ownerUserId: authUser?.id,
          productName: `${recipe.productName} ${t("communityCopySuffix")}`,
          isPublic: false,
          publishedAt: "",
          sourceRecipeId: recipe.sourceRecipeId || recipe.id,
          sourceUserId: recipe.ownerUserId || "",
          sourceAuthorDisplayName: recipe.authorDisplayName || "",
          savedFromCommunityAt: recipe.publishedAt || "",
        },
      ];
    });

    await recordCommunitySave(recipe);

    return true;
  };

  const updatePublicDisplayName = async (displayName) => {
    await requireOnlineFeature();
    if (!supabase || !authUser) throw new Error(t("supabaseClientMissing"));

    const normalizedDisplayName = displayName.trim();
    const { error } = await supabase
      .rpc("update_public_display_name", { public_display_name: normalizedDisplayName });

    if (error) throw error;

    setAuthUser(prev => {
      if (!prev) return prev;
      const nextUser = { ...prev, displayName: normalizedDisplayName };
      writeOfflineUser(nextUser);
      return nextUser;
    });

    updateRecipes(prev => prev.map(recipe => (
      recipe.isPublic
        ? { ...recipe, authorDisplayName: normalizedDisplayName }
        : recipe
    )));
  };

  const updateCostItems = useCallback((nextCostItemsOrUpdater) => {
    setCostItems(prev => {
      const nextCostItems = typeof nextCostItemsOrUpdater === "function"
        ? nextCostItemsOrUpdater(prev)
        : nextCostItemsOrUpdater;
      const nextIds = new Set((nextCostItems || []).map(item => normalizeCostItemId(item)));
      const removedIds = prev
        .map(item => normalizeCostItemId(item))
        .filter(id => !nextIds.has(id));
      recordDeletedUserDataIds(authUser, USER_DATA_STORAGE_KEYS.costItems, removedIds);

      return (nextCostItems || []).map(item => ({
        ...markLocalUpdate(item),
        id: normalizeCostItemId(item),
      }));
    });
  }, [authUser]);

  const updateTempLogs = useCallback((nextTempLogsOrUpdater) => {
    setTempLogs(prev => {
      const nextTempLogs = typeof nextTempLogsOrUpdater === "function"
        ? nextTempLogsOrUpdater(prev)
        : nextTempLogsOrUpdater;
      const nextIds = new Set((nextTempLogs || []).map(log => normalizeTempLogId(log)));
      const removedIds = prev
        .map(log => normalizeTempLogId(log))
        .filter(id => !nextIds.has(id));
      recordDeletedUserDataIds(authUser, USER_DATA_STORAGE_KEYS.tempLogs, removedIds);

      return (nextTempLogs || []).map(log => ({
        ...markLocalUpdate(log),
        id: normalizeTempLogId(log),
      }));
    });
  }, [authUser]);

  useEffect(() => {
    if (!supabase) return undefined;

    let isMounted = true;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!navigator.onLine) return;

      markBrowserSessionActive();

      getSupabaseAuthUser(session)
        .then(user => {
          if (user) writeOfflineUser(user);
          if (isMounted) {
            setAuthUser(user);
            setHasOfflinePin(Boolean(user?.id && readOfflinePinRecord(user.id)));
          }
        })
        .catch(error => {
          if (error.message === INVITE_ONLY_MESSAGE) {
            if (isMounted) {
              setAuthUser(null);
              setAuthError(INVITE_ONLY_MESSAGE);
            }
          } else {
            console.error("로그인 상태를 갱신하는 중 오류가 발생했습니다.", error);
          }
        });
    });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const isLimitedOfflineMode = Boolean(authUser?.isOfflineMode || !isOnline);
  const canUseView = (nextView) => !isLimitedOfflineMode || OFFLINE_ALLOWED_VIEWS.includes(nextView);
  const effectiveHasOfflinePin = authUser?.id
    ? Boolean(readOfflinePinRecord(authUser.id)) || hasOfflinePin
    : hasOfflinePin;

  const saveLeaveCheckPreference = () => {
    if (!hideLeaveCheck) return;
    localStorage.setItem("bakery_skip_calc_leave_check", "true");
    setSkipCalcLeaveCheck(true);
  };

  const closeLeaveCheck = () => {
    setPendingView(null);
    setPendingCalcAction(null);
    setLeaveCheckStep(null);
    setHideLeaveCheck(false);
  };

  const requestCalcSafetyCheck = (afterConfirm) => {
    if (skipCalcLeaveCheck) {
      afterConfirm();
      return;
    }

    setPendingCalcAction(() => afterConfirm);
    setLeaveCheckStep("salt");
    setHideLeaveCheck(false);
  };

  const moveToView = (nextView) => {
    if (nextView === view) return;

    if (!canUseView(nextView)) {
      alert(t("offlineFeatureBlocked"));
      return;
    }

    const enterView = () => {
      if (nextView === "settings") markUnreadAnnouncementsWhenOpeningSettings();
      setView(nextView);
    };

    if (nextView === "admin" && isAdmin && !isAdminUnlocked) {
      try {
        if (sessionStorage.getItem(getAdminUnlockStorageKey(authUser)) === "true") {
          setIsAdminUnlocked(true);
        } else {
          setAdminUnlockError("");
          setIsAdminUnlockOpen(true);
          return;
        }
      } catch {
        setAdminUnlockError("");
        setIsAdminUnlockOpen(true);
        return;
      }
    }

    if (view === "calc" && nextView !== "calc" && !skipCalcLeaveCheck) {
      requestCalcSafetyCheck(enterView);
      setPendingView(nextView);
      return;
    }

    enterView();
  };

  const restoreCalcLeaveCheck = () => {
    localStorage.removeItem("bakery_skip_calc_leave_check");
    setSkipCalcLeaveCheck(false);
  };

  const changeLanguage = (nextLanguage) => {
    setLanguage(nextLanguage);
    localStorage.setItem("bakery_language", nextLanguage);
  };

  const handleGoogleSignIn = async () => {
    setAuthError("");

    if (!navigator.onLine) {
      setAuthError(t("offlineNoLogin"));
      return;
    }

    if (!supabase) {
      setAuthError(t("supabaseClientMissing"));
      return;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          prompt: "select_account",
        },
      },
    });

    if (error) setAuthError(error.message);
  };

  const handleOfflinePinSignIn = async (userId, pin) => {
    const offlineUser = readOfflineUsers().find(user => user.id === userId);
    if (!offlineUser) {
      setAuthError(t("offlineNoCachedUser"));
      return false;
    }

    const offlinePinRecord = readOfflinePinRecord(offlineUser.id);
    if (!offlinePinRecord) {
      setAuthError(t("offlinePinMissing"));
      return false;
    }

    const isPinValid = await verifyOfflinePin(pin.trim(), offlinePinRecord);
    if (!isPinValid) {
      setAuthError(t("offlinePinWrong"));
      return false;
    }

    setAuthUser({
      ...offlineUser,
      isOfflineMode: true,
    });
    setOfflineLoginUsers([]);
    setHasOfflinePin(true);
    setAuthError("");
    return true;
  };

  const handleSignOut = async () => {
    if (!confirm(t("signOutConfirm"))) return;

    if (supabase && !authUser?.isOfflineMode) await supabase.auth.signOut();
    clearStoredAuthSession();
    clearBrowserSessionMarker();
    if (authUser?.id) {
      removeOfflineUser(authUser.id);
    }
    clearAdminUnlock(authUser);
    clearUserData(authUser);
    setAuthUser(null);
    setOfflineLoginUsers([]);
    setHasOfflinePin(false);
    setUserDataLoaded(false);
    setUserDataOwnerId(null);
    setIsAdminUnlocked(false);
    localStorage.removeItem("bakery_auth_user");
  };

  const handleSetOfflinePin = async (pin) => {
    if (!authUser?.id) return;
    const record = await createOfflinePinRecord(pin);
    writeOfflinePinRecord(authUser.id, record);
  };

  const handleVerifyOfflinePin = async (pin) => {
    if (!authUser?.id) return false;
    const record = readOfflinePinRecord(authUser.id);
    return verifyOfflinePin(pin.trim(), record);
  };

  const confirmAdminUnlock = (password) => {
    if (password.trim() !== getAdminUnlockPassword()) {
      setAdminUnlockError(t("adminUnlockWrongPassword"));
      return;
    }

    try {
      sessionStorage.setItem(getAdminUnlockStorageKey(authUser), "true");
    } catch {
      // Session storage is only a convenience; role/RLS still protects admin data.
    }

    setIsAdminUnlocked(true);
    setIsAdminUnlockOpen(false);
    setAdminUnlockError("");
    setView("admin");
  };

  const confirmLeaveCheck = () => {
    saveLeaveCheckPreference();

    if (leaveCheckStep === "salt") {
      setLeaveCheckStep("yeast");
      return;
    }

    if (pendingCalcAction) pendingCalcAction();
    else if (pendingView) setView(pendingView);
    closeLeaveCheck();
  };

  if (!isLoaded) return <div className="min-h-screen bg-[#f7f6f3]" />;
  if (!authUser) {
    return (
      <LoginScreen
        t={t}
        isOnline={isOnline}
        offlineLoginUsers={offlineLoginUsers}
        onGoogleSignIn={handleGoogleSignIn}
        onOfflinePinSignIn={handleOfflinePinSignIn}
        authError={authError}
      />
    );
  }
  if (!userDataLoaded) return <div className="min-h-screen bg-[#f7f6f3]" />;

  return (
    <div className="min-h-screen bg-[#f7f6f3] pb-10 print:bg-white print:pb-0">
      {isLimitedOfflineMode && (
        <div className="bg-black px-4 py-2 text-center text-xs font-black text-white print:hidden">
          {t("offlineModeBanner")}
        </div>
      )}
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm print:hidden">
        <div className="flex gap-4 md:gap-8 p-4 md:p-6 md:px-40 justify-start md:justify-center overflow-x-auto whitespace-nowrap no-scrollbar">
          <NavButton active={view === "calc"} onClick={() => moveToView("calc")}>{t("navRecipeCalculator")}</NavButton>
          <NavButton active={view === "db"} onClick={() => moveToView("db")}>{t("navRecipeDb")}</NavButton>
          <NavButton active={view === "cost_db"} onClick={() => moveToView("cost_db")}>{t("navCostDb")}</NavButton>
          <NavButton active={view === "temp_db"} onClick={() => moveToView("temp_db")}>{t("navTempPh")}</NavButton>
          {!isLimitedOfflineMode && <NavButton active={view === "community"} onClick={() => moveToView("community")}>{t("navCommunity")}</NavButton>}
          {!isLimitedOfflineMode && <NavButton active={view === "videos"} onClick={() => moveToView("videos")}>{t("navVideos")}</NavButton>}
          {!isLimitedOfflineMode && isAdmin && <NavButton active={view === "admin"} onClick={() => moveToView("admin")}>{t("navAdmin")}</NavButton>}
          {!isLimitedOfflineMode && <NavButton active={view === "settings"} onClick={() => moveToView("settings")}>{unreadAnnouncementCount > 0 ? t("navSettingsUnread") : t("navSettings")}</NavButton>}
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="absolute right-4 top-1/2 hidden -translate-y-1/2 items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 text-xs font-black text-gray-500 md:flex md:right-6"
          title={t("signOut")}
        >
          {authUser.picture ? (
            <span
              aria-hidden="true"
              className="h-6 w-6 rounded-full bg-cover bg-center"
              style={{ backgroundImage: `url(${authUser.picture})` }}
            />
          ) : (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black text-[10px] text-white">
              {authUser.name?.[0] || "U"}
            </span>
          )}
          <span className="max-w-28 truncate">{authUser.name || authUser.email}</span>
        </button>
      </nav>

      <div className="py-4 md:py-8 print:py-0">
        {view === "calc" && <RecipeCalculator t={t} recipes={recipes} setRecipes={updateRecipes} costItems={costItems} tempLogs={tempLogs} setTempLogs={updateTempLogs} requestSafetyCheck={requestCalcSafetyCheck} />}
        {view === "db" && <RecipeDB t={t} recipes={recipes} setRecipes={updateRecipes} costItems={costItems} setCostItems={updateCostItems} isOnline={isOnline} isMediaDisabled={isLimitedOfflineMode} onRequireOnline={requireOnlineFeature} onToggleCommunityVisibility={toggleRecipeCommunityVisibility} />}
        {view === "community" && (
          <MyBreadYourBread
            t={t}
            recipes={visibleCommunityRecipes}
            bookmarkedRecipeKeys={communityBookmarks}
            saveCounts={communitySaveCounts}
            onSaveCommunityRecipe={saveCommunityRecipeToDb}
            onToggleBookmark={toggleCommunityBookmark}
          />
        )}
        {view === "videos" && <BreadVideos t={t} />}
        {view === "cost_db" && <CostDB t={t} costItems={costItems} setCostItems={updateCostItems} />}
        {view === "temp_db" && <TempPhDB t={t} tempLogs={tempLogs} setTempLogs={updateTempLogs} />}
        {view === "admin" && isAdmin && isAdminUnlocked && <AdminPanel t={t} onAnnouncementsChange={setAnnouncements} />}
        {view === "settings" && <SettingsPanel t={t} language={language} onLanguageChange={changeLanguage} skipCalcLeaveCheck={skipCalcLeaveCheck} onRestoreCalcLeaveCheck={restoreCalcLeaveCheck} authUser={authUser} announcements={announcements} announcementReads={announcementReads} hasOfflinePin={effectiveHasOfflinePin} onSetOfflinePin={handleSetOfflinePin} onVerifyOfflinePin={handleVerifyOfflinePin} onUpdateDisplayName={updatePublicDisplayName} onSignOut={handleSignOut} />}
      </div>
      {isAdminUnlockOpen && (
        <AdminUnlockModal
          t={t}
          error={adminUnlockError}
          onCancel={() => {
            setIsAdminUnlockOpen(false);
            setAdminUnlockError("");
          }}
          onConfirm={confirmAdminUnlock}
        />
      )}
      {leaveCheckStep && (
        <LeaveCheckModal
          message={leaveCheckStep === "salt" ? t("saltCheck") : t("yeastCheck")}
          t={t}
          hideLeaveCheck={hideLeaveCheck}
          setHideLeaveCheck={setHideLeaveCheck}
          onCancel={closeLeaveCheck}
          onConfirm={confirmLeaveCheck}
        />
      )}
      <ServiceWorkerUpdater t={t} />
    </div>
  );
}

function AdminPanel({ t, onAnnouncementsChange }) {
  const [profiles, setProfiles] = useState([]);
  const [allowlist, setAllowlist] = useState([]);
  const [adminAnnouncements, setAdminAnnouncements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [adminError, setAdminError] = useState("");
  const [savingProfileId, setSavingProfileId] = useState(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("user");
  const [isSavingInvite, setIsSavingInvite] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementBody, setAnnouncementBody] = useState("");
  const [isSavingAnnouncement, setIsSavingAnnouncement] = useState(false);
  const [deactivatingAnnouncementId, setDeactivatingAnnouncementId] = useState(null);
  const [deletingAnnouncementId, setDeletingAnnouncementId] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadAdminData = async () => {
      if (!supabase) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setAdminError("");

      const [profilesResult, allowlistResult, announcementsResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, email, full_name, avatar_url, role, created_at, updated_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("auth_allowlist")
          .select("email, role, created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("announcements")
          .select("id, title, body, is_active, created_at, updated_at")
          .order("created_at", { ascending: false }),
      ]);

      if (!isMounted) return;

      if (profilesResult.error || allowlistResult.error || announcementsResult.error) {
        setAdminError(profilesResult.error?.message || allowlistResult.error?.message || announcementsResult.error?.message);
      } else {
        setProfiles(profilesResult.data || []);
        setAllowlist(allowlistResult.data || []);
        setAdminAnnouncements(announcementsResult.data || []);
        onAnnouncementsChange?.((announcementsResult.data || []).filter(announcement => announcement.is_active));
      }

      setIsLoading(false);
    };

    loadAdminData();

    return () => {
      isMounted = false;
    };
  }, [onAnnouncementsChange]);

  const updateProfileRole = async (profileId, nextRole) => {
    if (!supabase) return;

    setSavingProfileId(profileId);
    setAdminError("");

    const { data, error } = await supabase
      .from("profiles")
      .update({ role: nextRole || null })
      .eq("id", profileId)
      .select("id, email, full_name, avatar_url, role, created_at, updated_at")
      .single();

    if (error) {
      setAdminError(error.message);
    } else {
      setProfiles(prev => prev.map(profile => (profile.id === profileId ? data : profile)));
    }

    setSavingProfileId(null);
  };

  const addInvite = async (event) => {
    event.preventDefault();
    if (!supabase) return;

    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;

    setIsSavingInvite(true);
    setAdminError("");

    const { data, error } = await supabase
      .from("auth_allowlist")
      .upsert({ email, role: inviteRole || null }, { onConflict: "email" })
      .select("email, role, created_at")
      .single();

    if (error) {
      setAdminError(error.message);
    } else {
      await supabase
        .from("profiles")
        .update({ role: data.role || null })
        .eq("email", data.email);

      setAllowlist(prev => {
        const withoutExisting = prev.filter(invite => invite.email !== data.email);
        return [data, ...withoutExisting];
      });
      setProfiles(prev => prev.map(profile => (
        profile.email === data.email ? { ...profile, role: data.role || null } : profile
      )));
      setInviteEmail("");
      setInviteRole("user");
    }

    setIsSavingInvite(false);
  };

  const removeInvite = async (email) => {
    if (!supabase || !confirm(t("deleteConfirm"))) return;

    setAdminError("");

    const { error } = await supabase
      .from("auth_allowlist")
      .delete()
      .eq("email", email);

    if (error) {
      setAdminError(error.message);
    } else {
      await supabase
        .from("profiles")
        .update({ role: null })
        .eq("email", email);

      setAllowlist(prev => prev.filter(invite => invite.email !== email));
      setProfiles(prev => prev.map(profile => (
        profile.email === email ? { ...profile, role: null } : profile
      )));
    }
  };

  const publishAnnouncement = async (event) => {
    event.preventDefault();
    if (!supabase) return;

    const title = announcementTitle.trim();
    const body = announcementBody.trim();
    if (!title || !body) return;

    setIsSavingAnnouncement(true);
    setAdminError("");

    const { data, error } = await supabase
      .from("announcements")
      .insert({ title, body, is_active: true })
      .select("id, title, body, is_active, created_at, updated_at")
      .single();

    if (error) {
      setAdminError(error.message);
    } else {
      setAdminAnnouncements(prev => [data, ...prev]);
      onAnnouncementsChange?.(prev => [data, ...(Array.isArray(prev) ? prev : [])]);
      setAnnouncementTitle("");
      setAnnouncementBody("");
    }

    setIsSavingAnnouncement(false);
  };

  const deactivateAnnouncement = async (announcementId) => {
    if (!supabase || !confirm(t("deleteConfirm"))) return;

    setDeactivatingAnnouncementId(announcementId);
    setAdminError("");

    const { data, error } = await supabase
      .from("announcements")
      .update({ is_active: false })
      .eq("id", announcementId)
      .select("id, title, body, is_active, created_at, updated_at")
      .single();

    if (error) {
      setAdminError(error.message);
    } else {
      setAdminAnnouncements(prev => prev.map(announcement => (
        Number(announcement.id) === Number(announcementId) ? data : announcement
      )));
      onAnnouncementsChange?.(prev => (Array.isArray(prev) ? prev.filter(announcement => Number(announcement.id) !== Number(announcementId)) : []));
    }

    setDeactivatingAnnouncementId(null);
  };

  const deleteAnnouncement = async (announcementId) => {
    if (!supabase || !confirm(t("deleteConfirm"))) return;

    setDeletingAnnouncementId(announcementId);
    setAdminError("");

    const { error } = await supabase
      .from("announcements")
      .delete()
      .eq("id", announcementId);

    if (error) {
      setAdminError(error.message);
    } else {
      setAdminAnnouncements(prev => prev.filter(announcement => Number(announcement.id) !== Number(announcementId)));
      onAnnouncementsChange?.(prev => (Array.isArray(prev) ? prev.filter(announcement => Number(announcement.id) !== Number(announcementId)) : []));
    }

    setDeletingAnnouncementId(null);
  };

  return (
    <main className="max-w-6xl mx-auto px-4 md:px-8 text-black">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b-2 border-black pb-4 mb-6 gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tighter uppercase">{t("adminTitle")}</h1>
          <p className="mt-2 text-xs md:text-sm font-bold text-gray-400">{t("adminDescription")}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-full px-4 py-2 text-xs font-black text-gray-400 uppercase tracking-widest">
          {profiles.length} {t("users")}
        </div>
      </div>

      {adminError && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {adminError}
        </div>
      )}

      <section className="mb-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
        <div className="mb-4 flex flex-col gap-1">
          <h2 className="text-2xl font-black tracking-tighter">{t("announcementsAdminTitle")}</h2>
          <p className="text-xs font-bold text-gray-400">{t("announcementsAdminDescription")}</p>
        </div>

        <form onSubmit={publishAnnouncement} className="space-y-3">
          <input
            type="text"
            value={announcementTitle}
            onChange={event => setAnnouncementTitle(event.target.value)}
            placeholder={t("announcementTitlePlaceholder")}
            className="h-11 w-full rounded-xl border border-gray-200 bg-[#f7f6f3] px-3 text-sm font-bold outline-none"
            required
          />
          <textarea
            value={announcementBody}
            onChange={event => setAnnouncementBody(event.target.value)}
            placeholder={t("announcementBodyPlaceholder")}
            className="min-h-28 w-full resize-y rounded-xl border border-gray-200 bg-[#f7f6f3] px-3 py-3 text-sm font-bold outline-none"
            required
          />
          <button
            type="submit"
            disabled={isSavingAnnouncement}
            className="h-11 rounded-xl bg-black px-5 text-sm font-black uppercase tracking-tight text-white disabled:bg-gray-300"
          >
            {isSavingAnnouncement ? t("saving") : t("publishAnnouncement")}
          </button>
        </form>

        <div className="mt-5 overflow-hidden rounded-xl border border-gray-100">
          {isLoading ? (
            <div className="p-4 text-sm font-bold text-gray-400">{t("loading")}</div>
          ) : adminAnnouncements.length === 0 ? (
            <div className="p-4 text-sm font-bold text-gray-400">{t("noAnnouncements")}</div>
          ) : (
            adminAnnouncements.map(announcement => (
              <div key={announcement.id} className="grid grid-cols-[1fr_auto] gap-3 border-b border-gray-100 px-4 py-3 last:border-b-0">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-sm font-black tracking-tight">{announcement.title}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${announcement.is_active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400"}`}>
                      {announcement.is_active ? t("activeAnnouncement") : t("inactiveAnnouncement")}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs font-bold text-gray-400">{announcement.body}</p>
                  <p className="mt-2 text-[10px] font-bold text-gray-300">{formatDateTime(announcement.created_at)}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => deactivateAnnouncement(announcement.id)}
                    disabled={!announcement.is_active || deactivatingAnnouncementId === announcement.id || deletingAnnouncementId === announcement.id}
                    className="self-start rounded-full border border-gray-200 px-3 py-2 text-xs font-black text-gray-400 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {deactivatingAnnouncementId === announcement.id ? t("saving") : t("deactivateAnnouncement")}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteAnnouncement(announcement.id)}
                    disabled={deletingAnnouncementId === announcement.id || deactivatingAnnouncementId === announcement.id}
                    className="self-start rounded-full border border-red-100 px-3 py-2 text-xs font-black text-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {deletingAnnouncementId === announcement.id ? t("saving") : t("deleteAnnouncement")}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="mb-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
        <div className="mb-4 flex flex-col gap-1">
          <h2 className="text-2xl font-black tracking-tighter">{t("inviteUsers")}</h2>
          <p className="text-xs font-bold text-gray-400">{t("inviteUsersDescription")}</p>
        </div>

        <form onSubmit={addInvite} className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_140px_120px]">
          <input
            type="email"
            value={inviteEmail}
            onChange={event => setInviteEmail(event.target.value)}
            placeholder={t("email")}
            className="h-11 rounded-xl border border-gray-200 bg-[#f7f6f3] px-3 text-sm font-bold outline-none"
            required
          />
          <select
            value={inviteRole}
            onChange={event => setInviteRole(event.target.value)}
            className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-black outline-none"
          >
            <option value="user">user</option>
            <option value="admin">admin</option>
          </select>
          <button
            type="submit"
            disabled={isSavingInvite}
            className="h-11 rounded-xl bg-black px-4 text-sm font-black uppercase tracking-tight text-white disabled:bg-gray-300"
          >
            {isSavingInvite ? t("saving") : t("add")}
          </button>
        </form>

        <div className="mt-5 overflow-hidden rounded-xl border border-gray-100">
          {isLoading ? (
            <div className="p-4 text-sm font-bold text-gray-400">{t("loading")}</div>
          ) : allowlist.length === 0 ? (
            <div className="p-4 text-sm font-bold text-gray-400">{t("noInvites")}</div>
          ) : (
            allowlist.map(invite => (
              <div key={invite.email} className="grid grid-cols-[1fr_100px_36px] items-center gap-3 border-b border-gray-100 px-4 py-3 last:border-b-0 md:grid-cols-[1fr_120px_170px_36px]">
                <div className="truncate text-sm font-black tracking-tight">{invite.email}</div>
                <div className="text-xs font-black text-gray-500">{invite.role || t("roleNull")}</div>
                <div className="hidden text-xs font-bold text-gray-400 md:block">{formatDateTime(invite.created_at)}</div>
                <button
                  type="button"
                  onClick={() => removeInvite(invite.email)}
                  className="text-sm font-black text-gray-300 hover:text-red-500"
                  title={t("deleteInvite")}
                >
                  x
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="grid grid-cols-[1.5fr_120px_150px] gap-3 border-b border-gray-100 bg-[#f7f6f3] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400 md:grid-cols-[2fr_140px_180px_180px]">
          <div>{t("user")}</div>
          <div>{t("userRole")}</div>
          <div>{t("joinedAt")}</div>
          <div className="hidden md:block">{t("updatedAt")}</div>
        </div>

        {isLoading ? (
          <div className="p-6 text-sm font-bold text-gray-400">{t("loading")}</div>
        ) : profiles.length === 0 ? (
          <div className="p-6 text-sm font-bold text-gray-400">{t("noUsers")}</div>
        ) : (
          profiles.map(profile => (
            <div key={profile.id} className="grid grid-cols-[1.5fr_120px_150px] gap-3 border-b border-gray-100 px-4 py-4 last:border-b-0 md:grid-cols-[2fr_140px_180px_180px]">
              <div className="flex min-w-0 items-center gap-3">
                {profile.avatar_url ? (
                  <span
                    aria-hidden="true"
                    className="h-10 w-10 shrink-0 rounded-full bg-cover bg-center"
                    style={{ backgroundImage: `url(${profile.avatar_url})` }}
                  />
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black text-xs font-black text-white">
                    {profile.full_name?.[0] || profile.email?.[0] || "U"}
                  </span>
                )}
                <div className="min-w-0">
                  <div className="truncate text-sm font-black tracking-tight">{profile.full_name || profile.email}</div>
                  <div className="mt-1 truncate text-xs font-bold text-gray-400">{profile.email}</div>
                </div>
              </div>

              <select
                value={profile.role || ""}
                onChange={event => updateProfileRole(profile.id, event.target.value)}
                disabled={savingProfileId === profile.id}
                className="h-10 rounded-xl border border-gray-200 bg-white px-2 text-xs font-black outline-none disabled:bg-gray-100"
              >
                {PROFILE_ROLES.map(role => (
                  <option key={role || "null"} value={role}>
                    {role || t("roleNull")}
                  </option>
                ))}
              </select>

              <div className="self-center text-xs font-bold text-gray-400">{formatDateTime(profile.created_at)}</div>
              <div className="hidden self-center text-xs font-bold text-gray-400 md:block">{formatDateTime(profile.updated_at)}</div>
            </div>
          ))
        )}
      </section>
    </main>
  );
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function AdminUnlockModal({ t, error, onCancel, onConfirm }) {
  const [password, setPassword] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-md">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm(password);
        }}
        className="w-full max-w-sm rounded-2xl border border-gray-100 bg-white p-6 text-black shadow-2xl"
      >
        <h2 className="text-2xl font-black tracking-tighter">{t("adminUnlockTitle")}</h2>
        <p className="mt-2 text-xs font-bold leading-5 text-gray-400">{t("adminUnlockDescription")}</p>
        <input
          type="password"
          value={password}
          onChange={event => setPassword(event.target.value)}
          autoFocus
          className="mt-5 w-full rounded-xl border border-gray-200 bg-[#f7f6f3] px-4 py-3 text-sm font-black outline-none focus:border-black"
          placeholder={t("adminUnlockPassword")}
        />
        {error && <p className="mt-3 text-xs font-bold text-red-500">{error}</p>}
        <div className="mt-6 flex gap-2">
          <button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-gray-200 bg-white py-3 text-sm font-black uppercase tracking-tight">
            {t("cancel")}
          </button>
          <button type="submit" className="flex-1 rounded-xl bg-black py-3 text-sm font-black uppercase tracking-tight text-white">
            {t("confirm")}
          </button>
        </div>
      </form>
    </div>
  );
}

function SettingsPanel({ t, language, onLanguageChange, skipCalcLeaveCheck, onRestoreCalcLeaveCheck, authUser, announcements = [], announcementReads = [], hasOfflinePin, onSetOfflinePin, onVerifyOfflinePin, onUpdateDisplayName, onSignOut }) {
  const [localHasOfflinePin, setLocalHasOfflinePin] = useState(() => hasOfflinePin);
  const [isResettingOfflinePin, setIsResettingOfflinePin] = useState(false);
  const [currentOfflinePin, setCurrentOfflinePin] = useState("");
  const [offlinePin, setOfflinePin] = useState("");
  const [offlinePinConfirm, setOfflinePinConfirm] = useState("");
  const [offlinePinStatus, setOfflinePinStatus] = useState("");
  const [isSavingOfflinePin, setIsSavingOfflinePin] = useState(false);
  const [displayName, setDisplayName] = useState(authUser.displayName || "");
  const [displayNameStatus, setDisplayNameStatus] = useState("");
  const [isSavingDisplayName, setIsSavingDisplayName] = useState(false);
  const readAnnouncementIds = useMemo(() => new Set(announcementReads.map(read => Number(read.announcement_id))), [announcementReads]);

  const saveDisplayName = async (event) => {
    event.preventDefault();
    setDisplayNameStatus("");

    const normalizedDisplayName = displayName.trim();
    if (normalizedDisplayName.length > 24) {
      setDisplayNameStatus(t("publicDisplayNameTooLong"));
      return;
    }

    setIsSavingDisplayName(true);
    try {
      await onUpdateDisplayName(normalizedDisplayName);
      setDisplayNameStatus(t("publicDisplayNameSaved"));
    } catch {
      setDisplayNameStatus(t("publicDisplayNameSaveFailed"));
    } finally {
      setIsSavingDisplayName(false);
    }
  };

  const saveOfflinePin = async (event) => {
    event.preventDefault();
    setOfflinePinStatus("");

    const normalizedPin = offlinePin.trim();
    const normalizedCurrentPin = currentOfflinePin.trim();

    if (localHasOfflinePin) {
      const isCurrentPinValid = await onVerifyOfflinePin(normalizedCurrentPin);
      if (!isCurrentPinValid) {
        setOfflinePinStatus(t("offlinePinCurrentWrong"));
        return;
      }
    }

    if (!/^\d{4,8}$/.test(normalizedPin)) {
      setOfflinePinStatus(t("offlinePinInvalid"));
      return;
    }

    if (normalizedPin !== offlinePinConfirm.trim()) {
      setOfflinePinStatus(t("offlinePinMismatch"));
      return;
    }

    setIsSavingOfflinePin(true);
    try {
      await onSetOfflinePin(normalizedPin);
      setOfflinePinStatus(t("offlinePinFinalizing"));
      await new Promise(resolve => setTimeout(resolve, OFFLINE_PIN_SAVE_SETTLE_MS));
      setLocalHasOfflinePin(true);
      setCurrentOfflinePin("");
      setOfflinePin("");
      setOfflinePinConfirm("");
      setOfflinePinStatus(t("offlinePinSaved"));
      setIsResettingOfflinePin(false);
    } catch {
      setOfflinePinStatus(t("offlinePinSaveFailed"));
    } finally {
      setIsSavingOfflinePin(false);
    }
  };
  const offlinePinStatusIsPositive = offlinePinStatus === t("offlinePinSaved") || offlinePinStatus === t("offlinePinFinalizing");

  return (
    <main className="max-w-3xl mx-auto px-4 md:px-8 text-black">
      <div className="border-b-2 border-black pb-4 mb-6">
        <h1 className="text-3xl md:text-4xl font-black tracking-tighter uppercase">{t("settingsTitle")}</h1>
      </div>

      <section className="bg-white rounded-2xl border border-gray-100 p-5 md:p-6 shadow-sm mb-4">
        <div>
          <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t("announcementsTitle")}</div>
          <h2 className="mt-1 text-xl font-black tracking-tighter">{t("announcementsDescription")}</h2>
        </div>

        <div className="mt-4 space-y-3">
          {announcements.length === 0 ? (
            <p className="text-sm font-bold text-gray-400">{t("noAnnouncements")}</p>
          ) : (
            announcements.map((announcement) => {
              const isRead = readAnnouncementIds.has(Number(announcement.id));
              return (
                <article key={announcement.id} className="rounded-xl border border-gray-100 bg-[#f7f6f3] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-base font-black tracking-tight">{announcement.title}</h3>
                    {!isRead && (
                      <span className="rounded-full bg-black px-2 py-1 text-[10px] font-black uppercase text-white">
                        {t("newAnnouncement")}
                      </span>
                    )}
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm font-bold leading-6 text-gray-600">{announcement.body}</p>
                  <p className="mt-3 text-[10px] font-bold text-gray-400">{formatDateTime(announcement.created_at)}</p>
                </article>
              );
            })
          )}
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-gray-100 p-5 md:p-6 shadow-sm mb-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t("languageSetting")}</div>
            <p className="mt-2 text-xs font-bold text-gray-400">{t("languageDescription")}</p>
          </div>
          <select
            value={language}
            onChange={e => onLanguageChange(e.target.value)}
            className="w-full md:w-48 h-11 bg-[#f7f6f3] border border-gray-200 rounded-xl px-3 text-sm font-black outline-none"
          >
            {LANGUAGES.map(lang => (
              <option key={lang.code} value={lang.code}>{lang.label}</option>
            ))}
          </select>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-gray-100 p-5 md:p-6 shadow-sm mb-4">
        <form onSubmit={saveDisplayName} className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t("publicDisplayName")}</div>
            <p className="mt-2 text-xs font-bold leading-5 text-gray-400">{t("publicDisplayNameDescription")}</p>
            <input
              type="text"
              value={displayName}
              onChange={event => setDisplayName(event.target.value)}
              maxLength={24}
              className="mt-3 w-full rounded-xl border border-gray-200 bg-[#f7f6f3] px-4 py-3 text-sm font-black outline-none focus:border-black"
              placeholder={t("anonymousBaker")}
            />
            {displayNameStatus && (
              <p className={`mt-2 text-xs font-bold ${displayNameStatus === t("publicDisplayNameSaved") ? "text-green-600" : "text-red-500"}`}>
                {displayNameStatus}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={isSavingDisplayName}
            className="rounded-xl bg-black px-5 py-3 text-sm font-black uppercase tracking-tight text-white disabled:cursor-wait disabled:opacity-60"
          >
            {isSavingDisplayName ? t("saving") : t("save")}
          </button>
        </form>
      </section>

      <section className="bg-white rounded-2xl border border-gray-100 p-5 md:p-6 shadow-sm mb-4">
        <form onSubmit={saveOfflinePin} className="space-y-4">
          <div>
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t("offlinePinTitle")}</div>
            <h2 className="mt-1 text-xl font-black tracking-tighter">{localHasOfflinePin ? t("offlinePinEnabled") : t("offlinePinDisabled")}</h2>
            <p className="mt-2 text-xs font-bold leading-5 text-gray-400">{t("offlinePinDescription")}</p>
            <p className="mt-2 text-xs font-black leading-5 text-red-500">{t("offlinePinCannotRecover")}</p>
          </div>

          {localHasOfflinePin && !isResettingOfflinePin ? (
            <button
              type="button"
              onClick={() => {
                setIsResettingOfflinePin(true);
                setOfflinePinStatus("");
              }}
              className="rounded-xl bg-black px-5 py-3 text-sm font-black uppercase tracking-tight text-white"
            >
              {t("resetOfflinePin")}
            </button>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
              {localHasOfflinePin && (
                <label className="block md:col-span-2">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t("offlinePinCurrent")}</span>
                  <input
                    type="password"
                    inputMode="numeric"
                    value={currentOfflinePin}
                    onChange={event => setCurrentOfflinePin(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-[#f7f6f3] px-4 py-3 text-sm font-black outline-none focus:border-black"
                    placeholder="0000"
                  />
                </label>
              )}
              <label className="block">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{localHasOfflinePin ? t("offlinePinNew") : t("offlinePinInput")}</span>
                <input
                  type="password"
                  inputMode="numeric"
                  value={offlinePin}
                  onChange={event => setOfflinePin(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-[#f7f6f3] px-4 py-3 text-sm font-black outline-none focus:border-black"
                  placeholder="0000"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t("offlinePinConfirm")}</span>
                <input
                  type="password"
                  inputMode="numeric"
                  value={offlinePinConfirm}
                  onChange={event => setOfflinePinConfirm(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-[#f7f6f3] px-4 py-3 text-sm font-black outline-none focus:border-black"
                  placeholder="0000"
                />
              </label>
              <button
                type="submit"
                disabled={isSavingOfflinePin}
                className="rounded-xl bg-black px-5 py-3 text-sm font-black uppercase tracking-tight text-white disabled:cursor-wait disabled:opacity-60"
              >
                {isSavingOfflinePin ? t("saving") : localHasOfflinePin ? t("resetOfflinePin") : t("save")}
              </button>
            </div>
          )}
          {offlinePinStatus && (
            <p className={`flex items-center gap-2 text-xs font-bold ${offlinePinStatusIsPositive ? "text-green-600" : "text-red-500"}`}>
              {isSavingOfflinePin && (
                <span className="h-3 w-3 rounded-full border-2 border-green-600 border-t-transparent animate-spin" aria-hidden="true" />
              )}
              {offlinePinStatus}
            </p>
          )}
        </form>
      </section>

      <section className="bg-white rounded-2xl border border-gray-100 p-5 md:p-6 shadow-sm mb-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            {authUser.picture ? (
              <span
                aria-hidden="true"
                className="h-11 w-11 rounded-full bg-cover bg-center"
                style={{ backgroundImage: `url(${authUser.picture})` }}
              />
            ) : (
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black text-sm font-black text-white">
                {authUser.name?.[0] || "U"}
              </span>
            )}
            <div>
              <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t("signedInAs")}</div>
              <h2 className="mt-1 text-xl font-black tracking-tighter">{authUser.name || authUser.email}</h2>
              {authUser.email && <p className="mt-1 text-xs font-bold text-gray-400">{authUser.email}</p>}
              <p className="mt-1 text-xs font-bold text-gray-400">{t("userRole")}: {authUser.role || t("roleNull")}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="bg-black text-white px-5 py-3 rounded-xl text-sm font-black uppercase tracking-tight"
          >
            {t("signOut")}
          </button>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-gray-100 p-5 md:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t("calculatorNotice")}</div>
            <h2 className="mt-1 text-xl font-black tracking-tighter">{t("saltYeastConfirm")}</h2>
            <p className="mt-2 text-xs font-bold text-gray-400">
              {t("currentStatus")}: {skipCalcLeaveCheck ? t("statusHidden") : t("statusVisible")}
            </p>
          </div>
          <button
            type="button"
            onClick={onRestoreCalcLeaveCheck}
            className="bg-black text-white px-5 py-3 rounded-xl text-sm font-black uppercase tracking-tight disabled:bg-gray-300 disabled:cursor-not-allowed"
            disabled={!skipCalcLeaveCheck}
          >
            {t("restoreNotifications")}
          </button>
        </div>
      </section>
    </main>
  );
}

function LeaveCheckModal({ message, t, hideLeaveCheck, setHideLeaveCheck, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4 print:hidden">
      <section className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-black/10 text-black">
        <h2 className="text-2xl font-black tracking-tighter">{message}</h2>
        <label className="mt-6 flex items-center gap-3 text-xs font-bold text-gray-500">
          <input
            type="checkbox"
            checked={hideLeaveCheck}
            onChange={e => setHideLeaveCheck(e.target.checked)}
            className="h-4 w-4 accent-black"
          />
          {t("hideNextTime")}
        </label>
        <div className="mt-6 grid grid-cols-2 gap-2">
          <button type="button" onClick={onCancel} className="rounded-xl border border-gray-200 bg-white py-3 text-sm font-black uppercase tracking-tight">
            {t("cancel")}
          </button>
          <button type="button" onClick={onConfirm} className="rounded-xl bg-black py-3 text-sm font-black uppercase tracking-tight text-white">
            {t("confirm")}
          </button>
        </div>
      </section>
    </div>
  );
}

function LoginScreen({ t, isOnline, offlineLoginUsers, onGoogleSignIn, onOfflinePinSignIn, authError }) {
  const [offlinePin, setOfflinePin] = useState("");
  const [isUnlockingOffline, setIsUnlockingOffline] = useState(false);
  const [selectedOfflineUserId, setSelectedOfflineUserId] = useState(offlineLoginUsers[0]?.id || "");
  const canUseOfflinePin = !isOnline && offlineLoginUsers.length > 0;
  const selectedOfflineUser = offlineLoginUsers.find(user => user.id === selectedOfflineUserId) || offlineLoginUsers[0];

  const submitOfflinePin = async (event) => {
    event.preventDefault();
    if (!selectedOfflineUser) return;

    setIsUnlockingOffline(true);
    const isUnlocked = await onOfflinePinSignIn(selectedOfflineUser.id, offlinePin);
    if (!isUnlocked) {
      setOfflinePin("");
      setIsUnlockingOffline(false);
    }
  };

  return (
    <main
      className="min-h-screen px-4 py-8 md:px-8 text-black bg-cover bg-center relative overflow-hidden"
      style={{ backgroundImage: "url('/login-bg.jpg')" }}
    >
      <div className="absolute inset-0 bg-black/45" />
      <div className="relative z-10 min-h-[calc(100vh-4rem)] w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-[1fr_420px] gap-8 items-center">
        <div className="text-white pt-10 md:self-start md:pt-16">
          <p className="text-3xl md:text-5xl font-black tracking-tighter drop-shadow-[0_3px_10px_rgba(0,0,0,0.85)]">
            {t("loginGreeting")}
          </p>
        </div>

        <section className="w-full max-w-md justify-self-center md:justify-self-end bg-white/42 md:bg-white/82 border border-white/20 md:border-white/35 rounded-2xl shadow-lg md:shadow-xl p-5 md:p-8 backdrop-blur-lg md:backdrop-blur-md">
          <div className="border-b-2 border-black/80 pb-4 mb-6">
            <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Levain Lab</div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tighter uppercase">{t("signIn")}</h1>
          </div>

          {isSupabaseConfigured ? (
            <>
              <button
                type="button"
                onClick={onGoogleSignIn}
                className="w-full rounded-xl bg-black py-3 text-sm font-black uppercase tracking-tight text-white transition-colors hover:bg-gray-800"
              >
                {t("googleStart")}
              </button>
              {canUseOfflinePin && (
                <form onSubmit={submitOfflinePin} className="mt-4 rounded-xl border border-black/10 bg-white/70 p-4">
                  <p className="whitespace-pre-line text-xs font-bold leading-5 text-gray-500">{t("offlineStartPrompt")}</p>
                  <label className="mt-3 block">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{t("offlineAccount")}</span>
                    <select
                      value={selectedOfflineUser?.id || ""}
                      onChange={event => {
                        setSelectedOfflineUserId(event.target.value);
                        setOfflinePin("");
                      }}
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-[#f7f6f3] px-4 py-3 text-sm font-black outline-none focus:border-black"
                    >
                      {offlineLoginUsers.map(user => (
                        <option key={user.id} value={user.id}>
                          {user.email || user.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="mt-2 flex gap-2">
                    <input
                      type="password"
                      inputMode="numeric"
                      value={offlinePin}
                      onChange={event => setOfflinePin(event.target.value)}
                      className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-[#f7f6f3] px-4 py-3 text-sm font-black outline-none focus:border-black"
                      placeholder={t("offlinePinInput")}
                    />
                    <button
                      type="submit"
                      disabled={isUnlockingOffline || offlinePin.trim().length === 0}
                      className="rounded-xl bg-black px-4 py-3 text-xs font-black uppercase tracking-tight text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isUnlockingOffline ? t("loading") : t("confirm")}
                    </button>
                  </div>
                </form>
              )}
              {authError && <p className="mt-3 text-xs font-bold text-red-600">{authError}</p>}
            </>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-900">
              {t("supabaseClientMissing")}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
