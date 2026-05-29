import { getRequestUser } from "../../../lib/authServer";
import { makeImageKey, putR2Object } from "../../../lib/r2Server";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export async function POST(request) {
  try {
    const { user, error } = await getRequestUser(request);

    if (error) {
      return Response.json({ error }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return Response.json({ error: "Missing image file" }, { status: 400 });
    }

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      return Response.json({ error: "Only jpeg, png, and webp uploads are allowed" }, { status: 400 });
    }

    if (file.size > MAX_IMAGE_BYTES) {
      return Response.json({ error: "Image is too large" }, { status: 413 });
    }

    const key = makeImageKey(user.id, file.name, file.type);
    const buffer = Buffer.from(await file.arrayBuffer());

    await putR2Object({
      key,
      body: buffer,
      contentType: file.type || "application/octet-stream",
    });

    return Response.json({
      key,
      contentType: file.type,
      size: file.size,
    });
  } catch (error) {
    return Response.json({ error: error.message || "Image upload failed" }, { status: 500 });
  }
}
