import { supabase } from '@client/src/lib/supabase';

export interface DrawingRecord {
  id: string;
  senderId: string;
  recipientId: string;
  storagePath: string;
  createdAt: number;
  readAt: number | null;
  senderName?: string;
  recipientName?: string;
  imageUrl?: string;
}

interface DrawingRow {
  id: string;
  sender_id: string;
  recipient_id: string;
  storage_path: string;
  created_at: string;
  read_at: string | null;
  sender?: { nickname?: string } | Array<{ nickname?: string }> | null;
  recipient?: { nickname?: string } | Array<{ nickname?: string }> | null;
}

function relationName(value: DrawingRow['sender']): string | undefined {
  const profile = Array.isArray(value) ? value[0] : value;
  return profile?.nickname;
}

async function mapRow(row: DrawingRow): Promise<DrawingRecord> {
  const { data } = await supabase.storage
    .from('friend-drawings')
    .createSignedUrl(row.storage_path, 60 * 60);
  return {
    id: row.id,
    senderId: row.sender_id,
    recipientId: row.recipient_id,
    storagePath: row.storage_path,
    createdAt: new Date(row.created_at).getTime(),
    readAt: row.read_at ? new Date(row.read_at).getTime() : null,
    senderName: relationName(row.sender),
    recipientName: relationName(row.recipient),
    imageUrl: data?.signedUrl,
  };
}

async function list(): Promise<DrawingRecord[]> {
  const { data, error } = await supabase
    .from('drawings')
    .select(`
      id, sender_id, recipient_id, storage_path, created_at, read_at,
      sender:profiles!drawings_sender_id_fkey(nickname),
      recipient:profiles!drawings_recipient_id_fkey(nickname)
    `)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return Promise.all(((data ?? []) as DrawingRow[]).map(mapRow));
}

async function send(recipientId: string, image: Blob): Promise<DrawingRecord> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error('请先登录');
  const drawingId = crypto.randomUUID();
  const storagePath = `${authData.user.id}/${drawingId}.png`;
  const { error: uploadError } = await supabase.storage
    .from('friend-drawings')
    .upload(storagePath, image, { contentType: 'image/png', upsert: false });
  if (uploadError) throw new Error(uploadError.message);

  const { data, error } = await supabase
    .from('drawings')
    .insert({
      id: drawingId,
      sender_id: authData.user.id,
      recipient_id: recipientId,
      storage_path: storagePath,
    })
    .select('id, sender_id, recipient_id, storage_path, created_at, read_at')
    .single();
  if (error) {
    await supabase.storage.from('friend-drawings').remove([storagePath]);
    throw new Error(error.message);
  }
  return mapRow(data as DrawingRow);
}

async function markRead(id: string): Promise<void> {
  const { error } = await supabase
    .from('drawings')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export const drawingRepository = { list, send, markRead };
