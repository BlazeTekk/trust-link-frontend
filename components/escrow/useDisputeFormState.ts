"use client";

import { useCallback, useRef, useState } from "react";

import type { DisputeFormValues } from "@/lib/validations/dispute";
import {
  DISPUTE_ERRORS,
  isAllowedDisputeMimeType,
  MAX_DISPUTE_FILE_SIZE,
} from "@/lib/validations/dispute";
import {
  validateStep1Data,
  validateStep2Data,
  validateStep3Data,
  validateStep4Data,
} from "@/lib/validations/disputeValidators";
import type { SubmitDisputeFormResponse } from "@/types/api";

type Step = 1 | 2 | 3 | 4;

interface UseDisputeFormStateOptions {
  onSubmit?: (data: DisputeFormValues) => Promise<void>;
  apiEndpoint?: string;
  onSuccess?: (response: SubmitDisputeFormResponse) => void;
  onError?: (error: Error) => void;
}

export function useDisputeFormState({
  onSubmit,
  apiEndpoint = "/api/dispute",
  onSuccess,
  onError,
}: UseDisputeFormStateOptions = {}) {
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [formData, setFormData] = useState<DisputeFormValues>({
    name: "",
    email: "",
    orderNumber: "",
    reason: "",
    description: "",
    files: [],
    agreeToTerms: false,
  });
  const [errors, setErrors] = useState<
    Partial<Record<keyof DisputeFormValues, string>>
  >({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<
    "idle" | "success" | "error"
  >("idle");
  const [submitMessage, setSubmitMessage] = useState("");

  const firstErrorRef = useRef<HTMLElement | null>(null);
  // Synchronous guard against duplicate sends: `isSubmitting` only disables the
  // submit button after a re-render, so a fast double activation could otherwise
  // start two requests.
  const submitInFlightRef = useRef(false);

  const validateStep = useCallback(
    (step: Step): boolean => {
      let newErrors: Partial<Record<keyof DisputeFormValues, string>> = {};
      switch (step) {
        case 1:
          newErrors = validateStep1Data(formData);
          break;
        case 2:
          newErrors = validateStep2Data(formData);
          break;
        case 3:
          newErrors = validateStep3Data(formData);
          break;
        case 4:
          newErrors = validateStep4Data(formData);
          break;
      }

      setErrors(newErrors);

      if (Object.keys(newErrors).length > 0) {
        const firstErrorKey = Object.keys(
          newErrors
        )[0] as keyof DisputeFormValues;
        firstErrorRef.current = document.getElementById(
          firstErrorKey as string
        );
        return false;
      }

      return true;
    },
    [formData]
  );

  const handleNext = useCallback(() => {
    if (!validateStep(currentStep)) return;
    if (currentStep < 4) {
      setCurrentStep((prev) => (prev + 1) as Step);
      setErrors({});
    }
  }, [currentStep, validateStep]);

  const handleBack = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as Step);
      setErrors({});
    }
  }, [currentStep]);

  const updateField = useCallback(
    <K extends keyof DisputeFormValues>(
      field: K,
      value: DisputeFormValues[K]
    ) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      if (errors[field]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    },
    [errors]
  );

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files || []);

      const rejectedByType = selectedFiles.filter(
        (file) => !isAllowedDisputeMimeType(file.type)
      );
      const rejectedBySize = selectedFiles.filter(
        (file) => file.size > MAX_DISPUTE_FILE_SIZE
      );

      if (rejectedByType.length > 0) {
        setErrors((prev) => ({
          ...prev,
          files: DISPUTE_ERRORS.fileType,
        }));
        return;
      }

      if (rejectedBySize.length > 0) {
        setErrors((prev) => ({
          ...prev,
          files: DISPUTE_ERRORS.fileTooLarge,
        }));
        return;
      }

      setErrors((prev) => ({ ...prev, files: undefined }));
      updateField("files", [...formData.files, ...selectedFiles]);
    },
    [formData.files, updateField]
  );

  const removeFile = useCallback(
    (index: number) => {
      const newFiles = formData.files.filter((_, i) => i !== index);
      updateField("files", newFiles);
    },
    [formData.files, updateField]
  );

  const handleSubmit = useCallback(async () => {
    if (submitInFlightRef.current) return;
    if (!validateStep(4)) return;

    submitInFlightRef.current = true;
    setIsSubmitting(true);
    setSubmitStatus("idle");

    try {
      const payload = {
        name: formData.name,
        email: formData.email,
        orderNumber: formData.orderNumber,
        reason: formData.reason,
        description: formData.description,
        files: formData.files.map((file: File) => ({
          name: file.name,
          type: file.type,
          size: file.size,
        })),
        submittedAt: new Date().toISOString(),
      };

      if (onSubmit) {
        await onSubmit(formData);
      } else {
        const response = await fetch(apiEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(
            `HTTP ${response.status}: ${response.statusText}`
          );
        }

        const responseData =
          (await response.json()) as SubmitDisputeFormResponse;

        if (onSuccess) {
          onSuccess(responseData);
        }
      }

      setSubmitStatus("success");
      setSubmitMessage("Your dispute has been submitted successfully!");
    } catch (error: unknown) {
      setSubmitStatus("error");
      setSubmitMessage(
        error instanceof Error ? error.message : "Failed to submit dispute"
      );
      if (onError && error instanceof Error) {
        onError(error);
      }
    } finally {
      submitInFlightRef.current = false;
      setIsSubmitting(false);
    }
  }, [formData, onSubmit, apiEndpoint, onSuccess, onError, validateStep]);

  /**
   * Leaves the error screen and returns to the populated review step so the
   * user can resend the same draft. Nothing is sent here; the request only
   * goes out when the user activates Submit again.
   */
  const retrySubmission = useCallback(() => {
    setCurrentStep(4);
    setErrors({});
    setSubmitStatus("idle");
    setSubmitMessage("");
  }, []);

  const resetForm = useCallback(() => {
    setFormData({
      name: "",
      email: "",
      orderNumber: "",
      reason: "",
      description: "",
      files: [],
      agreeToTerms: false,
    });
    setCurrentStep(1);
    setErrors({});
    setSubmitStatus("idle");
    setSubmitMessage("");
  }, []);

  return {
    currentStep,
    formData,
    errors,
    isSubmitting,
    submitStatus,
    submitMessage,
    firstErrorRef,
    handleNext,
    handleBack,
    updateField,
    handleFileUpload,
    removeFile,
    handleSubmit,
    retrySubmission,
    resetForm,
  };
}
