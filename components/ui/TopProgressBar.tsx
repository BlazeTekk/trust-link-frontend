"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { startTransition, useEffect, useRef, useState } from "react";

const NAVIGATION_ABANDON_TIMEOUT_MS = 30_000;

export default function TopProgressBar() {
  const [isNavigating, setIsNavigating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [navigationStartUrl, setNavigationStartUrl] = useState<string | null>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentUrl = `${pathname}?${searchParams.toString()}`;
  const currentUrlRef = useRef(currentUrl);
  const progressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abandonmentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    currentUrlRef.current = currentUrl;
  }, [currentUrl]);

  // Complete only after the router has committed a different path or query.
  useEffect(() => {
    if (navigationStartUrl !== null && currentUrl !== navigationStartUrl) {
      if (abandonmentTimerRef.current) {
        clearTimeout(abandonmentTimerRef.current);
        abandonmentTimerRef.current = null;
      }
      startTransition(() => setProgress(100));
      completionTimerRef.current = setTimeout(() => {
        setIsNavigating(false);
        setProgress(0);
        setNavigationStartUrl(null);
        completionTimerRef.current = null;
      }, 300); // Wait for the transition to finish before hiding
    }
  }, [currentUrl, navigationStartUrl]);

  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent, target: HTMLAnchorElement) => {
      // Don't intercept if it's opening in a new tab or has a target
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.altKey ||
        e.ctrlKey ||
        e.metaKey ||
        e.shiftKey ||
        target.target === "_blank" ||
        target.target === "_top"
      ) {
        return;
      }

      // Check if the link is internal and goes to a different path
      const href = target.href;
      if (!href) return;

      const targetUrl = new URL(href, window.location.origin);
      if (targetUrl.origin !== window.location.origin) return;

      // Only show progress for different paths (ignoring hash changes)
      if (
        targetUrl.pathname !== window.location.pathname ||
        targetUrl.search !== window.location.search
      ) {
        if (completionTimerRef.current) clearTimeout(completionTimerRef.current);
        if (abandonmentTimerRef.current) clearTimeout(abandonmentTimerRef.current);
        setNavigationStartUrl(currentUrlRef.current);
        setIsNavigating(true);
        setProgress(15);
        abandonmentTimerRef.current = setTimeout(() => {
          setIsNavigating(false);
          setProgress(0);
          setNavigationStartUrl(null);
          abandonmentTimerRef.current = null;
        }, NAVIGATION_ABANDON_TIMEOUT_MS);
      }
    };

    // Use event delegation on the document body
    const handleDocumentClick = (e: MouseEvent) => {
      // Find the closest anchor tag
      const anchor = (e.target as Element).closest("a");
      if (anchor) {
        handleAnchorClick(e, anchor);
      }
    };

    document.addEventListener("click", handleDocumentClick);

    return () => {
      document.removeEventListener("click", handleDocumentClick);
    };
  }, []);

  useEffect(() => () => {
    if (progressTimerRef.current) clearTimeout(progressTimerRef.current);
    if (completionTimerRef.current) clearTimeout(completionTimerRef.current);
    if (abandonmentTimerRef.current) clearTimeout(abandonmentTimerRef.current);
  }, []);

  // Simulate progress increasing over time
  useEffect(() => {
    if (isNavigating && progress < 90) {
      progressTimerRef.current = setTimeout(() => {
        progressTimerRef.current = null;
        setProgress((prev) => {
          // Slow down the progress as it gets higher
          const inc = prev < 50 ? 10 : prev < 80 ? 5 : 2;
          return Math.min(prev + inc, 90);
        });
      }, 300);
    }
    return () => {
      if (progressTimerRef.current) {
        clearTimeout(progressTimerRef.current);
        progressTimerRef.current = null;
      }
    };
  }, [isNavigating, progress]);

  if (!isNavigating && progress === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-1 bg-transparent overflow-hidden">
      <div
        className="h-full bg-blue-600 transition-all duration-300 ease-out dark:bg-blue-500"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
