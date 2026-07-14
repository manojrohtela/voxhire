"use client";

import { useState } from "react";
import { DemoRequestModal } from "./DemoRequestModal";

/**
 * Client island for the (server-rendered) marketing homepage: the button owns
 * the modal state so page.tsx can stay a server component.
 */
export default function DemoButton({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children}
      </button>
      <DemoRequestModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
