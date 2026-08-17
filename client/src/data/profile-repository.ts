import type { MusicState, ProfileState } from '@client/src/lib/storage';
import { assertSupabaseConfigured, supabase } from '@client/src/lib/supabase';

type ProfileRow = {
  nickname: string | null;
  avatar_url: string | null;
  status: string | null;
  music_state: MusicState | null;
  enabled: boolean;
};

function mapProfile(row: ProfileRow): ProfileState {
  return {
    nickname: row.nickname || '新朋友',
    avatar: row.avatar_url || '',
    status: row.status || '在线',
    musicState: row.music_state || null,
  };
}

async function getMine(): Promise<ProfileState> {
  assertSupabaseConfigured();
  const { error: ensureError } = await supabase.rpc('ensure_my_profile');
  if (ensureError) throw new Error(ensureError.message);

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error('登录状态已失效');

  const { data, error } = await supabase
    .from('profiles')
    .select('nickname, avatar_url, status, music_state, enabled')
    .eq('id', authData.user.id)
    .single();
  if (error) throw new Error(error.message);
  const row = data as ProfileRow;
  if (!row.enabled) throw new Error('当前账号已停用');
  return mapProfile(row);
}

async function updateMine(profile: ProfileState): Promise<void> {
  assertSupabaseConfigured();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('登录状态已失效');

  const { error } = await supabase
    .from('profiles')
    .update({
      nickname: profile.nickname,
      avatar_url: profile.avatar || null,
      status: profile.status,
      music_state: profile.musicState,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);
  if (error) throw new Error(error.message);
}

export const profileRepository = { getMine, updateMine };
