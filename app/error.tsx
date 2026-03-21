"use client";

import { useEffect } from "react";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    const message = error instanceof Error ? error.message : String(error);
    const name = error instanceof Error ? error.name : "UnknownError";

    console.error("Unhandled app route error", {
      name,
      message,
      digest: typeof error?.digest === "string" ? error.digest : undefined,
      error,
    });
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-muted-foreground">
        An unexpected error occurred. Please retry, or refresh if the problem persists.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
      >
        Try again
      </button>
    </div>
  );
}
