interface NotificationFetchFeedbackProps {
  error: Error | null;
  isLoading: boolean;
  hasLoaded: boolean;
  refetch: () => Promise<void>;
}

/** Shared refresh feedback for the inbox and bell preview. */
export function NotificationFetchFeedback({
  error,
  isLoading,
  hasLoaded,
  refetch,
}: NotificationFetchFeedbackProps) {
  if (!error) {
    return isLoading ? (
      <p role="status" className="p-4 text-sm text-zinc-500 dark:text-zinc-400">
        {hasLoaded ? "Refreshing notifications…" : "Loading notifications…"}
      </p>
    ) : null;
  }

  return (
    <div role="status" className="mb-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
      <p>
        {hasLoaded
          ? "Couldn't refresh notifications. Showing the last successfully loaded feed; it may be out of date."
          : "Couldn't load notifications. Please try again."}
      </p>
      <button
        type="button"
        disabled={isLoading}
        onClick={() => void refetch()}
        className="mt-2 rounded font-semibold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 disabled:opacity-60"
      >
        {isLoading ? "Retrying…" : "Retry"}
      </button>
    </div>
  );
}
