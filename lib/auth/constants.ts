/**
 * Backward-compatibility re-exports — `@/lib/session` is the single
 * source of truth for session keys, events, and expiry handling.
 * Existing imports from `@/lib/auth/constants` keep working.
 */
export {
  handleSessionExpired,
  PUBLIC_KEY_STORAGE_KEY,
  SESSION_EXPIRED_EVENT,
  SESSION_EXPIRED_REDIRECT,
  SESSION_KEY,
  SESSION_STORAGE_KEYS,
} from "@/lib/session";