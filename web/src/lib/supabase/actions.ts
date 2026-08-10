"use server";

import { createClient } from "@/lib/supabase/server";

import { redirect } from "next/navigation";

/**
 * Origin used to build auth callback links. `NEXT_PUBLIC_SITE_URL` is the name
 * that actually exists in .env.local — an earlier version read
 * NEXT_PUBLIC_APP_URL, which is undefined, so every reset link in production
 * would have pointed at localhost.
 */
function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100";
}

export async function signInAction(prevState: unknown, formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Please provide email and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/dashboard");
}

export async function signUpAction(prevState: unknown, formData: FormData) {
  const firstName = formData.get("first_name") as string;
  const lastName = formData.get("last_name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!firstName || !email || !password) {
    return { error: "Please fill in all required fields." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName || "",
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/welcome");
}

export async function forgotPasswordAction(prevState: unknown, formData: FormData) {

  const email = formData.get("email") as string;

  if (!email) {
    return { error: "Please enter your email address." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    // Must land on /reset-password, not on a settings page. The recovery link
    // grants a session, so sending it anywhere else logs the user in without
    // ever asking for the new password — the reset silently never happens.
    redirectTo: `${siteUrl()}/auth/callback?next=/reset-password`,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: "Password reset link sent to your email." };
}

/**
 * Sets the new password. Reached only from the recovery link, which has already
 * exchanged its code for a session in /auth/callback — `updateUser` acts on
 * that session, so there is no token to pass here.
 */
export async function resetPasswordAction(prevState: unknown, formData: FormData) {
  const password = formData.get("password") as string;
  const confirm = formData.get("confirm_password") as string;

  if (!password || !confirm) {
    return { error: "Please fill in both password fields." };
  }
  if (password !== confirm) {
    return { error: "The two passwords do not match." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const supabase = await createClient();

  // No session means the link expired or was already used. Without this check
  // updateUser fails with a confusing generic error.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "This reset link has expired. Please request a new one." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: error.message };
  }

  redirect("/dashboard");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
