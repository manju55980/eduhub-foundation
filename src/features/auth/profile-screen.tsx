import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { Save } from "lucide-react";

import { PageHeader } from "@/components/app-shell/page-header";
import { ErrorState, LoadingState } from "@/components/app-shell/page-state";
import { PageSection } from "@/components/app-shell/record-card";
import { StatusBadge } from "@/components/app-shell/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SaveNotice } from "@/features/instructor/save-notice";
import type { AppRole } from "@/lib/roles";

import { getOwnProfile, updateOwnProfile } from "./auth-api";
import { profileDraft, profileUpdate } from "./profile-draft";

type Notice = { saved: boolean; message: string };

const emptyNotice: Notice = { saved: false, message: "" };

export function ProfileScreen({
  userId,
  title,
  role,
}: {
  userId: string;
  title: string;
  role: AppRole;
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<Notice>(emptyNotice);

  useEffect(() => {
    let active = true;
    getOwnProfile(userId).then((result) => {
      if (!active) return;
      setLoading(false);
      if (!result.ok) {
        setLoadError(result.message);
        return;
      }
      setFullName(result.profile.fullName);
      setEmail(result.profile.email);
      setPhone(result.profile.phone);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const draft = profileDraft(fullName, email, phone);
    setPending(true);
    const result = await updateOwnProfile(userId, profileUpdate(draft));
    setPending(false);

    if (!result.ok) {
      setNotice({ saved: false, message: result.message });
      return;
    }

    setFullName(draft.fullName ?? "");
    setEmail(draft.email ?? "");
    setPhone(draft.phone ?? "");
    setNotice({ saved: true, message: "This profile was saved." });
    void router.invalidate();
  }

  return (
    <PageSection className="max-w-xl">
      <PageHeader title={title} />
      <SaveNotice
        tone={role}
        saved={notice.saved}
        message={loadError ? "" : notice.message}
        onDismiss={() => setNotice(emptyNotice)}
      />
      {loadError ? <ErrorState message={loadError} /> : null}
      {loading ? <LoadingState message="Loading profile…" /> : null}
      {!loading && !loadError ? (
        <form
          className="space-y-4 rounded-sm border border-border bg-card p-4 shadow-none"
          onSubmit={handleSubmit}
        >
          <Field id="profile-name" label="Name">
            <Input
              id="profile-name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              disabled={pending}
            />
          </Field>
          <Field id="profile-email" label="Email">
            <Input
              id="profile-email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={pending}
            />
          </Field>
          <Field id="profile-phone" label="Phone">
            <Input
              id="profile-phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              disabled={pending}
            />
          </Field>
          <div className="space-y-2">
            <p className="text-sm font-medium leading-snug text-foreground">Role</p>
            <StatusBadge value={role} />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            <Save />
            {pending ? "Saving…" : "Save profile"}
          </Button>
        </form>
      ) : null}
    </PageSection>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
