import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Eraser, Inbox, RotateCcw, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@client/src/components/ui/button';
import { friendRepository } from '@client/src/data/friend-repository';
import { drawingRepository } from '@client/src/data/drawing-repository';
import { useAuth } from '@client/src/hooks/useAuth';
import { useDrawingRoom } from '@client/src/hooks/useDrawingRoom';
import { useWebSocket } from '@client/src/hooks/useWebSocket';
import type { Friend } from '@shared/api.interface';
import DrawingCanvas, { type DrawingCanvasRef } from './DrawingCanvas';

const COLORS = ['#172b27', '#25b99a', '#3b82f6', '#f97316', '#ec4899'];

const DrawingPage: React.FC = () => {
  const { friendId = '' } = useParams<{ friendId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { send } = useWebSocket();
  const canvasRef = useRef<DrawingCanvasRef>(null);
  const [friend, setFriend] = useState<Friend | null>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [brushWidth, setBrushWidth] = useState(0.008);
  const [sending, setSending] = useState(false);
  const room = useDrawingRoom(user?.userId, friendId);

  useEffect(() => {
    void friendRepository.get(friendId).then((result) => setFriend(result ?? null));
  }, [friendId]);

  const handleSend = useCallback(async () => {
    if (!canvasRef.current || room.strokes.length === 0) {
      toast.error('先画点什么吧');
      return;
    }
    setSending(true);
    try {
      const image = await canvasRef.current.exportPng();
      const drawing = await drawingRepository.send(friendId, image);
      send('drawing:send', {
        toUserId: friendId,
        drawingId: drawing.id,
        timestamp: Date.now(),
      });
      toast.success('画作已送达好友信箱');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '发送失败');
    } finally {
      setSending(false);
    }
  }, [friendId, room.strokes.length, send]);

  const displayName = friend?.remark || friend?.nickname || '好友';
  return (
    <div className="flex h-screen flex-col bg-[hsl(168_20%_94%)]">
      <header className="flex items-center justify-between px-4 pb-3 pt-4">
        <Button variant="ghost" size="icon" className="rounded-full bg-card/80" onClick={() => navigate(-1)}>
          <ArrowLeft className="size-5" />
        </Button>
        <div className="text-center">
          <h1 className="text-base font-semibold">和 {displayName} 一起画</h1>
          <p className="mt-0.5 flex items-center justify-center gap-1 text-xs text-muted-foreground">
            <span className={`size-2 rounded-full ${room.connected ? 'bg-success animate-pulse' : 'bg-warning'}`} />
            {room.connected ? '实时画板已连接' : '正在连接…'}
          </p>
        </div>
        <Button variant="ghost" size="icon" className="rounded-full bg-card/80" onClick={() => navigate('/drawings')}>
          <Inbox className="size-5" />
        </Button>
      </header>

      <main className="min-h-0 flex-1 px-3 pb-3">
        <DrawingCanvas
          ref={canvasRef}
          strokes={room.strokes}
          color={color}
          width={brushWidth}
          onStart={(point) => room.startStroke(color, brushWidth, point)}
          onMove={room.appendStroke}
          onEnd={room.endStroke}
        />
      </main>

      <footer className="rounded-t-3xl border-t border-border/60 bg-card/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-lg backdrop-blur-lg">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {COLORS.map((item) => (
              <button
                key={item}
                type="button"
                className="flex size-8 items-center justify-center rounded-full border-2 border-white shadow-sm"
                style={{ backgroundColor: item, outline: color === item ? '2px solid hsl(168 65% 42%)' : 'none' }}
                onClick={() => {
                  setColor(item);
                  setBrushWidth(0.008);
                }}
                aria-label={`选择画笔颜色 ${item}`}
              >
                {color === item && <Check className="size-4 text-white" />}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="flex size-9 items-center justify-center rounded-full bg-accent text-foreground"
            onClick={() => {
              setColor('#ffffff');
              setBrushWidth(0.025);
            }}
            aria-label="橡皮擦"
          >
            <Eraser className="size-5" />
          </button>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Button variant="outline" className="rounded-xl" onClick={room.undo}><RotateCcw className="size-4" />撤销</Button>
          <Button variant="outline" className="rounded-xl" onClick={room.clear}><Trash2 className="size-4" />清空</Button>
          <Button className="rounded-xl" disabled={sending} onClick={() => { void handleSend(); }}>
            <Send className="size-4" />{sending ? '发送中' : '送给好友'}
          </Button>
        </div>
      </footer>
    </div>
  );
};

export default DrawingPage;
