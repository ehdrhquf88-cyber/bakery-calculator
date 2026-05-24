export default function BreadVideos({ t }) {
  return (
    <main className="max-w-6xl mx-auto px-4 md:px-8 text-black">
      <div className="border-b-2 border-black pb-4 mb-6">
        <h1 className="text-3xl md:text-4xl font-black tracking-tighter uppercase">{t("videosTitle")}</h1>
        <p className="mt-2 text-xs md:text-sm font-bold text-gray-400">{t("videosDescription")}</p>
      </div>

      <section className="bg-white rounded-2xl border border-gray-100 p-8 md:p-12 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#f7f6f3] text-2xl font-black">
          ▶
        </div>
        <h2 className="text-2xl md:text-3xl font-black tracking-tighter">{t("videosComingSoonTitle")}</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm md:text-base font-bold leading-7 text-gray-400">
          {t("videosComingSoonDescription")}
        </p>
      </section>
    </main>
  );
}
