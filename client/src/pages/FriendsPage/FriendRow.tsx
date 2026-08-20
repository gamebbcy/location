import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback } from '@client/src/components/ui/avatar';
import { Button } from '@client/src/components/ui/button';
import { Trash2, Car, PersonStanding, Footprints, CircleDot } from 'lucide-react';
import { useSensitiveWords } from '@client/src/hooks/useSensitiveWords';
import type { Friend } from '@client/src/hooks/useFriends';

const MOTION_ICON_MAP = {
  stay: CircleDot,
  walk: Footprints,
  run: PersonStanding,
  vehicle: Car,
} as const;

const MOTION_COLOR_MAP: Record<string, string> = {
  stay: 'text-[hsl(168_30%_70%)]',
  walk: 'text-[hsl(168_65%_42%)]',
  run: 'text-[hsl(25_85%_55%)]',
  vehicle: 'text-[hsl(210_70%_55%)]',
};

interface FriendRowProps {
  friend: Friend;
  onLongPress: (friend: Friend) => void;
}

const LONG_PRESS_MS = 800;

export function FriendRow({ friend, onLongPress }: FriendRowProps) {
  const navigate = useNavigate();
  const { filterOnDisplay } = useSensitiveWords();
  const timerRef = useRef<number | null>(null);
  const [longPressed, setLongPressed] = useState(false);

  const displayName = useMemo<string>(() => {
    const name = friend.remark || friend.nickname;
    return filterOnDisplay(name);
  }, [friend.remark, friend.nickname, filterOnDisplay]);

  const secondaryName = useMemo<string | null>(() => {
    if (!friend.remark) return null;
    return filterOnDisplay(friend.nickname);
  }, [friend.remark, friend.nickname, filterOnDisplay]);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleTouchStart = () => {
    setLongPressed(false);
    timerRef.current = window.setTimeout(() => {
      setLongPressed(true);
      onLongPress(friend);
      if (navigator.vibrate) navigator.vibrate(30);
    }, LONG_PRESS_MS);
  };

  const handleTouchEnd = () => {
    clearTimer();
  };

  const handleClick = () => {
    if (longPressed) {
      setLongPressed(false);
      return;
    }
    navigate(`/friend/${friend.userId}`);
  };

  const MotionIcon = MOTION_ICON_MAP[friend.motionState] || CircleDot;
  const motionColor = MOTION_COLOR_MAP[friend.motionState] || '';
  const presenceLabel = friend.isOnline ? '在线' : '离线';

  return (
    <div
      className={`flex items-center gap-3 p-4 hover:bg-accent/50 transition-colors cursor-pointer select-none ${
        friend.isOnline ? '' : 'grayscale opacity-60'
      }`}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onMouseDown={handleTouchStart}
      onMouseUp={handleTouchEnd}
      onMouseLeave={handleTouchEnd}
    >
      <div className="relative shrink-0">
        <Avatar className="h-11 w-11">
          <AvatarFallback className="bg-primary/10 text-primary font-medium">
            {friend.nickname.slice(0, 1)}
          </AvatarFallback>
        </Avatar>
        {friend.isOnline && (
          <span
            className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card bg-success animate-pulse"
            style={{ animationDuration: '2s' }}
          />
        )}
      </div>
        <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground truncate">{displayName}</span>
          <MotionIcon className={`w-3.5 h-3.5 shrink-0 ${motionColor}`} />
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {secondaryName
            ? `${secondaryName} · ${presenceLabel}`
            : presenceLabel}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          onLongPress(friend);
        }}
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
}
