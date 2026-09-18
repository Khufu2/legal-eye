// Shared by research, drafting, review, agents and the client portal.
// Keep an explicit deployment override for firms with a contracted model.
export const legalModelName = process.env.LEGAL_EYE_AI_MODEL?.trim() || 'google/gemini-3.8-flash';
