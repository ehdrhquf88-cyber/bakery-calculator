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
  const [isLoaded, setIsLoaded] = useState(false);

  // 로컬스토리지 로드
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const savedRecipes = localStorage.getItem("bakery_recipes");
      const savedCostItems = localStorage.getItem("bakery_cost_items");
      const savedTempLogs = localStorage.getItem("bakery_temp_ph");
      if (savedRecipes) setRecipes(JSON.parse(savedRecipes));
      if (savedCostItems) setCostItems(JSON.parse(savedCostItems));
      if (savedTempLogs) setTempLogs(JSON.parse(savedTempLogs));
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

  if (!isLoaded) return <div className="min-h-screen bg-[#f7f6f3]" />;

  return (
    <div className="min-h-screen bg-[#f7f6f3] pb-10 print:bg-white print:pb-0">
      <nav className="sticky top-0 z-40 flex gap-4 md:gap-8 p-4 md:p-6 bg-white/80 backdrop-blur-md border-b border-gray-200 justify-start md:justify-center overflow-x-auto whitespace-nowrap shadow-sm no-scrollbar print:hidden">
        <NavButton active={view === "calc"} onClick={() => setView("calc")}>레시피 계산기</NavButton>
        <NavButton active={view === "db"} onClick={() => setView("db")}>레시피 DB</NavButton>
        <NavButton active={view === "cost_db"} onClick={() => setView("cost_db")}>원가 리스트 DB</NavButton>
        <NavButton active={view === "temp_db"} onClick={() => setView("temp_db")}>온도/pH 히스토리</NavButton>
      </nav>

      <div className="py-4 md:py-8 print:py-0">
        {view === "calc" && <RecipeCalculator recipes={recipes} setRecipes={setRecipes} tempLogs={tempLogs} setTempLogs={setTempLogs} />}
        {view === "db" && <RecipeDB recipes={recipes} setRecipes={setRecipes} costItems={costItems} />}
        {view === "cost_db" && <CostDB costItems={costItems} setCostItems={setCostItems} />}
        {view === "temp_db" && <TempPhDB tempLogs={tempLogs} setTempLogs={setTempLogs} />}
      </div>
      <ServiceWorkerUpdater />
    </div>
  );
}
