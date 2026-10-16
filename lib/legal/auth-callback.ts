// Parse only supported email callbacks. Callers must remove the fragment from
// browser history immediately; bearer credentials must never be persisted here.
export function readAuthCallback(hash: string, search = ""): { kind: "recovery"; token: string } | { kind: "verified" } | { kind: "error"; message: string } | null {
  const values = new URLSearchParams(hash.replace(/^#/, ""));
  if (values.has("error") || new URLSearchParams(search).has("error")) return { kind: "error", message: "This email link is invalid or expired. Request a new link." };
  if (!values.get("access_token")) return null;
  if (values.get("type") === "recovery") return { kind: "recovery", token: values.get("access_token")! };
  if (!['signup','email','invite','magiclink'].includes(values.get('type')||'')) return {kind:'error',message:'This email link could not be recognized. Request a new link.'};
  return { kind: "verified" };
}
