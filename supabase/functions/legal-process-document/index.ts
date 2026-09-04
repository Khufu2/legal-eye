import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const U = Deno.env.get("SUPABASE_URL")!;
const A = Deno.env.get("SUPABASE_ANON_KEY")!;
const S = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DOCLING_URL = Deno.env.get("DOCLING_SERVICE_URL")?.replace(/\/$/, "");
const PARSER_KEY = Deno.env.get("LEGAL_EYE_PARSER_KEY");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "content-type": "application/json" },
});
const pathEncode = (value: string) => value.split("/").map(encodeURIComponent).join("/");
const serviceHeaders = (extra: Record<string, string> = {}) => ({
  apikey: S,
  authorization: `Bearer ${S}`,
  ...extra,
});

async function service(path: string, init: RequestInit = {}) {
  return fetch(`${U}${path}`, { ...init, headers: serviceHeaders(init.headers as Record<string, string> || {}) });
}

async function patchDocument(id: string, values: Record<string, unknown>) {
  const response = await service(`/rest/v1/documents?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(values),
  });
  if (!response.ok) throw new Error("Could not update document state");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: cors });
  if (request.method !== "POST") return json({ error: "POST required" }, 405);

  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) return json({ error: "Authentication required" }, 401);

  let documentId: string | undefined;
  let jobId: string | undefined;
  try {
    const body = await request.json();
    documentId = body?.document_id;
    if (!documentId) return json({ error: "document_id required" }, 400);

    const visible = await fetch(
      `${U}/rest/v1/documents?id=eq.${encodeURIComponent(documentId)}&select=id,organization_id,storage_path,mime_type,file_name,status,metadata`,
      { headers: { apikey: A, authorization } },
    );
    const rows = await visible.json();
    if (!visible.ok || !rows?.length) return json({ error: "Document not found or not authorized" }, 403);
    const document = rows[0];
    if (!document.storage_path) return json({ error: "Document has no source object" }, 409);

    const queued = await service("/rest/v1/ingestion_jobs", {
      method: "POST",
      headers: { "content-type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({
        document_id: document.id,
        organization_id: document.organization_id,
        job_type: "docling_parse",
        status: DOCLING_URL && PARSER_KEY ? "running" : "queued",
        progress: DOCLING_URL && PARSER_KEY ? 0.1 : 0,
        started_at: DOCLING_URL && PARSER_KEY ? new Date().toISOString() : null,
        payload: { engine: "docling", canonical_format: "docling-json", structure_required: true },
      }),
    });
    if (!queued.ok) throw new Error("Could not create ingestion job");
    jobId = (await queued.json())[0]?.id;

    if (!DOCLING_URL || !PARSER_KEY) {
      await patchDocument(document.id, {
        metadata: { ...document.metadata, parser: "docling", parser_state: "queued", ingestion_job_id: jobId },
        updated_at: new Date().toISOString(),
      });
      return json({ ok: true, status: "queued", job_id: jobId, engine: "docling" }, 202);
    }

    await patchDocument(document.id, {
      status: "parsing",
      metadata: { ...document.metadata, parser: "docling", parser_state: "running", ingestion_job_id: jobId },
      updated_at: new Date().toISOString(),
    });

    const source = await service(`/storage/v1/object/firm-vault/${pathEncode(document.storage_path)}`);
    if (!source.ok) throw new Error("Could not read source object");
    const sourceBytes = await source.arrayBuffer();
    const form = new FormData();
    form.append("file", new Blob([sourceBytes], { type: document.mime_type || "application/octet-stream" }), document.file_name || "document");

    const parsed = await fetch(`${DOCLING_URL}/v1/convert`, {
      method: "POST",
      headers: { "X-Legal-Eye-Parser-Key": PARSER_KEY },
      body: form,
    });
    if (!parsed.ok) throw new Error(`Docling conversion failed with status ${parsed.status}`);
    const canonical = await parsed.json();
    if (!canonical?.document || canonical?.provenance?.canonical_format !== "docling-json") {
      throw new Error("Parser returned an invalid canonical artifact");
    }

    const artifactBytes = new TextEncoder().encode(JSON.stringify(canonical));
    const digest = await crypto.subtle.digest("SHA-256", artifactBytes);
    const hash = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const artifactPath = `${document.organization_id}/.artifacts/${document.id}/${hash}.docling.json`;
    const upload = await service(`/storage/v1/object/firm-vault/${pathEncode(artifactPath)}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-upsert": "true" },
      body: artifactBytes,
    });
    if (!upload.ok) throw new Error("Could not store canonical parsing artifact");

    const recorded = await service("/rest/v1/document_ingestion_artifacts", {
      method: "POST",
      headers: { "content-type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        document_id: document.id,
        ingestion_job_id: jobId,
        artifact_type: "docling_json",
        schema_version: canonical.schema || "legal-eye.docling-conversion.v1",
        engine_name: canonical.engine?.name || "docling",
        engine_version: canonical.engine?.version || "unknown",
        content_hash: hash,
        storage_path: artifactPath,
        byte_size: artifactBytes.byteLength,
        confidence: canonical.provenance?.confidence || {},
        provenance: {
          source: canonical.source,
          timings: canonical.provenance?.timings || {},
          elapsed_ms: canonical.elapsed_ms,
        },
        is_canonical: true,
      }),
    });
    if (!recorded.ok) throw new Error("Could not record canonical parsing artifact");

    await service(`/rest/v1/ingestion_jobs?id=eq.${encodeURIComponent(jobId!)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "complete", progress: 1, completed_at: new Date().toISOString() }),
    });
    await service("/rest/v1/ingestion_jobs", {
      method: "POST",
      headers: { "content-type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        document_id: document.id,
        organization_id: document.organization_id,
        job_type: "opencontracts_index",
        status: "queued",
        payload: { source_artifact_hash: hash, source_artifact_path: artifactPath },
      }),
    });
    await patchDocument(document.id, {
      status: "indexing",
      content_hash: canonical.source?.sha256 || document.content_hash,
      metadata: { ...document.metadata, parser: "docling", parser_state: "complete", canonical_artifact_hash: hash },
      updated_at: new Date().toISOString(),
    });
    return json({ ok: true, status: "indexing", job_id: jobId, artifact_hash: hash, engine: "docling" }, 202);
  } catch (error) {
    console.error("document ingestion failed", error instanceof Error ? error.message : "unknown error");
    if (jobId) {
      await service(`/rest/v1/ingestion_jobs?id=eq.${encodeURIComponent(jobId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "failed", error_message: error instanceof Error ? error.message : "Unknown error" }),
      }).catch(() => undefined);
    }
    if (documentId) {
      await patchDocument(documentId, { status: "failed", updated_at: new Date().toISOString() }).catch(() => undefined);
    }
    return json({ error: "Document ingestion failed", job_id: jobId }, 500);
  }
});

