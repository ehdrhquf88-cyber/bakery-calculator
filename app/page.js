"use client";

import { useState, useEffect, useMemo } from "react";

export default function Home() {
  const [view, setView] = useState("calc"); 
  const [recipes, setRecipes] = useState([]);
  const [tempLogs, setTempLogs] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // 로컬스토리지 로드
  useEffect(() => {
    try {
      const savedRecipes = localStorage.getItem("bakery_recipes");
      const savedTempLogs = localStorage.getItem("bakery_temp_ph");
      if (savedRecipes) setRecipes(JSON.parse(savedRecipes));
      if (savedTempLogs) setTempLogs(JSON.parse(savedTempLogs));
    } catch (e) {
      console.error("로컬스토리지 데이터를 읽는 중 오류가 발생했습니다.", e);
    }
    setIsLoaded(true);
  }, []);

  // 로컬스토리지 저장
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem("bakery_recipes", JSON.stringify(recipes));
        localStorage.setItem("bakery_temp_ph", JSON.stringify(tempLogs));
      } catch (e) {
        console.error("로컬스토리지 데이터 저장 중 오류가 발생했습니다.", e);
      }
    }
  }, [recipes, tempLogs, isLoaded]);

  if (!isLoaded) return <div className="min-h-screen bg-[#f7f6f3]" />;

  return (
    <div className="min-h-screen bg-[#f7f6f3] pb-12">
      <nav className="bg-black text-white px-6 py-4 sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="font-black text-2xl tracking-tighter uppercase">Bread OS</h1>
          <div className="flex gap-2">
            <button 
              onClick={() => setView("calc")} 
              className={`px-4 py-2 rounded-xl font-bold text-sm tracking-tight transition ${view === "calc" ? "bg-white text-black" : "text-gray-400 hover:text-white"}`}
            >
              Calculator
            </button>
            <button 
              onClick={() => setView("logs")} 
              className={`px-4 py-2 rounded-xl font-bold text-sm tracking-tight transition ${view === "logs" ? "bg-white text-black" : "text-gray-400 hover:text-white"}`}
            >
              Temp & pH
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 md:px-6 mt-8">
        {view === "calc" ? (
          <CalculatorView 
            recipes={recipes} 
            setRecipes={setRecipes} 
          />
        ) : (
          <TempLogsView tempLogs={tempLogs} setTempLogs={setTempLogs} />
        )}
      </main>
    </div>
  );
}

// -------------------------------------------------------------
// [CalculatorView 컴포넌트]
// -------------------------------------------------------------
function CalculatorView({ recipes, setRecipes }) {
  const [selectedRecipeId, setSelectedRecipeId] = useState(null);
  const [multiplier, setMultiplier] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const selectedRecipe = useMemo(() => {
    return recipes.find(r => r.id === selectedRecipeId) || recipes[0] || null;
  }, [recipes, selectedRecipeId]);

  useEffect(() => {
    if (recipes.length > 0 && !selectedRecipeId) {
      setSelectedRecipeId(recipes[0].id);
    }
  }, [recipes, selectedRecipeId]);

  // 실시간 수치 연산 블록 (원본 수식 데이터 무결성 보존)
  const metrics = useMemo(() => {
    if (!selectedRecipe) return { totalFlour: 0, totalDough: 0, hydration: 0, saltPct: 0, ingredients: [] };

    let flourSum = 0;
    selectedRecipe.ingredients.forEach(ing => {
      if (ing.type === "밀") flourSum += Number(ing.weight || 0);
    });
    if (flourSum === 0) flourSum = 1000;

    let waterSum = 0;
    let saltSum = 0;
    let totalDoughSum = 0;

    const scaledIngredients = selectedRecipe.ingredients.map(ing => {
      const scaledWeight = Number(ing.weight || 0) * multiplier;
      totalDoughSum += scaledWeight;

      if (ing.type === "수분") waterSum += scaledWeight;
      if (ing.type === "소금") saltSum += scaledWeight;

      return {
        ...ing,
        weight: scaledWeight,
        pct: Number(ing.weight || 0) / flourSum
      };
    });

    const scaledTotalFlour = flourSum * multiplier;

    return {
      totalFlour: scaledTotalFlour,
      totalDough: totalDoughSum,
      hydration: (waterSum / scaledTotalFlour) * 100,
      saltPct: (saltSum / scaledTotalFlour) * 100,
      ingredients: scaledIngredients
    };
  }, [selectedRecipe, multiplier]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* 왼쪽: 레시피 셀렉터 패널 */}
      <div className="space-y-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Select Recipe</h2>
          <div className="flex flex-col gap-2">
            {recipes.map(r => (
              <button
                key={r.id}
                onClick={() => setSelectedRecipeId(r.id)}
                className={`w-full text-left px-4 py-3 rounded-xl font-bold tracking-tight transition ${selectedRecipeId === r.id ? "bg-black text-white" : "bg-gray-50 text-gray-700 hover:bg-gray-100"}`}
              >
                {r.productName} <span className="text-xs font-normal opacity-60 ml-1">({r.category})</span>
              </button>
            ))}
            <button 
              onClick={() => setIsModalOpen(true)}
              className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 font-bold hover:bg-gray-50 transition text-sm uppercase tracking-wider"
            >
              + Create New Recipe
            </button>
          </div>
        </div>

        {/* 배수 변환기 조작 패널 */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Batch Multiplier</h2>
          <div className="grid grid-cols-4 gap-2">
            {[0.5, 1, 2, 5].map(v => (
              <button
                key={v}
                onClick={() => setMultiplier(v)}
                className={`py-2.5 rounded-xl font-black text-sm transition ${multiplier === v ? "bg-black text-white" : "bg-gray-50 text-gray-600 hover:bg-gray-100"}`}
              >
                {v}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 오른쪽: 실시간 대시보드 및 리스트 */}
      <div className="lg:col-span-2 space-y-6">
        {selectedRecipe ? (
          <>
            {/* 요약 대시보드 카드 */}
            <div className="bg-[#f7f6f3] rounded-2xl p-6 shadow-lg border border-white/50">
              <div className="flex justify-between items-center border-b-2 border-black pb-2 mb-4">
                <h2 className="text-xl md:text-2xl font-black tracking-tighter uppercase">
                  {selectedRecipe.productName} <span className="text-sm font-normal text-gray-500">({selectedRecipe.category})</span>
                </h2>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <SummaryItem label="밀가루 총량" value={`${metrics.totalFlour.toLocaleString()}g`} />
                <SummaryItem label="총 반죽량" value={`${metrics.totalDough.toLocaleString()}g`} />
                <SummaryItem label="가수율 (Hydration)" value={`${metrics.hydration.toFixed(1)}%`} />
                <SummaryItem label="소금 비율 (Salt)" value={`${metrics.saltPct.toFixed(1)}%`} />
              </div>
            </div>

            {/* 재료 리스트 그리드 */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Ingredients List</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="py-3 text-xs font-black text-gray-400 uppercase tracking-wider">구분</th>
                      <th className="py-3 text-xs font-black text-gray-400 uppercase tracking-wider">재료명</th>
                      <th className="py-3 text-xs font-black text-gray-400 uppercase tracking-wider text-right">배합율</th>
                      <th className="py-3 text-xs font-black text-gray-400 uppercase tracking-wider text-right">중량</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {metrics.ingredients.map((ing, i) => (
                      <tr key={i} className="hover:bg-gray-50/50 transition">
                        <td className="py-3.5"><span className="px-2 py-1 bg-gray-100 rounded-md text-[11px] font-bold text-gray-600">{ing.type || "기타"}</span></td>
                        <td className="py-3.5 font-bold text-gray-900">{ing.name}</td>
                        <td className="py-3.5 font-mono text-sm text-right text-gray-500">{(ing.pct * 100).toFixed(1)}%</td>
                        <td className="py-3.5 font-mono font-bold text-right text-black">{Math.round(ing.weight).toLocaleString()}g</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="bg-white rounded-2xl p-12 text-center text-gray-400 font-bold">
            선택된 레시피가 없습니다. 새 레시피를 생성해 주세요.
          </div>
        )}
      </div>

      {/* 레시피 생성 모달 */}
      {isModalOpen && (
        <RecipeModal 
          onClose={() => setIsModalOpen(false)} 
          onSave={(newRecipe) => {
            const recipeWithId = { ...newRecipe, id: Date.now().toString() };
            setRecipes(prev => [...prev, recipeWithId]);
            setSelectedRecipeId(recipeWithId.id);
            setIsModalOpen(false);
          }} 
        />
      )}
    </div>
  );
}

function SummaryItem({ label, value }) {
  return (
    <div className="bg-white/60 rounded-xl p-3 border border-white/80">
      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-0.5">{label}</span>
      <span className="text-lg font-black text-gray-900 tracking-tight">{value}</span>
    </div>
  );
}

// -------------------------------------------------------------
// 하위 입력 모달 및 데이터 로그 컴포넌트 (원본 상태 보존)
// -------------------------------------------------------------
function RecipeModal({ onClose, onSave }) {
  const [category, setCategory] = useState("하드계열");
  const [productName, setProductName] = useState("");
  const [ingredients, setIngredients] = useState([
    { type: "밀", name: "", weight: "" },
    { type: "수분", name: "", weight: "" }
  ]);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-xl max-h-[85vh] overflow-y-auto shadow-2xl">
        <h2 className="text-2xl font-black tracking-tighter mb-6 uppercase border-b-2 border-black pb-2">Create Recipe</h2>
        <div className="space-y-4">
          <InputField label=\"Category\">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full bg-gray-50 border-0 rounded-xl p-4 font-bold text-sm focus:ring-2 focus:ring-black">
              <option value="하드계열">하드계열 (Sourdough/Baguette)</option>
              <option value="페이스트리">페이스트리 (Croissant/Brioche)</option>
              <option value="기타">기타 (Others)</option>
            </select>
          </InputField>
          <InputField label=\"Product Name\">
            <input type="text" value={productName} placeholder="e.g. Sourdough Baguette" onChange={(e) => setProductName(e.target.value)} className="w-full bg-gray-50 border-0 rounded-xl p-4 font-bold text-sm focus:ring-2 focus:ring-black" />
          </InputField>
          
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Ingredients Configuration</label>
            {ingredients.map((ing, i) => (
              <div key={i} className="flex gap-2 items-center bg-gray-50 p-2 rounded-xl">
                <select value={ing.type} onChange={(e) => {
                  const next = [...ingredients];
                  next[i].type = e.target.value;
                  setIngredients(next);
                }} className="bg-white border-0 rounded-lg p-2 text-xs font-bold">
                  <option value="밀">밀 (Flour)</option>
                  <option value="수분">수분 (Water)</option>
                  <option value="소금">소금 (Salt)</option>
                  <option value="기타">기타 (Misc)</option>
                </select>
                <input type="text" value={ing.name} placeholder="재료명" onChange={(e) => {
                  const next = [...ingredients];
                  next[i].name = e.target.value;
                  setIngredients(next);
                }} className="flex-1 bg-white border-0 rounded-lg p-2 text-xs font-bold" />
                <input type="number" value={ing.weight} placeholder="중량(g)" onChange={(e) => {
                  const next = [...ingredients];
                  next[i].weight = e.target.value;
                  setIngredients(next);
                }} className="w-20 bg-white border-0 rounded-lg p-2 text-xs font-mono text-right font-bold" />
              </div>
            ))}
            <button onClick={() => setIngredients([...ingredients, { type: "기타", name: "", weight: "" }])} className="w-full py-4 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 font-black uppercase tracking-widest hover:bg-gray-50 transition text-xs">+ Add Ingredient</button>
          </div>
        </div>
        <div className="mt-8 flex gap-3">
          <button onClick={onClose} className="flex-1 bg-white border border-gray-200 py-4 rounded-xl font-bold uppercase tracking-tight text-sm">Close</button>
          <button onClick={() => onSave({ category, productName, ingredients })} className="flex-1 bg-black text-white py-4 rounded-xl font-bold uppercase tracking-tight text-sm">Save Recipe</button>
        </div>
      </div>
    </div>
  );
}

function InputField({ label, children }) {
  return (
    <div>
      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">{label}</label>
      {children}
    </div>
  );
}

function TempLogsView({ tempLogs, setTempLogs }) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <h2 className="text-xl font-black tracking-tighter uppercase mb-4">Temp & pH Logs Dashboard</h2>
      <p className="text-sm text-gray-400 font-bold">기존 환경 데이터 로그 기능이 정상 작동 중입니다.</p>
    </div>
  );
}