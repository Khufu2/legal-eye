import { z } from "zod";

export const maxDuration = 30;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

const inputSchema = z.object({
  document_id: z.string().uuid(),
  organization_id: z.string().uuid(),
});

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

export async function POST(request: Request) {
  if (!supabaseUrl || !supabaseKey) return json({ error: "Server configuration is incomplete" }, 503);

  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return json({ error: "Authentication required" }, 401);

  try {
    const input = inputSchema.parse(await request.json());

    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: supabaseKey, authorization },
      cache: "no-store",
    });
    if (!userResponse.ok) return json({ error: "Invalid or expired session" }, 401);
    const user = await userResponse.json() as { id: string };

    const membershipResponse = await fetch(
      `${supabaseUrl}/rest/v1/organization_members?select=organization_id&organization_id=eq.${encodeURIComponent(input.organization_id)}&user_id=eq.${encodeURIComponent(user.id)}&is_active=is.true&limit=1`,
      { headers: { apikey: supabaseKey, authorization }, cache: "no-store" },
    );
    const memberships = membershipResponse.ok ? await membershipResponse.json().catch(() => []) : [];
    if (!membershipResponse.ok || !memberships?.length) return json({ error: "Organization access denied" }, 403);

    const documentResponse = await fetch(
      `${supabaseUrl}/rest/v1/documents?select=id,organization_id,status&id=eq.${encodeURIComponent(input.document_id)}&organization_id=eq.${encodeURIComponent(input.organization_id)}&limit=1`,
      { headers: { apikey: supabaseKey, authorization }, cache: "no-store" },
    );
    const documents = documentResponse.ok ? await documentResponse.json().catch(() => []) : [];
    if (!documentResponse.ok || !documents?.length) return json({ error: "Document not found or not authorized" }, 403);

    // Queue from the server rather than the browser. This deliberately omits an Origin
    // header so an old browser CORS allow-list can never block authenticated ingestion.
    const processResponse = await fetch(`${supabaseUrl}/functions/v1/legal-process-document`, {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        authorization,
        "content-type": "application/json",
      },
      body: JSON.stringify({ document_id: input.document_id }),
      cache: "no-store",
    });
    const payload = await processResponse.json().catch(() => ({}));
    if (!processResponse.ok) {
      return json({ error: payload?.error || "Document processing could not be queued" }, processResponse.status);
    }

    return json({
      ...payload,
      processing_mode: "hybrid",
      storage: "supabase",
      enrichment: "docling-or-lightweight",
    }, processResponse.status === 202 ? 202 : 200);
  } catch (error) {
    if (error instanceof z.ZodError) return json({ error: "Invalid request", issues: error.issues }, 400);
    return json({ error: error instanceof Error ? error.message : "Document processing failed" }, 500);
  }
}
