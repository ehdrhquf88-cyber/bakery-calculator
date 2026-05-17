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

  // 🖨️ 새 기능: 4단 배수 지정 인쇄를 위한 모달 및 배수 배열 상태 추가
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printScales, setPrintScales] = useState(["1", "2", "4", "6"]); // 기본 4개 배수 세팅

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

  return (
    <main className="max-w-6xl mx-auto px-4 md:px-8 text-black print:px-0 print:max-w-full">
      {/* 🖨️ 인쇄 전용 반응형 스타일 선언 */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { size: A4 landscape; margin: 12mm; }
          body { background: white; color: black; }
          .print-hidden { display: none !important; }
          .print-only { display: block !important; }
          .print-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          .print-table th, .print-table td { border: 1px solid #111; padding: 8px 10px; text-align: right; font-size: 12px; }
          .print-table th { background: #f5f5f4 !important; text-align: center; font-weight: 900; }
          .print-table td.ing-name { text-align: left; font-weight: 900; }
          .print-header { border-b-2 border-black pb-3 mb-4 flex justify-between items-end; }
        }
        @media screen { .print-only { display: none !important; } }
      `}} />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 md:gap-8 print:hidden">
        {/* 원본 화면 인터페이스 완전 보존 (print:hidden으로 감싸 인쇄 시 격리) */}
        <section className="bg-[#f7f6f3] rounded-2xl p-5 md:p-6 shadow-lg border border-white/50 order-1">
          <div className="border-b-2 border-black pb-3 mb-6 flex justify-between items-end">
            <h1 className="text-3xl md:text-4xl font-black tracking-tighter truncate uppercase">
              {currentRecipe ? currentRecipe.productName : "CALCULATOR"}
            </h1>
            {currentRecipe && (
              <button 
                onClick={() => setShowPrintModal(true)}
                className="bg-black text-white px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-tight hover:bg-gray-800 transition-all shadow-md flex items-center gap-1"
              >
                PDF 배수지정 / 인쇄
              </button>
            )}
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
            
            <div className="flex flex-col justify-between">
              <InputField label="총 반죽량 (g)">
                <input type="text" inputMode="decimal" value={totalDough} onChange={(e) => {
                  const val = e.target.value.replace(',', '.');
                  setTotalDough(val);
                  setDoughMultiplier("1"); 
                  setFlourMultiplier("1");
                  if (!val || totals.totalPercent === 0) setFlourWeight("");
                  else setFlourWeight(Math.round(parseFloat(val) / (totals.totalPercent / 100)) || "");
                }} placeholder="0" className="bg-transparent border-b border-black font-bold w-full pb-1 outline-none" />
              </InputField>
              {currentRecipe && (
                <div className="flex items-center gap-1.5 mt-2">
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
                }} placeholder="0" className="bg-transparent border-b border-black font-bold w-full pb-1 outline-none" />
              </InputField>
              {currentRecipe && (
                <div className="flex items-center gap-1.5 mt-2">
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
            <table className="w-full mt-4 min-w-[300px]">
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
                            className="bg-transparent border-b border-black/10 hover:border-black text-right font-mono text-sm font-bold outline-none transition-colors pb-1 h-auto"
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

        {/* 우측 사이드바 패널 */}
        <div className="space-y-6 order-2">
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
          <div>
            <QuickTempEntry tempLogs={tempLogs} setTempLogs={setTempLogs} currentProductName={currentRecipe?.productName} memo={memo} setMemo={setMemo} isPreFermentMode={category === "사전반죽"} />
          </div>
        </div>
      </div>

      {/* 📥 4단 배수 지정 팝업 모달창 (오직 화면단에서만 보임) */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm print-hidden">
          <div className="bg-[#f7f6f3] p-6 rounded-2xl shadow-2xl w-full max-w-sm border border-white/60 text-black">
            <h2 className="text-lg font-black mb-5 tracking-tight uppercase border-b-2 border-black pb-2">🖨️ 인쇄 배수 설정 (4단 단일표)</h2>
            <p className="text-[11px] font-bold text-gray-500 mb-4 leading-normal">출력 도표에 나열될 4개의 수량을 각각 기입하세요.</p>
            <div className="grid grid-cols-2 gap-4 mb-6">
              {printScales.map((scale, idx) => (
                <div key={idx}>
                  <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">배수 {idx + 1}</label>
                  <div className="flex items-center border-b border-black">
                    <input 
                      type="text" 
                      inputMode="decimal"
                      value={scale} 
                      onChange={(e) => {
                        const newScales = [...printScales];
                        newScales[idx] = e.target.value.replace(',', '.');
                        setPrintScales(newScales);
                      }}
                      className="w-full bg-transparent text-center font-mono font-black text-base outline-none py-1"
                    />
                    <span className="text-xs font-bold text-gray-400 px-1">배</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3 text-xs font-bold uppercase">
              <button onClick={() => setShowPrintModal(false)} className="flex-1 bg-white border border-gray-200 py-3 rounded-xl hover:bg-gray-50 transition-all">취소</button>
              <button onClick={() => { setShowPrintModal(false); setTimeout(() => window.print(), 100); }} className="flex-1 bg-black text-white py-3 rounded-xl hover:bg-gray-900 transition-all shadow-md">인쇄 실행</button>
            </div>
          </div>
        </div>
      )}

      {/* 🖨️ 오직 종이/PDF 출력시에만 나타나는 4단 가로형 테이블 레이아웃 */}
      {currentRecipe && (
        <div className="print-only">
          <div className="print-header">
            <div>
              <h1 style={{ fontSize: '26px', fontWeight: '900', tracking: '-0.05em', margin: 0 }}>{currentRecipe.productName}</h1>
              <p style={{ fontSize: '11px', color: '#444', fontWeight: 'bold', margin: '4px 0 0 0' }}>
                분류: {category} | 사전반죽 포함 수율: {totals.finalYield.toFixed(1)}% | 소금 비율: {totals.totalSaltPercent}%
              </p>
            </div>
            <div style={{ textAlign: 'right', fontSize: '10px', color: '#888', fontWeight: 'bold' }}>
              Bread OS - {new Date().toLocaleDateString()}
            </div>
          </div>

          <table className="print-table">
            <thead>
              <tr>
                <th className="ing-name" style={{ width: '22%' }}>재료명 (Ingredient)</th>
                <th style={{ width: '10%' }}>종류</th>
                <th style={{ width: '12%' }}>베이커스 %</th>
                {printScales.map((scale, i) => (
                  <th key={i}>{parseFloat(scale) || 0}배 수량 (g)</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {currentRecipe.ingredients.map((ing, idx) => {
                // 원본 연산식 보존: 입력되어 있는 밀가루 기준값을 베이스로 배수 곱셈 진행
                const baseFlour = parseFloat(String(flourWeight).replace(',', '.')) || 1000;
                const parsedPercent = parseFloat(String(ing.percent).replace(',', '.')) || 0;
                const baseIngredientGrams = baseFlour * (parsedPercent / 100);

                return (
                  <tr key={idx}>
                    <td className="ing-name">{ing.name}</td>
                    <td style={{ textAlign: 'center', fontSize: '10px', color: '#555' }}>{ing.type}</td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{ing.percent}%</td>
                    {printScales.map((scale, i) => {
                      const multiplier = parseFloat(scale) || 0;
                      const finalGrams = Math.round(baseIngredientGrams * multiplier);
                      return (
                        <td key={i} style={{ fontJoin: 'miter', fontWeight: '900' }}>
                          {finalGrams.toLocaleString()}g
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          {memo && (
            <div style={{ marginTop: '25px', padding: '12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '11px', background: '#fafaf9' }}>
              <div style={{ fontWeight: '900', textTransform: 'uppercase', marginBottom: '5px', fontSize: '9px', color: '#666' }}>Recipe Note</div>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{memo}</div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

// 하위 컴포넌트인 QuickTempEntry, HistoryChart, TempPhDB, RecipeDB 등은 셰프님의 원본 파일 구성과 완벽하게 동일하므로 하단에 그대로 이어 붙여 사용하시면 됩니다.