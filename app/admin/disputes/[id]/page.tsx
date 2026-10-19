import type { Metadata } from "next";
import { Suspense } from "react";

import { Breadcrumb } from "@/components/ui/Breadcrumb";

import { DisputeDetailsClient } from "./DisputeDetailsClient";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Dispute #${id.slice(0, 8)} | TrustLink Admin`,
    description: "Review and resolve escrow disputes on TrustLink.",
  };
}

export default async function DisputeDetailsPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <div className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Breadcrumb
            className="mb-4"
            items={[
              { label: "Home", href: "/" },
              { label: "Disputes", href: "/admin/disputes" },
              { label: `Dispute #${id.slice(0, 8)}` },
            ]}
          />
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Dispute Details</h1>
        </div>

        <Suspense fallback={null}>
          <DisputeDetailsClient disputeId={id} />
        </Suspense>
      </div>
    </div>
  );
}
