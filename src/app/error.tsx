"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Optionally log to error tracking service in the future
    if (process.env.NODE_ENV !== 'production') {
      console.error(error);
    }
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-sm" style={{ color: 'var(--color-base-text-secondary)' }}>
      <p>Something went wrong.</p>
      <button
        onClick={() => reset()}
        className="rounded-md border px-3 py-1 text-xs"
        style={{ 
          borderColor: 'var(--color-base-icons-tertiary)',
          color: 'var(--color-base-text-primary)'
        }}
      >
        Try again
      </button>
    </div>
  );
}

