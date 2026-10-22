"use client";

import { useTranslation } from "react-i18next";

import TrackingTimelineSkeleton from "@/components/tracking/TrackingTimelineSkeleton";
import FetchErrorState from "@/components/ui/FetchErrorState";
import { useTracking } from "@/hooks/useTracking";
import { ApiError } from "@/lib/api";

interface TrackingSectionProps {
  escrowId?: string;
}

export default function TrackingSection({ escrowId }: TrackingSectionProps = {}) {
  const { t, i18n } = useTranslation();
  const { data, error, isLoading, refetch } = useTracking(escrowId);
  const missingTracking = error instanceof ApiError && error.status === 404;

  function formatDate(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? t("tracking.dateUnavailable")
      : new Intl.DateTimeFormat(i18n.language, {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(date);
  }

  const details: { label: string; value: string | null | undefined }[] = [
    { label: "tracking.carrier", value: data?.carrier },
    { label: "tracking.trackingNumber", value: data?.trackingNumber },
    { label: "tracking.carrierStatus", value: data?.status },
    { label: "tracking.estimatedDelivery", value: data?.estimatedDelivery ? formatDate(data.estimatedDelivery) : null },
  ];

  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="mb-6 text-lg font-semibold text-zinc-950 dark:text-zinc-100">
        {t("tracking.carrierTracking")}
      </h2>
      {isLoading && !data ? (
        <TrackingTimelineSkeleton />
      ) : null}
      {error && !missingTracking ? (
        <FetchErrorState
          title={t("tracking.carrierLoadErrorTitle")}
          message={t("tracking.carrierLoadError")}
          retryLabel={t("tracking.retry")}
          onRetry={() => { void refetch(); }}
        />
      ) : null}
      {!isLoading && !data && (!error || missingTracking) ? (
        <div className="space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
          <p role="status">{t("tracking.noTracking")}</p>
          {escrowId ? (
            <button type="button" onClick={() => { void refetch(); }} className="rounded-xl border border-zinc-200 px-4 py-2 font-medium dark:border-zinc-700">
              {t("tracking.retry")}
            </button>
          ) : null}
        </div>
      ) : null}
      {data ? (
        <div className="space-y-6">
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            {details.map(({ label, value }) => value ? (
              <div key={label} className="min-w-0">
                <dt className="text-zinc-500 dark:text-zinc-400">{t(label)}</dt>
                <dd className="mt-1 break-words font-medium text-zinc-950 dark:text-zinc-100">{value}</dd>
              </div>
            ) : null)}
          </dl>
          <div>
            <h3 className="mb-3 font-semibold text-zinc-950 dark:text-zinc-100">{t("tracking.carrierEvents")}</h3>
            {data.events.length ? (
              <ol className="space-y-4">
                {data.events.map((event) => (
                  <li key={event.id} className="border-l-2 border-zinc-200 pl-4 text-sm dark:border-zinc-700">
                    <p className="font-medium text-zinc-950 dark:text-zinc-100">{event.status}</p>
                    {event.description ? <p className="mt-1 text-zinc-600 dark:text-zinc-400">{event.description}</p> : null}
                    {event.location ? <p className="mt-1 text-zinc-600 dark:text-zinc-400">{event.location}</p> : null}
                    <p className="mt-1 text-zinc-500 dark:text-zinc-400">{formatDate(event.timestamp)}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("tracking.noCarrierEvents")}</p>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
