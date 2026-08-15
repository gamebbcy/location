import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Phone,
  PhoneOff,
  MicOff,
  Grid3X3,
  Volume2,
  UserPlus,
  Video,
  Users,
  User,
} from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { parseOS } from '@client/src/lib/utils/device';
import { RingtonePlayer } from '@client/src/lib/ringtone';
import { Image } from '@client/src/components/ui/image';

type CallState = 'setting' | 'incoming' | 'talking';

const formatTime = (seconds: number): string => {
  const m: string = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s: string = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

const formatClock = (date: Date): string => {
  const h: string = date.getHours().toString().padStart(2, '0');
  const m: string = date.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
};

const FakeCallPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const callerName: string = searchParams.get('name') || '妈妈';
  const callerAvatar: string = searchParams.get('avatar') || '';
  const delayStr: string = searchParams.get('delay') || '1.5';
  const styleParam: string | null = searchParams.get('style');

  const [callState, setCallState] = useState<CallState>('setting');
  const [callDuration, setCallDuration] = useState<number>(0);
  const [nowTime, setNowTime] = useState<string>(formatClock(new Date()));
  const [screenVisible, setScreenVisible] = useState<boolean>(false);

  const os: 'ios' | 'android' | 'other' = parseOS();
  const isIOSStyle: boolean = styleParam === 'ios'
    ? true
    : styleParam === 'android'
      ? false
      : os === 'ios';

  const timerRef = useRef<number | null>(null);
  const clockRef = useRef<number | null>(null);
  const delayRef = useRef<number | null>(null);
  const startedRef = useRef<boolean>(false);

  // 时钟更新
  useEffect(() => {
    clockRef.current = window.setInterval(() => {
      setNowTime(formatClock(new Date()));
    }, 30000);
    return () => {
      if (clockRef.current) clearInterval(clockRef.current);
    };
  }, []);

  // 延迟后来电
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const delayMs: number = Math.max(0, Number(delayStr) || 0) * 1000;

    delayRef.current = window.setTimeout(() => {
      setScreenVisible(true);
      setCallState('incoming');
      try {
        // 用户进入页面视为一次交互上下文，尝试播放
        RingtonePlayer.play();
      } catch (err) {
        logger.error('ringtone play failed on mount', String(err));
      }
    }, delayMs);

    return () => {
      if (delayRef.current) clearTimeout(delayRef.current);
    };
  }, [delayStr]);

  // 清理
  useEffect(() => {
    return () => {
      RingtonePlayer.stop();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleAnswer = (): void => {
    RingtonePlayer.stop();
    setCallState('talking');
    setCallDuration(0);
    timerRef.current = window.setInterval(() => {
      setCallDuration((prev: number) => prev + 1);
    }, 1000);
  };

  const handleHangup = (): void => {
    RingtonePlayer.stop();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    navigate(-1);
  };

  // 通话按钮列表
  const callActions: Array<{ icon: React.ComponentType<{ className?: string }>; label: string }> = [
    { icon: MicOff, label: '静音' },
    { icon: Grid3X3, label: '键盘' },
    { icon: Volume2, label: '免提' },
    { icon: UserPlus, label: '添加通话' },
    { icon: Video, label: 'FaceTime' },
    { icon: Users, label: '通讯录' },
  ];

  const Avatar: React.FC<{ size: string; className?: string }> = ({ size, className = '' }) => (
    <div
      className={`${size} rounded-full overflow-hidden flex items-center justify-center bg-white/10 ${className}`}
    >
      {callerAvatar ? (
        <Image
          src={callerAvatar}
          alt={callerName}
          className="w-full h-full object-cover"
        />
      ) : (
        <User className="w-1/2 h-1/2 text-white/70" />
      )}
    </div>
  );

  // setting 状态：黑屏加载中
  if (callState === 'setting') {
    return (
      <div
        className="fixed inset-0 bg-black z-50 flex items-center justify-center transition-opacity duration-1000"
        style={{ opacity: screenVisible ? 0 : 1 }}
        aria-hidden="true"
      >
        <span className="text-white/40 text-sm">正在连接...</span>
      </div>
    );
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col overflow-hidden transition-all duration-1000 ${
        screenVisible ? 'opacity-100' : 'opacity-0'
      } ${
        isIOSStyle
          ? 'bg-black text-white'
          : 'bg-slate-950 text-white'
      }`}
    >
      {callState === 'incoming' ? (
        isIOSStyle ? (
          // ==================== iOS 来电风格 ====================
          <div className="relative flex-1 flex flex-col">
            {/* 毛玻璃背景装饰 */}
            <div className="absolute inset-0 bg-gradient-to-b from-slate-800/60 via-slate-900/80 to-black/90 backdrop-blur-xl" />
            <div className="absolute inset-0 bg-black/40" />

            <div className="relative z-10 flex-1 flex flex-col">
              {/* 顶部时间 */}
              <div className="pt-14 text-center">
                <span className="text-white/90 text-2xl font-semibold">{nowTime}</span>
              </div>

              {/* 中部：头像 + 姓名 */}
              <div className="flex-1 flex flex-col items-center justify-center gap-4">
                <div className="relative animate-pulse">
                  <div className="absolute inset-0 rounded-full bg-emerald-400/20 blur-xl scale-110" />
                  <Avatar size="w-24 h-24 md:w-28 md:h-28" className="relative ring-2 ring-white/20" />
                </div>
                <div className="text-center">
                  <h1 className="text-2xl font-semibold text-white">{callerName}</h1>
                  <p className="text-sm text-white/60 mt-1">移动电话</p>
                </div>
              </div>

              {/* 底部按钮 */}
              <div className="pb-20 px-12">
                <div className="flex justify-between items-center">
                  <div className="flex flex-col items-center gap-2">
                    <button
                      onClick={handleHangup}
                      aria-label="拒绝"
                      className="w-16 h-16 rounded-full bg-destructive flex items-center justify-center shadow-[0_0_20px_rgba(239_68_68_0.5)] active:scale-95 transition-transform"
                    >
                      <PhoneOff className="w-7 h-7 text-white" />
                    </button>
                    <span className="text-xs text-white/80">拒绝</span>
                  </div>

                  <div className="flex flex-col items-center gap-2">
                    <button
                      onClick={handleAnswer}
                      aria-label="接听"
                      className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center shadow-[0_0_25px_rgba(16_185_129_0.6)] active:scale-95 transition-transform"
                    >
                      <Phone className="w-7 h-7 text-white" />
                    </button>
                    <span className="text-xs text-white/80">接听</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // ==================== Android 来电风格 ====================
          <div className="relative flex-1 flex flex-col bg-gradient-to-b from-slate-900 to-black">
            {/* 顶部：姓名 + 号码占位 */}
            <div className="pt-16 text-center">
              <h1 className="text-4xl font-light text-white">{callerName}</h1>
              <p className="text-sm text-white/50 mt-2">移动电话</p>
            </div>

            {/* 中部：大头像 */}
            <div className="flex-1 flex items-center justify-center">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-emerald-500/10 blur-2xl scale-125 animate-pulse" />
                <Avatar size="w-40 h-40" className="relative ring-4 ring-white/10 shadow-2xl" />
              </div>
            </div>

            {/* 底部按钮 */}
            <div className="pb-20 px-10">
              <div className="flex justify-around items-end">
                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={handleHangup}
                    aria-label="挂断"
                    className="w-16 h-16 rounded-full bg-destructive flex items-center justify-center shadow-[0_0_20px_rgba(239_68_68_0.5)] active:scale-95 transition-transform"
                  >
                    <PhoneOff className="w-7 h-7 text-white" />
                  </button>
                  <span className="text-xs text-white/70">挂断</span>
                </div>

                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={handleAnswer}
                    aria-label="接听"
                    className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center shadow-[0_0_30px_rgba(16_185_129_0.6)] active:scale-95 transition-transform animate-pulse"
                  >
                    <Phone className="w-9 h-9 text-white" />
                  </button>
                  <span className="text-xs text-white/70">接听</span>
                </div>

                <div className="flex flex-col items-center gap-2 w-16">
                  <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
                    <Users className="w-6 h-6 text-white/70" />
                  </div>
                  <span className="text-xs text-white/70">信息</span>
                </div>
              </div>
            </div>
          </div>
        )
      ) : (
        // ==================== 通话界面（通用） ====================
        <div className="relative flex-1 flex flex-col bg-gradient-to-b from-slate-900 via-slate-950 to-black">
          <div className="absolute inset-0 backdrop-blur-xl bg-black/30" />

          <div className="relative z-10 flex-1 flex flex-col">
            {/* 顶部：姓名 + 通话时长 */}
            <div className="pt-16 text-center">
              <h1 className="text-2xl font-semibold text-white">{callerName}</h1>
              <p className="text-white/60 text-base mt-2">
                {formatTime(callDuration)}
                <span className="text-white/40 text-sm ml-2">通话中</span>
              </p>
            </div>

            {/* 中部：头像 */}
            <div className="flex-1 flex items-center justify-center">
              <Avatar size="w-32 h-32" className="ring-2 ring-white/10 shadow-2xl" />
            </div>

            {/* 功能按钮 6 宫格 */}
            <div className="pb-6 px-8">
              <div className="grid grid-cols-3 gap-y-6 mb-10">
                {callActions.map((item) => {
                  const IconComp = item.icon;
                  return (
                    <button
                      key={item.label}
                      className="flex flex-col items-center gap-2 opacity-80 hover:opacity-100 active:scale-95 transition-all"
                      onClick={() => logger.info('fake call action', { btn: item.label })}
                    >
                      <div className="w-14 h-14 rounded-full bg-white/15 flex items-center justify-center backdrop-blur-sm">
                        <IconComp className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-xs text-white/80">{item.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* 挂断按钮 */}
              <div className="flex justify-center">
                <button
                  onClick={handleHangup}
                  aria-label="挂断"
                  className="w-16 h-16 rounded-full bg-destructive flex items-center justify-center shadow-[0_0_20px_rgba(239_68_68_0.5)] active:scale-95 transition-transform"
                >
                  <PhoneOff className="w-7 h-7 text-white" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FakeCallPage;
