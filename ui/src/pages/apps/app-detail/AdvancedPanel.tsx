import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowUpRight, Loader2, Lock } from "lucide-react";
import type { AppGalleryEntry, ToolConnection } from "@paperclipai/shared";
import { humanizeConnectionDisplayName } from "@paperclipai/shared";
import { toolsApi } from "@/api/tools";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/context/ToastContext";
import { useTranslation } from "@/i18n";
import { redactUrlSecrets } from "@/lib/redact-url-secrets";
import type { AppDetailSectionProps } from "./types";

export function AdvancedPanel({
  connection,
  appName,
  galleryEntry,
  removing,
  onRemove,
  onReplaced,
}: Pick<AppDetailSectionProps, "connection" | "appName" | "galleryEntry"> & {
  removing: boolean;
  onRemove: () => void;
  onReplaced: () => void;
}) {
  return (
    <div className="space-y-6">
      <KeySection connection={connection} galleryEntry={galleryEntry} onReplaced={onReplaced} />
      <TechnicalDetails connection={connection} />
      <DangerZone appName={appName} removing={removing} onRemove={onRemove} />
    </div>
  );
}

function KeySection({
  connection,
  galleryEntry,
  onReplaced,
}: {
  connection: ToolConnection;
  galleryEntry: AppGalleryEntry | null;
  onReplaced: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-start gap-3">
          <Lock className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <div>
            <h2 className="text-sm font-bold text-foreground">{t("ui.appDetail.key")}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t("ui.appDetail.keyStoredSecurely")}
            </p>
          </div>
        </div>
        {!open && (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            {t("ui.appDetail.replaceKey")}
          </Button>
        )}
      </div>
      {open && (
        <div className="border-t border-border px-5 py-4">
          <ReconnectForm
            connection={connection}
            galleryEntry={galleryEntry}
            onCancel={() => setOpen(false)}
            onReconnected={() => {
              setOpen(false);
              onReplaced();
            }}
          />
        </div>
      )}
    </section>
  );
}

export function ReconnectCard({
  connection,
  galleryEntry,
  onReconnected,
}: {
  connection: ToolConnection;
  galleryEntry: AppGalleryEntry | null;
  onReconnected: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-5">
      <h2 className="text-sm font-bold text-amber-900 dark:text-amber-100">{t("ui.appDetail.needsReconnect")}</h2>
      <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
        {connection.healthMessage?.trim() || t("ui.appDetail.keyStoppedWorking")}
      </p>
      <div className="mt-3">
        <ReconnectForm connection={connection} galleryEntry={galleryEntry} onReconnected={onReconnected} />
      </div>
    </div>
  );
}

function ReconnectForm({
  connection,
  galleryEntry,
  onCancel,
  onReconnected,
}: {
  connection: ToolConnection;
  galleryEntry: AppGalleryEntry | null;
  onCancel?: () => void;
  onReconnected: () => void;
}) {
  const { pushToast } = useToast();
  const { t } = useTranslation();
  const fields = galleryEntry?.credentialFields ?? [];
  const [values, setValues] = useState<Record<string, string>>({});
  const [single, setSingle] = useState("");
  const usesGallery = fields.length > 0 && !!galleryEntry;

  const reconnect = useMutation({
    mutationFn: () => {
      const credentialValues = usesGallery
        ? values
        : { "credentials.authorization": single.trim() };
      return toolsApi.reconnectConnection(connection.id, credentialValues);
    },
    onSuccess: (result) => {
      const healthy =
        result.connection.healthStatus === "healthy" || result.connection.healthStatus === "unknown";
      if (healthy) {
        pushToast({
          title: t("ui.appDetail.reconnected"),
          body: t("ui.appDetail.reconnectedBody", { app: humanizeConnectionDisplayName(connection) }),
          tone: "success",
        });
        onReconnected();
      } else {
        pushToast({
          title: t("ui.appDetail.stillNotWorking"),
          body: result.connection.healthMessage?.trim() || t("ui.appDetail.keyCheckFailed"),
          tone: "error",
        });
      }
    },
    onError: (error) =>
      pushToast({
        title: t("ui.appDetail.keyDidNotWork"),
        body: error instanceof Error ? error.message : t("ui.appDetail.checkKeyTryAgain"),
        tone: "error",
      }),
  });

  const filled = usesGallery
    ? fields.every((f) => f.required === false || (values[f.configPath]?.trim().length ?? 0) > 0)
    : single.trim().length > 0;

  return (
    <div className="space-y-3">
      {usesGallery ? (
        fields.map((field) => (
          <div key={field.configPath}>
            <label className="text-xs font-medium text-foreground">{field.label}</label>
            <Input
              type="password"
              autoComplete="off"
              value={values[field.configPath] ?? ""}
              onChange={(e) => setValues({ ...values, [field.configPath]: e.target.value })}
              placeholder="****************"
              className="mt-1 h-10 font-mono"
            />
            {field.helpUrl && (
              <a
                href={field.helpUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-foreground underline underline-offset-2"
              >
                {t("ui.appDetail.whereFindThis")} <ArrowUpRight className="h-3 w-3" />
              </a>
            )}
          </div>
        ))
      ) : (
        <Input
          type="password"
          autoComplete="off"
          value={single}
          onChange={(e) => setSingle(e.target.value)}
          placeholder={t("ui.appDetail.pasteNewKey")}
          className="h-10 font-mono"
        />
      )}
      <div className="flex items-center gap-2">
        <Button size="sm" disabled={!filled || reconnect.isPending} onClick={() => reconnect.mutate()}>
          {reconnect.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          {reconnect.isPending ? t("ui.appDetail.checking") : t("ui.appDetail.checkReconnect")}
        </Button>
        {onCancel && (
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={reconnect.isPending}>
            {t("ui.common.cancel")}
          </Button>
        )}
      </div>
    </div>
  );
}

function TechnicalDetails({ connection }: { connection: ToolConnection }) {
  const { t } = useTranslation();
  return (
    <section className="rounded-xl border border-border bg-card px-5 py-4">
      <h2 className="text-sm font-bold text-foreground">{t("ui.appDetail.technicalDetails")}</h2>
      <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-(--gtc-59)">
        <dt className="text-muted-foreground">{t("ui.appDetail.address")}</dt>
        <dd className="break-all font-mono text-foreground">{connectionAddress(connection, t)}</dd>
        <dt className="text-muted-foreground">{t("ui.appDetail.connectionType")}</dt>
        <dd className="text-foreground">{connectionTransportLabel(connection.transport, t)}</dd>
      </dl>
    </section>
  );
}

export function DangerZone({
  appName,
  removing,
  onRemove,
}: {
  appName: string;
  removing: boolean;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  return (
    <section className="rounded-xl border border-destructive/40 bg-card">
      <div className="border-b border-destructive/40 px-5 py-3 text-sm font-bold text-destructive">
        {t("ui.appDetail.dangerZone")}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div>
          <p className="text-sm font-medium text-foreground">{t("ui.appDetail.removeThisApp")}</p>
          <p className="text-xs text-muted-foreground">
            {t("ui.appDetail.removeThisAppDescription", { app: appName })}
          </p>
        </div>
        {confirming ? (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={removing}>
              {t("ui.common.cancel")}
            </Button>
            <Button variant="destructive" size="sm" onClick={onRemove} disabled={removing}>
              {removing && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {t("ui.appDetail.confirmRemove")}
            </Button>
          </div>
        ) : (
          <Button variant="destructive" size="sm" onClick={() => setConfirming(true)}>
            {t("ui.appDetail.removeApp")}
          </Button>
        )}
      </div>
    </section>
  );
}

export function connectionAddress(
  connection: ToolConnection,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  const config = connection.config ?? connection.transportConfig ?? {};
  const value = config.url ?? config.endpoint ?? config.remoteUrl;
  if (typeof value === "string" && value.trim().length > 0) return redactUrlSecrets(value);
  if (connection.transport === "local_stdio") return t("ui.appDetail.localCommand");
  return t("ui.appDetail.notSet");
}

export function connectionTransportLabel(
  transport: ToolConnection["transport"],
  t: ReturnType<typeof useTranslation>["t"],
): string {
  if (transport === "remote_http") return t("ui.appDetail.remoteHttp");
  if (transport === "local_stdio") return t("ui.appDetail.localCommand");
  return t("ui.toolsShared.unknown");
}
