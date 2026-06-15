/**
 * 图片裁剪组件
 *
 * 在图片上提供可拖拽的矩形选区，用户框选感兴趣的区域后确认。
 * 适用于 OCR 前的图片预处理（裁剪到目标文章区域）。
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface CropRect {
  /** 归一化坐标 (0-1)，相对于图片原始尺寸 */
  x: number;
  y: number;
  w: number;
  h: number;
}

type Props = {
  /** 图片 data URL */
  imageDataUrl: string;
  /** 确认裁剪回调 */
  onCrop: (cropRect: CropRect) => void;
  /** 取消回调 */
  onCancel: () => void;
};

/** 最小选区尺寸（归一化） */
const MIN_CROP_SIZE = 0.05;

/** 控制点半径 */
const HANDLE_RADIUS = 12;

export default function ImageCropper({ imageDataUrl, onCrop, onCancel }: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 图片在容器中的实际渲染尺寸
  const [imgRect, setImgRect] = useState({ left: 0, top: 0, w: 0, h: 0 });

  // 选区（归一化坐标 0-1）
  const [crop, setCrop] = useState<CropRect>({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });

  // 拖拽状态
  const [dragging, setDragging] = useState<
    | { type: 'move'; startX: number; startY: number; startCrop: CropRect }
    | { type: 'resize'; handle: string; startX: number; startY: number; startCrop: CropRect }
    | null
  >(null);

  // 图片加载后记录实际渲染尺寸
  const updateImgRect = useCallback(() => {
    const img = imgRef.current;
    const container = containerRef.current;
    if (!img || !container) return;

    const containerRect = container.getBoundingClientRect();
    const imgElRect = img.getBoundingClientRect();
    setImgRect({
      left: imgElRect.left - containerRect.left,
      top: imgElRect.top - containerRect.top,
      w: imgElRect.width,
      h: imgElRect.height,
    });
  }, []);

  useEffect(() => {
    updateImgRect();
    window.addEventListener('resize', updateImgRect);
    return () => window.removeEventListener('resize', updateImgRect);
  }, [updateImgRect]);

  // 将归一化坐标转为像素坐标
  const toPx = useCallback(
    (nx: number, ny: number) => ({
      x: imgRect.left + nx * imgRect.w,
      y: imgRect.top + ny * imgRect.h,
    }),
    [imgRect],
  );

  // 将像素坐标转为归一化坐标
  const toNorm = useCallback(
    (px: number, py: number): { nx: number; ny: number } => ({
      nx: Math.max(0, Math.min(1, (px - imgRect.left) / imgRect.w)),
      ny: Math.max(0, Math.min(1, (py - imgRect.top) / imgRect.h)),
    }),
    [imgRect],
  );

  // 获取鼠标/触摸在容器中的坐标
  const getClientPos = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const container = containerRef.current;
    if (!container) return { x: 0, y: 0 };
    const rect = container.getBoundingClientRect();
    if ('touches' in e) {
      const t = e.touches[0] || (e as React.TouchEvent).changedTouches[0];
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  // 鼠标/触摸按下
  const handlePointerDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      const pos = getClientPos(e);
      const { nx, ny } = toNorm(pos.x, pos.y);

      void crop.x;
      void crop.y;

      // 检查是否在选区边角（resize handles）
      const corners = [
        { id: 'nw', x: crop.x, y: crop.y },
        { id: 'ne', x: crop.x + crop.w, y: crop.y },
        { id: 'sw', x: crop.x, y: crop.y + crop.h },
        { id: 'se', x: crop.x + crop.w, y: crop.y + crop.h },
      ];

      const handleThreshold = 0.03;
      for (const c of corners) {
        if (Math.abs(nx - c.x) < handleThreshold && Math.abs(ny - c.y) < handleThreshold) {
          setDragging({
            type: 'resize',
            handle: c.id,
            startX: pos.x,
            startY: pos.y,
            startCrop: { ...crop },
          });
          return;
        }
      }

      // 检查是否在选区内部
      if (nx >= crop.x && nx <= crop.x + crop.w && ny >= crop.y && ny <= crop.y + crop.h) {
        setDragging({
          type: 'move',
          startX: pos.x,
          startY: pos.y,
          startCrop: { ...crop },
        });
      }
    },
    [crop, getClientPos, toNorm],
  );

  // 鼠标/触摸移动
  const handlePointerMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!dragging) return;
      e.preventDefault();

      const pos = getClientPos(e);
      const dx = (pos.x - dragging.startX) / imgRect.w;
      const dy = (pos.y - dragging.startY) / imgRect.h;

      if (imgRect.w === 0) return;

      if (dragging.type === 'move') {
        const newX = Math.max(0, Math.min(1 - dragging.startCrop.w, dragging.startCrop.x + dx));
        const newY = Math.max(0, Math.min(1 - dragging.startCrop.h, dragging.startCrop.y + dy));
        setCrop((prev) => ({ ...prev, x: newX, y: newY }));
      } else {
        // resize
        const sc = dragging.startCrop;
        let newCrop = { ...sc };

        switch (dragging.handle) {
          case 'nw':
            newCrop.x = Math.max(0, Math.min(sc.x + sc.w - MIN_CROP_SIZE, sc.x + dx));
            newCrop.y = Math.max(0, Math.min(sc.y + sc.h - MIN_CROP_SIZE, sc.y + dy));
            newCrop.w = sc.x + sc.w - newCrop.x;
            newCrop.h = sc.y + sc.h - newCrop.y;
            break;
          case 'ne':
            newCrop.w = Math.max(MIN_CROP_SIZE, Math.min(1 - sc.x, sc.w + dx));
            newCrop.y = Math.max(0, Math.min(sc.y + sc.h - MIN_CROP_SIZE, sc.y + dy));
            newCrop.h = sc.y + sc.h - newCrop.y;
            break;
          case 'sw':
            newCrop.x = Math.max(0, Math.min(sc.x + sc.w - MIN_CROP_SIZE, sc.x + dx));
            newCrop.w = sc.x + sc.w - newCrop.x;
            newCrop.h = Math.max(MIN_CROP_SIZE, Math.min(1 - sc.y, sc.h + dy));
            break;
          case 'se':
            newCrop.w = Math.max(MIN_CROP_SIZE, Math.min(1 - sc.x, sc.w + dx));
            newCrop.h = Math.max(MIN_CROP_SIZE, Math.min(1 - sc.y, sc.h + dy));
            break;
        }
        setCrop(newCrop);
      }
    },
    [dragging, getClientPos, imgRect],
  );

  // 鼠标/触摸释放
  const handlePointerUp = useCallback(() => {
    setDragging(null);
  }, []);

  // 选区像素坐标
  const cropPx = toPx(crop.x, crop.y);
  const cropW = crop.w * imgRect.w;
  const cropH = crop.h * imgRect.h;

  return (
    <div className="image-cropper-overlay">
      <div className="image-cropper-toolbar">
        <button type="button" className="btn-tonal" onClick={onCancel}>
          取消
        </button>
        <span className="image-cropper-hint">拖拽选区框选文章区域</span>
        <button
          type="button"
          className="btn-filled"
          onClick={() => onCrop(crop)}
        >
          确认裁剪
        </button>
      </div>

      <div
        ref={containerRef}
        className="image-cropper-canvas"
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
      >
        <img
          ref={imgRef}
          src={imageDataUrl}
          alt="裁剪图片"
          className="image-cropper-img"
          onLoad={updateImgRect}
          draggable={false}
        />

        {/* 遮罩 */}
        <div
          className="image-cropper-mask"
          style={{
            left: `${imgRect.left}px`,
            top: `${imgRect.top}px`,
            width: `${imgRect.w}px`,
            height: `${imgRect.h}px`,
          }}
        />

        {/* 选区框 */}
        <div
          className="image-cropper-box"
          style={{
            left: `${cropPx.x}px`,
            top: `${cropPx.y}px`,
            width: `${cropW}px`,
            height: `${cropH}px`,
          }}
        >
          {/* 四角控制点 */}
          {['nw', 'ne', 'sw', 'se'].map((corner) => (
            <div
              key={corner}
              className={`image-cropper-handle image-cropper-handle--${corner}`}
              style={{ width: HANDLE_RADIUS * 2, height: HANDLE_RADIUS * 2 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
