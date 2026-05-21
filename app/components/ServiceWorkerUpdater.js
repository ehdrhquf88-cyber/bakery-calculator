"use client";

import { useEffect, useRef, useState } from "react";

export default function ServiceWorkerUpdater({ t }) {
  const [waitingWorker, setWaitingWorker] = useState(null);
  const [isBannerVisible, setIsBannerVisible] = useState(false);
  const isRefreshing = useRef(false);
  const registrationRef = useRef(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const refreshForUpdate = () => {
      if (isRefreshing.current) return;
      isRefreshing.current = true;
      window.location.reload();
    };

    const handleMessage = (event) => {
      if (event.data?.type === "SW_ACTIVATED") {
        refreshForUpdate();
      }
    };

    const checkForUpdate = () => {
      registrationRef.current?.update().catch((error) => {
        console.error("Service Worker update check failed.", error);
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") checkForUpdate();
    };

    navigator.serviceWorker.addEventListener("controllerchange", refreshForUpdate);
    navigator.serviceWorker.addEventListener("message", handleMessage);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
        registrationRef.current = registration;

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

        checkForUpdate();
      } catch (error) {
        console.error("Service Worker registration failed.", error);
      }
    };

    registerServiceWorker();

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", refreshForUpdate);
      navigator.serviceWorker.removeEventListener("message", handleMessage);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const handleUpdate = () => {
    setIsBannerVisible(false);

    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
      window.setTimeout(() => {
        if (isRefreshing.current) return;
        isRefreshing.current = true;
        window.location.reload();
      }, 1500);
      return;
    }

    registrationRef.current?.update();
  };

  if (!isBannerVisible) return null;

  return (
    <div className="fixed left-4 right-4 bottom-4 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white px-4 py-3 text-black shadow-xl print:hidden">
      <div>
        <div className="text-xs font-black uppercase tracking-tight">{t("updateAvailable")}</div>
        <div className="text-[10px] font-bold text-gray-400">{t("updateDescription")}</div>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={() => setIsBannerVisible(false)}
          className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-tight text-gray-400"
        >
          {t("later")}
        </button>
        <button
          type="button"
          onClick={handleUpdate}
          className="rounded-full bg-black px-3 py-1.5 text-[10px] font-black uppercase tracking-tight text-white"
        >
          {t("update")}
        </button>
      </div>
    </div>
  );
}
