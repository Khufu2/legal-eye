"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabaseKey, supabaseUrl } from "@/lib/legal/client";
import { authRequest, authErrorMessage, validateAuthFields } from "@/lib/legal/auth-errors";
import { readAuthCallback } from "@/lib/legal/auth-callback";
import { safeSessionStorage } from "@/lib/auth/browser-storage";
import { track } from "@/lib/telemetry";

export default function ResetPassword() {
  const [mode, setMode] = useState<"request" | "update" | "sent" | "done">("request");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown,setCooldown]=useState(0);
  const [showPassword,setShowPassword]=useState(false);
  const token = useRef<string | null>(null);
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    setEmail(safeSessionStorage.getItem("locke-recovery-email")||"");safeSessionStorage.removeItem("locke-recovery-email");
    const callback = readAuthCallback(window.location.hash,window.location.search);
    const hadParameters=Boolean(window.location.hash||window.location.search);
    if (hadParameters) window.history.replaceState(null, "", window.location.pathname);
    if (callback?.kind === "recovery") { token.current = callback.token; setMode("update");track('locke_recovery_link_opened',{outcome:'recovery'}); }
    else if (callback?.kind === "error") {setError(callback.message);track('locke_recovery_link_opened',{outcome:'expired'});}
    else if(hadParameters){setError('This reset link is incomplete or unsupported. Request a fresh link below and open the newest email.');track('locke_recovery_link_opened',{outcome:'missing'});}
  }, []);
  useEffect(()=>{if(cooldown<=0)return;const timer=setTimeout(()=>setCooldown(value=>value-1),1000);return()=>clearTimeout(timer);},[cooldown]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const fields = validateAuthFields(mode === "update" ? {password, confirm, signup:true} : {email});
    if (Object.keys(fields).length) { setError(Object.values(fields).join(" ")); return; }
    setBusy(true); setError("");
    try {
      if (!supabaseUrl || !supabaseKey) throw new Error("Account recovery is temporarily unavailable. Please contact support.");
      if (mode === "update" && !token.current) throw new Error("Open a new password reset link to continue.");
      const response = await authRequest(mode === "update" ? `${supabaseUrl}/auth/v1/user` : `${supabaseUrl}/auth/v1/recover?redirect_to=${encodeURIComponent(window.location.origin + "/reset-password")}`, {
        method: mode === "update" ? "PUT" : "POST",
        headers: { apikey: supabaseKey, "content-type": "application/json", ...(mode === "update" ? { Authorization: `Bearer ${token.current}` } : {}) },
        body: JSON.stringify(mode === "update" ? { password } : { email: email.trim() }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(authErrorMessage(result, response.status));
      if (mode === "update") {
        // End the recovery session; never treat a recovery link as firm access.
        const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),3000);
        await fetch(`${supabaseUrl}/auth/v1/logout?scope=global`, { method: "POST", headers: { apikey: supabaseKey, Authorization: `Bearer ${token.current}` },signal:controller.signal }).catch(() => undefined).finally(()=>clearTimeout(timer));
        token.current = null; safeSessionStorage.removeItem("legal-eye-session"); setPassword(""); setConfirm(""); setMode("done");track('locke_recovery_completed',{outcome:'success'});
      } else {setCooldown(60);setMode("sent");}
    } catch (reason) { setError(reason instanceof TypeError ? authErrorMessage(reason) : reason instanceof Error ? reason.message : authErrorMessage(reason)); }
    finally { setBusy(false); }
  }

  return <main className="account-recovery"><section className="account-recovery-card">
    <Link className="account-recovery-brand" href="/">LOCKE<span>Legal intelligence.</span></Link>
    <h1>{mode === "done" ? "Password updated" : mode === "sent" ? "Check your email" : mode === "update" ? "Choose a new password" : "Reset your password"}</h1>
    <p>{mode === "done" ? "Sign in with your new password to return to your firm workspace." : mode === "sent" ? "If an account exists for this email, a reset link has been requested. Allow a few minutes, then check your inbox and spam folder. Open the newest email and tap Reset password inside that email." : mode === "update" ? "Use a unique password with at least 12 characters. Keep this tab open until your password is saved." : "Enter the same email you used to register. We’ll send a secure recovery link; no popup window is required."}</p>
    {error && <div className="inline-error" role="alert">{error}</div>}
    {(mode === "request" || mode === "update") && <form className="auth-form" noValidate onSubmit={submit}>
      {mode === "request" ? <label>Email<Input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label> : <>
        <label>New password<Input required type={showPassword?"text":"password"} autoComplete="new-password" minLength={12} value={password} onChange={e => setPassword(e.target.value)} /></label>
        <label>Confirm password<Input required type={showPassword?"text":"password"} autoComplete="new-password" minLength={12} value={confirm} onChange={e => setConfirm(e.target.value)} /></label>
        <button type="button" aria-pressed={showPassword} onClick={()=>setShowPassword(value=>!value)}>{showPassword?'Hide passwords':'Show passwords'}</button>
      </>}
      <Button type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "update" ? "Save new password" : "Send reset link"}</Button>
    </form>}
    {mode==='sent'&&<><Button type="button" variant="outline" disabled={cooldown>0} onClick={()=>{setMode('request');setError('');}}>{cooldown>0?`Request another link in ${cooldown}s`:'Request another link'}</Button><p>Use only the latest reset link. If the button does not open, copy its link from the original email and open it in your browser. Never share the link.</p></>}
    <Link className="account-recovery-back" href="/?signin=1">Back to sign in</Link>
  </section></main>;
}
