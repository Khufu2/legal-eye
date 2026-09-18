// Shared by research, drafting, review, agents and the client portal.
// Gemini 2.5 Flash is explicitly eligible for Gateway free credits (verified 2026-09-18).
// A contracted model can be selected with the deployment override.
export const legalModelName = process.env.LEGAL_EYE_AI_MODEL?.trim() || 'google/gemini-2.5-flash';
