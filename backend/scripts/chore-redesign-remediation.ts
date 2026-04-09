import { PrismaClient } from '@prisma/client';

import {
  summarizeLegacyChoreAudit,
  type LegacyChoreAuditRow
} from '../src/modules/chores/chore-redesign-remediation';

interface SchemaInspectionRow {
  hasTemplateId: boolean;
  hasCompletedByUserId: boolean;
  hasSlotDedupeKey: boolean;
  hasChoreTemplates: boolean;
  dueDateDataType: string | null;
}

type ChoreRedesignSchemaStage = 'legacy' | 'redesigned' | 'partial';

interface ChoreRedesignAuditReport {
  schemaStage: ChoreRedesignSchemaStage;
  readyForContractMigration: boolean;
  totalChoreCount: number;
  blockerCounts: ReturnType<typeof summarizeLegacyChoreAudit>['blockerCounts'];
  autoRemediationCounts: ReturnType<typeof summarizeLegacyChoreAudit>['autoRemediationCounts'];
  warningCounts: ReturnType<typeof summarizeLegacyChoreAudit>['warningCounts'];
  blockerSamples: ReturnType<typeof summarizeLegacyChoreAudit>['blockerSamples'];
  recurringTemplateInitialization: {
    createTemplatesAutomatically: boolean;
    legacyChoresBecomeOneOffOccurrences: boolean;
  };
  notes: string[];
}

function parseFlags(argv: string[]): {
  asJson: boolean;
  failOnBlockers: boolean;
  sampleLimit: number;
} {
  const sampleLimitFlag = argv.find((arg) => arg.startsWith('--sample-limit='));
  const rawSampleLimit = sampleLimitFlag?.split('=')[1];
  const parsedSampleLimit = rawSampleLimit ? Number(rawSampleLimit) : 20;

  return {
    asJson: argv.includes('--json'),
    failOnBlockers: !argv.includes('--no-fail-on-blockers'),
    sampleLimit:
      Number.isInteger(parsedSampleLimit) && parsedSampleLimit > 0 ? parsedSampleLimit : 20
  };
}

async function inspectSchema(prisma: PrismaClient): Promise<SchemaInspectionRow> {
  const [row] = await prisma.$queryRaw<SchemaInspectionRow[]>`
    SELECT
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'chores'
          AND column_name = 'template_id'
      ) AS "hasTemplateId",
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'chores'
          AND column_name = 'completed_by_user_id'
      ) AS "hasCompletedByUserId",
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'chores'
          AND column_name = 'slot_dedupe_key'
      ) AS "hasSlotDedupeKey",
      EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = current_schema()
          AND table_name = 'chore_templates'
      ) AS "hasChoreTemplates",
      (
        SELECT data_type
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'chores'
          AND column_name = 'due_date'
        LIMIT 1
      ) AS "dueDateDataType"
  `;

  return row;
}

function resolveSchemaStage(schema: SchemaInspectionRow): ChoreRedesignSchemaStage {
  if (
    !schema.hasTemplateId &&
    !schema.hasCompletedByUserId &&
    !schema.hasSlotDedupeKey &&
    !schema.hasChoreTemplates &&
    schema.dueDateDataType?.startsWith('timestamp')
  ) {
    return 'legacy';
  }

  if (
    schema.hasTemplateId &&
    schema.hasCompletedByUserId &&
    schema.hasSlotDedupeKey &&
    schema.hasChoreTemplates &&
    schema.dueDateDataType === 'date'
  ) {
    return 'redesigned';
  }

  return 'partial';
}

async function loadLegacyAuditRows(
  prisma: PrismaClient,
  schema: SchemaInspectionRow
): Promise<LegacyChoreAuditRow[]> {
  const completedByProjection = schema.hasCompletedByUserId
    ? `c."completed_by_user_id" AS "completedByUserId",`
    : `NULL::text AS "completedByUserId",`;

  return prisma.$queryRawUnsafe<LegacyChoreAuditRow[]>(`
    WITH latest_completed_activity AS (
      SELECT DISTINCT ON ("chore_id")
        "chore_id",
        "actor_user_id"
      FROM "chore_activity"
      WHERE "type" = 'COMPLETED'
      ORDER BY "chore_id", "created_at" DESC, "id" DESC
    )
    SELECT
      c."id" AS "id",
      c."group_id" AS "groupId",
      c."status"::text AS "status",
      c."assigned_to_user_id" AS "assignedToUserId",
      c."due_date" AS "dueDate",
      c."completed_at" AS "completedAt",
      ${completedByProjection}
      CASE
        WHEN c."assigned_to_user_id" IS NULL THEN NULL
        WHEN gm."id" IS NULL THEN 'MISSING'
        WHEN gm."status"::text = 'ACTIVE' THEN 'ACTIVE'
        ELSE 'INACTIVE'
      END AS "membershipState",
      lca."actor_user_id" AS "latestCompletedActivityActorUserId"
    FROM "chores" c
    LEFT JOIN "group_members" gm
      ON gm."group_id" = c."group_id"
     AND gm."user_id" = c."assigned_to_user_id"
    LEFT JOIN latest_completed_activity lca
      ON lca."chore_id" = c."id"
    ORDER BY c."created_at" ASC, c."id" ASC
  `);
}

function buildNotes(stage: ChoreRedesignSchemaStage): string[] {
  const notes = [
    'Legacy chores are migrated as one-off occurrences with templateId = null and slotDedupeKey = null.',
    'No recurring templates are inferred from historical chores. Admins must create recurring templates explicitly after rollout.',
    'Legacy due_date values are converted by preserving the stored calendar day with PostgreSQL due_date::date. No timezone reinterpretation is applied.',
    'completedByUserId is backfilled from the most recent COMPLETED chore_activity actor when available; missing activity history does not block rollout.'
  ];

  if (stage === 'partial') {
    notes.unshift(
      'The database appears to be partially migrated. Resolve this before continuing; partial chore redesign state is not considered rollout-safe.'
    );
  }

  return notes;
}

function printHumanReport(report: ChoreRedesignAuditReport): void {
  // eslint-disable-next-line no-console
  console.log('Chore redesign remediation audit');
  // eslint-disable-next-line no-console
  console.log(`Schema stage: ${report.schemaStage}`);
  // eslint-disable-next-line no-console
  console.log(`Total chores inspected: ${report.totalChoreCount}`);
  // eslint-disable-next-line no-console
  console.log(`Ready for contract migration: ${report.readyForContractMigration ? 'yes' : 'no'}`);
  // eslint-disable-next-line no-console
  console.log('');
  // eslint-disable-next-line no-console
  console.log('Blockers');
  for (const [code, count] of Object.entries(report.blockerCounts)) {
    // eslint-disable-next-line no-console
    console.log(`- ${code}: ${count}`);
  }

  // eslint-disable-next-line no-console
  console.log('');
  // eslint-disable-next-line no-console
  console.log('Safe auto-remediations');
  for (const [code, count] of Object.entries(report.autoRemediationCounts)) {
    // eslint-disable-next-line no-console
    console.log(`- ${code}: ${count}`);
  }

  // eslint-disable-next-line no-console
  console.log('');
  // eslint-disable-next-line no-console
  console.log('Warnings');
  for (const [code, count] of Object.entries(report.warningCounts)) {
    // eslint-disable-next-line no-console
    console.log(`- ${code}: ${count}`);
  }

  const sampleEntries = Object.entries(report.blockerSamples).filter(
    ([, samples]) => samples.length > 0
  );
  if (sampleEntries.length > 0) {
    // eslint-disable-next-line no-console
    console.log('');
    // eslint-disable-next-line no-console
    console.log('Blocker samples');

    for (const [code, samples] of sampleEntries) {
      // eslint-disable-next-line no-console
      console.log(`- ${code}`);
      for (const sample of samples) {
        // eslint-disable-next-line no-console
        console.log(
          `  - chore=${sample.id} group=${sample.groupId} status=${sample.status} assignee=${sample.assignedToUserId ?? 'null'} dueDate=${sample.dueDate ?? 'null'} completedAt=${sample.completedAt ?? 'null'}`
        );
      }
    }
  }

  // eslint-disable-next-line no-console
  console.log('');
  // eslint-disable-next-line no-console
  console.log('Notes');
  for (const note of report.notes) {
    // eslint-disable-next-line no-console
    console.log(`- ${note}`);
  }
}

async function buildReport(
  prisma: PrismaClient,
  sampleLimit: number
): Promise<ChoreRedesignAuditReport> {
  const schema = await inspectSchema(prisma);
  const schemaStage = resolveSchemaStage(schema);
  const rows = await loadLegacyAuditRows(prisma, schema);
  const summary = summarizeLegacyChoreAudit(rows, sampleLimit);
  const totalBlockers = Object.values(summary.blockerCounts).reduce(
    (count, current) => count + current,
    0
  );

  if (schema.dueDateDataType === 'date') {
    summary.autoRemediationCounts.CONVERT_DUE_DATE_TO_DATE_ONLY = 0;
  }

  return {
    schemaStage,
    readyForContractMigration: schemaStage !== 'partial' && totalBlockers === 0,
    totalChoreCount: summary.totalChoreCount,
    blockerCounts: summary.blockerCounts,
    autoRemediationCounts: summary.autoRemediationCounts,
    warningCounts: summary.warningCounts,
    blockerSamples: summary.blockerSamples,
    recurringTemplateInitialization: {
      createTemplatesAutomatically: false,
      legacyChoresBecomeOneOffOccurrences: true
    },
    notes: buildNotes(schemaStage)
  };
}

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  const prisma = new PrismaClient();

  try {
    const report = await buildReport(prisma, flags.sampleLimit);

    if (flags.asJson) {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(report, null, 2));
    } else {
      printHumanReport(report);
    }

    if (flags.failOnBlockers && !report.readyForContractMigration) {
      process.exitCode = 2;
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    // eslint-disable-next-line no-console
    console.error('Chore redesign remediation audit failed:', error);
    process.exitCode = 1;
  });
}
