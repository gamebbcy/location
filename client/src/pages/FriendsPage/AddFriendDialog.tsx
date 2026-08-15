import { useState } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';
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

interface AddFriendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (inviteCode: string, nickname: string) => Promise<void>;
}

const AVATAR_COLORS = [
  '#14b8a6',
  '#0ea5e9',
  '#8b5cf6',
  '#ec4899',
  '#f59e0b',
  '#10b981',
];

export function AddFriendDialog({ open, onOpenChange, onAdd }: AddFriendDialogProps) {
  const [inviteCode, setInviteCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!inviteCode.trim()) return;
    setLoading(true);
    try {
      const avatar = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
      await onAdd(inviteCode.trim().toUpperCase(), nickname.trim() || '新朋友');
      logger.info(`friend added: ${inviteCode}`, { avatar });
      toast.success('好友添加成功');
      setInviteCode('');
      setNickname('');
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '添加失败';
      logger.error('add friend failed', err);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-xl">
        <DialogHeader>
          <DialogTitle>添加好友</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="inviteCode">邀请码</Label>
            <Input
              id="inviteCode"
              placeholder="请输入好友邀请码"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              maxLength={8}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="nickname">备注昵称（可选）</Label>
            <Input
              id="nickname"
              placeholder="给TA起个昵称"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={20}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="sm">
              取消
            </Button>
          </DialogClose>
          <Button size="sm" onClick={handleSubmit} disabled={loading || !inviteCode.trim()}>
            {loading ? '添加中...' : '添加'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
