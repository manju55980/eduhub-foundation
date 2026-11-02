import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const tones = {
  progress: "border-transparent bg-progress-soft text-progress-foreground",
  done: "border-transparent bg-positive-soft text-positive-foreground",
  attention: "border-active bg-card text-active",
  muted: "border-transparent bg-muted text-muted-foreground",
} as const;

const statuses: Record<string, { label: string; tone: keyof typeof tones }> = {
  draft: { label: "Draft", tone: "muted" },
  pending: { label: "Pending", tone: "attention" },
  published: { label: "Published", tone: "done" },
  archived: { label: "Archived", tone: "muted" },
  active: { label: "Active", tone: "progress" },
  completed: { label: "Completed", tone: "done" },
  submitted: { label: "Submitted", tone: "progress" },
  graded: { label: "Graded", tone: "done" },
  student: { label: "Student", tone: "progress" },
  instructor: { label: "Instructor", tone: "done" },
  admin: { label: "Admin", tone: "attention" },
};

export function StatusBadge({ value }: { value: string }) {
  const status = statuses[value] ?? { label: value, tone: "muted" as const };
  return (
    <Badge
      variant="outline"
      className={cn(
        "shrink-0 whitespace-nowrap rounded-full font-semibold shadow-none",
        tones[status.tone],
      )}
    >
      {status.label}
    </Badge>
  );
}
