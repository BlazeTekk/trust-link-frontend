# Browser-local vendor profile

Onboarding and profile settings share the `vendor.profile` localStorage record,
defined by `LocalVendorProfile` in `lib/local-profile.ts`.

| Field | Onboarding source | Settings |
| --- | --- | --- |
| `businessName` | Shop name | Business Name |
| `bio` | Description | Short Bio |
| `website` | Normalized website URL | Website |
| `shippingLocations` | Shipping locations text | Shipping Locations |
| `displayName` | Preserved from existing profile | Display Name |
| `email` | Preserved from existing profile | Contact Email |

Only nonempty onboarding values replace saved fields. Empty optional draft
fields preserve existing edits. Settings can explicitly clear optional fields.
Legacy profiles with only businessName, displayName, email and bio remain
supported; missing fields default to empty strings. Unsupported keys and values
of the wrong type are ignored when restoring a profile.

Onboarding writes the profile before marking its draft complete or navigating.
If storage fails, it retains the draft and shows a retry message. Settings also
retain unsaved edits after storage failures.

These details belong to this browser's site storage, shared across wallet
connections in that browser. They survive reloads but do not synchronize across
devices and may be lost when site data is cleared. They do not update or publish
the backend's public vendor profile.
