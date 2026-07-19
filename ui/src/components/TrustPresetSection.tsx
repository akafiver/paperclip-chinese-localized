import { useEffect, useMemo, useState } from "react";
import type { AgentPermissions, TrustPreset } from "@paperclipai/shared";
import { Lock, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, CollapsibleSection } from "./agent-config-primitives";
import {
  buildPermissionsForTrustPreset,
  clearSingleLowTrustBoundaryTarget,
  getLowTrustBoundary,
  getSingleLowTrustBoundaryTarget,
  getTrustPreset,
  isCeLowTrustBoundaryEditable,
  lowTrustBoundaryHasScope,
  setSingleLowTrustBoundaryTarget,
  type LowTrustBoundaryTarget,
} from "../lib/trust-policy-ui";
import { cn } from "../lib/utils";
import { useTranslation } from "@/i18n";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";

function formatCount(value: readonly unknown[] | undefined, singular: string, plural: string) {
  const count = value?.length ?? 0;
  if (count === 0) return "-";
  return `${count} ${count === 1 ? singular : plural}`;
}

function countBoundaryTargets(boundary: NonNullable<AgentPermissions["authorizationPolicy"]>["trustBoundary"] | null | undefined) {
  return (
    (boundary?.projectIds?.length ?? 0) +
    (boundary?.rootIssueId ? 1 : 0) +
    (boundary?.issueIds?.length ?? 0)
  );
}

function PolicyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-sm">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className={cn("min-w-0 text-right", value === "-" && "text-muted-foreground")}>{value}</span>
    </div>
  );
}

export interface LowTrustBoundaryCandidate {
  id: string;
  label: string;
}

type LowTrustBoundaryTargetType = LowTrustBoundaryTarget["type"];

const BOUNDARY_TARGET_LABELS: Record<LowTrustBoundaryTargetType, string> = {
  project: "project",
  root_issue: "rootIssue",
  issue: "issue",
};

export function TrustPresetSection({
  permissions,
  onChange,
  disabled,
  companyId,
  projectCandidates = [],
  issueCandidates = [],
  candidatesLoading,
}: {
  permissions: Partial<AgentPermissions> | null | undefined;
  onChange: (permissions: Partial<AgentPermissions>) => void;
  disabled?: boolean;
  companyId?: string | null;
  projectCandidates?: LowTrustBoundaryCandidate[];
  issueCandidates?: LowTrustBoundaryCandidate[];
  candidatesLoading?: boolean;
}) {
  const { t } = useTranslation();
  const [policyOpen, setPolicyOpen] = useState(false);
  const preset = getTrustPreset(permissions);
  const boundary = getLowTrustBoundary(permissions);
  const boundaryTarget = getSingleLowTrustBoundaryTarget(boundary);
  const [targetType, setTargetType] = useState<LowTrustBoundaryTargetType>(boundaryTarget?.type ?? "project");
  const lowTrust = preset === "low_trust_review";
  const hasScope = lowTrustBoundaryHasScope(boundary);
  const boundaryEditable = isCeLowTrustBoundaryEditable(boundary);
  const policy = permissions?.authorizationPolicy ?? null;
  const managedPermissions = useMemo(
    () => buildPermissionsForTrustPreset(permissions, preset),
    [permissions, preset],
  );

  function formatBoundarySummary() {
    if (!boundary) return t("ui.trustPreset.noBoundarySelected");
    const target = getSingleLowTrustBoundaryTarget(boundary);
    if (target?.type === "project") return t("ui.trustPreset.projectSummary", { id: target.id.slice(0, 8) });
    if (target?.type === "root_issue") return t("ui.trustPreset.rootIssueSummary", { id: target.id.slice(0, 8) });
    if (target?.type === "issue") return t("ui.trustPreset.issueSummary", { id: target.id.slice(0, 8) });
    const count = countBoundaryTargets(boundary);
    if (count === 0) return t("ui.trustPreset.noBoundarySelected");
    return t("ui.trustPreset.boundaryCount", { count });
  }

  useEffect(() => {
    if (boundaryTarget) setTargetType(boundaryTarget.type);
  }, [boundaryTarget?.type]);

  function handlePresetChange(value: string) {
    const nextPreset: TrustPreset = value === "low_trust_review" ? "low_trust_review" : "standard";
    onChange(buildPermissionsForTrustPreset(permissions, nextPreset));
  }

  function handleBoundaryTargetChange(targetId: string) {
    if (!companyId || !targetId) return;
    onChange(setSingleLowTrustBoundaryTarget(permissions, companyId, { type: targetType, id: targetId }));
  }

  function handleClearBoundary() {
    onChange(clearSingleLowTrustBoundaryTarget(permissions));
  }

  const targetCandidates = targetType === "project" ? projectCandidates : issueCandidates;
  const boundaryValue = boundaryTarget?.type === targetType ? boundaryTarget.id : "";

  return (
    <div>
      <h3 className="mb-3 text-sm font-medium">{t("ui.trustPreset.title")}</h3>
      <div className="rounded-lg border border-border p-4 space-y-3">
        <Field label={t("ui.trustPreset.preset")} hint={t("ui.trustPreset.presetHint")}>
          <select
            className={inputClass}
            value={preset}
            onChange={(event) => handlePresetChange(event.target.value)}
            disabled={disabled}
          >
            <option value="standard">{t("ui.trustPreset.standard")}</option>
            <option value="low_trust_review">{t("ui.trustPreset.lowTrustReview")}</option>
          </select>
        </Field>
        <p className="text-xs text-muted-foreground">
          {preset === "low_trust_review" ? t("ui.trustPreset.lowTrustDescription") : t("ui.trustPreset.standardDescription")}
        </p>

        {lowTrust ? (
          <div
            role={hasScope ? "status" : "alert"}
            aria-live="polite"
            className={cn(
              "rounded-md border px-3 py-2.5 text-sm flex gap-2",
              hasScope
                ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-100"
                : "border-destructive/30 bg-destructive/10 text-destructive",
            )}
          >
            {hasScope ? (
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <Lock className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <div className="min-w-0 flex-1 space-y-2">
              <div>
                <p className="font-medium">
                  {hasScope ? t("ui.trustPreset.containmentActive") : t("ui.trustPreset.containmentNotConfigured")}
                </p>
                <p className="mt-1 text-xs leading-5">
                  {hasScope
                    ? t("ui.trustPreset.containmentActiveDescription")
                    : t("ui.trustPreset.containmentMissingDescription")}
                </p>
              </div>
              {boundaryEditable ? (
                <div className="rounded-md border border-border/70 bg-background/70 p-3 text-foreground space-y-3">
                  <div className="grid gap-3 sm:grid-cols-(--gtc-12)">
                    <Field label={t("ui.trustPreset.boundaryType")}>
                      <select
                        className={inputClass}
                        value={targetType}
                        onChange={(event) => setTargetType(event.target.value as LowTrustBoundaryTargetType)}
                        disabled={disabled}
                      >
                        <option value="project">{t("ui.trustPreset.project")}</option>
                        <option value="root_issue">{t("ui.trustPreset.rootIssue")}</option>
                        <option value="issue">{t("ui.trustPreset.issue")}</option>
                      </select>
                    </Field>
                    <Field label={t(`ui.trustPreset.${BOUNDARY_TARGET_LABELS[targetType]}`)}>
                      <select
                        className={inputClass}
                        value={boundaryValue}
                        onChange={(event) => handleBoundaryTargetChange(event.target.value)}
                        disabled={disabled || !companyId || candidatesLoading || targetCandidates.length === 0}
                      >
                        <option value="">
                          {candidatesLoading
                            ? t("ui.trustPreset.loading")
                            : targetCandidates.length === 0
                              ? targetType === "project"
                                ? t("ui.trustPreset.noProjectsAvailable")
                                : t("ui.trustPreset.noIssuesAvailable")
                              : t("ui.trustPreset.selectBoundary")}
                        </option>
                        {targetCandidates.map((candidate) => (
                          <option key={candidate.id} value={candidate.id}>
                            {candidate.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      {t("ui.trustPreset.ceSingleBoundary")}
                    </p>
                    {boundaryTarget ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 px-2.5 text-xs"
                        onClick={handleClearBoundary}
                        disabled={disabled}
                      >
                        {t("ui.trustPreset.clearBoundary")}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="rounded-md border border-border/70 bg-background/70 p-3 text-foreground">
                  <p className="text-sm font-medium">{t("ui.trustPreset.managedByEeApi")}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {t("ui.trustPreset.managedPolicyPrefix")} {formatBoundarySummary()} {t("ui.trustPreset.managedPolicySuffix")}
                  </p>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {t("ui.trustPreset.wantMultipleBoundaries")}{" "}
                <a
                  className="underline underline-offset-2 hover:text-foreground"
                  href="https://paperclip.ing/ee"
                  target="_blank"
                  rel="noreferrer"
                >
                  {t("ui.trustPreset.getPaperclipEe")}
                </a>
              </p>
              <CollapsibleSection
                title={t("ui.trustPreset.viewPolicy")}
                open={policyOpen}
                onToggle={() => setPolicyOpen((open) => !open)}
              >
                <div className="divide-y divide-border/60 text-foreground">
                  <PolicyRow label={t("ui.trustPreset.policyPreset")} value={t("ui.trustPreset.lowTrustReviewV1")} />
                  <PolicyRow label={t("ui.trustPreset.rawOutput")} value={t("ui.trustPreset.quarantinedOutput")} />
                  <PolicyRow label={t("ui.trustPreset.projects")} value={formatCount(boundary?.projectIds, t("ui.trustPreset.projectLower"), t("ui.trustPreset.projectsLower"))} />
                  <PolicyRow label={t("ui.trustPreset.rootIssue")} value={boundary?.rootIssueId ? boundary.rootIssueId.slice(0, 8) : "-"} />
                  <PolicyRow label={t("ui.trustPreset.explicitIssues")} value={formatCount(boundary?.issueIds, t("ui.trustPreset.issueLower"), t("ui.trustPreset.issuesLower"))} />
                  <PolicyRow label={t("ui.trustPreset.allowedAgents")} value={formatCount(boundary?.allowedAgentIds, t("ui.trustPreset.agentLower"), t("ui.trustPreset.agentsLower"))} />
                  <PolicyRow label={t("ui.trustPreset.allowedTools")} value={boundary?.allowedToolClasses?.join(" · ") || "-"} />
                  <PolicyRow label={t("ui.trustPreset.allowedSecrets")} value={formatCount(boundary?.allowedSecretBindingIds, t("ui.trustPreset.bindingLower"), t("ui.trustPreset.bindingsLower"))} />
                  <PolicyRow label={t("ui.trustPreset.promotionTarget")} value={boundary?.outputPromotionTarget?.issueId?.slice(0, 8) ?? "-"} />
                  <PolicyRow
                    label={t("ui.trustPreset.eeFields")}
                    value={Object.keys(policy ?? {}).some((key) => !["trustPreset", "reviewPreset", "trustBoundary"].includes(key))
                      ? t("ui.trustPreset.customAdvancedPolicyPreserved")
                      : "-"}
                  />
                </div>
              </CollapsibleSection>
            </div>
          </div>
        ) : null}

        {managedPermissions.authorizationPolicy?.reviewPreset ? null : (
          <p className="text-xs text-muted-foreground">
            {t("ui.trustPreset.advancedPermissionsEditable")}
          </p>
        )}
      </div>
    </div>
  );
}
