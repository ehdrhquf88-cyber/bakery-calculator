import { useState, useMemo, useCallback } from "react";

import { InputField, SummaryCard, SummaryRow } from "./common";



export default function RecipeCalculator({ recipes, setRecipes, tempLogs, setTempLogs, requestSafetyCheck }) {
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

  const ingredientCosts = useMemo(() => {
    if (!currentRecipe) return [];

    const parsedFlour = parseFloat(String(flourWeight).replace(',', '.')) || 0;

    return currentRecipe.ingredients.map(ing => {
      const parsedPercent = parseFloat(String(ing.percent).replace(',', '.')) || 0;
      const grams = Math.round(parsedFlour * (parsedPercent / 100));
      const unitCost = parseFloat(String(ing.cost).replace(',', '.')) || 0;

      return {
        name: ing.name,
        type: ing.type,
        cost: Math.round((grams || 0) * unitCost),
      };
    });
  }, [currentRecipe, flourWeight]);

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

  const resetRecipeSelection = useCallback((recipeId) => {
    setSelectedRecipeId(recipeId);
    setPfYields({});
    setDoughMultiplier("1");
    setFlourMultiplier("1");

    const recipe = recipes.find(r => r.id === Number(recipeId));
    const rawTotalPercent = recipe?.ingredients.reduce((sum, ing) => {
      return sum + (parseFloat(String(ing.percent).replace(',', '.')) || 0);
    }, 0) || 0;

    if (recipe && rawTotalPercent > 0) {
      setFlourWeight(1000);
      setTotalDough(Math.round(1000 * (rawTotalPercent / 100)));
    } else {
      setTotalDough("");
      setFlourWeight("");
    }
  }, [recipes]);

  const handleRecipeSelectionChange = (recipeId) => {
    if (recipeId === selectedRecipeId) return;

    if (selectedRecipeId && recipeId && requestSafetyCheck) {
      requestSafetyCheck(() => resetRecipeSelection(recipeId));
      return;
    }

    resetRecipeSelection(recipeId);
  };

  // 브라우저 프린트 실행 연동 함수 수정
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

  // 인쇄용 유효 배수 배열 필터링
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
              <select value={category} onChange={(e) => { setCategory(e.target.value); resetRecipeSelection(""); }} className="bg-transparent border-b border-black font-bold outline-none w-full pb-1 print:border-none print:pointer-events-none">
                <option value="하드계열">하드계열</option>
                <option value="소프트계열">소프트계열</option>
                <option value="사전반죽">사전반죽</option>
              </select>
            </InputField>
          
            <InputField label="제품명 선택">
              <select value={selectedRecipeId} onChange={(e) => handleRecipeSelectionChange(e.target.value)} className="bg-transparent border-b border-black font-bold outline-none w-full pb-1 print:border-none print:pointer-events-none">
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
                  {/* 다중 배수 인쇄용 헤더 매핑 */}
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
                      {/* 화면용 기본 단일 무게 컬럼 */}
                      <td className="p-2 text-right font-bold text-gray-400 text-sm print-hidden-multipliers">
                        {(computedGrams || 0).toLocaleString()}g
                      </td>
                      {/* 인쇄용 다중 배수 컬럼 동적 계산 영역 */}
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
                <SummaryCard title="사전반죽 수율">
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

          {currentRecipe && (
            <SummaryCard title="원가">
              <div className="space-y-2">
                {ingredientCosts.map((item, idx) => (
                  <div key={`${item.name}-${idx}`} className="flex justify-between gap-3 border-b border-dashed border-black/10 pb-2 text-xs md:text-sm">
                    <div className="min-w-0">
                      <div className="text-[9px] text-gray-400 font-bold uppercase">{item.type}</div>
                      <div className="font-bold truncate">{item.name}</div>
                    </div>
                    <span className="font-mono font-bold shrink-0">{item.cost.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t-2 border-black flex justify-between text-sm">
                <span className="font-black uppercase tracking-tight">총 원가</span>
                <span className="font-mono font-black">{Math.round(totals.totalCost).toLocaleString()}</span>
              </div>
            </SummaryCard>
          )}

          <div className="print:hidden">
            <QuickTempEntry tempLogs={tempLogs} setTempLogs={setTempLogs} currentProductName={currentRecipe?.productName} memo={memo} setMemo={setMemo} isPreFermentMode={category === "사전반죽"} />
          </div>
        </div>
      </div>

      {/* 다중 배수 프린트 설정 모달 (최대 4개) */}
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

// 다중 배수 입력 모달 컴포넌트 추가

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
          <button 
            onClick={onClose} 
            className="flex-1 bg-white border border-gray-200 py-3 rounded-xl font-bold text-xs uppercase tracking-tighter"
          >
            취소
          </button>
          <button 
            onClick={onPrint} 
            className="flex-1 bg-black text-white py-3 rounded-xl font-bold text-xs uppercase tracking-tighter shadow-md"
          >
            출력하기
          </button>
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
          <span className="font-black text-[10px] uppercase text-gray-400">사전반죽 수율 Log</span>
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
                    Click to Edit 
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                  {items.map(item => latestLog.data[item] && (latestLog.data[item].t || latestLog.data[item].p || latestLog.data[item].h || latestLog.data[item].v) ? (
                    <div key={item} className="flex justify-between border-b border-gray-50/50 min-w-0">
                      <span className="text-gray-400 font-bold uppercase shrink-0 mr-1">{item}</span>
                      <span className="font-mono truncate text-right">
                        {latestLog.data[item].t && `${latestLog.data[item].t}`}
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
