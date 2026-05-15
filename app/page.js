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
        {view === "calc" && <RecipeCalculator recipes={recipes} tempLogs={tempLogs} setTempLogs={setTempLogs} />}
        {view === "db" && <RecipeDB recipes={recipes} setRecipes={setRecipes} />}
        {view === "temp_db" && <TempPhDB tempLogs={tempLogs} setTempLogs={setTempLogs} />}
      </div>
    </div>
  );
}

function NavButton({ active, onClick, children }) {
  return (
    <button onClick={onClick} className={`text-sm md:text-lg font-black italic tracking-tighter transition-all px-2 ${active ? 'text-black border-b-2 border-black' : 'text-gray-400 hover:text-gray-600'}`}>{children}</button>
  );
}

// --- 레시피 계산기 (기본 기능 유지) ---
function RecipeCalculator({ recipes, tempLogs, setTempLogs }) {
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

  const totals = useMemo(() => {
    if (!currentRecipe) return { totalPercent: 0, totalSaltPercent: 0, finalYield: 0, totalCost: 0 };
    let totalFlourPct = 0; let totalWaterPct = 0; let totalSaltPct = 0; let rawTotalPercent = 0;

    currentRecipe.ingredients.forEach(ing => {
      const pct = parseFloat(String(ing.percent).replace(',', '.')) || 0;
      rawTotalPercent += pct;
      if (ing.type === "밀") totalFlourPct += pct;
      else if (ing.type === "수분") totalWaterPct += pct;
      else if (ing.type === "소금") totalSaltPct += pct;
      else if (ing.type === "사전반죽") {
        const yieldInput = parseFloat(String(pfYields[ing.name] || "100").replace(',', '.')) || 100;
        const pfFlour = pct / (1 + yieldInput / 100);
        const pfWater = pfFlour * (yieldInput / 100);
        totalFlourPct += pfFlour; totalWaterPct += pfWater;
      }
    });

    const finalYield = totalFlourPct > 0 ? (totalWaterPct / totalFlourPct) * 100 : 0;
    const cost = currentRecipe.ingredients.reduce((sum, ing) => {
        const pctVal = parseFloat(String(ing.percent).replace(',', '.')) || 0;
        const weight = flourWeight ? (parseFloat(String(flourWeight).replace(',', '.')) * (pctVal / 100)) : 0;
        return sum + (weight * (parseFloat(String(ing.cost).replace(',', '.')) || 0));
    }, 0);

    return { totalPercent: rawTotalPercent, totalSaltPercent: totalSaltPct, finalYield, totalCost: cost };
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
            <h1 className="text-3xl md:text-4xl font-black italic tracking-tighter truncate">
              {currentRecipe ? currentRecipe.productName : "계산기"}
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
              <input type="text" inputMode="decimal" value={totalDough} onChange={(e) => handleTotalDoughChange(e.target.value)} placeholder="0" className="bg-transparent border-b border-black font-bold italic w-full pb-1 outline-none" />
            </InputField>
            <InputField label="밀가루량 (g)">
              <input type="text" inputMode="decimal" value={flourWeight} onChange={(e) => handleFlourWeightChange(e.target.value)} placeholder="0" className="bg-transparent border-b border-black font-bold italic w-full pb-1 outline-none" />
            </InputField>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full mt-4 italic min-w-[300px]">
              <thead>
                <tr className="border-y border-black text-[10px] text-gray-400 uppercase tracking-widest">
                  <th className="p-2 text-left">재료</th><th className="p-2 text-right w-16">%</th><th className="p-2 text-right w-24">g</th>
                </tr>
              </thead>
              <tbody>
                {currentRecipe ? currentRecipe.ingredients.map((ing, idx) => {
                  const pctVal = parseFloat(String(ing.percent).replace(',', '.')) || 0;
                  const fWeight = parseFloat(String(flourWeight).replace(',', '.')) || 0;
                  return (
                    <tr key={idx} className="border-b border-gray-200">
                      <td className="p-2">
                          <div className="text-[9px] text-gray-400 font-bold uppercase">{ing.type}</div>
                          <div className="font-black text-sm">{ing.name}</div>
                      </td>
                      <td className="p-2 text-right font-mono text-sm">{ing.percent}%</td>
                      <td className="p-2 text-right font-bold text-gray-400 text-sm">
                        {flourWeight ? Math.round(fWeight * (pctVal / 100)).toLocaleString() : 0}g
                      </td>
                    </tr>
                  );
                }) : <tr><td colSpan="3" className="p-12 text-center text-gray-400 text-xs italic">제품을 선택해 주세요.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
        <div className="space-y-6 order-2">
          <SummaryCard title="요약">
            <SummaryRow label="수율" value={`${totals.finalYield.toFixed(1)}%`} />
            <SummaryRow label="소금" value={`${totals.totalSaltPercent}%`} />
            <SummaryRow label="원가" value={`₩${Math.round(totals.totalCost).toLocaleString()}`} />
          </SummaryCard>
          {preFerments.length > 0 && (
            <SummaryCard title="사전반죽 수율">
              <div className="space-y-3">
                {preFerments.map(pf => (
                  <div key={pf.name} className="flex justify-between items-center border-b border-black/5 pb-2">
                    <span className="text-sm font-bold italic">{pf.name}</span>
                    <input 
                      type="text" inputMode="decimal"
                      value={pfYields[pf.name] || ""} 
                      onChange={(e) => setPfYields({ ...pfYields, [pf.name]: e.target.value.replace(',', '.') })}
                      className="w-16 bg-white border border-gray-200 rounded px-2 py-1 text-right font-mono text-xs outline-none"
                      placeholder="100"
                    />
                  </div>
                ))}
              </div>
            </SummaryCard>
          )}
          <QuickTempEntry tempLogs={tempLogs} setTempLogs={setTempLogs} currentProductName={currentRecipe?.productName} memo={memo} setMemo={setMemo} />
        </div>
      </div>
    </main>
  );
}

function QuickTempEntry({ tempLogs, setTempLogs, currentProductName, memo, setMemo }) {
  const [isEntryMode, setIsEntryMode] = useState(false);
  const [logType, setLogType] = useState("1차 저온");
  const [currentEntry, setCurrentEntry] = useState({});
  const items = ["날짜", "르방", "밀", "물", "결과", "오토리즈", "오토리즈완료", "반죽완료", "하바1", "하바2", "하바3", "하바4", "분할", "성형", "굽기"];

  const handleSave = () => {
    if (!currentProductName) return;
    const now = new Date();
    const newLog = { 
      id: Date.now(),
      productName: currentProductName,
      type: logType, 
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

  if (!currentProductName) return <SummaryCard title="기록"><p className="text-center py-4 text-xs text-gray-400">제품을 선택하세요.</p></SummaryCard>;

  return (
    <SummaryCard title="온도 / pH 기록">
      <div className="flex justify-between items-center mb-4">
        <select value={logType} onChange={(e) => setLogType(e.target.value)} className="bg-transparent font-black text-[10px] border-b border-black outline-none uppercase">
          <option>1차 저온</option><option>2차 저온</option>
        </select>
        <button onClick={() => setIsEntryMode(!isEntryMode)} className="text-[10px] font-black underline uppercase">{isEntryMode ? "닫기" : "+ 입력"}</button>
      </div>
      {isEntryMode && (
        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1 no-scrollbar">
          <div className="space-y-2">
            {items.map(item => (
              <div key={item} className="grid grid-cols-[1fr_120px] gap-2 items-center border-b border-black/5 pb-1">
                <span className="text-[11px] font-bold">{item}</span>
                <div className="grid grid-cols-2 gap-1">
                  {item === "날짜" ? <input type="date" className="col-span-2 bg-white rounded p-1 text-[10px] border border-gray-100" onChange={(e) => setCurrentEntry({ ...currentEntry, [item]: { ...currentEntry[item], t: e.target.value } })} /> : (
                    <>
                      <input placeholder="°C" type="text" inputMode="decimal" className="bg-white rounded p-1 text-[10px] border border-gray-100" onChange={(e) => setCurrentEntry({ ...currentEntry, [item]: { ...currentEntry[item], t: e.target.value.replace(',', '.') } })} />
                      {item !== "밀" ? <input placeholder="pH" type="text" inputMode="decimal" className="bg-white rounded p-1 text-[10px] border border-gray-100" onChange={(e) => setCurrentEntry({ ...currentEntry, [item]: { ...currentEntry[item], p: e.target.value.replace(',', '.') } })} /> : <div />}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
          <textarea value={memo} onChange={(e) => setMemo(e.target.value)} className="w-full bg-white/50 border border-black/5 rounded-lg p-3 text-xs italic h-24" placeholder="특이사항..." />
          <button onClick={handleSave} className="w-full bg-black text-white py-3 rounded-xl font-bold text-xs uppercase">Save to DB</button>
        </div>
      )}
    </SummaryCard>
  );
}

// --- 온도/pH 히스토리 DB (텍스트 나열형 UI) ---
function TempPhDB({ tempLogs, setTempLogs }) {
  const items = ["르방", "밀", "물", "결과", "오토리즈", "오토리즈완료", "반죽완료", "하바1", "하바2", "하바3", "하바4", "분할", "성형", "굽기"];
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedProduct, setExpandedProduct] = useState(null);
  const [selectedLogId, setSelectedLogId] = useState(null);

  const groupedLogs = useMemo(() => {
    const groups = {};
    const filtered = tempLogs.filter(log => log.productName.toLowerCase().includes(searchTerm.toLowerCase()));
    filtered.forEach(log => {
      if (!groups[log.productName]) groups[log.productName] = [];
      groups[log.productName].push(log);
    });
    return groups;
  }, [tempLogs, searchTerm]);

  return (
    <main className="max-w-7xl mx-auto px-4 md:px-8 text-black">
      <div className="flex justify-between items-end border-b-2 border-black pb-4 mb-8">
        <h1 className="text-4xl font-black italic tracking-tighter uppercase">Process Timeline</h1>
        <input 
            type="text" placeholder="제품명 검색..." 
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-white border border-gray-200 rounded-full px-4 py-2 text-sm outline-none"
        />
      </div>
      <div className="space-y-6">
        {Object.entries(groupedLogs).map(([productName, logs]) => (
          <ProductTimelineGroup 
            key={productName}
            productName={productName}
            logs={logs}
            items={items}
            isExpanded={expandedProduct === productName}
            onToggle={() => setExpandedProduct(expandedProduct === productName ? null : productName)}
            selectedLogId={selectedLogId}
            onSelectLog={setSelectedLogId}
            onDelete={(id) => setTempLogs(tempLogs.filter(l => l.id !== id))}
          />
        ))}
      </div>
    </main>
  );
}

function ProductTimelineGroup({ productName, logs, items, isExpanded, onToggle, selectedLogId, onSelectLog, onDelete }) {
  const selectedLog = logs.find(l => l.id === (selectedLogId || logs[0].id));

  return (
    <div className="bg-white rounded-[2rem] border border-gray-100 overflow-hidden shadow-sm">
      <div onClick={onToggle} className="p-6 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition-colors">
        <div>
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Master Logs</span>
          <h2 className="text-2xl font-black italic tracking-tighter uppercase">{productName}</h2>
        </div>
        <div className="flex items-center gap-4">
            <span className="text-xs font-bold text-gray-400 italic">{logs.length} Records</span>
            <span className="text-xl opacity-20">{isExpanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {isExpanded && (
        <div className="p-6 pt-0 bg-[#fcfcfb] border-t border-gray-50">
          <div className="mt-6 flex flex-col gap-6">
            
            {/* 상단: 날짜 탭 리스트 */}
            <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar border-b border-gray-100">
                {logs.map(log => (
                    <button 
                        key={log.id} 
                        onClick={() => onSelectLog(log.id)}
                        className={`px-5 py-2.5 rounded-full whitespace-nowrap text-xs font-bold transition-all ${selectedLogId === log.id || (!selectedLogId && log.id === logs[0].id) ? 'bg-black text-white shadow-lg' : 'bg-white border border-gray-200 text-gray-400 hover:border-black hover:text-black'}`}
                    >
                        {log.timestamp} <span className="opacity-50 ml-1">({log.type})</span>
                    </button>
                ))}
            </div>

            {/* 메인: 데이터 나열 영역 */}
            {selectedLog && (
              <div className="space-y-8 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="text-2xl font-black italic tracking-tighter uppercase mb-1">{selectedLog.timestamp} 세부 항목</h3>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Process Data Point Listing</p>
                    </div>
                    <button onClick={() => confirm("이 기록을 삭제하시겠습니까?") && onDelete(selectedLog.id)} className="text-xs font-bold text-red-400 underline uppercase">Delete Record</button>
                </div>

                {/* 데이터 그리드 나열 */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                  {items.map(item => {
                    const hasData = selectedLog.data[item]?.t || selectedLog.data[item]?.p;
                    return (
                      <div key={item} className={`p-4 rounded-2xl border transition-all ${hasData ? 'bg-white border-black shadow-sm' : 'bg-gray-50/50 border-gray-100 opacity-40'}`}>
                        <div className="text-[10px] font-black text-gray-400 uppercase mb-3 border-b border-gray-50 pb-1">{item}</div>
                        <div className="space-y-1">
                          <div className="flex justify-between items-end">
                            <span className="text-[9px] font-bold text-gray-300 uppercase">Temp</span>
                            <span className="text-lg font-black font-mono italic leading-none">{selectedLog.data[item]?.t ? `${selectedLog.data[item].t}°` : '--'}</span>
                          </div>
                          {item !== "밀" && (
                            <div className="flex justify-between items-end">
                              <span className="text-[9px] font-bold text-gray-300 uppercase">pH</span>
                              <span className={`text-lg font-black font-mono italic leading-none ${selectedLog.data[item]?.p ? 'text-amber-500' : ''}`}>
                                {selectedLog.data[item]?.p ? `${selectedLog.data[item].p}p` : '--'}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 메모 섹션 */}
                {selectedLog.memo && (
                    <div className="bg-[#f7f6f3] p-6 rounded-3xl border border-white">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Special Notes</span>
                        <p className="text-sm italic leading-relaxed text-gray-600 whitespace-pre-wrap">{selectedLog.memo}</p>
                    </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// --- 레시피 DB (기존 유지) ---
function RecipeDB({ recipes, setRecipes }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingRecipe, setEditingRecipe] = useState(null);
  const displayedRecipes = recipes.filter(r => r.productName.toLowerCase().includes(searchTerm.toLowerCase()));
  const handleEdit = (recipe) => { setEditingRecipe(recipe); setIsModalOpen(true); };
  const handleAdd = () => { setEditingRecipe(null); setIsModalOpen(true); };

  return (
    <main className="max-w-6xl mx-auto px-4 md:px-8 text-black">
      <div className="flex justify-between items-end border-b-2 border-black pb-4 mb-6">
        <h1 className="text-4xl font-black italic tracking-tighter uppercase">Recipe DB</h1>
        <button onClick={handleAdd} className="bg-black text-white px-6 py-2 rounded-full font-bold text-sm">+ 추가</button>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {displayedRecipes.map(recipe => (
          <div key={recipe.id} onClick={() => handleEdit(recipe)} className="bg-white p-5 rounded-2xl border border-gray-100 flex justify-between items-center cursor-pointer hover:border-black transition-all">
            <div><div className="text-[10px] font-black text-gray-400 uppercase">{recipe.category}</div><div className="text-xl font-black italic tracking-tighter">{recipe.productName}</div></div>
            <span className="text-gray-300 text-sm">Edit 〉</span>
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
      <div className="bg-[#f7f6f3] w-full max-w-4xl rounded-[2rem] p-6 md:p-12 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar relative">
        <button onClick={onClose} className="absolute top-8 right-8 text-2xl">✕</button>
        <h2 className="text-3xl font-black italic tracking-tighter mb-8 uppercase">Recipe Editor</h2>
        <div className="grid grid-cols-2 gap-4 mb-8">
          <InputField label="분류"><select value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-transparent border-b-2 border-black py-2 outline-none font-bold"><option value="하드계열">하드계열</option><option value="소프트계열">소프트계열</option><option value="사전반죽">사전반죽</option></select></InputField>
          <InputField label="제품명"><input value={productName} onChange={e => setProductName(e.target.value)} className="w-full bg-transparent border-b-2 border-black py-2 outline-none font-bold" /></InputField>
        </div>
        <div className="space-y-3">
          {ingredients.map((ing, i) => (
            <div key={i} className="grid grid-cols-[120px_1fr_80px_100px_40px] gap-4 items-center bg-white p-4 rounded-xl shadow-sm">
              <select value={ing.type} onChange={e => updateIng(i, "type", e.target.value)} className="bg-gray-50 p-2 rounded-lg text-xs font-bold"><option>밀</option><option>수분</option><option>사전반죽</option><option>소금</option><option>기타</option></select>
              <input value={ing.name} onChange={e => updateIng(i, "name", e.target.value)} className="bg-gray-50 p-2 rounded-lg text-xs" placeholder="재료명" />
              <input value={ing.percent} onChange={e => updateIng(i, "percent", e.target.value)} className="bg-gray-50 p-2 rounded-lg text-xs text-right" placeholder="%" />
              <input value={ing.cost} onChange={e => updateIng(i, "cost", e.target.value)} className="bg-gray-50 p-2 rounded-lg text-xs text-right" placeholder="단가" />
              <button onClick={() => setIngredients(ingredients.filter((_, idx) => idx !== i))} className="text-red-300">✕</button>
            </div>
          ))}
          <button onClick={() => setIngredients([...ingredients, { type: "밀", name: "", percent: "", cost: "" }])} className="w-full py-4 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 font-black">+ 재료 추가</button>
        </div>
        <div className="mt-10 flex gap-3"><button onClick={onClose} className="flex-1 bg-white border border-gray-200 py-4 rounded-xl font-bold uppercase">Close</button><button onClick={() => onSave({ category, productName, ingredients })} className="flex-1 bg-black text-white py-4 rounded-xl font-bold uppercase">Save Recipe</button></div>
      </div>
    </div>
  );
}

function InputField({ label, children }) { return (<div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">{label}</label>{children}</div>); }
function SummaryCard({ title, children }) { return (<div className="bg-[#f7f6f3] rounded-2xl p-5 md:p-6 shadow-lg border border-white/50"><h2 className="text-xl md:text-2xl font-black italic tracking-tighter border-b-2 border-black pb-2 mb-4 uppercase">{title}</h2>{children}</div>); }
function SummaryRow({ label, value }) { return (<div className="flex justify-between border-b border-dashed pb-2 text-sm mb-2"><span className="text-gray-600">{label}</span><span className="font-mono font-bold">{value}</span></div>); }