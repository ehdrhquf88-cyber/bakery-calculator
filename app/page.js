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

// --- 레시피 계산기 ---
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
    if (!currentRecipe) return { totalPercent: 0, totalSaltPercent: 0, finalYield: 0, totalCost: 0, totalWeight: 0 };
    
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
        const pfFlour = pct / (1 + yieldInput / 100);
        const pfWater = pfFlour * (yieldInput / 100);
        totalFlourPct += pfFlour; 
        totalWaterPct += pfWater;
      }
    });

    const finalYield = totalFlourPct > 0 ? (totalWaterPct / totalFlourPct) * 100 : 0;
    const fWeight = parseFloat(String(flourWeight).replace(',', '.')) || 0;
    
    const cost = currentRecipe.ingredients.reduce((sum, ing) => {
        const pctVal = parseFloat(String(ing.percent).replace(',', '.')) || 0;
        const weight = fWeight * (pctVal / 100);
        return sum + (weight * (parseFloat(String(ing.cost).replace(',', '.')) || 0));
    }, 0);

    return { 
      totalPercent: rawTotalPercent, 
      totalSaltPercent: totalSaltPct, 
      finalYield, 
      totalCost: cost,
      totalWeight: fWeight * (rawTotalPercent / 100)
    };
  }, [currentRecipe, pfYields, flourWeight]);

  const handleTotalDoughChange = (v) => { 
    const val = v.replace(',', '.');
    setTotalDough(val); 
    if (!val || totals.totalPercent === 0) { setFlourWeight(""); return; } 
    setFlourWeight((parseFloat(val) / (totals.totalPercent / 100)).toFixed(1)); 
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
        <section className="bg-white rounded-2xl p-5 md:p-6 shadow-lg border border-gray-100 order-1">
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
          {/* 요약 섹션 복구 및 보강 */}
          <SummaryCard title="Total Summary">
            <div className="space-y-1">
                <SummaryRow label="총 반죽량" value={`${Math.round(totals.totalWeight).toLocaleString()} g`} />
                <SummaryRow label="총 수율 (사전반죽 포함)" value={`${totals.finalYield.toFixed(1)} %`} />
                <SummaryRow label="총 소금 (%)" value={`${totals.totalSaltPercent} %`} />
                <SummaryRow label="총 예상 원가" value={`₩ ${Math.round(totals.totalCost).toLocaleString()}`} />
            </div>
          </SummaryCard>

          {preFerments.length > 0 && (
            <SummaryCard title="사전반죽 수율 설정">
              <div className="space-y-3">
                {preFerments.map(pf => (
                  <div key={pf.name} className="flex justify-between items-center border-b border-black/5 pb-2">
                    <span className="text-xs font-bold italic">{pf.name} 수율</span>
                    <input 
                      type="text" inputMode="decimal"
                      value={pfYields[pf.name] || ""} 
                      onChange={(e) => setPfYields({ ...pfYields, [pf.name]: e.target.value.replace(',', '.') })}
                      className="w-20 bg-white border border-gray-200 rounded px-2 py-1 text-right font-mono text-sm outline-none"
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

// --- 레시피 DB (레이아웃 복구 및 삭제 추가) ---
function RecipeDB({ recipes, setRecipes }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingRecipe, setEditingRecipe] = useState(null);

  const displayedRecipes = recipes.filter(r => r.productName.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleDelete = (e, id) => {
    e.stopPropagation();
    if (confirm("이 레시피를 영구적으로 삭제하시겠습니까?")) {
      setRecipes(recipes.filter(r => r.id !== id));
    }
  };

  return (
    <main className="max-w-6xl mx-auto px-4 md:px-8 text-black">
      <div className="flex justify-between items-end border-b-2 border-black pb-4 mb-8">
        <h1 className="text-4xl font-black italic tracking-tighter uppercase text-black">Recipe Database</h1>
        <div className="flex gap-4">
            <input 
                type="text" placeholder="Search..." 
                value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                className="hidden md:block bg-white border border-gray-200 rounded-full px-4 py-2 text-sm outline-none w-48"
            />
            <button onClick={() => { setEditingRecipe(null); setIsModalOpen(true); }} className="bg-black text-white px-8 py-2 rounded-full font-bold text-sm hover:scale-105 transition-transform">+ NEW</button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {displayedRecipes.length > 0 ? displayedRecipes.map(recipe => (
          <div 
            key={recipe.id} 
            onClick={() => { setEditingRecipe(recipe); setIsModalOpen(true); }} 
            className="group bg-white p-6 rounded-[1.5rem] border border-gray-100 flex justify-between items-center cursor-pointer hover:border-black hover:shadow-xl transition-all"
          >
            <div className="flex items-center gap-6">
                <div className="w-12 h-12 bg-[#f7f6f3] rounded-full flex items-center justify-center font-black text-xs italic text-gray-400">
                    {recipe.category.substring(0,2)}
                </div>
                <div>
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{recipe.category}</div>
                    <div className="text-2xl font-black italic tracking-tighter group-hover:text-amber-600 transition-colors">{recipe.productName}</div>
                </div>
            </div>
            <div className="flex items-center gap-6">
                <div className="text-right hidden md:block">
                    <div className="text-[9px] font-bold text-gray-300 uppercase">Ingredients</div>
                    <div className="text-sm font-bold">{recipe.ingredients.length} items</div>
                </div>
                <button 
                    onClick={(e) => handleDelete(e, recipe.id)}
                    className="p-2 px-4 rounded-full text-[10px] font-black text-red-400 border border-red-50 hover:bg-red-500 hover:text-white transition-all uppercase"
                >
                    Delete
                </button>
            </div>
          </div>
        )) : (
            <div className="py-20 text-center border-2 border-dashed border-gray-200 rounded-[2rem] text-gray-400 italic">
                저장된 레시피가 없습니다. 새로운 레시피를 추가해 보세요.
            </div>
        )}
      </div>

      {isModalOpen && <RecipeModal initialData={editingRecipe} onSave={(data) => {
        if (editingRecipe) setRecipes(recipes.map(r => r.id === editingRecipe.id ? { ...data, id: r.id } : r));
        else setRecipes([...recipes, { ...data, id: Date.now() }]);
        setIsModalOpen(false);
      }} onClose={() => setIsModalOpen(false)} />}
    </main>
  );
}

// --- 레시피 에디터 모달 (유지) ---
function RecipeModal({ initialData, onSave, onClose }) {
  const [category, setCategory] = useState(initialData?.category || "하드계열");
  const [productName, setProductName] = useState(initialData?.productName || "");
  const [ingredients, setIngredients] = useState(initialData?.ingredients || [{ type: "밀", name: "", percent: "", cost: "" }]);
  const updateIng = (i, f, v) => setIngredients(ingredients.map((ing, idx) => idx === i ? { ...ing, [f]: (f === "percent" || f === "cost") ? v.replace(',', '.') : v } : ing));

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-[#f7f6f3] w-full max-w-4xl rounded-[2.5rem] p-6 md:p-12 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar relative border border-white/20">
        <button onClick={onClose} className="absolute top-8 right-8 text-2xl font-light hover:rotate-90 transition-transform">✕</button>
        <h2 className="text-4xl font-black italic tracking-tighter mb-10 uppercase">Recipe Editor</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          <InputField label="Category Selection"><select value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-transparent border-b-2 border-black py-3 outline-none font-bold text-lg"><option value="하드계열">하드계열</option><option value="소프트계열">소프트계열</option><option value="사전반죽">사전반죽</option></select></InputField>
          <InputField label="Product Name"><input value={productName} onChange={e => setProductName(e.target.value)} placeholder="이름을 입력하세요" className="w-full bg-transparent border-b-2 border-black py-3 outline-none font-bold text-lg" /></InputField>
        </div>
        <div className="space-y-4">
          {ingredients.map((ing, i) => (
            <div key={i} className="grid grid-cols-[110px_1fr_80px_100px_40px] gap-3 items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-50">
              <select value={ing.type} onChange={e => updateIng(i, "type", e.target.value)} className="bg-gray-50 p-2 rounded-xl text-[11px] font-black uppercase"><option>밀</option><option>수분</option><option>사전반죽</option><option>소금</option><option>기타</option></select>
              <input value={ing.name} onChange={e => updateIng(i, "name", e.target.value)} className="bg-gray-50 p-2 rounded-xl text-sm font-bold" placeholder="재료명" />
              <div className="relative"><input value={ing.percent} onChange={e => updateIng(i, "percent", e.target.value)} className="bg-gray-100 p-2 rounded-xl text-sm font-mono text-right w-full pr-6" placeholder="0" /><span className="absolute right-2 top-2.5 text-[10px] opacity-30">%</span></div>
              <div className="relative"><input value={ing.cost} onChange={e => updateIng(i, "cost", e.target.value)} className="bg-gray-100 p-2 rounded-xl text-sm font-mono text-right w-full pr-6" placeholder="0" /><span className="absolute right-2 top-2.5 text-[10px] opacity-30">₩</span></div>
              <button onClick={() => setIngredients(ingredients.filter((_, idx) => idx !== i))} className="text-gray-300 hover:text-red-500 transition-colors">✕</button>
            </div>
          ))}
          <button onClick={() => setIngredients([...ingredients, { type: "밀", name: "", percent: "", cost: "" }])} className="w-full py-5 border-2 border-dashed border-gray-300 rounded-2xl text-gray-400 font-black italic hover:border-black hover:text-black transition-all">+ ADD INGREDIENT</button>
        </div>
        <div className="mt-12 flex gap-4"><button onClick={onClose} className="flex-1 bg-white border border-gray-200 py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-sm">Cancel</button><button onClick={() => onSave({ category, productName, ingredients })} className="flex-1 bg-black text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-gray-900 transition-colors">Save to Database</button></div>
      </div>
    </div>
  );
}

// --- 공통 컴포넌트 ---
function InputField({ label, children }) { return (<div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">{label}</label>{children}</div>); }
function SummaryCard({ title, children }) { return (<div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"><h2 className="text-xl font-black italic tracking-tighter border-b-2 border-black pb-2 mb-6 uppercase">{title}</h2>{children}</div>); }
function SummaryRow({ label, value }) { return (<div className="flex justify-between items-end border-b border-gray-50 pb-3 mb-3"><span className="text-[11px] font-bold text-gray-400 uppercase tracking-tight">{label}</span><span className="font-mono font-black text-lg italic">{value}</span></div>); }

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
    <SummaryCard title="Log Entry">
      <div className="flex justify-between items-center mb-4">
        <select value={logType} onChange={(e) => setLogType(e.target.value)} className="bg-transparent font-black text-[10px] border-b border-black outline-none uppercase">
          <option>1차 저온</option><option>2차 저온</option>
        </select>
        <button onClick={() => setIsEntryMode(!isEntryMode)} className="text-[10px] font-black underline uppercase">{isEntryMode ? "닫기" : "+ 입력"}</button>
      </div>
      {isEntryMode && (
        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1 no-scrollbar animate-in fade-in duration-300">
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
          <textarea value={memo} onChange={(e) => setMemo(e.target.value)} className="w-full bg-white border border-gray-100 rounded-xl p-3 text-xs italic h-24 outline-none focus:border-black" placeholder="특이사항..." />
          <button onClick={handleSave} className="w-full bg-black text-white py-3 rounded-xl font-bold text-xs uppercase shadow-lg">Save to History</button>
        </div>
      )}
    </SummaryCard>
  );
}

// --- 온도/pH 히스토리 DB (나열형 UI 유지) ---
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
        <h1 className="text-4xl font-black italic tracking-tighter uppercase">Process History</h1>
        <input 
            type="text" placeholder="Search product..." 
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
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Archive</span>
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
            {selectedLog && (
              <div className="space-y-8 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex justify-between items-start">
                    <h3 className="text-2xl font-black italic tracking-tighter uppercase mb-1">{selectedLog.timestamp} Data Listing</h3>
                    <button onClick={() => confirm("삭제하시겠습니까?") && onDelete(selectedLog.id)} className="text-[10px] font-black text-red-400 underline uppercase">Delete Record</button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                  {items.map(item => {
                    const hasData = selectedLog.data[item]?.t || selectedLog.data[item]?.p;
                    return (
                      <div key={item} className={`p-4 rounded-2xl border transition-all ${hasData ? 'bg-white border-black shadow-sm' : 'bg-gray-50/50 border-gray-100 opacity-40'}`}>
                        <div className="text-[10px] font-black text-gray-400 uppercase mb-3 border-b border-gray-50 pb-1">{item}</div>
                        <div className="space-y-1">
                          <div className="flex justify-between items-end"><span className="text-[9px] font-bold text-gray-300 uppercase">Temp</span><span className="text-lg font-black font-mono italic leading-none">{selectedLog.data[item]?.t ? `${selectedLog.data[item].t}°` : '--'}</span></div>
                          {item !== "밀" && (<div className="flex justify-between items-end"><span className="text-[9px] font-bold text-gray-300 uppercase">pH</span><span className={`text-lg font-black font-mono italic leading-none ${selectedLog.data[item]?.p ? 'text-amber-500' : ''}`}>{selectedLog.data[item]?.p ? `${selectedLog.data[item].p}p` : '--'}</span></div>)}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {selectedLog.memo && (<div className="bg-[#f7f6f3] p-6 rounded-3xl border border-white"><span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Notes</span><p className="text-sm italic text-gray-600 whitespace-pre-wrap">{selectedLog.memo}</p></div>)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}