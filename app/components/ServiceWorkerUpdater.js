"use client";

import { useEffect, useRef, useState } from "react";

export default function ServiceWorkerUpdater() {
  const [waitingWorker, setWaitingWorker] = useState(null);
  const [isBannerVisible, setIsBannerVisible] = useState(false);
  const isRefreshing = useRef(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const handleControllerChange = () => {
      if (isRefreshing.current) return;
      isRefreshing.current = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });

        if (registration.waiting && navigator.serviceWorker.controller) {
          setWaitingWorker(registration.waiting);
          setIsBannerVisible(true);
        }

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              setWaitingWorker(newWorker);
              setIsBannerVisible(true);
            }
          });
        });
      } catch (error) {
        console.error("Service Worker registration failed.", error);
      }
    };

    registerServiceWorker();

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  const handleUpdate = () => {
    waitingWorker?.postMessage({ type: "SKIP_WAITING" });
  };

  if (!isBannerVisible) return null;

  return (
    <div className="fixed left-4 right-4 bottom-4 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white px-4 py-3 text-black shadow-xl print:hidden">
      <div>
        <div className="text-xs font-black uppercase tracking-tight">새 버전이 있습니다</div>
        <div className="text-[10px] font-bold text-gray-400">업데이트하면 앱이 새로고침됩니다.</div>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={() => setIsBannerVisible(false)}
          className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-tight text-gray-400"
        >
          나중에
        </button>
        <button
          type="button"
          onClick={handleUpdate}
          className="rounded-full bg-black px-3 py-1.5 text-[10px] font-black uppercase tracking-tight text-white"
        >
          업데이트
        </button>
      </div>
    </div>
  );
}
