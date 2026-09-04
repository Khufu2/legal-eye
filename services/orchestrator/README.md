# Legal Eye orchestrator

LangGraph owns only the visible plan → execute → verify → human-review → deliver state machine.
Supabase remains the durable system of record for runs and events; `legal-api` remains the only model gateway.

Required runtime secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and
`LEGAL_EYE_ORCHESTRATOR_KEY`. Set `LEGAL_API_URL` only when the gateway is not the default
Supabase Edge Function URL.
