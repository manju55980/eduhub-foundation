export type ManagedUser = {
  id: string;
  fullName: string | null;
  email: string | null;
  role: string;
  createdAt: string;
};

export function canPromote(actorId: string, user: { id: string; role: string }) {
  return user.role === "student" && user.id !== actorId;
}
