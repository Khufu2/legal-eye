export type Identity = { access_token: string; refresh_token?: string; expires_at?: number; user: { id: string; email?: string }; organization_id: string; role: string };
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
export async function workspace<T>(identity: Identity, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, { ...init, headers: { apikey: supabaseKey, Authorization: `Bearer ${identity.access_token}`, "content-type": "application/json", ...init.headers }, cache: "no-store" });
  if (response.status >= 500 || [402,429].includes(response.status)) throw new Error("The workspace backend is temporarily unavailable. Please retry after service recovery.");
  const value = await response.text();
  let data: any = null;
  try { data = value ? JSON.parse(value) : null; }
  catch { throw new Error(`Workspace returned an invalid response (${response.status}). Please retry.`); }
  if (!response.ok) throw new Error(data?.message || `Workspace request failed (${response.status})`);
  return data as T;
}
export async function action<T>(identity: Identity, route: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(route, { method: "POST", headers: { Authorization: `Bearer ${identity.access_token}`, "content-type": "application/json" }, body: JSON.stringify({ ...body, organization_id: identity.organization_id }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data as T;
}
export function downloadText(name: string, content: string, type = "text/plain;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a"); link.href = url; link.download = name; link.hidden = true; document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
