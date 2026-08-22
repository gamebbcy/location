import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Image as ImageIcon } from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import { drawingRepository, type DrawingRecord } from '@client/src/data/drawing-repository';
import { useAuth } from '@client/src/hooks/useAuth';

const DrawingsInboxPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [drawings, setDrawings] = useState<DrawingRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void drawingRepository.list()
      .then(setDrawings)
      .finally(() => setLoading(false));
  }, []);

  const received = useMemo(
    () => drawings.filter((drawing) => drawing.recipientId === user?.userId),
    [drawings, user?.userId],
  );

  return (
    <div className="min-h-screen bg-background px-4 pb-10 pt-4">
      <header className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="size-5" /></Button>
        <div>
          <h1 className="text-xl font-bold">画作信箱</h1>
          <p className="text-xs text-muted-foreground">好友离线时，画作也会留在这里</p>
        </div>
      </header>

      {loading ? (
        <div className="py-20 text-center text-sm text-muted-foreground">正在打开信箱…</div>
      ) : received.length === 0 ? (
        <div className="mt-10 flex flex-col items-center rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <ImageIcon className="size-10 text-primary/50" />
          <p className="mt-3 text-sm font-medium">还没有收到画作</p>
          <p className="mt-1 text-xs text-muted-foreground">从好友详情页进入共享画板</p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3">
          {received.map((drawing) => (
            <button
              key={drawing.id}
              type="button"
              className="overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm"
              onClick={() => {
                if (!drawing.readAt) {
                  void drawingRepository.markRead(drawing.id);
                  setDrawings((previous) => previous.map((item) => (
                    item.id === drawing.id ? { ...item, readAt: Date.now() } : item
                  )));
                }
                if (drawing.imageUrl) window.open(drawing.imageUrl, '_blank', 'noopener,noreferrer');
              }}
            >
              {drawing.imageUrl && <img src={drawing.imageUrl} alt="好友画作" className="aspect-[4/3] w-full bg-white object-cover" />}
              <div className="p-3">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  {!drawing.readAt && <span className="size-2 rounded-full bg-primary" />}
                  {drawing.senderName || '好友'}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {new Date(drawing.createdAt).toLocaleString()}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default DrawingsInboxPage;
