import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { shortcutsStore, getProfile, getSensitiveWords } from '@client/src/lib/storage';
import { filterSensitiveWords } from '@client/src/lib/utils/sensitive';
import { evaluateConditions } from '@client/src/lib/shortcut-engine';
import type { EngineContext } from '@client/src/lib/shortcut-engine';
import type { Place } from '@client/src/hooks/usePlaces';
import type { Friend } from '@client/src/hooks/useFriends';

export type ShortcutCondition =
  | { type: 'time'; operator: 'after' | 'before'; value: string }
  | { type: 'location'; placeId: string; operator: 'near' | 'far' }
  | { type: 'status'; value: string };

export type ShortcutAction = {
  type: 'notify';
  title: string;
  content: string;
  friendIds: string[];
};

export interface ShortcutRule {
  id: string;
  name: string;
  enabled: boolean;
  conditions: ShortcutCondition[];
  action: ShortcutAction;
  createdAt: number;
}

export interface ShortcutTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  gradient: string;
  conditions: ShortcutCondition[];
  action: ShortcutAction;
}

function genId(): string {
  return `rule_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** 保存时统一走的敏感词过滤（内置 + 自定义词库） */
function filterOnSave(text: string): string {
  try {
    const customWords = getSensitiveWords();
    return filterSensitiveWords(text, customWords);
  } catch {
    return text;
  }
}

export const SHORTCUT_TEMPLATES: ShortcutTemplate[] = [
  {
    id: 'late-night-not-home',
    name: '深夜未到家提醒',
    description: '晚上12点后还没到家，自动提醒注意安全',
    icon: 'moon',
    gradient: 'from-indigo-500 to-purple-500',
    conditions: [
      { type: 'time', operator: 'after', value: '00:00' },
      { type: 'location', placeId: '', operator: 'far' },
    ],
    action: { type: 'notify', title: '深夜未归', content: '早点回家', friendIds: [] },
  },
  {
    id: 'arrive-home-safe',
    name: '到家自动报平安',
    description: '到家后自动给好友发消息报平安',
    icon: 'home',
    gradient: 'from-teal-500 to-emerald-500',
    conditions: [{ type: 'location', placeId: '', operator: 'near' }],
    action: { type: 'notify', title: '我到家啦', content: '放心吧', friendIds: [] },
  },
  {
    id: 'leave-home-notify',
    name: '出门自动通知',
    description: '出门时自动告诉好友一声',
    icon: 'door-open',
    gradient: 'from-orange-500 to-amber-500',
    conditions: [{ type: 'location', placeId: '', operator: 'far' }],
    action: { type: 'notify', title: '我出门了', content: '记得想我', friendIds: [] },
  },
];

const ENGINE_INTERVAL_MS = 60 * 1000; // 每分钟检查一次

interface UseShortcutsOptions {
  places: Place[];
  friends: Friend[];
  currentLocation?: { lat: number; lng: number };
  currentStatus: string;
  onNotify?: (payload: {
    title: string;
    content: string;
    friendIds: string[];
  }) => void;
}

export function useShortcuts(options: UseShortcutsOptions) {
  const { places, friends, currentLocation, currentStatus, onNotify } = options;

  const [rules, setRules] = useState<ShortcutRule[]>([]);
  const [triggeredRules, setTriggeredRules] = useState<Set<string>>(new Set());
  const engineTimerRef = useRef<number | null>(null);
  const lastTriggerKeyRef = useRef<Map<string, string>>(new Map());

  const loadRules = useCallback(async (): Promise<void> => {
    try {
      const list: ShortcutRule[] = await shortcutsStore.getAll<ShortcutRule>();
      const sorted: ShortcutRule[] = list.sort(
        (a: ShortcutRule, b: ShortcutRule) => b.createdAt - a.createdAt,
      );
      setRules(sorted);
    } catch (err) {
      logger.error('load shortcuts failed', err);
    }
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const normalizeAction = (
    action: ShortcutAction | Record<string, unknown>,
  ): ShortcutAction => {
    const act = action as Partial<ShortcutAction> & Record<string, unknown>;
    const friendIds: string[] = Array.isArray(act.friendIds)
      ? act.friendIds
      : act.friendId
        ? [String(act.friendId)]
        : [];
    return {
      type: 'notify',
      title: String(act.title || ''),
      content: String(act.content || (act as { body?: string }).body || ''),
      friendIds,
    };
  };

  const addRule = useCallback(
    async (rule: Omit<ShortcutRule, 'id' | 'createdAt'>): Promise<void> => {
      const newRule: ShortcutRule = {
        ...rule,
        id: genId(),
        name: filterOnSave(rule.name),
        action: {
          ...normalizeAction(rule.action),
          title: filterOnSave(rule.action.title),
          content: filterOnSave(rule.action.content),
        },
        createdAt: Date.now(),
      };
      await shortcutsStore.put(newRule);
      await loadRules();
    },
    [loadRules],
  );

  const updateRule = useCallback(
    async (id: string, updates: Partial<ShortcutRule>): Promise<void> => {
      const existing: ShortcutRule | undefined =
        await shortcutsStore.get<ShortcutRule>(id);
      if (!existing) return;
      const updatedAction = updates.action
        ? {
            ...normalizeAction(updates.action),
            title: filterOnSave(updates.action.title),
            content: filterOnSave(updates.action.content),
          }
        : existing.action;
      const updated: ShortcutRule = {
        ...existing,
        ...updates,
        name: updates.name !== undefined ? filterOnSave(updates.name) : existing.name,
        action: updatedAction,
      };
      await shortcutsStore.put(updated);
      await loadRules();
    },
    [loadRules],
  );

  const deleteRule = useCallback(
    async (id: string): Promise<void> => {
      await shortcutsStore.delete(id);
      lastTriggerKeyRef.current.delete(id);
      setTriggeredRules((prev) => {
        const next: Set<string> = new Set(prev);
        next.delete(id);
        return next;
      });
      await loadRules();
    },
    [loadRules],
  );

  const toggleRule = useCallback(
    async (id: string, enabled: boolean): Promise<void> => {
      await updateRule(id, { enabled });
      if (!enabled) {
        lastTriggerKeyRef.current.delete(id);
        setTriggeredRules((prev) => {
          const next: Set<string> = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [updateRule],
  );

  const applyTemplate = useCallback(
    async (templateId: string): Promise<void> => {
      const template: ShortcutTemplate | undefined = SHORTCUT_TEMPLATES.find(
        (t: ShortcutTemplate) => t.id === templateId,
      );
      if (!template) return;

      const newRule: ShortcutRule = {
        id: genId(),
        name: template.name,
        enabled: true,
        conditions: template.conditions.map((c: ShortcutCondition) => ({ ...c })),
        action: { ...template.action, friendIds: [...template.action.friendIds] },
        createdAt: Date.now(),
      };

      await shortcutsStore.put(newRule);
      await loadRules();
    },
    [loadRules],
  );

  // 规则引擎定时检查
  const runEngineTick = useCallback(async (): Promise<void> => {
    const profile = getProfile();
    const status: string = currentStatus || profile?.status || '';

    const context: EngineContext = {
      currentTime: new Date(),
      currentLocation,
      places,
      friends,
      currentStatus: status,
    };

    const newlyTriggered: string[] = [];

    for (const rule of rules) {
      if (!rule.enabled) continue;

      // 生成当前触发条件的指纹，避免同一条件下重复触发
      const conditionKey: string = rule.conditions
        .map((c: ShortcutCondition) => {
          if (c.type === 'time') return `time:${c.operator}:${c.value}`;
          if (c.type === 'location') return `loc:${c.operator}:${c.placeId}`;
          return `status:${c.value}`;
        })
        .join('|');

      const lastKey: string | undefined = lastTriggerKeyRef.current.get(rule.id);
      const isSameTrigger: boolean = lastKey === conditionKey;

      const satisfied: boolean = evaluateConditions(rule.conditions, context);

      if (satisfied) {
        if (isSameTrigger) continue; // 同一状态已触发过，跳过

        lastTriggerKeyRef.current.set(rule.id, conditionKey);
        newlyTriggered.push(rule.id);

        // 执行通知动作
        try {
          const act = normalizeAction(rule.action);
          if (onNotify && act.friendIds.length > 0) {
            onNotify({
              title: act.title,
              content: act.content,
              friendIds: act.friendIds,
            });
          }
          logger.info('shortcut engine notify', {
            title: act.title,
            content: act.content,
            friendIds: act.friendIds,
          });
        } catch (err) {
          logger.error('shortcut engine action failed', err);
        }
      } else {
        // 条件不再满足，清除触发记录，允许下次重新触发
        if (lastKey) {
          lastTriggerKeyRef.current.delete(rule.id);
        }
      }
    }

    if (newlyTriggered.length > 0) {
      setTriggeredRules((prev) => {
        const next: Set<string> = new Set(prev);
        for (const id of newlyTriggered) next.add(id);
        return next;
      });
    }
  }, [rules, currentLocation, places, friends, currentStatus, onNotify]);

  const startEngine = useCallback((): void => {
    if (engineTimerRef.current !== null) return;
    logger.info('shortcut engine started');
    // 立即执行一次
    runEngineTick();
    engineTimerRef.current = window.setInterval(() => {
      runEngineTick();
    }, ENGINE_INTERVAL_MS);
  }, [runEngineTick]);

  const stopEngine = useCallback((): void => {
    if (engineTimerRef.current !== null) {
      window.clearInterval(engineTimerRef.current);
      engineTimerRef.current = null;
      logger.info('shortcut engine stopped');
    }
  }, []);

  useEffect(() => {
    return () => {
      stopEngine();
    };
  }, [stopEngine]);

  const templates = SHORTCUT_TEMPLATES;

  return {
    rules,
    templates,
    triggeredRules,
    loadRules,
    addRule,
    updateRule,
    deleteRule,
    toggleRule,
    applyTemplate,
    startEngine,
    stopEngine,
  };
}
