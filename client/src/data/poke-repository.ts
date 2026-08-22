import { supabase } from '@client/src/lib/supabase';
import { getProfile } from '@client/src/lib/storage';
import type { PokeReceivePayload, PokeSendPayload } from '@shared/api.interface';

interface PendingPokeRow {
  sender_id: string;
  message_id: string;
  sender_nickname: string;
  sender_avatar: string | null;
  created_at: string;
}

export const pokeRepository = {
  async save(toUserId: string, payload: PokeSendPayload): Promise<void> {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!userData.user) throw new Error('登录状态已失效');
    const profile = getProfile();
    const { error } = await supabase.from('pending_pokes').upsert({
      recipient_id: toUserId,
      sender_id: userData.user.id,
      message_id: payload.messageId,
      sender_nickname: profile?.nickname || '好友',
      sender_avatar: profile?.avatar || null,
      created_at: new Date(payload.timestamp).toISOString(),
    }, { onConflict: 'recipient_id' });
    if (error) throw error;
  },

  async consumeLatest(): Promise<PokeReceivePayload | null> {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!userData.user) return null;
    const { data, error } = await supabase
      .from('pending_pokes')
      .select('sender_id,message_id,sender_nickname,sender_avatar,created_at')
      .eq('recipient_id', userData.user.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const row = data as PendingPokeRow;
    return {
      fromUserId: row.sender_id,
      fromNickname: row.sender_nickname,
      fromAvatar: row.sender_avatar || undefined,
      messageId: row.message_id,
      timestamp: new Date(row.created_at).getTime(),
    };
  },

  async remove(messageId: string): Promise<void> {
    const { error } = await supabase
      .from('pending_pokes')
      .delete()
      .eq('message_id', messageId);
    if (error) throw error;
  },
};
