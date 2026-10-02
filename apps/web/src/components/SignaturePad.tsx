import { Button, Flex } from 'antd';
import { type PointerEvent, useEffect, useRef, useState } from 'react';

interface Props {
  onChange(dataUrl: string | null): void;
  height?: number;
}

/** Canvas signature capture for touch and mouse (AP-62). Produces a PNG data URL. */
export function SignaturePad({ onChange, height = 160 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = height * ratio;
    const context = canvas.getContext('2d')!;
    context.scale(ratio, ratio);
    context.lineWidth = 2.2;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = '#1F2A6B';
  }, [height]);

  const point = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const start = (event: PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const { x, y } = point(event);
    const context = canvasRef.current!.getContext('2d')!;
    context.beginPath();
    context.moveTo(x, y);
    drawing.current = true;
  };

  const move = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const { x, y } = point(event);
    const context = canvasRef.current!.getContext('2d')!;
    context.lineTo(x, y);
    context.stroke();
    hasInk.current = true;
    setEmpty(false);
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(hasInk.current ? canvasRef.current!.toDataURL('image/png') : null);
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    hasInk.current = false;
    setEmpty(true);
    onChange(null);
  };

  return (
    <div className="signature-pad">
      <canvas
        ref={canvasRef}
        style={{ height }}
        className="signature-pad__canvas"
        aria-label="Signature area"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
      <Flex justify="space-between" align="center">
        <span className="muted">Sign inside the box</span>
        <Button size="small" onClick={clear} disabled={empty}>
          Clear
        </Button>
      </Flex>
    </div>
  );
}
