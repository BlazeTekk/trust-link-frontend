/**
 * Browser-local vendor details stored at `vendor.profile`, shared by onboarding
 * and settings. These values never update the public vendor API. Legacy
 * four-field profiles are supported by defaulting newly supported fields.
 */
export interface LocalVendorProfile {
  businessName: string;
  displayName: string;
  email: string;
  bio: string;
  website: string;
  shippingLocations: string;
}

export const LOCAL_PROFILE_KEY = "vendor.profile";
export const EMPTY_LOCAL_PROFILE: LocalVendorProfile = {
  businessName: "",
  displayName: "",
  email: "",
  bio: "",
  website: "",
  shippingLocations: "",
};

export function parseLocalProfile(value: unknown): LocalVendorProfile {
  const profile = { ...EMPTY_LOCAL_PROFILE };
  if (!value || typeof value !== "object" || Array.isArray(value)) return profile;
  const record = value as Record<string, unknown>;
  for (const field of Object.keys(profile) as (keyof LocalVendorProfile)[]) {
    if (typeof record[field] === "string") profile[field] = record[field];
  }
  return profile;
}

/** Storage failures propagate so callers can retain unsaved input and retry. */
export function readLocalProfile(): LocalVendorProfile {
  const stored = localStorage.getItem(LOCAL_PROFILE_KEY);
  if (!stored) return { ...EMPTY_LOCAL_PROFILE };
  try {
    return parseLocalProfile(JSON.parse(stored));
  } catch {
    return { ...EMPTY_LOCAL_PROFILE };
  }
}

export function saveLocalProfile(profile: LocalVendorProfile): void {
  localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(parseLocalProfile(profile)));
}

/** Only nonempty onboarding details replace the corresponding saved fields. */
export function saveOnboardingProfile(details: {
  shopName: string;
  description: string;
  website: string;
  shippingLocations: string;
}): void {
  const profile = readLocalProfile();
  const fields = {
    businessName: details.shopName,
    bio: details.description,
    website: details.website,
    shippingLocations: details.shippingLocations,
  };
  for (const field of Object.keys(fields) as (keyof typeof fields)[]) {
    if (fields[field].trim()) profile[field] = fields[field].trim();
  }
  saveLocalProfile(profile);
}
