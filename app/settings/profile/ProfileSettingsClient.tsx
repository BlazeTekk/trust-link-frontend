"use client";

import { startTransition,useEffect, useState } from "react";

import useWallet from "@/hooks/useWallet";

const STORAGE_KEY = "vendor.profile";

type ProfileValues = {
  businessName: string;
  displayName: string;
  email: string;
  bio: string;
};

type ProfileErrors = Partial<Record<keyof ProfileValues, string>>;

function describeStorageError(err: unknown): string {
  const name = err instanceof Error || err instanceof DOMException ? err.name : "";
  if (name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED") {
    return "Couldn't save your profile: browser storage is full. Free up site data for this browser and try again.";
  }
  if (name === "SecurityError") {
    return "Couldn't save your profile: this browser is blocking site storage. Allow storage for this site (or leave private browsing) and try again.";
  }
  return "Couldn't save your profile. Your changes are still here — please try again.";
}

const DEFAULT_VALUES: ProfileValues = {
  businessName: "",
  displayName: "",
  email: "",
  bio: "",
};

const PROFILE_FIELDS = Object.keys(DEFAULT_VALUES) as (keyof ProfileValues)[];

/**
 * Merges the supported string fields from untrusted stored data over the
 * defaults. Non-object payloads, unknown keys and non-string values are ignored
 * so every input stays controlled and validation never sees a non-string.
 */
function parseStoredProfile(raw: unknown): ProfileValues {
  const restored = { ...DEFAULT_VALUES };
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return restored;
  const record = raw as Record<string, unknown>;
  for (const field of PROFILE_FIELDS) {
    const value = record[field];
    if (typeof value === "string") restored[field] = value;
  }
  return restored;
}

export default function ProfileSettingsClient() {
  const { publicKey } = useWallet();
  const [values, setValues] = useState<ProfileValues>(DEFAULT_VALUES);
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const restored = parseStoredProfile(JSON.parse(stored));
        startTransition(() => setValues(restored));
      }
    } catch {
      // ignore malformed storage
    }
  }, []);

  const updateField = (field: keyof ProfileValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    setSaved(false);
  };

  const validate = (v: ProfileValues): ProfileErrors => {
    const errs: ProfileErrors = {};
    if (!v.businessName.trim()) errs.businessName = "Business name is required.";
    if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) {
      errs.email = "Enter a valid email address.";
    }
    return errs;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate(values);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setIsSaving(true);
    setSaved(false);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
      setSaveError(null);
      setSaved(true);
    } catch (err) {
      // Keep the edited values in state so the user can retry without retyping.
      setSaveError(describeStorageError(err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-50 p-6 dark:bg-black">
      <div className="mx-auto max-w-xl">
        <h1 className="mb-6 text-3xl font-semibold text-zinc-950 dark:text-white">
          Profile Settings
        </h1>

        {publicKey && (
          <div className="mb-6 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Wallet Address</p>
            <p className="mt-1 break-all font-mono text-sm text-zinc-950 dark:text-zinc-100">
              {publicKey}
            </p>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="space-y-5">
            <div>
              <label
                htmlFor="businessName"
                className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Business Name <span className="text-red-500">*</span>
              </label>
              <input
                id="businessName"
                type="text"
                value={values.businessName}
                onChange={(e) => updateField("businessName", e.target.value)}
                aria-describedby={errors.businessName ? "businessName-error" : undefined}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-950 outline-none focus:border-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-500 dark:focus-visible:ring-zinc-300"
                placeholder="Acme Goods Ltd."
              />
              {errors.businessName && (
                <p id="businessName-error" className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {errors.businessName}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="displayName"
                className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Display Name
              </label>
              <input
                id="displayName"
                type="text"
                value={values.displayName}
                onChange={(e) => updateField("displayName", e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-950 outline-none focus:border-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-500 dark:focus-visible:ring-zinc-300"
                placeholder="@acme"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Contact Email
              </label>
              <input
                id="email"
                type="email"
                value={values.email}
                onChange={(e) => updateField("email", e.target.value)}
                aria-describedby={errors.email ? "email-error" : undefined}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-950 outline-none focus:border-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-500 dark:focus-visible:ring-zinc-300"
                placeholder="hello@acme.com"
              />
              {errors.email && (
                <p id="email-error" className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {errors.email}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="bio"
                className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Short Bio
              </label>
              <textarea
                id="bio"
                rows={3}
                value={values.bio}
                onChange={(e) => updateField("bio", e.target.value)}
                className="w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-950 outline-none focus:border-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-500 dark:focus-visible:ring-zinc-300"
                placeholder="We sell quality goods via secure escrow."
              />
            </div>
          </div>

          <div className="mt-6 flex items-center gap-4">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-2xl bg-zinc-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {isSaving ? "Saving…" : "Save Changes"}
            </button>
            {saved && (
              <p role="status" className="text-sm text-green-600 dark:text-green-400">
                Profile saved.
              </p>
            )}
          </div>
          {saveError && (
            <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
              {saveError}
            </p>
          )}
        </form>
      </div>
    </main>
  );
}
