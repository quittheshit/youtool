'use client';

import { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Eraser, Download, Trash2, Palette, Minus, Plus, Undo, Redo } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

interface DrawingCanvasProps {
  onFinish: (imageDataUrl: string, imageBlob: Blob) => void;
  disabled?: boolean;
}

const PRESET_COLORS = [
  '#000000',
  '#FFFFFF',
  '#EF4444',
  '#F59E0B',
  '#10B981',
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
  '#F97316',
  '#14B8A6',
  '#6366F1',
  '#A855F7',
];

export function DrawingCanvas({ onFinish, disabled = false }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(5);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [customColor, setCustomColor] = useState('#000000');
  const [isEraser, setIsEraser] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyStep, setHistoryStep] = useState(-1);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    saveToHistory();
  }, []);

  const saveToHistory = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL();
    setHistory(prev => {
      const newHistory = prev.slice(0, historyStep + 1);
      newHistory.push(dataUrl);
      return newHistory;
    });
    setHistoryStep(prev => prev + 1);
  };

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX: number;
    let clientY: number;

    if ('touches' in e) {
      if (e.touches.length === 0) return { x: 0, y: 0 };
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    return { x, y };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { x, y } = getCanvasCoordinates(e);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { x, y } = getCanvasCoordinates(e);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (isEraser) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
    }
    ctx.lineWidth = lineWidth;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      saveToHistory();
    }
    setIsDrawing(false);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { x, y } = getCanvasCoordinates(e);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing || disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { x, y } = getCanvasCoordinates(e);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (isEraser) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
    }
    ctx.lineWidth = lineWidth;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (isDrawing) {
      saveToHistory();
    }
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveToHistory();
  };

  const undo = () => {
    if (historyStep <= 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.src = history[historyStep - 1];
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };

    setHistoryStep(prev => prev - 1);
  };

  const redo = () => {
    if (historyStep >= history.length - 1) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.src = history[historyStep + 1];
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };

    setHistoryStep(prev => prev + 1);
  };

  const toggleEraser = () => {
    setIsEraser(prev => !prev);
  };

  const downloadImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = 'drawing.png';
    link.href = canvas.toDataURL();
    link.click();
  };

  const handleFinish = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL('image/png');

    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob!);
      }, 'image/png');
    });

    onFinish(dataUrl, blob);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 p-4 bg-card/50 backdrop-blur-sm rounded-lg border">
        <div className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm font-medium">Colors:</span>
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map((presetColor) => (
              <motion.button
                key={presetColor}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setColor(presetColor)}
                className={cn(
                  'w-8 h-8 rounded-full border-2 transition-all',
                  color === presetColor ? 'border-primary scale-110' : 'border-border'
                )}
                style={{ backgroundColor: presetColor }}
              />
            ))}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="w-8 h-8 rounded-full border-2 border-border bg-gradient-to-br from-red-500 via-yellow-500 to-blue-500 flex items-center justify-center"
            >
              <Plus className="h-4 w-4 text-white" />
            </motion.button>
          </div>
        </div>

        {showColorPicker && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-2"
          >
            <input
              type="color"
              value={customColor}
              onChange={(e) => {
                setCustomColor(e.target.value);
                setColor(e.target.value);
              }}
              className="w-16 h-8 rounded border cursor-pointer"
            />
          </motion.div>
        )}

        <div className="flex items-center gap-3 flex-1 min-w-[200px]">
          <Minus className="h-4 w-4 text-muted-foreground" />
          <Slider
            value={[lineWidth]}
            onValueChange={([value]) => setLineWidth(value)}
            min={1}
            max={50}
            step={1}
            className="flex-1"
          />
          <Plus className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium w-8">{lineWidth}</span>
        </div>

        <div className="flex gap-2">
          <Button
            variant={isEraser ? "default" : "outline"}
            size="sm"
            onClick={toggleEraser}
            disabled={disabled}
          >
            <Eraser className="h-4 w-4 mr-2" />
            Eraser
          </Button>
          <Button variant="outline" size="sm" onClick={undo} disabled={disabled || historyStep <= 0}>
            <Undo className="h-4 w-4 mr-2" />
            Undo
          </Button>
          <Button variant="outline" size="sm" onClick={redo} disabled={disabled || historyStep >= history.length - 1}>
            <Redo className="h-4 w-4 mr-2" />
            Redo
          </Button>
          <Button variant="outline" size="sm" onClick={clearCanvas} disabled={disabled}>
            <Trash2 className="h-4 w-4 mr-2" />
            Clear
          </Button>
          <Button variant="outline" size="sm" onClick={downloadImage} disabled={disabled}>
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        </div>
      </div>

      <div className="relative rounded-lg overflow-hidden border-2 border-border shadow-xl bg-white">
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          className={cn(
            'w-full h-auto cursor-crosshair touch-none',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        />
      </div>

      <Button
        onClick={handleFinish}
        disabled={disabled}
        size="lg"
        className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
      >
        Transform My Drawing
      </Button>
    </div>
  );
}
