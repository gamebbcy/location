import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { DrawingPoint, DrawingStroke } from '@client/src/hooks/useDrawingRoom';

export interface DrawingCanvasRef {
  exportPng: () => Promise<Blob>;
}

interface DrawingCanvasProps {
  strokes: DrawingStroke[];
  color: string;
  width: number;
  onStart: (point: DrawingPoint) => string;
  onMove: (strokeId: string, point: DrawingPoint) => void;
  onEnd: () => void;
}

function renderStrokes(
  context: CanvasRenderingContext2D,
  strokes: DrawingStroke[],
  width: number,
  height: number,
): void {
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.lineCap = 'round';
  context.lineJoin = 'round';
  for (const stroke of strokes) {
    if (stroke.points.length === 0) continue;
    context.strokeStyle = stroke.color;
    context.lineWidth = stroke.width * Math.min(width, height);
    context.beginPath();
    const first = stroke.points[0];
    context.moveTo(first.x * width, first.y * height);
    if (stroke.points.length === 1) {
      context.lineTo(first.x * width + 0.01, first.y * height + 0.01);
    } else {
      for (const point of stroke.points.slice(1)) context.lineTo(point.x * width, point.y * height);
    }
    context.stroke();
  }
}

const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(function DrawingCanvas(
  { strokes, color, width, onStart, onMove, onEnd },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeStrokeRef = useRef<string | null>(null);

  const redraw = (): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scale = window.devicePixelRatio || 1;
    const pixelWidth = Math.max(1, Math.round(rect.width * scale));
    const pixelHeight = Math.max(1, Math.round(rect.height * scale));
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    const context = canvas.getContext('2d');
    if (context) renderStrokes(context, strokes, pixelWidth, pixelHeight);
  };

  useEffect(redraw, [strokes]);
  useEffect(() => {
    const observer = new ResizeObserver(redraw);
    if (canvasRef.current) observer.observe(canvasRef.current);
    return () => observer.disconnect();
  });

  useImperativeHandle(ref, () => ({
    exportPng: () => new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 900;
      const context = canvas.getContext('2d');
      if (!context) return reject(new Error('无法生成画作'));
      renderStrokes(context, strokes, canvas.width, canvas.height);
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('无法生成画作')), 'image/png');
    }),
  }), [strokes]);

  const pointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>): DrawingPoint => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
    };
  };

  return (
    <canvas
      ref={canvasRef}
      className="h-full w-full touch-none rounded-2xl bg-white shadow-inner"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        activeStrokeRef.current = onStart(pointFromEvent(event));
      }}
      onPointerMove={(event) => {
        if (!activeStrokeRef.current || event.buttons === 0) return;
        onMove(activeStrokeRef.current, pointFromEvent(event));
      }}
      onPointerUp={(event) => {
        event.currentTarget.releasePointerCapture(event.pointerId);
        onEnd();
        activeStrokeRef.current = null;
      }}
      onPointerCancel={() => { onEnd(); activeStrokeRef.current = null; }}
      aria-label="好友共享画板"
      data-color={color}
      data-width={width}
    />
  );
});

export default DrawingCanvas;
