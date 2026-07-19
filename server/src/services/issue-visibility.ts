import { and, isNotNull, isNull, type SQL } from "drizzle-orm";
import { issues } from "@paperclipai/db";

export function visibleIssueCondition(mode: "visible" | "hidden" = "visible"): SQL {
  return and(
    mode === "hidden" ? isNotNull(issues.hiddenAt) : isNull(issues.hiddenAt),
    isNull(issues.harnessKind),
  )!;
}

export function visibleIssueSql(alias = "issues") {
  return `"${alias}"."hidden_at" IS NULL AND "${alias}"."harness_kind" IS NULL`;
}
