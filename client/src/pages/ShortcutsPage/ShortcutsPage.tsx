import { useState, useEffect, useCallback, useRef } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import {
  Plus,
  Trash2,
  Clock,
  MapPin,
  Activity,
  Bell,
  Edit3,
  UserCheck,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import { Switch } from '@client/src/components/ui/switch';
import { Badge } from '@client/src/components/ui/badge';
import {
  useShortcuts,
  type ShortcutRule,
  type ShortcutCondition,
} from '@client/src/hooks/useShortcuts';
import { usePlaces, type Place } from '@client/src/hooks/usePlaces';
import { useFriends, type Friend } from '@client/src/hooks/useFriends';
import { useProfile } from '@client/src/hooks/useProfile';
import { useWebSocket } from '@client/src/hooks/useWebSocket';
import { TemplateSection } from './TemplateSection';
import { RuleDialog } from './RuleDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from '@client/src/components/ui/dialog';
import { toast } from 'sonner';
import type { AlertSendPayload } from '@shared/api.interface';

// ============ 摘要函数 ============

function conditionBadgeVariant(cond: ShortcutCondition): string {
  if (cond.type === 'time') return 'bg-blue-50 text-blue-600 border-blue-100';
  if (cond.type === 'location')
    return 'bg-teal-50 text-teal-600 border-teal-100';
  return 'bg-amber-50 text-amber-600 border-amber-100';
}

function conditionLabel(cond: ShortcutCondition, places: Place[]): string {
  if (cond.type === 'time') {
    return `${cond.operator === 'after' ? '晚于' : '早于'} ${cond.value}`;
  }
  if (cond.type === 'location') {
    const place: Place | undefined = places.find(
      (p: Place) => p.id === cond.placeId,
    );
    return `${cond.operator === 'near' ? '到达' : '离开'}${place?.name || '地点'}`;
  }
  return `状态：${cond.value || '...'}`;
}

function actionSummary(rule: ShortcutRule, friends: Friend[]): string {
  const act = rule.action;
  const names: string[] = act.friendIds
    .map((id: string) => friends.find((f: Friend) => f.userId === id)?.nickname || '好友')
    .filter(Boolean);
  const who = names.length === 0
    ? '好友'
    : names.length === 1
      ? names[0]
      : `${names[0]} 等 ${names.length} 位`;
  const title = act.title || '提醒';
  const content = act.content;
  if (content) {
    return `${title}：${content} → ${who}`;
  }
  return `${title} → ${who}`;
}

const ShortcutsPage = () => {
  const { places } = usePlaces();
  const { friends } = useFriends();
  const { profile } = useProfile();
  const { send } = useWebSocket();

  const [sentAlertDialog, setSentAlertDialog] = useState<{
    open: boolean;
    title: string;
    content: string;
    friendNames: string[];
    total: number;
  }>({ open: false, title: '', content: '', friendNames: [], total: 0 });
  const sentAlertRef = useRef<{
    title: string;
    content: string;
    friendNames: string[];
    total: number;
  } | null>(null);

  const flushSentAlert = useCallback((): void => {
    const info = sentAlertRef.current;
    if (!info) return;
    setSentAlertDialog({
      open: true,
      title: info.title,
      content: info.content,
      friendNames: info.friendNames,
      total: info.total,
    });
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([100, 50, 100, 50, 100]);
    }
    sentAlertRef.current = null;
  }, []);

  const handleNotify = useCallback(
    (payload: { title: string; content: string; friendIds: string[] }): void => {
      const { title, content, friendIds } = payload;
      if (friendIds.length === 0) return;

      const alertPayload: AlertSendPayload = {
        toUserIds: friendIds,
        messageId: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        timestamp: Date.now(),
        title: title || '提醒',
        content: content || '',
      };
      send('alert:send', alertPayload);

      // 累积到 sentAlertRef，引擎同一 tick 可能触发多次，稍后统一弹窗
      if (!sentAlertRef.current) {
        sentAlertRef.current = {
          title: title || '提醒',
          content: content || '',
          friendNames: [],
          total: 0,
        };
        // 下一个微任务统一刷新，避免多次弹窗
        Promise.resolve().then(() => flushSentAlert());
      }
      for (const fid of friendIds) {
        const friend: Friend | undefined = friends.find(
          (f: Friend) => f.userId === fid,
        );
        sentAlertRef.current.friendNames.push(friend?.nickname || '好友');
        sentAlertRef.current.total += 1;
      }
    },
    [friends, send, flushSentAlert],
  );

  const {
    rules,
    templates,
    triggeredRules,
    addRule,
    updateRule,
    deleteRule,
    toggleRule,
    applyTemplate,
    startEngine,
    stopEngine,
  } = useShortcuts({
    places,
    friends,
    currentStatus: profile?.status || '',
    onNotify: handleNotify,
  });

  const [ruleDialogOpen, setRuleDialogOpen] = useState<boolean>(false);
  const [editingRule, setEditingRule] = useState<ShortcutRule | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [deleteTarget, setDeleteTarget] = useState<ShortcutRule | null>(null);
  const [applyDialogOpen, setApplyDialogOpen] = useState<boolean>(false);
  const [applyTemplateId, setApplyTemplateId] = useState<string | null>(null);

  // 页面挂载时启动引擎，卸载时停止
  useEffect(() => {
    startEngine();
    return () => {
      stopEngine();
    };
  }, [startEngine, stopEngine]);

  const handleCreate = (): void => {
    setEditingRule(null);
    setRuleDialogOpen(true);
  };

  const handleEdit = (rule: ShortcutRule): void => {
    setEditingRule(rule);
    setRuleDialogOpen(true);
  };

  const handleSave = async (
    data: Omit<ShortcutRule, 'id' | 'createdAt'>,
  ): Promise<void> => {
    if (editingRule) {
      await updateRule(editingRule.id, data);
      toast.success('规则已更新');
    } else {
      await addRule(data);
      toast.success('规则已创建');
    }
  };

  const handleDeleteClick = (rule: ShortcutRule): void => {
    setDeleteTarget(rule);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async (): Promise<void> => {
    if (!deleteTarget) return;
    await deleteRule(deleteTarget.id);
    setDeleteDialogOpen(false);
    setDeleteTarget(null);
    toast.success('规则已删除');
  };

  const handleApplyTemplate = (templateId: string): void => {
    setApplyTemplateId(templateId);
    setApplyDialogOpen(true);
  };

  const handleConfirmApply = async (): Promise<void> => {
    if (!applyTemplateId) return;
    try {
      await applyTemplate(applyTemplateId);
      setApplyDialogOpen(false);
      setApplyTemplateId(null);
      toast.success('模板已应用，规则已创建');
    } catch (err) {
      logger.error('apply template failed', err);
      toast.error('应用模板失败');
    }
  };

  const applyingTemplate = templates.find(
    (t) => t.id === applyTemplateId,
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-md mx-auto px-4 pt-6 pb-4">
        <h1 className="text-xl font-semibold text-foreground">快捷指令</h1>
        <p className="text-sm text-muted-foreground mt-1">
          设置自动化规则，让陪伴更智能
        </p>
      </div>

      <div className="max-w-md mx-auto">
        <TemplateSection templates={templates} onApply={handleApplyTemplate} />

        {/* 规则列表 */}
        <div className="px-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">我的规则</h2>
            <span className="text-xs text-muted-foreground">
              {rules.length} 条
            </span>
          </div>

          {rules.length === 0 ? (
            <div className="bg-card rounded-xl shadow-sm border border-border p-8 text-center">
              <Activity className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">还没有创建规则</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                从模板一键创建，或自定义规则
              </p>
            </div>
          ) : (
            <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
              {rules.map((rule: ShortcutRule, idx: number) => {
                const isTriggered: boolean = triggeredRules.has(rule.id);
                return (
                  <div
                    key={rule.id}
                    className={`p-4 gap-3 ${idx > 0 ? 'border-t border-border' : ''} ${
                      rule.enabled ? '' : 'opacity-60'
                    } cursor-pointer hover:bg-accent/30 transition-colors`}
                    onClick={() => handleEdit(rule)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="font-medium text-foreground text-sm">
                            {rule.name}
                          </span>
                          {isTriggered && (
                            <Badge
                              variant="outline"
                              className="h-5 px-1.5 text-[10px] bg-success/10 text-success border-success/20"
                            >
                              已触发
                            </Badge>
                          )}
                        </div>

                        {/* 条件标签 */}
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {rule.conditions.map(
                            (cond: ShortcutCondition, cIdx: number) => (
                              <span
                                key={cIdx}
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] border ${conditionBadgeVariant(
                                  cond,
                                )}`}
                              >
                                {cond.type === 'time' && (
                                  <Clock className="w-3 h-3" />
                                )}
                                {cond.type === 'location' && (
                                  <MapPin className="w-3 h-3" />
                                )}
                                {cond.type === 'status' && (
                                  <UserCheck className="w-3 h-3" />
                                )}
                                {conditionLabel(cond, places)}
                              </span>
                            ),
                          )}
                        </div>

                        {/* 动作摘要 */}
                        <div className="flex items-center gap-1 text-xs text-primary">
                          <Bell className="w-3 h-3 shrink-0" />
                          <span className="truncate">
                            {actionSummary(rule, friends)}
                          </span>
                        </div>
                      </div>

                      <div
                        className="flex flex-col items-end gap-2 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground"
                            onClick={() => handleEdit(rule)}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDeleteClick(rule)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        <Switch
                          checked={rule.enabled}
                          onCheckedChange={(checked: boolean) =>
                            toggleRule(rule.id, checked)
                          }
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 浮动创建按钮 */}
      <div className="fixed bottom-20 right-4 z-40">
        <Button
          size="icon"
          className="h-12 w-12 rounded-full shadow-lg"
          onClick={handleCreate}
        >
          <Plus className="w-5 h-5" />
        </Button>
      </div>

      <RuleDialog
        open={ruleDialogOpen}
        onOpenChange={setRuleDialogOpen}
        rule={editingRule}
        places={places}
        friends={friends}
        onSave={handleSave}
      />

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle>删除规则</DialogTitle>
            <DialogDescription>
              确定要删除规则「{deleteTarget?.name || ''}」吗？此操作不可恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" size="sm">
                取消
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmDelete}
            >
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={applyDialogOpen} onOpenChange={setApplyDialogOpen}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle>应用模板</DialogTitle>
            <DialogDescription>
              确定要创建「{applyingTemplate?.name || ''}」规则吗？
              创建后可在"我的规则"中编辑。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" size="sm">
                取消
              </Button>
            </DialogClose>
            <Button size="sm" onClick={handleConfirmApply}>
              确认创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 发送提醒成功弹窗 */}
      <Dialog
        open={sentAlertDialog.open}
        onOpenChange={(open) =>
          setSentAlertDialog((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent className="rounded-xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 justify-center">
              <CheckCircle2 className="w-6 h-6 text-success" />
              {sentAlertDialog.title || '提醒已发送'}
            </DialogTitle>
          </DialogHeader>
          <div className="text-center space-y-2">
            {sentAlertDialog.content && (
              <p className="text-sm text-foreground">
                {sentAlertDialog.content}
              </p>
            )}
            <p className="text-sm text-foreground">
              已提醒{' '}
              <span className="font-medium text-primary">
                {sentAlertDialog.friendNames[0] || '好友'}
                {sentAlertDialog.total > 1
                  ? ` 等 ${sentAlertDialog.total} 位好友`
                  : ''}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              对方会收到强提醒通知
            </p>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button size="sm" className="w-full">
                知道了
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ShortcutsPage;
