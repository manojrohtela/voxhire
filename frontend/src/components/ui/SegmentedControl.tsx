"use client";

import { cn } from "@/lib/cn";

interface SegmentedControlProps<T extends string | number> {
  options: readonly { label: string; value: T }[] | readonly T[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  /** number of columns; defaults to flex row */
  columns?: number;
}

/** Pill button group — replaces the repeated "row of selectable buttons" pattern. */
export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  className,
  columns,
}: SegmentedControlProps<T>) {
  const items = options.map((o) =>
    typeof o === "object" ? o : ({ label: String(o), value: o } as { label: string; value: T })
  );
  return (
    <div
      role="radiogroup"
      className={cn("gap-2", columns ? "grid" : "flex", className)}
      style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}
    >
      {items.map(({ label, value: v }) => {
        const active = v === value;
        return (
          <button
            key={String(v)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(v)}
            className={cn(
              "flex-1 py-2 rounded-lg text-xs font-medium border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
              active
                ? "bg-primary/15 border-primary/30 text-primary"
                : "border-base text-foreground-3 hover:text-foreground hover:border-strong"
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
