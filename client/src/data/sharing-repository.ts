import { assertSupabaseConfigured, supabase } from '@client/src/lib/supabase';

const SHARING_KEY = 'fl_location_sharing_enabled';

export function isLocationSharingEnabled(): boolean {
  return localStorage.getItem(SHARING_KEY) !== '0';
}

async function getMine(): Promise<boolean> {
  assertSupabaseConfigured();
  const { error: ensureError } = await supabase.rpc('ensure_my_profile');
  if (ensureError) throw new Error(ensureError.message);
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error('登录状态已失效');
  const { data, error } = await supabase
    .from('profiles')
    .select('location_sharing_enabled')
    .eq('id', authData.user.id)
    .single();
  if (error) throw new Error(error.message);
  const enabled = data.location_sharing_enabled !== false;
  localStorage.setItem(SHARING_KEY, enabled ? '1' : '0');
  return enabled;
}

async function setMine(enabled: boolean): Promise<void> {
  assertSupabaseConfigured();
  const previous = localStorage.getItem(SHARING_KEY);
  localStorage.setItem(SHARING_KEY, enabled ? '1' : '0');
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error('登录状态已失效');
  const { error } = await supabase
    .from('profiles')
    .update({
      location_sharing_enabled: enabled,
      updated_at: new Date().toISOString(),
    })
    .eq('id', authData.user.id);
  if (error) {
    if (previous === null) localStorage.removeItem(SHARING_KEY);
    else localStorage.setItem(SHARING_KEY, previous);
    throw new Error(error.message);
  }
}

export const sharingRepository = { getMine, setMine };
