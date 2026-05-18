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

  // 프린트 배수 모달 상태 추가
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printMultipliers, setPrintMultipliers] = useState(["1", "", "", ""]);

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

  const handleDoughMultiplierChange = (value) => {
    const cleanValue = value.replace(',', '.');
    setDoughMultiplier(cleanValue); 
    setFlourMultiplier("1");
    if (!currentRecipe || totals.totalPercent === 0) return;
    
    const multiplier = parseFloat(cleanValue);
    if (isNaN(multiplier) || multiplier <= 0) {
      return;
    }

    const currentInputDough = parseFloat(String(totalDough).replace(',', '.')) || totals.baseTotalDough;
    
    const targetDough = currentInputDough * multiplier;
    const targetFlour = targetDough / (totals.totalPercent / 100);

    setTotalDough(Math.round(targetDough));
    setFlourWeight(Math.round(targetFlour));
  };

  const handleFlourMultiplierChange = (value) => {
    const cleanValue = value.replace(',', '.');
    setFlourMultiplier(cleanValue);
    setDoughMultiplier("1");
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
    setIsPrintModalOpen(true);
  };

  const executePrint = () => {
    setIsPrintModalOpen(false);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const validPrintMultipliers = useMemo(() => {
    return printMultipliers
      .map(m => parseFloat(m.replace(',', '.')))
      .filter(m => !isNaN(m) && m > 0);
  }, [printMultipliers]);

  return (
    <main className="max-w-6xl mx-auto px-4 md:px-8 text-black print:px-0 print:max-w-full">
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { size: auto; margin: 15mm; }
          body { background: white; color: black; }
          .print-hidden-multipliers { display: none !important; }
          .print-visible-multipliers { display: table-cell !important; }
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
                PDF 저장 / 인쇄
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
                  setDoughMultiplier("1"); 
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
                  setDoughMultiplier("1"); 
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
                  <th className="p-2 text-left">재료</th>
                  <th className="p-2 text-right">% (수정)</th>
                  <th className="p-2 text-right w-24 print-hidden-multipliers">g</th>
                  {validPrintMultipliers.map((m, idx) => (
                    <th key={idx} className="p-2 text-right w-24 hidden print-visible-multipliers font-black text-black">
                      {m}배 (g)
                    </th>
                  ))}
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
                      <td className="p-2 text-right font-bold text-gray-400 text-sm print-hidden-multipliers">
                        {(computedGrams || 0).toLocaleString()}g
                      </td>
                      {validPrintMultipliers.map((m, mIdx) => {
                        const multipliedGrams = Math.round(computedGrams * m);
                        return (
                          <td key={mIdx} className="p-2 text-right font-black text-black text-sm hidden print-visible-multipliers font-mono">
                            {(multipliedGrams || 0).toLocaleString()}g
                          </td>
                        );
                      })}
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
                <SummaryRow label="총 원가" value={`${Math.round(totals.totalCost).toLocaleString()}`} />
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

      {isPrintModalOpen && (
        <PrintMultiplierModal 
          multipliers={printMultipliers} 
          setMultipliers={setPrintMultipliers} 
          onClose={() => setIsPrintModalOpen(false)} 
          onPrint={executePrint}
        />
      )}
    </main>
  );
}

function PrintMultiplierModal({ multipliers, setMultipliers, onClose, onPrint }) {
  const handleInputChange = (index, value) => {
    const cleanValue = value.replace(',', '.');
    setMultipliers(prev => prev.map((m, idx) => idx === index ? cleanValue : m));
  };
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-50 p-4 print:hidden">
      <div className="bg-[#f7f6f3] w-full max-w-md rounded-[2rem] p-6 shadow-2xl border border-white">
        <h2 className="text-xl md:text-2xl font-black tracking-tighter mb-2 uppercase">PRINT OPTIONS</h2>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-tight mb-6">인쇄 또는 PDF 저장 시 출력할 배수를 입력하세요 (최대 4개)</p>
        
        <div className="grid grid-cols-2 gap-4 mb-8">
          {multipliers.map((mult, i) => (
            <div key={i} className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
              <span className="text-[9px] font-black text-gray-400 tracking-wider mb-1 uppercase">배수 슬롯 {i + 1}</span>
              <div className="flex items-center border-b border-black/10 focus-within:border-black transition-colors">
                <input 
                  type="text" 
                  inputMode="decimal" 
                  value={mult} 
                  onChange={(e) => handleInputChange(i, e.target.value)} 
                  placeholder={i === 0 ? "1.0" : "미지정"} 
                  className="w-full bg-transparent font-mono font-bold text-sm outline-none pb-1"
                />
                <span className="text-xs font-black text-gray-400 px-1">배</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 bg-white border border-gray-200 py-3 rounded-xl font-bold text-xs uppercase tracking-tighter">취소</button>
          <button onClick={onPrint} className="flex-1 bg-black text-white py-3 rounded-xl font-bold text-xs uppercase tracking-tighter shadow-md">출력하기</button>
        </div>
      </div>
    </div>
  );
}

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
          return { ...log, type: isPreFermentMode ? "사전반죽 기록" : logType, data: currentEntry, memo: memo, timestamp: currentEntry["날짜"]?.t || log.timestamp };
        }
        return log;
      }));
      alert("데이터가 수정되었습니다.");
    } else {
      const now = new Date();
      const newLog = { id: Date.now(), productName: currentProductName, type: isPreFermentMode ? "사전반죽 기록" : logType, displayTime: now.toLocaleString(), timestamp: currentEntry["날짜"]?.t || now.toLocaleDateString(), data: currentEntry, memo: memo };
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
        <button onClick={() => { setIsEntryMode(!isEntryMode); if(isEntryMode) { setCurrentEntry({}); setMemo(""); setEditingLogId(null); } }} className="text-[10px] font-black underline uppercase">
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
                    <input type="date" value={currentEntry["날짜"]?.t || ""} className="col-span-2 bg-white rounded p-1 text-right font-mono text-[10px] border border-gray-100 outline-none" onChange={(e) => setCurrentEntry({ ...currentEntry, [item]: { t: e.target.value } })} />
                  ) : isPreFermentMode && (item === "사용시점" || item === "정점") ? (
                    <div className="col-span-2 grid grid-cols-3 gap-1">
                      <input placeholder="pH" type="text" inputMode="decimal" value={currentEntry[item]?.p || ""} className="bg-white rounded p-1 text-right font-mono text-[10px] border border-gray-100" onChange={(e) => setCurrentEntry({ ...currentEntry, [item]: { ...(currentEntry[item] || {}), p: e.target.value.replace(',', '.') } })} />
                      <input placeholder="Min" type="text" value={currentEntry[item]?.h || ""} className="bg-white rounded p-1 text-right font-mono text-[10px] border border-gray-100" onChange={(e) => setCurrentEntry({ ...currentEntry, [item]: { ...(currentEntry[item] || {}), h: e.target.value } })} />
                      <input placeholder="Vol" type="text" value={currentEntry[item]?.v || ""} className="bg-white rounded p-1 text-right font-mono text-[10px] border border-gray-100" onChange={(e) => setCurrentEntry({ ...currentEntry, [item]: { ...currentEntry[item], v: e.target.value } })} />
                    </div>
                  ) : (
                    <>
                      <input placeholder="T" type="text" inputMode="decimal" value={currentEntry[item]?.t || ""} className="bg-white rounded p-1 text-right font-mono text-[10px] border border-gray-100 outline-none" onChange={(e) => setCurrentEntry({ ...currentEntry, [item]: { ...(currentEntry[item] || {}), t: e.target.value.replace(',', '.') } })} />
                      <input placeholder="pH" type="text" inputMode="decimal" value={currentEntry[item]?.p || ""} className="bg-white rounded p-1 text-right font-mono text-[10px] border border-gray-100 outline-none" onChange={(e) => setCurrentEntry({ ...currentEntry, [item]: { ...(currentEntry[item] || {}), p: e.target.value.replace(',', '.') } })} />
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div>
            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">MEMO</label>
            <textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={3} className="w-full p-2 text-xs bg-white border border-gray-100 rounded-xl outline-none resize-none" placeholder="비고 및 메모 사항 입력" />
          </div>
          <button onClick={handleSave} className="w-full bg-black text-white py-2 rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm">{editingLogId ? "Update Log" : "Save Log"}</button>
        </div>
      ) : latestLog ? (
        <div onClick={() => handleEditActive(latestLog)} className="cursor-pointer hover:bg-black/[0.02] p-2 rounded-xl transition-all border border-dashed border-transparent hover:border-black/10">
          <div className="flex justify-between text-[10px] font-black uppercase tracking-tight mb-2">
            <span className="text-gray-400">{latestLog.type}</span>
            <span>{latestLog.timestamp}</span>
          </div>
          <div className="grid grid-cols-4 gap-x-2 gap-y-1.5 font-mono text-xs">
            {Object.entries(latestLog.data || {}).filter(([k]) => k !== "날짜").slice(0, 8).map(([key, val]) => (
              <div key={key} className="flex flex-col border-b border-black/5 pb-0.5">
                <span className="text-[8px] font-sans font-black text-gray-400 uppercase leading-none mb-0.5">{key}</span>
                <span className="font-bold truncate">
                  {val.t ? `${val.t}°` : ""}{val.p ? ` / ${val.p}p` : ""}{val.h ? `${val.h}m` : ""}{val.v ? ` / ${val.v}v` : ""}
                </span>
              </div>
            ))}
          </div>
          {latestLog.memo && (
            <div className="mt-3 pt-2 border-t border-black/5 text-[11px] text-gray-500 font-medium line-clamp-2">
              {latestLog.memo}
            </div>
          )}
        </div>
      ) : (
        <p className="text-center py-4 text-[10px] text-gray-400 font-bold uppercase tracking-widest">No logs recorded yet</p>
      )}
    </SummaryCard>
  );
}

/* ──── [수정 및 연동 대상 컴포넌트 전체 유지] ──── */

// 1. 레시피 DB 컴포넌트 (디자인 원형 그대로 유지 + 우측 끝 삭제 X 버튼만 연동)
function RecipeDB({ recipes, setRecipes }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState(null);

  const handleDeleteRecipe = (id, e) => {
    e.stopPropagation(); // 카드 클릭 이벤트 전파 차단
    if (window.confirm("이 레시피를 영구 삭제하시겠습니까?")) {
      setRecipes(prev => prev.filter(r => r.id !== id));
    }
  };

  const handleAddRecipe = (newRecipe) => {
    const recipeWithId = { ...newRecipe, id: Date.now() };
    setRecipes(prev => [...prev, recipeWithId]);
    setIsModalOpen(false);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 text-black">
      <div className="border-b-2 border-black pb-3 mb-6 flex justify-between items-end">
        <h1 className="text-3xl md:text-4xl font-black tracking-tighter uppercase">RECIPE DATABASE</h1>
        <button onClick={() => { setEditingRecipe(null); setIsModalOpen(true); }} className="bg-black text-white px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-tight hover:bg-gray-800 transition-all shadow-md">+ Add Recipe</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {recipes.length > 0 ? recipes.map(recipe => (
          <div key={recipe.id} className="bg-[#f7f6f3] rounded-2xl p-5 border border-white/50 shadow-md flex flex-col justify-between relative group">
            {/* 우측 끝 X 삭제 버튼 추가 */}
            <button 
              onClick={(e) => handleDeleteRecipe(recipe.id, e)}
              className="absolute top-4 right-4 w-6 h-6 flex items-center justify-center rounded-full bg-black/5 text-gray-400 hover:bg-black hover:text-white transition-all text-xs font-black"
              title="레시피 삭제"
            >
              ✕
            </button>

            <div>
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">{recipe.category}</span>
              <h3 className="text-xl font-black tracking-tight mb-4 pr-6">{recipe.productName}</h3>
              <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                {recipe.ingredients?.map((ing, i) => (
                  <div key={i} className="flex justify-between text-xs border-b border-dashed border-black/5 pb-1">
                    <span className="text-gray-500">{ing.name} <span className="text-[9px] uppercase text-gray-400 font-bold">({ing.type})</span></span>
                    <span className="font-mono font-bold">{ing.percent}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-6 pt-3 border-t border-black/5 flex justify-between items-center text-[10px] text-gray-400 font-bold uppercase">
              <span>Ingredients: {recipe.ingredients?.length || 0}</span>
            </div>
          </div>
        )) : (
          <div className="col-span-full py-20 text-center text-gray-400 font-bold uppercase tracking-widest text-xs">No recipes saved yet.</div>
        )}
      </div>

      {isModalOpen && (
        <RecipeModal 
          recipe={editingRecipe}
          onClose={() => setIsModalOpen(false)}
          onSave={handleAddRecipe}
        />
      )}
    </div>
  );
}

// 2. 온도/pH 히스토리 컴포넌트 (레이아웃 형태 보존 + 우측 끝 삭제 X 버튼만 추가)
function TempPhDB({ tempLogs, setTempLogs }) {
  const handleDeleteLog = (id) => {
    if (window.confirm("이 온도/pH 로그 기록을 데이터베이스에서 삭제하시겠습니까?")) {
      setTempLogs(prev => prev.filter(log => log.id !== id));
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 text-black">
      <div className="border-b-2 border-black pb-3 mb-6">
        <h1 className="text-3xl md:text-4xl font-black tracking-tighter uppercase">TEMPERATURE & pH HISTORY</h1>
      </div>

      <div className="bg-[#f7f6f3] rounded-2xl border border-white/50 shadow-lg p-4 md:p-6 overflow-x-auto">
        {tempLogs.length > 0 ? (
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-black text-[10px] text-gray-400 uppercase tracking-widest">
                <th className="py-3 px-2">날짜 / 시간</th>
                <th className="py-3 px-2">제품명</th>
                <th className="py-3 px-2">로그구분</th>
                <th className="py-3 px-2">상세 측정 데이터 (타입: T° / pH)</th>
                <th className="py-3 px-2">메모</th>
                <th className="py-3 px-2 text-right w-12">관리</th>
              </tr>
            </thead>
            <tbody>
              {tempLogs.map(log => (
                <tr key={log.id} className="border-b border-gray-200 text-xs hover:bg-black/[0.01] transition-colors group">
                  <td className="py-3 px-2 font-mono whitespace-nowrap">
                    <div className="font-bold">{log.timestamp}</div>
                    <div className="text-[9px] text-gray-400">{log.displayTime}</div>
                  </td>
                  <td className="py-3 px-2 font-black text-sm">{log.productName}</td>
                  <td className="py-3 px-2">
                    <span className="bg-black text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tight">{log.type}</span>
                  </td>
                  <td className="py-3 px-2 font-mono">
                    <div className="flex flex-wrap gap-x-3 gap-y-1 max-w-xs md:max-w-md">
                      {Object.entries(log.data || {}).filter(([k]) => k !== "날짜").map(([item, val]) => (
                        <div key={item} className="bg-white px-2 py-0.5 rounded border border-gray-100 flex gap-1 items-center shadow-sm">
                          <span className="font-sans font-black text-[9px] text-gray-400 uppercase">{item}:</span>
                          <span className="font-bold text-black">
                            {val.t ? `${val.t}°` : ""}{val.p ? `/${val.p}p` : ""}{val.h ? `${val.h}m` : ""}{val.v ? `/${val.v}v` : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-2 text-gray-600 max-w-xs truncate" title={log.memo}>{log.memo || "-"}</td>
                  <td className="py-3 px-2 text-right">
                    {/* 우측 끝 X 삭제 버튼 연동 */}
                    <button 
                      onClick={() => handleDeleteLog(log.id)}
                      className="w-6 h-6 inline-flex items-center justify-center rounded-full bg-black/5 text-gray-400 hover:bg-black hover:text-white transition-all text-xs font-black"
                      title="로그 삭제"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="py-20 text-center text-gray-400 font-bold uppercase tracking-widest text-xs">No data metrics recorded in database yet.</div>
        )}
      </div>
    </div>
  );
}

// 3. 레시피 등록/수정 모달창 (레이아웃 원형 그대로 유지)
function RecipeModal({ recipe, onClose, onSave }) {
  const [category, setCategory] = useState("하드계열");
  const [productName, setProductName] = useState("");
  const [ingredients, setIngredients] = useState([
    { type: "밀", name: "", percent: "", cost: "" }
  ]);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-[#f7f6f3] w-full max-w-2xl rounded-[2.5rem] p-6 md:p-8 shadow-2xl border border-white max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl md:text-3xl font-black tracking-tighter mb-6 uppercase">NEW RECIPE DETAILED ENTRY</h2>
        
        <div className="grid grid-cols-2 gap-4 mb-6">
          <InputField label="Category">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="bg-transparent border-b border-black font-bold outline-none w-full pb-1">
              <option value="하드계열">하드계열</option>
              <option value="소프트계열">소프트계열</option>
              <option value="사전반죽">사전반죽</option>
            </select>
          </InputField>
          <InputField label="Product Name">
            <input type="text" value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="제품명을 입력하세요" className="bg-transparent border-b border-black font-bold w-full pb-1 outline-none" />
          </InputField>
        </div>

        <div className="space-y-3">
          <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Ingredients Structure</div>
          {ingredients.map((ing, idx) => (
            <div key={idx} className="grid grid-cols-[80px_1fr_70px_70px_40px] gap-2 items-center bg-white p-2 rounded-xl shadow-sm border border-gray-100">
              <select value={ing.type} onChange={(e) => setIngredients(ingredients.map((item, i) => i === idx ? { ...item, type: e.target.value } : item))} className="bg-gray-50 border border-gray-200 text-xs rounded-lg p-1 font-bold outline-none">
                <option value="밀">밀</option>
                <option value="수분">수분</option>
                <option value="소금">소금</option>
                <option value="이스트">이스트</option>
                <option value="사전반죽">사전반죽</option>
                <option value="기타">기타</option>
              </select>
              <input type="text" placeholder="재료명" value={ing.name} onChange={(e) => setIngredients(ingredients.map((item, i) => i === idx ? { ...item, name: e.target.value } : item))} className="text-xs font-bold outline-none border-b border-transparent focus:border-black px-1" />
              <input type="text" placeholder="%" inputMode="decimal" value={ing.percent} onChange={(e) => setIngredients(ingredients.map((item, i) => i === idx ? { ...item, percent: e.target.value } : item))} className="text-xs font-mono font-bold text-right outline-none border-b border-transparent focus:border-black px-1" />
              <input type="text" placeholder="단가" inputMode="numeric" value={ing.cost} onChange={(e) => setIngredients(ingredients.map((item, i) => i === idx ? { ...item, cost: e.target.value } : item))} className="text-xs font-mono font-bold text-right outline-none border-b border-transparent focus:border-black px-1" />
              <button onClick={() => setIngredients(ingredients.filter((_, i) => i !== idx))} className="text-gray-400 hover:text-black font-black text-xs">✕</button>
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

// 계산 로직 손상 방지를 위해 기존의 SummaryRow 완벽 대응 구현부 유지
function SummaryRow({ label, value }) {
  return (
    <div className="flex justify-between border-b border-dashed border-black/10 py-2 text-sm font-bold">
      <span className="text-gray-500">{label}</span>
      <span className="font-mono text-black">{value}</span>
    </div>
  );
}