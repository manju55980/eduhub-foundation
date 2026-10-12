import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";

import { ErrorState } from "@/components/app-shell/page-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { roleHome } from "@/lib/roles";

import { getOwnProfile, signInWithEmail, signInWithGoogle, signUpWithEmail } from "./auth-api";

type AuthMode = "sign-in" | "sign-up";

export function AuthScreen() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) return;
      setTimeout(() => {
        if (!active) return;
        void getOwnProfile(session.user.id).then((profile) => {
          if (!active) return;
          if (!profile.ok) {
            setMessage(profile.message);
            return;
          }
          void navigate({ to: roleHome[profile.profile.role] });
        });
      }, 0);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [navigate]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setPending(true);

    if (mode === "sign-up") {
      const result = await signUpWithEmail(email, password, fullName);
      setPending(false);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      if (result.needsEmailConfirmation) {
        setMessage("Check your email to confirm the account, then sign in.");
        setMode("sign-in");
        return;
      }
      await navigateAfterSession();
      return;
    }

    const result = await signInWithEmail(email, password);
    setPending(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    await navigateAfterSession();
  }

  async function navigateAfterSession() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      setMessage("Signed in, but no session was stored.");
      return;
    }
    const profile = await getOwnProfile(data.session.user.id);
    if (!profile.ok) {
      setMessage(profile.message);
      return;
    }
    await navigate({ to: roleHome[profile.profile.role] });
  }

  async function handleGoogle() {
    setMessage("");
    setPending(true);
    const result = await signInWithGoogle();
    setPending(false);
    if (!result.ok) setMessage(result.message);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <section className="w-full max-w-md space-y-4 rounded-sm border bg-card p-4 text-card-foreground shadow-none">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-foreground">
            {mode === "sign-in" ? "Sign in" : "Create account"}
          </h1>
          <p className="text-sm text-muted-foreground">New accounts are students.</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {mode === "sign-up" ? (
            <div className="space-y-2">
              <Label htmlFor="full-name">Full name</Label>
              <Input
                id="full-name"
                autoComplete="name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          {message ? <ErrorState message={message} /> : null}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleGoogle}
          disabled={pending}
        >
          Continue with Google
        </Button>

        <button
          type="button"
          className="text-sm text-primary underline-offset-4 hover:underline"
          onClick={() => {
            setMode(mode === "sign-in" ? "sign-up" : "sign-in");
            setMessage("");
          }}
        >
          {mode === "sign-in" ? "Need an account? Create one" : "Already have an account? Sign in"}
        </button>
      </section>
    </main>
  );
}
