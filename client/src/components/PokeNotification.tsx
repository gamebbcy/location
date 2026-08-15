import { useEffect } from 'react';
import { X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { PokeNotification as PokeNotificationType } from '@client/src/hooks/usePoke';

interface PokeNotificationProps {
  notification: PokeNotificationType | null;
  onDismiss: () => void;
}

const PokeNotification: React.FC<PokeNotificationProps> = ({ notification, onDismiss }) => {
  // Dismiss on Escape key
  useEffect(() => {
    if (!notification) return;
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [notification, onDismiss]);

  if (!notification) return null;

  const initial = notification.fromNickname.slice(0, 1).toUpperCase();

  return (
    <div className="fixed inset-x-0 top-0 z-[100] flex justify-center pt-16 px-4 pointer-events-none">
      <div
        className={cn(
          'pointer-events-auto max-w-sm w-full',
          'animate-[poke-slide-down_0.4s_cubic-bezier(0.34,1.56,0.64,1)]',
        )}
        style={{
          animation: 'poke-slide-down 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        <div className="relative flex items-center gap-3 rounded-2xl bg-card/95 px-4 py-3 shadow-lg backdrop-blur-xl border border-border/60">
          {/* Ripple effect behind avatar */}
          <div className="relative">
            <div
              className="absolute inset-0 rounded-full border-2 border-primary"
              style={{
                animation: 'poke-ripple-expand 0.8s ease-out 2',
              }}
            />
            <Avatar className="size-12 border-2 border-primary/30 shadow-md">
              <AvatarImage src={notification.fromAvatar} alt={notification.fromNickname} />
              <AvatarFallback>{initial}</AvatarFallback>
            </Avatar>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {notification.fromNickname}
            </p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <span className="inline-block animate-[poke-bounce_0.6s_ease-in-out_infinite]">
                👆
              </span>
              戳了戳你
            </p>
          </div>

          <button
            type="button"
            onClick={onDismiss}
            className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="关闭"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Inject keyframes once per mount */}
      <style>{`
        @keyframes poke-slide-down {
          0% {
            opacity: 0;
            transform: translateY(-100%);
          }
          60% {
            transform: translateY(8px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes poke-ripple-expand {
          0% {
            transform: scale(1);
            opacity: 0.6;
          }
          100% {
            transform: scale(1.8);
            opacity: 0;
          }
        }
        @keyframes poke-bounce {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-3px);
          }
        }
      `}</style>
    </div>
  );
};

export default PokeNotification;
