import { useMemo, useState } from "react";

import { InputField } from "./common";

const CATEGORY_LABEL_KEYS = {
  "미등록": "uncategorized",
  "밀가루": "flourCategory",
  "유제품": "dairyCategory",
  "설탕류": "sugarCategory",
  "유지류": "fatCategory",
  "견과류": "nutsCategory",
  "과일/필링": "fruitFillingCategory",
  "초콜릿": "chocolateCategory",
  "소금": "typeSalt",
  "첨가물": "additiveCategory",
  "기타": "typeOther",
};

function labelFromMap(t, map, value) {
  return map[value] ? t(map[value]) : value;
}

function parseNumber(value) {
  const rawValue = String(value || "").trim();
  const normalizedValue = rawValue.includes(".")
    ? rawValue.replace(/,/g, "")
    : rawValue.replace(/,(\d{3})\b/g, "$1").replace(",", ".");

  return parseFloat(normalizedValue.replace(/[^\d.]/g, ""));
}

function formatCurrency(value) {
  const amount = parseNumber(value);
  if (!amount) return "";

  return amount.toLocaleString("ko-KR");
}

function getUnitBase(unit) {
  if (unit === "kg") return 1000;
  if (unit === "L") return 1000;
  return 1;
}

function splitPackageUnit(unit) {
  const rawValue = String(unit || "1g").trim();
  const unitMatch = rawValue.match(/(kg|ml|g|l|ea|개)$/i);
  const packageUnit = unitMatch?.[0] || "g";
  const normalizedUnit = packageUnit.toLowerCase() === "l" ? "L" : packageUnit;
  const packageAmount = rawValue.replace(/(kg|ml|g|l|ea|개)$/i, "") || "1";

  return {
    packageAmount,
    packageUnit: normalizedUnit === "개" ? "ea" : normalizedUnit,
  };
}

function formatUnitCost(purchasePrice, packageAmount, packageUnit) {
  const price = parseNumber(purchasePrice);
  const amount = parseNumber(packageAmount);
  const baseAmount = amount * getUnitBase(packageUnit);
  if (!price || !baseAmount) return "";

  return String(Number((price / baseAmount).toFixed(4)));
}

export default function CostDB({ t, costItems, setCostItems }) {
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
        <h1 className="text-3xl md:text-4xl font-black tracking-tighter uppercase">{t("costDbTitle")}</h1>
        <div className="flex gap-2 w-full md:w-auto">
          <input type="text" placeholder={t("searchIngredient")} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex-1 md:w-56 bg-white border border-gray-200 rounded-full px-4 py-2 text-sm outline-none shadow-inner" />
          <button onClick={() => { setEditingItem(null); setIsModalOpen(true); }} className="bg-black text-white px-6 py-2 rounded-full font-bold text-sm uppercase tracking-tighter">{t("add")}</button>
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
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t("category")}</div>
                  <div className="text-xl font-black tracking-tighter uppercase">{labelFromMap(t, CATEGORY_LABEL_KEYS, category)}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">{items.length} {t("items")}</span>
                  <span className="text-xs">{isCategoryExpanded ? "▲" : "▼"}</span>
                </div>
              </button>

              {isCategoryExpanded && (
                <div className="px-5 pb-5 bg-[#fcfcfb]">
                  <div className="grid grid-cols-1 gap-3 pt-4 border-t border-gray-100">
                    {items.map(item => (
                      <div key={item.id} onClick={() => { setEditingItem(item); setIsModalOpen(true); }} className="bg-white p-5 rounded-2xl border border-gray-100 flex justify-between items-center cursor-pointer hover:border-black group transition-all">
                        <div className="min-w-0">
                          <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{labelFromMap(t, CATEGORY_LABEL_KEYS, item.category)}</div>
                          <div className="text-xl font-black tracking-tighter uppercase truncate">{item.name}</div>
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-bold text-gray-400 uppercase tracking-tight">
                            <span className="font-mono text-black">{item.cost || 0}{t("won")} / g</span>
                            {item.purchasePrice && <span>{t("purchasePrice")} {formatCurrency(item.purchasePrice)}{t("won")}</span>}
                            <span>{item.unit}</span>
                            {item.supplier && <span>{item.supplier}</span>}
                            {item.updatedAt && <span>{item.updatedAt}</span>}
                          </div>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); if (confirm(t("deleteConfirm"))) setCostItems(prev => prev.filter(costItem => costItem.id !== item.id)); }} className="text-gray-300 hover:text-red-500">x</button>
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
          {t("noCostItems")}
        </div>
      )}

      {isModalOpen && (
        <CostModal
          t={t}
          initialData={editingItem}
          onSave={handleSave}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </main>
  );
}

function CostModal({ t, initialData, onSave, onClose }) {
  const initialUnit = splitPackageUnit(initialData?.unit);
  const [category, setCategory] = useState(initialData?.category || "밀가루");
  const [name, setName] = useState(initialData?.name || "");
  const [purchasePrice, setPurchasePrice] = useState(initialData?.purchasePrice || "");
  const [packageAmount, setPackageAmount] = useState(initialUnit.packageAmount);
  const [packageUnit, setPackageUnit] = useState(initialUnit.packageUnit);
  const [supplier, setSupplier] = useState(initialData?.supplier || "");
  const [memo, setMemo] = useState(initialData?.memo || "");
  const cost = formatUnitCost(purchasePrice, packageAmount, packageUnit) || initialData?.cost || "";

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSave({
      category,
      name: name.trim(),
      purchasePrice: String(purchasePrice).replace(/\D/g, ""),
      unit: `${packageAmount || 1}${packageUnit}`,
      cost,
      supplier: supplier.trim(),
      memo,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-[#f7f6f3] w-full max-w-2xl rounded-[2rem] p-6 md:p-10 shadow-2xl max-h-[90vh] overflow-y-auto relative">
        <button onClick={onClose} className="absolute top-6 right-6 text-xl">x</button>
        <h2 className="text-2xl md:text-3xl font-black tracking-tighter mb-8 uppercase">{t("costEditor")}</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <InputField label={t("category")}>
            <select value={category} onChange={e => setCategory(e.target.value)} className="w-full h-10 bg-transparent border-b-2 border-black py-2 outline-none font-bold leading-normal">
              <option value="미등록">{t("uncategorized")}</option>
              <option value="밀가루">{t("flourCategory")}</option>
              <option value="유제품">{t("dairyCategory")}</option>
              <option value="설탕류">{t("sugarCategory")}</option>
              <option value="유지류">{t("fatCategory")}</option>
              <option value="견과류">{t("nutsCategory")}</option>
              <option value="과일/필링">{t("fruitFillingCategory")}</option>
              <option value="초콜릿">{t("chocolateCategory")}</option>
              <option value="소금">{t("typeSalt")}</option>
              <option value="첨가물">{t("additiveCategory")}</option>
              <option value="기타">{t("typeOther")}</option>
            </select>
          </InputField>
          <InputField label={t("ingredientName")}>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-transparent border-b-2 border-black py-2 outline-none font-bold" />
          </InputField>
          <InputField label={t("purchasePrice")}>
            <div className="flex items-end gap-2 border-b-2 border-black">
              <input value={formatCurrency(purchasePrice)} onChange={e => setPurchasePrice(e.target.value.replace(/\D/g, ""))} className="w-full bg-transparent py-2 outline-none font-mono font-bold text-right" type="text" inputMode="numeric" placeholder="6,000" />
              <span className="py-2 text-xs font-black text-gray-400">{t("won")}</span>
            </div>
          </InputField>
          <InputField label={t("unit")}>
            <div className="grid grid-cols-[1fr_88px] gap-2">
              <input value={packageAmount} onChange={e => setPackageAmount(e.target.value.replace(/[^\d,.]/g, ""))} className="w-full bg-transparent border-b-2 border-black py-2 outline-none font-mono font-bold text-right" type="text" inputMode="decimal" placeholder="25" />
              <select value={packageUnit} onChange={e => setPackageUnit(e.target.value)} className="w-full h-10 bg-transparent border-b-2 border-black py-2 outline-none font-bold leading-normal">
                <option>g</option>
                <option>kg</option>
                <option>ml</option>
                <option>L</option>
                <option>ea</option>
              </select>
            </div>
          </InputField>
          <InputField label={t("cost")}>
            <div className="flex items-end gap-2 border-b-2 border-black/20 bg-black/5 px-2">
              <input value={cost ? `${cost}${t("won")} / g` : ""} readOnly className="w-full bg-transparent py-2 outline-none font-mono font-bold text-right text-gray-500 cursor-not-allowed" type="text" placeholder={t("autoCalculated")} />
            </div>
          </InputField>
          <InputField label={t("supplier")}>
            <input value={supplier} onChange={e => setSupplier(e.target.value)} className="w-full bg-transparent border-b-2 border-black py-2 outline-none font-bold" />
          </InputField>
        </div>

        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">{t("memo")}</label>
          <textarea value={memo} onChange={e => setMemo(e.target.value)} className="w-full bg-white/50 border border-black/5 rounded-lg p-3 text-xs leading-5 resize-none h-24 outline-none font-medium" placeholder={t("notes")} />
        </div>

        <div className="mt-8 flex gap-3">
          <button onClick={onClose} className="flex-1 bg-white border border-gray-200 py-4 rounded-xl font-bold uppercase tracking-tighter">{t("close")}</button>
          <button onClick={handleSubmit} className="flex-1 bg-black text-white py-4 rounded-xl font-bold uppercase tracking-tighter">{t("saveCost")}</button>
        </div>
      </div>
    </div>
  );
}
