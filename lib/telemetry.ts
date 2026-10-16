import { safeSessionStorage } from './auth/browser-storage.ts';
import type { TelemetryEvent } from './telemetry-policy.ts';
let session: string | undefined;
export function track(event: TelemetryEvent, properties: Record<string,string|number|boolean> = {}) {
  if (typeof window === 'undefined' || navigator.doNotTrack === '1') return;
  try {
    session ||= safeSessionStorage.getItem('locke-analytics-session')||undefined;
    session ||= typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), n=>n.toString(16).padStart(2,'0')).join('');
    safeSessionStorage.setItem('locke-analytics-session',session);
    const ua=navigator.userAgent;
    const browser=/Edg\//.test(ua)?'Edge':/Firefox\//.test(ua)?'Firefox':/Chrome\/|CriOS\//.test(ua)?'Chrome':/Safari\//.test(ua)?'Safari':'Other';
    void fetch('/api/telemetry',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({event,session,properties:{...properties,browser}}),keepalive:true}).catch(()=>undefined);
  } catch { /* Analytics must never interrupt legal work or authentication. */ }
}
