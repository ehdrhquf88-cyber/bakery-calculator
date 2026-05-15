"use client";

import { useState, useEffect, useMemo } from "react";

// --- 스타일 보존을 위해 기존 레이아웃 구조를 유지하며 버그만 수정된 코드 ---

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

// --- 레시피 DB 리스트: 레이아웃 깨짐 방지 수정 ---
function RecipeDB({ recipes, setRecipes }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingRecipe, setEditingRecipe] = useState(null);

  const displayedRecipes = recipes.filter(r => r.productName.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleDelete = (e, id) => {
    e.stopPropagation();
    if (window.confirm("이 레시피를 삭제하시겠습니까?")) {
      setRecipes(recipes.filter(r => r.id !== id));
    }
  };

  return (
    <main className="max-w-6xl mx-auto px-4 md:px-8 text-black">
      <div className="flex justify-between items-end border-b-2 border-black pb-6 mb-8">
        <div>
          <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter uppercase">Recipe Vault</h1>
          <p className="text-[10px] font-black text-gray-400 mt-1 uppercase tracking-[0.2em]">Stored Professional Formulas</p>
        </div>
        <div className="flex gap-3">
            <input 
                type="text" placeholder="Search..." 
                value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                className="hidden md:block bg-white border border-gray-200 rounded-full px-5 py-2 text-sm outline-none w-48 focus:border-black transition-all"
            />
            <button onClick={() => { setEditingRecipe(null); setIsModalOpen(true); }} className="bg-black text-white px-8 py-3 rounded-full font-black text-xs hover:scale-105 transition-transform shadow-lg uppercase tracking-widest">+ Create</button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {displayedRecipes.map(recipe => (
          <div 
            key={recipe.id} 
            onClick={() => { setEditingRecipe(recipe); setIsModalOpen(true); }} 
            className="group bg-white p-5 md:p-7 rounded-[2rem] border border-gray-100 flex flex-row justify-between items-center cursor-pointer hover:border-black hover:shadow-xl transition-all relative overflow-hidden"
          >
            {/* 텍스트 영역: 내용이 길어져도 버튼을 밀지 않도록 flex-1 설정 */}
            <div className="flex items-center gap-6 z-10 flex-1 min-w-0">
                <div className="w-14 h-14 bg-[#f7f6f3] rounded-2xl flex-shrink-0 flex items-center justify-center font-black text-xs italic text-black group-hover:bg-black group-hover:text-white transition-colors uppercase">
                    {recipe.category.substring(0,2)}
                </div>
                <div className="min-w-0">
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{recipe.category}</div>
                    <div className="text-2xl md:text-3xl font-black italic tracking-tighter group-hover:text-black transition-colors truncate">
                        {recipe.productName}
                    </div>
                </div>
            </div>

            {/* 버튼 영역: 위치 고정을 위해 flex-shrink-0 설정 */}
            <div className="flex items-center gap-4 md:gap-8 ml-4 z-10 flex-shrink-0">
                <div className="hidden sm:block text-right">
                    <div className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Formula</div>
                    <div className="text-base font-black italic">{recipe.ingredients.length} Ing.</div>
                </div>
                <button 
                    onClick={(e) => handleDelete(e, recipe.id)}
                    className="p-3 px-5 rounded-2xl text-[10px] font-black text-gray-300 border border-gray-100 hover:border-red-500 hover:bg-red-500 hover:text-white transition-all uppercase tracking-widest"
                >
                    Delete
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

// --- 나머지 컴포넌트(RecipeCalculator, RecipeModal 등)는 기존 스타일과 레이아웃을 100% 동일하게 유지합니다 ---
// (생략된 부분은 이전 버전의 코드를 그대로 사용하시면 됩니다)