import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';
import {
  Eye,
  EyeOff,
  Copy,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@client/src/components/ui/dialog';
import { Button } from '@client/src/components/ui/button';

interface InviteCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  code: string;
  expiresAt: number | null;
  onRefresh: () => { code: string; expiresAt: number };
}

const MASKED = '••••••';
const REVEAL_DURATION_MS = 10 * 1000; // 明文显示 10 秒后自动遮罩
const REFRESH_COUNTDOWN_MS = 3 * 60 * 1000; // 复制后 3 分钟倒计时刷新

export function InviteCodeDialog({
  open,
  onOpenChange,
  code,
  expiresAt,
  onRefresh,
}: InviteCodeDialogProps) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [countdownSec, setCountdownSec] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const revealTimerRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<number | null>(null);

  // 初始化倒计时（如果已有过期时间）
  useEffect(() => {
    if (!open) return;
    if (expiresAt && expiresAt > Date.now()) {
      const remaining = Math.ceil((expiresAt - Date.now()) / 1000);
      setCountdownSec(remaining);
    } else {
      setCountdownSec(null);
    }
    // 打开时默认遮罩
    setRevealed(false);
  }, [open, expiresAt, code]);

  // 倒计时定时器
  useEffect(() => {
    if (countdownSec === null || countdownSec <= 0) return;
    countdownTimerRef.current = window.setInterval(() => {
      setCountdownSec((prev) => {
        if (prev === null || prev <= 1) {
          // 倒计时结束 → 自动刷新
          void handleRefresh(true);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdownSec !== null]);

  // 清理
  useEffect(() => {
    return () => {
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, []);

  const handleToggleReveal = useCallback((): void => {
    const next = !revealed;
    setRevealed(next);

    if (revealTimerRef.current) {
      clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }

    if (next) {
      // 10 秒后自动重新遮罩
      revealTimerRef.current = window.setTimeout(() => {
        setRevealed(false);
      }, REVEAL_DURATION_MS);
    }
  }, [revealed]);

  const handleCopy = useCallback(async (): Promise<void> => {
    if (!code) return;
    const doFallbackCopy = (text: string): boolean => {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.top = '-1000px';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(textarea);
        return ok;
      } catch {
        return false;
      }
    };

    let copied = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(code);
        copied = true;
      } else {
        copied = doFallbackCopy(code);
      }
    } catch (err) {
      logger.error('copy invite code failed', err);
      copied = doFallbackCopy(code);
    }

    if (copied) {
      setCopied(true);
      toast.success('邀请码已复制');
      setTimeout(() => setCopied(false), 1500);
    } else {
      toast.error('复制失败，请手动复制');
    }

    // 无论复制成功与否，点击复制按钮即启动 3 分钟倒计时刷新
    if (countdownSec === null) {
      const result = onRefresh();
      setCountdownSec(Math.ceil((result.expiresAt - Date.now()) / 1000));
    }
  }, [code, countdownSec, onRefresh]);

  const handleRefresh = useCallback(
    async (auto = false): Promise<void> => {
      if (refreshing) return;
      setRefreshing(true);
      try {
        const result = onRefresh();
        setCountdownSec(Math.ceil((result.expiresAt - Date.now()) / 1000));
        // 刷新后默认遮罩
        setRevealed(false);
        if (!auto) {
          toast.success('邀请码已刷新');
        }
      } catch (err) {
        logger.error('refresh invite code failed', err);
      } finally {
        setRefreshing(false);
      }
    },
    [onRefresh, refreshing],
  );

  const formatCountdown = (sec: number): string => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-sm mx-4 p-0 overflow-hidden">
        {/* 顶部渐变头 */}
        <div
          className="px-6 pt-6 pb-5 text-white"
          style={{
            background:
              'linear-gradient(135deg, hsl(168 65% 42%) 0%, hsl(172 60% 50%) 100%)',
          }}
        >
          <DialogHeader className="text-left">
            <DialogTitle className="text-white text-base flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" />
              我的邀请码
            </DialogTitle>
            <DialogDescription className="text-white/80 text-xs">
              为了保护你的隐私，邀请码复制后 3 分钟自动刷新
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* 邀请码展示区 */}
        <div className="px-6 py-6">
          <div className="bg-accent/40 rounded-xl p-5 mb-4">
            <div className="text-xs text-muted-foreground mb-2">邀请码</div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-3xl font-bold tracking-widest font-mono text-foreground flex-1">
                {revealed ? code : MASKED}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent shrink-0"
                onClick={handleToggleReveal}
                aria-label={revealed ? '隐藏邀请码' : '显示邀请码'}
              >
                {revealed ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </Button>
            </div>
            {revealed && (
              <p className="text-xs text-muted-foreground mt-2">
                10 秒后自动隐藏
              </p>
            )}
          </div>

          {/* 倒计时状态 */}
          {countdownSec !== null && countdownSec > 0 && (
            <div className="flex items-center justify-center gap-2 mb-4 px-3 py-2 rounded-full bg-warning/10 text-warning text-xs">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '3s' }} />
              {formatCountdown(countdownSec)} 后自动刷新
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 h-11 rounded-xl font-medium"
              onClick={handleCopy}
            >
              <Copy className="w-4 h-4" />
              {copied ? '已复制' : '复制邀请码'}
            </Button>
            <Button
              className="flex-1 h-11 rounded-xl font-medium"
              onClick={() => handleRefresh(false)}
              disabled={refreshing}
            >
              <RefreshCw
                className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
              />
              立即刷新
            </Button>
          </div>
        </div>

        {/* 底部说明 */}
        <div className="px-6 pb-6">
          <div className="p-3 rounded-xl bg-accent/40">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground">隐私保护说明</span>
              <br />
              邀请码复制后 3 分钟自动刷新，旧码将立即失效。请仅分享给你信任的好友。
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
