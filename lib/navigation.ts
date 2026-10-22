import { Bell, LayoutDashboard, MapPin, PlusCircle, User } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

/** A single core application destination. */
interface NavItem {
  /** Route the link points to, also used to derive the active state. */
  href: string;
  /** Visible label and accessible name base for the link. */
  label: string;
  /** Icon component rendered before the label. */
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

/** Fixed list of destinations shared by desktop and mobile navigation. */
export const CORE_NAV: readonly NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/create", label: "Create Link", icon: PlusCircle },
  { href: "/tracking", label: "Track Order", icon: MapPin },
  { href: "/notifications", label: "Inbox", icon: Bell },
  { href: "/profile", label: "Profile", icon: User },
] as const;

/** Match route boundaries and the existing tracking/profile detail routes. */
export function isNavigationActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return (
    pathname === href || pathname.startsWith(`${href}/`) ||
    (href === "/tracking" && pathname.startsWith("/track/")) ||
    (href === "/profile" && (pathname === "/settings/profile" || pathname.startsWith("/settings/profile/")))
  );
}
