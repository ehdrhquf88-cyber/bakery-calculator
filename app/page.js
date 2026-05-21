"use client";

import { useState, useEffect } from "react";
import CostDB from "./components/CostDB";
import NavButton from "./components/NavButton";
import RecipeCalculator from "./components/RecipeCalculator";
import RecipeDB from "./components/RecipeDB";
import ServiceWorkerUpdater from "./components/ServiceWorkerUpdater";
import TempPhDB from "./components/TempPhDB";

export default function Home() {
  const [view, setView] = useState("calc");
  const [recipes, setRecipes] = useState([]);
  const [costItems, setCostItems] = useState([]);
  const [tempLogs, setTempLogs] = useState([]);
  const [accessMode, setAccessMode] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [skipCalcLeaveCheck, setSkipCalcLeaveCheck] = useState(false);
  const [pendingView, setPendingView] = useState(null);
  const [leaveCheckStep, setLeaveCheckStep] = useState(null);
  const [hideLeaveCheck, setHideLeaveCheck] = useState(false);

  // 로컬스토리지 로드
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const savedRecipes = localStorage.getItem("bakery_recipes");
      const savedCostItems = localStorage.getItem("bakery_cost_items");
      const savedTempLogs = localStorage.getItem("bakery_temp_ph");
      const savedSkipCalcLeaveCheck = localStorage.getItem("bakery_skip_calc_leave_check");
      if (savedRecipes) setRecipes(JSON.parse(savedRecipes));
      if (savedCostItems) setCostItems(JSON.parse(savedCostItems));
      if (savedTempLogs) setTempLogs(JSON.parse(savedTempLogs));
      if (savedSkipCalcLeaveCheck === "true") setSkipCalcLeaveCheck(true);
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
    setLeaveCheckStep(null);
    setHideLeaveCheck(false);
  };

  const moveToView = (nextView) => {
    if (nextView === view) return;

    if (view === "calc" && nextView !== "calc" && !skipCalcLeaveCheck) {
      setPendingView(nextView);
      setLeaveCheckStep("salt");
      setHideLeaveCheck(false);
      return;
    }

    setView(nextView);
  };

  const confirmLeaveCheck = () => {
    saveLeaveCheckPreference();

    if (leaveCheckStep === "salt") {
      setLeaveCheckStep("yeast");
      return;
    }

    if (pendingView) setView(pendingView);
    closeLeaveCheck();
  };

  if (!isLoaded) return <div className="min-h-screen bg-[#f7f6f3]" />;
  if (!accessMode) return <LoginScreen onFreeStart={() => setAccessMode("free")} />;

  return (
    <div className="min-h-screen bg-[#f7f6f3] pb-10 print:bg-white print:pb-0">
      <nav className="sticky top-0 z-40 flex gap-4 md:gap-8 p-4 md:p-6 bg-white/80 backdrop-blur-md border-b border-gray-200 justify-start md:justify-center overflow-x-auto whitespace-nowrap shadow-sm no-scrollbar print:hidden">
        <NavButton active={view === "calc"} onClick={() => moveToView("calc")}>레시피 계산기</NavButton>
        <NavButton active={view === "db"} onClick={() => moveToView("db")}>레시피 DB</NavButton>
        <NavButton active={view === "cost_db"} onClick={() => moveToView("cost_db")}>원가 리스트 DB</NavButton>
        <NavButton active={view === "temp_db"} onClick={() => moveToView("temp_db")}>온도/pH 히스토리</NavButton>
      </nav>

      <div className="py-4 md:py-8 print:py-0">
        {view === "calc" && <RecipeCalculator recipes={recipes} setRecipes={setRecipes} tempLogs={tempLogs} setTempLogs={setTempLogs} />}
        {view === "db" && <RecipeDB recipes={recipes} setRecipes={setRecipes} costItems={costItems} setCostItems={setCostItems} />}
        {view === "cost_db" && <CostDB costItems={costItems} setCostItems={setCostItems} />}
        {view === "temp_db" && <TempPhDB tempLogs={tempLogs} setTempLogs={setTempLogs} />}
      </div>
      {leaveCheckStep && (
        <LeaveCheckModal
          message={leaveCheckStep === "salt" ? "소금 넣었어??" : "이스트도?"}
          hideLeaveCheck={hideLeaveCheck}
          setHideLeaveCheck={setHideLeaveCheck}
          onCancel={closeLeaveCheck}
          onConfirm={confirmLeaveCheck}
        />
      )}
      <ServiceWorkerUpdater />
    </div>
  );
}

function LeaveCheckModal({ message, hideLeaveCheck, setHideLeaveCheck, onCancel, onConfirm }) {
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
          다음부터 이 창 보이지 않기
        </label>
        <div className="mt-6 grid grid-cols-2 gap-2">
          <button type="button" onClick={onCancel} className="rounded-xl border border-gray-200 bg-white py-3 text-sm font-black uppercase tracking-tight">
            취소
          </button>
          <button type="button" onClick={onConfirm} className="rounded-xl bg-black py-3 text-sm font-black uppercase tracking-tight text-white">
            확인
          </button>
        </div>
      </section>
    </div>
  );
}

function LoginScreen({ onFreeStart }) {
  const showComingSoon = () => {
    alert("로그인 기능은 준비 중입니다. 지금은 무료로 사용하기를 선택해 주세요.");
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
            빵쟁이들 안녕?
          </p>
        </div>

        <section className="w-full max-w-md justify-self-center md:justify-self-end bg-white/42 md:bg-white/82 border border-white/20 md:border-white/35 rounded-2xl shadow-lg md:shadow-xl p-5 md:p-8 backdrop-blur-lg md:backdrop-blur-md">
          <div className="border-b-2 border-black/80 pb-4 mb-6">
            <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Levain Lab</div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tighter uppercase">Sign In</h1>
          </div>

          <div className="space-y-3">
            <input
              type="email"
              placeholder="Email"
              className="w-full bg-white/58 md:bg-[#f7f6f3] border border-white/35 md:border-gray-100 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-black"
            />
            <input
              type="password"
              placeholder="Password"
              className="w-full bg-white/58 md:bg-[#f7f6f3] border border-white/35 md:border-gray-100 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-black"
            />
            <button
              type="button"
              onClick={showComingSoon}
              className="w-full bg-black text-white py-3 rounded-xl font-black text-sm uppercase tracking-tight"
            >
              로그인
            </button>
          </div>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-100" />
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">or</span>
            <div className="h-px flex-1 bg-gray-100" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {["Google", "Apple", "Kakao", "Naver"].map(provider => (
              <button
                key={provider}
                type="button"
                onClick={showComingSoon}
                className="bg-white/56 md:bg-white border border-white/35 md:border-gray-200 py-2.5 rounded-xl text-xs font-black uppercase tracking-tight hover:border-black transition-all"
              >
                {provider}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onFreeStart}
            className="mt-6 w-full bg-white/58 md:bg-[#f7f6f3] border border-white/35 md:border-gray-200 py-4 rounded-xl font-black text-sm uppercase tracking-tight hover:border-black transition-all"
          >
            무료로 사용하기
          </button>
        </section>
      </div>
    </main>
  );
}
