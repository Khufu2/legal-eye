import "jsr:@supabase/functions-js/edge-runtime.d.ts";

function bundledKey(name: string) {
  const raw = Deno.env.get(name);
  if (!raw) return "";
  try {
    const values = JSON.parse(raw) as Record<string, unknown>;
    const candidate = values.default || Object.values(values).find((value) => typeof value === "string");
    return typeof candidate === "string" ? candidate : "";
  } catch {
    return "";
  }
}

const U = Deno.env.get("SUPABASE_URL")!;
const A = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || bundledKey("SUPABASE_PUBLISHABLE_KEYS") ||
  Deno.env.get("SUPABASE_ANON_KEY")!;
const S = Deno.env.get("SUPABASE_SECRET_KEY") || bundledKey("SUPABASE_SECRET_KEYS") ||
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
if (!U || !A || !S) throw new Error("Supabase runtime configuration is incomplete");
const DEFAULT_ORIGIN = "https://legal-eye.truckai-co.chatgpt.site";
const ALLOWED_ORIGINS = new Set(
  (Deno.env.get("ALLOWED_WEB_ORIGINS") || DEFAULT_ORIGIN)
    .split(",")
    .map((value: string) => value.trim())
    .filter(Boolean),
);

function cors(request: Request) {
  const origin = request.headers.get("origin");
  return {
    ...(origin && ALLOWED_ORIGINS.has(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

const json = (request: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors(request), "content-type": "application/json" },
});

const serviceHeaders = (extra: Record<string, string> = {}) => ({
  apikey: S,
  ...(!S.startsWith("sb_") ? { authorization: `Bearer ${S}` } : {}),
  ...extra,
});

async function service(path: string, init: RequestInit = {}) {
  const response = await fetch(`${U}${path}`, {
    ...init,
    headers: serviceHeaders(init.headers as Record<string, string> || {}),
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error(body?.message || body?.error || `Database operation failed (${response.status})`);
    Object.assign(error, { status: response.status, body });
    throw error;
  }
  return body;
}

async function patchDocument(id: string, values: Record<string, unknown>) {
  await service(`/rest/v1/documents?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(values),
  });
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    const origin = request.headers.get("origin");
    if (origin && !ALLOWED_ORIGINS.has(origin)) return new Response(null, { status: 403 });
    return new Response(null, { headers: cors(request) });
  }
  if (request.method !== "POST") return json(request, { error: "POST required" }, 405);

  const origin = request.headers.get("origin");
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json(request, { error: "Origin not allowed" }, 403);

  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) return json(request, { error: "Authentication required" }, 401);

  try {
    const input = await request.json().catch(() => null);
    const documentId = typeof input?.document_id === "string" ? input.document_id : "";
    if (!documentId) return json(request, { error: "document_id required" }, 400);

    const visible = await fetch(
      `${U}/rest/v1/documents?id=eq.${encodeURIComponent(documentId)}&select=id,organization_id,storage_path,mime_type,file_name,status,metadata,content_hash`,
      { headers: { apikey: A, authorization } },
    );
    const rows = await visible.json().catch(() => []);
    if (!visible.ok || !rows?.length) {
      return json(request, { error: "Document not found or not authorized" }, 403);
    }

    const document = rows[0];
    if (!document.storage_path) return json(request, { error: "Document has no source object" }, 409);

    const sourceVersion = document.content_hash || document.storage_path;
    const idempotencyKey = `private-docling:${document.id}:${sourceVersion}`;
    const existing = await service(
      `/rest/v1/ingestion_jobs?idempotency_key=eq.${encodeURIComponent(idempotencyKey)}` +
        "&select=id,status,attempt_count,max_attempts,available_at,dead_lettered_at&limit=1",
    );
    if (existing?.[0]) {
      const job = existing[0];
      return json(request, {
        ok: true,
        status: job.status,
        job_id: job.id,
        attempts: job.attempt_count,
        max_attempts: job.max_attempts,
        available_at: job.available_at,
        dead_lettered: Boolean(job.dead_lettered_at),
        duplicate: true,
      }, job.status === "complete" ? 200 : 202);
    }

    const created = await service("/rest/v1/ingestion_jobs?on_conflict=idempotency_key", {
      method: "POST",
      headers: { "content-type": "application/json", Prefer: "resolution=ignore-duplicates,return=representation" },
      body: JSON.stringify({
        document_id: document.id,
        organization_id: document.organization_id,
        job_type: "docling_parse",
        status: "queued",
        progress: 0,
        idempotency_key: idempotencyKey,
        available_at: new Date().toISOString(),
        payload: {
          engine: "docling",
          canonical_format: "docling-json",
          structure_required: true,
          storage_bucket: "firm-vault",
          storage_path: document.storage_path,
          mime_type: document.mime_type,
          file_name: document.file_name,
        },
      }),
    });
    const job = created?.[0] || (await service(
      `/rest/v1/ingestion_jobs?idempotency_key=eq.${encodeURIComponent(idempotencyKey)}` +
        "&select=id,status,attempt_count,max_attempts,available_at,dead_lettered_at&limit=1",
    ))?.[0];
    if (!job?.id) throw new Error("Could not create ingestion job");

    await service("/rest/v1/ingestion_job_events", {
      method: "POST",
      headers: { "content-type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        ingestion_job_id: job.id,
        organization_id: document.organization_id,
        event_type: "queued",
        detail: { engine: "docling", canonical_format: "docling-json" },
      }),
    });
    await patchDocument(document.id, {
      metadata: {
        ...(document.metadata || {}),
        parser: "docling",
        parser_state: "queued",
        ingestion_job_id: job.id,
      },
      updated_at: new Date().toISOString(),
    });

    return json(request, {
      ok: true,
      status: "queued",
      job_id: job.id,
      engine: "docling",
      searchable: false,
    }, 202);
  } catch (error) {
    console.error("document queueing failed", error instanceof Error ? error.message : "unknown error");
    return json(request, { error: "Document processing could not be queued" }, 500);
  }
});
