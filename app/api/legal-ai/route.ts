import { generateText, gateway, Output } from "ai";
import { z } from "zod";

export const maxDuration = 60;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const modelName = process.env.LEGAL_EYE_AI_MODEL ?? "anthropic/claude-sonnet-4.6";

const requestSchema = z.object({
  action: z.enum(["research", "draft", "review"]),
  organization_id: z.string().uuid(),
  query: z.string().trim().min(3).max(4_000).optional(),
  jurisdictions: z.array(z.string().trim().min(2).max(16)).max(8).optional(),
  use_firm_knowledge: z.boolean().optional(),
  document_type: z.string().trim().min(2).max(120).optional(),
  instructions: z.string().trim().min(3).max(20_000).optional(),
  context: z.string().max(80_000).optional(),
  text: z.string().trim().min(10).max(80_000).optional(),
  playbook: z.array(z.string().trim().min(1).max(2_000)).max(100).optional(),
});

const reviewSchema = z.object({
  overallRisk: z.enum(["high", "medium", "low", "info"]),
  summary: z.string(),
  findings: z.array(z.object({
    title: z.string(),
    risk: z.enum(["high", "medium", "low", "info"]),
    clauseRef: z.string().nullable(),
    whyItMatters: z.string(),
    originalText: z.string().nullable(),
    suggestedText: z.string().nullable(),
  })).max(100),
});

type Evidence = { title?: string; citation?: string; content?: string; [key: string]: unknown };

function response(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
  });
}

function dlp(value: string) {
  const credential = /(?:-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:sk|rk)-[A-Za-z0-9_-]{20,}|\bAIza[0-9A-Za-z_-]{20,}|\bAKIA[0-9A-Z]{16}\b)/g;
  if (credential.test(value)) throw new Error("Credential-like material was detected. Remove secrets and retry.");
  return value
    .replace(/\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g, "[REDACTED_FINANCIAL_IDENTIFIER]")
    .replace(/\b(?:passport|national id|ssn|tin)\s*(?:number|no\.?|#)?\s*[:=-]\s*[A-Z0-9-]{5,24}\b/gi, "[REDACTED_GOVERNMENT_ID]");
}

async function digest(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
}

async function callLegalApi(token: string, body: Record<string, unknown>) {
  const result = await fetch(`${supabaseUrl}/functions/v1/legal-api`, {
    method: "POST",
    headers: { apikey: supabaseKey, authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload = await result.json().catch(() => ({}));
  if (!result.ok) throw new Error(payload.error || "Legal intelligence service failed");
  return payload;
}

async function recordGeneration(token: string, input: z.infer<typeof requestSchema>, prompt: string, answer: string, usage: { inputTokens?: number; outputTokens?: number }, started: number) {
  await callLegalApi(token, {
    action: "record_gateway_generation",
    organization_id: input.organization_id,
    source_action: input.action,
    model_name: modelName,
    prompt_sha256: await digest(prompt),
    response_sha256: await digest(answer),
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens,
    latency_ms: Date.now() - started,
  }).catch(() => undefined);
}

export async function POST(request: Request) {
  if (!supabaseUrl || !supabaseKey) return response({ error: "Server configuration is incomplete" }, 503);
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return response({ error: "Authentication required" }, 401);
  const token = authorization.slice(7);

  try {
    const input = requestSchema.parse(await request.json());
    const userCheck = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: supabaseKey, authorization },
      cache: "no-store",
    });
    if (!userCheck.ok) return response({ error: "Invalid or expired session" }, 401);
    const user = await userCheck.json() as { id: string };
    const gatewayOptions = { gateway: { user: user.id, tags: [`feature:${input.action}`, "product:legal-eye", "classification:confidential"] } };

    const started = Date.now();
    if (input.action === "research") {
      if (!input.query) return response({ error: "Research question required" }, 400);
      const evidence = await callLegalApi(token, {
        action: "research",
        query: input.query,
        jurisdictions: input.jurisdictions ?? ["TZ"],
        organization_id: input.organization_id,
        use_firm_knowledge: input.use_firm_knowledge ?? true,
        data_classification: "confidential",
      });
      const publicEvidence = (evidence.publicEvidence ?? []) as Evidence[];
      const privateEvidence = (evidence.privateEvidence ?? []) as Evidence[];
      if (!publicEvidence.length && !privateEvidence.length) return response(evidence);
      const format = (rows: Evidence[], prefix: string) => rows.map((row, index) =>
        `[${prefix}${index + 1}] ${row.title ?? "Untitled"} ${row.citation ?? ""}\n${row.content ?? ""}`
      ).join("\n\n");
      const prompt = dlp(`Research question: ${input.query}\nJurisdictions: ${(input.jurisdictions ?? ["TZ"]).join(", ")}\n\nPUBLIC EVIDENCE:\n${format(publicEvidence, "P")}\n\nPRIVATE FIRM EVIDENCE:\n${format(privateEvidence, "F")}`);
      const generated = await generateText({
        model: gateway(modelName),
        system: "You are a legal research assistant. Use only supplied evidence. Never invent authorities, quotations, paragraph numbers, holdings, or facts. Distinguish binding public authority from private firm material. If evidence is insufficient, state that prominently. Return: Short Answer; Analysis; Key Authorities; Contrary or Limiting Authorities; Practical Implications; Uncertainties. Cite evidence labels exactly. This is lawyer decision-support and requires verification.",
        prompt,
        providerOptions: gatewayOptions,
      });
      await recordGeneration(token, input, prompt, generated.text, generated.totalUsage, started);
      return response({ ...evidence, answer: generated.text, provider: "vercel-ai-gateway", model: modelName });
    }

    if (input.action === "draft") {
      if (!input.instructions) return response({ error: "Drafting instructions required" }, 400);
      const prompt = dlp(`Document type: ${input.document_type ?? "Legal memorandum"}\nJurisdiction: Tanzania\nInstructions: ${input.instructions}\nVerified context supplied by the lawyer:\n${input.context ?? "None"}`);
      const generated = await generateText({
        model: gateway(modelName),
        system: "You are a senior legal drafting assistant. Draft conservatively, never invent legal authority or facts, preserve [PLACEHOLDER] markers for missing facts, mark assumptions, and use professional legal structure. Begin with 'AI DRAFT — LAWYER REVIEW REQUIRED'.",
        prompt,
        providerOptions: gatewayOptions,
      });
      await recordGeneration(token, input, prompt, generated.text, generated.totalUsage, started);
      return response({ provider: "vercel-ai-gateway", model: modelName, content: generated.text });
    }

    if (!input.text) return response({ error: "Contract text required" }, 400);
    const prompt = dlp(`Contract text:\n${input.text}\n\nFirm playbook:\n${(input.playbook ?? []).join("\n") || "No playbook rules supplied; identify text-supported drafting risks only."}`);
    const generated = await generateText({
      model: gateway(modelName),
      system: "You are a legal contract review assistant. Identify issues only from the supplied text and playbook. Never invent clauses, authorities, market practice, or facts. Suggested wording must be visibly treated as a lawyer-review proposal.",
      prompt,
      providerOptions: gatewayOptions,
      output: Output.object({ schema: reviewSchema }),
    });
    const serialized = JSON.stringify(generated.output);
    await recordGeneration(token, input, prompt, serialized, generated.totalUsage, started);
    return response({ provider: "vercel-ai-gateway", model: modelName, ...generated.output });
  } catch (error) {
    if (error instanceof z.ZodError) return response({ error: "Invalid request", issues: error.issues }, 400);
    const message = error instanceof Error ? error.message : "AI request failed";
    const status = message.includes("Credential-like") ? 400 : 502;
    return response({ error: message }, status);
  }
}
