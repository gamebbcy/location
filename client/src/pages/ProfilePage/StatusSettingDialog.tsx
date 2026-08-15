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
import { X, Wifi, Briefcase, GraduationCap, Moon, Car } from 'lucide-react';
import { useSensitiveWords } from '@client/src/hooks/useSensitiveWords';

interface StatusSettingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentStatus: string;
  onSave: (status: string, expireMinutes?: number) => void;
}

const PRESET_STATUSES = [
  { key: '在线', icon: Wifi, color: 'text-success' },
  { key: '忙碌', icon: Briefcase, color: 'text-amber-500' },
  { key: '学习中', icon: GraduationCap, color: 'text-blue-500' },
  { key: '睡觉', icon: Moon, color: 'text-indigo-500' },
  { key: '出行中', icon: Car, color: 'text-emerald-500' },
];

const DURATION_OPTIONS: Array<{ label: string; minutes: number | null }> = [
  { label: '不限', minutes: null },
  { label: '1小时', minutes: 60 },
  { label: '3小时', minutes: 180 },
  { label: '6小时', minutes: 360 },
  { label: '9小时', minutes: 540 },
  { label: '12小时', minutes: 720 },
];

const StatusSettingDialog: React.FC<StatusSettingDialogProps> = ({
  open,
  onOpenChange,
  currentStatus,
  onSave,
}) => {
  const [customStatus, setCustomStatus] = useState<string>('');
  const [selectedPreset, setSelectedPreset] = useState<string>(currentStatus);
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [useCustom, setUseCustom] = useState<boolean>(
    !PRESET_STATUSES.some((s) => s.key === currentStatus) &&
      currentStatus !== '',
  );
  const { filter } = useSensitiveWords();

  const handlePresetClick = (status: string): void => {
    setSelectedPreset(status);
    setUseCustom(false);
    setCustomStatus('');
  };

  const handleCustomChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setCustomStatus(e.target.value.slice(0, 6));
    setUseCustom(true);
    setSelectedPreset('');
  };

  const handleSave = (): void => {
    const rawStatus = useCustom ? customStatus.trim() : selectedPreset;
    if (!rawStatus) return;
    const status = filter(rawStatus);
    onSave(status, selectedDuration ?? undefined);
    onOpenChange(false);
  };

  const isSaveDisabled = useCustom ? !customStatus.trim() : !selectedPreset;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-sm mx-4">
        <DialogHeader>
          <DialogTitle>设置状态</DialogTitle>
        </DialogHeader>

        {/* 预设状态 */}
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">预设状态</p>
          <div className="grid grid-cols-5 gap-2">
            {PRESET_STATUSES.map((status) => {
              const Icon = status.icon;
              const selected = !useCustom && selectedPreset === status.key;
              return (
                <button
                  key={status.key}
                  type="button"
                  onClick={() => handlePresetClick(status.key)}
                  className={`flex flex-col items-center gap-1 py-2 rounded-xl transition-colors ${
                    selected
                      ? 'bg-primary/10 border border-primary/30'
                      : 'bg-accent/50 hover:bg-accent'
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 ${
                      selected ? 'text-primary' : status.color
                    }`}
                  />
                  <span
                    className={`text-[10px] ${
                      selected ? 'text-primary font-medium' : 'text-foreground'
                    }`}
                  >
                    {status.key}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 自定义输入 */}
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">自定义</p>
          <div className="relative">
            <Input
              value={customStatus}
              onChange={handleCustomChange}
              placeholder="自定义状态（6字内）"
              maxLength={6}
              className="h-11 pr-12"
            />
            <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2 text-xs text-muted-foreground">
              <span>{customStatus.length}/6</span>
              {customStatus && (
                <button
                  type="button"
                  onClick={() => setCustomStatus('')}
                  className="text-muted-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 持续时间 */}
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">持续时间</p>
          <div className="flex gap-2">
            {DURATION_OPTIONS.map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => setSelectedDuration(opt.minutes)}
                className={`flex-1 py-2 rounded-lg text-xs transition-colors ${
                  selectedDuration === opt.minutes
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-accent text-accent-foreground hover:bg-accent/80'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl"
          >
            取消
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaveDisabled}
            className="rounded-xl"
          >
            确认
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default StatusSettingDialog;
