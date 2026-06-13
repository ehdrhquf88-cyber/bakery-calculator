"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import BreadVideos from "./components/BreadVideos";
import CostDB from "./components/CostDB";
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
const OFFLINE_ALLOWED_VIEWS = ["calc", "db", "cost_db", "temp_db"];
const LOCAL_UPDATED_AT_FIELD = "_localUpdatedAt";
const REMOTE_UPDATED_AT_FIELD = "_remoteUpdatedAt";
const REMOTE_REFRESH_INTERVAL_MS = 15000;
const CALCULATOR_STATE_STORAGE_PREFIX = "bakery_recipe_calculator_state";
const USER_DATA_STORAGE_KEYS = {
  recipes: "bakery_recipes",
  costItems: "bakery_cost_items",
  tempLogs: "bakery_temp_ph",
};

function getCalculatorStateStorageKey(authUser) {
  return authUser?.id ? `${CALCULATOR_STATE_STORAGE_PREFIX}:${authUser.id}` : "";
}

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

function clearCalculatorState(authUser) {
  const storageKey = getCalculatorStateStorageKey(authUser);
  if (!storageKey) return;

  try {
    localStorage.removeItem(storageKey);
    sessionStorage.removeItem(storageKey);
  } catch {
    // Browser storage can be unavailable in some private browsing contexts.
  }
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
  const nextUsers = [
    normalizedUser,
    ...users.filter(item => item.id !== normalizedUser.id),
  ];

  localStorage.setItem(OFFLINE_USERS_STORAGE_KEY, JSON.stringify(nextUsers));
}

function removeOfflineUser(userId) {
  if (!userId) return;

  const users = readOfflineUsers().filter(user => user.id !== userId);
  localStorage.setItem(OFFLINE_USERS_STORAGE_KEY, JSON.stringify(users));
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

function markChangedLocalItems(previousItems, nextItems, normalizeId) {
  const previousById = new Map((previousItems || []).map(item => [normalizeId(item), item]));

  return (nextItems || []).map((item) => {
    const id = normalizeId(item);
    const normalizedItem = { ...item, id };
    const previousItem = previousById.get(id);

    if (!previousItem || hasMeaningfulDiff(previousItem, normalizedItem)) {
      return markLocalUpdate(normalizedItem);
    }

    return previousItem;
  });
}

function hasRemoteVersion(item) {
  return Boolean(item?.[REMOTE_UPDATED_AT_FIELD]);
}

function getMissingRemoteIds(previousRemoteItems, nextRemoteItems, normalizeId) {
  const nextRemoteIds = new Set((nextRemoteItems || []).map(item => normalizeId(item)));

  return new Set(
    (previousRemoteItems || [])
      .map(item => normalizeId(item))
      .filter(id => !nextRemoteIds.has(id)),
  );
}

function removeItemsByIds(items, ids, normalizeId) {
  if (!ids?.size) return items || [];
  return (items || []).filter(item => !ids.has(normalizeId(item)));
}

function mergeLocalAndRemoteItems(localItems, remoteItems, normalizeId, deletedIds = new Set(), options = {}) {
  const remoteMissingDeletesSeen = Boolean(options.remoteMissingDeletesSeen);
  const localById = new Map((localItems || []).map(item => [normalizeId(item), item]));
  const remoteById = new Map((remoteItems || []).map(item => [normalizeId(item), item]));
  const ids = new Set([...localById.keys(), ...remoteById.keys()]);

  return [...ids].map((id) => {
    const localItem = localById.get(id);
    const remoteItem = remoteById.get(id);

    if (!localItem && remoteItem && deletedIds.has(Number(id))) return null;
    if (!remoteItem) {
      if (remoteMissingDeletesSeen && hasRemoteVersion(localItem)) return null;
      return localItem;
    }
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

  return {
    user_id: authUser.id,
    id,
    recipe_data: recipeData,
    is_public: false,
    published_at: null,
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

  const previousById = new Map((previousRecipes || []).map(recipe => [normalizeRecipeId(recipe), recipe]));
  const previousIds = new Set((previousRecipes || []).map(recipe => normalizeRecipeId(recipe)));
  const nextIds = new Set((nextRecipes || []).map(recipe => normalizeRecipeId(recipe)));
  const removedIds = [...previousIds].filter(id => !nextIds.has(id));
  const rows = (nextRecipes || [])
    .filter((recipe) => {
      const previousRecipe = previousById.get(normalizeRecipeId(recipe));
      return !previousRecipe || hasMeaningfulDiff(previousRecipe, recipe);
    })
    .map(recipe => recipeToSupabaseRow(authUser, recipe));

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

  const previousById = new Map((previousCostItems || []).map(item => [normalizeCostItemId(item), item]));
  const previousIds = new Set((previousCostItems || []).map(item => normalizeCostItemId(item)));
  const nextIds = new Set((nextCostItems || []).map(item => normalizeCostItemId(item)));
  const removedIds = [...previousIds].filter(id => !nextIds.has(id));
  const rows = (nextCostItems || [])
    .filter((item) => {
      const previousItem = previousById.get(normalizeCostItemId(item));
      return !previousItem || hasMeaningfulDiff(previousItem, item);
    })
    .map(item => costItemToSupabaseRow(authUser, item));

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

  const previousById = new Map((previousTempLogs || []).map(log => [normalizeTempLogId(log), log]));
  const previousIds = new Set((previousTempLogs || []).map(log => normalizeTempLogId(log)));
  const nextIds = new Set((nextTempLogs || []).map(log => normalizeTempLogId(log)));
  const removedIds = [...previousIds].filter(id => !nextIds.has(id));
  const rows = (nextTempLogs || [])
    .filter((log) => {
      const previousLog = previousById.get(normalizeTempLogId(log));
      return !previousLog || hasMeaningfulDiff(previousLog, log);
    })
    .map(log => tempLogToSupabaseRow(authUser, log));

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
  const [offlineLoginUsers, setOfflineLoginUsers] = useState([]);
  const recipesSnapshotRef = useRef([]);
  const costItemsSnapshotRef = useRef([]);
  const tempLogsSnapshotRef = useRef([]);
  const refreshInFlightRef = useRef(false);
  const calculatorStateStorageKey = getCalculatorStateStorageKey(authUser);
  const t = getTranslator(language);
  const isAdmin = authUser?.role === "admin";
  const unreadAnnouncementCount = useMemo(() => {
    const readIds = new Set(announcementReads.map(read => Number(read.announcement_id)));
    return announcements.filter(announcement => announcement.is_active !== false && !readIds.has(Number(announcement.id))).length;
  }, [announcementReads, announcements]);

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

  const clearAuthenticatedAppState = useCallback(() => {
    clearAdminUnlock(authUser);
    setAuthUser(null);
    setOfflineLoginUsers([]);
    setUserDataLoaded(false);
    setUserDataOwnerId(null);
    setIsAdminUnlocked(false);
    localStorage.removeItem("bakery_auth_user");
  }, [authUser]);

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
          const offlineUsers = readOfflineUsers();
          setIsOnline(false);

          if (offlineUsers.length > 0) {
            setOfflineLoginUsers(offlineUsers);
          } else {
            setAuthError(promptTranslator("offlineNoCachedUser"));
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
              remoteCostItems,
              remoteTempLogs,
              remoteAnnouncements,
              remoteAnnouncementReads,
            ] = await Promise.all([
              loadSupabaseRecipes(authUser),
              loadSupabaseCostItems(),
              loadSupabaseTempLogs(),
              loadSupabaseAnnouncements(),
              loadSupabaseAnnouncementReads(authUser),
            ]);

            setAnnouncements(remoteAnnouncements);
            setAnnouncementReads(remoteAnnouncementReads);

            if (remoteRecipes.length > 0) {
              nextRecipes = mergeLocalAndRemoteItems(userData.recipes, remoteRecipes, normalizeRecipeId, deletedRecipeIds, { remoteMissingDeletesSeen: true });
              if (hasMeaningfulDiff(nextRecipes, remoteRecipes)) {
                await syncSupabaseRecipes(authUser, remoteRecipes, nextRecipes);
              }
            } else if (userData.recipes.length > 0) {
              nextRecipes = userData.recipes.filter(recipe => !hasRemoteVersion(recipe));
              if (nextRecipes.length > 0) await syncSupabaseRecipes(authUser, [], nextRecipes);
            }

            if (remoteCostItems.length > 0) {
              nextCostItems = mergeLocalAndRemoteItems(userData.costItems, remoteCostItems, normalizeCostItemId, deletedCostItemIds, { remoteMissingDeletesSeen: true });
              if (hasMeaningfulDiff(nextCostItems, remoteCostItems)) {
                await syncSupabaseCostItems(authUser, remoteCostItems, nextCostItems);
              }
            } else if (userData.costItems.length > 0) {
              nextCostItems = userData.costItems.filter(item => !hasRemoteVersion(item));
              if (nextCostItems.length > 0) await syncSupabaseCostItems(authUser, [], nextCostItems);
            }

            if (remoteTempLogs.length > 0) {
              nextTempLogs = mergeLocalAndRemoteItems(userData.tempLogs, remoteTempLogs, normalizeTempLogId, deletedTempLogIds, { remoteMissingDeletesSeen: true });
              if (hasMeaningfulDiff(nextTempLogs, remoteTempLogs)) {
                await syncSupabaseTempLogs(authUser, remoteTempLogs, nextTempLogs);
              }
            } else if (userData.tempLogs.length > 0) {
              nextTempLogs = userData.tempLogs.filter(log => !hasRemoteVersion(log));
              if (nextTempLogs.length > 0) await syncSupabaseTempLogs(authUser, [], nextTempLogs);
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

  const refreshUserDataFromSupabase = useCallback(async () => {
    if (!isLoaded || !authUser || authUser.isOfflineMode || !isOnline || !userDataLoaded || userDataOwnerId !== authUser.id || !supabase || refreshInFlightRef.current) return;

    refreshInFlightRef.current = true;

    try {
      const [
        remoteRecipes,
        remoteCostItems,
        remoteTempLogs,
        remoteAnnouncements,
        remoteAnnouncementReads,
      ] = await Promise.all([
        loadSupabaseRecipes(authUser),
        loadSupabaseCostItems(),
        loadSupabaseTempLogs(),
        loadSupabaseAnnouncements(),
        loadSupabaseAnnouncementReads(authUser),
      ]);

      const deletedRecipeIds = readDeletedUserDataIds(authUser, USER_DATA_STORAGE_KEYS.recipes);
      const deletedCostItemIds = readDeletedUserDataIds(authUser, USER_DATA_STORAGE_KEYS.costItems);
      const deletedTempLogIds = readDeletedUserDataIds(authUser, USER_DATA_STORAGE_KEYS.tempLogs);
      const remoteDeletedRecipeIds = getMissingRemoteIds(recipesSnapshotRef.current, remoteRecipes, normalizeRecipeId);
      const remoteDeletedCostItemIds = getMissingRemoteIds(costItemsSnapshotRef.current, remoteCostItems, normalizeCostItemId);
      const remoteDeletedTempLogIds = getMissingRemoteIds(tempLogsSnapshotRef.current, remoteTempLogs, normalizeTempLogId);

      recipesSnapshotRef.current = remoteRecipes;
      costItemsSnapshotRef.current = remoteCostItems;
      tempLogsSnapshotRef.current = remoteTempLogs;

      setRecipes(prev => mergeLocalAndRemoteItems(
        removeItemsByIds(prev, remoteDeletedRecipeIds, normalizeRecipeId),
        remoteRecipes,
        normalizeRecipeId,
        deletedRecipeIds,
        { remoteMissingDeletesSeen: true },
      ));
      setCostItems(prev => mergeLocalAndRemoteItems(
        removeItemsByIds(prev, remoteDeletedCostItemIds, normalizeCostItemId),
        remoteCostItems,
        normalizeCostItemId,
        deletedCostItemIds,
        { remoteMissingDeletesSeen: true },
      ));
      setTempLogs(prev => mergeLocalAndRemoteItems(
        removeItemsByIds(prev, remoteDeletedTempLogIds, normalizeTempLogId),
        remoteTempLogs,
        normalizeTempLogId,
        deletedTempLogIds,
        { remoteMissingDeletesSeen: true },
      ));
      setAnnouncements(remoteAnnouncements);
      setAnnouncementReads(remoteAnnouncementReads);
    } catch (error) {
      console.warn("Supabase 최신 데이터를 다시 읽지 못했습니다.", error?.message || error);
    } finally {
      refreshInFlightRef.current = false;
    }
  }, [authUser, isLoaded, isOnline, userDataLoaded, userDataOwnerId]);

  useEffect(() => {
    if (!isLoaded || !authUser || authUser.isOfflineMode || !userDataLoaded || userDataOwnerId !== authUser.id || !supabase) return undefined;

    const refreshWhenActive = () => {
      if (document.visibilityState === "hidden") return;
      refreshUserDataFromSupabase();
    };

    window.addEventListener("focus", refreshWhenActive);
    window.addEventListener("online", refreshWhenActive);
    document.addEventListener("visibilitychange", refreshWhenActive);
    const refreshInterval = window.setInterval(() => {
      if (document.visibilityState === "visible") refreshWhenActive();
    }, REMOTE_REFRESH_INTERVAL_MS);

    return () => {
      window.removeEventListener("focus", refreshWhenActive);
      window.removeEventListener("online", refreshWhenActive);
      document.removeEventListener("visibilitychange", refreshWhenActive);
      window.clearInterval(refreshInterval);
    };
  }, [authUser, isLoaded, refreshUserDataFromSupabase, userDataLoaded, userDataOwnerId]);

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

      return markChangedLocalItems(prev, nextRecipes, normalizeRecipeId);
    });
  }, [authUser]);

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

      return markChangedLocalItems(prev, nextCostItems, normalizeCostItemId);
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

      return markChangedLocalItems(prev, nextTempLogs, normalizeTempLogId);
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

  const handleOfflineSignIn = async (userId) => {
    const offlineUser = readOfflineUsers().find(user => user.id === userId);
    if (!offlineUser) {
      setAuthError(t("offlineNoCachedUser"));
      return false;
    }

    setAuthUser({
      ...offlineUser,
      isOfflineMode: true,
    });
    setOfflineLoginUsers([]);
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
    clearCalculatorState(authUser);
    clearUserData(authUser);
    clearAuthenticatedAppState();
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
        onOfflineSignIn={handleOfflineSignIn}
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
        {view === "calc" && <RecipeCalculator t={t} recipes={recipes} setRecipes={updateRecipes} costItems={costItems} tempLogs={tempLogs} setTempLogs={updateTempLogs} requestSafetyCheck={requestCalcSafetyCheck} stateStorageKey={calculatorStateStorageKey} />}
        {view === "db" && <RecipeDB t={t} recipes={recipes} setRecipes={updateRecipes} costItems={costItems} setCostItems={updateCostItems} />}
        {view === "videos" && <BreadVideos t={t} />}
        {view === "cost_db" && <CostDB t={t} costItems={costItems} setCostItems={updateCostItems} />}
        {view === "temp_db" && <TempPhDB t={t} tempLogs={tempLogs} setTempLogs={updateTempLogs} />}
        {view === "admin" && isAdmin && isAdminUnlocked && <AdminPanel t={t} onAnnouncementsChange={setAnnouncements} />}
        {view === "settings" && <SettingsPanel t={t} language={language} onLanguageChange={changeLanguage} skipCalcLeaveCheck={skipCalcLeaveCheck} onRestoreCalcLeaveCheck={restoreCalcLeaveCheck} authUser={authUser} announcements={announcements} announcementReads={announcementReads} recipes={recipes} onSignOut={handleSignOut} />}
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

function SettingsPanel({ t, language, onLanguageChange, skipCalcLeaveCheck, onRestoreCalcLeaveCheck, authUser, announcements = [], announcementReads = [], recipes = [], onSignOut }) {
  const [isRecipeExportOpen, setIsRecipeExportOpen] = useState(false);
  const [selectedRecipeIds, setSelectedRecipeIds] = useState(() => new Set(recipes.map(recipe => Number(recipe.id))));
  const readAnnouncementIds = useMemo(() => new Set(announcementReads.map(read => Number(read.announcement_id))), [announcementReads]);
  const recipeCategories = useMemo(() => {
    return Array.from(new Set(recipes.map(recipe => recipe.category || t("uncategorized"))));
  }, [recipes, t]);
  const selectedRecipes = useMemo(() => {
    return recipes.filter(recipe => selectedRecipeIds.has(Number(recipe.id)));
  }, [recipes, selectedRecipeIds]);

  const updateSelectedRecipeIds = (updater) => {
    setSelectedRecipeIds(prev => {
      const next = new Set(prev);
      updater(next);
      return next;
    });
  };
  const toggleAllRecipes = () => {
    setSelectedRecipeIds(prev => (
      prev.size === recipes.length
        ? new Set()
        : new Set(recipes.map(recipe => Number(recipe.id)))
    ));
  };
  const toggleRecipeCategory = (category) => {
    const categoryRecipes = recipes.filter(recipe => (recipe.category || t("uncategorized")) === category);
    const allSelected = categoryRecipes.every(recipe => selectedRecipeIds.has(Number(recipe.id)));

    updateSelectedRecipeIds(next => {
      categoryRecipes.forEach(recipe => {
        const recipeId = Number(recipe.id);
        if (allSelected) next.delete(recipeId);
        else next.add(recipeId);
      });
    });
  };
  const printRecipeBackup = () => {
    if (selectedRecipes.length === 0) return;
    setTimeout(() => window.print(), 100);
  };

  return (
    <main className="max-w-3xl mx-auto px-4 md:px-8 text-black print:max-w-full print:px-0">
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          .recipe-backup-print, .recipe-backup-print * { visibility: visible; }
          .recipe-backup-print { display: block !important; position: absolute; inset: 0; background: white; color: black; }
          .recipe-backup-page { page-break-after: always; break-after: page; min-height: 100vh; padding: 24px; }
          .recipe-backup-page:last-child { page-break-after: auto; break-after: auto; }
        }
      `}</style>
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

      <section className="bg-white rounded-2xl border border-gray-100 p-5 md:p-6 shadow-sm mb-4 print:hidden">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t("recipeBackupTitle")}</div>
            <h2 className="mt-1 text-xl font-black tracking-tighter">{t("recipeBackupDescription")}</h2>
            <p className="mt-2 text-xs font-bold text-gray-400">
              {t("recipeBackupCount").replace("{count}", recipes.length)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedRecipeIds(new Set(recipes.map(recipe => Number(recipe.id))));
              setIsRecipeExportOpen(true);
            }}
            className="bg-black text-white px-5 py-3 rounded-xl text-sm font-black uppercase tracking-tight disabled:bg-gray-300 disabled:cursor-not-allowed"
            disabled={recipes.length === 0}
          >
            {t("recipeBackupOpen")}
          </button>
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

      {isRecipeExportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4 print:hidden">
          <section className="flex max-h-[86vh] w-full max-w-2xl flex-col rounded-2xl border border-black/10 bg-white p-5 text-black shadow-2xl md:p-6">
            <div className="border-b-2 border-black pb-3">
              <h2 className="text-2xl font-black tracking-tighter">{t("recipeBackupSelectTitle")}</h2>
              <p className="mt-1 text-xs font-bold text-gray-400">
                {t("recipeBackupSelectedCount").replace("{count}", selectedRecipes.length)}
              </p>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={toggleAllRecipes}
                className="rounded-xl border border-gray-200 bg-[#f7f6f3] px-4 py-2 text-xs font-black uppercase tracking-tight hover:border-black"
              >
                {selectedRecipeIds.size === recipes.length ? t("recipeBackupClearAll") : t("recipeBackupSelectAll")}
              </button>
            </div>

            <div className="mt-4 flex-1 space-y-4 overflow-y-auto pr-1">
              {recipeCategories.map(category => {
                const categoryRecipes = recipes.filter(recipe => (recipe.category || t("uncategorized")) === category);
                const checkedCount = categoryRecipes.filter(recipe => selectedRecipeIds.has(Number(recipe.id))).length;

                return (
                  <div key={category} className="rounded-xl border border-gray-100 bg-[#f7f6f3] p-4">
                    <button
                      type="button"
                      onClick={() => toggleRecipeCategory(category)}
                      className="flex w-full items-center justify-between text-left"
                    >
                      <span className="text-sm font-black tracking-tight">{category}</span>
                      <span className="font-mono text-[10px] font-black text-gray-400">{checkedCount}/{categoryRecipes.length}</span>
                    </button>
                    <div className="mt-3 space-y-2">
                      {categoryRecipes.map(recipe => {
                        const recipeId = Number(recipe.id);
                        return (
                          <label key={recipe.id} className="flex items-center gap-3 rounded-lg bg-white px-3 py-2 text-sm font-bold">
                            <input
                              type="checkbox"
                              checked={selectedRecipeIds.has(recipeId)}
                              onChange={() => updateSelectedRecipeIds(next => {
                                if (next.has(recipeId)) next.delete(recipeId);
                                else next.add(recipeId);
                              })}
                              className="h-4 w-4 accent-black"
                            />
                            <span className="min-w-0 flex-1 truncate">{recipe.productName}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsRecipeExportOpen(false)}
                className="rounded-xl border border-gray-200 bg-white py-3 text-sm font-black uppercase tracking-tight"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={printRecipeBackup}
                disabled={selectedRecipes.length === 0}
                className="rounded-xl bg-black py-3 text-sm font-black uppercase tracking-tight text-white disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {t("recipeBackupPrint")}
              </button>
            </div>
          </section>
        </div>
      )}

      <RecipeBackupPrintDocument recipes={selectedRecipes} />
    </main>
  );
}

function RecipeBackupPrintDocument({ recipes }) {
  return (
    <div className="recipe-backup-print hidden">
      {recipes.map((recipe, index) => (
        <article key={recipe.id} className="recipe-backup-page">
          <div className="border-b-2 border-black pb-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">{recipe.category}</p>
            <h1 className="mt-1 text-3xl font-black tracking-tighter">{recipe.productName}</h1>
            <p className="mt-1 font-mono text-[10px] font-bold text-gray-400">{index + 1} / {recipes.length}</p>
          </div>

          <table className="mt-6 w-full border-collapse text-sm">
            <thead>
              <tr className="border-y border-black text-[10px] uppercase tracking-widest text-gray-500">
                <th className="py-2 text-left">TYPE</th>
                <th className="py-2 text-left">INGREDIENT</th>
                <th className="py-2 text-right">%</th>
              </tr>
            </thead>
            <tbody>
              {(recipe.ingredients || []).map((ingredient, ingredientIndex) => (
                <tr key={`${ingredient.name}-${ingredientIndex}`} className="border-b border-gray-200">
                  <td className="py-2 pr-3 text-[10px] font-bold uppercase text-gray-500">{ingredient.type}</td>
                  <td className="py-2 pr-3 font-black">{ingredient.name}</td>
                  <td className="py-2 text-right font-mono font-black">{ingredient.percent}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      ))}
    </div>
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

function LoginScreen({ t, isOnline, offlineLoginUsers, onGoogleSignIn, onOfflineSignIn, authError }) {
  const [isUnlockingOffline, setIsUnlockingOffline] = useState(false);
  const [selectedOfflineUserId, setSelectedOfflineUserId] = useState(offlineLoginUsers[0]?.id || "");
  const canUseOfflineAccess = !isOnline && offlineLoginUsers.length > 0;
  const selectedOfflineUser = offlineLoginUsers.find(user => user.id === selectedOfflineUserId) || offlineLoginUsers[0];

  const submitOfflineAccess = async (event) => {
    event.preventDefault();
    if (!selectedOfflineUser) return;

    setIsUnlockingOffline(true);
    const isUnlocked = await onOfflineSignIn(selectedOfflineUser.id);
    if (!isUnlocked) {
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
              {canUseOfflineAccess && (
                <form onSubmit={submitOfflineAccess} className="mt-4 rounded-xl border border-black/10 bg-white/70 p-4">
                  <p className="whitespace-pre-line text-xs font-bold leading-5 text-gray-500">{t("offlineStartPrompt")}</p>
                  <label className="mt-3 block">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{t("offlineAccount")}</span>
                    <select
                      value={selectedOfflineUser?.id || ""}
                      onChange={event => setSelectedOfflineUserId(event.target.value)}
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-[#f7f6f3] px-4 py-3 text-sm font-black outline-none focus:border-black"
                    >
                      {offlineLoginUsers.map(user => (
                        <option key={user.id} value={user.id}>
                          {user.email || user.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="submit"
                    disabled={isUnlockingOffline}
                    className="mt-3 w-full rounded-xl bg-black px-4 py-3 text-xs font-black uppercase tracking-tight text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isUnlockingOffline ? t("loading") : t("offlineEnter")}
                  </button>
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
