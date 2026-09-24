"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabaseKey, supabaseUrl } from "@/lib/legal/client";
import { readAuthCallback } from "@/lib/legal/auth-callback";

export default function ResetPassword() {
  const [mode, setMode] = useState<"request" | "update" | "sent" | "done">("request");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const token = useRef<string | null>(null);
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const callback = readAuthCallback(window.location.hash);
    if (window.location.hash) window.history.replaceState(null, "", window.location.pathname);
    if (callback?.kind === "recovery") { token.current = callback.token; setMode("update"); }
    else if (callback?.kind === "error") setError(callback.message);
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (mode === "update" && (password.length < 12 || password !== confirm)) {
      setError("Use at least 12 characters and make sure both passwords match."); return;
    }
    setBusy(true); setError("");
    try {
      if (!supabaseUrl || !supabaseKey) throw new Error("Account recovery is temporarily unavailable. Please contact support.");
      if (mode === "update" && !token.current) throw new Error("Open a new password reset link to continue.");
      const response = await fetch(mode === "update" ? `${supabaseUrl}/auth/v1/user` : `${supabaseUrl}/auth/v1/recover?redirect_to=${encodeURIComponent(window.location.origin + "/reset-password")}`, {
        method: mode === "update" ? "PUT" : "POST",
        headers: { apikey: supabaseKey, "content-type": "application/json", ...(mode === "update" ? { Authorization: `Bearer ${token.current}` } : {}) },
        body: JSON.stringify(mode === "update" ? { password } : { email: email.trim() }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.msg || result.message || result.error_description || "Unable to complete account recovery. Please try again.");
      if (mode === "update") {
        // End the recovery session; never treat a recovery link as firm access.
        await fetch(`${supabaseUrl}/auth/v1/logout?scope=global`, { method: "POST", headers: { apikey: supabaseKey, Authorization: `Bearer ${token.current}` } }).catch(() => undefined);
        token.current = null; sessionStorage.removeItem("legal-eye-session"); setPassword(""); setConfirm(""); setMode("done");
      } else setMode("sent");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Account recovery failed."); }
    finally { setBusy(false); }
  }

  return <main className="account-recovery"><section className="account-recovery-card">
    <Link className="account-recovery-brand" href="/">LOCKE<span>Legal intelligence.</span></Link>
    <h1>{mode === "done" ? "Password updated" : mode === "sent" ? "Check your email" : mode === "update" ? "Choose a new password" : "Reset your password"}</h1>
    <p>{mode === "done" ? "Sign in with your new password to return to your firm workspace." : mode === "sent" ? "If an account exists for this email, you’ll receive a reset link. Check your inbox and spam folder." : mode === "update" ? "Use a unique password with at least 12 characters." : "Enter your account email and we’ll send a secure recovery link."}</p>
    {error && <div className="inline-error" role="alert">{error}</div>}
    {(mode === "request" || mode === "update") && <form className="auth-form" onSubmit={submit}>
      {mode === "request" ? <label>Email<Input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label> : <>
        <label>New password<Input required type="password" autoComplete="new-password" minLength={12} value={password} onChange={e => setPassword(e.target.value)} /></label>
        <label>Confirm password<Input required type="password" autoComplete="new-password" minLength={12} value={confirm} onChange={e => setConfirm(e.target.value)} /></label>
      </>}
      <Button type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "update" ? "Save new password" : "Send reset link"}</Button>
    </form>}
    <Link className="account-recovery-back" href="/?signin=1">Back to sign in</Link>
  </section></main>;
}
