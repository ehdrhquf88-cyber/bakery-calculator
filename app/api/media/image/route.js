import { getRequestUser } from "../../../lib/authServer";
import { canReadRecipeImage } from "../../../lib/mediaAccessServer";
import { getR2Object } from "../../../lib/r2Server";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    const { user, supabase, error } = await getRequestUser(request);

    if (error) {
      return Response.json({ error }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key") || "";

    if (!key) {
      return Response.json({ error: "Missing key" }, { status: 400 });
    }

    const canRead = await canReadRecipeImage({ key, user, supabase });

    if (!canRead) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const r2Response = await getR2Object({ key });
    const headers = new Headers();
    const contentType = r2Response.headers.get("content-type") || "application/octet-stream";
    const contentLength = r2Response.headers.get("content-length");
    const etag = r2Response.headers.get("etag");

    headers.set("Content-Type", contentType);
    headers.set("Cache-Control", "private, no-store");
    if (contentLength) headers.set("Content-Length", contentLength);
    if (etag) headers.set("ETag", etag);

    return new Response(r2Response.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    return Response.json({ error: error.message || "Image read failed" }, { status: 500 });
  }
}
