export function InputField({ label, children }) {
    return (
        <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">{label}</label>
            {children}
        </div>
    );
}

export function SummaryCard({ title, children }) {
  return (
    <div className="bg-[#f7f6f3] rounded-2xl p-5 md:p-6 shadow-lg border border-white/50">
      <h2 className="text-xl md:text-2xl font-black tracking-tighter border-b-2 border-black pb-2 mb-4 uppercase">{title}</h2>
      {children}
    </div>
  );
}

export function SummaryRow({ label, value }) {
  return (
    <div className="flex justify-between border-b border-dashed pb-2 text-xs md:text-sm mb-2">
      <span className="text-gray-600 font-bold uppercase text-[10px] tracking-tight">{label}</span>
      <span className="font-mono font-bold">{value}</span>
    </div>
  );
}
