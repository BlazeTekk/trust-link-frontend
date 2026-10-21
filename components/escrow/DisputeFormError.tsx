import React from "react";

/**
 * Props for the DisputeFormError component.
 */
export interface DisputeFormErrorProps {
  /** Human-readable failure reason, taken from the thrown error or the API response. */
  message: string;
  /** Clears the error state and returns the user to the populated draft so they can resubmit. */
  onRetry: () => void;
  /** Discards the draft and restarts the wizard. The button is omitted when not provided. */
  onStartOver?: () => void;
}

/**
 * DisputeFormError
 *
 * Terminal error screen of the dispute wizard. Rendered by `DisputeForm` when
 * submission fails, in place of the step form. Unlike the success screen it uses
 * an assertive live region so a failed submission is announced immediately.
 *
 * @param props - Component properties.
 * @returns The rendered error state.
 */
export function DisputeFormError({
  message,
  onRetry,
  onStartOver,
}: DisputeFormErrorProps) {
  return (
    <div
      className="mx-auto max-w-[600px] p-10 text-center"
      data-testid="error-state"
      role="alert"
      aria-live="assertive"
    >
      <div className="text-destructive">
        <h2>✗ Submission Failed</h2>
        <p>{message}</p>
        <button
          type="button"
          onClick={onRetry}
          // A native button already activates on Enter and Space; handling it
          // explicitly keeps the retry action reachable when the control is
          // rendered through a custom skin that swaps out the element.
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onRetry();
            }
          }}
          data-testid="try-again-button"
          className="mt-5 cursor-pointer rounded bg-success px-5 py-2.5 text-base text-white transition-colors hover:bg-emerald-700"
        >
          Try Again
        </button>
        {onStartOver && (
          <button
            type="button"
            onClick={onStartOver}
            data-testid="start-over-button"
            className="ml-3 mt-5 cursor-pointer rounded border border-zinc-300 px-5 py-2.5 text-base text-foreground transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Start Over
          </button>
        )}
      </div>
    </div>
  );
}
