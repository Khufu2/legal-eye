// Shared by research, drafting, review, agents and the client portal.
// Gemini 2.5 Flash is explicitly eligible for Gateway free credits (verified 2026-09-18).
// A contracted model can be selected with the deployment override.
export const legalModelName = process.env.LEGAL_EYE_AI_MODEL?.trim() || 'google/gemini-2.5-flash';

/** Deployment-specific routing. Existing workspaces keep their default until an override is set. */
export function legalModelFor(action: string) {
  const override = action === 'research' ? process.env.LOCKE_RESEARCH_AI_MODEL
    : action === 'run_agent' || action === 'plan_workflow' ? process.env.LOCKE_AGENT_AI_MODEL
    : action === 'review' || action === 'draft' ? process.env.LOCKE_DOCUMENT_AI_MODEL
    : undefined;
  return override?.trim() || legalModelName;
}
