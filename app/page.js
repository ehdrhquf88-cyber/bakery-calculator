"use client";

import { useState, useEffect, useMemo, useCallback } from "react";

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
    <div className="min-h-screen bg-[#f7f6f3] pb-10 print:bg-white print:pb-0">
      <nav className="sticky top-0 z-40 flex gap-4 md:gap-8 p-4 md:p-6 bg-white/80 backdrop-blur-md border-b border-gray-200 justify-start md:justify-center overflow-x-auto whitespace-nowrap shadow-sm no-scrollbar print:hidden">
        <NavButton active={view === "calc"} onClick={() => setView("calc")}>레시피 계산기</NavButton>
        <NavButton active={view === "db"} onClick={() => setView("db")}>레시피 DB</NavButton>
        <NavButton active={view === "temp_db"} onClick={() => setView("temp_db")}>온도/pH 히스토리</NavButton>
      </nav>

      <div className="py-4 md:py-8 print:py-0">
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
  
  const [doughMultiplier, setDoughMultiplier] = useState("1");
  const [flourMultiplier, setFlourMultiplier] = useState("1");

  const filteredRecipes = useMemo(() => recipes.filter(r => r.category === category), [recipes, category]);
  const currentRecipe = useMemo(() => recipes.find(r => r.id === Number(selectedRecipeId)), [recipes, selectedRecipeId]);
  
  const preFerments = useMemo(() => {
    return currentRecipe ? currentRecipe.ingredients.filter(ing => ing.type === "사전반죽") : [];
  }, [currentRecipe]);

  const handlePercentChange = useCallback((ingName, value) => {
    if (!selectedRecipeId) return;
    const cleanValue = value.replace(',', '.');
    setRecipes(prev => prev.map(recipe => {
      if (recipe.id === Number(selectedRecipeId)) {
        return {
          ...recipe,
          ingredients: recipe.ingredients.map(ing => ing.name === ingName ? { ...ing, percent: cleanValue } : ing)
        };
      }
      return recipe;
    }));
    setDoughMultiplier("1");
    setFlourMultiplier("1");
  }, [selectedRecipeId, setRecipes]);

  const totals = useMemo(() => {
    if (!currentRecipe) return { totalPercent: 0, totalSaltPercent: "0.00", finalYield: 0, totalCost: 0, baseTotalDough: 0 };
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
    
    const parsedFlourWeight = parseFloat(String(flourWeight).replace(',', '.')) || 0;
    const cost = currentRecipe.ingredients.reduce((sum, ing) => {
        const pctVal = parseFloat(String(ing.percent).replace(',', '.')) || 0;
        const weight = parsedFlourWeight * (pctVal / 100);
        const unitCost = parseFloat(String(ing.cost).replace(',', '.')) || 0;
        return sum + (weight * unitCost);
    }, 0);

    const baseTotalDough = 1000 * (rawTotalPercent / 100);

    return { 
      totalPercent: rawTotalPercent, 
      totalSaltPercent: isNaN(realSaltPercent) ? "0.00" : realSaltPercent.toFixed(2), 
      finalYield: isNaN(finalYield) ? 0 : finalYield, 
      totalCost: isNaN(cost) ? 0 : cost, 
      baseTotalDough 
    };
  }, [currentRecipe, pfYields, flourWeight]);

  // ─── 배수 입력 및 연산 동기화 수정 영역 ───
  const handleDoughMultiplierChange = (value) => {
    const cleanValue = value.replace(',', '.');
    setDoughMultiplier(cleanValue); // 사용자가 입력한 숫자(예: 2)가 화면에 그대로 유지되도록 우선 반영
    setFlourMultiplier("1");        // 반대쪽 배수 칸은 기본값으로 초기화

    if (!currentRecipe || totals.totalPercent === 0) return;
    
    const multiplier = parseFloat(cleanValue);
    if (isNaN(multiplier) || multiplier <= 0) {
      return;
    }

    // 인풋창에 현재 들어가 있는 순수 숫자값만 분리 추출 (배수 연산 이전의 순수 베이스 값 유도)
    const currentInputDough = parseFloat(String(totalDough).replace(',', '.')) || totals.baseTotalDough;
    
    const targetDough = currentInputDough * multiplier;
    const targetFlour = targetDough / (totals.totalPercent / 100);

    setTotalDough(Math.round(targetDough));
    setFlourWeight(Math.round(targetFlour));
  };

  const handleFlourMultiplierChange = (value) => {
    const cleanValue = value.replace(',', '.');
    setFlourMultiplier(cleanValue); // 사용자가 입력한 숫자(예: 2)가 화면에 그대로 유지되도록 우선 반영
    setDoughMultiplier("1");        // 반대쪽 배수 칸은 기본값으로 초기화

    if (!currentRecipe || totals.totalPercent === 0) return;
    
    const multiplier = parseFloat(cleanValue);
    if (isNaN(multiplier) || multiplier <= 0) {
      return;
    }

    const currentInputFlour = parseFloat(String(flourWeight).replace(',', '.')) || 1000;

    const targetFlour = currentInputFlour * multiplier;
    const targetDough = targetFlour * (totals.totalPercent / 100);

    setFlourWeight(Math.round(targetFlour));
    setTotalDough(Math.round(targetDough));
  };
  // ─── 배수 입력 및 연산 동기화 수정 영역 끝 ───

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

  const handlePrintPDF = () => {
    if (!currentRecipe) return;
    window.print();
  };

  return (
    <main className="max-w-6xl mx-auto px-4 md:px-8 text-black print:px-0 print:max-w-full">
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { size: auto; margin: 15mm; }
          body { background: white; color: black; }
        }
      `}} />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 md:gap-8 print:block print:space-y-6">
        <section className="bg-[#f7f6f3] rounded-2xl p-5 md:p-6 shadow-lg border border-white/50 order-1 print:bg-white print:shadow-none print:border-none print:p-0">
          <div className="border-b-2 border-black pb-3 mb-6 flex justify-between items-end">
            <h1 className="text-3xl md:text-4xl font-black tracking-tighter truncate uppercase print:text-2xl">
              {currentRecipe ? currentRecipe.productName : "CALCULATOR"}
            </h1>
            {currentRecipe && (
              <button 
                onClick={handlePrintPDF}
                className="bg-black text-white px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-tight hover:bg-gray-800 transition-all shadow-md print:hidden flex items-center gap-1"
              >
                <span>📄</span> PDF 저장 / 인쇄
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-8 text-sm print:mb-4 print:gap-2">
            <InputField label="제품 분류">
              <select value={category} onChange={(e) => { setCategory(e.target.value); setSelectedRecipeId(""); setPfYields({}); setTotalDough(""); setFlourWeight(""); }} className="bg-transparent border-b border-black font-bold outline-none w-full pb-1 print:border-none print:pointer-events-none">
                <option value="하드계열">하드계열</option>
                <option value="소프트계열">소프트계열</option>
                <option value="사전반죽">사전반죽</option>
              </select>
            </InputField>
            <InputField label="제품명 선택">
              <select value={selectedRecipeId} onChange={(e) => { setSelectedRecipeId(e.target.value); setPfYields({}); setTotalDough(""); setFlourWeight(""); }} className="bg-transparent border-b border-black font-bold outline-none w-full pb-1 print:border-none print:pointer-events-none">
                <option value="">선택하세요</option>
                {filteredRecipes.map(r => <option key={r.id} value={r.id}>{r.productName}</option>)}
              </select>
            </InputField>
            
            <div className="flex flex-col justify-between">
              <InputField label="총 반죽량 (g)">
                <input type="text" inputMode="decimal" value={totalDough} onChange={(e) => {
                  const val = e.target.value.replace(',', '.');
                  setTotalDough(val);
                  setDoughMultiplier("1"); // 수량을 수동 수정하면 배수 표기칸은 다시 1로 깔끔하게 초기화
                  setFlourMultiplier("1"); 
                  if (!val || totals.totalPercent === 0) setFlourWeight("");
                  else setFlourWeight(Math.round(parseFloat(val) / (totals.totalPercent / 100)) || "");
                }} placeholder="0" className="bg-transparent border-b border-black font-bold w-full pb-1 outline-none print:border-none" />
              </InputField>
              {currentRecipe && (
                <div className="flex items-center gap-1.5 mt-2 print:hidden">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-tight">총반죽 기준:</span>
                  <div className="flex items-center border-b border-black/20 focus-within:border-black transition-colors">
                    <input type="text" inputMode="decimal" value={doughMultiplier} onChange={(e) => handleDoughMultiplierChange(e.target.value)} placeholder="1.0" className="w-12 bg-transparent text-center font-mono text-[11px] font-bold outline-none pb-0.5" />
                    <span className="text-[10px] font-bold text-gray-400 px-0.5">배</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col justify-between">
              <InputField label="밀가루량 (g)">
                <input type="text" inputMode="decimal" value={flourWeight} onChange={(e) => {
                  const val = e.target.value.replace(',', '.');
                  setFlourWeight(val);
                  setDoughMultiplier("1"); // 수량을 수동 수정하면 배수 표기칸은 다시 1로 깔끔하게 초기화
                  setFlourMultiplier("1"); 
                  if (!val) setTotalDough("");
                  else setTotalDough(Math.round(parseFloat(val) * (totals.totalPercent / 100)) || "");
                }} placeholder="0" className="bg-transparent border-b border-black font-bold w-full pb-1 outline-none print:border-none" />
              </InputField>
              {currentRecipe && (
                <div className="flex items-center gap-1.5 mt-2 print:hidden">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-tight">밀가루 기준:</span>
                  <div className="flex items-center border-b border-black/20 focus-within:border-black transition-colors">
                    <input type="text" inputMode="decimal" value={flourMultiplier} onChange={(e) => handleFlourMultiplierChange(e.target.value)} placeholder="1.0" className="w-12 bg-transparent text-center font-mono text-[11px] font-bold outline-none pb-0.5" />
                    <span className="text-[10px] font-bold text-gray-400 px-0.5">배</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full mt-4 min-w-[300px] print:mt-2">
              <thead>
                <tr className="border-y border-black text-[10px] text-gray-400 uppercase tracking-widest">
                  <th className="p-2 text-left">재료</th><th className="p-2 text-right">% (수정)</th><th className="p-2 text-right w-24">g</th>
                </tr>
              </thead>
              <tbody>
                {currentRecipe ? currentRecipe.ingredients.map((ing, idx) => {
                  const parsedFlour = parseFloat(String(flourWeight).replace(',','.')) || 0;
                  const parsedPercent = parseFloat(String(ing.percent).replace(',','.')) || 0;
                  const computedGrams = Math.round(parsedFlour * (parsedPercent / 100));
                  return (
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
                            className="bg-transparent border-b border-black/10 hover:border-black text-right font-mono text-sm font-bold outline-none transition-colors pb-1 h-auto print:border-none"
                          />
                          <span className="font-mono text-xs font-bold text-gray-400">%</span>
                        </div>
                      </td>
                      <td className="p-2 text-right font-bold text-gray-400 text-sm">
                        {(computedGrams || 0).toLocaleString()}g
                      </td>
                    </tr>
                  );
                }) : <tr><td colSpan="3" className="p-12 text-center text-gray-400 text-xs tracking-widest uppercase">Select a recipe</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <div className="space-y-6 order-2 print:block print:space-y-4">
          {category !== "사전반죽" && (
            <>
              <SummaryCard title="SUMMARY">
                <SummaryRow label="사전반죽 포함 수율" value={`${totals.finalYield.toFixed(1)}%`} />
                <SummaryRow label="사전반죽 포함 소금" value={`${totals.totalSaltPercent}%`} />
                <SummaryRow label="총 반죽량" value={`${(Math.round(parseFloat(String(totalDough).replace(',', '.'))) || 0).toLocaleString()}g`} />
                <SummaryRow label="총 원가" value={`₩${Math.round(totals.totalCost).toLocaleString()}`} />
              </SummaryCard>

              {preFerments.length > 0 && (
                <SummaryCard title="PRE-FERMENT">
                  <div className="space-y-3">
                    {preFerments.map(pf => (
                      <div key={pf.name} className="flex justify-between items-center border-b border-black/5 pb-2">
                        <span className="text-sm font-bold">{pf.name}</span>
                        <div className="flex items-center gap-2">
                          <input type="text" inputMode="decimal" value={pfYields[pf.name] || ""} onChange={(e) => setPfYields({ ...pfYields, [pf.name]: e.target.value.replace(',', '.') })} className="w-16 bg-white border border-gray-200 rounded px-2 py-1 text-right font-mono text-xs outline-none" placeholder="100" />
                          <span className="text-[10px] font-bold text-gray-400">%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </SummaryCard>
              )}
            </>
          )}

          <div className="print:hidden">
            <QuickTempEntry tempLogs={tempLogs} setTempLogs={setTempLogs} currentProductName={currentRecipe?.productName} memo={memo} setMemo={setMemo} isPreFermentMode={category === "사전반죽"} />
          </div>
        </div>
      </div>
    </main>
  );
}

// QuickTempEntry, HistoryChart, TempPhDB, RecipeDB, RecipeModal, InputField, SummaryCard, SummaryRow 컴포넌트들은 기존 구조와 완전히 동일하므로 생략 없이 내부 로직 그대로 완전 보존되어 실행됩니다.
function QuickTempEntry({ tempLogs, setTempLogs, currentProductName, memo, setMemo, isPreFermentMode }) {
  const [isEntryMode, setIsEntryMode] = useState(false);
  const [logType, setLogType] = useState("1차 저온");
  const [currentEntry, setCurrentEntry] = useState({});
  const [editingLogId, setEditingLogId] = useState(null);

  const normalItems = ["날짜", "르방", "밀", "물", "결과", "오토리즈", "오토리즈완료", "반죽완료", "하바1", "하바2", "하바3", "하바4", "분할", "성형", "굽기"];
  const pfItems = ["날짜", "르방", "수분", "밀", "결과", "사용시점", "정점"];
  const items = isPreFermentMode ? pfItems : normalItems;

  const latestLog = useMemo(() => {
    return tempLogs.find(l => l.productName === currentProductName);
  }, [tempLogs, currentProductName]);

  const handleEditActive = (log) => {
    setEditingLogId(log.id);
    setLogType(log.type);
    setCurrentEntry(log.data || {});
    setMemo(log.memo || "");
    setIsEntryMode(true);
  };

  const handleSave = () => {
    if (!currentProductName) return;
    
    if (editingLogId) {
      setTempLogs(prev => prev.map(log => {
        if (log.id === editingLogId) {
          return {
            ...log,
            type: isPreFermentMode ? "사전반죽 기록" : logType,
            data: currentEntry,
            memo: memo,
            timestamp: currentEntry["날짜"]?.t || log.timestamp
          };
        }
        return log;
      }));
      alert("데이터가 수정되었습니다.");
    } else {
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
      setTempLogs(prev => [newLog, ...prev]);
      alert("데이터베이스에 저장되었습니다.");
    }

    setIsEntryMode(false);
    setCurrentEntry({});
    setMemo(""); 
    setEditingLogId(null);
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
        <button onClick={() => { 
          setIsEntryMode(!isEntryMode); 
          if(isEntryMode) { setCurrentEntry({}); setMemo(""); setEditingLogId(null); }
        }} className="text-[10px] font-black underline uppercase">
          {isEntryMode ? "Close" : "+ Add"}
        </button>
      </div>

      {isEntryMode ? (
        <div className="space-y-4 max-h-[450px] overflow-y-auto pr-1">
          <div className="space-y-2">
            {items.map(item => (
              <div key={item} className="grid grid-cols-[1fr_120px] gap-2 items-center border-b border-black/5 pb-1">
                <span className="text-[11px] font-bold uppercase">{item}</span>
                <div className="grid grid-cols-2 gap-1">
                  {item === "날짜" ? (
                    <input type="date" value={currentEntry["날짜"]?.t || ""} className="col-span-2 bg-white rounded p-1 text-right font-mono text-[10px] border border-gray-100 outline-none"
                      onChange={(e) => setCurrentEntry({ ...currentEntry, [item]: { t: e.target.value } })} />
                  ) : isPreFermentMode && (item === "사용시점" || item === "정점") ? (
                    <div className="col-span-2 grid grid-cols-3 gap-1">
                      <input placeholder="pH" type="text" inputMode="decimal" value={currentEntry[item]?.p || ""} className="bg-white rounded p-1 text-right font-mono text-[10px] border border-gray-100" 
                        onChange={(e) => setCurrentEntry({ ...currentEntry, [item]: { ...(currentEntry[item] || {}), p: e.target.value.replace(',', '.') } })} />
                      <input placeholder="Min" type="text" value={currentEntry[item]?.h || ""} className="bg-white rounded p-1 text-right font-mono text-[10px] border border-gray-100" 
                        onChange={(e) => setCurrentEntry({ ...currentEntry, [item]: { ...(currentEntry[item] || {}), h: e.target.value } })} />
                      <input placeholder="Vol" type="text" value={currentEntry[item]?.v || ""} className="bg-white rounded p-1 text-right font-mono text-[10px] border border-gray-100" 
                        onChange={(e) => setCurrentEntry({ ...currentEntry, [item]: { ...(currentEntry[item] || {}), v: e.target.value } })} />
                    </div>
                  ) : isPreFermentMode && item === "결과" ? (
                    <div className="col-span-2 grid grid-cols-3 gap-1">
                      <input placeholder="°C" type="text" inputMode="decimal" value={currentEntry[item]?.t || ""} className="bg-white rounded p-1 text-right font-mono text-[10px] border border-gray-100" 
                        onChange={(e) => setCurrentEntry({ ...currentEntry, [item]: { ...(currentEntry[item] || {}), t: e.target.value.replace(',', '.') } })} />
                      <input placeholder="pH" type="text" inputMode="decimal" value={currentEntry[item]?.p || ""} className="bg-white rounded p-1 text-right font-mono text-[10px] border border-gray-100" 
                        onChange={(e) => setCurrentEntry({ ...currentEntry, [item]: { ...(currentEntry[item] || {}), p: e.target.value.replace(',', '.') } })} />
                      <input placeholder="Vol" type="text" value={currentEntry[item]?.v || ""} className="bg-white rounded p-1 text-right font-mono text-[10px] border border-gray-100" 
                        onChange={(e) => setCurrentEntry({ ...currentEntry, [item]: { ...(currentEntry[item] || {}), v: e.target.value } })} />
                    </div>
                  ) : item === "밀" ? (
                    <input placeholder="°C" type="text" inputMode="decimal" value={currentEntry[item]?.t || ""} className="col-span-2 bg-white rounded p-1 text-right font-mono text-[10px] border border-gray-100" 
                      onChange={(e) => setCurrentEntry({ ...currentEntry, [item]: { t: e.target.value.replace(',', '.') } })} />
                  ) : (
                    <>
                      <input placeholder="°C" type="text" inputMode="decimal" value={currentEntry[item]?.t || ""} className="bg-white rounded p-1 text-right font-mono text-[10px] border border-gray-100" 
                        onChange={(e) => setCurrentEntry({ ...currentEntry, [item]: { ...(currentEntry[item] || {}), t: e.target.value.replace(',', '.') } })} />
                      <input placeholder="pH" type="text" inputMode="decimal" value={currentEntry[item]?.p || ""} className="bg-white rounded p-1 text-right font-mono text-[10px] border border-gray-100" 
                        onChange={(e) => setCurrentEntry({ ...currentEntry, [item]: { ...(currentEntry[item] || {}), p: e.target.value.replace(',', '.') } })} />
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
          <button onClick={handleSave} className="w-full bg-black text-white py-3 rounded-xl font-bold text-xs mt-2 uppercase shadow-lg">
            {editingLogId ? "Update Record" : "Save to DB"}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {latestLog ? (
            <>
              <div onClick={() => handleEditActive(latestLog)} className="bg-white/50 p-3 rounded-lg border border-white text-[10px] cursor-pointer hover:border-black/30 transition-all group relative">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-2 border-b border-black/5 pb-1.5 font-bold text-gray-400 uppercase tracking-tighter">
                  <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                    <span className="text-black shrink-0">LATEST ({latestLog.type})</span>
                    <span className="font-mono text-gray-400 truncate">{latestLog.timestamp}</span>
                  </div>
                  <div className="text-[8px] font-black text-gray-300 group-hover:text-black uppercase tracking-tighter transition-colors shrink-0 sm:text-right">
                    Click to Edit ✏️
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                  {items.map(item => latestLog.data[item] && (latestLog.data[item].t || latestLog.data[item].p || latestLog.data[item].h || latestLog.data[item].v) ? (
                    <div key={item} className="flex justify-between border-b border-gray-50/50 min-w-0">
                      <span className="text-gray-400 font-bold uppercase shrink-0 mr-1">{item}</span>
                      <span className="font-mono truncate text-right">
                        {latestLog.data[item].t && `${latestLog.data[item].t}${item !== "날짜" ? "°" : ""}`}
                        {latestLog.data[item].p && ` / ${latestLog.data[item].p}pH`}
                        {latestLog.data[item].h && ` / ${latestLog.data[item].h}m`}
                        {latestLog.data[item].v && ` / ${latestLog.data[item].v}`}
                      </span>
                    </div>
                  ) : null)}
                </div>
              </div>
              {latestLog.memo && <div onClick={() => handleEditActive(latestLog)} className="bg-white/30 p-3 rounded-lg border-l-2 border-black/10 text-[11px] font-medium text-gray-600 leading-relaxed cursor-pointer hover:bg-white/50">{latestLog.memo}</div>}
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

function HistoryChart({ logs, isPreFerment }) {
  const availableFields = useMemo(() => isPreFerment 
    ? ["르방", "수분", "밀", "결과", "사용시점", "정점"]
    : ["르방", "밀", "물", "결과", "오토리즈", "오토리즈완료", "반죽완료", "하바1", "하바2", "하바3", "하바4", "분할", "성형", "굽기"], [isPreFerment]);

  const [selectedXField, setSelectedXField] = useState("결과"); 
  const [selectedDates, setSelectedDates] = useState([]); 

  const allTimelineLogs = useMemo(() => {
    return [...logs].reverse(); 
  }, [logs]);

  const uniqueDates = useMemo(() => {
    const dates = allTimelineLogs.map(l => l.timestamp).filter(Boolean);
    return Array.from(new Set(dates));
  }, [allTimelineLogs]);

  useEffect(() => {
    if (uniqueDates.length > 0) {
      setSelectedDates(uniqueDates.slice(-2));
    }
  }, [uniqueDates]);

  const handleDateToggle = (date) => {
    if (selectedDates.includes(date)) {
      setSelectedDates(selectedDates.filter(d => d !== date));
    } else {
      setSelectedDates(prev => [...prev, date].slice(-2));
    }
  };

  const activeChartData = useMemo(() => {
    return allTimelineLogs.filter(l => selectedDates.includes(l.timestamp));
  }, [allTimelineLogs, selectedDates]);

  const width = 500;
  const height = 160;
  const padding = 30;

  const points = useMemo(() => {
    if (activeChartData.length === 0) return [];
    return activeChartData.map((d, i) => {
      const x = padding + (activeChartData.length > 1 ? (i / (activeChartData.length - 1)) * (width - padding * 2) : (width - padding * 2) / 2);
      const fieldData = d.data?.[selectedXField] || {};
      return { x, tVal: parseFloat(fieldData.t) || null, pVal: parseFloat(fieldData.p) || null, date: d.timestamp };
    });
  }, [activeChartData, selectedXField]);

  const scaleBounds = useMemo(() => {
    const validTemps = points.map(p => p.tVal).filter(v => v !== null);
    const validPhs = points.map(p => p.pVal).filter(v => v !== null);
    const maxT = validTemps.length > 0 ? Math.max(...validTemps, 30) : 30;
    const minT = validTemps.length > 0 ? Math.min(...validTemps, 15) : 15;
    const maxP = validPhs.length > 0 ? Math.max(...validPhs, 7) : 7;
    const minP = validPhs.length > 0 ? Math.min(...validPhs, 3) : 3;
    return { maxT, minT, maxP, minP, tRange: maxT - minT || 1, pRange: maxP - minP || 1 };
  }, [points]);

  const renderedPoints = useMemo(() => {
    const { minT, tRange, minP, pRange } = scaleBounds;
    return points.map(p => {
      const yTemp = p.tVal !== null ? height - padding - ((p.tVal - minT) / tRange) * (height - padding * 2) : null;
      const yPh = p.pVal !== null ? height - padding - ((p.pVal - minP) / pRange) * (height - padding * 2) : null;
      return { ...p, yTemp, yPh };
    });
  }, [points, scaleBounds]);

  const tempPath = useMemo(() => renderedPoints.filter(p => p.yTemp !== null).map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.yTemp}`).join(' '), [renderedPoints]);
  const phPath = useMemo(() => renderedPoints.filter(p => p.yPh !== null).map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.yPh}`).join(' '), [renderedPoints]);

  return (
    <div className="bg-white p-4 md:p-5 rounded-2xl border border-gray-100 shadow-sm mb-6 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-gray-100 pb-4 text-xs">
        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">X축 항목 선택</label>
          <div className="flex flex-wrap gap-1">
            {availableFields.map(f => (
              <button key={f} onClick={() => setSelectedXField(f)} className={`px-2.5 py-1 rounded-md font-bold transition-all text-[11px] ${selectedXField === f ? "bg-black text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>{f}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Y축 비교 날짜 지정 ({selectedDates.length}/2)</label>
          <div className="flex flex-wrap gap-1.5 max-h-[72px] overflow-y-auto p-0.5 no-scrollbar">
            {uniqueDates.map(date => {
              const isChecked = selectedDates.includes(date);
              return (
                <label key={date} className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] font-mono font-bold cursor-pointer transition-all ${isChecked ? "bg-amber-50 border-amber-300 text-amber-900 shadow-sm" : "bg-white border-gray-200 text-gray-400 hover:bg-gray-50"}`}>
                  <input type="checkbox" checked={isChecked} onChange={() => handleDateToggle(date)} className="accent-amber-500 w-3 h-3 cursor-pointer" />
                  {date.split('-').slice(1).join('/')}
                </label>
              );
            })}
          </div>
        </div>
      </div>

      {selectedDates.length < 2 ? (
        <div className="h-36 flex flex-col items-center justify-center border border-dashed border-gray-200 rounded-xl bg-gray-50/50 text-[11px] text-gray-400 font-bold p-4 text-center"><span>⚠️ 비교 분석을 위해 날짜를 최소 2개 이상 체크해 주세요.</span></div>
      ) : renderedPoints.length === 0 || (!renderedPoints.some(p => p.tVal !== null) && !renderedPoints.some(p => p.pVal !== null)) ? (
        <div className="h-36 flex items-center justify-center border border-dashed border-gray-200 rounded-xl bg-gray-50/50 text-[11px] text-gray-400 font-bold p-4 text-center"><span>선택한 항목 [{selectedXField}]에 등록된 온도/pH 결과값이 없습니다.</span></div>
      ) : (
        <div>
          <div className="flex gap-4 text-[10px] font-black uppercase tracking-wider mb-2 justify-end">
            <span className="flex items-center gap-1 text-amber-500">─ {selectedXField} 온도(°C)</span>
            <span className="flex items-center gap-1 text-purple-600">─ {selectedXField} pH</span>
          </div>
          <div className="relative w-full overflow-hidden">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
              <line x1={padding} y1={padding} x2={width-padding} y2={padding} stroke="#f3f4f6" strokeDasharray="3" />
              <line x1={padding} y1={height/2} x2={width-padding} y2={height/2} stroke="#f3f4f6" strokeDasharray="3" />
              <line x1={padding} y1={height-padding} x2={width-padding} y2={height-padding} stroke="#e5e7eb" />
              {tempPath && <path d={tempPath} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
              {phPath && <path d={phPath} fill="none" stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
              {renderedPoints.map((p, i) => (
                <g key={i}>
                  {p.yTemp !== null && (
                    <>
                      <circle cx={p.x} cy={p.yTemp} r="4" fill="#fff" stroke="#f59e0b" strokeWidth="2" />
                      <text x={p.x} y={p.yTemp - 6} textAnchor="middle" className="text-[9px] font-mono font-bold fill-amber-600">{p.tVal}°</text>
                    </>
                  )}
                  {p.yPh !== null && (
                    <>
                      <circle cx={p.x} cy={p.yPh} r="4" fill="#fff" stroke="#7c3aed" strokeWidth="2" />
                      <text x={p.x} y={p.yPh + 12} textAnchor="middle" className="text-[9px] font-mono font-bold fill-purple-700">{p.pVal}</text>
                    </>
                  )}
                  <text x={p.x} y={height - 6} textAnchor="middle" className="text-[8px] font-bold fill-gray-400 font-mono">{p.date.split('-').slice(1).join('/')}</text>
                </g>
              ))}
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}

function TempPhDB({ tempLogs, setTempLogs }) {
  const normalItems = ["날짜", "르방", "밀", "물", "결과", "오토리즈", "오토리즈완료", "반죽완료", "하바1", "하바2", "하바3", "하바4", "분할", "성형", "굽기"];
  const pfItems = ["날짜", "르방", "수분", "밀", "결과", "사용시점", "정점"];
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedProduct, setExpandedProduct] = useState(null);

  const [inlineEditId, setInlineEditId] = useState(null);
  const [inlineData, setInlineData] = useState({});
  const [inlineMemo, setInlineMemo] = useState("");
  const [inlineType, setInlineType] = useState("");

  const groupedLogs = useMemo(() => {
    const groups = {};
    const filtered = tempLogs.filter(log => log.productName.toLowerCase().includes(searchTerm.toLowerCase()));
    filtered.forEach(log => {
      if (!groups[log.productName]) groups[log.productName] = [];
      groups[log.productName].push(log);
    });
    return groups;
  }, [tempLogs, searchTerm]);

  const startInlineEdit = (log) => {
    setInlineEditId(log.id);
    setInlineData(log.data || {});
    setInlineMemo(log.memo || "");
    setInlineType(log.type);
  };

  const saveInlineEdit = (logId) => {
    setTempLogs(prev => prev.map(l => {
      if (l.id === logId) {
        return {
          ...l,
          type: inlineType,
          data: inlineData,
          memo: inlineMemo,
          timestamp: inlineData["날짜"]?.t || l.timestamp
        };
      }
      return l;
    }));
    setInlineEditId(null);
  };

  return (
    <main className="max-w-6xl mx-auto px-4 md:px-8 text-black">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b-2 border-black pb-4 mb-8 gap-4">
        <h1 className="text-3xl md:text-4xl font-black tracking-tighter uppercase">History</h1>
        <input type="text" placeholder="Search product..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full md:w-64 bg-white border border-gray-200 rounded-full px-4 py-2 text-sm outline-none shadow-inner" />
      </div>
      
      <div className="space-y-4">
        {Object.entries(groupedLogs).map(([productName, logs]) => {
          const dateGroups = {};
          logs.forEach(log => {
            const dateKey = log.timestamp || "날짜 미지정";
            if (!dateGroups[dateKey]) dateGroups[dateKey] = [];
            dateGroups[dateKey].push(log);
          });

          const isPreFerment = logs.some(l => l.type === "사전반죽 기록");

          return (
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
                  <div className="pt-4">
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Trend Chart</div>
                    <HistoryChart logs={logs} isPreFerment={isPreFerment} />
                  </div>

                  {Object.entries(dateGroups).map(([date, dateLogs]) => (
                    <div key={date} className="border-t border-gray-100 py-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {dateLogs.map(log => {
                          const activeItems = log.type === "사전반죽 기록" ? pfItems : normalItems;
                          const isEditingNow = inlineEditId === log.id;

                          return (
                            <div key={log.id} className={`bg-white p-5 rounded-xl border shadow-sm relative transition-all ${isEditingNow ? "border-black ring-1 ring-black/10" : "border-gray-100"}`}>
                              
                              {isEditingNow ? (
                                <div className="space-y-3">
                                  <div className="flex justify-between items-center mb-2">
                                    {log.type !== "사전반죽 기록" ? (
                                      <select value={inlineType} onChange={(e) => setInlineType(e.target.value)} className="bg-transparent font-black text-[10px] uppercase border-b border-black outline-none font-sans">
                                        <option>1차 저온</option><option>2차 저온</option>
                                      </select>
                                    ) : <span className="text-[9px] font-black text-gray-400 uppercase">Pre-Ferment</span>}
                                    <div className="flex gap-2">
                                      <button onClick={() => setInlineEditId(null)} className="text-[10px] font-bold text-gray-400 uppercase underline">Cancel</button>
                                      <button onClick={() => saveInlineEdit(log.id)} className="text-[10px] font-black text-black uppercase underline">Save</button>
                                    </div>
                                  </div>
                                  <div className="space-y-1 max-h-[220px] overflow-y-auto pr-1 no-scrollbar">
                                    {activeItems.map(item => (
                                      <div key={item} className="grid grid-cols-[1fr_120px] gap-2 items-center border-b border-black/5 pb-1 text-[11px]">
                                        <span className="font-bold uppercase text-gray-400">{item}</span>
                                        {item === "날짜" ? (
                                          <input type="date" value={inlineData["날짜"]?.t || ""} className="w-full bg-gray-50 rounded px-1 py-0.5 text-right font-mono text-[10px] border border-transparent" onChange={(e) => setInlineData({ ...inlineData, [item]: { t: e.target.value } })} />
                                        ) : log.type === "사전반죽 기록" && (item === "사용시점" || item === "정점") ? (
                                          <div className="grid grid-cols-3 gap-1">
                                            <input placeholder="pH" type="text" value={inlineData[item]?.p || ""} className="bg-gray-50 rounded p-0.5 text-center font-mono text-[10px]" onChange={(e) => setInlineData({ ...inlineData, [item]: { ...(inlineData[item] || {}), p: e.target.value.replace(',', '.') } })} />
                                            <input placeholder="Min" type="text" value={inlineData[item]?.h || ""} className="bg-gray-50 rounded p-0.5 text-center font-mono text-[10px]" onChange={(e) => setInlineData({ ...inlineData, [item]: { ...(inlineData[item] || {}), h: e.target.value } })} />
                                            <input placeholder="Vol" type="text" value={inlineData[item]?.v || ""} className="bg-gray-50 rounded p-0.5 text-center font-mono text-[10px]" onChange={(e) => setInlineData({ ...inlineData, [item]: { ...(inlineData[item] || {}), v: e.target.value } })} />
                                          </div>
                                        ) : log.type === "사전반죽 기록" && item === "결과" ? (
                                          <div className="grid grid-cols-3 gap-1">
                                            <input placeholder="°C" type="text" value={inlineData[item]?.t || ""} className="bg-gray-50 rounded p-0.5 text-center font-mono text-[10px]" onChange={(e) => setInlineData({ ...inlineData, [item]: { ...(inlineData[item] || {}), t: e.target.value.replace(',', '.') } })} />
                                            <input placeholder="pH" type="text" value={inlineData[item]?.p || ""} className="bg-gray-50 rounded p-0.5 text-center font-mono text-[10px]" onChange={(e) => setInlineData({ ...inlineData, [item]: { ...(inlineData[item] || {}), p: e.target.value.replace(',', '.') } })} />
                                            <input placeholder="Vol" type="text" value={inlineData[item]?.v || ""} className="bg-gray-50 rounded p-0.5 text-center font-mono text-[10px]" onChange={(e) => setInlineData({ ...inlineData, [item]: { ...(inlineData[item] || {}), v: e.target.value } })} />
                                          </div>
                                        ) : item === "밀" ? (
                                          <input placeholder="°C" type="text" value={inlineData[item]?.t || ""} className="w-full bg-gray-50 rounded px-1 py-0.5 text-right font-mono text-[10px]" onChange={(e) => setInlineData({ ...inlineData, [item]: { t: e.target.value.replace(',', '.') } })} />
                                        ) : (
                                          <div className="flex gap-1">
                                            <input placeholder="°" type="text" value={inlineData[item]?.t || ""} className="w-1/2 bg-gray-50 rounded text-center font-mono text-[10px]" onChange={(e) => setInlineData({ ...inlineData, [item]: { ...(inlineData[item] || {}), t: e.target.value.replace(',', '.') } })} />
                                            <input placeholder="pH" type="text" value={inlineData[item]?.p || ""} className="w-1/2 bg-gray-50 rounded text-center font-mono text-[10px]" onChange={(e) => setInlineData({ ...inlineData, [item]: { ...(inlineData[item] || {}), p: e.target.value.replace(',', '.') } })} />
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                  <textarea value={inlineMemo} onChange={(e) => setInlineMemo(e.target.value)} className="w-full bg-gray-50 border-none rounded-lg p-2 text-[10px] leading-4 resize-none h-14 outline-none" placeholder="Memo..." />
                                </div>
                              ) : (
                                <div onClick={() => startInlineEdit(log)} className="cursor-pointer group">
                                  <div className="absolute top-2 right-2 text-[8px] font-black text-gray-200 group-hover:text-black uppercase tracking-tighter transition-colors">Edit ✏️</div>
                                  <div className="mb-4 flex justify-between">
                                    <span className="text-[9px] font-black text-gray-400 uppercase bg-gray-100 px-1.5 py-0.5 rounded">{log.type}</span>
                                    <button onClick={(e) => { e.stopPropagation(); confirm("삭제하시겠습니까?") && setTempLogs(prev => prev.filter(l => l.id !== log.id)); }} className="text-gray-300 hover:text-red-500 text-xs">✕</button>
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
                              )}

                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}

function RecipeDB({ recipes, setRecipes }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingRecipe, setEditingRecipe] = useState(null);
  
  const displayedRecipes = useMemo(() => {
    return recipes.filter(r => r.productName.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [recipes, searchTerm]);

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
            <button onClick={(e) => { e.stopPropagation(); if (confirm("삭제하시겠습니까?")) setRecipes(prev => prev.filter(r => r.id !== recipe.id)); }} className="text-gray-300 hover:text-red-500">✕</button>
          </div>
        ))}
      </div>
      {isModalOpen && <RecipeModal initialData={editingRecipe} onSave={(data) => {
        if (editingRecipe) setRecipes(prev => prev.map(r => r.id === editingRecipe.id ? { ...data, id: r.id } : r));
        else setRecipes(prev => [...prev, { ...data, id: Date.now() }]);
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