import { useState, useEffect, type FormEvent, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { useAuth } from '@client/src/hooks/useAuth';
import { getOnboarding } from '@client/src/lib/storage';

const PHONE_REGEX = /^1[3-9]\d{9}$/;

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { isLoggedIn, login } = useAuth();

  const [phone, setPhone] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [countdown, setCountdown] = useState<number>(0);
  const [error, setError] = useState<string>('');

  const phoneValid = PHONE_REGEX.test(phone);
  const codeValid = /^\d{4}$/.test(code);
  const canSubmit = phoneValid && codeValid && generatedCode.length > 0;

  // 已登录用户直接跳转
  useEffect(() => {
    if (isLoggedIn) {
      const target = getOnboarding() ? '/map' : '/onboarding';
      navigate(target, { replace: true });
    }
  }, [isLoggedIn, navigate]);

  const handleSendCode = (): void => {
    if (!phoneValid) {
      setError('请输入正确的 11 位手机号');
      return;
    }
    setError('');
    const randomCode = Math.floor(1000 + Math.random() * 9000).toString();
    setGeneratedCode(randomCode);
    setCountdown(60);
    logger.info('验证码已发送（模拟）', { code: randomCode });
  };

  // 倒计时
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [countdown]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (!phoneValid) {
      setError('请输入正确的 11 位手机号');
      return;
    }
    if (!codeValid) {
      setError('请输入 4 位验证码');
      return;
    }
    if (code !== generatedCode) {
      setError('验证码错误');
      return;
    }
    setError('');
    login(phone);
    const target = getOnboarding() ? '/map' : '/onboarding';
    navigate(target, { replace: true });
  };

  const handlePhoneChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 11);
    setPhone(value);
    if (error) setError('');
  };

  const handleCodeChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 4);
    setCode(value);
    if (error) setError('');
  };

  if (isLoggedIn) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col px-6 py-10">
      <div className="max-w-md mx-auto w-full flex-1 flex flex-col">
        {/* 品牌区 */}
        <div className="flex-1 flex flex-col justify-center items-center text-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center mb-5 shadow-sm shadow-primary/30">
            <MapPin className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            好朋友位置报备
          </h1>
          <p className="text-muted-foreground text-sm">
            和在意的人，分享彼此的位置
          </p>
        </div>

        {/* 登录表单 */}
        <form onSubmit={handleSubmit} className="space-y-4 w-full">
          {/* 手机号 */}
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">手机号</label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-foreground font-medium pr-2 border-r border-border">
                +86
              </div>
              <Input
                type="tel"
                value={phone}
                onChange={handlePhoneChange}
                placeholder="请输入 11 位手机号"
                className="pl-16 h-12 rounded-xl text-base"
                maxLength={11}
                inputMode="numeric"
              />
            </div>
          </div>

          {/* 获取验证码按钮 */}
          <Button
            type="button"
            variant="outline"
            onClick={handleSendCode}
            disabled={!phoneValid || countdown > 0}
            className="w-full h-12 rounded-xl text-base"
          >
            {countdown > 0 ? `${countdown}s 后重新获取` : '获取验证码'}
          </Button>

          {/* 验证码显示提示 */}
          {generatedCode && (
            <div className="bg-accent text-accent-foreground px-4 py-3 rounded-xl text-sm text-center">
              您的验证码为：
              <span className="font-bold text-primary ml-1">
                {generatedCode}
              </span>
            </div>
          )}

          {/* 验证码输入 */}
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">验证码</label>
            <Input
              type="text"
              value={code}
              onChange={handleCodeChange}
              placeholder="请输入 4 位验证码"
              className="h-12 rounded-xl text-base text-center tracking-[0.5em]"
              maxLength={4}
              inputMode="numeric"
              disabled={!generatedCode}
            />
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="text-destructive text-sm text-center">{error}</div>
          )}

          {/* 登录按钮 */}
          <Button
            type="submit"
            disabled={!canSubmit}
            className="w-full h-12 rounded-xl text-base mt-2"
          >
            登录
          </Button>
        </form>

        {/* 隐私说明 */}
        <div className="text-center text-xs text-muted-foreground mt-8 mb-4 px-2 leading-relaxed">
          登录即表示同意《用户协议》和《隐私政策》。
          <br />
          您的位置数据仅在好友间共享，服务器不存储任何位置信息。
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
