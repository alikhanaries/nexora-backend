import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool, PoolClient } from 'pg';
import { DatabaseError } from '../../shared/errors/index.js';
import type { Logger } from '../../shared/logging/index.js';

/**
 * Forward-only SQL migration runner.
 *
 * Design choices, in order of importance:
 *
 * - **Forward only.** There is no `down`. Rolling back a production schema
 *   automatically is how data gets destroyed; recovery is a new migration.
 * - **Checksum verified.** An already-applied file that changed on disk aborts
 *   the run, so environments cannot silently diverge.
 * - **Advisory lock.** Concurrent deploys serialise instead of racing.
 * - **One transaction per migration.** A failure leaves the database at the
 *   last fully-applied version, never half-way through a file.
 */

/** Arbitrary but fixed: identifies this application's migration lock. */
const MIGRATION_ADVISORY_LOCK_ID = 8_147_302_915n;

const MIGRATIONS_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

const FILENAME_PATTERN = /^(\d{4})_([a-z0-9_]+)\.sql$/;

export interface MigrationFile {
  readonly version: string;
  readonly name: string;
  readonly filename: string;
  readonly sql: string;
  readonly checksum: string;
}

export interface AppliedMigration {
  readonly version: string;
  readonly name: string;
  readonly checksum: string;
  readonly appliedAt: Date;
}

export interface MigrationStatus {
  readonly applied: readonly AppliedMigration[];
  readonly pending: readonly MigrationFile[];
}

function checksumOf(sql: string): string {
  // Normalise line endings so a Windows checkout and a Linux CI agent agree.
  return createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex');
}

export async function loadMigrationFiles(
  directory: string = MIGRATIONS_DIRECTORY,
): Promise<readonly MigrationFile[]> {
  const entries = await readdir(directory);
  const sqlFiles = entries.filter((entry) => entry.endsWith('.sql')).sort();

  const migrations: MigrationFile[] = [];
  const seenVersions = new Set<string>();

  for (const filename of sqlFiles) {
    const match = FILENAME_PATTERN.exec(filename);
    if (match === null) {
      throw new DatabaseError(
        `Migration filename "${filename}" must match NNNN_snake_case_name.sql`,
      );
    }
    const version = match[1] ?? '';
    const name = match[2] ?? '';
    if (seenVersions.has(version)) {
      throw new DatabaseError(`Duplicate migration version ${version}`);
    }
    seenVersions.add(version);

    const sql = await readFile(join(directory, filename), 'utf8');
    migrations.push({ version, name, filename, sql, checksum: checksumOf(sql) });
  }

  return migrations;
}

async function ensureMigrationsTable(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version       text        PRIMARY KEY,
      name          text        NOT NULL,
      checksum      text        NOT NULL,
      applied_at    timestamptz NOT NULL DEFAULT now(),
      execution_ms  integer     NOT NULL
    )
  `);
}

async function readAppliedMigrations(client: PoolClient): Promise<readonly AppliedMigration[]> {
  const result = await client.query<{
    version: string;
    name: string;
    checksum: string;
    applied_at: Date;
  }>('SELECT version, name, checksum, applied_at FROM schema_migrations ORDER BY version');

  return result.rows.map((row) => ({
    version: row.version,
    name: row.name,
    checksum: row.checksum,
    appliedAt: row.applied_at,
  }));
}

function assertChecksumsMatch(
  applied: readonly AppliedMigration[],
  available: readonly MigrationFile[],
): void {
  const byVersion = new Map(available.map((migration) => [migration.version, migration]));

  for (const record of applied) {
    const migration = byVersion.get(record.version);
    if (migration === undefined) {
      throw new DatabaseError(
        `Migration ${record.version} (${record.name}) is recorded as applied but its file is missing. ` +
          'Refusing to run against a schema this codebase does not describe.',
      );
    }
    if (migration.checksum !== record.checksum) {
      throw new DatabaseError(
        `Migration ${record.version} (${record.name}) changed after it was applied. ` +
          'Applied migrations are immutable: add a new migration instead.',
      );
    }
  }
}

async function withAdvisoryLock<T>(
  pool: Pool,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_ADVISORY_LOCK_ID.toString()]);
    try {
      return await work(client);
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_ADVISORY_LOCK_ID.toString()]);
    }
  } finally {
    client.release();
  }
}

export interface MigrateResult {
  readonly appliedVersions: readonly string[];
  readonly alreadyUpToDate: boolean;
}

/** Applies every pending migration in version order. */
export async function migrateUp(
  pool: Pool,
  logger: Logger,
  directory?: string,
): Promise<MigrateResult> {
  const available = await loadMigrationFiles(directory);

  return withAdvisoryLock(pool, async (client) => {
    await ensureMigrationsTable(client);
    const applied = await readAppliedMigrations(client);
    assertChecksumsMatch(applied, available);

    const appliedVersions = new Set(applied.map((record) => record.version));
    const pending = available.filter((migration) => !appliedVersions.has(migration.version));

    if (pending.length === 0) {
      logger.info({ appliedCount: applied.length }, 'Database schema is up to date');
      return { appliedVersions: [], alreadyUpToDate: true };
    }

    const executed: string[] = [];
    for (const migration of pending) {
      const startedAt = Date.now();
      await client.query('BEGIN');
      try {
        await client.query(migration.sql);
        await client.query(
          'INSERT INTO schema_migrations (version, name, checksum, execution_ms) VALUES ($1, $2, $3, $4)',
          [migration.version, migration.name, migration.checksum, Date.now() - startedAt],
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw new DatabaseError(
          `Migration ${migration.filename} failed and was rolled back`,
          error,
          { version: migration.version, filename: migration.filename },
        );
      }
      executed.push(migration.version);
      logger.info(
        { version: migration.version, name: migration.name, durationMs: Date.now() - startedAt },
        'Applied migration',
      );
    }

    return { appliedVersions: executed, alreadyUpToDate: false };
  });
}

export async function migrationStatus(pool: Pool, directory?: string): Promise<MigrationStatus> {
  const available = await loadMigrationFiles(directory);

  return withAdvisoryLock(pool, async (client) => {
    await ensureMigrationsTable(client);
    const applied = await readAppliedMigrations(client);
    assertChecksumsMatch(applied, available);

    const appliedVersions = new Set(applied.map((record) => record.version));
    return {
      applied,
      pending: available.filter((migration) => !appliedVersions.has(migration.version)),
    };
  });
}
