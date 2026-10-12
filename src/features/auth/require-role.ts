import { redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { roleHome, type AppRole } from "@/lib/roles";

import { getOwnProfile } from "./auth-api";

export type RequiredSession =
  | {
      status: "ready";
      userId: string;
      email: string;
      fullName: string;
      phone: string;
      role: AppRole;
    }
  | { status: "profile-error"; message: string };

export async function requireRole(expected: AppRole): Promise<RequiredSession> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    throw redirect({ to: "/auth" });
  }

  const result = await getOwnProfile(data.session.user.id);
  if (!result.ok) {
    return { status: "profile-error", message: result.message };
  }

  if (result.profile.role !== expected) {
    throw redirect({ to: roleHome[result.profile.role] });
  }

  return {
    status: "ready",
    userId: result.profile.id,
    email: result.profile.email || data.session.user.email || "",
    fullName: result.profile.fullName,
    phone: result.profile.phone,
    role: result.profile.role,
  };
}
