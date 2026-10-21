"use client";

import { useEffect, useRef } from "react";
import { Eraser } from "lucide-react";

import { Button } from "@/components/ui/button";

const WIDTH = 480;
const HEIGHT = 170;

/** A box to sign in with the mouse, a finger or a pen. The signature is
 * kept as a transparent PNG (data URL), drawn in dark ink on a white box
 * so it reads the same in dark mode and prints cleanly. */
export function SignaturePad({
  value,
  onChange,
  label = "Firma",
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  label?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  // Show the saved signature when editing.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = WIDTH * ratio;
    canvas.height = HEIGHT * ratio;
    ctx.scale(ratio, ratio);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = "#111827";
    if (value) {
      const image = new Image();
      image.onload = () => ctx.drawImage(image, 0, 0, WIDTH, HEIGHT);
      image.src = value;
    }
    // Only on mount: later changes come from drawing here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * WIDTH,
      y: ((e.clientY - rect.top) / rect.height) * HEIGHT,
    };
  };

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = point(e);
    const ctx = e.currentTarget.getContext("2d")!;
    ctx.beginPath();
    ctx.arc(last.current.x, last.current.y, 1.2, 0, Math.PI * 2);
    ctx.fillStyle = "#111827";
    ctx.fill();
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || !last.current) return;
    const ctx = e.currentTarget.getContext("2d")!;
    const next = point(e);
    const mid = { x: (last.current.x + next.x) / 2, y: (last.current.y + next.y) / 2 };
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.quadraticCurveTo(last.current.x, last.current.y, mid.x, mid.y);
    ctx.lineTo(next.x, next.y);
    ctx.stroke();
    last.current = next;
  }

  function end(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    onChange(e.currentTarget.toDataURL("image/png"));
  }

  function clear() {
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, WIDTH, HEIGHT);
    onChange(null);
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <Button type="button" variant="ghost" size="sm" onClick={clear}>
          <Eraser />
          Borrar firma
        </Button>
      </div>
      <canvas
        ref={canvasRef}
        aria-label="Dibujá la firma acá"
        role="img"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        className="aspect-48/17 w-full cursor-crosshair touch-none rounded-md border border-dashed border-input bg-white"
      />
      <p className="text-xs text-muted-foreground">
        {value ? "Si no te gusta, tocá “Borrar firma” y volvé a firmar." : "Firmá dentro del recuadro."}
      </p>
    </div>
  );
}
