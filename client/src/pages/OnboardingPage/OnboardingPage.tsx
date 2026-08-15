import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Bell, Shield } from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { Button } from '@client/src/components/ui/button';
import {
  setOnboarding,
  setPermissions,
  getPermissions,
  getOnboarding,
  type PermissionState,
} from '@client/src/lib/storage';

const TOTAL_SCREENS = 3;

const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const [screen, setScreen] = useState<number>(0);
  const [perms, setPerms] = useState<PermissionState>(() => getPermissions());

  // 已完成过引导的用户直接跳转
  useEffect(() => {
    if (getOnboarding()) {
      navigate('/map', { replace: true });
    }
  }, [navigate]);

  const goNext = (): void => {
    if (screen < TOTAL_SCREENS - 1) {
      setScreen(screen + 1);
    }
  };

  const handleAllowLocation = async (): Promise<void> => {
    try {
      await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 5000,
        });
      });
      const next: PermissionState = { ...perms, location: true };
      setPerms(next);
      setPermissions(next);
      logger.info('定位权限已授权');
    } catch (err) {
      const next: PermissionState = { ...perms, location: false };
      setPerms(next);
      setPermissions(next);
      logger.warn('定位权限被拒绝', String(err));
    }
    goNext();
  };

  const handleSkipLocation = (): void => {
    goNext();
  };

  const handleAllowNotification = async (): Promise<void> => {
    try {
      if (!('Notification' in window)) {
        logger.warn('当前浏览器不支持通知');
        goNext();
        return;
      }
      const result = await Notification.requestPermission();
      const granted = result === 'granted';
      const next: PermissionState = { ...perms, notification: granted };
      setPerms(next);
      setPermissions(next);
      logger.info(`通知权限：${result}`);
    } catch (err) {
      logger.warn('通知权限申请失败', String(err));
    }
    goNext();
  };

  const handleSkipNotification = (): void => {
    goNext();
  };

  const handleFinish = (): void => {
    setOnboarding(true);
    navigate('/map', { replace: true });
  };

  if (getOnboarding()) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* 内容区 */}
      <div className="flex-1 relative overflow-hidden">
        <div
          className="flex h-full transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${screen * 100}%)` }}
        >
          {/* 第 1 屏 - 定位权限 */}
          <div className="w-full flex-shrink-0 flex flex-col items-center justify-center px-8 text-center">
            <div className="w-28 h-28 rounded-full bg-primary/10 flex items-center justify-center mb-8">
              <MapPin className="w-14 h-14 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-3">
              开启位置共享
            </h2>
            <p className="text-muted-foreground text-base leading-relaxed mb-10 max-w-xs">
              授权定位权限后，您可以与好友分享实时位置。
              您的位置数据仅保存在设备本地和好友的设备上。
            </p>
            <Button
              onClick={handleAllowLocation}
              className="w-full max-w-xs h-12 rounded-xl text-base"
            >
              允许定位
            </Button>
            <button
              type="button"
              onClick={handleSkipLocation}
              className="mt-4 text-muted-foreground text-sm"
            >
              暂不开启
            </button>
          </div>

          {/* 第 2 屏 - 通知权限 */}
          <div className="w-full flex-shrink-0 flex flex-col items-center justify-center px-8 text-center">
            <div className="w-28 h-28 rounded-full bg-primary/10 flex items-center justify-center mb-8">
              <Bell className="w-14 h-14 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-3">
              开启消息通知
            </h2>
            <p className="text-muted-foreground text-base leading-relaxed mb-10 max-w-xs">
              好友发送消息或强提醒时，您将第一时间收到通知。
              即使不在应用中也不错过重要信息。
            </p>
            <Button
              onClick={handleAllowNotification}
              className="w-full max-w-xs h-12 rounded-xl text-base"
            >
              开启通知
            </Button>
            <button
              type="button"
              onClick={handleSkipNotification}
              className="mt-4 text-muted-foreground text-sm"
            >
              暂不开启
            </button>
          </div>

          {/* 第 3 屏 - 隐私承诺 */}
          <div className="w-full flex-shrink-0 flex flex-col items-center justify-center px-8 text-center">
            <div className="w-28 h-28 rounded-full bg-success/10 flex items-center justify-center mb-6">
              <Shield className="w-14 h-14 text-success" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-4">
              隐私承诺
            </h2>

            {/* 大标语卡片 */}
            <div className="w-full max-w-xs bg-success rounded-xl px-6 py-5 mb-6 shadow-sm">
              <p className="text-white text-lg font-bold leading-snug">
                你的位置，只有你和好友知道
              </p>
            </div>

            {/* 描述列表 */}
            <div className="space-y-3 w-full max-w-xs mb-10 text-left">
              <div className="flex items-start gap-3">
                <span className="text-success font-bold mt-0.5">✓</span>
                <span className="text-foreground text-sm">
                  服务器不存储任何位置数据
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-success font-bold mt-0.5">✓</span>
                <span className="text-foreground text-sm">
                  仅直接绑定的好友可见
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-success font-bold mt-0.5">✓</span>
                <span className="text-foreground text-sm">
                  随时可以关闭共享
                </span>
              </div>
            </div>

            <Button
              onClick={handleFinish}
              className="w-full max-w-xs h-12 rounded-xl text-base"
            >
              开始使用
            </Button>
          </div>
        </div>
      </div>

      {/* 底部指示器 */}
      <div className="pb-10 pt-4 flex justify-center gap-2">
        {Array.from({ length: TOTAL_SCREENS }).map((_, i) => (
          <div
            key={i}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === screen
                ? 'w-6 bg-primary'
                : 'w-2 bg-muted-foreground/30'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default OnboardingPage;
