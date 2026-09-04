# AI provider secrets

Add these in **Supabase Dashboard → Project Legal → Edge Functions → Secrets**. Do not paste
secret values into chat, source control, the browser application, database rows, or build logs.

## Required to enable generation

| Secret | Value / rule | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | A server-side Google AI Studio or Vertex-approved key | Primary provider |
| `GEMINI_MODEL` | `gemini-3.8-flash` | Explicit stable production model |
| `OPENROUTER_API_KEY` | A server-side OpenRouter key | Fallback provider |
| `OPENROUTER_MODEL` | `openai/gpt-5.2` | Explicit fallback route |
| `OPENROUTER_SITE_URL` | `https://legal-eye.truckai-co.chatgpt.site` | OpenRouter application attribution |
| `OPENROUTER_APP_NAME` | `Legal Eye` | OpenRouter application attribution |
| `GEMINI_DATA_CLASSIFICATION_CEILING` | `confidential` | Maximum class Gemini may receive |
| `OPENROUTER_DATA_CLASSIFICATION_CEILING` | `internal` | Prevent confidential firm content from fallback |
| `AI_REQUEST_TIMEOUT_MS` | `45000` | Provider timeout |
| `AI_MAX_OUTPUT_TOKENS` | `5000` | Default output ceiling |

The gateway routes Gemini first and OpenRouter second. Credential-like content is blocked;
financial and government identifiers are redacted. Only request/response hashes and operational
telemetry are retained. `restricted` content is denied to both providers with the default ceilings.

Do not raise the OpenRouter ceiling until an enterprise agreement, zero-data-retention control,
subprocessor review and client-data policy have been approved. Supabase supplies its own URL,
anonymous key and service-role key to Edge Functions; do not manually duplicate those defaults.

## Private service secrets (after Google Cloud deployment)

| Secret | Rule |
| --- | --- |
| `DOCLING_SERVICE_URL` | Internal HTTPS URL for the deployed parser |
| `LEGAL_EYE_PARSER_KEY` | Random 32+ byte service credential from Secret Manager |
| `LANGGRAPH_SERVICE_URL` | Internal HTTPS URL for the orchestrator |
| `LEGAL_EYE_ORCHESTRATOR_KEY` | Random 32+ byte service credential from Secret Manager |
| `OPENCONTRACTS_GRAPHQL_URL` | Internal OpenContracts GraphQL endpoint |
| `OPENCONTRACTS_API_TOKEN` | Narrow adapter service token |

## Source credentials (only after policy approval)

- `LAWS_AFRICA_API_TOKEN`: only after a commercial Content API agreement authorizes the
  intended storage, display, embeddings and computational analysis.
- `COURTLISTENER_API_TOKEN`: only after its API terms, quota and intended commercial use are
  approved.

Provider rows in `ai_provider_registry` deliberately remain disabled until secrets and contractual
controls are verified, and the gateway enforces that registry. After adding the two API keys, run
staging smoke/evaluation tests, then mark only the validated provider rows enabled.
