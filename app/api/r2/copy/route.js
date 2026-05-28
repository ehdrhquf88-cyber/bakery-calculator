import crypto from "crypto";

import { getRequestUser } from "../../../lib/authServer";
import { copyR2Object, publicR2Url } from "../../../lib/r2Server";

export const runtime = "nodejs";

function destinationKeyFor(userId, sourceKey) {
  const extension = sourceKey.split(".").pop()?.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
  return `images/recipes/${userId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
}

export async function POST(request) {
  try {
    const { user, error } = await getRequestUser(request);

    if (error) {
      return Response.json({ error }, { status: 401 });
    }

    const { sourceKey, contentType } = await request.json();

    if (!sourceKey || typeof sourceKey !== "string") {
      return Response.json({ error: "Missing sourceKey" }, { status: 400 });
    }

    if (!sourceKey.startsWith("images/recipes/")) {
      return Response.json({ error: "Unsupported source object" }, { status: 400 });
    }

    const destinationKey = destinationKeyFor(user.id, sourceKey);

    await copyR2Object({
      sourceKey,
      destinationKey,
      contentType,
    });

    return Response.json({
      key: destinationKey,
      url: publicR2Url(destinationKey),
    });
  } catch (error) {
    return Response.json({ error: error.message || "Image copy failed" }, { status: 500 });
  }
}
