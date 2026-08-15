import { useState } from 'react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Smile, Briefcase, Home, Moon, Zap, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import StatusSettingDialog from '@client/src/pages/ProfilePage/StatusSettingDialog';
import { useSensitiveWords } from '@client/src/hooks/useSensitiveWords';

const STATUS_OPTIONS = [
  { value: '空闲中', icon: Smile, color: 'bg-emerald-500' },
  { value: '工作中', icon: Briefcase, color: 'bg-blue-500' },
  { value: '在家', icon: Home, color: 'bg-orange-500' },
  { value: '睡觉中', icon: Moon, color: 'bg-indigo-500' },
  { value: '电量告急', icon: Zap, color: 'bg-red-500' },
] as const;

export type StatusValue = (typeof STATUS_OPTIONS)[number]['value'];

interface StatusPickerProps {
  currentStatus: string;
  onSelect: (status: string) => void;
  onSaveWithDuration?: (status: string, durationMinutes?: number) => void;
  trigger?: React.ReactNode;
}

const StatusPicker: React.FC<StatusPickerProps> = ({
  currentStatus,
  onSelect,
  onSaveWithDuration,
  trigger,
}) => {
  const [open, setOpen] = useState(false);
  const [settingDialogOpen, setSettingDialogOpen] = useState(false);
  const { filter } = useSensitiveWords();

  const current = STATUS_OPTIONS.find((s) => s.value === currentStatus);
  const CurrentIcon = current?.icon ?? Smile;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger ?? (
          <button
            type="button"
            className="flex items-center gap-2 rounded-full bg-card/90 px-3 py-2 shadow-md backdrop-blur-lg"
          >
            <div
              className={cn(
                'size-4 rounded-full',
                current?.color ?? 'bg-primary',
              )}
            />
            <span className="max-w-[80px] truncate text-sm font-medium">{currentStatus || '设置状态'}</span>
          </button>
        )}
      </SheetTrigger>
      <SheetContent className="rounded-t-2xl">
        <div className="mt-6 space-y-2">
          <h3 className="px-2 text-base font-semibold">设置我的状态</h3>
          <p className="px-2 text-xs text-muted-foreground">
            好友会在地图上看到你的状态
          </p>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {STATUS_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isActive = opt.value === currentStatus;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onSelect(filter(opt.value));
                    setOpen(false);
                  }}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-xl border p-4 transition-colors',
                    isActive
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-card hover:bg-accent',
                  )}
                >
                  <div
                    className={cn(
                      'flex size-10 items-center justify-center rounded-full text-white',
                      opt.color,
                    )}
                  >
                    <Icon className="size-5" />
                  </div>
                  <span className="text-xs font-medium">{opt.value}</span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
           onClick={() => {
               setSettingDialogOpen(true);
             }}
            className="mt-3 flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground transition-colors hover:bg-accent/50"
          >
            <span>更多设置...</span>
            <ChevronRight className="size-4" />
          </button>
          <Button
            variant="ghost"
            className="mt-2 w-full"
            onClick={() => setOpen(false)}
          >
            关闭
          </Button>
        </div>
        <StatusSettingDialog
          open={settingDialogOpen}
          onOpenChange={(next) => {
            setSettingDialogOpen(next);
            if (!next) setOpen(false);
          }}
          currentStatus={currentStatus}
          onSave={(status, durationMinutes) => {
            if (onSaveWithDuration) {
              onSaveWithDuration(status, durationMinutes);
            } else {
              onSelect(status);
            }
          }}
        />
        <div
          className="sr-only"
          aria-hidden
        >
          <CurrentIcon />
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default StatusPicker;
