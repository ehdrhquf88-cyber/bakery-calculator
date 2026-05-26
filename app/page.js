"use client";

import { useState, useEffect, useRef } from "react";
import BreadVideos from "./components/BreadVideos";
import CostDB from "./components/CostDB";
import MyBreadYourBread from "./components/MyBreadYourBread";
import NavButton from "./components/NavButton";
import RecipeCalculator from "./components/RecipeCalculator";
import RecipeDB from "./components/RecipeDB";
import ServiceWorkerUpdater from "./components/ServiceWorkerUpdater";
import TempPhDB from "./components/TempPhDB";
import { DEFAULT_LANGUAGE, LANGUAGES, getTranslator } from "./i18n";

const ALLOWED_GOOGLE_EMAILS = [
  "your-email@example.com",
];

const isAllowedGoogleEmail = (email) => (
  ALLOWED_GOOGLE_EMAILS.includes(email?.trim().toLowerCase())
);

export default function Home() {
  const [view, setView] = useState("calc");
  const [recipes, setRecipes] = useState([]);
  const [costItems, setCostItems] = useState([]);
  const [tempLogs, setTempLogs] = useState([]);
  const [authUser, setAuthUser] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [skipCalcLeaveCheck, setSkipCalcLeaveCheck] = useState(false);
  const [pendingView, setPendingView] = useState(null);
  const [pendingCalcAction, setPendingCalcAction] = useState(null);
  const [leaveCheckStep, setLeaveCheckStep] = useState(null);
  const [hideLeaveCheck, setHideLeaveCheck] = useState(false);
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE);
  const t = getTranslator(language);

  // 로컬스토리지 로드
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const savedRecipes = localStorage.getItem("bakery_recipes");
      const savedCostItems = localStorage.getItem("bakery_cost_items");
      const savedTempLogs = localStorage.getItem("bakery_temp_ph");
      const savedSkipCalcLeaveCheck = localStorage.getItem("bakery_skip_calc_leave_check");
      const savedLanguage = localStorage.getItem("bakery_language");
      const savedAuthUser = localStorage.getItem("bakery_auth_user");
      if (savedRecipes) setRecipes(JSON.parse(savedRecipes));
      if (savedCostItems) setCostItems(JSON.parse(savedCostItems));
      if (savedTempLogs) setTempLogs(JSON.parse(savedTempLogs));
      if (savedSkipCalcLeaveCheck === "true") setSkipCalcLeaveCheck(true);
      if (LANGUAGES.some(lang => lang.code === savedLanguage)) setLanguage(savedLanguage);
      if (savedAuthUser) {
        const parsedAuthUser = JSON.parse(savedAuthUser);
        if (isAllowedGoogleEmail(parsedAuthUser.email)) {
          setAuthUser(parsedAuthUser);
        } else {
          localStorage.removeItem("bakery_auth_user");
        }
      }
    } catch (e) {
      console.error("로컬스토리지 데이터를 읽는 중 오류가 발생했습니다.", e);
    }
    setIsLoaded(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // 로컬스토리지 저장
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem("bakery_recipes", JSON.stringify(recipes));
        localStorage.setItem("bakery_cost_items", JSON.stringify(costItems));
        localStorage.setItem("bakery_temp_ph", JSON.stringify(tempLogs));
      } catch (e) {
        console.error("로컬스토리지 데이터 저장 중 오류가 발생했습니다.", e);
      }
    }
  }, [recipes, costItems, tempLogs, isLoaded]);

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

    if (view === "calc" && nextView !== "calc" && !skipCalcLeaveCheck) {
      requestCalcSafetyCheck(() => setView(nextView));
      setPendingView(nextView);
      return;
    }

    setView(nextView);
  };

  const restoreCalcLeaveCheck = () => {
    localStorage.removeItem("bakery_skip_calc_leave_check");
    setSkipCalcLeaveCheck(false);
  };

  const changeLanguage = (nextLanguage) => {
    setLanguage(nextLanguage);
    localStorage.setItem("bakery_language", nextLanguage);
  };

  const handleGoogleSignIn = (user) => {
    if (!isAllowedGoogleEmail(user.email)) {
      alert("초대받은 사용자만 이용할 수 있습니다.");
      return;
    }

    setAuthUser(user);
    localStorage.setItem("bakery_auth_user", JSON.stringify(user));
  };

  const handleSignOut = () => {
    setAuthUser(null);
    localStorage.removeItem("bakery_auth_user");
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
  if (!authUser) return <LoginScreen t={t} onGoogleSignIn={handleGoogleSignIn} />;

  return (
    <div className="min-h-screen bg-[#f7f6f3] pb-10 print:bg-white print:pb-0">
      <nav className="sticky top-0 z-40 relative bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm print:hidden">
        <div className="flex gap-4 md:gap-8 p-4 md:p-6 md:px-40 justify-start md:justify-center overflow-x-auto whitespace-nowrap no-scrollbar">
          <NavButton active={view === "calc"} onClick={() => moveToView("calc")}>{t("navRecipeCalculator")}</NavButton>
          <NavButton active={view === "db"} onClick={() => moveToView("db")}>{t("navRecipeDb")}</NavButton>
          <NavButton active={view === "cost_db"} onClick={() => moveToView("cost_db")}>{t("navCostDb")}</NavButton>
          <NavButton active={view === "temp_db"} onClick={() => moveToView("temp_db")}>{t("navTempPh")}</NavButton>
          <NavButton active={view === "community"} onClick={() => moveToView("community")}>{t("navCommunity")}</NavButton>
          <NavButton active={view === "videos"} onClick={() => moveToView("videos")}>{t("navVideos")}</NavButton>
          <NavButton active={view === "settings"} onClick={() => moveToView("settings")}>{t("navSettings")}</NavButton>
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
        {view === "calc" && <RecipeCalculator t={t} recipes={recipes} setRecipes={setRecipes} costItems={costItems} tempLogs={tempLogs} setTempLogs={setTempLogs} requestSafetyCheck={requestCalcSafetyCheck} />}
        {view === "db" && <RecipeDB t={t} recipes={recipes} setRecipes={setRecipes} costItems={costItems} setCostItems={setCostItems} />}
        {view === "community" && <MyBreadYourBread t={t} recipes={recipes} setRecipes={setRecipes} />}
        {view === "videos" && <BreadVideos t={t} />}
        {view === "cost_db" && <CostDB t={t} costItems={costItems} setCostItems={setCostItems} />}
        {view === "temp_db" && <TempPhDB t={t} tempLogs={tempLogs} setTempLogs={setTempLogs} />}
        {view === "settings" && <SettingsPanel t={t} language={language} onLanguageChange={changeLanguage} skipCalcLeaveCheck={skipCalcLeaveCheck} onRestoreCalcLeaveCheck={restoreCalcLeaveCheck} authUser={authUser} onSignOut={handleSignOut} />}
      </div>
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

function SettingsPanel({ t, language, onLanguageChange, skipCalcLeaveCheck, onRestoreCalcLeaveCheck, authUser, onSignOut }) {
  return (
    <main className="max-w-3xl mx-auto px-4 md:px-8 text-black">
      <div className="border-b-2 border-black pb-4 mb-6">
        <h1 className="text-3xl md:text-4xl font-black tracking-tighter uppercase">{t("settingsTitle")}</h1>
      </div>

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

function decodeJwtPayload(token) {
  try {
    const base64Payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = decodeURIComponent(
      atob(base64Payload)
        .split("")
        .map(char => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join("")
    );
    return JSON.parse(payload);
  } catch (error) {
    console.error("Google 로그인 정보를 읽는 중 오류가 발생했습니다.", error);
    return null;
  }
}

function LoginScreen({ t, onGoogleSignIn }) {
  const googleButtonRef = useRef(null);
  const [googleStatus, setGoogleStatus] = useState("loading");
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

  useEffect(() => {
    if (!googleClientId) return;

    let isMounted = true;

    const initializeGoogle = () => {
      if (!isMounted || !window.google?.accounts?.id || !googleButtonRef.current) return;

      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: (response) => {
          const profile = decodeJwtPayload(response.credential);
          if (!profile) {
            setGoogleStatus("error");
            return;
          }

          onGoogleSignIn({
            id: profile.sub,
            name: profile.name,
            email: profile.email,
            picture: profile.picture,
            signedInAt: new Date().toISOString(),
          });
        },
      });

      googleButtonRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "large",
        type: "standard",
        shape: "rectangular",
        text: "continue_with",
        logo_alignment: "left",
        width: googleButtonRef.current.offsetWidth || 320,
      });
      setGoogleStatus("ready");
    };

    if (window.google?.accounts?.id) {
      initializeGoogle();
      return () => {
        isMounted = false;
      };
    }

    const existingScript = document.querySelector("script[src='https://accounts.google.com/gsi/client']");
    if (existingScript) {
      existingScript.addEventListener("load", initializeGoogle, { once: true });
      return () => {
        isMounted = false;
        existingScript.removeEventListener("load", initializeGoogle);
      };
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = initializeGoogle;
    script.onerror = () => setGoogleStatus("error");
    document.head.appendChild(script);

    return () => {
      isMounted = false;
      script.onload = null;
      script.onerror = null;
    };
  }, [googleClientId, onGoogleSignIn]);

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

          {googleClientId ? (
            <>
              <div ref={googleButtonRef} className="min-h-11 w-full overflow-hidden rounded-xl" />
              {googleStatus === "loading" && (
                <p className="mt-3 text-xs font-bold text-gray-500">{t("googleLoading")}</p>
              )}
              {googleStatus === "error" && (
                <p className="mt-3 text-xs font-bold text-red-600">{t("googleLoginError")}</p>
              )}
            </>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-900">
              {t("googleClientMissing")}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
