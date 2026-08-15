import { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { AlertNotification as AlertNotificationType } from '@client/src/hooks/useFriendLocations';
interface AlertNotificationProps {
  notification: AlertNotificationType | null;
  onDismiss: () => void;
}

const AlertNotification: React.FC<AlertNotificationProps> = ({
  notification,
  onDismiss,
}) => {
  // Dismiss on Escape key
  useEffect(() => {
    if (!notification) return;
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [notification, onDismiss]);

  // Auto dismiss after 5s
  useEffect(() => {
    if (!notification) return;
    const timer = window.setTimeout(() => {
      onDismiss();
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [notification, onDismiss]);

  if (!notification) return null;

  const initial = notification.fromNickname.slice(0, 1).toUpperCase();
  const title = notification.title || '提醒';
  const content = notification.content || '';

  return (
    <div className="fixed inset-x-0 top-0 z-[100] flex justify-center pt-16 px-4 pointer-events-none">
      <div
        className={cn(
          'pointer-events-auto max-w-sm w-full',
        )}
        style={{
          animation: 'alert-slide-down 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), alert-shake 0.5s ease-in-out 0.4s 2',
        }}
      >
        <div className="relative flex items-start gap-3 rounded-2xl bg-destructive/95 text-destructive-foreground px-4 py-3 shadow-xl backdrop-blur-xl border border-destructive/40">
          {/* Ripple effect */}
          <div className="relative">
            <div
              className="absolute inset-0 rounded-full border-2 border-white/70"
              style={{
                animation: 'alert-ripple-expand 0.8s ease-out 3',
              }}
            />
            <Avatar className="size-12 border-2 border-white/40 shadow-md bg-white/20">
              <AvatarImage src={notification.fromAvatar} alt={notification.fromNickname} />
              <AvatarFallback className="bg-white/20 text-white">
                {initial}
              </AvatarFallback>
            </Avatar>
          </div>

          <div className="flex-1 min-w-0 pt-0.5">
            <p className="text-sm font-semibold truncate flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              强提醒
            </p>
            <p className="text-xs opacity-90 mt-0.5">
              【{notification.fromNickname}】{title}
              {content ? '：' : ''}
            </p>
            {content && (
              <p className="text-base font-medium mt-1 break-words">
                {content}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onDismiss}
            className="flex size-7 items-center justify-center rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors shrink-0"
            aria-label="关闭"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Inject keyframes once per mount */}
      <style>{`
        @keyframes alert-slide-down {
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
        @keyframes alert-ripple-expand {
          0% {
            transform: scale(1);
            opacity: 0.7;
          }
          100% {
            transform: scale(1.8);
            opacity: 0;
          }
        }
        @keyframes alert-shake {
          0%, 100% {
            transform: translateX(0);
          }
          20% {
            transform: translateX(-6px);
          }
          40% {
            transform: translateX(6px);
          }
          60% {
            transform: translateX(-4px);
          }
          80% {
            transform: translateX(4px);
          }
        }
      `}</style>
    </div>
  );
};

export default AlertNotification;
