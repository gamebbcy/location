import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Bell } from 'lucide-react';

interface AlertConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nickname: string;
  onConfirm: () => void;
}

const AlertConfirmDialog: React.FC<AlertConfirmDialogProps> = ({
  open,
  onOpenChange,
  nickname,
  onConfirm,
}) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Bell className="size-5 text-destructive" />
            发送强提醒
          </AlertDialogTitle>
          <AlertDialogDescription>
            将向 <span className="font-medium text-foreground">{nickname}</span>{' '}
            发送强提醒通知，对方会收到明显的铃声和震动提示。确定发送吗？
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={onConfirm}
          >
            确认发送
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default AlertConfirmDialog;
