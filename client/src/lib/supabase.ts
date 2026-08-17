import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? '';
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabasePublishableKey,
);

// 保留可构建的占位值；运行时由登录页给出清晰配置提示。
export const supabase = createClient(
  supabaseUrl || 'https://invalid.supabase.co',
  supabasePublishableKey || 'missing-publishable-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'location-guardian-auth',
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  },
);

export function assertSupabaseConfigured(): void {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase 尚未配置，请设置 VITE_SUPABASE_URL 和 VITE_SUPABASE_PUBLISHABLE_KEY。',
    );
  }
}
