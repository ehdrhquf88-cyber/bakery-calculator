"use client";

import { useState, useEffect, useMemo, useCallback } from "react";

export default function Home() {
  const [view, setView] = useState("calc"); 
  const [recipes, setRecipes] = useState([]);
  const [tempLogs, setTempLogs] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // ─── 데이터 무결성 보존: 로컬스토리지 입출력 ───
  useEffect(() => {
    try {
      const savedRecipes = localStorage.getItem("bakery_recipes");
      const savedTempLogs = localStorage.getItem("bakery_temp_ph");
      if (savedRecipes) setRecipes(JSON.parse(savedRecipes));
      if (savedTempLogs) setTempLogs(JSON.parse(savedTempLogs));
    } catch (e) {
      console.error("데이터 로드 실패:", e);
    }
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
    <div className="min-h-screen bg-[#f7f6f3] pb-10 print:bg-white print:pb-0 font-sans selection:bg-neutral-200">
      {/* 상단 네비게이션 (인쇄시 제외) */}
      <nav className="sticky top-0 z-40 flex gap-4 md:gap-8 p-4 md:p-6 bg-white/80 backdrop-blur-md border-b border-gray-200/80 justify-start md:justify-center overflow-x-auto whitespace-nowrap shadow-sm no-scrollbar print:hidden">
        <NavButton active={view === "calc"} onClick={() => setView("calc")}>레시피 계산기</NavButton>
        <NavButton active={view === "db"} onClick={() => setView("db")}>레시피 DB</NavButton>
        <NavButton active={view === "temp_db"} onClick={() => setView("temp_db")}>온도/pH 히스토리</NavButton>
      </nav>

      <div className="py-4 md:py-8 print:py-0">
        {view === "calc" && (
          <RecipeCalculator 
            recipes={recipes} 
            setRecipes={setRecipes} 
            tempLogs={tempLogs} 
            setTempLogs={setTempLogs} 
          />
        )}
        {view === "db" && <RecipeDB recipes={recipes} setRecipes={setRecipes} />}
        {view === "temp_db" && <TempPhDB tempLogs={tempLogs} setTempLogs={setTempLogs} />}
      </div>
    </div>
  );
}

function NavButton({ active, onClick, children }) {
  return (
    <button 
      onClick={onClick} 
      className={`text-sm md:text-lg font-black tracking-tighter transition-all px-2 pb-1 ${
        active ? 'text-black border-b-2 border-black scale-105' : 'text-gray-400 hover:text-gray-600'
      }`}
    >
      {children}
    </button>
  );
}

// ────────────────────────────────────────────────────────
// 1. 레시피 계산기 컴포넌트 (4단 가변 배수 PDF 출력 엔진 통합)
// ────────────────────────────────────────────────────────
function RecipeCalculator({ recipes, setRecipes, tempLogs, setTempLogs }) {
  const [category, setCategory] = useState("하드계열");
  const [selectedRecipeId, setSelectedRecipeId] = useState("");
  const [totalDough, setTotalDough] = useState("");
  const [flourWeight, setFlourWeight] = useState("");
  const [pfYields, setPfYields] = useState({});
  const [memo, setMemo] = useState("");

  // pH 및 온도 타임스탬프 상태값
  const [doughTemp, setDoughTemp] = useState("");
  const [roomTemp, setRoomTemp] = useState("");
  const [doughPh, setDoughPh] = useState("");

  // 🖨️ PDF 출력 전용: 사용자 지정 4단계 가변 배수 (기본값: 1, 2, 4, 6)
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [printScales, setPrintScales] = useState(["1", "2", "4", "6"]);

  const filteredRecipes = useMemo(() => recipes.filter(r => r.category === category), [recipes, category]);
  const currentRecipe = useMemo(() => recipes.find(r => r.id === Number(selectedRecipeId)), [recipes, selectedRecipeId]);

  // ─── 수정 금지: 셰프님의 정밀 베이커스 % 및 소금량 역산 알고리즘 (데이터 무결성) ───
  const totals = useMemo(() => {
    if (!currentRecipe) return { totalPercent: 0, totalSaltPercent: "0.00", baseTotalDough: 0, realFlourWeight: 0, realWaterWeight: 0 };
    
    let totalFlourPct = 0;
    let totalWaterPct = 0;
    let totalSaltPct = 0;
    let rawTotalPercent = 0;

    currentRecipe.ingredients.forEach(ing => {
      const pct = parseFloat(String(ing.percent).replace(',', '.')) || 0;
      rawTotalPercent += pct;

      if (ing.type === "밀") {
        totalFlourPct += pct;
      } else if (ing.type === "수분") {
        totalWaterPct += pct;
      } else if (ing.type === "소금") {
        totalSaltPct += pct;
      } else if (ing.type === "사전반죽") {
        const yieldInput = parseFloat(String(pfYields[ing.name] || "100").replace(',', '.')) || 100;
        const pfFlourPart = pct / (1 + yieldInput / 100);
        const pfWaterPart = pfFlourPart * (yieldInput / 100);
        totalFlourPct += pfFlourPart;
        totalWaterPct += pfWaterPart;
      }
    });

    const realSaltPercent = totalFlourPct > 0 ? (totalSaltPct / totalFlourPct) * 100 : 0;
    return {
      totalPercent: rawTotalPercent,
      totalSaltPercent: realSaltPercent.toFixed(2),
      baseTotalDough: 1000 * (rawTotalPercent / 100),
      totalFlourPct,
      totalWaterPct
    };
  }, [currentRecipe, pfYields]);

  // 밀가루 양 동기화 및 자동 역산
  useEffect(() => {
    if (!currentRecipe || !totals.totalPercent) return;
    if (totalDough && !flourWeight) {
      const calculatedFlour = (parseFloat(totalDough) / totals.totalPercent) * 100;
      setFlourWeight(Math.round(calculatedFlour).toString());
    }
  }, [totalDough, currentRecipe, totals.totalPercent]);

  useEffect(() => {
    if (!currentRecipe || !totals.totalPercent) return;
    if (flourWeight && !totalDough) {
      const calculatedDough = (parseFloat(flourWeight) * totals.totalPercent) / 100;
      setTotalDough(Math.round(calculatedDough).toString());
    }
  }, [flourWeight, currentRecipe, totals.totalPercent]);

  const clearCalculator = () => {
    setTotalDough("");
    setFlourWeight("");
    setDoughTemp("");
    setRoomTemp("");
    setDoughPh("");
    setMemo("");
  };

  const saveMetricsLog = () => {
    if (!currentRecipe) return;
    const newLog = {
      id: Date.now(),
      recipeName: currentRecipe.productName,
      date: new Date().toLocaleDateString("ko-KR"),
      time: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
      doughTemp: doughTemp || "-",
      roomTemp: roomTemp || "-",
      doughPh: doughPh || "-",
      memo: memo || ""
    };
    setTempLogs(prev => [newLog, ...prev]);
    alert("현재 발효 마일스톤(온도/pH)이 히스토리에 기록되었습니다.");
  };

  const triggerPrint = () => {
    window.print();
    setShowPdfModal(false);
  };

  return (
    <main className="max-w-6xl mx-auto px-4 md:px-8 text-black print:px-0 print:max-w-full">
      
      {/* 🖨️ 현장 맞춤형 프리미엄 고대비 인쇄 스타일 */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { size: A4; margin: 20mm 15mm; }
          body { background: white; color: black; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .print-table { width: 100%; border-collapse: collapse; margin-top: 25px; }
          .print-table th { background-color: #111 !important; color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 10px; font-size: 13px; font-weight: bold; border: 1px solid #111; text-align: center; }
          .print-table td { border: 1px solid #ddd; padding: 10px; font-size: 13px; text-align: right; }
          .print-table td:first-child { text-align: left; font-weight: bold; background-color: #fafdff !important; }
          .print-title-area { border-bottom: 3px double #000; padding-bottom: 12px; margin-bottom: 20px; }
        }
        @media screen { .print-only { display: none; } }
      `}} />

      {/* [화면 출력] 메인 상단 그리드 */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 md:gap-8 print:hidden">
        
        {/* 왼쪽: 메인 워크스페이스 패널 */}
        <section className="bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-gray-100 no-print">
          <div className="border-b-2 border-black pb-4 mb-6 flex justify-between items-center">
            <h1 className="text-2xl md:text-3xl font-black tracking-tight truncate uppercase">
              {currentRecipe ? currentRecipe.productName : "Bread OS 계산기"}
            </h1>
            {currentRecipe && (
              <button 
                onClick={() => setShowPdfModal(true)}
                className="bg-neutral-900 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-neutral-800 shadow-md transition-all active:scale-95"
              >
                📄 가변 배수 프린트
              </button>
            )}
          </div>

          {/* 셀렉터 및 수치 인풋 (유저 교정 가이드 반영: 인풋창 숫자 잘림 방지용 충분한 패딩 처리) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 text-sm">
            <InputField label="제품 대분류 분류">
              <select value={category} onChange={(e) => { setCategory(e.target.value); setSelectedRecipeId(""); clearCalculator(); }} className="bg-transparent border-b-2 border-black font-bold outline-none w-full py-1.5 px-1">
                <option value="하드계열">하드계열 (Hard Bread)</option>
                <option value="소프트계열">소프트계열 (Soft Bread)</option>
                <option value="사전반죽">사전반죽 (Pre-Ferment)</option>
              </select>
            </InputField>
            
            <InputField label="레시피 선택">
              <select value={selectedRecipeId} onChange={(e) => { setSelectedRecipeId(e.target.value); clearCalculator(); }} className="bg-transparent border-b-2 border-black font-bold outline-none w-full py-1.5 px-1">
                <option value="">레시피를 선택하세요</option>
                {filteredRecipes.map(r => <option key={r.id} value={r.id}>{r.productName}</option>)}
              </select>
            </InputField>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <InputField label="목표 총 반죽량 (g)">
              <input type="number" value={totalDough} placeholder="ex) 1830" disabled={!currentRecipe} onChange={(e) => { setFlourWeight(""); setTotalDough(e.target.value); }} className="bg-transparent border-b-2 border-black font-mono font-bold text-lg outline-none w-full py-1 px-2 disabled:opacity-40" />
            </InputField>
            <InputField label="총 밀가루 중량 (g)">
              <input type="number" value={flourWeight} placeholder="ex) 1000" disabled={!currentRecipe} onChange={(e) => { setTotalDough(""); setFlourWeight(e.target.value); }} className="bg-transparent border-b-2 border-black font-mono font-bold text-lg outline-none w-full py-1 px-2 disabled:opacity-40" />
            </InputField>
          </div>

          {/* 사전반죽 수율(Yield) 입력 동적 배치 */}
          {currentRecipe && currentRecipe.ingredients.some(i => i.type === "사전반죽") && (
            <div className="bg-amber-50/60 border border-amber-200/70 rounded-2xl p-4 mb-6 animate-fadeIn">
              <span className="text-xs font-black text-amber-800 uppercase tracking-wider block mb-2">💡 사전반죽 수율(Water Yield) 실시간 매핑</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {currentRecipe.ingredients.filter(i => i.type === "사전반죽").map(ing => (
                  <div key={ing.name} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-amber-100">
                    <span className="text-xs font-bold truncate text-gray-700">{ing.name} 수율:</span>
                    <input type="number" placeholder="100" value={pfYields[ing.name] || ""} onChange={(e) => setPfYields({...pfYields, [ing.name]: e.target.value})} className="w-16 text-center border-b border-black font-bold text-xs p-0.5 outline-none font-mono" />
                    <span className="text-xs text-gray-400">%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 실시간 재료 무게 계산 테이블 */}
          <div className="overflow-x-auto">
            <table className="w-full mt-2 min-w-[400px]">
              <thead>
                <tr className="border-y border-neutral-300 text-[11px] text-neutral-400 font-bold uppercase tracking-widest text-center">
                  <th className="p-3 text-left">재료명</th>
                  <th className="p-3 text-center">분류</th>
                  <th className="p-3 text-right">베이커스 %</th>
                  <th className="p-3 text-right">계량 중량 (g)</th>
                </tr>
              </thead>
              <tbody>
                {currentRecipe ? (
                  currentRecipe.ingredients.map((ing, idx) => {
                    const baseFlour = parseFloat(String(flourWeight).replace(',', '.')) || 0;
                    const calculatedGrams = Math.round(baseFlour * (parseFloat(ing.percent) / 100)) || 0;
                    return (
                      <tr key={idx} className="border-b border-neutral-100 hover:bg-neutral-50/50 transition-colors">
                        <td className="p-3 font-black text-sm text-neutral-800">{ing.name}</td>
                        <td className="p-3 text-center"><span className="text-[11px] font-bold bg-neutral-100 px-2 py-0.5 rounded-md text-neutral-500">{ing.type}</span></td>
                        <td className="p-3 text-right font-mono font-bold text-sm text-neutral-600">{ing.percent}%</td>
                        <td className="p-3 text-right font-mono font-black text-sm text-neutral-900 bg-neutral-50/30 px-2">{calculatedGrams.toLocaleString()} g</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="4" className="text-center p-10 text-gray-400 text-sm font-medium">상단의 대분류와 제품명을 선택하면 연산 시트가 활성화됩니다.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* 오른쪽 세션: 실시간 모니터링 대시보드 */}
        <div className="space-y-6 no-print">
          <SummaryCard title="METRICS SUMMARY">
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                <span className="text-xs font-bold text-gray-400">베이커스 총합 수율</span>
                <span className="font-mono font-black text-lg text-neutral-800">{totals.totalPercent.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                <span className="text-xs font-bold text-neutral-400">정밀 대입 총 소금 비율<br/><span className="text-[10px] text-amber-600 font-normal">(사전반죽 수율 역산 포함)</span></span>
                <span className="font-mono font-black text-lg text-red-600">{totals.totalSaltPercent}%</span>
              </div>
            </div>
          </SummaryCard>

          <SummaryCard title="MILESTONE LOG">
            <p className="text-xs text-gray-400 font-medium mb-4">현재 배치의 발효 추적 변수값 기록</p>
            <div className="space-y-3 mb-5">
              <div className="flex items-center justify-between border-b border-black/10 py-1">
                <span className="text-xs font-bold text-gray-600">반죽 온도</span>
                <div className="flex items-center"><input type="text" value={doughTemp} onChange={(e)=>setDoughTemp(e.target.value)} className="w-16 font-mono font-bold text-right outline-none bg-transparent px-1" /> <span className="text-xs font-bold ml-1">°C</span></div>
              </div>
              <div className="flex items-center justify-between border-b border-black/10 py-1">
                <span className="text-xs font-bold text-gray-600">실내 실온</span>
                <div className="flex items-center"><input type="text" value={roomTemp} onChange={(e)=>setRoomTemp(e.target.value)} className="w-16 font-mono font-bold text-right outline-none bg-transparent px-1" /> <span className="text-xs font-bold ml-1">°C</span></div>
              </div>
              <div className="flex items-center justify-between border-b border-black/10 py-1">
                <span className="text-xs font-bold text-gray-600">반죽 최종 pH</span>
                <div className="flex items-center"><input type="text" value={doughPh} onChange={(e)=>setDoughPh(e.target.value)} className="w-16 font-mono font-bold text-right outline-none bg-transparent px-1" /> <span className="text-xs font-bold ml-1">pH</span></div>
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">메모 / 특이사항</label>
                <textarea value={memo} onChange={(e)=>setMemo(e.target.value)} placeholder="충전물 투입 시점, 폴딩 주기 등 기록..." className="w-full h-20 text-xs border border-neutral-200 rounded-xl p-2 outline-none resize-none bg-white font-medium" />
              </div>
            </div>
            <button disabled={!currentRecipe} onClick={saveMetricsLog} className="w-full py-3 bg-black text-white font-black rounded-xl text-xs uppercase tracking-wider disabled:opacity-30 transition-all hover:bg-neutral-800">
              로그 데이터 저장
            </button>
          </SummaryCard>
        </div>
      </div>

      {/* ─── 📥 가변 배수 인쇄 컨트롤 게이트웨이 모달 ─── */}
      {showPdfModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm no-print p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 md:p-8 shadow-2xl border border-neutral-100 transform scale-100 transition-transform">
            <h2 className="text-xl md:text-2xl font-black mb-1 uppercase tracking-tighter text-neutral-900">🖨️ 현장 맞춤형 멀티 배수 세팅</h2>
            <p className="text-xs text-neutral-400 font-medium mb-6">주방에서 동시 계량할 4가지 배수 단계를 직접 타이핑하세요.</p>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              {printScales.map((val, idx) => (
                <div key={idx} className="bg-neutral-50 p-3 rounded-xl border border-neutral-200">
                  <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider mb-1 block">배수 슬롯 {idx + 1}</label>
                  <div className="flex items-center gap-1">
                    <input 
                      type="text" 
                      inputMode="decimal" 
                      value={val} 
                      onChange={(e) => {
                        const updated = [...printScales];
                        updated[idx] = e.target.value.replace(',', '.');
                        setPrintScales(updated);
                      }}
                      className="w-full bg-transparent text-center font-mono font-black text-lg outline-none text-neutral-800 border-b border-neutral-400 focus:border-black py-0.5"
                    />
                    <span className="text-xs font-bold text-neutral-500">배</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowPdfModal(false)} className="flex-1 py-3.5 bg-neutral-100 text-neutral-700 hover:bg-neutral-200 font-black rounded-xl text-xs uppercase transition-colors">취소</button>
              <button onClick={triggerPrint} className="flex-1 py-3.5 bg-black text-white hover:bg-neutral-800 font-black rounded-xl text-xs uppercase shadow-lg transition-colors">인쇄 가동 (Print)</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 🖨️ 인쇄 전용 레이아웃 시트 (주방 부착용 A4 포맷, 평소 화면에선 히든) ─── */}
      <div className="print-only">
        <div className="print-title-area">
          <div style={{fontSize: '28px', fontWeight: '900', letterSpacing: '-1px', marginBottom: '4px'}}>{currentRecipe?.productName}</div>
          <div style={{fontSize: '12px', color: '#555', fontWeight: 'bold'}}>Bread OS 정밀 생산 작업지시서 | 출력일자: {new Date().toLocaleDateString("ko-KR")}</div>
        </div>
        
        <div style={{display: 'flex', gap: '20px', marginBottom: '20px', fontSize: '12px', fontWeight: 'bold', background: '#f9f9f9', padding: '10px', border: '1px solid #ddd'}}>
          <div>카테고리: {category}</div>
          <div>•</div>
          <div>총합 배율 수율: {totals.totalPercent.toFixed(1)}%</div>
          <div>•</div>
          <div>실제 총 소금 수치: {totals.totalSaltPercent}% <span style={{fontSize:'10px', fontWeigh:'normal'}}>(사전반죽 역산 반영 완료)</span></div>
        </div>

        <table className="print-table">
          <thead>
            <tr>
              <th style={{width: '28%'}}>재료명 (Ingredient)</th>
              <th style={{width: '12%'}}>베이커스 %</th>
              {printScales.map((scale, i) => (
                <th key={i}>{parseFloat(scale) || 0}배 생산 (g)</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {currentRecipe?.ingredients.map((ing, idx) => {
              const baseFlour = parseFloat(String(flourWeight).replace(',', '.')) || 1000;
              const baseWeight = baseFlour * (parseFloat(ing.percent) / 100);
              return (
                <tr key={idx}>
                  <td>{ing.name} <span style={{fontSize:'10px', color:'#777', fontWeight:'normal'}}>({ing.type})</span></td>
                  <td style={{textAlign: 'center', fontStyle: 'italic'}}>{ing.percent}%</td>
                  {printScales.map((scale, i) => {
                    const multiplier = parseFloat(scale) || 0;
                    return <td key={i} style={{fontFamily: 'monospace', fontWeight: 'bold'}}>{Math.round(baseWeight * multiplier).toLocaleString()} g</td>
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>

        {memo && (
          <div style={{marginTop: '30px', padding: '15px', border: '1px solid #000', borderRadius: '4px'}}>
            <div style={{fontSize: '11px', fontWeight: '900', marginBottom: '5px'}}>⚠️ 특이사항 및 생산 지시 가이드</div>
            <div style={{fontSize: '12px', whiteSpace: 'pre-wrap', lineHeight: '1.5'}}>{memo}</div>
          </div>
        )}
      </div>
    </main>
  );
}

// ────────────────────────────────────────────────────────
// 2. 레시피 DB 관리 컴포넌트 (기존 기능 완벽 보존)
// ────────────────────────────────────────────────────────
function RecipeDB({ recipes, setRecipes }) {
  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState("하드계열");
  const [ingredients, setIngredients] = useState([{ name: "", percent: "", type: "밀" }]);

  const addIngredientRow = () => {
    setIngredients([...ingredients, { name: "", percent: "", type: "밀" }]);
  };

  const handleIngChange = (idx, field, val) => {
    const updated = [...ingredients];
    updated[idx][field] = val;
    setIngredients(updated);
  };

  const removeIngredientRow = (idx) => {
    setIngredients(ingredients.filter((_, i) => i !== idx));
  };

  const saveRecipeToDb = (e) => {
    e.preventDefault();
    if (!productName.trim() || ingredients.length === 0) return alert("제품명과 최소 한 개 이상의 재료를 채워주세요.");
    
    const newRecipe = {
      id: Date.now(),
      productName: productName.trim(),
      category,
      ingredients: ingredients.map(i => ({
        ...i,
        percent: String(i.percent).replace(',', '.')
      }))
    };

    setRecipes(prev => [newRecipe, ...prev]);
    setProductName("");
    setIngredients([{ name: "", percent: "", type: "밀" }]);
    alert(`[${newRecipe.productName}] 레시피가 정상 등록되었습니다.`);
  };

  const deleteRecipe = (id) => {
    if(confirm("해당 레시피를 영구 삭제하시겠습니까?")) {
      setRecipes(recipes.filter(r => r.id !== id));
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 print:hidden">
      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-gray-100 mb-8">
        <h2 className="text-xl font-black mb-6 border-b-2 border-black pb-2 uppercase">New Recipe Formulation Registry</h2>
        <form onSubmit={saveRecipeToDb} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField label="제품명 (Product Name)">
              <input type="text" value={productName} onChange={(e)=>setProductName(e.target.value)} placeholder="ex) 정통 사워도우 바게트" className="bg-transparent border-b-2 border-black font-bold outline-none w-full py-1.5 px-1" />
            </InputField>
            <InputField label="카테고리 구분">
              <select value={category} onChange={(e)=>setCategory(e.target.value)} className="bg-transparent border-b-2 border-black font-bold outline-none w-full py-1.5 px-1">
                <option value="하드계열">하드계열</option>
                <option value="소프트계열">소프트계열</option>
                <option value="사전반죽">사전반죽</option>
              </select>
            </InputField>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">배합 재료 구성비 (Baker's % Formula Matrix)</label>
            {ingredients.map((ing, idx) => (
              <div key={idx} className="flex flex-wrap sm:flex-nowrap gap-2 items-center border-b border-gray-100 pb-2">
                <input type="text" placeholder="재료명 (ex: 프랑스 T65)" value={ing.name} onChange={(e)=>handleIngChange(idx, "name", e.target.value)} className="flex-1 min-w-[120px] bg-transparent border-b border-gray-300 font-bold text-sm outline-none p-1" />
                <input type="text" inputMode="decimal" placeholder="비율 %" value={ing.percent} onChange={(e)=>handleIngChange(idx, "percent", e.target.value)} className="w-20 bg-transparent border-b border-gray-300 font-mono font-bold text-sm text-right outline-none p-1" />
                <select value={ing.type} onChange={(e)=>handleIngChange(idx, "type", e.target.value)} className="bg-gray-100 text-xs font-bold rounded-lg p-1.5 outline-none">
                  <option value="밀">밀가루군</option>
                  <option value="수분">수분군</option>
                  <option value="소금">소금군</option>
                  <option value="사전반죽">사전반죽(르방 등)</option>
                  <option value="기타">기타 부재료</option>
                </select>
                <button type="button" onClick={()=>removeIngredientRow(idx)} className="text-red-500 font-bold text-xs p-1 hover:text-red-700">✕</button>
              </div>
            ))}
            <button type="button" onClick={addIngredientRow} className="text-xs font-black uppercase tracking-wider bg-gray-100 text-black px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-200 transition-colors">+ 재료 행 추가</button>
          </div>
          <button type="submit" className="w-full py-3 bg-black text-white font-black rounded-xl text-xs uppercase tracking-wider shadow-lg transition-transform hover:bg-neutral-800">마스터 레시피 데이터베이스 저장</button>
        </form>
      </div>

      {/* 등록된 레시피 간이 목록 출력 */}
      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-gray-100">
        <h2 className="text-xl font-black mb-4 border-b-2 border-black pb-2 uppercase">Registered Recipe Archive ({recipes.length})</h2>
        <div className="divide-y divide-gray-100">
          {recipes.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-6">현재 시스템에 기록된 레시피 가동 기록이 없습니다.</p>
          ) : (
            recipes.map(r => (
              <div key={r.id} className="py-3 flex justify-between items-center hover:bg-neutral-50/50 px-2 transition-colors">
                <div>
                  <span className="text-xs bg-neutral-900 text-white font-bold px-2 py-0.5 rounded-md mr-2">{r.category}</span>
                  <strong className="text-sm text-neutral-800">{r.productName}</strong>
                  <span className="text-xs text-gray-400 ml-2">({r.ingredients.length}개 핵심재료 배합됨)</span>
                </div>
                <button onClick={() => deleteRecipe(r.id)} className="text-xs font-bold text-red-500 hover:underline">삭제</button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────
// 3. 온도 및 pH 히스토리 로그 컴포넌트 (기존 기능 완벽 보존)
// ────────────────────────────────────────────────────────
function TempPhDB({ tempLogs, setTempLogs }) {
  const clearAllLogs = () => {
    if(confirm("모든 발효 타임라인 추적 마일스톤 히스토리를 영구히 비우시겠습니까?")) {
      setTempLogs([]);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 print:hidden animate-fadeIn">
      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-gray-100">
        <div className="flex justify-between items-center border-b-2 border-black pb-2 mb-6">
          <h2 className="text-xl font-black uppercase">FERMENTATION TIME-SERIES MILESTONES</h2>
          {tempLogs.length > 0 && (
            <button onClick={clearAllLogs} className="text-xs font-bold text-red-500 hover:underline">전체 로그 리셋</button>
          )}
        </div>
        
        <div className="space-y-4">
          {tempLogs.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-10 font-medium">기록된 공정별 변수 마일스톤 추적 데이터가 존재하지 않습니다.</p>
          ) : (
            tempLogs.map(log => (
              <div key={log.id} className="p-4 border border-neutral-200 rounded-2xl bg-neutral-50/40 hover:bg-neutral-50 transition-colors">
                <div className="flex justify-between items-start flex-wrap gap-2 mb-2">
                  <div>
                    <h3 className="font-black text-base text-neutral-900">{log.recipeName}</h3>
                    <span className="text-[11px] font-bold text-neutral-400">{log.date} @ {log.time}</span>
                  </div>
                  <div className="flex gap-2 font-mono text-xs font-bold">
                    <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-xl border border-blue-100">반죽: {log.doughTemp}°C</span>
                    <span className="bg-amber-50 text-amber-700 px-2.5 py-1 rounded-xl border border-amber-100">실온: {log.roomTemp}°C</span>
                    <span className="bg-red-50 text-red-700 px-2.5 py-1 rounded-xl border border-red-100">수치: {log.doughPh} pH</span>
                  </div>
                </div>
                {log.memo && (
                  <p className="text-xs text-neutral-600 bg-white p-3 border border-neutral-100 rounded-xl font-medium leading-relaxed mt-2 shadow-sm whitespace-pre-wrap">
                    {log.memo}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function InputField({ label, children }) {
  return (
    <div className="w-full">
      <label className="text-[11px] font-black text-neutral-400 uppercase tracking-widest mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}

function SummaryCard({ title, children }) {
  return (
    <div className="bg-white rounded-3xl p-6 shadow-xl border border-gray-100">
      <h2 className="text-base md:text-lg font-black tracking-tighter border-b-2 border-black pb-2 mb-4 uppercase">{title}</h2>
      {children}
    </div>
  );
}