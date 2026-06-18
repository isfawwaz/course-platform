"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { resolveLanding } from "./landing";
import { getOrigin } from "./origin";

export type AuthState = { error?: string; notice?: string };

/** Email + password sign-in. Redirects to the resolved landing on success. */
export async function login(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: "Invalid email or password." };
  }

  redirect(await resolveLanding(supabase));
}

/** Create an account. Lands the user, or asks them to confirm by email if required. */
export async function signup(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!fullName || !email || !password) {
    return { error: "All fields are required." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const supabase = await createClient();
  const origin = await getOrigin();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      // Default Supabase "Confirm signup" email uses the PKCE code flow → /auth/callback.
      // (Invites are admin-initiated/token_hash and use /auth/confirm instead.)
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });
  if (error) {
    // Keep provider details server-side; don't leak account-existence to the client.
    console.error("signup failed", { code: error.code, status: error.status });
    return { error: "We couldn't create your account. Please try again." };
  }

  // Email-confirmation enabled → no session yet.
  if (!data.session) {
    return { notice: "Account created. Check your email to confirm and sign in." };
  }

  redirect(await resolveLanding(supabase));
}

/**
 * Send a passwordless sign-in link to an existing account. `shouldCreateUser: false`
 * keeps this for granted accounts only (admin-grants model); the notice is identical
 * whether or not the email exists, to avoid user enumeration.
 */
export async function sendMagicLink(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    return { error: "Email is required." };
  }

  const supabase = await createClient();
  const origin = await getOrigin();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      shouldCreateUser: false,
    },
  });
  // Log real failures server-side, but keep the user-facing message identical
  // (enumeration-safe) whether or not the email exists.
  if (error) {
    console.error("sendMagicLink failed", { code: error.code, status: error.status });
  }

  return { notice: "If that email has an account, a sign-in link is on its way." };
}

/** Set/replace the signed-in user's password (used by invited users finishing setup). */
export async function setPassword(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: error.message };
  }

  redirect(await resolveLanding(supabase));
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
