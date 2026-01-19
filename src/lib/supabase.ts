import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://wleixwilfcfwlrzkymkb.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_TJ01ld5u6YBMc7wmrNmQAA_e0URTKZ_';

export const supabase = createClient(supabaseUrl, supabaseKey);

// マスターデータの型定義
export interface UserVisitHistory {
  id?: string;
  friend_id: string;
  implementation_count: number;
  last_implementation_date: string | null;
  created_at?: string;
  updated_at?: string;
}

// マスターデータを取得
export async function getMasterData(): Promise<UserVisitHistory[]> {
  const { data, error } = await supabase
    .from('user_visit_history')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('マスターデータ取得エラー:', error);
    throw error;
  }

  return data || [];
}

// マスターデータを1件取得（friend_id で検索）
export async function getMasterByFriendId(friendId: string): Promise<UserVisitHistory | null> {
  const { data, error } = await supabase
    .from('user_visit_history')
    .select('*')
    .eq('friend_id', friendId)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = 見つからない
    console.error('マスターデータ取得エラー:', error);
    throw error;
  }

  return data;
}

// マスターデータを保存（upsert）
export async function saveMasterData(record: UserVisitHistory): Promise<void> {
  const { error } = await supabase
    .from('user_visit_history')
    .upsert({
      friend_id: record.friend_id,
      implementation_count: record.implementation_count,
      last_implementation_date: record.last_implementation_date,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'friend_id',
    });

  if (error) {
    console.error('マスターデータ保存エラー:', error);
    throw error;
  }
}

// マスターデータを一括保存
export async function saveMasterDataBatch(records: UserVisitHistory[]): Promise<void> {
  if (records.length === 0) return;

  const upsertData = records.map(record => ({
    friend_id: record.friend_id,
    implementation_count: record.implementation_count,
    last_implementation_date: record.last_implementation_date,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('user_visit_history')
    .upsert(upsertData, {
      onConflict: 'friend_id',
    });

  if (error) {
    console.error('マスターデータ一括保存エラー:', error);
    throw error;
  }
}

// マスターデータを削除
export async function deleteMasterData(friendId: string): Promise<void> {
  const { error } = await supabase
    .from('user_visit_history')
    .delete()
    .eq('friend_id', friendId);

  if (error) {
    console.error('マスターデータ削除エラー:', error);
    throw error;
  }
}

// マスターデータの件数を取得
export async function getMasterDataCount(): Promise<number> {
  const { count, error } = await supabase
    .from('user_visit_history')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error('マスターデータ件数取得エラー:', error);
    throw error;
  }

  return count || 0;
}
