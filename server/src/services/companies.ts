import { and, count, eq, gte, inArray, isNull, lt, notInArray, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  companies,
  companyLogos,
  assets,
  agents,
  agentWakeupRequests,
  issues,
  heartbeatRuns,
  costEvents,
} from "@paperclipai/db";
import { notFound, unprocessable } from "../errors.js";
import { environmentService } from "./environments.js";
import { heartbeatService } from "./heartbeat.js";
import { logActivity } from "./activity-log.js";
import { builtInAgentService } from "./built-in-agents.js";

export interface CompanyActivityActor {
  actorType: "user" | "agent" | "system" | "plugin";
  actorId: string;
  agentId?: string | null;
  runId?: string | null;
}

const SYSTEM_COMPANY_ACTOR: CompanyActivityActor = {
  actorType: "system",
  actorId: "system",
  agentId: null,
  runId: null,
};

function quotePgIdentifier(value: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`Unsafe PostgreSQL identifier: ${value}`);
  }
  return `"${value.replaceAll("\"", "\"\"")}"`;
}

function quotePublicTable(tableName: string): string {
  return `${quotePgIdentifier("public")}.${quotePgIdentifier(tableName)}`;
}

export function companyService(db: Db) {
  const ISSUE_PREFIX_FALLBACK = "CMP";
  const environmentsSvc = environmentService(db);
  const heartbeat = heartbeatService(db);
  const builtInAgents = builtInAgentService(db);

  type CompanyTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

  async function listCompanyScopedTables(tx: CompanyTx): Promise<string[]> {
    const rows = Array.from(await tx.execute(sql<{ tableName: string }>`
      select columns.table_name as "tableName"
      from information_schema.columns as columns
      join information_schema.tables as tables
        on tables.table_schema = columns.table_schema
       and tables.table_name = columns.table_name
      where columns.table_schema = 'public'
        and columns.column_name = 'company_id'
        and tables.table_type = 'BASE TABLE'
      order by columns.table_name
    `));
    return rows
      .map((row) => row.tableName)
      .filter((tableName): tableName is string => typeof tableName === "string" && tableName.length > 0);
  }

  async function listForeignKeyEdges(tx: CompanyTx): Promise<Array<{ childTable: string; parentTable: string }>> {
    return Array.from(await tx.execute(sql<{ childTable: string; parentTable: string }>`
      select
        key_usage.table_name as "childTable",
        constraint_usage.table_name as "parentTable"
      from information_schema.table_constraints as constraints
      join information_schema.key_column_usage as key_usage
        on constraints.constraint_name = key_usage.constraint_name
       and constraints.table_schema = key_usage.table_schema
      join information_schema.constraint_column_usage as constraint_usage
        on constraint_usage.constraint_name = constraints.constraint_name
       and constraint_usage.table_schema = constraints.table_schema
      where constraints.constraint_type = 'FOREIGN KEY'
        and constraints.table_schema = 'public'
    `));
  }

  function orderCompanyScopedTablesForDelete(
    tableNames: readonly string[],
    foreignKeyEdges: readonly { childTable: string; parentTable: string }[],
  ) {
    const tableSet = new Set(tableNames);
    const childrenByParent = new Map<string, Set<string>>();
    for (const edge of foreignKeyEdges) {
      if (edge.childTable === edge.parentTable) continue;
      if (!tableSet.has(edge.childTable) || !tableSet.has(edge.parentTable)) continue;
      let children = childrenByParent.get(edge.parentTable);
      if (!children) {
        children = new Set();
        childrenByParent.set(edge.parentTable, children);
      }
      children.add(edge.childTable);
    }

    const ordered: string[] = [];
    const visiting = new Set<string>();
    const visited = new Set<string>();

    function visit(tableName: string) {
      if (visited.has(tableName)) return;
      if (visiting.has(tableName)) return;
      visiting.add(tableName);
      const children = [...(childrenByParent.get(tableName) ?? [])].sort((left, right) => left.localeCompare(right));
      for (const child of children) visit(child);
      visiting.delete(tableName);
      visited.add(tableName);
      ordered.push(tableName);
    }

    for (const tableName of [...tableNames].sort((left, right) => left.localeCompare(right))) {
      visit(tableName);
    }

    return ordered;
  }

  async function purgeCompanyScopedRowsInTx(tx: CompanyTx, companyId: string) {
    const tableNames = await listCompanyScopedTables(tx);
    const foreignKeyEdges = await listForeignKeyEdges(tx);
    const deleteOrder = orderCompanyScopedTablesForDelete(tableNames, foreignKeyEdges);
    for (const tableName of deleteOrder) {
      await tx.execute(sql`
        delete from ${sql.raw(quotePublicTable(tableName))}
        where ${sql.raw(quotePgIdentifier("company_id"))} = ${companyId}
      `);
    }
  }

  async function applyArchiveCascadeInTx(tx: CompanyTx, id: string) {
    const pausedAgentRows = await tx
      .update(agents)
      .set({
        status: "paused",
        pauseReason: "company_archived",
        pausedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(
        eq(agents.companyId, id),
        notInArray(agents.status, ["paused", "terminated", "pending_approval"]),
      ))
      .returning({ id: agents.id });

    const activeRunIds = await tx
      .select({ id: heartbeatRuns.id })
      .from(heartbeatRuns)
      .where(and(
        eq(heartbeatRuns.companyId, id),
        inArray(heartbeatRuns.status, ["queued", "running"]),
      ))
      .then((rows) => rows.map((row) => row.id));

    await tx
      .update(agentWakeupRequests)
      .set({
        status: "cancelled",
        error: "Cancelled because the company was archived",
        finishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(
        eq(agentWakeupRequests.companyId, id),
        inArray(agentWakeupRequests.status, ["queued", "deferred_issue_execution", "claimed"]),
        isNull(agentWakeupRequests.runId),
      ));

    return { agentsPaused: pausedAgentRows.length, activeRunIds };
  }

  async function finalizeArchive(
    id: string,
    actor: CompanyActivityActor,
    cascade: { agentsPaused: number; activeRunIds: string[] },
  ) {
    for (const runId of cascade.activeRunIds) {
      await heartbeat.cancelRun(runId, "Cancelled because the company was archived");
    }

    await logActivity(db, {
      companyId: id,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId ?? null,
      runId: actor.runId ?? null,
      action: "company.archived",
      entityType: "company",
      entityId: id,
      details: {
        agentsPaused: cascade.agentsPaused,
        runsCancelled: cascade.activeRunIds.length,
      },
    });
  }

  const companySelection = {
    id: companies.id,
    name: companies.name,
    description: companies.description,
    status: companies.status,
    issuePrefix: companies.issuePrefix,
    issueCounter: companies.issueCounter,
    budgetMonthlyCents: companies.budgetMonthlyCents,
    spentMonthlyCents: companies.spentMonthlyCents,
    attachmentMaxBytes: companies.attachmentMaxBytes,
    maxConcurrentRuns: companies.maxConcurrentRuns,
    maxConcurrentRunsPerAgent: companies.maxConcurrentRunsPerAgent,
    defaultResponsibleUserId: companies.defaultResponsibleUserId,
    requireBoardApprovalForNewAgents: companies.requireBoardApprovalForNewAgents,
    feedbackDataSharingEnabled: companies.feedbackDataSharingEnabled,
    feedbackDataSharingConsentAt: companies.feedbackDataSharingConsentAt,
    feedbackDataSharingConsentByUserId: companies.feedbackDataSharingConsentByUserId,
    feedbackDataSharingTermsVersion: companies.feedbackDataSharingTermsVersion,
    brandColor: companies.brandColor,
    logoAssetId: companyLogos.assetId,
    createdAt: companies.createdAt,
    updatedAt: companies.updatedAt,
  };

  function enrichCompany<T extends { logoAssetId: string | null }>(company: T) {
    return {
      ...company,
      logoUrl: company.logoAssetId ? `/api/assets/${company.logoAssetId}/content` : null,
    };
  }

  function currentUtcMonthWindow(now = new Date()) {
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    return {
      start: new Date(Date.UTC(year, month, 1, 0, 0, 0, 0)),
      end: new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0)),
    };
  }

  async function getMonthlySpendByCompanyIds(
    companyIds: string[],
    database: Pick<Db, "select"> = db,
  ) {
    if (companyIds.length === 0) return new Map<string, number>();
    const { start, end } = currentUtcMonthWindow();
    const rows = await database
        .select({
          companyId: costEvents.companyId,
          spentMonthlyCents: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::double precision`,
        })
      .from(costEvents)
      .where(
        and(
          inArray(costEvents.companyId, companyIds),
          gte(costEvents.occurredAt, start),
          lt(costEvents.occurredAt, end),
        ),
      )
      .groupBy(costEvents.companyId);
    return new Map(rows.map((row) => [row.companyId, Number(row.spentMonthlyCents ?? 0)]));
  }

  async function hydrateCompanySpend<T extends { id: string; spentMonthlyCents: number }>(
    rows: T[],
    database: Pick<Db, "select"> = db,
  ) {
    const spendByCompanyId = await getMonthlySpendByCompanyIds(rows.map((row) => row.id), database);
    return rows.map((row) => ({
      ...row,
      spentMonthlyCents: spendByCompanyId.get(row.id) ?? 0,
    }));
  }

  function getCompanyQuery(database: Pick<Db, "select">) {
    return database
      .select(companySelection)
      .from(companies)
      .leftJoin(companyLogos, eq(companyLogos.companyId, companies.id));
  }

  function deriveIssuePrefixBase(name: string) {
    const normalized = name.toUpperCase().replace(/[^A-Z]/g, "");
    return normalized.slice(0, 3) || ISSUE_PREFIX_FALLBACK;
  }

  function suffixForAttempt(attempt: number) {
    if (attempt <= 1) return "";
    return "A".repeat(attempt - 1);
  }

  function isIssuePrefixConflict(error: unknown) {
    const seen = new Set<unknown>();
    let current = error;
    while (typeof current === "object" && current !== null && !seen.has(current)) {
      seen.add(current);
      const maybe = current as { code?: string; constraint?: string; constraint_name?: string; cause?: unknown };
      const constraint = maybe.constraint ?? maybe.constraint_name;
      if (maybe.code === "23505" && constraint === "companies_issue_prefix_idx") {
        return true;
      }
      current = maybe.cause;
    }
    return false;
  }

  async function createCompanyWithUniquePrefix(data: typeof companies.$inferInsert) {
    const base = deriveIssuePrefixBase(data.name);
    let suffix = 1;
    while (suffix < 10000) {
      const candidate = `${base}${suffixForAttempt(suffix)}`;
      try {
        const rows = await db
          .insert(companies)
          .values({ ...data, issuePrefix: candidate })
          .returning();
        return rows[0];
      } catch (error) {
        if (!isIssuePrefixConflict(error)) throw error;
      }
      suffix += 1;
    }
    throw new Error("Unable to allocate unique issue prefix");
  }

  return {
    list: async () => {
      const rows = await getCompanyQuery(db);
      const hydrated = await hydrateCompanySpend(rows);
      return hydrated.map((row) => enrichCompany(row));
    },

    getById: async (id: string) => {
      const row = await getCompanyQuery(db)
        .where(eq(companies.id, id))
        .then((rows) => rows[0] ?? null);
      if (!row) return null;
      const [hydrated] = await hydrateCompanySpend([row], db);
      return enrichCompany(hydrated);
    },

    create: async (data: typeof companies.$inferInsert) => {
      const created = await createCompanyWithUniquePrefix(data);
      await environmentsSvc.ensureLocalEnvironment(created.id);
      await builtInAgents.autoProvisionBundledAgents(created.id);
      const row = await getCompanyQuery(db)
        .where(eq(companies.id, created.id))
        .then((rows) => rows[0] ?? null);
      if (!row) throw notFound("Company not found after creation");
      const [hydrated] = await hydrateCompanySpend([row], db);
      return enrichCompany(hydrated);
    },

    update: async (
      id: string,
      data: Partial<typeof companies.$inferInsert> & { logoAssetId?: string | null },
      actor: CompanyActivityActor = SYSTEM_COMPANY_ACTOR,
    ) => {
      const result = await db.transaction(async (tx) => {
        const existing = await getCompanyQuery(tx)
          .where(eq(companies.id, id))
          .then((rows) => rows[0] ?? null);
        if (!existing) return null;

        const { logoAssetId, ...companyPatch } = data;
        const willReactivate = existing.status !== "active" && companyPatch.status === "active";
        const willArchive = existing.status !== "archived" && companyPatch.status === "archived";

        if (logoAssetId !== undefined && logoAssetId !== null) {
          const nextLogoAsset = await tx
            .select({ id: assets.id, companyId: assets.companyId })
            .from(assets)
            .where(eq(assets.id, logoAssetId))
            .then((rows) => rows[0] ?? null);
          if (!nextLogoAsset) throw notFound("Logo asset not found");
          if (nextLogoAsset.companyId !== existing.id) {
            throw unprocessable("Logo asset must belong to the same company");
          }
        }

        const updated = await tx
          .update(companies)
          .set({ ...companyPatch, updatedAt: new Date() })
          .where(eq(companies.id, id))
          .returning()
          .then((rows) => rows[0] ?? null);
        if (!updated) return null;

        let agentsRestored = 0;
        if (willReactivate) {
          const restoredRows = await tx
            .update(agents)
            .set({
              status: "idle",
              pauseReason: null,
              pausedAt: null,
              updatedAt: new Date(),
            })
            .where(and(
              eq(agents.companyId, id),
              eq(agents.status, "paused"),
              eq(agents.pauseReason, "company_archived"),
            ))
            .returning({ id: agents.id });
          agentsRestored = restoredRows.length;
        }

        const archiveCascade = willArchive ? await applyArchiveCascadeInTx(tx, id) : null;

        if (logoAssetId === null) {
          await tx.delete(companyLogos).where(eq(companyLogos.companyId, id));
        } else if (logoAssetId !== undefined) {
          await tx
            .insert(companyLogos)
            .values({
              companyId: id,
              assetId: logoAssetId,
            })
            .onConflictDoUpdate({
              target: companyLogos.companyId,
              set: {
                assetId: logoAssetId,
                updatedAt: new Date(),
              },
            });
        }

        if (logoAssetId !== undefined && existing.logoAssetId && existing.logoAssetId !== logoAssetId) {
          await tx.delete(assets).where(eq(assets.id, existing.logoAssetId));
        }

        const [hydrated] = await hydrateCompanySpend([{
          ...updated,
          logoAssetId: logoAssetId === undefined ? existing.logoAssetId : logoAssetId,
        }], tx);

        const shouldLogReactivation = willReactivate &&
          (existing.status === "archived" || agentsRestored > 0);

        return {
          company: enrichCompany(hydrated),
          reactivated: shouldLogReactivation ? { agentsRestored } : null,
          archiveCascade,
        };
      });
      if (!result) return null;
      if (result.reactivated) {
        await logActivity(db, {
          companyId: id,
          actorType: actor.actorType,
          actorId: actor.actorId,
          agentId: actor.agentId ?? null,
          runId: actor.runId ?? null,
          action: "company.reactivated",
          entityType: "company",
          entityId: id,
          details: { agentsRestored: result.reactivated.agentsRestored },
        });
      }
      if (result.archiveCascade) {
        await finalizeArchive(id, actor, result.archiveCascade);
      }
      return result.company;
    },

    archive: async (id: string, actor: CompanyActivityActor = SYSTEM_COMPANY_ACTOR) => {
      const result = await db.transaction(async (tx) => {
        const existing = await tx
          .select({ status: companies.status })
          .from(companies)
          .where(eq(companies.id, id))
          .then((rows) => rows[0] ?? null);
        if (!existing) return null;

        const wasAlreadyArchived = existing.status === "archived";

        if (!wasAlreadyArchived) {
          await tx
            .update(companies)
            .set({ status: "archived", updatedAt: new Date() })
            .where(eq(companies.id, id));
        }

        const cascade = wasAlreadyArchived ? null : await applyArchiveCascadeInTx(tx, id);

        const row = await getCompanyQuery(tx)
          .where(eq(companies.id, id))
          .then((rows) => rows[0] ?? null);
        if (!row) return null;
        const [hydrated] = await hydrateCompanySpend([row], tx);
        return {
          company: enrichCompany(hydrated),
          cascade,
        };
      });
      if (!result) return null;

      if (result.cascade) {
        await finalizeArchive(id, actor, result.cascade);
      }

      return result.company;
    },

    remove: (id: string) =>
      db.transaction(async (tx) => {
        await purgeCompanyScopedRowsInTx(tx, id);
        const rows = await tx
          .delete(companies)
          .where(eq(companies.id, id))
          .returning();
        return rows[0] ?? null;
      }),

    stats: () =>
      Promise.all([
        db
          .select({ companyId: agents.companyId, count: count() })
          .from(agents)
          .groupBy(agents.companyId),
        db
          .select({ companyId: issues.companyId, count: count() })
          .from(issues)
          .groupBy(issues.companyId),
      ]).then(([agentRows, issueRows]) => {
        const result: Record<string, { agentCount: number; issueCount: number }> = {};
        for (const row of agentRows) {
          result[row.companyId] = { agentCount: row.count, issueCount: 0 };
        }
        for (const row of issueRows) {
          if (result[row.companyId]) {
            result[row.companyId].issueCount = row.count;
          } else {
            result[row.companyId] = { agentCount: 0, issueCount: row.count };
          }
        }
        return result;
      }),
  };
}
