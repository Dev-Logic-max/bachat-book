import * as SQLite from 'expo-sqlite';
import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { supabase } from './supabase';

const DB_NAME = 'bachat_outbox.db';

/**
 * Attempts before a queued write is parked as `failed` and surfaced to the user.
 *
 * Capped rather than infinite: a row the server will never accept would
 * otherwise be retried forever, and the queue fills with a write nobody can see
 * or clear. A parked row is never auto-discarded — the user chooses retry or
 * discard, because a silently dropped expense is the failure they never forgive.
 */
const MAX_ATTEMPTS = 5;

export interface OutboxRow {
  id: string;
  table_name: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: string;
  household_id: string;
  created_at: string;
  retries: number;
  status: 'pending' | 'inflight' | 'failed';
  error?: string | null;
}

export interface PhotoQueueRow {
  id: string;
  local_uri: string;
  household_id: string;
  bytes: number;
  created_at: string;
  retries: number;
  status: 'pending' | 'inflight' | 'failed';
}

let dbInstance: SQLite.SQLiteDatabase | null = null;

function getDb(): SQLite.SQLiteDatabase {
  if (!dbInstance) {
    dbInstance = SQLite.openDatabaseSync(DB_NAME);
    initTables(dbInstance);
    recoverInflight(dbInstance);
  }
  return dbInstance;
}

/**
 * Rows are marked 'inflight' before the network call. If the app is killed or
 * the JS thread crashes mid-flush, they stay 'inflight' forever — replayOutbox
 * only selects 'pending', and getOutboxStatus only counts pending + failed, so
 * the write is stranded AND invisible. That is silent data loss.
 *
 * Reset them on every cold start. Replay is idempotent (client UUID + upsert),
 * so re-sending a write that may already have landed is safe by construction.
 */
function recoverInflight(db: SQLite.SQLiteDatabase) {
  db.runSync(`UPDATE outbox SET status = 'pending' WHERE status = 'inflight'`);
  db.runSync(`UPDATE photo_queue SET status = 'pending' WHERE status = 'inflight'`);
}

function initTables(db: SQLite.SQLiteDatabase) {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS outbox (
      id TEXT PRIMARY KEY,
      table_name TEXT NOT NULL,
      action TEXT NOT NULL,
      payload TEXT NOT NULL,
      household_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      retries INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      error TEXT
    );

    CREATE TABLE IF NOT EXISTS photo_queue (
      id TEXT PRIMARY KEY,
      local_uri TEXT NOT NULL,
      household_id TEXT NOT NULL,
      bytes INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      retries INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending'
    );
  `);
}

/**
 * Generate a client-side UUID via expo-crypto for idempotency (MOBILE-PLAN.md §2.4 & §6.4)
 */
export function generateClientUuid(): string {
  return randomUUID();
}

/**
 * Enqueue a mutation action to the expo-sqlite outbox
 */
export async function enqueueAction(
  tableName: string,
  action: 'INSERT' | 'UPDATE' | 'DELETE',
  payload: Record<string, any>,
  householdId: string,
  customId?: string
): Promise<string> {
  const db = getDb();
  const id = customId || payload.id || generateClientUuid();
  const payloadWithId = { ...payload, id };

  // The outbox is keyed on the ROW id, so a second action against the same row
  // collides. `INSERT OR REPLACE` silently destroyed the earlier action, and the
  // worst case was real data loss: create an entry offline (INSERT queued), edit
  // it offline (UPDATE replaces the INSERT), reconnect → `.update()` runs against
  // a row the server has never seen, affects 0 rows, returns 2xx, and the entry
  // is gone with no error anywhere. Merge by action instead.
  const existing = db.getFirstSync<OutboxRow>(
    `SELECT * FROM outbox WHERE id = ? AND status != 'failed'`,
    [id]
  );

  if (existing) {
    if (existing.action === 'INSERT' && action === 'UPDATE') {
      // Never flushed yet — fold the edit into the pending insert.
      const merged = { ...JSON.parse(existing.payload), ...payloadWithId };
      db.runSync(
        `UPDATE outbox SET payload = ?, status = 'pending', retries = 0, error = NULL WHERE id = ?`,
        [JSON.stringify(merged), id]
      );
      const state = await NetInfo.fetch();
      if (state.isConnected) replayOutbox();
      return id;
    }

    if (existing.action === 'INSERT' && action === 'DELETE') {
      // Created and deleted before either reached the server — drop both.
      db.runSync(`DELETE FROM outbox WHERE id = ?`, [id]);
      return id;
    }
  }

  db.runSync(
    `INSERT OR REPLACE INTO outbox (id, table_name, action, payload, household_id, status, retries, error)
     VALUES (?, ?, ?, ?, ?, 'pending', 0, NULL)`,
    [id, tableName, action, JSON.stringify(payloadWithId), householdId]
  );

  // Attempt immediate flush if online
  const state = await NetInfo.fetch();
  if (state.isConnected) {
    replayOutbox();
  }

  return id;
}

/**
 * Transient (retry) vs permanent (fail now) — MOBILE-PLAN.md §6.4.
 *
 * The previous check was `error.status >= 400 && error.status < 500`, but
 * supabase-js returns a PostgrestError shaped `{ message, details, hint, code }`
 * — there is NO `status` field. `undefined >= 400` is false, so every permanent
 * rejection was retried three times before failing and the distinction was dead
 * code. `code` is the Postgres SQLSTATE (or a PGRST* string), which is the real
 * discriminator.
 */
export function isPermanentError(error: any): boolean {
  const code: string = error?.code ?? '';

  // Class 23 — integrity constraint violation. Covers
  // `transactions_amount_sign_check` (a sign that disagrees with `type`),
  // `transactions_payment_method_check`, and the FK on `category_id`. Retrying
  // cannot make any of these succeed.
  if (code.startsWith('23')) return true;

  // 42501 insufficient_privilege — an RLS policy refused the write.
  // 42703 undefined_column, 42P01 undefined_table — a schema/type drift bug.
  if (code === '42501' || code === '42703' || code === '42P01') return true;

  // P0001 raise_exception — `assert_account_accepts_movement` refusing a
  // movement into a deleted or deactivated account, or a negative one on a
  // locked account. The picker greys these out, but a queued write replays a
  // payload built before the account changed state, so the database is the only
  // thing that can actually stop it.
  if (code === 'P0001') return true;

  // PostgREST-level rejections (schema cache, malformed body, bad range).
  if (code.startsWith('PGRST')) return true;

  // Anything else — network failure, timeout, 5xx, empty code — is transient.
  return false;
}

/**
 * Only one drain runs at a time.
 *
 * `replayOutbox` is triggered from three places — the NetInfo listener, app
 * foreground, and every `enqueueAction` — and reconnecting while the app comes
 * back to the foreground fires two of them within the same tick. Both would
 * SELECT the same pending rows before either marked them `inflight`, and send
 * every queued write twice. The upsert makes a duplicated INSERT harmless, so
 * the symptom is not corruption but a doubled request volume on exactly the bad
 * connection that caused the queue in the first place.
 *
 * A second call while draining sets `rerun` instead of starting a parallel pass,
 * so rows enqueued mid-drain are still picked up.
 */
let draining = false;
let rerun = false;

export async function replayOutbox(): Promise<{ processed: number; failed: number }> {
  if (draining) {
    rerun = true;
    return { processed: 0, failed: 0 };
  }

  draining = true;
  try {
    let total = { processed: 0, failed: 0 };
    do {
      rerun = false;
      const pass = await drainOnce();
      total = { processed: total.processed + pass.processed, failed: total.failed + pass.failed };
    } while (rerun);
    return total;
  } finally {
    draining = false;
  }
}

async function drainOnce(): Promise<{ processed: number; failed: number }> {
  const db = getDb();
  const rows = db.getAllSync<OutboxRow>(
    `SELECT * FROM outbox WHERE status = 'pending' ORDER BY created_at ASC`
  );

  let processed = 0;
  let failed = 0;

  for (const row of rows) {
    db.runSync(`UPDATE outbox SET status = 'inflight' WHERE id = ?`, [row.id]);

    let payload: Record<string, any> = {};
    try {
      payload = JSON.parse(row.payload);
    } catch {
      db.runSync(`UPDATE outbox SET status = 'failed', error = 'Invalid JSON payload' WHERE id = ?`, [row.id]);
      failed++;
      continue;
    }

    let error: any = null;

    // Verb mapping table (MOBILE-PLAN.md §6.4)
    if (row.action === 'INSERT') {
      // INSERT -> upsert with ignoreDuplicates: true (First-write-wins idempotency)
      const res = await supabase
        .from(row.table_name as any)
        .upsert(payload as any, { onConflict: 'id', ignoreDuplicates: true });
      error = res.error;
    } else if (row.action === 'UPDATE') {
      // UPDATE -> update(patch).eq('id', id) (Last-write-wins)
      const { id: rowId, ...patch } = payload;
      const res = await (supabase.from(row.table_name as any) as any)
        .update(patch)
        .eq('id', rowId || row.id);
      error = res.error;
    } else if (row.action === 'DELETE') {
      // DELETE -> delete().eq('id', id)
      const res = await (supabase.from(row.table_name as any) as any)
        .delete()
        .eq('id', payload.id || row.id);
      error = res.error;
    }

    if (!error) {
      // Confirmed 2xx -> remove from outbox
      db.runSync(`DELETE FROM outbox WHERE id = ?`, [row.id]);
      processed++;
    } else {
      const isPermanent = isPermanentError(error);
      const newRetries = row.retries + 1;

      // Five, per MOBILE-PLAN §5.2 — this was 3 and disagreed with the plan and
      // with the banner copy. A transient failure on a bazaar 4G connection can
      // easily burn three attempts inside one bad minute, and a write that gives
      // up that early surfaces as "could not be saved" for a network blip.
      if (isPermanent || newRetries >= MAX_ATTEMPTS) {
        db.runSync(
          `UPDATE outbox SET status = 'failed', error = ?, retries = ? WHERE id = ?`,
          [error.message || JSON.stringify(error), newRetries, row.id]
        );
        failed++;
      } else {
        db.runSync(
          `UPDATE outbox SET status = 'pending', retries = ? WHERE id = ?`,
          [newRetries, row.id]
        );
      }
    }
  }

  return { processed, failed };
}

/**
 * Drop a queued row because the caller already settled it directly.
 *
 * Deliberately narrow: it will not remove a row that is mid-flight in a drain,
 * because deleting one there would let the drain's own bookkeeping resurrect it.
 */
export function removeQueued(id: string): void {
  getDb().runSync(`DELETE FROM outbox WHERE id = ? AND status != 'inflight'`, [id]);
}

/** How many writes are waiting, and how many have given up. */
export function getOutboxStatus(): { pending: number; failed: number } {
  const db = getDb();
  const pendingRow = db.getFirstSync<{ count: number }>(
    `SELECT COUNT(*) as count FROM outbox WHERE status != 'failed'`
  );
  const failedRow = db.getFirstSync<{ count: number }>(
    `SELECT COUNT(*) as count FROM outbox WHERE status = 'failed'`
  );

  return {
    pending: pendingRow?.count || 0,
    failed: failedRow?.count || 0,
  };
}

/**
 * The writes that gave up, with the real error from the server.
 *
 * Shown to the user rather than swallowed. "Your expense could not be saved,
 * here is why, retry or discard" is recoverable; a queue that quietly drops a
 * row is the failure users never forgive and never even find out about.
 */
export function getFailedRows(): OutboxRow[] {
  return getDb().getAllSync<OutboxRow>(
    `SELECT * FROM outbox WHERE status = 'failed' ORDER BY created_at ASC`
  );
}

/** Put a failed write back in the queue and try again from zero attempts. */
export function retryFailed(id?: string): void {
  const db = getDb();
  if (id) {
    db.runSync(`UPDATE outbox SET status = 'pending', retries = 0, error = NULL WHERE id = ?`, [id]);
  } else {
    db.runSync(`UPDATE outbox SET status = 'pending', retries = 0, error = NULL WHERE status = 'failed'`);
  }
  replayOutbox();
}

/**
 * Throw a failed write away. Only ever on an explicit user action — never
 * automatically, and never as a way of clearing a queue that looks stuck.
 */
export function discardFailed(id: string): void {
  getDb().runSync(`DELETE FROM outbox WHERE id = ? AND status = 'failed'`, [id]);
}

/**
 * Drain on reconnect AND on app foreground.
 *
 * NetInfo alone is not enough. Android freezes a backgrounded app's JS thread,
 * so a connection that returns while the phone is in someone's pocket fires no
 * usable event — the queue then sits full until the next write happens to
 * trigger a flush. Coming back to the foreground is the moment the user is
 * about to look at the numbers, which is exactly when they need to be true.
 */
export function setupOutboxListeners(): () => void {
  const unsubscribeNet = NetInfo.addEventListener((state) => {
    if (state.isConnected) replayOutbox();
  });

  const appStateSub = AppState.addEventListener('change', (next) => {
    if (next === 'active') replayOutbox();
  });

  return () => {
    unsubscribeNet();
    appStateSub.remove();
  };
}

/** @deprecated Use `setupOutboxListeners` — this one misses app foreground. */
export const setupOutboxNetInfoListener = setupOutboxListeners;
