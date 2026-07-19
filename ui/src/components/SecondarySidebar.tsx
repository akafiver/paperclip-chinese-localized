import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SidebarNavExpandedProvider } from "./SidebarNavItem";

/**
 * Fixed-width contextual pane that sits beside the primary app sidebar and the
 * main content on takeover routes (company settings, plugin `routeSidebar`).
 *
 * The takeover model (PAP-10695) no longer *replaces* the app `<Sidebar/>`:
 * the host keeps the primary sidebar at the user's selected width and renders
 * the contextual sidebar here.
 *
 * It is a dumb container — fixed `w-60`, full-height, non-shrinking, with a
 * right border and its own vertical scroll — so callers just drop the
 * contextual nav (or a plugin slot mount) inside as `children`.
 *
 * Because the pane is always 240px wide it forces the full-label presentation
 * on any `SidebarNavItem` inside it, so the contextual nav stays readable.
 */
export function SecondarySidebar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-secondary-sidebar=""
      className={cn(
        "h-full w-60 shrink-0 overflow-y-auto border-r border-border bg-background",
        className,
      )}
    >
      <SidebarNavExpandedProvider>{children}</SidebarNavExpandedProvider>
    </div>
  );
}
