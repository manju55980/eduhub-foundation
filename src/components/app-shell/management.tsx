import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { panelClass } from "./record-card";

export function matchesQuery(query: string, values: Array<string | null | undefined>) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return values.some((value) => (value ?? "").toLowerCase().includes(needle));
}

export function FilterToolbar({
  id,
  label = "Search",
  value,
  placeholder,
  onChange,
  controlsLabel,
  children,
}: {
  id: string;
  label?: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  controlsLabel?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0 flex-1 space-y-1.5 lg:max-w-xl">
        <Label htmlFor={id}>{label}</Label>
        <Input
          id={id}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      {children ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label={controlsLabel}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function ChoiceButton({
  pressed,
  children,
  onClick,
}: {
  pressed: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={pressed ? "default" : "outline"}
      aria-pressed={pressed}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export function SummaryCounts({
  items,
  value,
  onChange,
}: {
  items: { value: string; label: string; action: string; count: number }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          aria-pressed={value === item.value}
          className={cn(
            panelClass,
            "space-y-1 p-3 text-left transition-colors hover:bg-accent",
            value === item.value && "border-primary",
          )}
          onClick={() => onChange(item.value)}
        >
          <span className="block text-xs font-medium text-muted-foreground">{item.label}</span>
          <span className="block text-xl font-semibold tabular-nums text-foreground">
            {item.count}
          </span>
          <span className="block text-xs font-medium text-primary">{item.action}</span>
        </button>
      ))}
    </div>
  );
}

export function ResultBar({
  count,
  singular,
  plural,
  children,
}: {
  count: number;
  singular: string;
  plural: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">
        {count} {count === 1 ? singular : plural}
      </p>
      {children}
    </div>
  );
}
