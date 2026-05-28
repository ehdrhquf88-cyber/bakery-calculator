import { useEffect, useState } from "react";

import { supabase } from "../lib/supabaseClient";

function isInlineImage(value) {
  return typeof value === "string" && value.startsWith("data:image/");
}

export default function AuthImage({ imageKey, fallbackImage = "", className = "", children }) {
  const [objectUrl, setObjectUrl] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    let nextObjectUrl = "";

    const loadImage = async () => {
      setFailed(false);

      if (!imageKey) {
        setObjectUrl("");
        return;
      }

      try {
        if (!supabase) throw new Error("Supabase is not configured.");

        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        const accessToken = sessionData.session?.access_token;
        if (!accessToken) throw new Error("Login session is missing.");

        const response = await fetch(`/api/media/image?key=${encodeURIComponent(imageKey)}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          cache: "no-store",
        });

        if (!response.ok) throw new Error("Image request failed.");

        const blob = await response.blob();
        nextObjectUrl = URL.createObjectURL(blob);

        if (isCancelled) URL.revokeObjectURL(nextObjectUrl);
        else setObjectUrl(nextObjectUrl);
      } catch {
        if (!isCancelled) {
          setObjectUrl("");
          setFailed(true);
        }
      }
    };

    loadImage();

    return () => {
      isCancelled = true;
      if (nextObjectUrl) URL.revokeObjectURL(nextObjectUrl);
    };
  }, [imageKey]);

  const imageUrl = objectUrl || (isInlineImage(fallbackImage) ? fallbackImage : "");

  if (!imageUrl || failed) return children || null;

  return (
    <span
      className={className}
      style={{ backgroundImage: `url(${imageUrl})` }}
    />
  );
}
