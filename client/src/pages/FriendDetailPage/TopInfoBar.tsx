import { ArrowLeft } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface TopInfoBarProps {
  nickname: string;
  avatar?: string;
  statusText: string;
  online: boolean;
  onBack: () => void;
  onAlert: () => void;
}

const TopInfoBar: React.FC<TopInfoBarProps> = ({
  nickname,
  avatar,
  statusText,
  online,
  onBack,
  onAlert,
}) => {
  return (
    <div className="relative pt-6 pb-8">
      {/* 返回按钮 左上角 */}
      <button
        type="button"
        onClick={onBack}
        className="absolute left-4 top-6 z-20 flex size-9 items-center justify-center rounded-full bg-card/80 backdrop-blur-md shadow-sm hover:bg-card transition-colors"
        aria-label="返回"
      >
        <ArrowLeft className="size-5 text-foreground" />
      </button>

      {/* 强提醒按钮 右上角 */}
      <button
        type="button"
        onClick={onAlert}
        className="absolute right-4 top-6 z-20 flex size-9 items-center justify-center rounded-full bg-card/80 backdrop-blur-md shadow-sm text-destructive hover:bg-destructive/10 transition-colors"
        aria-label="强提醒"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-5"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
      </button>

      {/* 大头像 + 昵称 + 状态 */}
      <div className="flex flex-col items-center gap-3 pt-8">
        <div className="relative">
          <Avatar
            className={cn(
              'size-20 border-4 border-card shadow-md transition-all',
              !online && 'grayscale opacity-60',
            )}
          >
            <AvatarImage src={avatar} alt={nickname} />
            <AvatarFallback className="text-lg">
              {nickname.slice(0, 1)}
            </AvatarFallback>
          </Avatar>
          {/* 在线绿点 + 呼吸动画 */}
          {online && (
            <span className="absolute bottom-1 right-1 flex size-5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(152_60%_40%)] opacity-60" />
              <span className="relative inline-flex size-5 rounded-full bg-[hsl(152_60%_40%)] border-2 border-card" />
            </span>
          )}
          {!online && (
            <span className="absolute bottom-1 right-1 size-5 rounded-full bg-muted-foreground/40 border-2 border-card" />
          )}
        </div>
        <div className="flex flex-col items-center gap-1">
          <h1 className="text-xl font-semibold text-foreground">{nickname}</h1>
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                'size-2 rounded-full',
                online ? 'bg-[hsl(152_60%_40%)]' : 'bg-muted-foreground/40',
              )}
            />
            <span className="max-w-[180px] truncate text-sm text-muted-foreground">
              {statusText}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TopInfoBar;
