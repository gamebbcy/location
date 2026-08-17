import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { LockKeyhole, Mail, MapPin } from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { useAuth } from '@client/src/hooks/useAuth';
import { getOnboarding } from '@client/src/lib/storage';
import { isSupabaseConfigured } from '@client/src/lib/supabase';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { isLoggedIn, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isLoggedIn) {
      navigate(getOnboarding() ? '/map' : '/onboarding', { replace: true });
    }
  }, [isLoggedIn, navigate]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate(getOnboarding() ? '/map' : '/onboarding', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请检查账号和密码');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoggedIn) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col px-6 py-10">
      <div className="max-w-md mx-auto w-full flex-1 flex flex-col">
        <div className="flex-1 flex flex-col justify-center items-center text-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center mb-5 shadow-sm shadow-primary/30">
            <MapPin className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">好朋友位置报备</h1>
          <p className="text-muted-foreground text-sm">和在意的人，分享彼此的位置</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 w-full">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm text-muted-foreground">账号邮箱</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="email" type="email" autoComplete="username" value={email}
                onChange={(event) => setEmail(event.target.value)} placeholder="输入管理员分配的账号"
                className="pl-10 h-12 rounded-xl text-base" required />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm text-muted-foreground">密码</label>
            <div className="relative">
              <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="password" type="password" autoComplete="current-password" value={password}
                onChange={(event) => setPassword(event.target.value)} placeholder="输入密码"
                className="pl-10 h-12 rounded-xl text-base" minLength={6} required />
            </div>
          </div>

          {!isSupabaseConfigured && (
            <div className="rounded-xl bg-warning/10 px-4 py-3 text-sm text-foreground">
              尚未配置 Supabase。请先填写 VITE_SUPABASE_URL 和 VITE_SUPABASE_PUBLISHABLE_KEY。
            </div>
          )}
          {error && <div role="alert" className="text-destructive text-sm text-center">{error}</div>}

          <Button type="submit" disabled={!email || !password || isSubmitting || !isSupabaseConfigured}
            className="w-full h-12 rounded-xl text-base">
            {isSubmitting ? '正在登录…' : '登录'}
          </Button>
        </form>

        <div className="text-center text-xs text-muted-foreground mt-8 mb-4 px-2 leading-relaxed">
          账号由管理员预先创建，不开放公开注册。<br />位置仅通过好友私有实时通道转发，不写入数据库。
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
