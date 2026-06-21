import { useState, useMemo } from "react";

import { LOG_TYPE_LABEL_KEYS, RECIPE_CATEGORY_LABEL_KEYS, TEMP_FIELD_LABEL_KEYS, labelFromMap } from "./i18nHelpers";

const TEMP_CATEGORY_ORDER = ["하드계열", "소프트계열", "사전반죽", "미등록"];

function getTempLogCategory(log, recipeCategoryByName) {
  if (log?.category) return log.category;
  if (log?.type === "사전반죽 기록") return "사전반죽";

  const productName = String(log?.productName || "").trim().toLowerCase();
  return recipeCategoryByName.get(productName) || "미등록";
}

// 제품별 온도/pH 기록을 날짜 기준으로 비교하는 미니 차트 컴포넌트입니다.
function HistoryChart({ t, logs, isPreFerment }) {
  // 일반 반죽과 사전반죽은 기록 항목이 달라서, 모드에 맞는 X축 후보를 나눕니다.
  const availableFields = useMemo(() => isPreFerment 
    ? ["르방", "수분", "밀", "결과", "사용시점", "정점"]
    : ["르방", "밀", "물", "결과", "오토리즈", "오토리즈완료", "반죽완료", "하바1", "하바2", "하바3", "하바4", "분할", "성형", "굽기"], [isPreFerment]);
  // 선택된 항목은 그래프에서 비교할 공정 단계입니다.
  const [selectedXField, setSelectedXField] = useState("결과"); 
  // 사용자가 직접 선택한 비교 날짜 목록입니다. 비어 있으면 저장된 모든 날짜를 기본값으로 씁니다.
  const [selectedDates, setSelectedDates] = useState([]);
  // 달력 입력창에서 선택 중인 날짜입니다.
  const [datePickerValue, setDatePickerValue] = useState("");

  // 저장된 최신순 로그를 시간 흐름대로 보기 위해 역순으로 정렬합니다.
  const allTimelineLogs = useMemo(() => {
    return [...logs].reverse(); 
  }, [logs]);

  // 날짜 검색 후보에 사용할 중복 없는 날짜 목록입니다.
  const uniqueDates = useMemo(() => {
    const dates = allTimelineLogs.map(l => l.timestamp).filter(Boolean);
    return Array.from(new Set(dates));
  }, [allTimelineLogs]);

  // 직접 선택값이 없을 때만 저장된 모든 날짜를 자동 비교 대상으로 잡습니다.
  const activeSelectedDates = selectedDates.length > 0 ? selectedDates : uniqueDates;

  // 달력에서 선택할 수 있는 기록 날짜 범위입니다.
  const dateBounds = useMemo(() => {
    return {
      min: uniqueDates[0] || "",
      max: uniqueDates[uniqueDates.length - 1] || "",
    };
  }, [uniqueDates]);

  // 달력에서 선택한 날짜를 비교 목록에 추가합니다. 실제 기록이 있는 날짜만 추가합니다.
  const addSelectedDate = (date) => {
    if (!uniqueDates.includes(date)) {
      setDatePickerValue(date);
      return;
    }

    setSelectedDates(prev => {
      const baseDates = prev.length > 0 ? prev : activeSelectedDates;
      return baseDates.includes(date) ? baseDates : [...baseDates, date];
    });
    setDatePickerValue("");
  };

  // 선택된 날짜 태그를 제거합니다.
  const removeSelectedDate = (date) => {
    setSelectedDates(activeSelectedDates.filter(d => d !== date));
  };

  // 현재 선택된 날짜에 해당하는 로그만 그래프 데이터로 사용합니다.
  const activeChartData = useMemo(() => {
    return allTimelineLogs.filter(l => activeSelectedDates.includes(l.timestamp));
  }, [allTimelineLogs, activeSelectedDates]);

  // SVG 차트의 고정 크기값입니다. viewBox 기준이라 화면 너비에 맞춰 비율로 축소/확대됩니다.
  const width = 500;
  const height = 160;
  const padding = 30;

  // 선택한 공정 단계의 온도(t)와 pH(p)를 SVG 좌표 계산 전 데이터 포인트로 변환합니다.
  const points = useMemo(() => {
    if (activeChartData.length === 0) return [];
    return activeChartData.map((d, i) => {
      const x = padding + (activeChartData.length > 1 ? (i / (activeChartData.length - 1)) * (width - padding * 2) : (width - padding * 2) / 2);
      const fieldData = d.data?.[selectedXField] || {};
      return { x, tVal: parseFloat(fieldData.t) || null, pVal: parseFloat(fieldData.p) || null, date: d.timestamp };
    });
  }, [activeChartData, selectedXField]);

  // 온도와 pH는 단위 범위가 달라서 각각의 최소/최대값으로 별도 스케일을 만듭니다.
  const scaleBounds = useMemo(() => {
    const validTemps = points.map(p => p.tVal).filter(v => v !== null);
    const validPhs = points.map(p => p.pVal).filter(v => v !== null);
    const maxT = validTemps.length > 0 ? Math.max(...validTemps, 30) : 30;
    const minT = validTemps.length > 0 ? Math.min(...validTemps, 15) : 15;
    const maxP = validPhs.length > 0 ? Math.max(...validPhs, 7) : 7;
    const minP = validPhs.length > 0 ? Math.min(...validPhs, 3) : 3;
    return { maxT, minT, maxP, minP, tRange: maxT - minT || 1, pRange: maxP - minP || 1 };
  }, [points]);

  // 실제 SVG에 그릴 y좌표를 계산합니다. 값이 없는 항목은 null로 유지해 점/선을 그리지 않습니다.
  const renderedPoints = useMemo(() => {
    const { minT, tRange, minP, pRange } = scaleBounds;
    return points.map(p => {
      const yTemp = p.tVal !== null ? height - padding - ((p.tVal - minT) / tRange) * (height - padding * 2) : null;
      const yPh = p.pVal !== null ? height - padding - ((p.pVal - minP) / pRange) * (height - padding * 2) : null;
      return { ...p, yTemp, yPh };
    });
  }, [points, scaleBounds]);

  // 온도와 pH 선 그래프용 SVG path 문자열입니다.
  const tempPath = useMemo(() => renderedPoints.filter(p => p.yTemp !== null).map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.yTemp}`).join(' '), [renderedPoints]);
  const phPath = useMemo(() => renderedPoints.filter(p => p.yPh !== null).map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.yPh}`).join(' '), [renderedPoints]);
  return (
    <div className="bg-white p-4 md:p-5 rounded-2xl border border-gray-100 shadow-sm mb-6 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-gray-100 pb-4 text-xs">
        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">{t("xAxisField")}</label>
          <div className="flex flex-wrap gap-1">
            {availableFields.map(f => (
              <button key={f} onClick={() => setSelectedXField(f)} className={`px-2.5 py-1 rounded-md font-bold transition-all text-[11px] ${selectedXField === f ? "bg-black text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>{labelFromMap(t, TEMP_FIELD_LABEL_KEYS, f)}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">{t("yAxisDates")} ({activeSelectedDates.length})</label>
          <div className="space-y-2">
            <input
              type="date"
              value={datePickerValue}
              min={dateBounds.min}
              max={dateBounds.max}
              onChange={(e) => addSelectedDate(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-md px-3 py-2 text-[11px] font-mono font-bold outline-none shadow-inner focus:border-black"
            />
            {datePickerValue && !uniqueDates.includes(datePickerValue) && (
              <div className="text-[10px] font-bold text-red-400 px-1">
                {t("noRecordOnDate")}
              </div>
            )}
            <div className="flex flex-wrap gap-1.5 max-h-[72px] overflow-y-auto p-0.5 no-scrollbar">
              {activeSelectedDates.map(date => (
                <button
                  key={date}
                  type="button"
                  onClick={() => removeSelectedDate(date)}
                  className="flex items-center gap-1 px-2 py-1 rounded-md border bg-amber-50 border-amber-300 text-amber-900 shadow-sm text-[11px] font-mono font-bold cursor-pointer transition-all hover:border-red-200 hover:text-red-500"
                >
                  {date.split('-').slice(1).join('/')}
                  <span className="text-[10px] font-black">x</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 선택 날짜와 데이터 유무에 따라 안내 문구 또는 차트를 보여줍니다. */}
      {activeSelectedDates.length < 2 ? (
        <div className="h-36 flex flex-col items-center justify-center border border-dashed border-gray-200 rounded-xl bg-gray-50/50 text-[11px] text-gray-400 font-bold p-4 text-center"><span>{t("needTwoDates")}</span></div>
      ) : renderedPoints.length === 0 || (!renderedPoints.some(p => p.tVal !== null) && !renderedPoints.some(p => p.pVal !== null)) ? (
        <div className="h-36 flex items-center justify-center border border-dashed border-gray-200 rounded-xl bg-gray-50/50 text-[11px] text-gray-400 font-bold p-4 text-center"><span>{t("noChartValue")}</span></div>
      ) : (
        <div>
          <div className="flex gap-4 text-[10px] font-black uppercase tracking-wider mb-2 justify-end">
            <span className="flex items-center gap-1 text-orange-600">- {labelFromMap(t, TEMP_FIELD_LABEL_KEYS, selectedXField)} {t("temperature")}(°C)</span>
            <span className="flex items-center gap-1 text-teal-700">- {labelFromMap(t, TEMP_FIELD_LABEL_KEYS, selectedXField)} pH</span>
          </div>
          <div className="relative w-full overflow-hidden">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
              <line x1={padding} y1={padding} x2={width-padding} y2={padding} stroke="#f3f4f6" strokeDasharray="3" />
              <line x1={padding} y1={height/2} x2={width-padding} y2={height/2} stroke="#f3f4f6" strokeDasharray="3" />
              <line x1={padding} y1={height-padding} x2={width-padding} y2={height-padding} stroke="#e5e7eb" />
              {tempPath && <path d={tempPath} fill="none" stroke="#ea580c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
              {phPath && <path d={phPath} fill="none" stroke="#0f766e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
              {renderedPoints.map((p, i) => (
                <g key={i}>
                  {p.yTemp !== null && (
                    <>
                      <circle cx={p.x} cy={p.yTemp} r="4" fill="#fff" stroke="#ea580c" strokeWidth="2" />
                      <text x={p.x} y={p.yTemp - 6} textAnchor="middle" className="text-[9px] font-mono font-bold fill-orange-700">{p.tVal}°</text>
                    </>
                  )}
                  {p.yPh !== null && (
                    <>
                      <circle cx={p.x} cy={p.yPh} r="4" fill="#fff" stroke="#0f766e" strokeWidth="2" />
                      <text x={p.x} y={p.yPh + 12} textAnchor="middle" className="text-[9px] font-mono font-bold fill-teal-800">{p.pVal}</text>
                    </>
                  )}
                  <text x={p.x} y={height - 6} textAnchor="middle" className="text-[8px] font-bold fill-gray-400 font-mono">{p.date.split('-').slice(1).join('/')}</text>
                </g>
              ))}
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}

// 온도/pH 기록 전체를 제품별, 날짜별로 묶어 보여주는 히스토리 화면입니다.
export default function TempPhDB({ t, recipes = [], tempLogs = [], setTempLogs }) {
  // 일반 반죽 기록에 표시할 공정 단계 목록입니다.
  const normalItems = ["날짜", "르방", "밀", "물", "결과", "오토리즈", "오토리즈완료", "반죽완료", "하바1", "하바2", "하바3", "하바4", "분할", "성형", "굽기"];
  // 사전반죽 기록에 표시할 항목 목록입니다.
  const pfItems = ["날짜", "르방", "수분", "밀", "결과", "사용시점", "정점"];

  // 검색어와 펼쳐진 제품/날짜 카드 상태입니다.
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [expandedProduct, setExpandedProduct] = useState(null);
  const [expandedDate, setExpandedDate] = useState(null);

  // 카드 안에서 바로 수정할 때 사용하는 임시 편집 상태입니다.
  const [inlineEditId, setInlineEditId] = useState(null);
  const [inlineData, setInlineData] = useState({});
  const [inlineMemo, setInlineMemo] = useState("");
  const [inlineType, setInlineType] = useState("");

  const recipeCategoryByName = useMemo(() => {
    return new Map(
      recipes
        .filter(recipe => recipe?.productName)
        .map(recipe => [String(recipe.productName).trim().toLowerCase(), recipe.category || "미등록"])
    );
  }, [recipes]);

  // 검색어를 반영한 뒤 카테고리, 제품명 기준으로 로그를 그룹화합니다.
  const groupedLogsByCategory = useMemo(() => {
    const groups = {};
    const keyword = searchTerm.toLowerCase();
    const filtered = tempLogs.filter(log => String(log.productName || "").toLowerCase().includes(keyword));
    filtered.forEach(log => {
      const category = getTempLogCategory(log, recipeCategoryByName);
      const productName = log.productName || "미등록";
      if (!groups[category]) groups[category] = {};
      if (!groups[category][productName]) groups[category][productName] = [];
      groups[category][productName].push(log);
    });
    return groups;
  }, [tempLogs, searchTerm, recipeCategoryByName, t]);

  const groupedCategoryEntries = useMemo(() => {
    return Object.entries(groupedLogsByCategory).sort(([categoryA], [categoryB]) => {
      const orderA = TEMP_CATEGORY_ORDER.includes(categoryA) ? TEMP_CATEGORY_ORDER.indexOf(categoryA) : TEMP_CATEGORY_ORDER.length;
      const orderB = TEMP_CATEGORY_ORDER.includes(categoryB) ? TEMP_CATEGORY_ORDER.indexOf(categoryB) : TEMP_CATEGORY_ORDER.length;
      if (orderA !== orderB) return orderA - orderB;
      return categoryA.localeCompare(categoryB, "ko");
    });
  }, [groupedLogsByCategory]);

  // 선택한 기록 카드의 현재 값을 편집 폼에 복사합니다.
  const startInlineEdit = (log) => {
    setInlineEditId(log.id);
    setInlineData(log.data || {});
    setInlineMemo(log.memo || "");
    setInlineType(log.type);
  };

  // 편집 중인 기록을 tempLogs 배열에 반영하고 편집 모드를 종료합니다.
  const saveInlineEdit = (logId) => {
    setTempLogs(prev => prev.map(l => {
      if (l.id === logId) {
        return {
          ...l,
          type: inlineType,
          data: inlineData,
          memo: inlineMemo,
          timestamp: inlineData["날짜"]?.t || l.timestamp
        };
      }
      return l;
    }));
    setInlineEditId(null);
  };
  return (
    <main className="max-w-6xl mx-auto px-4 md:px-8 text-black">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b-2 border-black pb-4 mb-8 gap-4">
        <h1 className="text-3xl md:text-4xl font-black tracking-tighter uppercase">{t("historyTitle")}</h1>
        <input type="text" placeholder={t("searchProduct")} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full md:w-64 bg-white border border-gray-200 rounded-full px-4 py-2 text-sm outline-none shadow-inner" />
      </div>
      
      <div className="space-y-4">
        {groupedCategoryEntries.map(([category, productGroups]) => {
          const productEntries = Object.entries(productGroups).sort(([nameA], [nameB]) => nameA.localeCompare(nameB, "ko"));
          const recordCount = productEntries.reduce((sum, [, logs]) => sum + logs.length, 0);
          const isCategoryExpanded = expandedCategory === category;

          return (
            <div key={category} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              <button
                type="button"
                onClick={() => {
                  setExpandedCategory(isCategoryExpanded ? null : category);
                  setExpandedProduct(null);
                  setExpandedDate(null);
                }}
                className="w-full p-5 flex justify-between items-center text-left hover:bg-gray-50 transition-all"
              >
                <div>
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t("category")}</div>
                  <div className="text-xl font-black tracking-tighter uppercase">{category === "미등록" ? t("uncategorized") : labelFromMap(t, RECIPE_CATEGORY_LABEL_KEYS, category)}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">{recordCount} {t("records")}</span>
                  <span className="text-xs">{isCategoryExpanded ? "▲" : "▼"}</span>
                </div>
              </button>

              {isCategoryExpanded && (
                <div className="px-5 pb-5 bg-[#fcfcfb] space-y-4 border-t border-gray-100 pt-4">
                  {productEntries.map(([productName, logs]) => {
          // 제품 안에서 다시 날짜별로 기록을 묶어 접고 펼칠 수 있게 만듭니다.
          const dateGroups = {};
          logs.forEach(log => {
            const dateKey = log.timestamp || t("noDate");
            if (!dateGroups[dateKey]) dateGroups[dateKey] = [];
            dateGroups[dateKey].push(log);
          });

          // 사전반죽 기록이 하나라도 있으면 차트와 카드가 사전반죽 항목 기준으로 동작합니다.
          const isPreFerment = logs.some(l => l.type === "사전반죽 기록");

          return (
            <div key={productName} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              <div onClick={() => { setExpandedProduct(expandedProduct === productName ? null : productName); setExpandedDate(null); }} className="p-5 flex justify-between items-center cursor-pointer hover:bg-gray-50">
                <div>
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t("product")}</div>
                  <div className="text-xl font-black tracking-tighter uppercase">{productName}</div>
                </div>
                <span className="text-xs">{expandedProduct === productName ? "▲" : "▼"}</span>
              </div>
              
              {expandedProduct === productName && (
                <div className="px-5 pb-5 bg-[#fcfcfb]">
                  <div className="pt-4">
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{t("trendChart")}</div>
                    <HistoryChart t={t} logs={logs} isPreFerment={isPreFerment} />
                  </div>

                  {Object.entries(dateGroups).map(([date, dateLogs]) => {
                    const dateKey = `${category}-${productName}-${date}`;
                    const isDateExpanded = expandedDate === dateKey;

                    return (
                    <div key={date} className="border-t border-gray-100 py-4">
                      <button
                        type="button"
                        onClick={() => setExpandedDate(isDateExpanded ? null : dateKey)}
                        className="w-full bg-white p-4 rounded-xl border border-gray-100 flex justify-between items-center text-left hover:border-black transition-all"
                      >
                        <div>
                          <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t("date")}</div>
                          <div className="text-sm font-black tracking-tight">{date}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">{dateLogs.length} {t("records")}</span>
                          <span className="text-xs">{isDateExpanded ? "▲" : "▼"}</span>
                        </div>
                      </button>

                      {isDateExpanded && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                        {dateLogs.map(log => {
                          // 기록 종류에 맞는 입력/표시 항목을 선택합니다.
                          const activeItems = log.type === "사전반죽 기록" ? pfItems : normalItems;
                          // 현재 카드가 인라인 편집 중인지 확인합니다.
                          const isEditingNow = inlineEditId === log.id;

                          return (
                            <div key={log.id} className={`bg-white p-5 rounded-xl border shadow-sm relative transition-all ${isEditingNow ? "border-black ring-1 ring-black/10" : "border-gray-100"}`}>
                              
                              {isEditingNow ? (
                                // 편집 모드: 날짜, 온도, pH, 메모를 카드 안에서 바로 수정합니다.
                                <div className="space-y-3">
                                  <div className="flex justify-between items-center mb-2">
                                    {log.type !== "사전반죽 기록" ? (
                                      <select value={inlineType} onChange={(e) => setInlineType(e.target.value)} className="bg-transparent font-black text-[10px] uppercase border-b border-black outline-none font-sans">
                                        <option value="1차 저온">{t("firstCold")}</option><option value="2차 저온">{t("secondCold")}</option>
                                      </select>
                                    ) : <span className="text-[9px] font-black text-gray-400 uppercase">{t("preFerment")}</span>}
                                    <div className="flex gap-2">
                                      <button onClick={() => setInlineEditId(null)} className="text-[10px] font-bold text-gray-400 uppercase underline">{t("cancel")}</button>
                                      <button onClick={() => saveInlineEdit(log.id)} className="text-[10px] font-black text-black uppercase underline">{t("save")}</button>
                                    </div>
                                  </div>
                                  <div className="space-y-1 max-h-[220px] overflow-y-auto pr-1 no-scrollbar">
                                    {activeItems.map(item => (
                                      <div key={item} className="grid grid-cols-[1fr_120px] gap-2 items-center border-b border-black/5 pb-1 text-[11px]">
                                        <span className="font-bold uppercase text-gray-400">{labelFromMap(t, TEMP_FIELD_LABEL_KEYS, item)}</span>
                                        {item === "날짜" ? (
                                          <input type="date" value={inlineData["날짜"]?.t || ""} className="w-full bg-gray-50 rounded px-1 py-0.5 text-right font-mono text-[10px] border border-transparent" onChange={(e) => setInlineData({ ...inlineData, [item]: { t: e.target.value } })} />
                                        ) : log.type === "사전반죽 기록" && (item === "사용시점" || item === "정점") ? (
                                          <div className="grid grid-cols-3 gap-1">
                                            <input placeholder="pH" type="text" value={inlineData[item]?.p || ""} className="bg-gray-50 rounded p-0.5 text-center font-mono text-[10px]" onChange={(e) => setInlineData({ ...inlineData, [item]: { ...(inlineData[item] || {}), p: e.target.value.replace(',', '.') } })} />
                                            <input placeholder="Min" type="text" value={inlineData[item]?.h || ""} className="bg-gray-50 rounded p-0.5 text-center font-mono text-[10px]" onChange={(e) => setInlineData({ ...inlineData, [item]: { ...(inlineData[item] || {}), h: e.target.value } })} />
                                            <input placeholder="Vol" type="text" value={inlineData[item]?.v || ""} className="bg-gray-50 rounded p-0.5 text-center font-mono text-[10px]" onChange={(e) => setInlineData({ ...inlineData, [item]: { ...(inlineData[item] || {}), v: e.target.value } })} />
                                          </div>
                                        ) : log.type === "사전반죽 기록" && item === "결과" ? (
                                          <div className="grid grid-cols-3 gap-1">
                                            <input placeholder="°C" type="text" value={inlineData[item]?.t || ""} className="bg-gray-50 rounded p-0.5 text-center font-mono text-[10px]" onChange={(e) => setInlineData({ ...inlineData, [item]: { ...(inlineData[item] || {}), t: e.target.value.replace(',', '.') } })} />
                                            <input placeholder="pH" type="text" value={inlineData[item]?.p || ""} className="bg-gray-50 rounded p-0.5 text-center font-mono text-[10px]" onChange={(e) => setInlineData({ ...inlineData, [item]: { ...(inlineData[item] || {}), p: e.target.value.replace(',', '.') } })} />
                                            <input placeholder="Vol" type="text" value={inlineData[item]?.v || ""} className="bg-gray-50 rounded p-0.5 text-center font-mono text-[10px]" onChange={(e) => setInlineData({ ...inlineData, [item]: { ...(inlineData[item] || {}), v: e.target.value } })} />
                                          </div>
                                        ) : item === "밀" ? (
                                          <input placeholder="°C" type="text" value={inlineData[item]?.t || ""} className="w-full bg-gray-50 rounded px-1 py-0.5 text-right font-mono text-[10px]" onChange={(e) => setInlineData({ ...inlineData, [item]: { t: e.target.value.replace(',', '.') } })} />
                                        ) : (
                                          <div className="flex gap-1">
                                            <input placeholder="" type="text" value={inlineData[item]?.t || ""} className="w-1/2 bg-gray-50 rounded text-center font-mono text-[10px]" onChange={(e) => setInlineData({ ...inlineData, [item]: { ...(inlineData[item] || {}), t: e.target.value.replace(',', '.') } })} />
                                            <input placeholder="pH" type="text" value={inlineData[item]?.p || ""} className="w-1/2 bg-gray-50 rounded text-center font-mono text-[10px]" onChange={(e) => setInlineData({ ...inlineData, [item]: { ...(inlineData[item] || {}), p: e.target.value.replace(',', '.') } })} />
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                  <textarea value={inlineMemo} onChange={(e) => setInlineMemo(e.target.value)} className="w-full bg-gray-50 border-none rounded-lg p-2 text-[10px] leading-4 resize-none h-14 outline-none" placeholder={t("memo")} />
                                </div>
                              ) : (
                                // 보기 모드: 저장된 값만 요약해서 보여주고, 카드를 누르면 편집 모드로 전환합니다.
                                <div onClick={() => startInlineEdit(log)} className="cursor-pointer group">
                                  <div className="absolute top-2 right-2 text-[8px] font-black text-gray-200 group-hover:text-black uppercase tracking-tighter transition-colors">{t("edit")}</div>
                                  <div className="mb-4 flex justify-between">
                                    <span className="text-[9px] font-black text-gray-400 uppercase bg-gray-100 px-1.5 py-0.5 rounded">{labelFromMap(t, LOG_TYPE_LABEL_KEYS, log.type)}</span>
                                    <button onClick={(e) => { e.stopPropagation(); if (confirm(t("deleteConfirm"))) setTempLogs(prev => prev.filter(l => l.id !== log.id)); }} className="text-gray-300 hover:text-red-500 text-xs">x</button>
                                  </div>
                                  <div className="space-y-1">
                                    {activeItems.map(item => log.data[item] && (log.data[item].t || log.data[item].p || log.data[item].h || log.data[item].v) ? (
                                      <div key={item} className="flex justify-between text-[11px] border-b border-gray-50 pb-0.5">
                                        <span className="font-bold text-gray-400 uppercase">{labelFromMap(t, TEMP_FIELD_LABEL_KEYS, item)}</span>
                                        <span className="font-mono text-black">
                                          {log.data[item].t}
                                          {log.data[item].p ? ` / ${log.data[item].p}pH` : ""}
                                          {log.data[item].h ? ` / ${log.data[item].h}m` : ""}
                                          {log.data[item].v ? ` / ${log.data[item].v}` : ""}
                                        </span>
                                      </div>
                                    ) : null)}
                                  </div>
                                  {log.memo && <div className="mt-3 pt-2 border-t border-dashed text-[10px] font-medium text-gray-500 whitespace-pre-wrap">{log.memo}</div>}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
