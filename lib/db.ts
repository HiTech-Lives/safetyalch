import mysql, { type PoolOptions } from 'mysql2/promise';

const g = globalThis as unknown as { __pool?: mysql.Pool };

export function parseDbConfig(rawUrl?: string): PoolOptions {
  if (!rawUrl) {
    throw new Error('DATABASE_URL environment variable is not set.');
  }
  const u = new URL(rawUrl);
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''),
    connectionLimit: 10,
    connectTimeout: 8000,
    dateStrings: true,
    namedPlaceholders: false,
  };
}

export function getPool(): mysql.Pool {
  if (!g.__pool) {
    g.__pool = mysql.createPool(parseDbConfig(process.env.DATABASE_URL));
  }
  return g.__pool;
}

export async function q<T = Record<string, any>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const [rows] = await getPool().query(sql, params);
  return rows as T[];
}

export async function one<T = Record<string, any>>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await q<T>(sql, params);
  return rows[0] ?? null;
}

export async function audit(tenantId: string, actor: string | null, action: string, entity: string, entityId: string, detail?: unknown) {
  await q('INSERT INTO audit_log (tenant_id, actor_user_id, action, entity, entity_id, detail) VALUES (?,?,?,?,?,?)', [
    tenantId, actor, action, entity, entityId, detail ? JSON.stringify(detail) : null,
  ]);
}
