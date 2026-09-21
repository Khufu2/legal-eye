import { z } from "zod";

export const maxDuration = 30;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

const paramsSchema = z.object({ id: z.string().uuid() });

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!supabaseUrl || !supabaseKey) return json({ error: "Server configuration is incomplete" }, 503);
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return json({ error: "Authentication required" }, 401);

  try {
    const { id } = paramsSchema.parse(await context.params);
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: supabaseKey, authorization },
      cache: "no-store",
    });
    if (!userResponse.ok) return json({ error: "Your session has expired" }, 401);
    const user = await userResponse.json() as { id: string };

    const documentResponse = await fetch(
      `${supabaseUrl}/rest/v1/documents?select=id,title,organization_id,storage_path,uploaded_by&id=eq.${encodeURIComponent(id)}&limit=1`,
      { headers: { apikey: supabaseKey, authorization }, cache: "no-store" },
    );
    const documents = documentResponse.ok ? await documentResponse.json().catch(() => []) : [];
    const document = documents?.[0] as { id: string; title: string; organization_id: string; storage_path: string | null; uploaded_by: string | null } | undefined;
    if (!document) return json({ error: "Document not found or access denied" }, 404);

    const membershipResponse = await fetch(
      `${supabaseUrl}/rest/v1/organization_members?select=role&organization_id=eq.${encodeURIComponent(document.organization_id)}&user_id=eq.${encodeURIComponent(user.id)}&is_active=is.true&limit=1`,
      { headers: { apikey: supabaseKey, authorization }, cache: "no-store" },
    );
    const memberships = membershipResponse.ok ? await membershipResponse.json().catch(() => []) : [];
    const role = String(memberships?.[0]?.role ?? "");
    if (!["owner", "admin", "partner"].includes(role)) {
      return json({ error: "Only an owner, admin, or partner can permanently delete vault files." }, 403);
    }

    if (document.storage_path) {
      const encodedPath = document.storage_path.split("/").map(encodeURIComponent).join("/");
      const storageDelete = await fetch(`${supabaseUrl}/storage/v1/object/firm-vault/${encodedPath}`, {
        method: "DELETE",
        headers: { apikey: supabaseKey, authorization },
        cache: "no-store",
      });
      if (!storageDelete.ok && storageDelete.status !== 404) {
        const detail = await storageDelete.json().catch(() => null);
        return json({ error: detail?.message || "Stored file could not be deleted. Database record was left unchanged." }, 502);
      }
    }

    const deleteResponse = await fetch(
      `${supabaseUrl}/rest/v1/documents?id=eq.${encodeURIComponent(id)}&organization_id=eq.${encodeURIComponent(document.organization_id)}`,
      {
        method: "DELETE",
        headers: { apikey: supabaseKey, authorization, Prefer: "return=representation" },
        cache: "no-store",
      },
    );
    const deleted = deleteResponse.ok ? await deleteResponse.json().catch(() => []) : [];
    if (!deleteResponse.ok || !deleted?.length) {
      return json({ error: "Document record could not be deleted. The file may already have been removed from storage." }, 409);
    }

    return json({ deleted: true, id, title: document.title });
  } catch (error) {
    if (error instanceof z.ZodError) return json({ error: "Invalid document id" }, 400);
    return json({ error: error instanceof Error ? error.message : "Document deletion failed" }, 500);
  }
}
