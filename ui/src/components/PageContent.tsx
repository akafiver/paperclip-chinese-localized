import { cn } from "@/lib/utils";

/**
 * Full-width page content wrapper.
 *
 * Every page in the app renders inside `<main>` (Layout.tsx) which provides
 * `p-4 md:p-6` padding.  This component gives children `w-full` so no
 * page-level `max-w-*` or `mx-auto` is ever needed, and a consistent `space-y-6`
 * vertical rhythm (24 px).
 *
 * Usage —
 *   `<PageContent>`  →  default space-y-6
 *   `<PageContent className="space-y-4">` → override gap
 */
export function PageContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("w-full space-y-6", className)}>{children}</div>;
}
