export const TELEMETRY_EVENTS = ['locke_page_viewed','locke_tool_opened','locke_auth_attempted','locke_auth_succeeded','locke_auth_failed','locke_recovery_requested','locke_recovery_request_failed','locke_recovery_link_opened','locke_recovery_completed','locke_recovery_failed','locke_email_callback','locke_runtime_error'] as const;
export type TelemetryEvent = typeof TELEMETRY_EVENTS[number];
const screens = ['workspace','recovery','connections','word','outlook','portal','other'];
const tools = ['ask','research','draft','review','tables','lists','matters','vault','portal','agent','skills','workflows','monitor','trust'];
const codes = ['invalid_credentials','email_not_confirmed','otp_expired','weak_password','same_password','over_email_send_rate_limit','over_request_rate_limit','timeout','network','backend','unknown','storage_unavailable','script_error','unhandled_rejection'];
/** This is a property allowlist, not a blacklist. Never forward input fields or URLs. */
export function filterTelemetry(input: unknown) {
  if (!input || typeof input !== 'object') return null;
  const data = input as Record<string, unknown>;
  if (!TELEMETRY_EVENTS.includes(data.event as TelemetryEvent) || typeof data.session !== 'string' || !/^[a-f0-9-]{16,64}$/.test(data.session)) return null;
  const raw = data.properties && typeof data.properties === 'object' ? data.properties as Record<string,unknown> : {};
  const properties: Record<string,string|number|boolean> = {product:'locke',schema_version:1,$process_person_profile:false,$geoip_disable:true};
  for (const [key,values] of Object.entries({screen:screens,tool:tools,browser:['Safari','Chrome','Firefox','Edge','Other'],code:codes,stage:['signin','signup','confirmation','recovery_request','recovery_update','workspace'],outcome:['verified','expired','recovery','missing','success','failed']})) {
    if (typeof raw[key] === 'string' && values.includes(raw[key] as string)) properties[key]=raw[key] as string;
  }
  for (const key of ['duration_ms','status']) if (typeof raw[key] === 'number' && Number.isFinite(raw[key]) && raw[key]>=0 && raw[key]<=300000) properties[key]=Math.round(raw[key]);
  return {event:data.event as TelemetryEvent,distinct_id:data.session,properties};
}
