import { useState, type ChangeEvent } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@client/src/components/ui/dialog';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';

interface NicknameEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentNickname: string;
  onSave: (nickname: string) => void;
}

const NicknameEditDialog: React.FC<NicknameEditDialogProps> = ({
  open,
  onOpenChange,
  currentNickname,
  onSave,
}) => {
  const [value, setValue] = useState<string>(currentNickname);

  const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setValue(e.target.value.slice(0, 20));
  };

  const handleSave = (): void => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSave(trimmed);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-sm mx-4">
        <DialogHeader>
          <DialogTitle>修改昵称</DialogTitle>
        </DialogHeader>
        <Input value={value} onChange={handleChange} maxLength={20} className="h-11" />
        <p className="text-xs text-muted-foreground -mt-2">
          {value.length}/20
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
            取消
          </Button>
          <Button onClick={handleSave} disabled={!value.trim()} className="rounded-xl">
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NicknameEditDialog;
