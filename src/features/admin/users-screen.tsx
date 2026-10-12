import { useEffect, useState } from "react";

import { DataCell, DataRow, DataTable } from "@/components/app-shell/data-table";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/app-shell/page-state";
import { StatusBadge } from "@/components/app-shell/status-badge";
import { Button } from "@/components/ui/button";
import { SaveNotice } from "@/features/instructor/save-notice";

import { listUsers, promoteStudent } from "./users-api";
import { canPromote, type ManagedUser } from "./users";

type Notice = { saved: boolean; message: string };

const emptyNotice: Notice = { saved: false, message: "" };

export function UsersScreen({ adminId }: { adminId: string }) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(emptyNotice);

  useEffect(() => {
    let active = true;
    listUsers().then((result) => {
      if (!active) return;
      setLoading(false);
      if (!result.ok) {
        setLoadError(result.message);
        return;
      }
      setUsers(result.users);
    });
    return () => {
      active = false;
    };
  }, []);

  async function handlePromote(userId: string) {
    if (pendingId) return;

    setPendingId(userId);
    const result = await promoteStudent(userId);
    setPendingId(null);
    if (!result.ok) {
      setNotice({ saved: false, message: result.message });
      return;
    }

    setUsers((current) =>
      current.map((user) => (user.id === userId ? { ...user, role: "instructor" } : user)),
    );
    setNotice({ saved: true, message: "This user was promoted to instructor." });
  }

  return (
    <section className="max-w-6xl space-y-4">
      <PageHeader title="Manage Users" />
      <SaveNotice
        tone="admin"
        saved={notice.saved}
        message={loadError ? "" : notice.message}
        onDismiss={() => setNotice(emptyNotice)}
      />
      {loadError ? <ErrorState message={loadError} /> : null}
      {loading ? <LoadingState message="Loading users…" /> : null}
      {!loading && !loadError && users.length === 0 ? (
        <EmptyState message="There are no users yet." />
      ) : null}
      {!loading && !loadError && users.length > 0 ? (
        <DataTable columns={["Name", "Email", "Role", "Created", "Action"]}>
          {users.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              adminId={adminId}
              pending={pendingId === user.id}
              onPromote={handlePromote}
            />
          ))}
        </DataTable>
      ) : null}
    </section>
  );
}

function UserRow({
  user,
  adminId,
  pending,
  onPromote,
}: {
  user: ManagedUser;
  adminId: string;
  pending: boolean;
  onPromote: (userId: string) => void;
}) {
  return (
    <DataRow>
      <DataCell heading>{user.fullName ?? ""}</DataCell>
      <DataCell>{user.email ?? ""}</DataCell>
      <DataCell>
        <StatusBadge value={user.role} />
      </DataCell>
      <DataCell>{formatCreatedAt(user.createdAt)}</DataCell>
      <DataCell>
        {canPromote(adminId, user) ? (
          <Button type="button" size="sm" disabled={pending} onClick={() => onPromote(user.id)}>
            {pending ? "Promoting…" : "Promote"}
          </Button>
        ) : null}
      </DataCell>
    </DataRow>
  );
}

function formatCreatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}
