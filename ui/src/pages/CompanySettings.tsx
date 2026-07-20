import { ChangeEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  COMPANY_DEFAULT_MAX_CONCURRENT_RUNS,
  COMPANY_DEFAULT_MAX_CONCURRENT_RUNS_PER_AGENT,
  COMPANY_MAX_CONCURRENT_RUNS_LIMIT,
  DEFAULT_COMPANY_ATTACHMENT_MAX_BYTES,
  MAX_COMPANY_ATTACHMENT_MAX_BYTES,
} from "@paperclipai/shared";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { companiesApi } from "../api/companies";
import { assetsApi } from "../api/assets";
import { instanceSettingsApi } from "../api/instanceSettings";
import { queryKeys } from "../lib/queryKeys";
import { Link, useNavigate } from "@/lib/router";
import { useTranslation } from "@/i18n";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Archive, CloudUpload, Download, FolderOpen, RotateCcw, Settings, Trash2, Upload } from "lucide-react";
import { CompanyPatternIcon } from "../components/CompanyPatternIcon";
import {
  Field,
  ToggleField,
} from "../components/agent-config-primitives";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const BYTES_PER_MIB = 1024 * 1024;
const DEFAULT_COMPANY_ATTACHMENT_MAX_MIB = DEFAULT_COMPANY_ATTACHMENT_MAX_BYTES / BYTES_PER_MIB;
const MAX_COMPANY_ATTACHMENT_MAX_MIB = MAX_COMPANY_ATTACHMENT_MAX_BYTES / BYTES_PER_MIB;
export function CompanySettings() {
  const { t } = useTranslation();
  const {
    companies,
    selectedCompany,
    selectedCompanyId,
    setSelectedCompanyId
  } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: experimentalSettings } = useQuery({
    queryKey: queryKeys.instance.experimentalSettings,
    queryFn: () => instanceSettingsApi.getExperimental(),
  });
  // General settings local state
  const [companyName, setCompanyName] = useState("");
  const [description, setDescription] = useState("");
  const [brandColor, setBrandColor] = useState("");
  const [attachmentMaxMiB, setAttachmentMaxMiB] = useState(String(DEFAULT_COMPANY_ATTACHMENT_MAX_MIB));
  const [maxConcurrentRuns, setMaxConcurrentRuns] = useState(String(COMPANY_DEFAULT_MAX_CONCURRENT_RUNS));
  const [maxConcurrentRunsPerAgent, setMaxConcurrentRunsPerAgent] = useState(String(COMPANY_DEFAULT_MAX_CONCURRENT_RUNS_PER_AGENT));
  const [logoUrl, setLogoUrl] = useState("");
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);
  const [confirmLifecycleAction, setConfirmLifecycleAction] = useState<"archive" | "delete" | null>(null);

  // Sync local state from selected company
  useEffect(() => {
    if (!selectedCompany) return;
    setCompanyName(selectedCompany.name);
    setDescription(selectedCompany.description ?? "");
    setBrandColor(selectedCompany.brandColor ?? "");
    setAttachmentMaxMiB(String(Math.round((selectedCompany.attachmentMaxBytes ?? DEFAULT_COMPANY_ATTACHMENT_MAX_BYTES) / BYTES_PER_MIB)));
    setMaxConcurrentRuns(String(selectedCompany.maxConcurrentRuns ?? COMPANY_DEFAULT_MAX_CONCURRENT_RUNS));
    setMaxConcurrentRunsPerAgent(String(selectedCompany.maxConcurrentRunsPerAgent ?? COMPANY_DEFAULT_MAX_CONCURRENT_RUNS_PER_AGENT));
    setLogoUrl(selectedCompany.logoUrl ?? "");
  }, [selectedCompany]);

  const attachmentMaxBytes = Number.parseInt(attachmentMaxMiB, 10) * BYTES_PER_MIB;
  const parsedMaxConcurrentRuns = Number.parseInt(maxConcurrentRuns, 10);
  const parsedMaxConcurrentRunsPerAgent = Number.parseInt(maxConcurrentRunsPerAgent, 10);
  const attachmentMaxValid =
    Number.isInteger(attachmentMaxBytes)
    && attachmentMaxBytes >= BYTES_PER_MIB
    && attachmentMaxBytes <= MAX_COMPANY_ATTACHMENT_MAX_BYTES;
  const maxConcurrentRunsValid =
    Number.isInteger(parsedMaxConcurrentRuns)
    && parsedMaxConcurrentRuns >= 1
    && parsedMaxConcurrentRuns <= COMPANY_MAX_CONCURRENT_RUNS_LIMIT;
  const maxConcurrentRunsPerAgentValid =
    Number.isInteger(parsedMaxConcurrentRunsPerAgent)
    && parsedMaxConcurrentRunsPerAgent >= 1
    && parsedMaxConcurrentRunsPerAgent <= COMPANY_MAX_CONCURRENT_RUNS_LIMIT;
  const concurrencyValid = maxConcurrentRunsValid && maxConcurrentRunsPerAgentValid;
  const cloudSyncEnabled = experimentalSettings?.enableCloudSync === true;
  const workspaceRootQuery = useQuery({
    queryKey: selectedCompanyId
      ? queryKeys.companies.workspaceRoot(selectedCompanyId)
      : queryKeys.companies.all,
    queryFn: () => companiesApi.workspaceRoot(selectedCompanyId!),
    enabled: Boolean(selectedCompanyId),
  });

  const generalDirty =
    !!selectedCompany &&
    (companyName !== selectedCompany.name ||
      description !== (selectedCompany.description ?? "") ||
      brandColor !== (selectedCompany.brandColor ?? "") ||
      attachmentMaxBytes !== (selectedCompany.attachmentMaxBytes ?? DEFAULT_COMPANY_ATTACHMENT_MAX_BYTES));
  const concurrencyDirty =
    !!selectedCompany &&
    (parsedMaxConcurrentRuns !== (selectedCompany.maxConcurrentRuns ?? COMPANY_DEFAULT_MAX_CONCURRENT_RUNS) ||
      parsedMaxConcurrentRunsPerAgent !== (selectedCompany.maxConcurrentRunsPerAgent ?? COMPANY_DEFAULT_MAX_CONCURRENT_RUNS_PER_AGENT));

  const generalMutation = useMutation({
    mutationFn: (data: {
      name: string;
      description: string | null;
      brandColor: string | null;
      attachmentMaxBytes: number;
    }) => companiesApi.update(selectedCompanyId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
    }
  });

  const settingsMutation = useMutation({
    mutationFn: (requireApproval: boolean) =>
      companiesApi.update(selectedCompanyId!, {
        requireBoardApprovalForNewAgents: requireApproval
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
    }
  });

  const concurrencyMutation = useMutation({
    mutationFn: (data: {
      maxConcurrentRuns: number;
      maxConcurrentRunsPerAgent: number;
    }) => companiesApi.update(selectedCompanyId!, data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
    }
  });

  const syncLogoState = (nextLogoUrl: string | null) => {
    setLogoUrl(nextLogoUrl ?? "");
    void queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
  };

  const logoUploadMutation = useMutation({
    mutationFn: (file: File) =>
      assetsApi
        .uploadCompanyLogo(selectedCompanyId!, file)
        .then((asset) => companiesApi.update(selectedCompanyId!, { logoAssetId: asset.assetId })),
    onSuccess: (company) => {
      syncLogoState(company.logoUrl);
      setLogoUploadError(null);
    }
  });

  const clearLogoMutation = useMutation({
    mutationFn: () => companiesApi.update(selectedCompanyId!, { logoAssetId: null }),
    onSuccess: (company) => {
      setLogoUploadError(null);
      syncLogoState(company.logoUrl);
    }
  });

  function handleLogoFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.currentTarget.value = "";
    if (!file) return;
    setLogoUploadError(null);
    logoUploadMutation.mutate(file);
  }

  function handleClearLogo() {
    clearLogoMutation.mutate();
  }

  const archiveMutation = useMutation({
    mutationFn: ({
      companyId,
      nextCompanyId
    }: {
      companyId: string;
      nextCompanyId: string | null;
    }) => companiesApi.archive(companyId).then(() => ({ nextCompanyId })),
    onSuccess: async ({ nextCompanyId }) => {
      if (nextCompanyId) {
        setSelectedCompanyId(nextCompanyId);
      }
      await queryClient.invalidateQueries({
        queryKey: queryKeys.companies.all
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.companies.stats
      });
    }
  });
  const restoreMutation = useMutation({
    mutationFn: (companyId: string) => companiesApi.update(companyId, { status: "active" }),
    onSuccess: async (company) => {
      setSelectedCompanyId(company.id);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.companies.all
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.companies.stats
      });
    }
  });
  const deleteMutation = useMutation({
    mutationFn: ({
      companyId,
      nextCompanyId
    }: {
      companyId: string;
      nextCompanyId: string | null;
    }) => companiesApi.remove(companyId).then(() => ({ nextCompanyId })),
    onSuccess: async ({ nextCompanyId }) => {
      if (nextCompanyId) {
        setSelectedCompanyId(nextCompanyId);
      } else {
        navigate("/companies");
      }
      await queryClient.invalidateQueries({
        queryKey: queryKeys.companies.all
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.companies.stats
      });
    }
  });

  useEffect(() => {
    setBreadcrumbs([
      { label: selectedCompany?.name ?? t("ui.companySettings.company"), href: "/dashboard" },
      { label: t("ui.companySettings.settings") }
    ]);
  }, [setBreadcrumbs, selectedCompany?.name]);

  if (!selectedCompany) {
    return (
      <div className="text-sm text-muted-foreground">
        No company selected. Select a company from the switcher above.
      </div>
    );
  }

  function handleSaveGeneral() {
    generalMutation.mutate({
      name: companyName.trim(),
      description: description.trim() || null,
      brandColor: brandColor || null,
      attachmentMaxBytes
    });
  }

  function nextActiveCompanyId() {
    if (!selectedCompanyId) return null;
    return companies.find(
      (company) =>
        company.id !== selectedCompanyId &&
        company.status !== "archived"
    )?.id ?? null;
  }

  function confirmArchiveCompany() {
    if (!selectedCompanyId) return;
    archiveMutation.mutate({
      companyId: selectedCompanyId,
      nextCompanyId: nextActiveCompanyId()
    });
    setConfirmLifecycleAction(null);
  }

  function restoreCompany() {
    if (!selectedCompanyId) return;
    restoreMutation.mutate(selectedCompanyId);
  }

  function confirmDeleteCompany() {
    if (!selectedCompanyId) return;
    deleteMutation.mutate({
      companyId: selectedCompanyId,
      nextCompanyId: nextActiveCompanyId()
    });
    setConfirmLifecycleAction(null);
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-lg font-semibold">{t("ui.companySettings.title")}</h1>
      </div>

      {/* General */}
      <div className="space-y-4">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {t("ui.companySettings.general")}
        </div>
        <div className="space-y-3 rounded-md border border-border px-4 py-4">
          <Field label={t("ui.companySettings.companyName")} hint={t("ui.companySettings.companyNameHint")}>
            <input
              className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
          </Field>
          <Field
            label={t("ui.companySettings.description")}
            hint={t("ui.companySettings.descriptionHint")}
          >
            <input
              className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
              type="text"
              value={description}
              placeholder={t("ui.companySettings.descriptionPlaceholder")}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
        </div>
      </div>

      {/* Appearance */}
      <div className="space-y-4">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {t("ui.companySettings.appearance")}
        </div>
        <div className="space-y-3 rounded-md border border-border px-4 py-4">
          <div className="flex items-start gap-4">
            <div className="shrink-0">
              <CompanyPatternIcon
                companyName={companyName || selectedCompany.name}
                logoUrl={logoUrl || null}
                brandColor={brandColor || null}
                className="rounded-(--rad-14)"
              />
            </div>
            <div className="flex-1 space-y-3">
              <Field
                label={t("ui.companySettings.logo")}
                hint={t("ui.companySettings.logoHint")}
              >
                <div className="space-y-2">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                    onChange={handleLogoFileChange}
                    className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none file:mr-4 file:rounded-md file:border-0 file:bg-muted file:px-2.5 file:py-1 file:text-xs"
                  />
                  {logoUrl && (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleClearLogo}
                        disabled={clearLogoMutation.isPending}
                      >
                        {clearLogoMutation.isPending ? t("ui.companySettings.removing") : t("ui.companySettings.removeLogo")}
                      </Button>
                    </div>
                  )}
                  {(logoUploadMutation.isError || logoUploadError) && (
                    <span className="text-xs text-destructive">
                      {logoUploadError ??
                        (logoUploadMutation.error instanceof Error
                          ? logoUploadMutation.error.message
                          : t("ui.companySettings.logoUploadFailed"))}
                    </span>
                  )}
                  {clearLogoMutation.isError && (
                    <span className="text-xs text-destructive">
                      {clearLogoMutation.error.message}
                    </span>
                  )}
                  {logoUploadMutation.isPending && (
                    <span className="text-xs text-muted-foreground">{t("ui.companySettings.uploadingLogo")}</span>
                  )}
                </div>
              </Field>
              <Field
                label={t("ui.companySettings.brandColor")}
                hint={t("ui.companySettings.brandColorHint")}
              >
                <div className="flex items-center gap-2">
                  {/* token-extraction: allowlisted — <input type="color"> value must be a real hex string, not a var() reference. */}
                  <input
                    type="color"
                    value={brandColor || "#6366f1"}
                    onChange={(e) => setBrandColor(e.target.value)}
                    className="h-8 w-8 cursor-pointer rounded border border-border bg-transparent p-0"
                  />
                  <input
                    type="text"
                    value={brandColor}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "" || /^#[0-9a-fA-F]{0,6}$/.test(v)) {
                        setBrandColor(v);
                      }
                    }}
                    placeholder={t("ui.companySettings.auto")}
                    className="w-28 rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm font-mono outline-none"
                  />
                  {brandColor && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setBrandColor("")}
                      className="text-xs text-muted-foreground"
                    >
                      {t("ui.companySettings.clear")}
                    </Button>
                  )}
                </div>
              </Field>
              <Field
                label={t("ui.companySettings.attachmentLimit")}
                hint={`Accepted range: 1-${MAX_COMPANY_ATTACHMENT_MAX_MIB} MiB.`}
              >
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={MAX_COMPANY_ATTACHMENT_MAX_MIB}
                      step={1}
                      value={attachmentMaxMiB}
                      onChange={(e) => setAttachmentMaxMiB(e.target.value)}
                      className="w-28 rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
                    />
                    <span className="text-xs text-muted-foreground">MiB</span>
                  </div>
                  {!attachmentMaxValid && (
                    <span className="text-xs text-destructive">
                      Enter a whole number from 1 to {MAX_COMPANY_ATTACHMENT_MAX_MIB}.
                    </span>
                  )}
                </div>
              </Field>
            </div>
          </div>
        </div>
      </div>

      {/* Save button for General + Appearance */}
      {generalDirty && (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleSaveGeneral}
            disabled={generalMutation.isPending || !companyName.trim() || !attachmentMaxValid}
          >
            {generalMutation.isPending ? t("ui.companySettings.saving") : t("ui.companySettings.saveChanges")}
          </Button>
          {generalMutation.isSuccess && (
            <span className="text-xs text-muted-foreground">{t("ui.companySettings.saved")}</span>
          )}
          {generalMutation.isError && (
            <span className="text-xs text-destructive">
              {generalMutation.error instanceof Error
                  ? generalMutation.error.message
                  : t("ui.companySettings.failedToSave")}
            </span>
          )}
        </div>
      )}

      {/* Company workspace */}
      <div className="space-y-4">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {t("ui.companySettings.workspace")}
        </div>
        <div className="space-y-4 rounded-md border border-border px-4 py-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-md border border-border bg-muted/40 p-2">
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="text-sm font-medium">{t("ui.companySettings.workspaceTitle")}</div>
              <p className="text-sm text-muted-foreground">
                {t("ui.companySettings.workspaceDescription")}
              </p>
            </div>
          </div>
          <Field
            label={t("ui.companySettings.workspacePath")}
            hint={t("ui.companySettings.workspacePathHint")}
          >
            <div className="rounded-md border border-border bg-muted/30 px-2.5 py-2 font-mono text-xs text-foreground" style={{ overflowWrap: "anywhere" }}>
              {workspaceRootQuery.isLoading
                ? t("ui.common.loading")
                : workspaceRootQuery.error instanceof Error
                  ? workspaceRootQuery.error.message
                  : workspaceRootQuery.data?.path ?? t("ui.companySettings.workspaceUnavailable")}
            </div>
          </Field>
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">
              {t("ui.companySettings.workspaceManagedFolders")}
            </div>
            <div className="flex flex-wrap gap-2">
              {(workspaceRootQuery.data?.directories ?? ["projects", "media", "documents", "datasets", "scripts", "outputs"]).map((directory) => (
                <span
                  key={directory}
                  className="rounded-md border border-border bg-muted/40 px-2 py-1 font-mono text-xs text-muted-foreground"
                >
                  {directory}
                </span>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("ui.companySettings.workspaceBoundaryNote")}
          </p>
        </div>
      </div>

      {/* Run concurrency */}
      <div className="space-y-4" data-testid="company-settings-concurrency-section">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          运行并发
        </div>
        <div className="space-y-4 rounded-md border border-border px-4 py-4">
          <p className="text-sm text-muted-foreground">
            控制该公司内 Agent 请求的启动槽位。超出上限的运行会留在队列中，等待已有运行结束后再启动。
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="全局请求并发数"
              hint={`该公司所有 Agent 加起来最多同时运行多少个请求。默认 ${COMPANY_DEFAULT_MAX_CONCURRENT_RUNS}。`}
            >
              <div className="flex flex-col gap-1.5">
                <input
                  type="number"
                  min={1}
                  max={COMPANY_MAX_CONCURRENT_RUNS_LIMIT}
                  step={1}
                  value={maxConcurrentRuns}
                  onChange={(e) => setMaxConcurrentRuns(e.target.value)}
                  className="w-28 rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
                />
                {!maxConcurrentRunsValid && (
                  <span className="text-xs text-destructive">
                    请输入 1 到 {COMPANY_MAX_CONCURRENT_RUNS_LIMIT} 的整数。
                  </span>
                )}
              </div>
            </Field>
            <Field
              label="单 Agent 请求并发数"
              hint={`同一个 Agent 最多同时运行多少个请求。默认 ${COMPANY_DEFAULT_MAX_CONCURRENT_RUNS_PER_AGENT}。`}
            >
              <div className="flex flex-col gap-1.5">
                <input
                  type="number"
                  min={1}
                  max={COMPANY_MAX_CONCURRENT_RUNS_LIMIT}
                  step={1}
                  value={maxConcurrentRunsPerAgent}
                  onChange={(e) => setMaxConcurrentRunsPerAgent(e.target.value)}
                  className="w-28 rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
                />
                {!maxConcurrentRunsPerAgentValid && (
                  <span className="text-xs text-destructive">
                    请输入 1 到 {COMPANY_MAX_CONCURRENT_RUNS_LIMIT} 的整数。
                  </span>
                )}
              </div>
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">
            实际启动数量还会受实例级环境变量和 vLLM 模型槽位限制约束；这里设置的是公司级运行边界。
          </p>
          {concurrencyDirty && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => concurrencyMutation.mutate({
                  maxConcurrentRuns: parsedMaxConcurrentRuns,
                  maxConcurrentRunsPerAgent: parsedMaxConcurrentRunsPerAgent,
                })}
                disabled={concurrencyMutation.isPending || !concurrencyValid}
              >
                {concurrencyMutation.isPending ? t("ui.companySettings.saving") : t("ui.companySettings.saveChanges")}
              </Button>
              {concurrencyMutation.isSuccess && (
                <span className="text-xs text-muted-foreground">{t("ui.companySettings.saved")}</span>
              )}
              {concurrencyMutation.isError && (
                <span className="text-xs text-destructive">
                  {concurrencyMutation.error instanceof Error
                    ? concurrencyMutation.error.message
                    : t("ui.companySettings.failedToSave")}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Hiring */}
      <div className="space-y-4" data-testid="company-settings-team-section">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {t("ui.companySettings.hiring")}
        </div>
        <div className="rounded-md border border-border px-4 py-3">
          <ToggleField
            label={t("ui.companySettings.requireBoardApprovalForNewHires")}
            hint={t("ui.companySettings.approvalHint")}
            checked={!!selectedCompany.requireBoardApprovalForNewAgents}
            onChange={(v) => settingsMutation.mutate(v)}
            toggleTestId="company-settings-team-approval-toggle"
          />
        </div>
      </div>

      {/* Import / Export */}
      <div className="space-y-4">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {t("ui.companySettings.packages")}
        </div>
        <div className="rounded-md border border-border px-4 py-4">
          <p className="text-sm text-muted-foreground">
            {t("ui.companySettings.packagesMoved")} {" "}
            <Link to="/org" className="underline hover:text-foreground">{t("ui.companySettings.orgChart")}</Link> {t("ui.companySettings.header")}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {cloudSyncEnabled ? (
              <Button size="sm" asChild>
                <Link to="/company/settings/cloud-upstream">
                  <CloudUpload className="mr-1.5 h-3.5 w-3.5" />
                  {t("ui.companySettings.sendToCloud")}
                </Link>
              </Button>
            ) : null}
            <Button size="sm" variant="outline" asChild>
              <Link to="/company/export">
                <Download className="mr-1.5 h-3.5 w-3.5" />
                {t("ui.companySettings.export")}
              </Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link to="/company/import">
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                {t("ui.companySettings.import")}
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="space-y-4">
        <div className="text-xs font-medium text-destructive uppercase tracking-wide">
          {t("ui.companySettings.dangerZone")}
        </div>
        <div className="space-y-3">
          <div className="rounded-md border border-amber-500/35 bg-amber-500/10 px-4 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-200">
                  {selectedCompany.status === "archived" ? (
                    <RotateCcw className="h-4 w-4" />
                  ) : (
                    <Archive className="h-4 w-4" />
                  )}
                  <span>
                    {selectedCompany.status === "archived"
                      ? t("ui.companySettings.restoreCompany")
                      : t("ui.companySettings.archiveCompany")}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {selectedCompany.status === "archived"
                    ? t("ui.companySettings.restoreCompanyDescription")
                    : t("ui.companySettings.archiveCompanyDescription")}
                </p>
              </div>
              {selectedCompany.status === "archived" ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={restoreMutation.isPending}
                  onClick={restoreCompany}
                >
                  {restoreMutation.isPending
                    ? t("ui.companySettings.restoring")
                    : t("ui.companySettings.restoreCompany")}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-amber-500/50 text-amber-700 hover:bg-amber-500/10 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200"
                  disabled={archiveMutation.isPending}
                  onClick={() => setConfirmLifecycleAction("archive")}
                >
                  {archiveMutation.isPending
                    ? t("ui.companySettings.archiving")
                    : t("ui.companySettings.archiveCompany")}
                </Button>
              )}
            </div>
            {(archiveMutation.isError || restoreMutation.isError) && (
              <p className="mt-3 text-xs text-destructive">
                {archiveMutation.error instanceof Error
                  ? archiveMutation.error.message
                  : restoreMutation.error instanceof Error
                    ? restoreMutation.error.message
                    : t("ui.companySettings.companyLifecycleActionFailed")}
              </p>
            )}
          </div>

          <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                  <Trash2 className="h-4 w-4" />
                  <span>{t("ui.companySettings.deleteCompany")}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("ui.companySettings.deleteCompanyDescription")}
                </p>
              </div>
              <Button
                size="sm"
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() => setConfirmLifecycleAction("delete")}
              >
                {deleteMutation.isPending
                  ? t("ui.companySettings.deleting")
                  : t("ui.companySettings.deleteCompany")}
              </Button>
            </div>
            {deleteMutation.isError && (
              <p className="mt-3 text-xs text-destructive">
                {deleteMutation.error instanceof Error
                  ? deleteMutation.error.message
                  : t("ui.companySettings.failedToDelete")}
              </p>
            )}
          </div>
        </div>
      </div>

      <Dialog open={confirmLifecycleAction === "archive"} onOpenChange={(open) => !open && setConfirmLifecycleAction(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("ui.companySettings.archiveConfirmTitle")}</DialogTitle>
            <DialogDescription>
              {t("ui.companySettings.archiveConfirmDescription", { name: selectedCompany.name })}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-amber-500/35 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
            <div className="flex gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{t("ui.companySettings.archiveConfirmImpact")}</p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmLifecycleAction(null)}
              disabled={archiveMutation.isPending}
            >
              {t("ui.companySettings.cancel")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-amber-500/50 text-amber-700 hover:bg-amber-500/10 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200"
              onClick={confirmArchiveCompany}
              disabled={archiveMutation.isPending}
            >
              {archiveMutation.isPending ? t("ui.companySettings.archiving") : t("ui.companySettings.archiveCompany")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmLifecycleAction === "delete"} onOpenChange={(open) => !open && setConfirmLifecycleAction(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("ui.companySettings.deleteConfirmTitle")}</DialogTitle>
            <DialogDescription>
              {t("ui.companySettings.deleteConfirmDescription", { name: selectedCompany.name })}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <div className="flex gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{t("ui.companySettings.deleteConfirmImpact")}</p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmLifecycleAction(null)}
              disabled={deleteMutation.isPending}
            >
              {t("ui.companySettings.cancel")}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={confirmDeleteCompany}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? t("ui.companySettings.deleting") : t("ui.companySettings.deleteCompany")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
