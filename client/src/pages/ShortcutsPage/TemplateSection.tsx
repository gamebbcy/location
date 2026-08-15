import {
  Moon,
  Home,
  DoorOpen,
  Zap,
} from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import type { ShortcutTemplate } from '@client/src/hooks/useShortcuts';

interface TemplateSectionProps {
  templates: ShortcutTemplate[];
  onApply: (templateId: string) => void;
}

const TEMPLATE_ICONS: Record<string, typeof Moon> = {
  moon: Moon,
  home: Home,
  'door-open': DoorOpen,
};

export function TemplateSection({ templates, onApply }: TemplateSectionProps) {
  return (
    <div className="mb-6">
      <h2 className="text-sm font-semibold text-foreground mb-3 px-4">推荐模板</h2>
      <div className="flex gap-3 overflow-x-auto px-4 pb-2 -mx-4 scrollbar-hide">
        {templates.map((tpl) => {
          const Icon = TEMPLATE_ICONS[tpl.icon] || Zap;
          return (
            <div
              key={tpl.id}
              className={`shrink-0 w-64 rounded-xl p-4 text-white bg-gradient-to-br ${tpl.gradient} shadow-md`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="h-9 w-9 rounded-lg bg-white/20 flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <span className="font-semibold text-sm">{tpl.name}</span>
              </div>
              <p className="text-xs text-white/80 mb-3 line-clamp-2 min-h-[32px]">
                {tpl.description}
              </p>
              <Button
                size="sm"
                variant="secondary"
                className="w-full bg-white/20 hover:bg-white/30 text-white border-0 h-8"
                onClick={() => onApply(tpl.id)}
              >
                应用
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
