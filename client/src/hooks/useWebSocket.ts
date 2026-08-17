import { useCallback, useEffect, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { getProfile } from '@client/src/lib/storage';
import {
  isSupabaseConfigured,
  supabase,
} from '@client/src/lib/supabase';
import {
  isLocationSharingEnabled,
  sharingRepository,
} from '@client/src/data/sharing-repository';

type EventCallback = (data: unknown) => void;

interface UseWebSocketReturn {
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  send: (event: string, data: unknown) => void;
  on: (event: string, callback: EventCallback) => void;
  off: (event: string, callback: EventCallback) => void;
}

interface FriendChannels {
  location: RealtimeChannel;
  presence: RealtimeChannel;
  online: boolean;
  ready: Promise<boolean>;
}

const listeners = new Map<string, Set<EventCallback>>();
const connectionSubscribers = new Set<(connected: boolean) => void>();
const friendChannels = new Map<string, FriendChannels>();
const friendLocationSnapshots = new Map<string, unknown>();
const outboundNotificationChannels = new Map<string, Promise<RealtimeChannel>>();
const outboundLocationRequestChannels = new Map<string, Promise<RealtimeChannel>>();

let ownLocationChannel: RealtimeChannel | null = null;
let ownLocationRequestChannel: RealtimeChannel | null = null;
let ownNotificationChannel: RealtimeChannel | null = null;
let ownPresenceChannel: RealtimeChannel | null = null;
let connectingPromise: Promise<void> | null = null;
let connected = false;
let currentUserId: string | null = null;
let lastOwnLocationPayload: Record<string, unknown> | null = null;

function emit(event: string, payload: unknown): void {
  for (const callback of listeners.get(event) ?? []) {
    try {
      callback(payload);
    } catch (error) {
      logger.error(`realtime event handler error: ${event}`, error);
    }
  }
}

function setConnected(next: boolean): void {
  connected = next;
  for (const subscriber of connectionSubscribers) subscriber(next);
}

function sendOwnLocationSnapshot(): void {
  if (!ownLocationChannel || !lastOwnLocationPayload) return;
  if (!isLocationSharingEnabled()) return;
  const outgoing = {
    ...lastOwnLocationPayload,
    lastUpdate: Date.now(),
  };
  lastOwnLocationPayload = outgoing;
  void ownLocationChannel
    .send({ type: 'broadcast', event: 'location:update', payload: outgoing })
    .then((result) => {
      if (result !== 'ok') {
        logger.warn('Realtime location:update 重发失败', { result });
      }
    });
}

function privateChannel(topic: string, presenceKey?: string): RealtimeChannel {
  return supabase.channel(topic, {
    config: {
      private: true,
      broadcast: { self: false, ack: true },
      ...(presenceKey ? { presence: { key: presenceKey } } : {}),
    },
  });
}

function subscribeChannel(channel: RealtimeChannel): Promise<RealtimeChannel> {
  return new Promise((resolve, reject) => {
    channel.subscribe((status, error) => {
      if (status === 'SUBSCRIBED') resolve(channel);
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        reject(error ?? new Error(`Realtime 订阅失败：${status}`));
      }
    });
  });
}

async function connectRealtime(): Promise<void> {
  if (connected || connectingPromise) return connectingPromise ?? Promise.resolve();
  if (!isSupabaseConfigured) {
    logger.warn('Realtime 未连接：Supabase 环境变量尚未配置');
    return;
  }

  connectingPromise = (async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!data.session) throw new Error('Realtime 未连接：用户尚未登录');

    currentUserId = data.session.user.id;
    supabase.realtime.setAuth(data.session.access_token);
    // 连接前以数据库授权为准，避免清缓存或换设备后意外恢复位置上报。
    await sharingRepository.getMine();

    ownLocationChannel = privateChannel(`user:${currentUserId}:location`);
    ownLocationRequestChannel = privateChannel(
      `user:${currentUserId}:location-requests`,
    ).on('broadcast', { event: 'location:request' }, () => sendOwnLocationSnapshot());
    ownNotificationChannel = privateChannel(`user:${currentUserId}:notifications`)
      .on('broadcast', { event: 'alert:receive' }, ({ payload }) => emit('alert:receive', payload))
      .on('broadcast', { event: 'poke:receive' }, ({ payload }) => emit('poke:receive', payload));
    ownPresenceChannel = privateChannel(
      `friends:${currentUserId}:presence`,
      currentUserId,
    );

    await Promise.all([
      subscribeChannel(ownLocationChannel),
      subscribeChannel(ownLocationRequestChannel),
      subscribeChannel(ownNotificationChannel),
      subscribeChannel(ownPresenceChannel),
    ]);

    await ownPresenceChannel.track({
      userId: currentUserId,
      onlineAt: new Date().toISOString(),
    });
    setConnected(true);
    logger.info('Supabase Realtime connected');
  })()
    .catch((error) => {
      setConnected(false);
      logger.error('Supabase Realtime connect error', error);
    })
    .finally(() => {
      connectingPromise = null;
    });

  return connectingPromise;
}

function syncFriendPresence(userId: string): void {
  const channels = friendChannels.get(userId);
  if (!channels) return;
  const isOnline = Object.values(channels.presence.presenceState()).some(
    (entries) => entries.length > 0,
  );
  if (channels.online === isOnline) return;
  channels.online = isOnline;
  emit(isOnline ? 'friend:online' : 'friend:offline', { userId });
}

function subscribeFriend(userId: string): FriendChannels | null {
  if (!userId) return null;
  const existing = friendChannels.get(userId);
  if (existing) return existing;

  const location = privateChannel(`user:${userId}:location`)
    .on('broadcast', { event: 'location:update' }, ({ payload }) => {
      const payloadUserId = (payload as { userId?: unknown } | null)?.userId;
      if (typeof payloadUserId === 'string') {
        friendLocationSnapshots.set(payloadUserId, payload);
      }
      emit('friend:location:update', payload);
    });
  const presence = privateChannel(`friends:${userId}:presence`);
  const channels = {
    location,
    presence,
    online: false,
    ready: Promise.resolve(false),
  } satisfies FriendChannels;
  friendChannels.set(userId, channels);

  presence.on('presence', { event: 'sync' }, () => syncFriendPresence(userId));
  channels.ready = Promise.all([subscribeChannel(location), subscribeChannel(presence)])
    .then(() => {
      syncFriendPresence(userId);
      return true;
    })
    .catch((error) => {
      logger.error('好友实时通道订阅失败', { userId, error });
      return false;
    });
  return channels;
}

function getNotificationChannel(userId: string): Promise<RealtimeChannel> {
  const existing = outboundNotificationChannels.get(userId);
  if (existing) return existing;
  const promise = subscribeChannel(privateChannel(`user:${userId}:notifications`));
  outboundNotificationChannels.set(userId, promise);
  promise.catch(() => outboundNotificationChannels.delete(userId));
  return promise;
}

function getLocationRequestChannel(userId: string): Promise<RealtimeChannel> {
  const existing = outboundLocationRequestChannels.get(userId);
  if (existing) return existing;
  const promise = subscribeChannel(
    privateChannel(`user:${userId}:location-requests`),
  );
  outboundLocationRequestChannels.set(userId, promise);
  promise.catch(() => outboundLocationRequestChannels.delete(userId));
  return promise;
}

async function sendNotification(
  userId: string,
  event: 'alert:receive' | 'poke:receive',
  payload: Record<string, unknown>,
): Promise<void> {
  const channel = await getNotificationChannel(userId);
  const result = await channel.send({ type: 'broadcast', event, payload });
  if (result !== 'ok') throw new Error(`发送实时通知失败：${result}`);
}

async function sendLocationRequest(userId: string): Promise<void> {
  const channel = await getLocationRequestChannel(userId);
  const result = await channel.send({
    type: 'broadcast',
    event: 'location:request',
    payload: { requestedAt: Date.now() },
  });
  if (result !== 'ok') throw new Error(`请求实时位置失败：${result}`);
}

function sendRealtime(event: string, data: unknown): void {
  if (!connected || !currentUserId) {
    logger.warn(`realtime send skipped (not connected): ${event}`);
    return;
  }

  const payload = (data ?? {}) as Record<string, unknown>;
  if (event === 'friends:sync') {
    const friendUserIds = Array.isArray(payload.friendUserIds)
      ? payload.friendUserIds.filter((id): id is string => typeof id === 'string')
      : [];
    friendUserIds.forEach(subscribeFriend);
    emit('friends:online:snapshot', {
      userIds: friendUserIds.filter((id) => friendChannels.get(id)?.online),
    });
    return;
  }

  if (event === 'friend:location:request') {
    if (typeof payload.friendUserId === 'string') {
      const friendUserId = payload.friendUserId;
      const channels = subscribeFriend(friendUserId);
      if (!channels) return;
      void channels.ready.then((ready) => {
        if (!ready || !currentUserId) return;
        return sendLocationRequest(friendUserId);
      }).catch((error) => logger.error('请求好友位置失败', error));
    }
    return;
  }

  if (event === 'location:update' || event === 'status:update') {
    if (!ownLocationChannel) return;
    if (event === 'location:update' && !isLocationSharingEnabled()) return;
    const outgoing = {
      ...payload,
      userId: currentUserId,
      lastUpdate: Date.now(),
    };
    if (event === 'location:update') lastOwnLocationPayload = outgoing;
    void ownLocationChannel.send({ type: 'broadcast', event, payload: outgoing })
      .then((result) => {
        if (result !== 'ok') logger.warn(`Realtime ${event} 发送失败`, { result });
      });
    return;
  }

  if (event === 'poke:send' && typeof payload.toUserId === 'string') {
    void sendNotification(payload.toUserId, 'poke:receive', {
      ...payload,
      fromUserId: currentUserId,
    }).catch((error) => logger.error('拍一拍发送失败', error));
    return;
  }

  if (event === 'alert:send') {
    const targets = Array.isArray(payload.toUserIds)
      ? payload.toUserIds.filter((id): id is string => typeof id === 'string')
      : typeof payload.toUserId === 'string' ? [payload.toUserId] : [];
    const profile = getProfile();
    void Promise.all(targets.map((userId) => sendNotification(userId, 'alert:receive', {
      ...payload,
      fromUserId: currentUserId,
      fromNickname: profile?.nickname || '好友',
    }))).catch((error) => logger.error('提醒发送失败', error));
  }
}

function disconnectRealtime(): void {
  const channels = [
    ownLocationChannel,
    ownLocationRequestChannel,
    ownNotificationChannel,
    ownPresenceChannel,
    ...Array.from(friendChannels.values()).flatMap(({ location, presence }) => [location, presence]),
  ].filter((channel): channel is RealtimeChannel => channel !== null);

  void Promise.all(channels.map((channel) => supabase.removeChannel(channel)));
  for (const pendingChannel of outboundNotificationChannels.values()) {
    void pendingChannel.then((channel) => supabase.removeChannel(channel));
  }
  for (const pendingChannel of outboundLocationRequestChannels.values()) {
    void pendingChannel.then((channel) => supabase.removeChannel(channel));
  }
  ownLocationChannel = null;
  ownLocationRequestChannel = null;
  ownNotificationChannel = null;
  ownPresenceChannel = null;
  friendChannels.clear();
  friendLocationSnapshots.clear();
  outboundNotificationChannels.clear();
  outboundLocationRequestChannels.clear();
  lastOwnLocationPayload = null;
  currentUserId = null;
  setConnected(false);
}

export function useWebSocket(): UseWebSocketReturn {
  const [isConnected, setIsConnectedState] = useState(connected);

  useEffect(() => {
    connectionSubscribers.add(setIsConnectedState);
    setIsConnectedState(connected);
    return () => { connectionSubscribers.delete(setIsConnectedState); };
  }, []);

  const connect = useCallback(() => { void connectRealtime(); }, []);
  const disconnect = useCallback(() => { disconnectRealtime(); }, []);
  const send = useCallback((event: string, data: unknown) => sendRealtime(event, data), []);
  const on = useCallback((event: string, callback: EventCallback) => {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event)!.add(callback);
    // 页面切换会重新挂载 Hook；立即回放模块级快照，避免详情页从空状态开始。
    queueMicrotask(() => {
      if (!listeners.get(event)?.has(callback)) return;
      if (event === 'friend:location:update') {
        for (const payload of friendLocationSnapshots.values()) callback(payload);
      } else if (event === 'friend:online') {
        for (const [userId, channels] of friendChannels) {
          if (channels.online) callback({ userId });
        }
      } else if (event === 'friends:online:snapshot') {
        callback({
          userIds: Array.from(friendChannels.entries())
            .filter(([, channels]) => channels.online)
            .map(([userId]) => userId),
        });
      }
    });
  }, []);
  const off = useCallback((event: string, callback: EventCallback) => {
    const callbacks = listeners.get(event);
    callbacks?.delete(callback);
    if (callbacks?.size === 0) listeners.delete(event);
  }, []);

  return { isConnected, connect, disconnect, send, on, off };
}
