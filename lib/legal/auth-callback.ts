// Parse only supported email callbacks. Callers must remove the fragment from
// browser history immediately; bearer credentials must never be persisted here.
export function readAuthCallback(hash: string): { kind: "recovery"; token: string } | { kind: "verified" } | { kind: "error"; message: string } | null {
  const values = new URLSearchParams(hash.replace(/^#/, ""));
  if (values.has("error")) return { kind: "error", message: "This email link is invalid or expired. Request a new link." };
  if (!values.get("access_token")) return null;
  if (values.get("type") === "recovery") return { kind: "recovery", token: values.get("access_token")! };
  return { kind: "verified" };
}
