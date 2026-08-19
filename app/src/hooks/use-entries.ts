/**
 * Entries — a FILTERED VIEW of the one ledger, not a table of its own.
 *
 * This hook used to read and write `quick_entries` in five places. That table
 * was deleted when the ledger was unified, so against the live database every
 * one of those calls failed. There is one row per movement now, which is why
 * edit and delete here cannot fall out of step with the account balance.
 *
 * Entries = `type in ('income','expense') and is_opening = false`.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '../lib/supabase';
import { useSession } from '../providers/auth-provider';
import { enqueueAction, generateClientUuid, isPermanentError, removeQueued } from '../lib/outbox';
import { toSignedPaisa } from '../lib/ledger';
import type { Tables, TablesInsert, TablesUpdate } from '../../types/database';

/** A movement with the account and category it names, for rendering a row. */
export type EntryRow = Tables<'transactions'> & {
  account: Pick<Tables<'accounts'>, 'id' | 'name' | 'type' | 'deleted_at'> | null;
  category: Pick<Tables<'categories'>, 'id' | 'name' | 'name_ur' | 'icon' | 'tone' | 'parent_id'> | null;
};

/**
 * A PostgREST embed must NAME its foreign key when two exist. `transactions`
 * reaches `accounts` through `account_id` AND `transfer_account_id`, so a bare
 * `accounts(*)` is ambiguous: PostgREST answers `300 / PGRST201` and returns NO
 * rows. That failure wears the empty state's clothes, which is how the web
 * Transactions page showed "none found" for every household.
 */
const ENTRY_SELECT = `
  *,
  account:accounts!transactions_account_id_fkey(id, name, type, deleted_at),
  category:categories(id, name, name_ur, icon, tone, parent_id)
`;

export function useEntries(options: { limit?: number } = {}) {
  const { householdId } = useSession();
  const { limit } = options;

  return useQuery({
    queryKey: ['entries', householdId, limit ?? 'all'],
    queryFn: async (): Promise<EntryRow[]> => {
      if (!householdId) return [];

      let query = supabase
        .from('transactions')
        .select(ENTRY_SELECT)
        .eq('household_id', householdId)
        .in('type', ['income', 'expense'])
        .eq('is_opening', false)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (limit) query = query.limit(limit);

      const { data, error } = await query;

      // Surface `error` separately from "no rows". A real failure rendered as an
      // empty list is indistinguishable from a household that has logged
      // nothing, and it is the more likely of the two while a query is wrong.
      if (error) throw error;
      return (data ?? []) as unknown as EntryRow[];
    },
    enabled: !!householdId,
  });
}

/** Deprecated name kept so older screens keep compiling during the M0 sweep. */
export const useQuickEntries = useEntries;

export type CreateEntryInput = {
  type: 'income' | 'expense';
  /** POSITIVE magnitude from the form. Signing happens in `toSignedPaisa`. */
  amount_paisa: number;
  category_id?: string | null;
  note?: string | null;
  entry_date: string;
  /** Every movement names an account. Null means "fall back to cash". */
  account_id?: string | null;
  payment_method?: Tables<'transactions'>['payment_method'];
};

/**
 * A write that failed for a retryable reason belongs in the outbox, not on the
 * floor. `NetInfo.fetch()` reporting "connected" is a snapshot, not a guarantee
 * — the request can still die in flight, which on an intermittent connection is
 * the common case rather than the edge case.
 */
function isTransient(error: unknown): boolean {
  return !isPermanentError(error);
}

/**
 * Find or create this household's cash account.
 *
 * Every movement names an account and the form defaults to cash, so a household
 * that has not added one yet still needs somewhere for the entry to land. This
 * is the submit-time backstop; the FORM resolves its default by DERIVING it
 * (`accountId || cashAccountId`) rather than calling `setAccountId` in an
 * effect, which React Compiler rejects.
 *
 * Accounts start at Rs 0 — there is no opening-balance field. Money arrives by
 * logging an income entry against the account.
 */
export async function ensureCashAccount(householdId: string): Promise<string> {
  const { data: existing, error: findError } = await supabase
    .from('accounts')
    .select('id')
    .eq('household_id', householdId)
    .eq('type', 'cash')
    .is('deleted_at', null)
    .eq('is_archived', false)
    .order('created_at', { ascending: true })
    .limit(1);

  if (findError) throw findError;
  if (existing && existing.length > 0) return existing[0].id;

  const { data: created, error: createError } = await supabase
    .from('accounts')
    .insert({
      household_id: householdId,
      name: 'Cash',
      type: 'cash',
      currency: 'PKR',
    })
    .select('id')
    .single();

  if (createError) throw createError;
  return created.id;
}

export function useCreateEntry() {
  const queryClient = useQueryClient();
  const { user, householdId } = useSession();

  return useMutation({
    mutationFn: async (params: CreateEntryInput): Promise<Tables<'transactions'>> => {
      if (!user || !householdId) throw new Error('Unauthenticated');

      const id = generateClientUuid();

      // Resolving the account can hit the network. Do it before the offline
      // branch so a queued write already names one — the outbox replays a row
      // verbatim and has no chance to resolve a default later.
      const accountId = params.account_id ?? (await ensureCashAccount(householdId));

      const payload: TablesInsert<'transactions'> = {
        id,
        household_id: householdId,
        account_id: accountId,
        category_id: params.category_id || null,
        type: params.type,
        // SIGNED. The balance trigger adds this straight to the account.
        amount_paisa: toSignedPaisa(params.type, params.amount_paisa),
        date: params.entry_date,
        note: params.note || null,
        payment_method: params.payment_method ?? null,
        created_by: user.id,
        is_opening: false,
      };

      // OUTBOX FIRST, then the network — not the other way round.
      //
      // Writing to SQLite before attempting the request is what makes an entry
      // survive the app being killed mid-flight, which on a phone is routine:
      // Android reclaims a backgrounded app whenever it wants the memory. A
      // network-first write that dies between `insert()` and its response is
      // simply gone, and the user watched themselves type it.
      //
      // `enqueueAction` triggers a drain immediately when there is a connection,
      // so the common case still reaches the server in the same breath. The
      // difference only shows on the bad path — which is the path this app
      // exists for.
      await enqueueAction('transactions', 'INSERT', payload, householdId, id);

      const state = await NetInfo.fetch();
      if (!state.isConnected) {
        return { ...payload, created_at: new Date().toISOString() } as Tables<'transactions'>;
      }

      const { data, error } = await supabase
        .from('transactions')
        .insert(payload)
        .select()
        .single();

      if (!error) {
        // Landed. Drop the queued copy so the drain does not re-send it — the
        // replay upserts with `ignoreDuplicates`, so a duplicate send would be
        // harmless, but a queue that never empties reads as "not synced" forever.
        removeQueued(id);
        return data;
      }

      if (isTransient(error)) {
        // Leave it queued. The drain owns it now.
        return { ...payload, created_at: new Date().toISOString() } as Tables<'transactions'>;
      }

      // Permanent: a locked or deleted account refused by
      // `assert_account_accepts_movement`, a bad category FK, an RLS refusal on
      // a read-only workspace. Retrying cannot make these succeed, so the queued
      // copy must go too — otherwise the drain carries a row the server will
      // reject forever, and the user sees a permanent "not synced" badge for an
      // entry the form already told them failed.
      removeQueued(id);
      throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries', householdId] });
      queryClient.invalidateQueries({ queryKey: ['transactions', householdId] });
      queryClient.invalidateQueries({ queryKey: ['accounts', householdId] });
    },
  });
}

export const useCreateQuickEntry = useCreateEntry;

export function useUpdateEntry() {
  const queryClient = useQueryClient();
  const { householdId } = useSession();

  return useMutation({
    mutationFn: async (params: { id: string } & Partial<CreateEntryInput>) => {
      if (!householdId) throw new Error('Unauthenticated');

      const patch: TablesUpdate<'transactions'> = {};
      // Truthy, not `!== undefined`: `account_id` is NOT NULL, because every
      // movement names an account. "Move this entry to no account" is not a
      // thing you can express, and the column type is what says so.
      if (params.account_id) patch.account_id = params.account_id;
      if (params.category_id !== undefined) patch.category_id = params.category_id;
      if (params.note !== undefined) patch.note = params.note;
      if (params.entry_date !== undefined) patch.date = params.entry_date;
      if (params.payment_method !== undefined) patch.payment_method = params.payment_method;

      // Amount and direction move together. The sign IS the direction, and the
      // check constraint rejects a `type` that disagrees with it, so writing one
      // without the other is a guaranteed 23514.
      if (params.amount_paisa !== undefined || params.type !== undefined) {
        if (params.amount_paisa === undefined || params.type === undefined) {
          throw new Error('Changing an entry amount or direction requires both.');
        }
        patch.type = params.type;
        patch.amount_paisa = toSignedPaisa(params.type, params.amount_paisa);
      }

      const state = await NetInfo.fetch();
      if (!state.isConnected) {
        await enqueueAction('transactions', 'UPDATE', { ...patch, id: params.id }, householdId, params.id);
        return;
      }

      const { error } = await supabase.from('transactions').update(patch).eq('id', params.id);
      if (!error) return;
      if (isTransient(error)) {
        await enqueueAction('transactions', 'UPDATE', { ...patch, id: params.id }, householdId, params.id);
        return;
      }
      throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries', householdId] });
      queryClient.invalidateQueries({ queryKey: ['transactions', householdId] });
      queryClient.invalidateQueries({ queryKey: ['accounts', householdId] });
    },
  });
}

export function useDeleteEntry() {
  const queryClient = useQueryClient();
  const { householdId } = useSession();

  return useMutation({
    mutationFn: async (params: { id: string; type: Tables<'transactions'>['type'] }) => {
      if (!householdId) throw new Error('Unauthenticated');

      // Deleting one leg of a transfer creates money: the receiving account
      // keeps its credit while the sender never gave it up. Entries never
      // contains a transfer, so reaching this with one means a caller passed a
      // row from the Transactions view — refuse rather than silently halve it.
      if (params.type === 'transfer') {
        throw new Error('Use deleteTransfer() for a transfer — deleting one leg creates money.');
      }

      const state = await NetInfo.fetch();
      if (!state.isConnected) {
        await enqueueAction('transactions', 'DELETE', { id: params.id }, householdId, params.id);
        return;
      }

      // Deleting a movement moves an account balance through the balance
      // trigger. A swallowed error here tells the user their money moved when it
      // did not — every one of these calls must be checked.
      const { error } = await supabase.from('transactions').delete().eq('id', params.id);
      if (!error) return;
      if (isTransient(error)) {
        await enqueueAction('transactions', 'DELETE', { id: params.id }, householdId, params.id);
        return;
      }
      throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries', householdId] });
      queryClient.invalidateQueries({ queryKey: ['transactions', householdId] });
      queryClient.invalidateQueries({ queryKey: ['accounts', householdId] });
    },
  });
}

export const useDeleteQuickEntry = useDeleteEntry;
