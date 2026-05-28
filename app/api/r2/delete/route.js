import { getRequestUser } from "../../../lib/authServer";
import { deleteR2Object } from "../../../lib/r2Server";

export const runtime = "nodejs";

export async function DELETE(request) {
  try {
    const { user, error } = await getRequestUser(request);

    if (error) {
      return Response.json({ error }, { status: 401 });
    }

    const { key } = await request.json();

    if (!key || typeof key !== "string") {
      return Response.json({ error: "Missing key" }, { status: 400 });
    }

    if (!key.startsWith(`images/recipes/${user.id}/`)) {
      return Response.json({ error: "Cannot delete another user's image" }, { status: 403 });
    }

    await deleteR2Object({ key });

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message || "Image delete failed" }, { status: 500 });
  }
}
