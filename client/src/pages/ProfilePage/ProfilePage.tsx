import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  Phone,
  Zap,
  Music,
  Sun,
  Moon,
  ShieldAlert,
  Trash2,
  Info,
  LogOut,
  Camera,
  Pencil,
  Lock,
} from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';

import { useProfile } from '@client/src/hooks/useProfile';
import { useTheme } from '@client/src/hooks/useTheme';
import { useMusicState, getMusicAppLabel } from '@client/src/hooks/useMusicState';
import {
  friendsStore,
  trajectoriesStore,
  placesStore,
  shortcutsStore,
  type ThemeMode,
} from '@client/src/lib/storage';
import { useAuth } from '@client/src/hooks/useAuth';
import { useWebSocket } from '@client/src/hooks/useWebSocket';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@client/src/components/ui/dialog';
import { Button } from '@client/src/components/ui/button';

import NicknameEditDialog from './NicknameEditDialog';
import StatusSettingDialog from './StatusSettingDialog';
import MusicSettingDialog from './MusicSettingDialog';
import ThemeSelectSheet from './ThemeSelectSheet';
import SensitiveWordsDialog from './SensitiveWordsDialog';
import { Image } from '@client/src/components/ui/image';
import { Switch } from '@client/src/components/ui/switch';
import { sharingRepository } from '@client/src/data/sharing-repository';

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { profile, updateNickname, updateAvatar, updateStatus, statusRemainingText } =
    useProfile();
  const { musicState, setMusic, clearMusic, isAutoDetecting, startAutoDetect, stopAutoDetect } =
    useMusicState();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { logout } = useAuth();
  const { disconnect } = useWebSocket();

  const [nicknameDialogOpen, setNicknameDialogOpen] = useState<boolean>(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState<boolean>(false);
  const [musicDialogOpen, setMusicDialogOpen] = useState<boolean>(false);
  const [themeSheetOpen, setThemeSheetOpen] = useState<boolean>(false);
  const [sensitiveDialogOpen, setSensitiveDialogOpen] = useState<boolean>(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState<boolean>(false);
  const [aboutDialogOpen, setAboutDialogOpen] = useState<boolean>(false);
  const [privacyDialogOpen, setPrivacyDialogOpen] = useState<boolean>(false);
  const [clearDataDialogOpen, setClearDataDialogOpen] = useState<boolean>(false);
  const [clearing, setClearing] = useState<boolean>(false);
  const [locationSharing, setLocationSharing] = useState(true);
  const [sharingSaving, setSharingSaving] = useState(false);

  useEffect(() => {
    void sharingRepository.getMine()
      .then(setLocationSharing)
      .catch((error) => logger.error('读取位置共享设置失败', error));
  }, []);

  const handleLocationSharingChange = async (enabled: boolean): Promise<void> => {
    const previous = locationSharing;
    setLocationSharing(enabled);
    setSharingSaving(true);
    try {
      await sharingRepository.setMine(enabled);
    } catch (error) {
      setLocationSharing(previous);
      logger.error('更新位置共享设置失败', error);
    } finally {
      setSharingSaving(false);
    }
  };

  // 头像上传
  const handleAvatarClick = (): void => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev): void => {
      const result = ev.target?.result;
      if (typeof result === 'string') {
        updateAvatar(result);
      }
    };
    reader.onerror = (): void => {
      logger.error('头像读取失败');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // 状态
  const handleStatusSave = (status: string, expireMinutes?: number): void => {
    updateStatus(status, expireMinutes);
  };

  // 主题
  const handleThemeSelect = (t: ThemeMode): void => {
    setTheme(t);
  };

  // 退出登录
  const handleLogout = async (): Promise<void> => {
    try {
      disconnect();
      await logout();
      navigate('/login', { replace: true });
    } catch (err) {
      logger.error('退出登录失败', err);
    }
  };

  // 清除所有数据（保留登录状态）
  const handleClearAllData = async (): Promise<void> => {
    setClearing(true);
    try {
      await Promise.all([
        friendsStore.clear(),
        trajectoriesStore.clear(),
        placesStore.clear(),
        shortcutsStore.clear(),
      ]);
      // 只清理 fl_ 前缀的应用缓存，保留 Supabase 登录会话。
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('fl_') && key !== 'fl_auth') localStorage.removeItem(key);
      }
      logger.info('所有本地数据已清除');
      setClearDataDialogOpen(false);
      // 重新加载页面以重置状态
      window.location.reload();
    } catch (err) {
      logger.error('清除数据失败', String(err));
    } finally {
      setClearing(false);
    }
  };

  const themeLabel =
    theme === 'light' ? '浅色' : theme === 'dark' ? '深色' : '跟随系统';

  const ThemeIcon = resolvedTheme === 'dark' ? Moon : Sun;

  // 功能入口
  const featureItems = [
    {
      icon: Phone,
      label: '假装来电',
      subtitle: '模拟来电脱身',
      onClick: (): void => navigate('/fake-call'),
      color: 'text-emerald-500 bg-emerald-50',
    },
    {
      icon: Zap,
      label: '快捷指令',
      subtitle: '一键报备状态',
      onClick: (): void => navigate('/shortcuts'),
      color: 'text-amber-500 bg-amber-50',
    },
    {
      icon: Music,
      label: '听歌状态',
      subtitle: isAutoDetecting
        ? '自动识别中'
        : musicState
          ? `${getMusicAppLabel(musicState.app)} · ${musicState.song}`
          : '未开启',
      onClick: (): void => setMusicDialogOpen(true),
      color: 'text-rose-500 bg-rose-50',
    },
    {
      icon: ThemeIcon,
      label: '主题切换',
      subtitle: themeLabel,
      onClick: (): void => setThemeSheetOpen(true),
      color: 'text-indigo-500 bg-indigo-50',
    },
    {
      icon: ShieldAlert,
      label: '敏感词管理',
      subtitle: '消息内容过滤',
      onClick: (): void => setSensitiveDialogOpen(true),
      color: 'text-orange-500 bg-orange-50',
    },
  ];

  // 设置项
  const settingItems = [
    {
      icon: Lock,
      label: '隐私设置',
      onClick: (): void => setPrivacyDialogOpen(true),
      destructive: false,
    },
    {
      icon: Trash2,
      label: '清除数据',
      onClick: (): void => setClearDataDialogOpen(true),
      destructive: false,
    },
    {
      icon: Info,
      label: '关于我们',
      onClick: (): void => setAboutDialogOpen(true),
      destructive: false,
    },
    {
      icon: LogOut,
      label: '退出登录',
      onClick: (): void => setLogoutDialogOpen(true),
      destructive: true,
    },
  ];

  if (!profile) {
    return <div className="min-h-full flex items-center justify-center text-muted-foreground">加载中...</div>;
  }

  return (
    <div className="min-h-full pb-24">
      {/* 顶部资料卡 */}
      <div className="bg-gradient-to-br from-primary/10 to-primary/2 pt-12 pb-8 px-6">
        <div className="flex flex-col items-center text-center">
          {/* 头像 */}
          <button
            onClick={handleAvatarClick}
            className="relative group mb-4"
            aria-label="修改头像"
          >
            <div className="w-24 h-24 rounded-full overflow-hidden bg-card shadow-lg flex items-center justify-center">
              {profile.avatar ? (
                <Image
                  src={profile.avatar}
                  alt={profile.nickname}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-4xl">😀</span>
              )}
            </div>
            <div className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md">
              <Camera className="w-3.5 h-3.5" />
            </div>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* 昵称 */}
          <button
            onClick={() => setNicknameDialogOpen(true)}
            className="flex items-center gap-1.5 text-xl font-bold text-foreground hover:opacity-80 transition-opacity"
          >
            {profile.nickname}
            <Pencil className="w-4 h-4 text-muted-foreground" />
          </button>

          {/* 状态 */}
          <button
            onClick={() => setStatusDialogOpen(true)}
            className="mt-2 px-3 py-1 rounded-full bg-card/80 text-sm text-muted-foreground flex items-center gap-1.5 hover:bg-card transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            {profile.status || '在线'}
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          {statusRemainingText && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              {statusRemainingText}
            </p>
          )}
        </div>
      </div>

      {/* 功能入口 */}
      <div className="px-4 -mt-4">
        <div className="bg-card rounded-xl shadow-sm p-3 grid grid-cols-2 gap-2">
          {featureItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                onClick={item.onClick}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-accent/50 transition-colors text-left"
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.color}`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground">
                    {item.label}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {item.subtitle}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 设置列表 */}
      <div className="px-4 mt-6">
        <div className="bg-card rounded-xl shadow-sm overflow-hidden">
          {settingItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                onClick={item.onClick}
                className={`w-full flex items-center gap-3 p-4 hover:bg-accent/50 transition-colors ${
                  index !== settingItems.length - 1
                    ? 'border-b border-border/50'
                    : ''
                }`}
              >
                <Icon
                  className={`w-5 h-5 ${
                    item.destructive
                      ? 'text-destructive'
                      : 'text-muted-foreground'
                  }`}
                />
                <span
                  className={`text-sm flex-1 text-left ${
                    item.destructive
                      ? 'text-destructive font-medium'
                      : 'text-foreground'
                  }`}
                >
                  {item.label}
                </span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            );
          })}
        </div>
      </div>

      {/* 版本号 */}
      <div className="text-center text-xs text-muted-foreground mt-10">
        好朋友位置报备 v1.0.0
      </div>

      {/* Dialogs */}
      <NicknameEditDialog
        open={nicknameDialogOpen}
        onOpenChange={setNicknameDialogOpen}
        currentNickname={profile.nickname}
        onSave={updateNickname}
      />

      <StatusSettingDialog
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
        currentStatus={profile.status}
        onSave={handleStatusSave}
      />

      <MusicSettingDialog
        open={musicDialogOpen}
        onOpenChange={setMusicDialogOpen}
        current={musicState}
        autoDetectEnabled={isAutoDetecting}
        onSave={(next, autoDetect): void => {
          if (autoDetect) {
            startAutoDetect();
          } else {
            stopAutoDetect();
            if (next) {
              void setMusic(next.app, next.song);
            } else {
              void clearMusic();
            }
          }
        }}
      />

      <ThemeSelectSheet
        open={themeSheetOpen}
        onOpenChange={setThemeSheetOpen}
        current={theme}
        onSelect={handleThemeSelect}
      />

      <SensitiveWordsDialog
        open={sensitiveDialogOpen}
        onOpenChange={setSensitiveDialogOpen}
      />

      {/* 退出确认 */}
      <Dialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <DialogContent className="rounded-2xl max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle>退出登录</DialogTitle>
            <DialogDescription>
              确认退出当前账号吗？本地数据将会保留。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setLogoutDialogOpen(false)}
              className="rounded-xl"
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => { void handleLogout(); }}
              className="rounded-xl"
            >
              退出登录
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 关于我们 */}
      <Dialog open={aboutDialogOpen} onOpenChange={setAboutDialogOpen}>
        <DialogContent className="rounded-2xl max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle>关于我们</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>好朋友位置报备 v1.0.0</p>
            <p>一款专注于好友间位置共享的轻量应用，保护隐私，传递陪伴。</p>
            <p>你的位置，只有你和好友知道。</p>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setAboutDialogOpen(false)}
              className="rounded-xl"
            >
              我知道了
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 隐私设置 */}
      <Dialog open={privacyDialogOpen} onOpenChange={setPrivacyDialogOpen}>
        <DialogContent className="rounded-2xl max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle>隐私设置</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground space-y-2">
            <div className="mb-4 flex items-center justify-between gap-4 rounded-xl bg-accent/50 p-3">
              <div>
                <div className="font-medium text-foreground">向好友共享实时位置</div>
                <div className="mt-0.5 text-xs">关闭后立即停止本设备上报，并撤回云端查看授权。</div>
              </div>
              <Switch checked={locationSharing} disabled={sharingSaving}
                onCheckedChange={(enabled) => { void handleLocationSharingChange(enabled); }}
                aria-label="向好友共享实时位置" />
            </div>
            <p>账号资料、好友关系和共享授权保存在 Supabase 数据库，并受行级权限控制。</p>
            <p>实时位置只通过好友私有通道转发，不写入数据库，也不提供历史回放。</p>
            <p>轨迹、地点和快捷指令等个性化数据只保存在当前设备，可随时清除。</p>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setPrivacyDialogOpen(false)}
              className="rounded-xl"
            >
              我知道了
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 清除数据确认 */}
      <Dialog open={clearDataDialogOpen} onOpenChange={setClearDataDialogOpen}>
        <DialogContent className="rounded-2xl max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle>清除数据</DialogTitle>
            <DialogDescription>
              确认清除当前设备上的缓存、轨迹、地点和快捷指令吗？云端账号与好友关系、登录状态均会保留。此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setClearDataDialogOpen(false)}
              className="rounded-xl"
              disabled={clearing}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleClearAllData}
              className="rounded-xl"
              disabled={clearing}
            >
              {clearing ? '清除中...' : '确认清除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProfilePage;
