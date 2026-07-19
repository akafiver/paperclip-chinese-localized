import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  CloudUpload,
  ExternalLink,
  FileJson,
  History,
  Loader2,
  RefreshCcw,
  ShieldAlert,
} from "lucide-react";
import type {
  CloudUpstreamActivationDecision,
  CloudUpstreamActivationEntityType,
  CloudUpstreamPreview,
  CloudUpstreamRun,
  CloudUpstreamStep,
} from "@paperclipai/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cloudUpstreamsApi } from "@/api/cloudUpstreams";
import { instanceSettingsApi } from "@/api/instanceSettings";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { useCompany } from "@/context/CompanyContext";
import { applyCompanyPrefix, extractCompanyPrefixFromPath } from "@/lib/company-routes";
import { Link, useLocation } from "@/lib/router";
import { queryKeys } from "@/lib/queryKeys";
import { useTranslation } from "@/i18n";

const PENDING_CONNECTION_KEY = "paperclip-cloud-upstream-pending-connection";

function getSteps(t: (key: string) => string): Array<{ key: CloudUpstreamStep; label: string }> {
  return [
    { key: "connect", label: t("ui.cloudUpstream.connect") },
    { key: "scan", label: t("ui.cloudUpstream.scan") },
    { key: "preview", label: t("ui.cloudUpstream.preview") },
    { key: "push", label: t("ui.cloudUpstream.push") },
    { key: "verify", label: t("ui.cloudUpstream.verify") },
    { key: "activate", label: t("ui.cloudUpstream.activate") },
  ];
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

function getActivationCategories(t: Translate): Array<{
  key: CloudUpstreamActivationEntityType;
  label: string;
  singular: string;
  plural: string;
  detail: string;
}> {
  return [
    {
      key: "agents",
      label: t("ui.cloudUpstream.agentsCategory"),
      singular: t("ui.cloudUpstream.agentSingular"),
      plural: t("ui.cloudUpstream.agentPlural"),
      detail: t("ui.cloudUpstream.agentDetail"),
    },
    {
      key: "routines",
      label: t("ui.cloudUpstream.routinesCategory"),
      singular: t("ui.cloudUpstream.routineSingular"),
      plural: t("ui.cloudUpstream.routinePlural"),
      detail: t("ui.cloudUpstream.routineDetail"),
    },
    {
      key: "monitors",
      label: t("ui.cloudUpstream.monitorsCategory"),
      singular: t("ui.cloudUpstream.monitorSingular"),
      plural: t("ui.cloudUpstream.monitorPlural"),
      detail: t("ui.cloudUpstream.monitorDetail"),
    },
  ];
}

export function CloudUpstream() {
  const { selectedCompany, selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const location = useLocation();
  const { t } = useTranslation();
  const [remoteUrl, setRemoteUrl] = useState("");
  const [preview, setPreview] = useState<CloudUpstreamPreview | null>(null);
  const [activeRun, setActiveRun] = useState<CloudUpstreamRun | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setBreadcrumbs([
      { label: selectedCompany?.name ?? "Company", href: "/dashboard" },
      { label: t("ui.breadcrumb.settings"), href: "/company/settings" },
      { label: t("ui.cloudUpstream.breadcrumb") },
    ]);
  }, [selectedCompany?.name, setBreadcrumbs, t]);

  const experimentalQuery = useQuery({
    queryKey: queryKeys.instance.experimentalSettings,
    queryFn: () => instanceSettingsApi.getExperimental(),
  });
  const cloudSyncEnabled = experimentalQuery.data?.enableCloudSync === true;

  const upstreamQuery = useQuery({
    queryKey: selectedCompanyId ? queryKeys.cloudUpstreams(selectedCompanyId) : ["cloud-upstreams", "__disabled__"],
    queryFn: () => cloudUpstreamsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId && cloudSyncEnabled,
  });

  const connection = upstreamQuery.data?.connections[0] ?? null;
  const latestRun = activeRun ?? upstreamQuery.data?.runs[0] ?? null;

  const callbackParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const code = callbackParams.get("code");
  const state = callbackParams.get("state");
  const callbackError = callbackParams.get("error");

  const settingsPath = useMemo(() => {
    const pathPrefix = extractCompanyPrefixFromPath(location.pathname);
    return applyCompanyPrefix("/company/settings/cloud-upstream", pathPrefix ?? selectedCompany?.issuePrefix ?? null);
  }, [location.pathname, selectedCompany?.issuePrefix]);

  const finishMutation = useMutation({
    mutationFn: (input: { pendingConnectionId: string; code: string; state: string }) =>
      cloudUpstreamsApi.finishConnect(input),
    onSuccess: async () => {
      localStorage.removeItem(PENDING_CONNECTION_KEY);
      setNotice(t("ui.cloudUpstream.connectionApproved"));
      setActionError(null);
      await invalidateUpstreams();
      window.history.replaceState(null, "", settingsPath);
    },
    onError: (error) => setActionError(error instanceof Error ? error.message : t("ui.cloudUpstream.failedFinish")),
  });
  const {
    mutate: finishConnect,
    isError: finishConnectFailed,
    isPending: finishConnectPending,
    isSuccess: finishConnectSucceeded,
  } = finishMutation;

  useEffect(() => {
    if (!cloudSyncEnabled || !code || !state || finishConnectPending || finishConnectSucceeded || finishConnectFailed) return;
    const pendingConnectionId = localStorage.getItem(PENDING_CONNECTION_KEY);
    if (!pendingConnectionId) {
      setActionError(t("ui.cloudUpstream.noPendingConnection"));
      return;
    }
    finishConnect({ pendingConnectionId, code, state });
  }, [cloudSyncEnabled, code, finishConnect, finishConnectFailed, finishConnectPending, finishConnectSucceeded, state]);

  useEffect(() => {
    if (callbackError) {
      setActionError(`${t("ui.cloudUpstream.connectionNotApproved")}: ${callbackError}`);
    }
  }, [callbackError]);

  const startMutation = useMutation({
    mutationFn: () =>
      cloudUpstreamsApi.startConnect({
        companyId: selectedCompanyId!,
        remoteUrl,
        redirectUri: `${window.location.origin}${settingsPath}`,
      }),
    onSuccess: (result) => {
      localStorage.setItem(PENDING_CONNECTION_KEY, result.pendingConnectionId);
      setActionError(null);
      window.location.assign(result.authorizationUrl);
    },
    onError: (error) => setActionError(error instanceof Error ? error.message : t("ui.cloudUpstream.failedStart")),
  });

  const previewMutation = useMutation({
    mutationFn: (input: { connectionId: string; companyId: string }) =>
      cloudUpstreamsApi.preview(input.connectionId, { companyId: input.companyId }),
    onSuccess: (nextPreview) => {
      setPreview(nextPreview);
      setActionError(null);
    },
    onError: (error) => setActionError(previewErrorMessage(error, t)),
  });

  const runMutation = useMutation({
    mutationFn: (input: { connectionId: string; companyId: string; retryOfRunId?: string | null }) =>
      cloudUpstreamsApi.createRun(input.connectionId, {
        companyId: input.companyId,
        retryOfRunId: input.retryOfRunId ?? null,
      }),
    onSuccess: async (run) => {
      setActiveRun(run);
      setNotice(run.status === "succeeded"
        ? t("ui.cloudUpstream.pushCompleted")
        : t("ui.cloudUpstream.pushFailed"));
      setActionError(null);
      await invalidateUpstreams();
    },
    onError: (error) => setActionError(error instanceof Error ? error.message : t("ui.cloudUpstream.failedPush")),
  });
  const activationMutation = useMutation({
    mutationFn: (input: { run: CloudUpstreamRun; entityType: CloudUpstreamActivationEntityType }) =>
      cloudUpstreamsApi.activateEntities(input.run.connectionId, input.run.id, {
        companyId: input.run.companyId,
        entityType: input.entityType,
      }),
    onSuccess: async (run) => {
      setActiveRun(run);
      setNotice(t("ui.cloudUpstream.activationUpdated"));
      setActionError(null);
      await invalidateUpstreams();
    },
    onError: (error) => setActionError(error instanceof Error ? error.message : t("ui.cloudUpstream.failedActivation")),
  });

  async function invalidateUpstreams() {
    if (!selectedCompanyId) return;
    await queryClient.invalidateQueries({ queryKey: queryKeys.cloudUpstreams(selectedCompanyId) });
  }

  if (!selectedCompanyId || !selectedCompany) {
    return <div className="text-sm text-muted-foreground">{t("ui.cloudUpstream.selectCompany")}</div>;
  }

  if (experimentalQuery.isLoading) {
    return <div className="text-sm text-muted-foreground">{t("ui.cloudUpstream.loadingExperimental")}</div>;
  }

  if (!cloudSyncEnabled) {
    return (
      <div className="max-w-2xl space-y-4">
        <div className="flex items-center gap-2">
          <CloudUpload className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">{t("ui.cloudUpstream.title")}</h1>
        </div>
        <div className="rounded-md border border-border px-4 py-4 text-sm text-muted-foreground">
          {t("ui.cloudUpstream.cloudSyncDisabled")}{" "}
          <Link
            className="text-primary underline-offset-2 hover:underline"
            to="/company/settings/instance/experimental"
          >
            {t("ui.cloudUpstream.instanceSettings")}
          </Link>{" "}
          {t("ui.cloudUpstream.cloudSyncDisabledSuffix")}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <CloudUpload className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-lg font-semibold">{t("ui.cloudUpstream.title")}</h1>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {t("ui.cloudUpstream.description", { companyName: selectedCompany.name })}
          </p>
        </div>
        {connection?.target.origin ? (
          <Button variant="outline" size="sm" asChild>
            <a href={connection.target.origin} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" />
              {t("ui.cloudUpstream.openCloud")}
            </a>
          </Button>
        ) : null}
      </div>

      {notice ? (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          {notice}
        </div>
      ) : null}
      {actionError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {actionError}
        </div>
      ) : null}

      <Stepper activeStep={latestRun?.activeStep ?? (preview ? "preview" : connection?.tokenStatus === "connected" ? "scan" : "connect")} />

      <section className="space-y-3">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Connection</div>
        <div className="rounded-md border border-border px-4 py-4">
          {connection ? (
            <div className="grid gap-3 lg:grid-cols-(--gtc-17) lg:items-start">
              <div>
                <div className="text-sm font-medium">
                  {connection.target.stackDisplayName ?? connection.target.stackSlug ?? connection.target.stackId}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {connection.target.product} · {connection.target.origin} · token {connection.tokenStatus}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Schema {connection.target.schemaMajor}. Max chunk {formatBytes(connection.target.maxChunkBytes)}.
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => previewMutation.mutate({ connectionId: connection.id, companyId: connection.companyId })}
                  disabled={previewMutation.isPending || connection.tokenStatus !== "connected"}
                >
                  {previewMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                  {t("ui.cloudUpstream.previewPush")}
                </Button>
                {previewMutation.isPending ? <PreviewProgressHint /> : null}
              </div>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-(--gtc-17)">
              <Input
                value={remoteUrl}
                onChange={(event) => setRemoteUrl(event.target.value)}
                placeholder="https://paperclip.paperclip.app/PC521D/dashboard"
                aria-label={t("ui.cloudUpstream.cloudStackUrl")}
              />
              <Button onClick={() => startMutation.mutate()} disabled={startMutation.isPending || !remoteUrl.trim()}>
                {startMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}
                {t("ui.cloudUpstream.connectBtn")}
              </Button>
            </div>
          )}
        </div>
      </section>

      {preview ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("ui.cloudUpstream.previewLabel")}</div>
            <Button
              onClick={() => runMutation.mutate({ connectionId: preview.connectionId, companyId: preview.sourceCompanyId })}
              disabled={runMutation.isPending || !preview.schemaCompatible}
            >
              {runMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}
              {t("ui.cloudUpstream.pushToCloud")}
            </Button>
          </div>
          <SummaryGrid summary={preview.summary} />
          <WarningsPanel warnings={preview.warnings} />
          <ConflictTable conflicts={preview.conflicts} />
        </section>
      ) : null}

      {latestRun ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Progress and finish</div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => downloadRunReport(latestRun)}>
                <FileJson className="h-4 w-4" />
                Download report
              </Button>
              {latestRun.status === "failed" || latestRun.status === "cancelled" ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => runMutation.mutate({
                    connectionId: latestRun.connectionId,
                    companyId: latestRun.companyId,
                    retryOfRunId: latestRun.id,
                  })}
                  disabled={runMutation.isPending}
                >
                  <RefreshCcw className="h-4 w-4" />
                  {t("ui.cloudUpstream.retry")}
                </Button>
              ) : latestRun.status === "succeeded" ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => runMutation.mutate({ connectionId: latestRun.connectionId, companyId: latestRun.companyId })}
                  disabled={runMutation.isPending}
                >
                  <RefreshCcw className="h-4 w-4" />
                  {t("ui.cloudUpstream.reRun")}
                </Button>
              ) : null}
            </div>
          </div>
          <div className="rounded-md border border-border px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium capitalize">{latestRun.status}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Run {latestRun.id.slice(0, 8)} · {latestRun.completedAt ? `completed ${formatDate(latestRun.completedAt)}` : "in progress"}
                </div>
              </div>
              <div className="text-sm tabular-nums">{latestRun.progressPercent}%</div>
            </div>
            <div className="mt-3 h-2 rounded-full bg-muted">
              <div className="h-2 rounded-full bg-primary" style={{ width: `${latestRun.progressPercent}%` }} />
            </div>
            <div className="mt-4 divide-y divide-border">
              {latestRun.events.map((event) => (
                <div key={event.id} className="grid gap-2 py-2 text-sm sm:grid-cols-(--gtc-20)">
                  <span className="text-xs text-muted-foreground">{formatDate(event.at)}</span>
                  <span className="text-xs capitalize text-muted-foreground">{event.phase}</span>
                  <span>{event.message}</span>
                </div>
              ))}
            </div>
          </div>

          {latestRun.status === "succeeded" ? (
            <ActivationChecklist
              run={latestRun}
              pendingEntityType={activationMutation.variables?.entityType ?? null}
              isPending={activationMutation.isPending}
              onActivate={(entityType) => activationMutation.mutate({ run: latestRun, entityType })}
            />
          ) : null}
        </section>
      ) : null}

      {upstreamQuery.data?.runs.length ? (
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <History className="h-3.5 w-3.5" />
            {t("ui.cloudUpstream.history")}
          </div>
          <div className="divide-y divide-border rounded-md border border-border">
            {upstreamQuery.data.runs.map((run) => (
              <button
                key={run.id}
                type="button"
                className="grid w-full gap-1 px-4 py-3 text-left text-sm hover:bg-accent/40 sm:grid-cols-(--gtc-17)"
                onClick={() => setActiveRun(run)}
              >
                <span>Run {run.id.slice(0, 8)} · {run.status}</span>
                <span className="text-xs text-muted-foreground">{formatDate(run.createdAt)}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function PreviewProgressHint() {
  const { t } = useTranslation();
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const startedAt = Date.now();
    const interval = window.setInterval(() => setElapsed(Math.round((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(interval);
  }, []);
  const message = elapsed < 15
    ? t("ui.cloudUpstream.buildingManifest")
    : elapsed < 45
      ? `${t("ui.cloudUpstream.buildingManifest")} ${elapsed}s. ${t("ui.cloudUpstream.largeCompaniesHint")}`
      : `${t("ui.cloudUpstream.stillBuilding")} ${elapsed}s. ${t("ui.cloudUpstream.papCompaniesHint")}`;
  return <div className="text-xs text-muted-foreground">{message}</div>;
}

function Stepper({ activeStep }: { activeStep: CloudUpstreamStep }) {
  const { t } = useTranslation();
  const steps = useMemo(() => getSteps(t), [t]);
  const activeIndex = steps.findIndex((step) => step.key === activeStep);
  return (
    <div className="grid gap-2 rounded-md border border-border px-3 py-3 sm:grid-cols-6">
      {steps.map((step, index) => {
        const complete = index < activeIndex;
        const active = index === activeIndex;
        return (
          <div key={step.key} className="flex items-center gap-2 text-xs">
            {complete ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <span className={active ? "h-4 w-4 rounded-full border-2 border-primary" : "h-4 w-4 rounded-full border border-border"} />
            )}
            <span className={active ? "font-medium text-foreground" : "text-muted-foreground"}>{step.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function SummaryGrid({ summary }: { summary: CloudUpstreamPreview["summary"] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-4">
      {summary.map((item) => (
        <div key={item.key} className="rounded-md border border-border px-3 py-2">
          <div className="text-lg font-semibold tabular-nums">{item.count}</div>
          <div className="text-xs text-muted-foreground">{item.label}</div>
        </div>
      ))}
    </div>
  );
}

function WarningsPanel({ warnings }: { warnings: CloudUpstreamPreview["warnings"] }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-md border border-border px-4 py-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        <ShieldAlert className="h-4 w-4 text-muted-foreground" />
        {t("ui.cloudUpstream.warnings")}
      </div>
      <div className="divide-y divide-border">
        {warnings.map((warning) => (
          <div key={warning.code} className="grid gap-2 py-2 sm:grid-cols-(--gtc-21)">
            <AlertTriangle className={warning.severity === "blocker" ? "h-4 w-4 text-destructive" : "h-4 w-4 text-amber-600"} />
            <div className="text-sm font-medium">{warning.title}</div>
            <div className="text-sm text-muted-foreground">{warning.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConflictTable({ conflicts }: { conflicts: CloudUpstreamPreview["conflicts"] }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-md border border-border px-4 py-3">
      <div className="mb-2 text-sm font-medium">{t("ui.cloudUpstream.conflicts")}</div>
      {conflicts.length === 0 ? (
        <div className="text-sm text-muted-foreground">{t("ui.cloudUpstream.noConflicts")}</div>
      ) : (
        <div className="divide-y divide-border">
          {conflicts.map((conflict) => (
            <div key={conflict.id} className="grid gap-2 py-2 text-sm sm:grid-cols-(--gtc-22)">
              <span className="text-muted-foreground">{conflict.entityType}</span>
              <span>{conflict.sourceLabel}</span>
              <span>{conflict.targetLabel}</span>
              <span className="capitalize">{conflict.plannedAction}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActivationChecklist({
  run,
  pendingEntityType,
  isPending,
  onActivate,
}: {
  run: CloudUpstreamRun;
  pendingEntityType: CloudUpstreamActivationEntityType | null;
  isPending: boolean;
  onActivate: (entityType: CloudUpstreamActivationEntityType) => void;
}) {
  const { t } = useTranslation();
  const rows = buildActivationRows(run, t);
  return (
    <div className="rounded-md border border-border px-4 py-3">
      <div className="mb-2 text-sm font-medium">{t("ui.cloudUpstream.activationChecklist")}</div>
      <div className="divide-y divide-border">
        {rows.map((row) => {
          const pending = isPending && pendingEntityType === row.key;
          const activated = row.status === "activated";
          return (
            <div key={row.key} className="grid gap-2 py-2 text-sm sm:grid-cols-(--gtc-23) sm:items-center">
              <div>
                <div className="font-medium">{row.label}</div>
                <div className="text-xs text-muted-foreground">{row.statusLabel}</div>
              </div>
              <div className="text-muted-foreground">
                {row.count === 0 ? row.emptyDetail : row.detail}
              </div>
              <div className="flex flex-wrap gap-2 sm:justify-end">
                <Button
                  variant={activated ? "secondary" : "default"}
                  size="sm"
                  onClick={() => onActivate(row.key)}
                  disabled={row.count === 0 || activated || isPending}
                >
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {activated ? t("ui.cloudUpstream.activated") : t("ui.cloudUpstream.activate")}
                </Button>
                <Button variant="ghost" size="sm" disabled={activated || isPending}>
                  {t("ui.cloudUpstream.keepPaused")}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function buildActivationRows(run: CloudUpstreamRun, t: Translate) {
  const activationChecklist = activationChecklistFromReport(run.report);
  const categories = getActivationCategories(t);
  return categories.map((category) => {
    const decision = activationChecklist[category.key];
    const count = summaryCount(run.summary, category.key);
    const status = decision?.status === "activated" ? "activated" : "paused";
    const itemLabel = count === 1 ? category.singular : category.plural;
    return {
      ...category,
      count,
      status,
      detail: t("ui.cloudUpstream.activationPausedDetail", {
        count,
        itemLabel,
        categoryDetail: category.detail,
      }),
      emptyDetail: t("ui.cloudUpstream.activationEmptyDetail", { itemLabel }),
      statusLabel: status === "activated"
        ? t("ui.cloudUpstream.activationStatusActivated", { count })
        : count === 0
          ? t("ui.cloudUpstream.activationStatusImported", { count })
          : t("ui.cloudUpstream.activationStatusPaused", { count }),
    };
  });
}

function summaryCount(summary: CloudUpstreamRun["summary"], key: CloudUpstreamActivationEntityType): number {
  return summary.find((item) => item.key === key)?.count ?? 0;
}

function activationChecklistFromReport(report: CloudUpstreamRun["report"]): Partial<Record<CloudUpstreamActivationEntityType, CloudUpstreamActivationDecision>> {
  const value = optionalRecord(report.activationChecklist);
  const decisions: Partial<Record<CloudUpstreamActivationEntityType, CloudUpstreamActivationDecision>> = {};
  for (const key of ["agents", "routines", "monitors"] as const) {
    const item = optionalRecord(value[key]);
    if (!item) continue;
    decisions[key] = {
      entityType: key,
      count: typeof item.count === "number" ? item.count : 0,
      status: item.status === "activated" ? "activated" : "paused",
      activatedAt: typeof item.activatedAt === "string" ? item.activatedAt : null,
    };
  }
  return decisions;
}

function optionalRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function downloadRunReport(run: CloudUpstreamRun) {
  const blob = new Blob([JSON.stringify(run.report, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `cloud-upstream-run-${run.id}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatBytes(value: number) {
  if (value >= 1024 * 1024) return `${Math.round(value / (1024 * 1024))} MiB`;
  if (value >= 1024) return `${Math.round(value / 1024)} KiB`;
  return `${value} B`;
}

function previewErrorMessage(error: unknown, t: (key: string) => string): string {
  const code = error instanceof Error ? error.message : null;
  if (code === "payload_too_large" || code === "bad_request") {
    return t("ui.cloudUpstream.previewTooLarge");
  }
  return code ?? t("ui.cloudUpstream.failedPreview");
}
