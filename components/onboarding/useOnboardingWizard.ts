"use client";

import { useRouter } from "next/navigation";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";

import useWallet from "@/hooks/useWallet";
import { saveOnboardingProfile } from "@/lib/local-profile";

export type OnboardingStep = 0 | 1 | 2;

export interface VendorOnboardingState {
  step: OnboardingStep;
  shopName: string;
  description: string;
  website: string;
  shippingLocations: string;
  completed: boolean;
}

export interface ValidationErrors {
  shopName?: string;
  description?: string;
  website?: string;
}

const STORAGE_KEY = "vendor.onboarding.state";

const defaultState: VendorOnboardingState = {
  step: 0,
  shopName: "",
  description: "",
  website: "",
  shippingLocations: "",
  completed: false,
};

const DRAFT_TEXT_FIELDS = ["shopName", "description", "website", "shippingLocations"] as const;

function isOnboardingStep(value: unknown): value is OnboardingStep {
  return value === 0 || value === 1 || value === 2;
}

/**
 * Builds a usable draft from untrusted persisted data. Anything that is not a
 * plain object yields the defaults; a step outside 0–2 falls back to the first
 * step; non-string text fields become empty strings. `completed` is never
 * restored because completed drafts are removed from storage, not saved.
 */
function sanitizeWizardState(value: unknown): VendorOnboardingState {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return defaultState;
  }

  const record = value as Record<string, unknown>;
  const state: VendorOnboardingState = {
    ...defaultState,
    step: isOnboardingStep(record.step) ? record.step : defaultState.step,
  };

  for (const field of DRAFT_TEXT_FIELDS) {
    const fieldValue = record[field];
    if (typeof fieldValue === "string") {
      state[field] = fieldValue;
    }
  }

  return state;
}

function loadWizardState(): VendorOnboardingState {
  if (typeof window === "undefined") {
    return defaultState;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? sanitizeWizardState(JSON.parse(raw)) : defaultState;
  } catch {
    return defaultState;
  }
}

function saveWizardState(state: VendorOnboardingState) {
  if (typeof window === "undefined") {
    return;
  }

  // Storage can be unavailable (privacy mode, quota, denied access); the
  // wizard keeps working in memory without persistence.
  try {
    if (state.completed) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore persistence failures.
  }
}

export function useOnboardingWizard() {
  const router = useRouter();
  const wallet = useWallet();
  const [state, setState] = useState<VendorOnboardingState>(defaultState);
  const [hydrated, setHydrated] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [errors, setErrors] = useState<ValidationErrors>({});
  // Set synchronously on completion so a repeated activation before the next
  // render cannot complete onboarding twice.
  const completedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    startTransition(() => {
      setState(loadWizardState());
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    saveWizardState(state);
  }, [hydrated, state]);

  useEffect(() => {
    if (wallet.isConnected && state.step === 0) {
      startTransition(() => setState((current) => ({ ...current, step: 1 })));
    }
  }, [wallet.isConnected, state.step]);

  const isProfileValid = useMemo(
    () => state.shopName.trim().length > 0 && state.description.trim().length >= 20,
    [state.description, state.shopName]
  );

  const buttonDisabled =
    state.step === 0
      ? !wallet.isConnected
      : state.step === 1
      ? !isProfileValid
      : false;

  const updateField = (field: keyof Omit<VendorOnboardingState, "step" | "completed">, value: string) => {
    setState((current) => ({ ...current, [field]: value }));
    if (errors[field as keyof ValidationErrors]) {
      setErrors((current) => ({ ...current, [field]: undefined }));
    }
  };

  const normalizeAndValidateUrl = (input: string): string | null => {
    const trimmed = input.trim();
    if (!trimmed) return null;
    const withProto = /^(https?:\/\/)/i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
      const parsed = new URL(withProto);
      return parsed.toString();
    } catch {
      return null;
    }
  };

  const validateStep1 = (): boolean => {
    const newErrors: ValidationErrors = {};
    if (!state.shopName.trim()) {
      newErrors.shopName = "Shop name is required.";
    }
    if (!state.description.trim()) {
      newErrors.description = "Description is required.";
    } else if (state.description.trim().length < 20) {
      newErrors.description = "Description must be at least 20 characters.";
    }
    if (state.website && state.website.trim()) {
      const normalized = normalizeAndValidateUrl(state.website);
      if (!normalized) {
        newErrors.website = "Please enter a valid website URL.";
      } else if (normalized !== state.website) {
        setState((current) => ({ ...current, website: normalized }));
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const goToStep = (step: OnboardingStep) => {
    setState((current) => ({ ...current, step }));
  };

  const handleNext = () => {
    if (state.step === 1 && !validateStep1()) {
      return;
    }

    if (buttonDisabled) {
      return;
    }

    setState((current) => ({ ...current, step: Math.min(2, current.step + 1) as OnboardingStep }));
    setErrors({});
  };

  const handleBack = () => {
    setState((current) => ({ ...current, step: Math.max(0, current.step - 1) as OnboardingStep }));
  };

  /**
   * Completes onboarding only if its prerequisites still hold. The review step
   * is reachable through the stepper and restored drafts, so the wallet and
   * profile are rechecked here and the user is sent to the step that needs
   * attention instead.
   */
  const handleFinish = () => {
    if (completedRef.current || state.completed) {
      return;
    }

    if (!wallet.isConnected) {
      goToStep(0);
      return;
    }

    if (!validateStep1()) {
      goToStep(1);
      return;
    }

    try {
      saveOnboardingProfile({
        ...state,
        website: normalizeAndValidateUrl(state.website) ?? "",
      });
      setSaveError(null);
    } catch {
      setSaveError("Couldn't save your profile in this browser. Your draft is still here. Allow site storage or free up space, then try Finish again.");
      return;
    }

    completedRef.current = true;
    setState((current) => ({ ...current, completed: true }));
    router.push("/dashboard");
  };

  const goToDashboard = () => {
    router.push("/dashboard");
  };

  return {
    wallet,
    state,
    errors,
    saveError,
    isProfileValid,
    buttonDisabled,
    updateField,
    goToStep,
    handleBack,
    handleNext,
    handleFinish,
    goToDashboard,
  };
}
