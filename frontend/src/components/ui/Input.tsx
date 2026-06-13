import { forwardRef } from "react";
import { cn } from "@/lib/cn";

const fieldBase =
  "w-full bg-surface-hi border border-base rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-foreground-4 transition-colors focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 disabled:opacity-50";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(fieldBase, className)} {...props} />
  )
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(fieldBase, "resize-y min-h-[80px]", className)} {...props} />
  )
);
Textarea.displayName = "Textarea";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("text-foreground-3 text-xs font-medium uppercase tracking-wider block mb-2", className)}
      {...props}
    />
  );
}

export function Field({ label, hint, children }: { label?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      {label && <Label>{label}</Label>}
      {children}
      {hint && <p className="text-foreground-4 text-xs mt-1">{hint}</p>}
    </div>
  );
}
