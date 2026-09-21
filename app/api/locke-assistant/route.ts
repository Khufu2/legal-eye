import { generateText, gateway } from "ai";
import { z } from "zod";
import { legalModelName } from "@/lib/legal/model";

export const maxDuration = 30;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

const schema = z.object({
  organization_id: z.string().uuid(),
  message: z.string().trim().min(1).max(3000),
  current_view: z.string().trim().max(80),
  active_matter: z.string().trim().max(200).nullable().optional(),
  documents: z.array(z.object({
    title: z.string().max(240),
    status: z.string().max(80),
  })).max(50).optional(),
  history: z.array(z.object({
    role: z.enum(["user","assistant"]),
    content: z.string().max(3000),
  })).max(8).optional(),
});

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}

export async function POST(request: Request) {
  if (!supabaseUrl || !supabaseKey) return json({ error: "Server configuration is incomplete" }, 503);
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return json({ error: "Sign in to use the LOCKE assistant." }, 401);

  try {
    const input = schema.parse(await request.json());
    const userCheck = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: supabaseKey, authorization },
      cache: "no-store",
    });
    if (!userCheck.ok) return json({ error: "Your session has expired. Sign in again." }, 401);
    const user = await userCheck.json() as { id: string };

    const membership = await fetch(
      `${supabaseUrl}/rest/v1/organization_members?select=organization_id&organization_id=eq.${encodeURIComponent(input.organization_id)}&user_id=eq.${encodeURIComponent(user.id)}&is_active=is.true&limit=1`,
      { headers: { apikey: supabaseKey, authorization }, cache: "no-store" },
    );
    const rows = membership.ok ? await membership.json().catch(() => []) : [];
    if (!rows.length) return json({ error: "Organization access denied" }, 403);

    const readyDocs = (input.documents ?? []).filter(d => d.status === "ready");
    const context = {
      current_view: input.current_view,
      active_matter: input.active_matter ?? null,
      private_documents: input.documents ?? [],
      ready_document_count: readyDocs.length,
    };
    const history = (input.history ?? []).map(x => `${x.role.toUpperCase()}: ${x.content}`).join("\n");

    const generated = await generateText({
      model: gateway(legalModelName),
      system: `You are the in-product LOCKE Guide. Be concise, practical and contextual. Help a lawyer understand and use the current LOCKE workspace.

Product map:
- Ask: start a legal question.
- Research: saved evidence-grounded research sessions and source inspection.
- Editor: draft and refine legal documents.
- Review: review a processed private agreement and save findings.
- Tables: compare/extract structured fields across processed private documents.
- Lists: create source-linked checklists.
- Matters: organize work by matter.
- Vault: the ONLY place to upload private documents. Files must finish processing and show status "ready" before document-dependent tools can use them.
- Portal: publish selected governed work to client rooms.
- Agent: run multi-step legal work; private documents are optional unless the objective depends on them.
- Skills: reusable firm instructions that can be run with selected private documents.
- Workflows: connect repeatable steps and lawyer checkpoints.
- Monitor: track source changes.
- Trust: review governance and controls.
- Word/Outlook add-ins: use LOCKE inside Microsoft Office.

Never pretend you clicked, uploaded, selected, or changed anything. Never invent a document or feature. Use the supplied current-view and document-status context. If the user asks a substantive legal question, explain that Ask/Research is the evidence-grounded surface and suggest a concise research query; do not answer the legal merits here. If a document-dependent task has no ready files, direct the user to Vault. Keep most answers under 120 words.`,
      prompt: `CONTEXT\n${JSON.stringify(context)}\n\nRECENT CHAT\n${history || "None"}\n\nUSER\n${input.message}`,
      providerOptions: { gateway: { user: user.id, tags: ["feature:locke-guide", "product:locke"] } },
    });

    return json({ answer: generated.text, model: legalModelName });
  } catch (error) {
    if (error instanceof z.ZodError) return json({ error: "Invalid assistant request" }, 400);
    return json({ error: error instanceof Error ? error.message : "LOCKE assistant failed" }, 502);
  }
}
