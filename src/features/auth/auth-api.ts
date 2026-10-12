import { supabase } from "@/integrations/supabase/client";

import { isAppRole, type AppRole } from "@/lib/roles";
import { signupMetadata } from "./signup-metadata";

export type OwnProfile = {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: AppRole;
};

function authRedirectUrl() {
  return `${window.location.origin}/auth`;
}

export async function signUpWithEmail(email: string, password: string, fullName: string) {
  const metadata = signupMetadata(fullName);
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      emailRedirectTo: authRedirectUrl(),
      ...(metadata ? { data: metadata } : {}),
    },
  });

  if (error) return { ok: false as const, message: error.message };
  return {
    ok: true as const,
    needsEmailConfirmation: !data.session,
  };
}

export async function signInWithEmail(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) return { ok: false as const, message: error.message };
  return { ok: true as const };
}

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: authRedirectUrl() },
  });

  if (error) return { ok: false as const, message: error.message };
  return { ok: true as const };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) return { ok: false as const, message: error.message };
  return { ok: true as const };
}

export async function getOwnProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, phone, role")
    .eq("id", userId)
    .maybeSingle();

  if (error) return { ok: false as const, message: error.message };
  if (!data || !isAppRole(data.role)) {
    return { ok: false as const, message: "Your profile is missing or has an unknown role." };
  }

  return {
    ok: true as const,
    profile: {
      id: data.id,
      email: data.email ?? "",
      fullName: data.full_name ?? "",
      phone: data.phone ?? "",
      role: data.role,
    } satisfies OwnProfile,
  };
}

export async function updateOwnProfile(
  userId: string,
  changes: { full_name: string | null; email: string | null; phone: string | null },
) {
  const { error } = await supabase.from("profiles").update(changes).eq("id", userId);

  if (error) return { ok: false as const, message: error.message };
  return { ok: true as const };
}
