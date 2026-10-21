import { useState } from "react";
import { User } from "lucide-react";

import { StatusBadge } from "@/components/app-shell/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { AppRole } from "@/lib/roles";

import { profileInitials } from "./profile-draft";
import { ProfileEditor } from "./profile-screen";

export function ProfileMenu({
  role,
  email,
  fullName,
  userId,
}: {
  role: AppRole;
  email: string;
  fullName: string;
  userId: string;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const name = fullName || email || "Signed in";
  const initials = profileInitials(fullName, email);

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8 shrink-0 rounded-sm shadow-none"
            aria-label="Open profile"
          >
            {initials ? (
              <span className="text-xs font-medium">{initials}</span>
            ) : (
              <User className="size-4" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 space-y-2 rounded-sm p-3 shadow-none">
          <p className="text-sm font-medium text-foreground [overflow-wrap:anywhere]">{name}</p>
          {email ? (
            <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{email}</p>
          ) : null}
          <StatusBadge value={role} />
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              setOpen(false);
              setEditing(true);
            }}
          >
            Edit Profile
          </Button>
        </PopoverContent>
      </Popover>
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-h-[calc(100vh-2rem)] max-w-md overflow-y-auto rounded-sm shadow-none sm:rounded-sm">
          <DialogHeader>
            <DialogTitle>Edit profile</DialogTitle>
            <DialogDescription>Update your name, email, and phone.</DialogDescription>
          </DialogHeader>
          {editing ? <ProfileEditor userId={userId} role={role} framed={false} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
