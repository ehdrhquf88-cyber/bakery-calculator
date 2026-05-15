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
          if (ing.name === ingName) {
            return { ...ing, percent: cleanValue };
          }
          return ing;
        });
        return { ...recipe, ingredients: updatedIngredients };
      }
      return recipe;
    });
    setRecipes(updatedRecipes);
  };

  const totals = useMemo(() => {
    if (!currentRecipe) return { totalPercent: 0, totalSaltPercent: 0, finalYield: 0, totalCost: 0 };
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
    const finalYield = totalFlourPct > 0 ? (totalWaterPct / totalFlourPct) * 100 : 0;
    
    const cost = currentRecipe.ingredients.reduce((sum, ing) => {
        const pctVal = parseFloat(String(ing.percent).replace(',', '.')) || 0;
        const weight = flourWeight ? (parseFloat(String(flourWeight).replace(',', '.')) * (pctVal / 100)) : 0;
        return sum + (weight * (parseFloat(String(ing.cost).replace(',', '.')) || 0));
    }, 0);

    return { 
      totalPercent: rawTotalPercent, 
      totalSaltPercent: realSaltPercent.toFixed(2),
      finalYield, 
      totalCost: cost 
    };
  }, [currentRecipe, pfYields, flourWeight]);

  const handleTotalDoughChange = (v) => { 
    const val = v.replace(',', '.');
    setTotalDough(val); 
    if (!val || totals.totalPercent === 0) { setFlourWeight(""); return; } 
    setFlourWeight(Math.round(parseFloat(val) / (totals.totalPercent / 100))); 
  };

  const handleFlourWeightChange = (v) => { 
    const val = v.replace(',', '.');
    setFlourWeight(val); 
    if (!val) { setTotalDough(""); return; } 
    setTotalDough(Math.round(parseFloat(val) * (totals.totalPercent / 100))); 
  };

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
            <InputField label="총 반죽량 (g)">
              <input type="text" inputMode="decimal" value={totalDough} onChange={(e) => handleTotalDoughChange(e.target.value)} placeholder="0" className="bg-transparent border-b border-black font-bold w-full pb-1 outline-none" />
            </InputField>
            <InputField label="밀가루량 (g)">
              <input type="text" inputMode="decimal" value={flourWeight} onChange={(e) => handleFlourWeightChange(e.target.value)} placeholder="0" className="bg-transparent border-b border-black font-bold w-full pb-1 outline-none" />
            </InputField>
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
                  const pctVal = parseFloat(String(ing.percent).replace(',', '.')) || 0;
                  const fWeight = parseFloat(String(flourWeight).replace(',', '.')) || 0;
                  
                  // 글자 수에 따른 동적 너비 계산 (최소 1글자 대응)
                  const inputSize = String(ing.percent).length || 1;

                  return (
                    <tr key={idx} className="border-b border-gray-200">
                      <td className="p-2">
                          <div className="text-[9px] text-gray-400 font-bold uppercase">{ing.type}</div>
                          <div className="font-black text-sm">{ing.name}</div>
                      </td>
                      <td className="p-2 text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          <input 
                            type="text"
                            inputMode="decimal"
                            value={ing.percent}
                            size={inputSize}
                            onChange={(e) => handlePercentChange(ing.name, e.target.value)}
                            style={{ minWidth: '1.5rem' }} // 최소 너비
                            className="bg-transparent border-b border-black/10 hover:border-black text-right font-mono text-sm font-bold outline-none transition-colors pb-1 h-auto"
                          />
                          <span className="font-mono text-xs font-bold text-gray-400">%</span>
                        </div>
                      </td>
                      <td className="p-2 text-right font-bold text-gray-400 text-sm">
                        {flourWeight ? Math.round(fWeight * (pctVal / 100)).toLocaleString() : 0}g
                      </td>
                    </tr>
                  );
                }) : <tr><td colSpan="3" className="p-12 text-center text-gray-400 text-xs tracking-widest uppercase">Select a recipe</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        {/* 나머지 컴포넌트(요약, 히스토리 등)는 동일하게 유지 */}
        <div className="space-y-6 order-2">
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

          <QuickTempEntry 
            tempLogs={tempLogs} 
            setTempLogs={setTempLogs} 
            currentProductName={currentRecipe?.productName} 
            memo={memo}
            setMemo={setMemo}
          />
        </div>
      </div>
    </main>
  );
}

// 아래는 기존 컴포넌트들 (변경 없음)
function QuickTempEntry({ tempLogs, setTempLogs, currentProductName, memo, setMemo }) {
  const [isEntryMode, setIsEntryMode] = useState(false);
  const [logType, setLogType] = useState("1차 저온");
  const [currentEntry, setCurrentEntry] = useState({});
  const items = ["날짜", "르방", "밀", "물", "결과", "오토리즈", "오토리즈완료", "반죽완료", "하바1", "하바2", "하바3", "하바4", "분할", "성형", "굽기"];

  const latestLog = useMemo(() => {
    return tempLogs.find(l => l.productName === currentProductName);
  }, [tempLogs, currentProductName]);

  const handleSave = () => {
    if (!currentProductName) return;
    const now = new Date();
    const newLog = { 
      id: Date.now(),
      productName: currentProductName,
      type: logType, 
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
        <select value={logType} onChange={(e) => setLogType(e.target.value)} className="bg-transparent font-black text-[10px] uppercase border-b border-black outline-none">
          <option>1차 저온</option><option>2차 저온</option>
        </select>
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
                    <input 
                      type="date" 
                      className="col-span-2 bg-white rounded p-1 text-right font-mono text-[10px] border border-gray-100 outline-none"
                      onChange={(e) => setCurrentEntry({ ...currentEntry, [item]: { ...currentEntry[item], t: e.target.value } })} 
                    />
                  ) : (
                    <>
                      <input placeholder="°C" type="text" inputMode="decimal" className="bg-white rounded p-1 text-right font-mono text-[10px] border border-gray-100" 
                        onChange={(e) => setCurrentEntry({ ...currentEntry, [item]: { ...currentEntry[item], t: e.target.value.replace(',', '.') } })} />
                      {item !== "밀" ? (
                        <input placeholder="pH" type="text" inputMode="decimal" className="bg-white rounded p-1 text-right font-mono text-[10px] border border-gray-100" 
                          onChange={(e) => setCurrentEntry({ ...currentEntry, [item]: { ...currentEntry[item], p: e.target.value.replace(',', '.') } })} />
                      ) : <div />}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="pt-2">
            <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block tracking-widest">Memo</label>
            <textarea 
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="w-full bg-white/50 border border-black/5 rounded-lg p-3 text-xs leading-5 resize-none h-24 outline-none font-medium" 
              placeholder="Notes..." 
            />
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
                  {items.map(item => latestLog.data[item] && (latestLog.data[item].t || latestLog.data[item].p) ? (
                    <div key={item} className="flex justify-between border-b border-gray-50/50">
                      <span className="text-gray-400 font-bold uppercase">{item}</span>
                      <span className="font-mono">{latestLog.data[item].t}{latestLog.data[item].t && item !== "날짜" ? "°" : ""}{latestLog.data[item].p ? `/${latestLog.data[item].p}p` : ""}</span>
                    </div>
                  ) : null)}
                </div>
              </div>
              {latestLog.memo && (
                <div className="bg-white/30 p-3 rounded-lg border-l-2 border-black/10 text-[11px] font-medium text-gray-600 leading-relaxed">
                  {latestLog.memo}
                </div>
              )}
              {!isEntryMode && (
                <div className="pt-2 border-t border-dashed border-black/10">
                   <textarea 
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    className="w-full bg-transparent border-none outline-none text-[11px] leading-5 resize-none h-16 font-medium" 
                    placeholder="Quick memo..." 
                  />
                </div>
              )}
            </>
          ) : (
            <>
              <p className="text-center py-2 text-[10px] text-gray-400 font-bold uppercase tracking-widest border-b border-dashed border-black/10 mb-2">No records</p>
              <textarea 
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                className="w-full bg-transparent border-none outline-none text-[11px] leading-5 resize-none h-24 font-medium" 
                placeholder="Write notes here..." 
              />
            </>
          )}
        </div>
      )}
    </SummaryCard>
  );
}

function TempPhDB({ tempLogs, setTempLogs }) {
  const items = ["날짜", "르방", "밀", "물", "결과", "오토리즈", "오토리즈완료", "반죽완료", "하바1", "하바2", "하바3", "하바4", "분할", "성형", "굽기"];
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedProduct, setExpandedProduct] = useState(null);
  const [expandedDate, setExpandedDate] = useState({});

  const groupedLogs = useMemo(() => {
    const groups = {};
    const filtered = tempLogs.filter(log => 
      log.productName.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    filtered.forEach(log => {
      if (!groups[log.productName]) groups[log.productName] = {};
      const dateKey = log.timestamp || log.displayTime?.split(',')[0] || "날짜 미지정";
      if (!groups[log.productName][dateKey]) groups[log.productName][dateKey] = [];
      groups[log.productName][dateKey].push(log);
    });
    return groups;
  }, [tempLogs, searchTerm]);

  const toggleDate = (productName, date) => {
    setExpandedDate(prev => ({
      ...prev,
      [productName]: prev[productName] === date ? null : date
    }));
  };

  return (
    <main className="max-w-6xl mx-auto px-4 md:px-8 text-black">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b-2 border-black pb-4 mb-8 gap-4">
        <h1 className="text-3xl md:text-4xl font-black tracking-tighter uppercase">History</h1>
        <div className="w-full md:w-64">
          <input 
            type="text" placeholder="Search product..." value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-full px-4 py-2 text-sm outline-none shadow-inner"
          />
        </div>
      </div>
      
      <div className="space-y-4">
        {Object.entries(groupedLogs).length > 0 ? (
          Object.entries(groupedLogs).map(([productName, dateGroups]) => {
            const isExpanded = expandedProduct === productName;
            const sortedDates = Object.entries(dateGroups).sort(([a], [b]) => new Date(b) - new Date(a));
            const activeDate = expandedDate[productName] || (sortedDates.length > 0 ? sortedDates[0][0] : null);

            return (
              <div key={productName} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm transition-all">
                <div 
                  onClick={() => setExpandedProduct(isExpanded ? null : productName)}
                  className="p-5 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Product</div>
                    <div className="text-xl font-black tracking-tighter uppercase">{productName}</div>
                  </div>
                  <div className="text-right text-gray-400">
                    <span className="text-[10px] font-black uppercase mr-2">{sortedDates.length} Days</span>
                    <span className="text-xs">{isExpanded ? "▲" : "▼"}</span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-5 pb-5 bg-[#fcfcfb]">
                    {sortedDates.map(([date, logs]) => {
                      const isDateExpanded = activeDate === date;
                      return (
                        <div key={date} className="border-t border-gray-100 last:border-b-0">
                          <div 
                            onClick={() => toggleDate(productName, date)}
                            className="py-4 flex justify-between items-center cursor-pointer group"
                          >
                            <div className="flex items-center gap-3">
                              <span className={`text-[11px] font-black uppercase tracking-tighter ${isDateExpanded ? 'text-black' : 'text-gray-400'}`}>
                                📅 {date} {sortedDates[0][0] === date && " (LATEST)"}
                              </span>
                              {!isDateExpanded && <span className="text-[9px] text-gray-300 font-bold uppercase tracking-widest">[{logs.length} records]</span>}
                            </div>
                            <span className="text-[10px] text-gray-300 group-hover:text-black transition-colors uppercase font-black">
                              {isDateExpanded ? "Hide" : "Details"}
                            </span>
                          </div>

                          {isDateExpanded && (
                            <div className="pb-6 animate-in fade-in slide-in-from-top-1 duration-200">
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {logs.sort((a, b) => b.id - a.id).map(log => (
                                  <div key={log.id} className="bg-white p-5 rounded-xl border border-gray-100 relative shadow-sm hover:border-black/10 transition-all">
                                    <div className="mb-4 flex justify-between items-start">
                                      <div>
                                          <span className="text-[9px] font-black text-gray-400 uppercase bg-gray-100 px-1.5 py-0.5 rounded">{log.type}</span>
                                          <div className="font-bold text-[10px] mt-1 text-gray-400">{log.displayTime?.split(',')[1] || ""}</div>
                                      </div>
                                      <button onClick={() => confirm("삭제하시겠습니까?") && setTempLogs(tempLogs.filter(l => l.id !== log.id))} className="text-gray-300 hover:text-red-500 transition-colors text-xs">✕</button>
                                    </div>
                                    <div className="space-y-1">
                                      {items.map(item => log.data[item] && (log.data[item].t || log.data[item].p) ? (
                                        <div key={item} className="flex justify-between text-[11px] border-b border-gray-50 pb-0.5">
                                          <span className="font-bold text-gray-400 uppercase">{item}</span>
                                          <span className="font-mono text-black">
                                            {log.data[item].t && `${log.data[item].t}${item !== "날짜" ? "°" : ""}`} {log.data[item].p && `/ ${log.data[item].p}p`}
                                          </span>
                                        </div>
                                      ) : null)}
                                    </div>
                                    {log.memo && <div className="mt-3 pt-2 border-t border-dashed text-[10px] font-medium text-gray-500 whitespace-pre-wrap leading-relaxed">{log.memo}</div>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="py-20 text-center text-gray-400 font-bold uppercase text-xs tracking-widest">No history found</div>
        )}
      </div>
    </main>
  );
}

function RecipeDB({ recipes, setRecipes }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingRecipe, setEditingRecipe] = useState(null);

  const displayedRecipes = recipes.filter(r => r.productName.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleEdit = (recipe) => { setEditingRecipe(recipe); setIsModalOpen(true); };
  const handleAdd = () => { setEditingRecipe(null); setIsModalOpen(true); };

  const handleDelete = (e, id) => {
    e.stopPropagation();
    if (confirm("이 레시피를 영구적으로 삭제하시겠습니까?")) {
      setRecipes(recipes.filter(r => r.id !== id));
    }
  };

  return (
    <main className="max-w-6xl mx-auto px-4 md:px-8 text-black">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b-2 border-black pb-4 mb-6 gap-4">
        <h1 className="text-3xl md:text-4xl font-black tracking-tighter uppercase">Recipe DB</h1>
        <div className="flex gap-2 w-full md:w-auto">
          <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex-1 md:w-48 bg-white border border-gray-200 rounded-full px-4 py-2 text-sm outline-none shadow-inner" />
          <button onClick={handleAdd} className="bg-black text-white px-6 py-2 rounded-full font-bold text-sm uppercase tracking-tighter">+ Add</button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {displayedRecipes.map(recipe => (
          <div key={recipe.id} onClick={() => handleEdit(recipe)} className="bg-white p-5 rounded-2xl border border-gray-100 flex justify-between items-center active:scale-[0.98] transition-all cursor-pointer hover:border-black group relative">
            <div>
              <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{recipe.category}</div>
              <div className="text-xl font-black tracking-tighter uppercase">{recipe.productName}</div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-gray-300 text-sm font-black tracking-tighter uppercase">Edit 〉</span>
              <button onClick={(e) => handleDelete(e, recipe.id)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors">
                ✕
              </button>
            </div>
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

  const updateIng = (i, f, v) => setIngredients(ingredients.map((ing, idx) => {
    if (idx === i) {
      const newVal = (f === "percent" || f === "cost") ? v.replace(',', '.') : v;
      return { ...ing, [f]: newVal };
    }
    return ing;
  }));

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-[#f7f6f3] w-full max-w-4xl rounded-[2rem] p-6 md:p-12 shadow-2xl max-h-[90vh] overflow-y-auto relative">
        <button onClick={onClose} className="absolute top-6 right-6 text-xl">✕</button>
        <h2 className="text-2xl md:text-3xl font-black tracking-tighter mb-8 uppercase">Recipe Editor</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <InputField label="분류">
            <select value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-transparent border-b-2 border-black py-2 outline-none font-bold">
              <option value="하드계열">하드계열</option>
              <option value="소프트계열">소프트계열</option>
              <option value="사전반죽">사전반죽</option>
            </select>
          </InputField>
          <InputField label="제품명">
            <input value={productName} onChange={e => setProductName(e.target.value)} className="w-full bg-transparent border-b-2 border-black py-2 outline-none font-bold" />
          </InputField>
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