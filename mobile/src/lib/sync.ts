import { storage } from './storage';
import { supabase } from './supabase';

/**
 * Whole-account backup & restore. A user's entire local dataset is stored as a
 * single JSON row in `user_backups` (last-write-wins per device). Simple and
 * robust for a local-first app — real-time per-record sync can come later.
 */

async function requireUserId(): Promise<string> {
  if (!supabase) throw new Error('Cloud accounts are not configured.');
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('You need to be signed in.');
  return data.user.id;
}

/** Upload this device's data to the cloud. */
export async function backupToCloud(): Promise<void> {
  const userId = await requireUserId();
  const data = await storage.exportAll();
  const { error } = await supabase!
    .from('user_backups')
    .upsert({ user_id: userId, data, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

/** Pull the cloud backup into local storage. Returns false if none exists. */
export async function restoreFromCloud(): Promise<boolean> {
  const userId = await requireUserId();
  const { data, error } = await supabase!
    .from('user_backups')
    .select('data, updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return false;
  await storage.importAll(data.data as Record<string, string>);
  return true;
}

/** When the cloud backup was last updated, or null if none. */
export async function cloudBackupDate(): Promise<number | null> {
  const userId = await requireUserId();
  const { data, error } = await supabase!
    .from('user_backups')
    .select('updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.updated_at ? new Date(data.updated_at).getTime() : null;
}
