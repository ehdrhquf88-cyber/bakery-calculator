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

// -------------------------------------------------------------
// [RecipeCalculator 컴포넌트] (수식 및 레이아웃 무결성 100% 보존)
// -------------------------------------------------------------
function RecipeCalculator({ recipes, setRecipes, tempLogs, setTempLogs }) {
  const [category, setCategory] = useState("하드계열");
  const [selectedRecipeId, setSelectedRecipeId] = useState("");
  const [totalDough, setTotalDough] = useState("");
  const [flourWeight, setFlourWeight] = useState("");
  const [pfYields, setPfYields] = useState({});
  const [memo, setMemo] = useState("");
  const [doughMultiplier, setDoughMultiplier] = useState("1");
  const [flourMultiplier, setFlourMultiplier] = useState("1");
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
    if (isNaN(multiplier) || multiplier <= 0) return;

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
    if (isNaN(multiplier) || multiplier <= 0) return;

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
                      <input placeholder="Vol" type="text" value={currentEntry[item]?.v || ""} className="bg-white rounded p-1 text-right font-mono text-[10px] border border-gray-100" onChange={(e) => setCurrentEntry({ ...currentEntry, [item]: { ...(currentEntry[item] || {}), v: e.target.value } })} />
                    </div>
                  ) : isPreFermentMode && item === "결과" ? (
                    <div className="col-span-2 grid grid-cols-3 gap-1">
                      <input placeholder="°C" type="text" inputMode="decimal" value={currentEntry[item]?.t || ""} className="bg-white rounded p-1 text-right font-mono text-[10px] border border-gray-100" onChange={(e) => setCurrentEntry({ ...currentEntry, [item]: { ...(currentEntry[item] || {}), t: e.target.value.replace(',', '.') } })} />
                      <input placeholder="pH" type="text" inputMode="decimal" value={currentEntry[item]?.p || ""} className="bg-white rounded p-1 text-right font-mono text-[10px] border border-gray-100" onChange={(e) => setCurrentEntry({ ...currentEntry, [item]: { ...(currentEntry[item] || {}), p: e.target.value.replace(',', '.') } })} />
                      <input placeholder="Vol" type="text" value={currentEntry[item]?.v || ""} className="bg-white rounded p-1 text-right font-mono text-[10px] border border-gray-100" onChange={(e) => setCurrentEntry({ ...currentEntry, [item]: { ...(currentEntry[item] || {}), v: e.target.value } })} />
                    </div>
                  ) : item === "밀" ? (
                    <input placeholder="°C" type="text" inputMode="decimal" value={currentEntry[item]?.t || ""} className="col-span-2 bg-white rounded p-1 text-right font-mono text-[10px] border border-gray-100" onChange={(e) => setCurrentEntry({ ...currentEntry, [item]: { t: e.target.value.replace(',', '.') } })} />
                  ) : (
                    <>
                      <input placeholder="°C" type="text" inputMode="decimal" value={currentEntry[item]?.t || ""} className="bg-white rounded p-1 text-right font-mono text-[10px] border border-gray-100" onChange={(e) => setCurrentEntry({ ...currentEntry, [item]: { ...(currentEntry[item] || {}), t: e.target.value.replace(',', '.') } })} />
                      <input placeholder="pH" type="text" inputMode="decimal" value={currentEntry[item]?.p || ""} className="bg-white rounded p-1 text-right font-mono text-[10px] border border-gray-100" onChange={(e) => setCurrentEntry({ ...currentEntry, [item]: { ...(currentEntry[item] || {}), p: e.target.value.replace(',', '.') } })} />
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div>
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">MEMO / NOTE</span>
            <textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="특이사항 기록..." className="w-full bg-white rounded-xl p-3 border border-gray-100 text-xs font-bold outline-none h-20 resize-none focus:border-black transition-colors" />
          </div>
          <button onClick={handleSave} className="w-full bg-black text-white text-xs font-black py-3 rounded-xl uppercase tracking-wider shadow-md hover:bg-gray-800 transition-colors">
            {editingLogId ? "Update Log" : "Save Log Data"}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {latestLog ? (
            <div onClick={() => handleEditActive(latestLog)} className="cursor-pointer bg-white/50 hover:bg-white p-3 rounded-xl border border-black/5 transition-all">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-black bg-black text-white px-1.5 py-0.5 rounded uppercase tracking-tight">{latestLog.type}</span>
                <span className="font-mono text-[10px] font-bold text-gray-400">{latestLog.timestamp}</span>
              </div>
              <p className="text-xs font-bold text-gray-800 line-clamp-2">{latestLog.memo || "기록된 메모가 없습니다."}</p>
              <div className="text-[9px] font-black text-black/40 uppercase tracking-tighter mt-2 text-right">Click to View & Edit →</div>
            </div>
          ) : (
            <p className="text-center py-4 text-xs font-bold text-gray-400 uppercase">No logs yet</p>
          )}
        </div>
      )}
    </SummaryCard>
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
    <div className="flex justify-between border-b border-dashed border-black/10 pb-1.5 pt-1.5 first:pt-0 last:border-none text-sm font-bold">
      <span className="text-gray-400 uppercase tracking-tight">{label}</span>
      <span className="font-mono text-black">{value}</span>
    </div>
  );
}

// -------------------------------------------------------------
// [RecipeDB 컴포넌트] (레시피 개별 삭제 기능 완전히 복구 완료)
// -------------------------------------------------------------
function RecipeDB({ recipes, setRecipes }) {
  const handleDeleteRecipe = (id) => {
    if (confirm("정말로 이 레시피를 삭제하시겠습니까? 관련 데이터가 모두 삭제됩니다.")) {
      setRecipes(prev => prev.filter(r => r.id !== id));
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4">
      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100">
        <h2 className="text-2xl font-black tracking-tighter uppercase mb-6 border-b-2 border-black pb-2">Recipe Database</h2>
        {recipes.length === 0 ? (
          <p className="text-center py-12 text-gray-400 font-bold uppercase text-xs tracking-widest">No recipes saved in database.</p>
        ) : (
          <div className="space-y-4">
            {recipes.map(recipe => (
              <div key={recipe.id} className="flex justify-between items-center bg-gray-50 p-4 rounded-2xl border border-gray-100 hover:border-black/10 transition-all">
                <div>
                  <span className="text-[10px] font-black px-2 py-0.5 bg-gray-200 rounded-md text-gray-600 uppercase mr-2">{recipe.category}</span>
                  <strong className="text-base font-black text-gray-900 tracking-tight">{recipe.productName}</strong>
                  <span className="text-xs text-gray-400 block mt-1 font-medium">재료 종류: {recipe.ingredients?.length || 0}개</span>
                </div>
                <button 
                  onClick={() => handleDeleteRecipe(recipe.id)}
                  className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-xs font-black tracking-tight transition-colors uppercase"
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// [TempPhDB 컴포넌트] (온도/pH 로그 개별 삭제 기능 완벽 복구 완료)
// -------------------------------------------------------------
function TempPhDB({ tempLogs, setTempLogs }) {
  const handleDeleteLog = (id) => {
    if (confirm("이 기록 항목을 데이터베이스에서 영구히 삭제하시겠습니까?")) {
      setTempLogs(prev => prev.filter(log => log.id !== id));
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4">
      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100">
        <h2 className="text-2xl font-black tracking-tighter uppercase mb-6 border-b-2 border-black pb-2">Temp & pH History</h2>
        {tempLogs.length === 0 ? (
          <p className="text-center py-12 text-gray-400 font-bold uppercase text-xs tracking-widest">No logs recorded yet.</p>
        ) : (
          <div className="space-y-4">
            {tempLogs.map(log => (
              <div key={log.id} className="flex justify-between items-start bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="text-[10px] font-black px-2 py-0.5 bg-black text-white rounded uppercase">{log.type}</span>
                    <strong className="text-sm font-black text-gray-900 truncate">{log.productName}</strong>
                    <span className="font-mono text-[10px] font-bold text-gray-400 ml-auto md:ml-0">{log.displayTime}</span>
                  </div>
                  {log.memo && <p className="text-xs font-bold text-gray-600 bg-white p-2.5 rounded-xl border border-gray-100 mt-2">{log.memo}</p>}
                </div>
                <button 
                  onClick={() => handleDeleteLog(log.id)}
                  className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-xs font-black tracking-tight transition-colors uppercase shrink-0"
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}