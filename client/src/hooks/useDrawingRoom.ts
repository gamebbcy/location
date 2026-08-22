import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { supabase } from '@client/src/lib/supabase';

export interface DrawingPoint {
  x: number;
  y: number;
}

export interface DrawingStroke {
  id: string;
  userId: string;
  color: string;
  width: number;
  points: DrawingPoint[];
}

interface StrokeSegment {
  id: string;
  userId: string;
  color: string;
  width: number;
  points: DrawingPoint[];
}

function roomTopic(firstUserId: string, secondUserId: string): string {
  return `drawing:${[firstUserId, secondUserId].sort().join(':')}`;
}

function mergeSegment(strokes: DrawingStroke[], segment: StrokeSegment): DrawingStroke[] {
  const index = strokes.findIndex((stroke) => stroke.id === segment.id);
  if (index < 0) return [...strokes, { ...segment }];
  const next = [...strokes];
  const existing = next[index];
  next[index] = { ...existing, points: [...existing.points, ...segment.points] };
  return next;
}

export function useDrawingRoom(ownUserId: string | undefined, friendUserId: string) {
  const [strokes, setStrokes] = useState<DrawingStroke[]>([]);
  const [connected, setConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const strokesRef = useRef<DrawingStroke[]>([]);
  const pendingSegmentsRef = useRef(new Map<string, StrokeSegment>());
  const flushTimerRef = useRef<number | null>(null);

  const flushPending = useCallback(() => {
    if (flushTimerRef.current !== null) window.clearTimeout(flushTimerRef.current);
    flushTimerRef.current = null;
    for (const segment of pendingSegmentsRef.current.values()) {
      void channelRef.current?.send({ type: 'broadcast', event: 'stroke', payload: segment });
    }
    pendingSegmentsRef.current.clear();
  }, []);

  useEffect(() => { strokesRef.current = strokes; }, [strokes]);

  useEffect(() => {
    if (!ownUserId || !friendUserId) return;
    const topic = roomTopic(ownUserId, friendUserId);
    const channel = supabase.channel(topic, {
      config: { private: true, broadcast: { self: false, ack: false } },
    });
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'stroke' }, ({ payload }) => {
        const segment = payload as StrokeSegment;
        if (!segment?.id || !Array.isArray(segment.points)) return;
        setStrokes((previous) => mergeSegment(previous, segment));
      })
      .on('broadcast', { event: 'clear' }, () => setStrokes([]))
      .on('broadcast', { event: 'undo' }, ({ payload }) => {
        const strokeId = (payload as { strokeId?: string })?.strokeId;
        if (strokeId) setStrokes((previous) => previous.filter((stroke) => stroke.id !== strokeId));
      })
      .on('broadcast', { event: 'snapshot:request' }, () => {
        void channel.send({
          type: 'broadcast',
          event: 'snapshot',
          payload: { strokes: strokesRef.current.slice(-200) },
        });
      })
      .on('broadcast', { event: 'snapshot' }, ({ payload }) => {
        const incoming = (payload as { strokes?: DrawingStroke[] })?.strokes;
        if (Array.isArray(incoming) && strokesRef.current.length === 0) setStrokes(incoming);
      });

    channel.subscribe((status, error) => {
      if (status === 'SUBSCRIBED') {
        setConnected(true);
        void channel.send({ type: 'broadcast', event: 'snapshot:request', payload: {} });
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setConnected(false);
        logger.error('共享画板连接失败', error);
      } else if (status === 'CLOSED') {
        setConnected(false);
      }
    });

    return () => {
      flushPending();
      channelRef.current = null;
      setConnected(false);
      void supabase.removeChannel(channel);
    };
  }, [flushPending, friendUserId, ownUserId]);

  const startStroke = useCallback((color: string, width: number, point: DrawingPoint): string => {
    const id = crypto.randomUUID();
    if (!ownUserId) return id;
    const stroke: DrawingStroke = { id, userId: ownUserId, color, width, points: [point] };
    setStrokes((previous) => [...previous, stroke]);
    void channelRef.current?.send({ type: 'broadcast', event: 'stroke', payload: stroke });
    return id;
  }, [ownUserId]);

  const appendStroke = useCallback((strokeId: string, point: DrawingPoint): void => {
    if (!ownUserId) return;
    const existing = strokesRef.current.find((stroke) => stroke.id === strokeId);
    if (!existing) return;
    setStrokes((previous) => previous.map((stroke) => {
      if (stroke.id !== strokeId) return stroke;
      return { ...stroke, points: [...stroke.points, point] };
    }));
    const pending = pendingSegmentsRef.current.get(strokeId);
    pendingSegmentsRef.current.set(strokeId, {
      id: existing.id,
      userId: ownUserId,
      color: existing.color,
      width: existing.width,
      points: [...(pending?.points ?? []), point],
    });
    if (flushTimerRef.current === null) {
      flushTimerRef.current = window.setTimeout(flushPending, 100);
    }
  }, [flushPending, ownUserId]);

  const clear = useCallback(() => {
    setStrokes([]);
    void channelRef.current?.send({ type: 'broadcast', event: 'clear', payload: {} });
  }, []);

  const undo = useCallback(() => {
    if (!ownUserId) return;
    const ownLast = [...strokesRef.current].reverse().find((stroke) => stroke.userId === ownUserId);
    if (!ownLast) return;
    setStrokes((previous) => previous.filter((stroke) => stroke.id !== ownLast.id));
    void channelRef.current?.send({
      type: 'broadcast', event: 'undo', payload: { strokeId: ownLast.id },
    });
  }, [ownUserId]);

  return useMemo(() => ({
    strokes, connected, startStroke, appendStroke, endStroke: flushPending, clear, undo,
  }), [appendStroke, clear, connected, flushPending, startStroke, strokes, undo]);
}
