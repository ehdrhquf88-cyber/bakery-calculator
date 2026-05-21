import { useMemo, useState } from "react";

import { InputField } from "./common";

function parseNumber(value) {
  const rawValue = String(value || "").trim();
  const normalizedValue = rawValue.includes(".")
    ? rawValue.replace(/,/g, "")
    : rawValue.replace(/,(\d{3})\b/g, "$1").replace(",", ".");

  return parseFloat(normalizedValue.replace(/[^\d.]/g, ""));
}

function parsePackageUnit(value) {
  const rawValue = String(value || "").trim().toLowerCase();
  const amount = parseNumber(rawValue) || 1;

  if (rawValue.includes("kg")) return amount * 1000;
  if (rawValue.includes("g")) return amount;
  if (rawValue.includes("l") && !rawValue.includes("ml")) return amount * 1000;
  if (rawValue.includes("ml")) return amount;
  if (rawValue.includes("ea") || rawValue.includes("개")) return amount;

  return amount;
}

function formatUnitCost(purchasePrice, unit) {
  const price = parseNumber(purchasePrice);
  const packageAmount = parsePackageUnit(unit);
  if (!price || !packageAmount) return "";

  return String(Number((price / packageAmount).toFixed(4)));
}

export default function CostDB({ costItems, setCostItems }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingItem, setEditingItem] = useState(null);
  const [expandedCategory, setExpandedCategory] = useState(null);

  const displayedItems = useMemo(() => {
    const keyword = searchTerm.toLowerCase();
    return costItems.filter(item =>
      item.name.toLowerCase().includes(keyword) ||
      item.category.toLowerCase().includes(keyword) ||
      (item.supplier || "").toLowerCase().includes(keyword)
    );
  }, [costItems, searchTerm]);
  const groupedItems = useMemo(() => {
    return displayedItems.reduce((groups, item) => {
      const category = item.category || "미등록";
      if (!groups[category]) groups[category] = [];
      groups[category].push(item);
      return groups;
    }, {});
  }, [displayedItems]);

  const handleSave = (data) => {
    const itemData = {
      ...data,
      updatedAt: new Date().toISOString().slice(0, 10),
    };

    if (editingItem) {
      setCostItems(prev => prev.map(item => item.id === editingItem.id ? { ...itemData, id: item.id } : item));
    } else {
      setCostItems(prev => [...prev, { ...itemData, id: Date.now() }]);
    }

    setIsModalOpen(false);
  };

  return (
    <main className="max-w-6xl mx-auto px-4 md:px-8 text-black">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b-2 border-black pb-4 mb-6 gap-4">
        <h1 className="text-3xl md:text-4xl font-black tracking-tighter uppercase">Cost DB</h1>
        <div className="flex gap-2 w-full md:w-auto">
          <input type="text" placeholder="Search ingredient..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex-1 md:w-56 bg-white border border-gray-200 rounded-full px-4 py-2 text-sm outline-none shadow-inner" />
          <button onClick={() => { setEditingItem(null); setIsModalOpen(true); }} className="bg-black text-white px-6 py-2 rounded-full font-bold text-sm uppercase tracking-tighter">+ Add</button>
        </div>
      </div>

      <div className="space-y-3">
        {Object.entries(groupedItems).map(([category, items]) => {
          const isCategoryExpanded = expandedCategory === category;

          return (
            <div key={category} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              <button
                type="button"
                onClick={() => setExpandedCategory(isCategoryExpanded ? null : category)}
                className="w-full p-5 flex justify-between items-center text-left hover:bg-gray-50 transition-all"
              >
                <div>
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Category</div>
                  <div className="text-xl font-black tracking-tighter uppercase">{category}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">{items.length} items</span>
                  <span className="text-xs">{isCategoryExpanded ? "▲" : "▼"}</span>
                </div>
              </button>

              {isCategoryExpanded && (
                <div className="px-5 pb-5 bg-[#fcfcfb]">
                  <div className="grid grid-cols-1 gap-3 pt-4 border-t border-gray-100">
                    {items.map(item => (
                      <div key={item.id} onClick={() => { setEditingItem(item); setIsModalOpen(true); }} className="bg-white p-5 rounded-2xl border border-gray-100 flex justify-between items-center cursor-pointer hover:border-black group transition-all">
                        <div className="min-w-0">
                          <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{item.category}</div>
                          <div className="text-xl font-black tracking-tighter uppercase truncate">{item.name}</div>
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-bold text-gray-400 uppercase tracking-tight">
                            <span className="font-mono text-black">{item.cost || 0} / g</span>
                            {item.purchasePrice && <span>구매가격 {Number(item.purchasePrice).toLocaleString()}원</span>}
                            <span>{item.unit}</span>
                            {item.supplier && <span>{item.supplier}</span>}
                            {item.updatedAt && <span>{item.updatedAt}</span>}
                          </div>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); if (confirm("삭제하시겠습니까?")) setCostItems(prev => prev.filter(costItem => costItem.id !== item.id)); }} className="text-gray-300 hover:text-red-500">x</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              </div>
          );
        })}
      </div>

      {displayedItems.length === 0 && (
        <div className="bg-white/60 border border-dashed border-gray-200 rounded-2xl p-10 text-center text-xs font-bold text-gray-400 uppercase tracking-widest">
          No cost items
        </div>
      )}

      {isModalOpen && (
        <CostModal
          initialData={editingItem}
          onSave={handleSave}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </main>
  );
}

function CostModal({ initialData, onSave, onClose }) {
  const [category, setCategory] = useState(initialData?.category || "밀가루");
  const [name, setName] = useState(initialData?.name || "");
  const [purchasePrice, setPurchasePrice] = useState(initialData?.purchasePrice || "");
  const [unit, setUnit] = useState(initialData?.unit || "1g");
  const [supplier, setSupplier] = useState(initialData?.supplier || "");
  const [memo, setMemo] = useState(initialData?.memo || "");
  const cost = formatUnitCost(purchasePrice, unit) || initialData?.cost || "";

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSave({
      category,
      name: name.trim(),
      purchasePrice: String(purchasePrice).replace(/,/g, ""),
      unit: unit.trim(),
      cost,
      supplier: supplier.trim(),
      memo,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-[#f7f6f3] w-full max-w-2xl rounded-[2rem] p-6 md:p-10 shadow-2xl max-h-[90vh] overflow-y-auto relative">
        <button onClick={onClose} className="absolute top-6 right-6 text-xl">x</button>
        <h2 className="text-2xl md:text-3xl font-black tracking-tighter mb-8 uppercase">Cost Editor</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <InputField label="분류">
            <select value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-transparent border-b-2 border-black py-2 outline-none font-bold">
              <option>미등록</option>
              <option>밀가루</option>
              <option>유제품</option>
              <option>설탕류</option>
              <option>유지류</option>
              <option>견과류</option>
              <option>과일/필링</option>
              <option>초콜릿</option>
              <option>소금</option>
              <option>첨가물</option>
              <option>기타</option>
            </select>
          </InputField>
          <InputField label="재료명">
            <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-transparent border-b-2 border-black py-2 outline-none font-bold" />
          </InputField>
          <InputField label="구매가격">
            <input value={purchasePrice} onChange={e => setPurchasePrice(e.target.value.replace(/[^\d,]/g, ""))} className="w-full bg-transparent border-b-2 border-black py-2 outline-none font-mono font-bold text-right" type="text" inputMode="numeric" placeholder="6000" />
          </InputField>
          <InputField label="단위">
            <input value={unit} onChange={e => setUnit(e.target.value)} className="w-full bg-transparent border-b-2 border-black py-2 outline-none font-bold" placeholder="25kg" />
          </InputField>
          <InputField label="원가">
            <input value={cost} readOnly className="w-full bg-black/5 border-b-2 border-black/20 py-2 outline-none font-mono font-bold text-right text-gray-500 cursor-not-allowed" type="text" placeholder="자동계산" />
          </InputField>
          <InputField label="구매처">
            <input value={supplier} onChange={e => setSupplier(e.target.value)} className="w-full bg-transparent border-b-2 border-black py-2 outline-none font-bold" />
          </InputField>
        </div>

        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Memo</label>
          <textarea value={memo} onChange={e => setMemo(e.target.value)} className="w-full bg-white/50 border border-black/5 rounded-lg p-3 text-xs leading-5 resize-none h-24 outline-none font-medium" placeholder="Notes..." />
        </div>

        <div className="mt-8 flex gap-3">
          <button onClick={onClose} className="flex-1 bg-white border border-gray-200 py-4 rounded-xl font-bold uppercase tracking-tighter">Close</button>
          <button onClick={handleSubmit} className="flex-1 bg-black text-white py-4 rounded-xl font-bold uppercase tracking-tighter">Save Cost</button>
        </div>
      </div>
    </div>
  );
}
