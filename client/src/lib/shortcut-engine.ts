import { logger } from '@lark-apaas/client-toolkit/logger';
import { haversineDistance } from '@client/src/lib/utils/geo';
import type { ShortcutCondition, ShortcutAction, ShortcutRule } from '@client/src/hooks/useShortcuts';
import type { Place } from '@client/src/hooks/usePlaces';
import type { Friend } from '@client/src/hooks/useFriends';

export interface EngineContext {
  currentTime: Date;
  currentLocation?: { lat: number; lng: number };
  places: Place[];
  friends: Friend[];
  currentStatus: string;
}

const NEAR_RADIUS_METERS = 200;

// ============ Time Helpers ============

export function parseTime(timeStr: string): { hour: number; minute: number } {
  const parts: string[] = timeStr.split(':');
  const hour: number = parseInt(parts[0] || '0', 10);
  const minute: number = parseInt(parts[1] || '0', 10);
  return { hour, minute };
}

export function isTimeAfter(now: Date, target: string): boolean {
  const { hour, minute } = parseTime(target);
  const nowMin: number = now.getHours() * 60 + now.getMinutes();
  const targetMin: number = hour * 60 + minute;
  return nowMin >= targetMin;
}

export function isTimeBefore(now: Date, target: string): boolean {
  const { hour, minute } = parseTime(target);
  const nowMin: number = now.getHours() * 60 + now.getMinutes();
  const targetMin: number = hour * 60 + minute;
  return nowMin <= targetMin;
}

// ============ Condition Evaluation ============

function evaluateSingleCondition(
  condition: ShortcutCondition,
  context: EngineContext,
): boolean {
  if (condition.type === 'time') {
    if (condition.operator === 'after') {
      return isTimeAfter(context.currentTime, condition.value);
    }
    return isTimeBefore(context.currentTime, condition.value);
  }

  if (condition.type === 'location') {
    if (!context.currentLocation) return false;
    const place: Place | undefined = context.places.find(
      (p: Place) => p.id === condition.placeId,
    );
    if (!place) return false;
    const distMeters: number =
      haversineDistance(
        context.currentLocation.lat,
        context.currentLocation.lng,
        place.lat,
        place.lng,
      ) * 1000;
    if (condition.operator === 'near') {
      return distMeters <= NEAR_RADIUS_METERS;
    }
    return distMeters > NEAR_RADIUS_METERS;
  }

  if (condition.type === 'status') {
    return context.currentStatus === condition.value;
  }

  return false;
}

export function evaluateConditions(
  conditions: ShortcutCondition[],
  context: EngineContext,
): boolean {
  if (conditions.length === 0) return false;
  return conditions.every((cond: ShortcutCondition) =>
    evaluateSingleCondition(cond, context),
  );
}

// ============ Action Execution ============

export async function executeActions(
  actions: ShortcutAction[],
  _context: EngineContext,
): Promise<void> {
  for (const action of actions) {
    try {
      if (action.type === 'notify') {
        logger.info(`shortcut-engine notify: ${action.title}`, {
          content: action.content,
          friendIds: action.friendIds,
        });
      }
    } catch (err) {
      logger.error('[shortcut-engine] action execute failed', err);
    }
  }
}

// ============ Rule Check ============

export async function checkRule(
  rule: ShortcutRule,
  context: EngineContext,
): Promise<boolean> {
  if (!rule.enabled) return false;
  const satisfied: boolean = evaluateConditions(rule.conditions, context);
  if (satisfied) {
    await executeActions([rule.action], context);
    return true;
  }
  return false;
}
