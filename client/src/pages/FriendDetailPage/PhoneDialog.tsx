import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Phone } from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';

interface PhoneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phone?: string;
  onSave: (phone: string) => void;
}

const PhoneDialog: React.FC<PhoneDialogProps> = ({
  open,
  onOpenChange,
  phone,
  onSave,
}) => {
  const [value, setValue] = useState<string>(phone || '');

  const handleCall = (): void => {
    if (!value.trim()) return;
    const tel = `tel:${value.trim()}`;
    try {
      window.location.assign(tel);
    } catch (err) {
      logger.error('PhoneDialog: call failed', err);
    }
  };

  const handleSave = (): void => {
    if (value.trim()) {
      onSave(value.trim());
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="size-5 text-primary" />
            添加电话号码
          </DialogTitle>
          <DialogDescription>
            保存后可以一键拨打好友电话
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            type="tel"
            placeholder="请输入电话号码"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave}>保存</Button>
        </DialogFooter>
        <button
          type="button"
          onClick={handleCall}
          className="sr-only"
          aria-label="拨打"
        />
      </DialogContent>
    </Dialog>
  );
};

export default PhoneDialog;
