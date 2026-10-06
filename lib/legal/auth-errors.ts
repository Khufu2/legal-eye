export type AuthFields = { email?: string; password?: string; firm?: string; confirm?: string };

export function validateAuthFields(input: { email?: string; password?: string; signup?: boolean; firm?: string; requireFirm?: boolean; confirm?: string }): AuthFields {
  const errors: AuthFields = {};
  if (input.email !== undefined) {
    const email = input.email.trim();
    if (!email) errors.email = "Enter your email address.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email address, such as name@firm.com.";
  }
  if (input.password !== undefined) {
    if (!input.password) errors.password = "Enter your password.";
    else if (input.signup && input.password.length < 12) errors.password = "Password must contain at least 12 characters.";
  }
  if (input.requireFirm && !input.firm?.trim()) errors.firm = "Enter your firm or practice name.";
  if (input.confirm !== undefined && input.password !== input.confirm) errors.confirm = "Passwords do not match.";
  return errors;
}

export function authErrorMessage(error: unknown, status?: number): string {
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) return "The account service took too long to respond. Try again.";
  if (error instanceof TypeError) return "Could not connect. Check your internet connection and try again.";
  const data = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const code = typeof data.code === "string" ? data.code : typeof data.error_code === "string" ? data.error_code : "";
  const messages: Record<string, string> = {
    invalid_credentials: "Email or password is incorrect. Check both, or use Forgot password.",
    email_not_confirmed: "Confirm your email before signing in. Check your inbox and spam folder.",
    email_address_invalid: "This email address is not accepted. Check the address or use another work email.",
    validation_failed: "The account details were rejected. Check your email address and password.",
    email_exists: "An account already uses this email. Sign in or use Forgot password.",
    user_already_exists: "An account already uses this email. Sign in or use Forgot password.",
    weak_password: "This password does not meet the security requirements. Use a longer, unique password.",
    same_password: "Choose a password different from your current password.",
    over_email_send_rate_limit: "Too many emails were requested. Wait a few minutes before requesting another.",
    over_request_rate_limit: "Too many attempts. Wait a few minutes and try again.",
    request_timeout: "The account service took too long to respond. Try again.",
    otp_expired: "This email link has expired or was already used. Request a new link.",
    email_provider_disabled: "Email sign-up is currently unavailable. Contact LOCKE support.",
    signup_disabled: "New account registration is currently unavailable. Contact LOCKE support.",
    email_address_not_authorized: "Email delivery is not enabled for this address. Contact LOCKE support.",
    session_expired: "Your session expired. Sign in again.",
    bad_jwt: "This session is invalid or expired. Sign in again.",
  };
  if (code === "weak_password") {
    const weak = data.weak_password as { reasons?: unknown } | undefined;
    const reasons = Array.isArray(weak?.reasons) ? weak.reasons : [];
    if (reasons.includes("pwned")) return "This password has appeared in a data breach. Choose a different, unique password.";
    if (reasons.includes("length")) return "Password is too short for the account security policy. Use a longer password (at least 12 characters).";
    if (reasons.includes("characters")) return "Password needs the character types required by the account security policy. Include upper- and lowercase letters, a number and a symbol.";
  }
  if (Object.hasOwn(messages,code)) return messages[code];
  if (status === 429) return messages.over_request_rate_limit;
  if (status && status >= 500) return "The account service could not complete this request. Try again shortly; contact LOCKE support if it continues.";
  // Never expose backend SQL, tokens or untrusted server messages in the UI.
  return "The account request failed. Try again; contact LOCKE support if it continues.";
}

export async function authRequest(url: string, init: RequestInit): Promise<Response> {
  try { return await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) }); }
  catch (error) { throw new Error(authErrorMessage(error)); }
}
