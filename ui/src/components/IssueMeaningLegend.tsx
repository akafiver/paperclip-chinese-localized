import { useTranslation } from "@/i18n";
import { issuePriorityOrder, issueStatusOrder } from "../lib/issue-filters";
import { cn } from "../lib/utils";
import { PriorityIcon } from "./PriorityIcon";
import { StatusIcon } from "./StatusIcon";

export function IssueMeaningLegend({ className }: { className?: string }) {
  const { t } = useTranslation();

  return (
    <div className={cn("rounded-lg border border-border bg-card/60 px-3 py-2", className)}>
      <div className="flex flex-col gap-2 text-xs text-muted-foreground lg:flex-row lg:items-center lg:gap-5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="font-medium text-foreground">{t("ui.issueFilters.status")}</span>
          {issueStatusOrder.map((status) => (
            <span key={status} className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <StatusIcon status={status} size="md" />
              <span>{t(`ui.issueFilters.statuses.${status}`)}</span>
            </span>
          ))}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="font-medium text-foreground">{t("ui.issueFilters.priority")}</span>
          {issuePriorityOrder.map((priority) => (
            <span key={priority} className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <PriorityIcon priority={priority} />
              <span>{t(`ui.issueFilters.priorities.${priority}`)}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
