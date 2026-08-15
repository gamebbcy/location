import { Sun, Moon, Monitor } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@client/src/components/ui/dialog';
import { type ThemeMode } from '@client/src/lib/storage';

interface ThemeSelectSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: ThemeMode;
  onSelect: (theme: ThemeMode) => void;
}

const THEME_OPTIONS: Array<{ key: ThemeMode; label: string; icon: typeof Sun }> = [
  { key: 'light', label: '浅色', icon: Sun },
  { key: 'dark', label: '深色', icon: Moon },
  { key: 'system', label: '跟随系统', icon: Monitor },
];

const ThemeSelectSheet: React.FC<ThemeSelectSheetProps> = ({
  open,
  onOpenChange,
  current,
  onSelect,
}) => {
  const handleSelect = (theme: ThemeMode): void => {
    onSelect(theme);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-sm mx-4">
        <DialogHeader>
          <DialogTitle>主题设置</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          {THEME_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const selected = current === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => handleSelect(opt.key)}
                className={`w-full flex items-center gap-3 p-4 rounded-xl transition-colors ${
                  selected
                    ? 'bg-primary/10 border border-primary/30'
                    : 'bg-accent/50 hover:bg-accent'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    selected
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background text-muted-foreground'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span
                  className={`text-sm font-medium ${
                    selected ? 'text-primary' : 'text-foreground'
                  }`}
                >
                  {opt.label}
                </span>
                {selected && (
                  <span className="ml-auto text-primary text-xs font-medium">已选</span>
                )}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ThemeSelectSheet;
