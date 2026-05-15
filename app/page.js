// --- 다른 부분은 모두 동일하며 TempPhDB 컴포넌트의 출력 로직만 날짜별 나열로 보완했습니다 ---

function TempPhDB({ tempLogs, setTempLogs }) {
  const items = ["날짜", "르방", "밀", "물", "결과", "오토리즈", "오토리즈완료", "반죽완료", "하바1", "하바2", "하바3", "하바4", "분할", "성형", "굽기"];
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedProduct, setExpandedProduct] = useState(null);

  // 제품별 -> 날짜별로 데이터를 구조화하는 로직
  const groupedLogs = useMemo(() => {
    const groups = {};
    const filtered = tempLogs.filter(log => 
      log.productName.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    filtered.forEach(log => {
      if (!groups[log.productName]) groups[log.productName] = {};
      
      // 날짜 키 생성 (로그의 timestamp 또는 displayTime에서 추출)
      const dateKey = log.timestamp || log.displayTime?.split(',')[0] || "날짜 미지정";
      
      if (!groups[log.productName][dateKey]) groups[log.productName][dateKey] = [];
      groups[log.productName][dateKey].push(log);
    });

    // 제품명 및 날짜 정렬 (최신순)
    return groups;
  }, [tempLogs, searchTerm]);

  return (
    <main className="max-w-6xl mx-auto px-4 md:px-8 text-black">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b-2 border-black pb-4 mb-8 gap-4">
        <h1 className="text-3xl md:text-4xl font-black italic tracking-tighter uppercase">History</h1>
        <div className="w-full md:w-64">
          <input 
            type="text" 
            placeholder="제품명 검색..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-full px-4 py-2 text-sm outline-none shadow-inner"
          />
        </div>
      </div>
      
      <div className="space-y-4">
        {Object.entries(groupedLogs).length > 0 ? (
          Object.entries(groupedLogs).map(([productName, dateGroups]) => {
            const isExpanded = expandedProduct === productName;
            
            return (
              <div key={productName} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm transition-all">
                <div 
                  onClick={() => setExpandedProduct(isExpanded ? null : productName)}
                  className="p-5 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Product</div>
                    <div className="text-xl font-black italic tracking-tighter uppercase">{productName}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-black text-gray-400 uppercase">Records</div>
                    <div className="text-xs font-bold italic">{Object.keys(dateGroups).length} Days</div>
                    <div className="text-[10px] text-gray-300 mt-1">{isExpanded ? "Click to Close ▲" : "Click to View All ▼"}</div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-5 pt-0 border-t border-gray-50 bg-[#fcfcfb]">
                    {/* 날짜별로 섹션을 나누어 나열 */}
                    {Object.entries(dateGroups)
                      .sort(([dateA], [dateB]) => new Date(dateB) - new Date(dateA)) // 최신 날짜순
                      .map(([date, logs]) => (
                        <div key={date} className="mt-8 first:mt-5">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="h-[2px] flex-1 bg-black/5"></div>
                            <span className="text-[11px] font-black italic text-black bg-white px-3 py-1 rounded-full border border-gray-100 shadow-sm uppercase tracking-tighter">
                              📅 {date}
                            </span>
                            <div className="h-[2px] flex-1 bg-black/5"></div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {logs.sort((a, b) => b.id - a.id).map(log => (
                              <div key={log.id} className="bg-white p-5 rounded-xl border border-gray-100 relative shadow-sm hover:border-black/20 transition-all">
                                <div className="mb-4 flex justify-between items-start">
                                  <div>
                                      <span className="text-[9px] font-black text-gray-400 uppercase bg-gray-100 px-1.5 py-0.5 rounded">{log.type}</span>
                                      <div className="font-bold text-[10px] italic mt-1 text-gray-400">{log.displayTime?.split(',')[1] || "시간 미표기"}</div>
                                  </div>
                                  <button onClick={() => confirm("삭제하시겠습니까?") && setTempLogs(tempLogs.filter(l => l.id !== log.id))} className="text-gray-300 hover:text-red-500 transition-colors text-xs">✕</button>
                                </div>
                                <div className="space-y-1">
                                  {items.map(item => log.data[item] && (log.data[item].t || log.data[item].p) ? (
                                    <div key={item} className="flex justify-between text-[11px] border-b border-gray-50 pb-0.5">
                                      <span className="font-bold text-gray-400">{item}</span>
                                      <span className="font-mono text-black">
                                        {log.data[item].t && `${log.data[item].t}${item !== "날짜" ? "°" : ""}`} {log.data[item].p && `/ ${log.data[item].p}p`}
                                      </span>
                                    </div>
                                  ) : null)}
                                </div>
                                {log.memo && <div className="mt-3 pt-2 border-t border-dashed text-[10px] italic text-gray-500 whitespace-pre-wrap leading-relaxed">{log.memo}</div>}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="py-20 text-center text-gray-400 italic">검색 결과가 없거나 저장된 히스토리가 없습니다.</div>
        )}
      </div>
    </main>
  );
}