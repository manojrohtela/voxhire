import { cn } from "@/lib/cn";

/** Inline loading spinner. */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn("inline-block border-2 border-primary border-t-transparent rounded-full animate-spin", className || "w-5 h-5")}
    />
  );
}

/** Full-area centered loader. */
export function LoadingScreen({ label }: { label?: string }) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
      <Spinner className="w-8 h-8" />
      {label && <p className="text-foreground-3 text-sm">{label}</p>}
    </div>
  );
}

/** Skeleton block for loading placeholders. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("bg-ink/[0.06] rounded-lg animate-pulse", className)} />;
}

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center py-12 px-6", className)}>
      {icon && (
        <div className="w-12 h-12 rounded-full bg-ink/[0.05] border border-base flex items-center justify-center text-foreground-4 mb-4">
          {icon}
        </div>
      )}
      <p className="text-foreground font-medium text-sm mb-1">{title}</p>
      {description && <p className="text-foreground-3 text-sm max-w-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
