import { useEffect, useState, type ChangeEvent } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@client/src/components/ui/dialog';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { MUSIC_APPS } from '@client/src/hooks/useMusicState';
import type { MusicState } from '@client/src/lib/storage';

interface MusicSettingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: MusicState | null;
  autoDetectEnabled: boolean;
  onSave: (music: MusicState | null, autoDetect: boolean) => void;
}

const MusicSettingDialog: React.FC<MusicSettingDialogProps> = ({
  open,
  onOpenChange,
  current,
  autoDetectEnabled,
  onSave,
}) => {
  const [enabled, setEnabled] = useState<boolean>(!!current || autoDetectEnabled);
  const [autoDetect, setAutoDetect] = useState<boolean>(autoDetectEnabled);
  const [selectedApp, setSelectedApp] = useState<string>(
    current?.app ?? 'netease',
  );
  const [songName, setSongName] = useState<string>(current?.song ?? '');

  // 打开时同步外部状态
  useEffect(() => {
    if (open) {
      setEnabled(!!current || autoDetectEnabled);
      setAutoDetect(autoDetectEnabled);
      setSelectedApp(current?.app ?? 'netease');
      setSongName(current?.song ?? '');
    }
  }, [open, current, autoDetectEnabled]);

  const handleAppClick = (appKey: string): void => {
    setSelectedApp(appKey);
  };

  const handleSongChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setSongName(e.target.value.slice(0, 30));
  };

  const handleSave = (): void => {
    if (!enabled) {
      onSave(null, false);
    } else if (autoDetect) {
      // 自动识别模式：交由 auto-detect 轮询填充，不立即写死歌曲
      onSave(null, true);
    } else {
      onSave({ app: selectedApp, song: songName || '未知歌曲' }, false);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-sm mx-4">
        <DialogHeader>
          <DialogTitle>听歌状态</DialogTitle>
        </DialogHeader>

        {/* 总开关 */}
        <div className="flex items-center justify-between">
          <span className="text-sm">展示听歌状态</span>
          <button
            type="button"
            onClick={() => setEnabled(!enabled)}
            className={`relative w-12 h-7 rounded-full transition-colors ${
              enabled ? 'bg-primary' : 'bg-muted-foreground/30'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {enabled && (
          <div className="space-y-4">
            {/* 自动识别开关 */}
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-sm">自动识别</span>
                <span className="text-xs text-muted-foreground">
                  通过媒体会话自动同步当前播放歌曲
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAutoDetect(!autoDetect)}
                className={`relative w-12 h-7 rounded-full transition-colors ${
                  autoDetect ? 'bg-primary' : 'bg-muted-foreground/30'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                    autoDetect ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {!autoDetect && (
              <>
                {/* 选择音乐 App */}
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">音乐 App</p>
                  <div className="flex gap-2 justify-between">
                    {MUSIC_APPS.map((app) => {
                      const selected = selectedApp === app.key;
                      return (
                        <button
                          key={app.key}
                          type="button"
                          onClick={() => handleAppClick(app.key)}
                          className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl transition-all ${
                            selected
                              ? 'ring-2 ring-primary ring-offset-1 bg-accent/50'
                              : 'hover:bg-accent/30 opacity-70 hover:opacity-100'
                          }`}
                          title={app.label}
                        >
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                            style={{ backgroundColor: app.brandColor }}
                          >
                            {app.label.slice(0, 1)}
                          </div>
                          <span className="text-[10px] text-muted-foreground truncate max-w-full px-1">
                            {app.label.replace('音乐', '')}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 歌曲名 */}
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">歌曲名称</p>
                  <Input
                    value={songName}
                    onChange={handleSongChange}
                    placeholder="正在听的歌曲"
                    maxLength={30}
                    className="h-11"
                  />
                </div>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl"
          >
            取消
          </Button>
          <Button onClick={handleSave} className="rounded-xl">
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MusicSettingDialog;
