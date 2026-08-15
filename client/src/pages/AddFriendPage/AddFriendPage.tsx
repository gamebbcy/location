import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';
import {
  ArrowLeft, UserPlus, Eye, EyeOff, Copy, Check, RefreshCw,
} from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { useFriends } from '@client/src/hooks/useFriends';
import { useSensitiveWords } from '@client/src/hooks/useSensitiveWords';
import {
  verifyInviteCode, parseInviteCodeFromLink,
} from '@client/src/lib/utils/invite';

const AVATAR_COLORS = ['#14b8a6', '#0ea5e9', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

const MAX_REMARK_LENGTH = 10;
const INVITE_CODE_LENGTH = 6;
const MASKED = '••••••';
const REVEAL_DURATION_MS = 10 * 1000;

type AddMode = 'code' | 'link';

const AddFriendPage: React.FC = () => {
  const navigate = useNavigate();
  const { addFriend, myInviteCode, refreshMyInviteCode, myInviteExpiresAt } = useFriends();
  const { filterOnSave, filterOnDisplay } = useSensitiveWords();

  const [mode, setMode] = useState<AddMode>('code');
  const [codeDigits, setCodeDigits] = useState<string[]>(Array(INVITE_CODE_LENGTH).fill(''));
  const [linkValue, setLinkValue] = useState('');
  const [remark, setRemark] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 我的邀请码：遮罩 / 复制 / 倒计时 / 刷新
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [countdownSec, setCountdownSec] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const revealTimerRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<number | null>(null);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  // 初始化倒计时（如果已有过期时间）
  useEffect(() => {
    if (myInviteExpiresAt && myInviteExpiresAt > Date.now()) {
      const remaining = Math.ceil((myInviteExpiresAt - Date.now()) / 1000);
      setCountdownSec(remaining);
    } else {
      setCountdownSec(null);
    }
  }, [myInviteExpiresAt]);

  // 倒计时定时器
  useEffect(() => {
    if (countdownSec === null || countdownSec <= 0) return;
    countdownTimerRef.current = window.setInterval(() => {
      setCountdownSec((prev) => {
        if (prev === null || prev <= 1) {
          handleRefresh(true);
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

  // 模式切换时聚焦第一个输入框
  useEffect(() => {
    if (mode === 'code') {
      const firstEmpty = codeDigits.findIndex((d: string) => !d);
      const target = firstEmpty === -1 ? 0 : firstEmpty;
      inputRefs.current[target]?.focus();
    }
  }, [mode, codeDigits]);

  /** 获取当前输入对应的邀请码 */
  const resolveInviteCode = useCallback((): string | null => {
    if (mode === 'code') {
      const code = codeDigits.join('').toUpperCase();
      if (code.length !== INVITE_CODE_LENGTH) return null;
      return verifyInviteCode(code) ? code : null;
    }
    const trimmed = linkValue.trim();
    if (!trimmed) return null;
    return parseInviteCodeFromLink(trimmed);
  }, [mode, codeDigits, linkValue]);

  const handleLinkChange = (e: React.ChangeEvent<HTMLInputElement>): void =>
    setLinkValue(e.target.value);

  const handleCodeDigitChange = (index: number, e: React.ChangeEvent<HTMLInputElement>): void => {
    const raw = e.target.value;
    const char = raw.slice(-1).toUpperCase();
    const valid = /^[A-Z0-9]$/.test(char);
    const next = [...codeDigits];
    next[index] = valid ? char : '';
    setCodeDigits(next);
    if (valid && index < INVITE_CODE_LENGTH - 1) inputRefs.current[index + 1]?.focus();
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Backspace' && !codeDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < INVITE_CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleCodePaste = (e: React.ClipboardEvent<HTMLInputElement>): void => {
    e.preventDefault();
    const text = e.clipboardData.getData('text').trim().toUpperCase();
    if (!text) return;

    const fromLink = parseInviteCodeFromLink(text);
    const source = fromLink || text;

    const chars = source.split('').filter((c: string) => /[A-Z0-9]/.test(c));
    if (chars.length === 0) return;

    const next = [...codeDigits];
    for (let i = 0; i < INVITE_CODE_LENGTH && i < chars.length; i++) {
      next[i] = chars[i];
    }
    setCodeDigits(next);

    const nextEmpty = next.findIndex((d: string) => !d);
    const target = nextEmpty === -1 ? INVITE_CODE_LENGTH - 1 : nextEmpty;
    inputRefs.current[target]?.focus();
  };

  const handleRemarkChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const val = e.target.value;
    setRemark(val.length <= MAX_REMARK_LENGTH ? val : val.slice(0, MAX_REMARK_LENGTH));
  };

  const handleAdd = useCallback(async (): Promise<void> => {
    const code = resolveInviteCode();
    if (!code) {
      if (mode === 'code') {
        toast.error('请输入完整的 6 位邀请码');
      } else {
        toast.error('请输入有效的邀请链接');
      }
      return;
    }

    const remarkTrimmed = remark.trim();
    if (remarkTrimmed.length > MAX_REMARK_LENGTH) {
      toast.error(`备注名最多 ${MAX_REMARK_LENGTH} 个字`);
      return;
    }

    setSubmitting(true);
    try {
      const filteredRemark = remarkTrimmed ? filterOnSave(remarkTrimmed) : '';
      const avatar = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
      await addFriend(code, '新朋友', avatar, filteredRemark);
      toast.success('好友添加成功');
      setCodeDigits(Array(INVITE_CODE_LENGTH).fill(''));
      setLinkValue('');
      setRemark('');
      navigate('/friends');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '添加失败';
      logger.error('add friend failed', err);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }, [resolveInviteCode, mode, remark, filterOnSave, addFriend, navigate]);

  const handleToggleReveal = useCallback((): void => {
    const next = !revealed;
    setRevealed(next);

    if (revealTimerRef.current) {
      clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }

    if (next) {
      revealTimerRef.current = window.setTimeout(() => {
        setRevealed(false);
      }, REVEAL_DURATION_MS);
    }
  }, [revealed]);

  const handleCopyCode = useCallback(async (): Promise<void> => {
    if (!myInviteCode) return;

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

    let ok = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(myInviteCode);
        ok = true;
      } else {
        ok = doFallbackCopy(myInviteCode);
      }
    } catch (err) {
      logger.error('copy invite code failed', err);
      ok = doFallbackCopy(myInviteCode);
    }

    if (ok) {
      setCopied(true);
      toast.success('邀请码已复制');
      setTimeout(() => setCopied(false), 1500);
    } else {
      toast.error('复制失败，请手动复制');
    }

    // 复制后启动/重置 3 分钟倒计时刷新
    const result = refreshMyInviteCode();
    setCountdownSec(Math.ceil((result.expiresAt - Date.now()) / 1000));
  }, [myInviteCode, refreshMyInviteCode]);

  const handleRefresh = useCallback(
    (auto = false): void => {
      if (refreshing) return;
      setRefreshing(true);
      try {
        const result = refreshMyInviteCode();
        setCountdownSec(Math.ceil((result.expiresAt - Date.now()) / 1000));
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
    [refreshMyInviteCode, refreshing],
  );

  const formatCountdown = (sec: number): string =>
    `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`;

  const canSubmit =
    mode === 'code'
      ? codeDigits.every((d: string) => d)
      : linkValue.trim().length > 0;

  const displayRemark = filterOnDisplay(remark);

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航 */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="max-w-md mx-auto px-4 h-12 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 -ml-2 text-foreground"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-base font-semibold text-foreground">添加好友</h1>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 pt-5 pb-10 space-y-5">
        {/* 添加表单卡片 */}
        <div className="bg-card rounded-xl shadow-sm border border-border p-5 space-y-5">
          {/* 第一部分：添加方式 */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">添加方式</h3>
            {/* Segmented Control */}
            <div className="flex bg-accent/60 rounded-xl p-1 mb-4">
              <button
                type="button"
                className={`flex-1 h-9 rounded-lg text-sm font-medium transition-colors ${
                  mode === 'code'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setMode('code')}
              >
                邀请码
              </button>
              <button
                type="button"
                className={`flex-1 h-9 rounded-lg text-sm font-medium transition-colors ${
                  mode === 'link'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setMode('link')}
              >
                邀请链接
              </button>
            </div>

            {/* 邀请码模式 */}
            {mode === 'code' && (
              <div>
                <div className="flex gap-2 justify-between mb-2">
                  {codeDigits.map((digit: string, idx: number) => (
                    <input
                      key={idx}
                      ref={(el) => {
                        inputRefs.current[idx] = el;
                      }}
                      type="text"
                      inputMode="text"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleCodeDigitChange(idx, e)}
                      onKeyDown={(e) => {
                        handleCodeKeyDown(idx, e);
                        if (e.key === 'Enter') handleAdd();
                      }}
                      onPaste={handleCodePaste}
                      className="w-11 h-12 text-center text-xl font-bold font-mono rounded-xl border border-border bg-background text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      aria-label={`第 ${idx + 1} 位邀请码`}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">输入对方的 6 位邀请码</p>
              </div>
            )}

            {/* 邀请链接模式 */}
            {mode === 'link' && (
              <div>
                <Input
                  placeholder="粘贴邀请链接"
                  value={linkValue}
                  onChange={handleLinkChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAdd();
                  }}
                  className="h-11 rounded-xl text-sm mb-2"
                />
                <p className="text-xs text-muted-foreground">粘贴对方分享的邀请链接</p>
              </div>
            )}
          </div>

          {/* 分割线 */}
          <div className="h-px bg-border" />

          {/* 第二部分：备注名 */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">给对方的备注名</h3>
            <div className="relative">
              <Input
                placeholder="如：小明、妈妈（选填）"
                value={remark}
                onChange={handleRemarkChange}
                maxLength={MAX_REMARK_LENGTH}
                className="h-11 rounded-xl text-sm pr-12"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground tabular-nums">
                {displayRemark.length}/{MAX_REMARK_LENGTH}
              </span>
            </div>
          </div>

          {/* 底部操作区 */}
          <div className="pt-1">
            <p className="text-xs text-muted-foreground text-center mb-3">
              对方通过后将自动成为好友
            </p>
            <Button
              className="w-full h-11 rounded-xl font-medium"
              onClick={handleAdd}
              disabled={submitting || !canSubmit}
            >
              <UserPlus className="w-4 h-4" />
              {submitting ? '添加中...' : '添加好友'}
            </Button>
          </div>
        </div>

        {/* 我的邀请码卡片 */}
        <div className="bg-card rounded-xl shadow-sm border border-border p-5">
          <h2 className="text-base font-semibold text-foreground mb-1">分享我的邀请码</h2>
          <p className="text-xs text-muted-foreground mb-4">把你的邀请码发给朋友，对方添加后即可实时共享位置</p>

          {/* 邀请码展示区 */}
          <div className="bg-accent/40 rounded-xl p-4 mb-3">
            <div className="text-xs text-muted-foreground mb-2">邀请码</div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-2xl font-bold tracking-widest font-mono text-foreground flex-1">
                {revealed ? myInviteCode : MASKED}
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
            {countdownSec !== null && countdownSec > 0 && (
              <div className="flex items-center gap-1.5 mt-2 text-xs font-medium text-warning">
                <RefreshCw
                  className="w-3.5 h-3.5 animate-spin"
                  style={{ animationDuration: '2s' }}
                />
                <span className="tabular-nums" data-testid="invite-countdown">
                  {formatCountdown(countdownSec)} 后自动刷新
                </span>
              </div>
            )}
            {revealed && (countdownSec === null || countdownSec <= 0) && (
              <p className="text-xs text-muted-foreground mt-2">
                10 秒后自动隐藏
              </p>
            )}
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-3 mb-3">
            <Button
              variant="outline"
              className="flex-1 h-11 rounded-xl font-medium"
              onClick={handleCopyCode}
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

          <p className="text-xs text-muted-foreground">邀请码复制后 3 分钟自动刷新，旧码将失效</p>
        </div>
      </div>
    </div>
  );
};

export default AddFriendPage;
