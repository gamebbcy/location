import { Phone, Navigation, Cloud, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';

export type QuickActionId =
  | 'call'
  | 'navigate'
  | 'weather'
  | 'alert';

interface QuickAction {
  id: QuickActionId;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { id: 'call', icon: Phone, label: '打电话', color: 'bg-emerald-500' },
  { id: 'navigate', icon: Navigation, label: '导航', color: 'bg-blue-500' },
  { id: 'weather', icon: Cloud, label: '天气', color: 'bg-amber-500' },
  { id: 'alert', icon: Bell, label: '强提醒', color: 'bg-destructive' },
];

interface QuickActionsBarProps {
  onAction: (actionId: QuickActionId) => void;
}

const QuickActionsBar: React.FC<QuickActionsBarProps> = ({ onAction }) => {
  return (
    <div className="flex justify-between items-start" data-ai-section-type="button">
      {QUICK_ACTIONS.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.id}
            type="button"
            onClick={() => onAction(action.id)}
            className="flex flex-col items-center gap-2 flex-1"
          >
            <div
              className={cn(
                'flex size-14 items-center justify-center rounded-full text-white shadow-sm active:scale-95 transition-transform',
                action.color,
              )}
            >
              <Icon className="size-6" />
            </div>
            <span className="text-xs text-muted-foreground">
              {action.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default QuickActionsBar;
