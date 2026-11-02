import { useId } from "react";

export function LessonProgressSummary({
  completed,
  total,
  progress,
}: {
  completed: number;
  total: number;
  progress: number;
}) {
  const labelId = useId();
  const width = Math.min(100, Math.max(0, progress));
  const count = `${completed} of ${total} lessons complete`;
  const percent = `${progress}%`;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm text-foreground">
        <p id={labelId}>{count}</p>
        <p className="font-semibold tabular-nums">{percent}</p>
      </div>
      <div
        className="mt-2 h-2 w-full rounded-md bg-muted"
        role="progressbar"
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={width}
        aria-valuetext={`${count}, ${percent}`}
      >
        <div className="h-full rounded-md bg-positive" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}
