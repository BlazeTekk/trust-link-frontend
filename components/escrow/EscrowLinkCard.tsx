"use client";

import { useEffect, useRef, useState } from "react";

import FetchErrorState, {
  getFetchErrorMessage,
} from "@/components/ui/FetchErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { track } from "@/lib/analytics";

import EscrowLinkDetails from "./EscrowLinkDetails";
import EscrowLinkHeader from "./EscrowLinkHeader";
import EscrowLinkQRCode from "./EscrowLinkQRCode";
import EscrowLinkShareButtons from "./EscrowLinkShareButtons";

/** Caller-owned presentation data for a single shareable escrow. */
export interface EscrowLinkData {
  title: string;
  status: string;
  amount: number;
  escrowId: string;
  url: string;
  imageUrl?: string;
}

/** Props for the EscrowLinkCard component. */
export interface EscrowLinkCardProps {
  link?: EscrowLinkData | null;
  error?: Error | null;
  onRetry?: () => void;
  /** When true, renders a skeleton loading placeholder instead of the card. */
  loading?: boolean;
  /** Callback invoked after a successful clipboard copy. */
  onCopySuccess?: () => void;
  /** Callback invoked when a clipboard copy attempt fails. */
  onCopyError?: (err: Error) => void;
}

/** Displays caller-supplied escrow data; the caller owns fetching and retry. */
export default function EscrowLinkCard({
  link,
  loading = false,
  error,
  onRetry,
  onCopySuccess,
  onCopyError,
}: EscrowLinkCardProps) {
  if (loading) {
    return (
      <div
        role="status"
        aria-label="Loading escrow link"
        className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
      >
        <Skeleton className="mb-4 h-6 w-2/3" />
        <Skeleton className="mb-4 h-4 w-1/2" />
        <Skeleton className="h-12 w-full rounded-3xl" />
      </div>
    );
  }
  if (error) {
    return (
      <FetchErrorState
        title="We couldn't load your shareable link"
        message={getFetchErrorMessage(error, "Failed to load escrow link details.")}
        onRetry={onRetry}
      />
    );
  }
  if (!link) {
    return (
      <p role="status" className="rounded-3xl border p-6 text-sm">
        Select an escrow to view its payment link.
      </p>
    );
  }
  return (
    <LoadedEscrowLinkCard
      key={`${link.escrowId}:${link.url}`}
      link={link}
      onCopySuccess={onCopySuccess}
      onCopyError={onCopyError}
    />
  );
}

function LoadedEscrowLinkCard({
  link,
  onCopySuccess,
  onCopyError,
}: Pick<EscrowLinkCardProps, "onCopySuccess" | "onCopyError"> & { link: EscrowLinkData }) {
  const qrRef = useRef<HTMLDivElement>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    };
  }, []);
  const [isCopying, setIsCopying] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "success" | "error">(
    "idle"
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleNativeShare = async () => {
    if (!navigator.share || !link) return;
    try {
      await navigator.share({
        title: link.title,
        text: `Pay for your order securely using TrustLink: ${link.url}`,
        url: link.url,
      });
      await track("link_shared", { platform: "native", method: "escrow_card" });
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error("Share failed:", err);
      }
    }
  };

  const handleCopy = async () => {
    if (isCopying) return;
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    try {
      setIsCopying(true);
      setErrorMsg(null);
      if (!navigator.clipboard || !navigator.clipboard.writeText) {
        throw new Error("Clipboard not supported");
      }
      await navigator.clipboard.writeText(link.url);
      setCopyStatus("success");
      onCopySuccess?.();
      track("link_copied", { method: "copy_button" });
      feedbackTimer.current = setTimeout(() => setCopyStatus("idle"), 2000);
    } catch (err: unknown) {
      setCopyStatus("error");
      const msg = err instanceof Error ? err.message : "Failed to copy";
      setErrorMsg(msg);
      onCopyError?.(err instanceof Error ? err : new Error(String(err)));
      feedbackTimer.current = setTimeout(() => {
        setCopyStatus("idle");
        setErrorMsg(null);
      }, 2000);
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <EscrowLinkHeader
        title={link.title}
        status={link.status}
        imageUrl={link.imageUrl}
      />
      <EscrowLinkDetails amount={link.amount} escrowId={link.escrowId} />
      <EscrowLinkShareButtons
        url={link.url}
        title={link.title}
        amount={link.amount}
        escrowId={link.escrowId}
        isCopying={isCopying}
        copyStatus={copyStatus}
        errorMsg={errorMsg}
        onCopy={handleCopy}
        onNativeShare={handleNativeShare}
        qrRef={qrRef}
      />
      <EscrowLinkQRCode url={link.url} qrRef={qrRef} />
    </div>
  );
}
