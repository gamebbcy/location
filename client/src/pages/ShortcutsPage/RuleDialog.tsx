import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@client/src/components/ui/dialog';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Label } from '@client/src/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@client/src/components/ui/select';
import { Check, Plus, Trash2, X, Users, Bell } from 'lucide-react';
import type {
  ShortcutRule,
  ShortcutCondition,
  ShortcutAction,
} from '@client/src/hooks/useShortcuts';
import type { Place } from '@client/src/hooks/usePlaces';
import type { Friend } from '@client/src/hooks/useFriends';

interface RuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule?: ShortcutRule | null;
  places: Place[];
  friends: Friend[];
  onSave: (data: Omit<ShortcutRule, 'id' | 'createdAt'>) => void | Promise<void>;
}

const MAX_TITLE_LEN = 6;
const MAX_CONTENT_LEN = 6;

interface FriendPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  friends: Friend[];
  selected: string[];
  onConfirm: (selectedIds: string[]) => void;
}

function FriendPicker({ open, onOpenChange, friends, selected, onConfirm }: FriendPickerProps) {
  const [tempSelected, setTempSelected] = useState<string[]>(selected);

  useEffect(() => {
    if (open) {
      setTempSelected(selected);
    }
  }, [open, selected]);

  const allSelected = useMemo<boolean>(
    () => friends.length > 0 && tempSelected.length === friends.length,
    [friends, tempSelected],
  );

  const toggleFriend = (userId: string): void => {
    setTempSelected((prev) =>
      prev.includes(userId)
        ? prev.filter((id: string) => id !== userId)
        : [...prev, userId],
    );
  };

  const toggleAll = (): void => {
    if (allSelected) {
      setTempSelected([]);
    } else {
      setTempSelected(friends.map((f: Friend) => f.userId));
    }
  };

  const handleCancel = (): void => {
    onOpenChange(false);
  };

  const handleConfirm = (): void => {
    onConfirm(tempSelected);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>选择提醒好友</DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between px-1 -mt-1">
          <span className="text-xs text-muted-foreground">
            已选 {tempSelected.length} / {friends.length} 位
          </span>
          <button
            type="button"
            className="text-xs text-primary hover:opacity-80"
            onClick={toggleAll}
          >
            {allSelected ? '全不选' : '全选'}
          </button>
        </div>

        <div className="max-h-[50vh] overflow-y-auto -mx-2 px-2 space-y-1">
          {friends.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              还没有好友，先去添加好友吧
            </p>
          )}
          {friends.map((f: Friend) => {
            const checked = tempSelected.includes(f.userId);
            return (
              <button
                type="button"
                key={f.userId}
                className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent/40 transition-colors text-left"
                onClick={() => toggleFriend(f.userId)}
              >
                <div
                  className={`h-5 w-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                    checked
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'border-border bg-background'
                  }`}
                >
                  {checked && <Check className="w-3.5 h-3.5" />}
                </div>
                <div
                  className="h-8 w-8 rounded-full bg-accent shrink-0 flex items-center justify-center text-xs text-foreground/80 overflow-hidden"
                  style={{
                    backgroundImage: f.avatar ? `url(${f.avatar})` : undefined,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                >
                  {!f.avatar && f.nickname.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-foreground truncate">
                    {f.nickname}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {f.isOnline ? '在线' : '离线'}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleCancel();
              }}
            >
              取消
            </Button>
          </DialogClose>
          <Button size="sm" onClick={handleConfirm} disabled={tempSelected.length === 0}>
            完成
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RuleDialog({ open, onOpenChange, rule, places, friends, onSave }: RuleDialogProps) {
  const [name, setName] = useState('');
  const [conditions, setConditions] = useState<ShortcutCondition[]>([]);
  const [action, setAction] = useState<ShortcutAction>({
    type: 'notify',
    title: '',
    content: '',
    friendIds: [],
  });
  const [pickerOpen, setPickerOpen] = useState<boolean>(false);

  useEffect(() => {
    if (open) {
      if (rule) {
        setName(rule.name);
        setConditions(rule.conditions.map((c) => ({ ...c })));
        const act = rule.action;
        const friendIds = Array.isArray(act.friendIds) ? act.friendIds : [];
        setAction({
          type: 'notify',
          title: act.title || '',
          content: act.content || '',
          friendIds,
        });
      } else {
        setName('');
        setConditions([]);
        setAction({
          type: 'notify',
          title: '',
          content: '',
          friendIds: [],
        });
      }
    }
  }, [open, rule]);

  const addCondition = (type: ShortcutCondition['type']) => {
    let cond: ShortcutCondition;
    if (type === 'time') {
      cond = { type: 'time', operator: 'after', value: '22:00' };
    } else if (type === 'location') {
      cond = { type: 'location', placeId: places[0]?.id || '', operator: 'near' };
    } else {
      cond = { type: 'status', value: '' };
    }
    setConditions([...conditions, cond]);
  };

  const updateCondition = (idx: number, patch: Partial<ShortcutCondition>) => {
    const next = [...conditions];
    next[idx] = { ...next[idx], ...patch } as ShortcutCondition;
    setConditions(next);
  };

  const removeCondition = (idx: number) => {
    setConditions(conditions.filter((_, i) => i !== idx));
  };

  const updateAction = (patch: Partial<ShortcutAction>) => {
    setAction((prev) => ({ ...prev, ...patch }));
  };

  const openPicker = (): void => {
    setPickerOpen(true);
  };

  const confirmPicker = (selectedIds: string[]): void => {
    updateAction({ friendIds: selectedIds });
  };

  const selectedFriends = useMemo<Friend[]>(() => {
    return friends.filter((f: Friend) => action.friendIds.includes(f.userId));
  }, [action.friendIds, friends]);

  const handleSave = () => {
    if (!name.trim()) return;
    if (conditions.length === 0) return;
    if (!action.title.trim() && !action.content.trim()) return;
    if (action.friendIds.length === 0) return;
    onSave({
      name: name.trim(),
      enabled: rule?.enabled ?? true,
      conditions,
      action: {
        type: 'notify',
        title: action.title.trim(),
        content: action.content.trim(),
        friendIds: action.friendIds,
      },
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{rule ? '编辑规则' : '创建规则'}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rule-name">规则名称</Label>
            <Input
              id="rule-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：到家报平安"
              maxLength={30}
            />
          </div>

          {/* 触发条件 */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-foreground/80">触发条件</Label>
              <Select onValueChange={(v) => v && addCondition(v as ShortcutCondition['type'])}>
                <SelectTrigger size="sm" className="w-32">
                  <SelectValue placeholder="添加条件" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="time">时间条件</SelectItem>
                  <SelectItem value="location">位置条件</SelectItem>
                  <SelectItem value="status">状态条件</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {conditions.length === 0 && (
              <p className="text-xs text-muted-foreground">请添加至少一个条件</p>
            )}
            {conditions.map((cond, idx) => (
              <div key={idx} className="p-3 rounded-lg bg-accent/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">
                    条件 {idx + 1} ·{' '}
                    {cond.type === 'time'
                      ? '时间'
                      : cond.type === 'location'
                        ? '位置'
                        : '状态'}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => removeCondition(idx)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                {cond.type === 'time' && (
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground">方式</Label>
                      <Select
                        value={cond.operator}
                        onValueChange={(v) =>
                          updateCondition(idx, { operator: v as 'after' | 'before' })
                        }
                      >
                        <SelectTrigger size="sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="after">在...之后</SelectItem>
                          <SelectItem value="before">在...之前</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground">时间</Label>
                      <Input
                        size={undefined}
                        value={cond.value}
                        onChange={(e) => updateCondition(idx, { value: e.target.value })}
                        placeholder="HH:mm"
                        className="h-9"
                      />
                    </div>
                  </div>
                )}
                {cond.type === 'location' && (
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground">位置</Label>
                      <Select
                        value={cond.operator}
                        onValueChange={(v) =>
                          updateCondition(idx, { operator: v as 'near' | 'far' })
                        }
                      >
                        <SelectTrigger size="sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="near">到达</SelectItem>
                          <SelectItem value="far">离开</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground">地点</Label>
                      <Select
                        value={cond.placeId}
                        onValueChange={(v) => updateCondition(idx, { placeId: v })}
                      >
                        <SelectTrigger size="sm">
                          <SelectValue placeholder="选择地点" />
                        </SelectTrigger>
                        <SelectContent>
                          {places.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
                {cond.type === 'status' && (
                  <div>
                    <Label className="text-xs text-muted-foreground">状态为</Label>
                    <Input
                      value={cond.value}
                      onChange={(e) => updateCondition(idx, { value: e.target.value })}
                      placeholder="状态值"
                      className="h-9"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 发送通知（动作区块） */}
          <div className="rounded-xl bg-accent/40 border border-accent p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <Bell className="w-4 h-4" />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-sm font-semibold text-foreground">发送通知</span>
                <span className="text-[11px] text-muted-foreground">
                  条件满足时自动给好友发一条提醒
                </span>
              </div>
            </div>

            {/* 通知标题 */}
            <div>
              <Label className="text-xs text-foreground/70 mb-1.5 block">
                通知标题
              </Label>
              <div className="relative">
                <Input
                  value={action.title}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val.length <= MAX_TITLE_LEN) {
                      updateAction({ title: val });
                    }
                  }}
                  className="h-9 bg-background pr-12"
                  placeholder="如：快回家、该吃饭了"
                  maxLength={MAX_TITLE_LEN}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground tabular-nums" data-testid="title-counter">
                  {action.title.length}/{MAX_TITLE_LEN}
                </span>
              </div>
            </div>

            {/* 通知内容 */}
            <div>
              <Label className="text-xs text-foreground/70 mb-1.5 block">
                通知内容
              </Label>
              <div className="relative">
                <Input
                  value={action.content}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val.length <= MAX_CONTENT_LEN) {
                      updateAction({ content: val });
                    }
                  }}
                  className="h-9 bg-background pr-12"
                  placeholder="详细提醒内容（6字内）"
                  maxLength={MAX_CONTENT_LEN}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground tabular-nums" data-testid="content-counter">
                  {action.content.length}/{MAX_CONTENT_LEN}
                </span>
              </div>
            </div>

            {/* 提醒谁 */}
            <div>
              <Label className="text-xs text-foreground/70 mb-1.5 block">提醒谁</Label>
              <button
                type="button"
                className="w-full min-h-10 px-3 py-2 rounded-md border border-input bg-background text-left hover:border-ring transition-colors"
                onClick={openPicker}
              >
                {selectedFriends.length === 0 ? (
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    点击选择好友
                  </span>
                ) : (
                  <div className="flex items-center gap-1.5">
                    {selectedFriends.slice(0, 5).map((f: Friend) => (
                      <div
                        key={f.userId}
                        className="h-7 w-7 rounded-full bg-accent flex items-center justify-center text-xs text-foreground/80 overflow-hidden border-2 border-background -ml-1 first:ml-0"
                        style={{
                          backgroundImage: f.avatar ? `url(${f.avatar})` : undefined,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                        }}
                        title={f.nickname}
                      >
                        {!f.avatar && f.nickname.charAt(0).toUpperCase()}
                      </div>
                    ))}
                    {selectedFriends.length > 5 && (
                      <div
                        className="h-7 w-7 rounded-full bg-primary/10 text-primary text-[10px] flex items-center justify-center border-2 border-background -ml-1"
                      >
                        +{selectedFriends.length - 5}
                      </div>
                    )}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {selectedFriends.length} 位好友
                    </span>
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="sm">
              取消
            </Button>
          </DialogClose>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={
              !name.trim() ||
              conditions.length === 0 ||
              (!action.title.trim() && !action.content.trim()) ||
              action.friendIds.length === 0
            }
          >
            <Plus className="w-4 h-4" />
            保存
          </Button>
        </DialogFooter>
      </DialogContent>

      <FriendPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        friends={friends}
        selected={action.friendIds}
        onConfirm={confirmPicker}
      />
    </Dialog>
  );
}
