"use client";

import { useState, useEffect, useMemo } from "react";

export default function Home() {
  const [view, setView] = useState("calc"); 
  const [recipes, setRecipes] = useState([]);
  const [tempLogs, setTempLogs] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const savedRecipes = localStorage.getItem("bakery_recipes");
    const savedTempLogs = localStorage.getItem("bakery_temp_ph");
    if (savedRecipes) setRecipes(JSON.parse(savedRecipes));
    if (savedTempLogs) setTempLogs(JSON.parse(savedTempLogs));
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("bakery_recipes", JSON.stringify(recipes));
      localStorage.setItem("bakery_temp_ph", JSON.stringify(tempLogs));
    }
  }, [recipes, tempLogs, isLoaded]);

  if (!isLoaded) return <div className="min-h-screen bg-[#f7f6f3]" />;

  return (
    <div className="min-h-screen bg-[#f7f6f3] pb-10">
      <nav className="sticky top-0 z-40 flex gap-4 md:gap-8 p-4 md:p-6 bg-white/80 backdrop-blur-md border-b border-gray-200 justify-start md:justify-center overflow-x-auto whitespace-nowrap shadow-sm no-scrollbar">
        <NavButton active={view === "calc"} onClick={() => setView("calc")}>레시피 계산기</NavButton>
        <NavButton active={view === "db"} onClick={() => setView("db")}>레시피 DB</NavButton>
        <NavButton active={view === "temp_db"} onClick={() => setView("temp_db")}>온도/pH 히스토리</NavButton>
      </nav>

      <div className="py-4 md:py-8">
        {view === "calc" && <RecipeCalculator recipes={recipes} setRecipes={setRecipes} tempLogs={tempLogs} setTempLogs={setTempLogs} />}
        {view === "db" && <RecipeDB recipes={recipes} setRecipes={setRecipes} />}
        {view === "temp_db" && <TempPhDB tempLogs={tempLogs} setTempLogs={setTempLogs} />}
      </div>
    </div>
  );
}

function NavButton({ active, onClick, children }) {
  return (
    <button onClick={onClick} className={`text-sm md:text-lg font-black tracking-tighter transition-all px-2 ${active ? 'text-black border-b-2 border-black' : 'text-gray-400 hover:text-gray-600'}`}>{children}</button>
  );
}

function RecipeCalculator({ recipes, setRecipes, tempLogs, setTempLogs }) {
  const [category, setCategory] = useState("하드계열");
  const [selectedRecipeId, setSelectedRecipeId] = useState("");
  const [totalDough, setTotalDough] = useState("");
  const [flourWeight, setFlourWeight] = useState("");
  const [pfYields, setPfYields] = useState({});
  const [memo, setMemo] = useState("");
  
  // 두 가지 기준의 배수 상태값 독립 운영
  const [doughMultiplier, setDoughMultiplier] = useState("1");
  const [flourMultiplier, setFlourMultiplier] = useState("1");

  const filteredRecipes = recipes.filter(r => r.category === category);
  const currentRecipe = recipes.find(r => r.id === Number(selectedRecipeId));
  
  const preFerments = useMemo(() => {
    return currentRecipe ? currentRecipe.ingredients.filter(ing => ing.type === "사전반죽") : [];
  }, [currentRecipe]);

  const handlePercentChange = (ingName, value) => {
    if (!currentRecipe) return;
    const cleanValue = value.replace(',', '.');
    const updatedRecipes = recipes.map(recipe => {
      if (recipe.id === currentRecipe.id) {
        const updatedIngredients = recipe.ingredients.map(ing => {
          if (ing.name === ingName) return { ...ing, percent: cleanValue };
          return ing;
        });
        return { ...recipe, ingredients: updatedIngredients };
      }
      return recipe;
    });
    setRecipes(updatedRecipes);
    // 비율 직접 변경 시 배수창들 초기화
    setDoughMultiplier("");
    setFlourMultiplier("");
  };

  const totals = useMemo(() => {
    if (!currentRecipe) return { totalPercent: 0, totalSaltPercent: 0, finalYield: 0, totalCost: 0, baseTotalDough: 0 };
    let totalFlourPct = 0; 
    let totalWaterPct = 0; 
    let totalSaltPct = 0; 
    let rawTotalPercent = 0;

    currentRecipe.ingredients.forEach(ing => {
      const pct = parseFloat(String(ing.percent).replace(',', '.')) || 0;
      rawTotalPercent += pct;
      if (ing.type === "밀") totalFlourPct += pct;
      else if (ing.type === "수분") totalWaterPct += pct;
      else if (ing.type === "소금") totalSaltPct += pct;
      else if (ing.type === "사전반죽") {
        const yieldInput = parseFloat(String(pfYields[ing.name] || "100").replace(',', '.')) || 100;
        const pfFlourPart = pct / (1 + yieldInput / 100);
        const pfWaterPart = pfFlourPart * (yieldInput / 100);
        totalFlourPct += pfFlourPart; 
        totalWaterPct += pfWaterPart;
      }
    });

    const realSaltPercent = totalFlourPct > 0 ? (totalSaltPct / totalFlourPct) * 100 : 0;
    const finalYield = totalFlourPct > 0 ? (totalWaterPct / totalFlourPct) * 100 : 0;
    const cost = currentRecipe.ingredients.reduce((sum, ing) => {
        const pctVal = parseFloat(String(ing.percent).replace(',', '.')) || 0;
        const weight = flourWeight ? (parseFloat(String(flourWeight).replace(',', '.')) * (pctVal / 100)) : 0;
        return sum + (weight * (parseFloat(String(ing.cost).replace(',', '.')) || 0));
    }, 0);

    // 기본 기준점: 밀가루 1000g 일 때의 기본 총 반죽량
    const baseTotalDough = 1000 * (rawTotalPercent / 100);

    return { totalPercent: rawTotalPercent, totalSaltPercent: realSaltPercent.toFixed(2), finalYield, totalCost: cost, baseTotalDough };
  }, [currentRecipe, pfYields, flourWeight]);

  // 1. 총 반죽량 기준 배수 변경 함수
  const handleDoughMultiplierChange = (value) => {
    const cleanValue = value.replace(',', '.');
    setDoughMultiplier(cleanValue);
    setFlourMultiplier(""); // 다른 쪽 배수 칸은 비워둠

    if (!currentRecipe || totals.totalPercent === 0 || totals.baseTotalDough === 0) return;
    
    const multiplier = parseFloat(cleanValue);
    if (isNaN(multiplier) || multiplier <= 0) {
      setFlourWeight("");
      setTotalDough("");
      return;
    }

    // 밀가루 1000g 기준의 기본 총반죽량에 배율을 곱함
    const targetDough = totals.baseTotalDough * multiplier;
    const targetFlour = 1000 * multiplier;

    setTotalDough(Math.round(targetDough));
    setFlourWeight(Math.round(targetFlour));
  };

  // 2. 밀가루량 기준 배수 변경 함수
  const handleFlourMultiplierChange = (value) => {
    const cleanValue = value.replace(',', '.');
    setFlourMultiplier(cleanValue);
    setDoughMultiplier(""); // 다른 쪽 배수 칸은 비워둠

    if (!currentRecipe || totals.totalPercent === 0) return;
    
    const multiplier = parseFloat(cleanValue);
    if (isNaN(multiplier) || multiplier <= 0) {
      setFlourWeight("");
      setTotalDough("");
      return;
    }

    // 밀가루 기본 1000g 기준에 배율을 곱함
    const targetFlour = 1000 * multiplier;
    const targetDough = targetFlour * (totals.totalPercent / 100);

    setFlourWeight(Math.round(targetFlour));
    setTotalDough(Math.round(targetDough));
  };

  // 레시피 초기 선택 시 기본값 세팅 (밀가루 1000g 기준 = 1배수 기본값)
  useEffect(() => {
    if (currentRecipe && totals.totalPercent > 0) {
      setFlourMultiplier("1");
      setDoughMultiplier("1");
      const targetFlour = 1000;
      const targetDough = targetFlour * (totals.totalPercent / 100);
      setFlourWeight(Math.round(targetFlour));
      setTotalDough(Math.round(targetDough));
    } else {
      setTotalDough("");
      setFlourWeight("");
      setDoughMultiplier("1");
      setFlourMultiplier("1");
    }
  }, [selectedRecipeId]);

  return (
    <main className="max-w-6xl mx-auto px-4 md:px-8 text-black">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 md:gap-8">
        <section className="bg-[#f7f6f3] rounded-2xl p-5 md:p-6 shadow-lg border border-white/50 order-1">
          <div className="border-b-2 border-black pb-3 mb-6">
            <h1 className="text-3xl md:text-4xl font-black tracking-tighter truncate uppercase">
              {currentRecipe ? currentRecipe.productName : "CALCULATOR"}
            </h1>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-8 text-sm">
            <InputField label="제품 분류">
              <select value={category} onChange={(e) => { setCategory(e.target.value); setSelectedRecipeId(""); setPfYields({}); setTotalDough(""); setFlourWeight(""); }} className="bg-transparent border-b border-black font-bold outline-none w-full pb-1">
                <option value="하드계열">하드계열</option>
                <option value="소프트계열">소프트계열</option>
                <option value="사전반죽">사전반죽</option>
              </select>
            </InputField>
            <InputField label="제품명 선택">
              <select value={selectedRecipeId} onChange={(e) => { setSelectedRecipeId(e.target.value); setPfYields({}); setTotalDough(""); setFlourWeight(""); }} className="bg-transparent border-b border-black font-bold outline-none w-full pb-1">
                <option value="">선택하세요</option>
                {filteredRecipes.map(r => <option key={r.id} value={r.id}>{r.productName}</option>)}
              </select>
            </InputField>
            
            {/* 총 반죽량 구역 */}
            <div className="flex flex-col justify-between">
              <InputField label="총 반죽량 (g)">
                <input type="text" inputMode="decimal" value={totalDough} onChange={(e) => {
                  const val = e.target.value.replace(',', '.');
                  setTotalDough(val);
                  setDoughMultiplier(""); 
                  setFlourMultiplier(""); 
                  if (!val || totals.totalPercent === 0) setFlourWeight("");
                  else setFlourWeight(Math.round(parseFloat(val) / (totals.totalPercent / 100)));
                }} placeholder="0" className="bg-transparent border-b border-black font-bold w-full pb-1 outline-none" />
              </InputField>
              
              {currentRecipe && (
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-tight">총반죽 기준:</span>
                  <div className="flex items-center border-b border-black/20 focus-within:border-black transition-colors">
                    <input 
                      type="text" 
                      inputMode="decimal" 
                      value={doughMultiplier} 
                      onChange={(e) => handleDoughMultiplierChange(e.target.value)}
                      placeholder="1.0" 
                      className="w-12 bg-transparent text-center font-mono text-[11px] font-bold outline-none pb-0.5"
                    />
                    <span className="text-[10px] font-bold text-gray-400 px-0.5">배</span>
                  </div>
                </div>
              )}
            </div>

            {/* 밀가루량 구역 */}
            <div className="flex flex-col justify-between">
              <InputField label="밀가루량 (g)">
                <input type="text" inputMode="decimal" value={flourWeight} onChange={(e) => {
                  const val = e.target.value.replace(',', '.');
                  setFlourWeight(val);
                  setDoughMultiplier(""); 
                  setFlourMultiplier(""); 
                  if (!val) setTotalDough("");
                  else setTotalDough(Math.round(parseFloat(val) * (totals.totalPercent / 100)));
                }} placeholder="0" className="bg-transparent border-b border-black font-bold w-full pb-1 outline-none" />
              </InputField>

              {currentRecipe && (
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-tight">밀가루 기준:</span>
                  <div className="flex items-center border-b border-black/20 focus-within:border-black transition-colors">
                    <input 
                      type="text" 
                      inputMode="decimal" 
                      value={flourMultiplier} 
                      onChange={(e) => handleFlourMultiplierChange(e.target.value)}
                      placeholder="1.0" 
                      className="w-12 bg-transparent text-center font-mono text-[11px] font-bold outline-none pb-0.5"
                    />
                    <span className="text-[10px] font-bold text-gray-400 px-0.5">배</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full mt-4 min-w-[300px]">
              <thead>
                <tr className="border-y border-black text-[10px] text-gray-400 uppercase tracking-widest">
                  <th className="p-2 text-left">재료</th><th className="p-2 text-right">% (수정)</th><th className="p-2 text-right w-24">g</th>
                </tr>
              </thead>
              <tbody>
                {currentRecipe ? currentRecipe.ingredients.map((ing, idx) => (
                  <tr key={idx} className="border-b border-gray-200">
                    <td className="p-2">
                        <div className="text-[9px] text-gray-400 font-bold uppercase">{ing.type}</div>
                        <div className="font-black text-sm">{ing.name}</div>
                    </td>
                    <td className="p-2 text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <input 
                          type="text" inputMode="decimal" value={ing.percent}
                          size={String(ing.percent).length || 1}
                          onChange={(e) => handlePercentChange(ing.name, e.target.value)}
                          style={{ minWidth: '1.5rem' }}
                          className="bg-transparent border-b border-black/10 hover:border-black text-right font-mono text-sm font-bold outline-none transition-colors pb-1 h-auto"
                        />
                        <span className="font-mono text-xs font-bold text-gray-400">%</span>
                      </div>
                    </td>
                    <td className="p-2 text-right font-bold text-gray-400 text-sm">
                      {flourWeight ? Math.round((parseFloat(String(flourWeight).replace(',','.')) || 0) * ((parseFloat(String(ing.percent).replace(',','.')) || 0) / 100)).toLocaleString() : 0}g
                    </td>
                  </tr>
                )) : <tr><td colSpan="3" className="p-12 text-center text-gray-400 text-xs tracking-widest uppercase">Select a recipe</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <div className="space-y-6 order-2">
          {category !== "사전반죽" && (
            <>
              <SummaryCard title="SUMMARY">
                <SummaryRow label="사전반죽 포함 수율" value={`${totals.finalYield.toFixed(1)}%`} />
                <SummaryRow label="사전반죽 포함 소금" value={`${totals.totalSaltPercent}%`} />
                <SummaryRow label="총 반죽량" value={`${Number(String(totalDough).replace(',', '.')).toLocaleString()}g`} />
                <SummaryRow label="총 원가" value={`₩${Math.round(totals.totalCost).toLocaleString()}`} />
              </SummaryCard>

              {preFerments.length > 0 && (
                <SummaryCard title="PRE-FERMENT">
                  <div className="space-y-3">
                    {preFerments.map(pf => (
                      <div key={pf.name} className="flex justify-between items-center border-b border-black/5 pb-2">
                        <span className="text-sm font-bold">{pf.name}</span>
                        <div className="flex items-center gap-2">
                          <input 
                            type="text" inputMode="decimal"
                            value={pfYields[pf.name] || ""} 
                            onChange={(e) => setPfYields({ ...pfYields, [pf.name]: e.target.value.replace(',', '.') })}
                            className="w-16 bg-white border border-gray-200 rounded px-2 py-1 text-right font-mono text-xs outline-none"
                            placeholder="100"
                          />
                          <span className="text-[10px] font-bold text-gray-400">%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </SummaryCard>
              )}
            </>
          )}

          <QuickTempEntry 
            tempLogs={tempLogs} 
            setTempLogs={setTempLogs} 
            currentProductName={currentRecipe?.productName} 
            memo={memo}
            setMemo={setMemo}
            isPreFermentMode={category === "사전반죽"}
          />
        </div>
      </div>
    </main>
  );
}

function QuickTempEntry({ tempLogs, setTempLogs, currentProductName, memo, setMemo, isPreFermentMode }) {
  const [isEntryMode, setIsEntryMode] = useState(false);
  const [logType, setLogType] = useState("1차 저온");
  const [currentEntry, setCurrentEntry] = useState({});

  const normalItems = ["날짜", "르방", "밀", "물", "결과", "오토리즈", "오토리즈완료", "반죽완료", "하바1", "하바2", "하바3", "하바4", "분할", "성형", "굽기"];
  const pfItems = ["날짜", "르방", "수분", "밀", "결과", "사용시점", "정점"];
  const items = isPreFermentMode ? pfItems : normalItems;

  const latestLog = useMemo(() => {
    return tempLogs.find(l => l.productName === currentProductName);
  }, [tempLogs, currentProductName]);

  const handleSave = () => {
    if (!currentProductName) return;
    const now = new Date();
    const newLog = { 
      id: Date.now(),
      productName: currentProductName,
      type: isPreFermentMode ? "사전반죽 기록" : logType, 
      displayTime: now.toLocaleString(),
      timestamp: currentEntry["날짜"]?.t || now.toLocaleDateString(), 
      data: currentEntry,
      memo: memo 
    };
    setTempLogs([newLog, ...tempLogs]);
    setIsEntryMode(false);
    setCurrentEntry({});
    setMemo(""); 
    alert("데이터베이스에 저장되었습니다.");
  };

  if (!currentProductName) return (
    <SummaryCard title="TEMP / pH / MEMO">
        <p className="text-center py-4 text-[10px] text-gray-400 font-bold uppercase tracking-widest">Select a recipe first</p>
    </SummaryCard>
  );

  return (
    <SummaryCard title="TEMP / pH / MEMO">
      <div className="flex justify-between items-center mb-4">
        {!isPreFermentMode ? (
          <select value={logType} onChange={(e) => setLogType(e.target.value)} className="bg-transparent font-black text-[10px] uppercase border-b border-black outline-none">
            <option>1차 저온</option><option>2차 저온</option>
          </select>
        ) : (
          <span className="font-black text-[10px] uppercase text-gray-400">Pre-Ferment Log</span>
        )}
        <button onClick={() => setIsEntryMode(!isEntryMode)} className="text-[10px] font-black underline uppercase">{isEntryMode ? "Close" : "+ Add"}</button>
      </div>

      {isEntryMode ? (
        <div className="space-y-4 max-h-[450px] overflow-y-auto pr-1">
          <div className="space-y-2">
            {items.map(item => (
              <div key={item} className="grid grid-cols-[1fr_120px] gap-2 items-center border-b border-black/5 pb-1">
                <span className="text-[11px] font-bold uppercase">{item}</span>
                <div className="grid grid-cols-2 gap-1">
                  {item === "날짜" ? (
                    <input type="date" className="col-span-2 bg-white rounded p-1 text-right font-mono text-[10px] border border-gray-100 outline-none"
                      onChange={(e) => setCurrentEntry({ ...currentEntry, [item]: { t: e.target.value } })} />
                  ) : isPreFermentMode && (item === "사용시점" || item === "정점") ? (
                    <div className="col-span-2 grid grid-cols-3 gap-1">
                      <input placeholder="pH" type="text" inputMode="decimal" className="bg-white rounded p-1 text-right font-mono text-[10px] border border-gray-100" 
                        onChange={(e) => setCurrentEntry({ ...currentEntry, [item]: { ...currentEntry[item], p: e.target.value.replace(',', '.') } })} />
                      <input placeholder="Min" type="text" className="bg-white rounded p-1 text-right font-mono text-[10px] border border-gray-100" 
                        onChange={(e) => setCurrentEntry({ ...currentEntry, [item]: { ...currentEntry[item], h: e.target.value } })} />
                      <input placeholder="Vol" type="text" className="bg-white rounded p-1 text-right font-mono text-[10px] border border-gray-100" 
                        onChange={(e) => setCurrentEntry({ ...currentEntry, [item]: { ...currentEntry[item], v: e.target.value } })} />
                    </div>
                  ) : isPreFermentMode && item === "결과" ? (
                    <div className="col-span-2 grid grid-cols-3 gap-1">
                      <input placeholder="°C" type="text" inputMode="decimal" className="bg-white rounded p-1 text-right font-mono text-[10px] border border-gray-100" 
                        onChange={(e) => setCurrentEntry({ ...currentEntry, [item]: { ...currentEntry[item], t: e.target.value.replace(',', '.') } })} />
                      <input placeholder="pH" type="text" inputMode="decimal" className="bg-white rounded p-1 text-right font-mono text-[10px] border border-gray-100" 
                        onChange={(e) => setCurrentEntry({ ...currentEntry, [item]: { ...currentEntry[item], p: e.target.value.replace(',', '.') } })} />
                      <input placeholder="Vol" type="text" className="bg-white rounded p-1 text-right font-mono text-[10px] border border-gray-100" 
                        onChange={(e) => setCurrentEntry({ ...currentEntry, [item]: { ...currentEntry[item], v: e.target.value } })} />
                    </div>
                  ) : item === "밀" ? (
                    <input placeholder="°C" type="text" inputMode="decimal" className="col-span-2 bg-white rounded p-1 text-right font-mono text-[10px] border border-gray-100" 
                      onChange={(e) => setCurrentEntry({ ...currentEntry, [item]: { t: e.target.value.replace(',', '.') } })} />
                  ) : (
                    <>
                      <input placeholder="°C" type="text" inputMode="decimal" className="bg-white rounded p-1 text-right font-mono text-[10px] border border-gray-100" 
                        onChange={(e) => setCurrentEntry({ ...currentEntry, [item]: { ...currentEntry[item], t: e.target.value.replace(',', '.') } })} />
                      <input placeholder="pH" type="text" inputMode="decimal" className="bg-white rounded p-1 text-right font-mono text-[10px] border border-gray-100" 
                        onChange={(e) => setCurrentEntry({ ...currentEntry, [item]: { ...currentEntry[item], p: e.target.value.replace(',', '.') } })} />
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="pt-2">
            <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block tracking-widest">Memo</label>
            <textarea value={memo} onChange={(e) => setMemo(e.target.value)} className="w-full bg-white/50 border border-black/5 rounded-lg p-3 text-xs leading-5 resize-none h-24 outline-none font-medium" placeholder="Notes..." />
          </div>
          <button onClick={handleSave} className="w-full bg-black text-white py-3 rounded-xl font-bold text-xs mt-2 uppercase shadow-lg">Save to DB</button>
        </div>
      ) : (
        <div className="space-y-4">
          {latestLog ? (
            <>
              <div className="bg-white/50 p-2 rounded-lg border border-white text-[10px]">
                <div className="flex justify-between mb-1 border-b border-black/5 font-bold text-gray-400 uppercase tracking-tighter">
                  <span className="text-black">LATEST ({latestLog.type})</span>
                  <span>{latestLog.timestamp}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                  {items.map(item => latestLog.data[item] && (latestLog.data[item].t || latestLog.data[item].p || latestLog.data[item].h || latestLog.data[item].v) ? (
                    <div key={item} className="flex justify-between border-b border-gray-50/50">
                      <span className="text-gray-400 font-bold uppercase">{item}</span>
                      <span className="font-mono">
                        {latestLog.data[item].t && `${latestLog.data[item].t}${item !== "날짜" ? "°" : ""}`}
                        {latestLog.data[item].p && ` / ${latestLog.data[item].p}pH`}
                        {latestLog.data[item].h && ` / ${latestLog.data[item].h}m`}
                        {latestLog.data[item].v && ` / ${latestLog.data[item].v}`}
                      </span>
                    </div>
                  ) : null)}
                </div>
              </div>
              {latestLog.memo && <div className="bg-white/30 p-3 rounded-lg border-l-2 border-black/10 text-[11px] font-medium text-gray-600 leading-relaxed">{latestLog.memo}</div>}
              <div className="pt-2 border-t border-dashed border-black/10">
                <textarea value={memo} onChange={(e) => setMemo(e.target.value)} className="w-full bg-transparent border-none outline-none text-[11px] leading-5 resize-none h-16 font-medium" placeholder="Quick memo..." />
              </div>
            </>
          ) : (
            <>
              <p className="text-center py-2 text-[10px] text-gray-400 font-bold uppercase tracking-widest border-b border-dashed border-black/10 mb-2">No records</p>
              <textarea value={memo} onChange={(e) => setMemo(e.target.value)} className="w-full bg-transparent border-none outline-none text-[11px] leading-5 resize-none h-24 font-medium" placeholder="Write notes here..." />
            </>
          )}
        </div>
      )}
    </SummaryCard>
  );
}

function TempPhDB({ tempLogs, setTempLogs }) {
  const normalItems = ["날짜", "르방", "밀", "물", "결과", "오토리즈", "오토리즈완료", "반죽완료", "하바1", "하바2", "하바3", "하바4", "분할", "성형", "굽기"];
  const pfItems = ["날짜", "르방", "수분", "밀", "결과", "사용시점", "정점"];
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedProduct, setExpandedProduct] = useState(null);

  const groupedLogs = useMemo(() => {
    const groups = {};
    const filtered = tempLogs.filter(log => log.productName.toLowerCase().includes(searchTerm.toLowerCase()));
    filtered.forEach(log => {
      if (!groups[log.productName]) groups[log.productName] = {};
      const dateKey = log.timestamp || "날짜 미지정";
      if (!groups[log.productName][dateKey]) groups[log.productName][dateKey] = [];
      groups[log.productName][dateKey].push(log);
    });
    return groups;
  }, [tempLogs, searchTerm]);

  return (
    <main className="max-w-6xl mx-auto px-4 md:px-8 text-black">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b-2 border-black pb-4 mb-8 gap-4">
        <h1 className="text-3xl md:text-4xl font-black tracking-tighter uppercase">History</h1>
        <input type="text" placeholder="Search product..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full md:w-64 bg-white border border-gray-200 rounded-full px-4 py-2 text-sm outline-none shadow-inner" />
      </div>
      <div className="space-y-4">
        {Object.entries(groupedLogs).map(([productName, dateGroups]) => (
          <div key={productName} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <div onClick={() => setExpandedProduct(expandedProduct === productName ? null : productName)} className="p-5 flex justify-between items-center cursor-pointer hover:bg-gray-50">
              <div>
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Product</div>
                <div className="text-xl font-black tracking-tighter uppercase">{productName}</div>
              </div>
              <span className="text-xs">{expandedProduct === productName ? "▲" : "▼"}</span>
            </div>
            {expandedProduct === productName && (
              <div className="px-5 pb-5 bg-[#fcfcfb]">
                {Object.entries(dateGroups).map(([date, logs]) => (
                  <div key={date} className="border-t border-gray-100 py-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {logs.map(log => {
                        const activeItems = log.type === "사전반죽 기록" ? pfItems : normalItems;
                        return (
                          <div key={log.id} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm relative">
                            <div className="mb-4 flex justify-between">
                              <span className="text-[9px] font-black text-gray-400 uppercase bg-gray-100 px-1.5 py-0.5 rounded">{log.type}</span>
                              <button onClick={() => confirm("삭제하시겠습니까?") && setTempLogs(tempLogs.filter(l => l.id !== log.id))} className="text-gray-300 hover:text-red-500 text-xs">✕</button>
                            </div>
                            <div className="space-y-1">
                              {activeItems.map(item => log.data[item] && (log.data[item].t || log.data[item].p || log.data[item].h || log.data[item].v) ? (
                                <div key={item} className="flex justify-between text-[11px] border-b border-gray-50 pb-0.5">
                                  <span className="font-bold text-gray-400 uppercase">{item}</span>
                                  <span className="font-mono text-black">
                                    {log.data[item].t}{log.data[item].t && item !== "날짜" ? "°" : ""}
                                    {log.data[item].p ? ` / ${log.data[item].p}pH` : ""}
                                    {log.data[item].h ? ` / ${log.data[item].h}m` : ""}
                                    {log.data[item].v ? ` / ${log.data[item].v}` : ""}
                                  </span>
                                </div>
                              ) : null)}
                            </div>
                            {log.memo && <div className="mt-3 pt-2 border-t border-dashed text-[10px] font-medium text-gray-500 whitespace-pre-wrap">{log.memo}</div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}

function RecipeDB({ recipes, setRecipes }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingRecipe, setEditingRecipe] = useState(null);
  const displayedRecipes = recipes.filter(r => r.productName.toLowerCase().includes(searchTerm.toLowerCase()));
  return (
    <main className="max-w-6xl mx-auto px-4 md:px-8 text-black">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b-2 border-black pb-4 mb-6 gap-4">
        <h1 className="text-3xl md:text-4xl font-black tracking-tighter uppercase">Recipe DB</h1>
        <div className="flex gap-2 w-full md:w-auto">
          <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex-1 md:w-48 bg-white border border-gray-200 rounded-full px-4 py-2 text-sm outline-none shadow-inner" />
          <button onClick={() => { setEditingRecipe(null); setIsModalOpen(true); }} className="bg-black text-white px-6 py-2 rounded-full font-bold text-sm uppercase tracking-tighter">+ Add</button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {displayedRecipes.map(recipe => (
          <div key={recipe.id} onClick={() => { setEditingRecipe(recipe); setIsModalOpen(true); }} className="bg-white p-5 rounded-2xl border border-gray-100 flex justify-between items-center cursor-pointer hover:border-black group transition-all">
            <div>
              <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{recipe.category}</div>
              <div className="text-xl font-black tracking-tighter uppercase">{recipe.productName}</div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); if (confirm("삭제하시겠습니까?")) setRecipes(recipes.filter(r => r.id !== recipe.id)); }} className="text-gray-300 hover:text-red-500">✕</button>
          </div>
        ))}
      </div>
      {isModalOpen && <RecipeModal initialData={editingRecipe} onSave={(data) => {
        if (editingRecipe) setRecipes(recipes.map(r => r.id === editingRecipe.id ? { ...data, id: r.id } : r));
        else setRecipes([...recipes, { ...data, id: Date.now() }]);
        setIsModalOpen(false);
      }} onClose={() => setIsModalOpen(false)} />}
    </main>
  );
}

function RecipeModal({ initialData, onSave, onClose }) {
  const [category, setCategory] = useState(initialData?.category || "하드계열");
  const [productName, setProductName] = useState(initialData?.productName || "");
  const [ingredients, setIngredients] = useState(initialData?.ingredients || [{ type: "밀", name: "", percent: "", cost: "" }]);
  const updateIng = (i, f, v) => setIngredients(ingredients.map((ing, idx) => idx === i ? { ...ing, [f]: (f === "percent" || f === "cost") ? v.replace(',', '.') : v } : ing));
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-[#f7f6f3] w-full max-w-4xl rounded-[2rem] p-6 md:p-12 shadow-2xl max-h-[90vh] overflow-y-auto relative">
        <button onClick={onClose} className="absolute top-6 right-6 text-xl">✕</button>
        <h2 className="text-2xl md:text-3xl font-black tracking-tighter mb-8 uppercase">Recipe Editor</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <InputField label="분류"><select value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-transparent border-b-2 border-black py-2 outline-none font-bold"><option value="하드계열">하드계열</option><option value="소프트계열">소프트계열</option><option value="사전반죽">사전반죽</option></select></InputField>
          <InputField label="제품명"><input value={productName} onChange={e => setProductName(e.target.value)} className="w-full bg-transparent border-b-2 border-black py-2 outline-none font-bold" /></InputField>
        </div>
        <div className="space-y-3">
          {ingredients.map((ing, i) => (
            <div key={i} className="grid grid-cols-2 md:grid-cols-[120px_1fr_80px_100px_40px] gap-2 md:gap-4 items-center bg-white p-3 md:p-4 rounded-xl shadow-sm">
              <select value={ing.type} onChange={e => updateIng(i, "type", e.target.value)} className="bg-gray-50 p-2 rounded-lg text-xs font-bold"><option>밀</option><option>수분</option><option>사전반죽</option><option>소금</option><option>기타</option></select>
              <input value={ing.name} onChange={e => updateIng(i, "name", e.target.value)} className="bg-gray-50 p-2 rounded-lg text-xs font-bold" placeholder="Ingredient Name" />
              <input value={ing.percent} onChange={e => updateIng(i, "percent", e.target.value)} className="bg-gray-50 p-2 rounded-lg text-xs text-right font-mono font-bold" placeholder="%" type="text" inputMode="decimal" />
              <input value={ing.cost} onChange={e => updateIng(i, "cost", e.target.value)} className="bg-gray-50 p-2 rounded-lg text-xs text-right font-mono font-bold" placeholder="Cost" type="text" inputMode="decimal" />
              <button onClick={() => setIngredients(ingredients.filter((_, idx) => idx !== i))} className="text-red-300 font-bold">✕</button>
            </div>
          ))}
          <button onClick={() => setIngredients([...ingredients, { type: "밀", name: "", percent: "", cost: "" }])} className="w-full py-4 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 font-black uppercase tracking-widest">+ Add Ingredient</button>
        </div>
        <div className="mt-10 flex gap-3">
          <button onClick={onClose} className="flex-1 bg-white border border-gray-200 py-4 rounded-xl font-bold uppercase tracking-tighter">Close</button>
          <button onClick={() => onSave({ category, productName, ingredients })} className="flex-1 bg-black text-white py-4 rounded-xl font-bold uppercase tracking-tighter">Save Recipe</button>
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

function SummaryCard({ title, children }) {
  return (
    <div className="bg-[#f7f6f3] rounded-2xl p-5 md:p-6 shadow-lg border border-white/50">
      <h2 className="text-xl md:text-2xl font-black tracking-tighter border-b-2 border-black pb-2 mb-4 uppercase">{title}</h2>
      {children}
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex justify-between border-b border-dashed pb-2 text-xs md:text-sm mb-2">
      <span className="text-gray-600 font-bold uppercase text-[10px] tracking-tight">{label}</span>
      <span className="font-mono font-bold">{value}</span>
    </div>
  );
}