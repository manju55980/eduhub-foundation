import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { roleHome, type AppRole } from "@/lib/roles";

import { getOwnProfile } from "./auth-api";
import { LandingPage } from "./landing-page";
import { ProfileError, SignedInScreen } from "./session-screen";

export function EntryScreen() {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "signed-out" }
    | { status: "profile-error"; message: string }
    | { status: "signed-in"; email: string; role: AppRole }
  >({ status: "loading" });

  useEffect(() => {
    let active = true;

    async function load(userId: string | undefined, email: string | undefined) {
      if (!userId) {
        if (active) setState({ status: "signed-out" });
        return;
      }
      const profile = await getOwnProfile(userId);
      if (!active) return;
      if (!profile.ok) {
        setState({ status: "profile-error", message: profile.message });
        return;
      }
      setState({
        status: "signed-in",
        email: profile.profile.email || email || "",
        role: profile.profile.role,
      });
    }

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => {
        void load(session?.user.id, session?.user.email);
      }, 0);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  if (state.status === "profile-error") {
    return <ProfileError message={state.message} />;
  }

  if (state.status === "signed-in") {
    return (
      <SignedInScreen email={state.email} role={state.role}>
        <Button asChild>
          <Link to={roleHome[state.role]}>Continue</Link>
        </Button>
      </SignedInScreen>
    );
  }

  return <LandingPage checking={state.status === "loading"} />;
}
