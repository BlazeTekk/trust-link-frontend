import { beforeEach, describe, expect, it } from "vitest";

import {
  LOCAL_PROFILE_KEY,
  parseLocalProfile,
  readLocalProfile,
  saveLocalProfile,
  saveOnboardingProfile,
} from "./local-profile";

describe("browser-local vendor profile", () => {
  beforeEach(() => localStorage.clear());

  it("maps onboarding fields and restores them from storage", () => {
    saveOnboardingProfile({ shopName: "Shop", description: "Handmade furniture", website: "https://shop.example", shippingLocations: "Lagos" });
    expect(readLocalProfile()).toMatchObject({ businessName: "Shop", bio: "Handmade furniture", website: "https://shop.example", shippingLocations: "Lagos" });
  });

  it("preserves existing edits when an onboarding draft is empty", () => {
    const existing = parseLocalProfile({ businessName: "Edited shop", bio: "Edited bio", email: "shop@example.com", displayName: "Owner", website: "https://shop.example", shippingLocations: "Abuja" });
    saveLocalProfile(existing);
    saveOnboardingProfile({ shopName: " ", description: "", website: "", shippingLocations: "" });
    expect(readLocalProfile()).toEqual(existing);
  });

  it("keeps legacy fields while settings can clear optional fields", () => {
    localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify({ businessName: "Legacy", email: "shop@example.com" }));
    const profile = readLocalProfile();
    expect(profile.website).toBe("");
    saveLocalProfile({ ...profile, email: "", shippingLocations: "Lagos" });
    expect(readLocalProfile()).toMatchObject({ businessName: "Legacy", email: "", shippingLocations: "Lagos" });
  });

  it("ignores unsupported and malformed persisted fields", () => {
    expect(parseLocalProfile({ businessName: false, bio: "Valid", website: [], secret: "ignored" })).toMatchObject({ businessName: "", bio: "Valid", website: "" });
    expect(parseLocalProfile(null).businessName).toBe("");
    expect(parseLocalProfile([]).businessName).toBe("");
  });
});
