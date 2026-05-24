"use client";

import { useEffect, useRef, useState } from "react";

export default function ServiceWorkerUpdater({ t }) {
  const [waitingWorker, setWaitingWorker] = useState(null);
  const [isBannerVisible, setIsBannerVisible] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const isRefreshing = useRef(false);
  const updateIntervalRef = useRef(null);
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

    const checkForUpdate = async () => {
      if (!navigator.onLine) return;

      try {
        const registration = registrationRef.current || await navigator.serviceWorker.getRegistration("/");
        if (!registration) return;

        registrationRef.current = registration;

        if (registration.waiting && navigator.serviceWorker.controller) {
          setWaitingWorker(registration.waiting);
          setIsBannerVisible(true);
          return;
        }

        await registration.update();
      } catch (error) {
        console.error("Service Worker update check failed.", error);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") checkForUpdate();
    };

    const handlePageShow = () => {
      checkForUpdate();
    };

    navigator.serviceWorker.addEventListener("controllerchange", refreshForUpdate);
    navigator.serviceWorker.addEventListener("message", handleMessage);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", checkForUpdate);
    window.addEventListener("online", checkForUpdate);
    window.addEventListener("pageshow", handlePageShow);

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
        updateIntervalRef.current = window.setInterval(checkForUpdate, 30 * 60 * 1000);
      } catch (error) {
        console.error("Service Worker registration failed.", error);
      }
    };

    registerServiceWorker();

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", refreshForUpdate);
      navigator.serviceWorker.removeEventListener("message", handleMessage);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", checkForUpdate);
      window.removeEventListener("online", checkForUpdate);
      window.removeEventListener("pageshow", handlePageShow);
      if (updateIntervalRef.current) {
        window.clearInterval(updateIntervalRef.current);
      }
    };
  }, []);

  const handleUpdate = () => {
    setIsUpdating(true);

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
    window.setTimeout(() => {
      if (isRefreshing.current) return;
      setIsUpdating(false);
    }, 2000);
  };

  if (!isBannerVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm print:hidden">
      <section className="w-full max-w-sm rounded-2xl border border-black/10 bg-white p-6 text-black shadow-2xl">
        <div className="text-xs font-black uppercase tracking-tight">{t("updateAvailable")}</div>
        <p className="mt-2 text-sm font-bold leading-6 text-gray-500">{t("updateDescription")}</p>
        <div className="mt-6 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setIsBannerVisible(false)}
            className="rounded-xl border border-gray-200 bg-white py-3 text-sm font-black uppercase tracking-tight text-gray-400 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isUpdating}
          >
            {t("later")}
          </button>
          <button
            type="button"
            onClick={handleUpdate}
            className="rounded-xl bg-black py-3 text-sm font-black uppercase tracking-tight text-white disabled:cursor-wait disabled:bg-gray-500"
            disabled={isUpdating}
          >
            {isUpdating ? t("updating") : t("update")}
          </button>
        </div>
      </section>
    </div>
  );
}
