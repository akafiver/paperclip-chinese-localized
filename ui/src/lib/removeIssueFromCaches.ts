import { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";
import type { Issue } from "@paperclipai/shared";

/**
 * Remove a deleted issue from all known issue list caches so the UI doesn't
 * show a stale card (e.g. a Kanban column) between the invalidation trigger
 * and the actual refetch.
 */
export function removeIssueFromAllIssueListCaches(
  queryClient: QueryClient,
  companyId: string,
  issueId: string,
): void {
  queryClient.setQueriesData(
    { queryKey: queryKeys.issues.list(companyId) },
    (data: unknown) => {
      if (Array.isArray(data)) {
        // Direct arrays — inline task lists
        return (data as Issue[]).filter((i) => i.id !== issueId);
      }
      if (data && typeof data === "object" && "pages" in data && Array.isArray((data as { pages: unknown[] }).pages)) {
        // Infinite query (e.g. TaskDesk list)
        return {
          ...data,
          pages: (data as { pages: Issue[][] }).pages.map((page) =>
            page.filter((i: Issue) => i.id !== issueId),
          ),
        };
      }
      return data;
    },
  );
}
