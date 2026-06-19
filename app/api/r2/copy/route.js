import crypto from "crypto";

import { getRequestUser } from "../../../lib/authServer";
import { canReadRecipeImage } from "../../../lib/mediaAccessServer";
import { copyR2Object } from "../../../lib/r2Server";

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

    const { sourceKey } = await request.json();

    if (!sourceKey || typeof sourceKey !== "string") {
      return Response.json({ error: "Missing sourceKey" }, { status: 400 });
    }

    const canRead = await canReadRecipeImage({ key: sourceKey, user });

    if (!canRead) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const destinationKey = destinationKeyFor(user.id, sourceKey);

    await copyR2Object({
      sourceKey,
      destinationKey,
    });

    return Response.json({
      key: destinationKey,
    });
  } catch (error) {
    return Response.json({ error: error.message || "Image copy failed" }, { status: 500 });
  }
}
