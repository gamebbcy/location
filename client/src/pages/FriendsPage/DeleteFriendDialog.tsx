import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from '@client/src/components/ui/dialog';
import { Button } from '@client/src/components/ui/button';

interface DeleteFriendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  friendName: string;
  onConfirm: () => void;
}

export function DeleteFriendDialog({
  open,
  onOpenChange,
  friendName,
  onConfirm,
}: DeleteFriendDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-xl">
        <DialogHeader>
          <DialogTitle>删除好友</DialogTitle>
          <DialogDescription>
            确定要删除好友「{friendName}」吗？删除后位置共享将停止，聊天记录保留。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="sm">
              取消
            </Button>
          </DialogClose>
          <Button variant="destructive" size="sm" onClick={onConfirm}>
            确认删除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
