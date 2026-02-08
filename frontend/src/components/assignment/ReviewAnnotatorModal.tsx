import { useEffect, useRef, useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { getBaseUrl } from '../../api/axios';
import { replaceSubmissionFeedbackFile, uploadSubmissionFeedbackFile } from '../../api/api';
import { useAlertStore } from '../../store/alertStore';
import type { ReviewAsset } from '../../types';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface ReviewAnnotatorModalProps {
  isOpen: boolean;
  submissionId: number | null;
  reviewAsset: ReviewAsset | null;
  feedbackFileToReplaceId?: number | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

interface PageData {
  width: number;
  height: number;
  baseDataUrl: string;
}

type Tool = 'pen' | 'eraser' | 'text';

interface DrawingState {
  isDrawing: boolean;
  pageIndex: number;
  lastX: number;
  lastY: number;
}

interface TextAnnotation {
  id: string;
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontSize: number;
  color: string;
}

interface DragTextState {
  id: string | null;
  pageIndex: number;
  offsetX: number;
  offsetY: number;
}

interface ResizeTextState {
  id: string | null;
  pageIndex: number;
  startWidth: number;
  startHeight: number;
  startX: number;
  startY: number;
}

const buildAssetUrl = (relativePath: string) => {
  const normalized = relativePath.replace(/^\.\//, '').replace(/^\/+/, '');
  return `${getBaseUrl()}/${normalized}`;
};

const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Не удалось загрузить изображение'));
    img.src = src;
  });
};

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
};

const canvasToPngBuffer = (canvas: HTMLCanvasElement): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error('Не удалось сформировать изображение'));
        return;
      }
      resolve(await blob.arrayBuffer());
    }, 'image/png');
  });
};

const TEXT_BOX_MIN_WIDTH = 140;
const TEXT_BOX_MIN_HEIGHT = 64;
const TEXT_BOX_DEFAULT_WIDTH = 260;
const TEXT_BOX_DEFAULT_HEIGHT = 120;
const TEXT_PADDING_X = 8;
const TEXT_PADDING_Y = 4;

export const ReviewAnnotatorModal = ({
  isOpen,
  submissionId,
  reviewAsset,
  feedbackFileToReplaceId = null,
  onClose,
  onSaved,
}: ReviewAnnotatorModalProps) => {
  const { addAlert } = useAlertStore();
  const [pages, setPages] = useState<PageData[]>([]);
  const [isLoadingAsset, setIsLoadingAsset] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTool, setActiveTool] = useState<Tool>('pen');
  const [lineColor, setLineColor] = useState('#ff2d55');
  const [lineWidth, setLineWidth] = useState(4);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [textAnnotations, setTextAnnotations] = useState<TextAnnotation[]>([]);
  const [activeTextId, setActiveTextId] = useState<string | null>(null);
  const [, forceHistoryUpdate] = useState(0);

  const overlayRefs = useRef<Array<HTMLCanvasElement | null>>([]);
  const historyRef = useRef<Array<{ stack: string[]; index: number }>>([]);
  const textDragRef = useRef<DragTextState>({
    id: null,
    pageIndex: -1,
    offsetX: 0,
    offsetY: 0,
  });
  const textResizeRef = useRef<ResizeTextState>({
    id: null,
    pageIndex: -1,
    startWidth: 0,
    startHeight: 0,
    startX: 0,
    startY: 0,
  });
  const drawingRef = useRef<DrawingState>({
    isDrawing: false,
    pageIndex: -1,
    lastX: 0,
    lastY: 0,
  });

  const currentHistory = historyRef.current[activePageIndex];
  const canUndo = !!currentHistory && currentHistory.index > 0;
  const canRedo = !!currentHistory && currentHistory.index < currentHistory.stack.length - 1;
  const activeTextAnnotation = activeTextId
    ? textAnnotations.find((item) => item.id === activeTextId) || null
    : null;

  const resetCanvasState = () => {
    overlayRefs.current = [];
    historyRef.current = [];
    textDragRef.current = {
      id: null,
      pageIndex: -1,
      offsetX: 0,
      offsetY: 0,
    };
    textResizeRef.current = {
      id: null,
      pageIndex: -1,
      startWidth: 0,
      startHeight: 0,
      startX: 0,
      startY: 0,
    };
    drawingRef.current = {
      isDrawing: false,
      pageIndex: -1,
      lastX: 0,
      lastY: 0,
    };
    setActivePageIndex(0);
    setActiveTextId(null);
    setTextAnnotations([]);
    forceHistoryUpdate(0);
  };

  const updateTextAnnotation = (id: string, updates: Partial<TextAnnotation>) => {
    setTextAnnotations((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const removeTextAnnotation = (id: string) => {
    setTextAnnotations((prev) => prev.filter((item) => item.id !== id));
    setActiveTextId((prev) => (prev === id ? null : prev));
  };

  const wrapTextByWidth = (
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number
  ): string[] => {
    if (maxWidth <= 0) {
      return text.split('\n');
    }

    const result: string[] = [];
    const paragraphs = text.split('\n');

    paragraphs.forEach((paragraph) => {
      if (!paragraph.length) {
        result.push('');
        return;
      }

      const words = paragraph.split(' ');
      let currentLine = '';

      const pushCurrentLine = () => {
        if (currentLine.length) {
          result.push(currentLine);
          currentLine = '';
        }
      };

      words.forEach((word) => {
        const candidate = currentLine.length ? `${currentLine} ${word}` : word;
        if (ctx.measureText(candidate).width <= maxWidth) {
          currentLine = candidate;
          return;
        }

        if (currentLine.length) {
          pushCurrentLine();
        }

        if (ctx.measureText(word).width <= maxWidth) {
          currentLine = word;
          return;
        }

        let chunk = '';
        for (const char of word) {
          const chunkCandidate = `${chunk}${char}`;
          if (ctx.measureText(chunkCandidate).width > maxWidth && chunk.length) {
            result.push(chunk);
            chunk = char;
          } else {
            chunk = chunkCandidate;
          }
        }
        if (chunk.length) {
          currentLine = chunk;
        }
      });

      pushCurrentLine();
    });

    return result;
  };

  const initializeHistoryForCanvas = (pageIndex: number, canvas: HTMLCanvasElement) => {
    if (historyRef.current[pageIndex]) {
      return;
    }
    const snapshot = canvas.toDataURL('image/png');
    historyRef.current[pageIndex] = {
      stack: [snapshot],
      index: 0,
    };
    forceHistoryUpdate((prev) => prev + 1);
  };

  const restoreFromSnapshot = (pageIndex: number, snapshot: string) => {
    const canvas = overlayRefs.current[pageIndex];
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!snapshot) {
      return;
    }
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = snapshot;
  };

  const pushHistory = (pageIndex: number) => {
    const canvas = overlayRefs.current[pageIndex];
    if (!canvas) {
      return;
    }
    const nextSnapshot = canvas.toDataURL('image/png');
    const pageHistory = historyRef.current[pageIndex];
    if (!pageHistory) {
      historyRef.current[pageIndex] = { stack: [nextSnapshot], index: 0 };
      forceHistoryUpdate((prev) => prev + 1);
      return;
    }

    if (pageHistory.stack[pageHistory.index] === nextSnapshot) {
      return;
    }

    const nextStack = pageHistory.stack.slice(0, pageHistory.index + 1);
    nextStack.push(nextSnapshot);
    historyRef.current[pageIndex] = {
      stack: nextStack.slice(-50),
      index: Math.min(nextStack.length - 1, 49),
    };
    forceHistoryUpdate((prev) => prev + 1);
  };

  const loadAsset = async () => {
    if (!reviewAsset) {
      setPages([]);
      return;
    }

    setIsLoadingAsset(true);
    resetCanvasState();
    setPages([]);

    const assetUrl = buildAssetUrl(reviewAsset.review_file_path);
    try {
      const response = await fetch(assetUrl);
      if (!response.ok) {
        throw new Error('Не удалось загрузить файл для проверки');
      }
      const fileBlob = await response.blob();

      if (reviewAsset.review_kind === 'image') {
        const objectUrl = URL.createObjectURL(fileBlob);
        try {
          const image = await loadImage(objectUrl);
          setPages([
            {
              width: image.width,
              height: image.height,
              baseDataUrl: objectUrl,
            },
          ]);
        } finally {
          // Оставляем objectUrl в состоянии страницы до закрытия модалки.
        }
      } else if (reviewAsset.review_kind === 'pdf') {
        const pdfBytes = await fileBlob.arrayBuffer();
        const pdf = await getDocument({ data: pdfBytes }).promise;
        const nextPages: PageData[] = [];

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          const page = await pdf.getPage(pageNumber);
          const viewport = page.getViewport({ scale: 1.4 });
          const baseCanvas = document.createElement('canvas');
          baseCanvas.width = viewport.width;
          baseCanvas.height = viewport.height;
          const ctx = baseCanvas.getContext('2d');
          if (!ctx) {
            continue;
          }
          await page.render({ canvas: baseCanvas, canvasContext: ctx, viewport }).promise;
          nextPages.push({
            width: baseCanvas.width,
            height: baseCanvas.height,
            baseDataUrl: baseCanvas.toDataURL('image/png'),
          });
        }

        setPages(nextPages);
      } else {
        throw new Error('Формат не поддерживается для разметки');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось подготовить файл';
      addAlert(message, 'error');
      setPages([]);
    } finally {
      setIsLoadingAsset(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    void loadAsset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, reviewAsset]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
      if (pages.length > 0) {
        pages.forEach((page) => {
          if (page.baseDataUrl.startsWith('blob:')) {
            URL.revokeObjectURL(page.baseDataUrl);
          }
        });
        setPages([]);
        resetCanvasState();
      }
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, pages]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const getCanvasPoint = (canvas: HTMLCanvasElement, event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (canvas.width / rect.width);
    const y = (event.clientY - rect.top) * (canvas.height / rect.height);
    return { x, y };
  };

  const drawLine = (
    canvas: HTMLCanvasElement,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    tool: Tool
  ) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = lineColor;
    ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();
    ctx.restore();
  };

  const handleCanvasPointerDown = (pageIndex: number, event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = overlayRefs.current[pageIndex];
    if (!canvas) {
      return;
    }
    setActivePageIndex(pageIndex);
    initializeHistoryForCanvas(pageIndex, canvas);

    const { x, y } = getCanvasPoint(canvas, event);

    if (activeTool === 'text') {
      const pageData = pages[pageIndex];
      const defaultWidth = pageData
        ? Math.min(TEXT_BOX_DEFAULT_WIDTH, pageData.width)
        : TEXT_BOX_DEFAULT_WIDTH;
      const defaultHeight = pageData
        ? Math.min(TEXT_BOX_DEFAULT_HEIGHT, pageData.height)
        : TEXT_BOX_DEFAULT_HEIGHT;
      const annotationX = pageData
        ? Math.max(0, Math.min(x, pageData.width - defaultWidth))
        : x;
      const annotationY = pageData
        ? Math.max(0, Math.min(y, pageData.height - defaultHeight))
        : y;

      const annotationId = `text-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setTextAnnotations((prev) => [
        ...prev,
        {
          id: annotationId,
          pageIndex,
          x: annotationX,
          y: annotationY,
          width: defaultWidth,
          height: defaultHeight,
          text: '',
          fontSize: Math.max(16, lineWidth * 4),
          color: lineColor,
        },
      ]);
      setActiveTextId(annotationId);
      return;
    }

    drawingRef.current = {
      isDrawing: true,
      pageIndex,
      lastX: x,
      lastY: y,
    };
    drawLine(canvas, x, y, x, y, activeTool);
    canvas.setPointerCapture(event.pointerId);
  };

  const handleCanvasPointerMove = (pageIndex: number, event: React.PointerEvent<HTMLCanvasElement>) => {
    const state = drawingRef.current;
    if (!state.isDrawing || state.pageIndex !== pageIndex) {
      return;
    }
    const canvas = overlayRefs.current[pageIndex];
    if (!canvas) {
      return;
    }

    const { x, y } = getCanvasPoint(canvas, event);
    drawLine(canvas, state.lastX, state.lastY, x, y, activeTool);
    drawingRef.current.lastX = x;
    drawingRef.current.lastY = y;
  };

  const finishDrawing = (pageIndex: number) => {
    const state = drawingRef.current;
    if (!state.isDrawing || state.pageIndex !== pageIndex) {
      return;
    }
    drawingRef.current = {
      isDrawing: false,
      pageIndex: -1,
      lastX: 0,
      lastY: 0,
    };
    pushHistory(pageIndex);
  };

  const startTextDrag = (
    annotation: TextAnnotation,
    event: React.PointerEvent<HTMLButtonElement>
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setActiveTextId(annotation.id);

    const pageElement = event.currentTarget.closest('[data-review-page]');
    if (!pageElement) {
      return;
    }
    const rect = pageElement.getBoundingClientRect();
    textDragRef.current = {
      id: annotation.id,
      pageIndex: annotation.pageIndex,
      offsetX: event.clientX - rect.left - annotation.x,
      offsetY: event.clientY - rect.top - annotation.y,
    };

    const onMove = (moveEvent: PointerEvent) => {
      const pageData = pages[annotation.pageIndex];
      if (!pageData || !pageElement) {
        return;
      }
      const pageRect = pageElement.getBoundingClientRect();
      const nextX = moveEvent.clientX - pageRect.left - textDragRef.current.offsetX;
      const nextY = moveEvent.clientY - pageRect.top - textDragRef.current.offsetY;

      const clampedX = Math.max(0, Math.min(nextX, pageData.width - annotation.width));
      const clampedY = Math.max(0, Math.min(nextY, pageData.height - annotation.height));
      updateTextAnnotation(annotation.id, { x: clampedX, y: clampedY });
    };

    const onUp = () => {
      textDragRef.current = {
        id: null,
        pageIndex: -1,
        offsetX: 0,
        offsetY: 0,
      };
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const startTextResize = (
    annotation: TextAnnotation,
    event: React.PointerEvent<HTMLButtonElement>
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setActiveTextId(annotation.id);

    textResizeRef.current = {
      id: annotation.id,
      pageIndex: annotation.pageIndex,
      startWidth: annotation.width,
      startHeight: annotation.height,
      startX: event.clientX,
      startY: event.clientY,
    };

    const onMove = (moveEvent: PointerEvent) => {
      const pageData = pages[annotation.pageIndex];
      if (!pageData) {
        return;
      }
      const deltaX = moveEvent.clientX - textResizeRef.current.startX;
      const deltaY = moveEvent.clientY - textResizeRef.current.startY;

      const maxWidth = pageData.width - annotation.x;
      const maxHeight = pageData.height - annotation.y;

      const nextWidth = Math.max(
        TEXT_BOX_MIN_WIDTH,
        Math.min(textResizeRef.current.startWidth + deltaX, maxWidth)
      );
      const nextHeight = Math.max(
        TEXT_BOX_MIN_HEIGHT,
        Math.min(textResizeRef.current.startHeight + deltaY, maxHeight)
      );

      updateTextAnnotation(annotation.id, { width: nextWidth, height: nextHeight });
    };

    const onUp = () => {
      textResizeRef.current = {
        id: null,
        pageIndex: -1,
        startWidth: 0,
        startHeight: 0,
        startX: 0,
        startY: 0,
      };
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const handleUndo = () => {
    const pageHistory = historyRef.current[activePageIndex];
    if (!pageHistory || pageHistory.index <= 0) {
      return;
    }
    const nextIndex = pageHistory.index - 1;
    historyRef.current[activePageIndex] = {
      ...pageHistory,
      index: nextIndex,
    };
    restoreFromSnapshot(activePageIndex, pageHistory.stack[nextIndex]);
    forceHistoryUpdate((prev) => prev + 1);
  };

  const handleRedo = () => {
    const pageHistory = historyRef.current[activePageIndex];
    if (!pageHistory || pageHistory.index >= pageHistory.stack.length - 1) {
      return;
    }
    const nextIndex = pageHistory.index + 1;
    historyRef.current[activePageIndex] = {
      ...pageHistory,
      index: nextIndex,
    };
    restoreFromSnapshot(activePageIndex, pageHistory.stack[nextIndex]);
    forceHistoryUpdate((prev) => prev + 1);
  };

  const exportMergedPages = async (): Promise<HTMLCanvasElement[]> => {
    const merged: HTMLCanvasElement[] = [];
    for (let index = 0; index < pages.length; index += 1) {
      const page = pages[index];
      const overlay = overlayRefs.current[index];
      const outputCanvas = document.createElement('canvas');
      outputCanvas.width = page.width;
      outputCanvas.height = page.height;
      const ctx = outputCanvas.getContext('2d');
      if (!ctx) {
        continue;
      }

      const baseImg = await loadImage(page.baseDataUrl);
      ctx.drawImage(baseImg, 0, 0, page.width, page.height);
      if (overlay) {
        ctx.drawImage(overlay, 0, 0, page.width, page.height);
      }

      const pageTexts = textAnnotations.filter(
        (item) => item.pageIndex === index && item.text.trim().length > 0
      );
      pageTexts.forEach((item) => {
        const lineHeight = item.fontSize * 1.25;
        ctx.fillStyle = item.color;
        ctx.textBaseline = 'top';
        ctx.font = `${item.fontSize}px sans-serif`;

        const maxTextWidth = Math.max(1, item.width - TEXT_PADDING_X * 2);
        const wrappedLines = wrapTextByWidth(ctx, item.text, maxTextWidth);
        const maxLinesByHeight = Math.max(
          1,
          Math.floor((item.height - TEXT_PADDING_Y * 2) / lineHeight)
        );
        const visibleLines = wrappedLines.slice(0, maxLinesByHeight);

        visibleLines.forEach((line, lineIndex) => {
          ctx.fillText(
            line,
            item.x + TEXT_PADDING_X,
            item.y + TEXT_PADDING_Y + lineIndex * lineHeight
          );
        });
      });
      merged.push(outputCanvas);
    }
    return merged;
  };

  const createFeedbackFile = async (mergedPages: HTMLCanvasElement[]): Promise<File> => {
    if (!reviewAsset) {
      throw new Error('Файл проверки не выбран');
    }

    const sourceBaseName = reviewAsset.source_file_name.replace(/\.[^/.]+$/, '') || 'submission';

    if (reviewAsset.review_kind === 'image' && mergedPages.length > 0) {
      const buffer = await canvasToPngBuffer(mergedPages[0]);
      return new File([buffer], `${sourceBaseName}_checked.png`, { type: 'image/png' });
    }

    const pdfDoc = await PDFDocument.create();
    for (const mergedCanvas of mergedPages) {
      const pngBuffer = await canvasToPngBuffer(mergedCanvas);
      const pngImage = await pdfDoc.embedPng(pngBuffer);
      const page = pdfDoc.addPage([mergedCanvas.width, mergedCanvas.height]);
      page.drawImage(pngImage, {
        x: 0,
        y: 0,
        width: mergedCanvas.width,
        height: mergedCanvas.height,
      });
    }
    const pdfBytes = await pdfDoc.save();
    return new File([toArrayBuffer(pdfBytes)], `${sourceBaseName}_checked.pdf`, { type: 'application/pdf' });
  };

  const handleSave = async () => {
    if (!submissionId || !reviewAsset) {
      addAlert('Не удалось определить сдачу для сохранения', 'error');
      return;
    }
    if (pages.length === 0) {
      addAlert('Нет данных для сохранения', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const mergedPages = await exportMergedPages();
      const feedbackFile = await createFeedbackFile(mergedPages);
      if (feedbackFileToReplaceId) {
        await replaceSubmissionFeedbackFile(
          submissionId,
          feedbackFileToReplaceId,
          feedbackFile,
          reviewAsset.submission_file_id
        );
      } else {
        await uploadSubmissionFeedbackFile(
          submissionId,
          feedbackFile,
          reviewAsset.submission_file_id
        );
      }
      await onSaved();
      addAlert(
        feedbackFileToReplaceId
          ? 'Файл с пометками обновлен'
          : 'Файл с пометками сохранен и прикреплен к ответу',
        'success'
      );
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось сохранить файл с пометками';
      addAlert(message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] bg-bg-primary">
      <div className="h-full flex flex-col">
        <div className="border-b border-border-color bg-bg-card px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-text-secondary">Проверка файла</p>
            <h2 className="text-base sm:text-lg font-semibold text-text-primary truncate">
              {reviewAsset?.source_file_name || 'Файл'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="btn-secondary text-sm"
              disabled={isSaving}
            >
              Закрыть
            </button>
            <button
              onClick={handleSave}
              className="btn-primary text-sm"
              disabled={isSaving || isLoadingAsset || pages.length === 0}
            >
              {isSaving ? 'Сохранение...' : feedbackFileToReplaceId ? 'Сохранить изменения' : 'Сохранить и прикрепить'}
            </button>
          </div>
        </div>

        <div className="border-b border-border-color bg-bg-card px-4 py-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTool('pen')}
            className={`btn-secondary text-sm ${activeTool === 'pen' ? 'ring-2 ring-primary' : ''}`}
            type="button"
          >
            Перо
          </button>
          <button
            onClick={() => setActiveTool('text')}
            className={`btn-secondary text-sm ${activeTool === 'text' ? 'ring-2 ring-primary' : ''}`}
            type="button"
          >
            Текст
          </button>
          <button
            onClick={() => setActiveTool('eraser')}
            className={`btn-secondary text-sm ${activeTool === 'eraser' ? 'ring-2 ring-primary' : ''}`}
            type="button"
          >
            Ластик
          </button>
          <div className="h-8 w-px bg-border-color mx-1" />
          <label className="text-sm text-text-secondary flex items-center gap-2">
            Цвет
            <input
              type="color"
              value={lineColor}
              onChange={(event) => {
                const nextColor = event.target.value;
                setLineColor(nextColor);
                if (activeTextAnnotation) {
                  updateTextAnnotation(activeTextAnnotation.id, { color: nextColor });
                }
              }}
              className="h-8 w-10 p-0 border-none bg-transparent cursor-pointer"
            />
          </label>
          <label className="text-sm text-text-secondary flex items-center gap-2">
            Толщина
            <input
              type="range"
              min={1}
              max={24}
              value={lineWidth}
              onChange={(event) => setLineWidth(Number(event.target.value))}
            />
            <span className="text-xs text-text-tertiary w-6">{lineWidth}</span>
          </label>
          {activeTool === 'text' && activeTextAnnotation && (
            <label className="text-sm text-text-secondary flex items-center gap-2">
              Размер текста
              <input
                type="range"
                min={10}
                max={96}
                value={activeTextAnnotation.fontSize}
                onChange={(event) => {
                  const nextSize = Number(event.target.value);
                  updateTextAnnotation(activeTextAnnotation.id, { fontSize: nextSize });
                }}
              />
              <span className="text-xs text-text-tertiary w-6">{activeTextAnnotation.fontSize}</span>
            </label>
          )}
          <div className="h-8 w-px bg-border-color mx-1" />
          <button
            onClick={handleUndo}
            className="btn-secondary text-sm"
            type="button"
            disabled={!canUndo}
          >
            Undo
          </button>
          <button
            onClick={handleRedo}
            className="btn-secondary text-sm"
            type="button"
            disabled={!canRedo}
          >
            Redo
          </button>
          {activeTextAnnotation && (
            <button
              onClick={() => removeTextAnnotation(activeTextAnnotation.id)}
              className="btn-secondary text-sm text-red-400"
              type="button"
            >
              Удалить текст
            </button>
          )}
          <span className="text-xs text-text-tertiary ml-auto">
            Страница: {pages.length > 0 ? activePageIndex + 1 : 0}/{pages.length}
          </span>
        </div>

        <div className="flex-1 overflow-auto p-4 sm:p-6">
          {isLoadingAsset ? (
            <div className="h-full flex items-center justify-center text-text-secondary">
              Подготовка файла для проверки...
            </div>
          ) : pages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-text-secondary">
              Нет данных для отображения
            </div>
          ) : (
            <div className="space-y-6">
              {pages.map((page, index) => (
                <div
                  key={`review-page-${index}`}
                  className={`mx-auto w-fit border rounded ${
                    activePageIndex === index ? 'border-primary' : 'border-border-color'
                  }`}
                  data-review-page
                  onClick={() => setActivePageIndex(index)}
                >
                  <div className="relative" style={{ width: page.width }}>
                    <img
                      src={page.baseDataUrl}
                      alt={`Review page ${index + 1}`}
                      className="block select-none"
                      style={{ width: page.width, height: page.height }}
                    />
                    {textAnnotations
                      .filter((item) => item.pageIndex === index)
                      .map((item) => (
                        <div
                          key={item.id}
                          className={`absolute z-20 ${
                            activeTextId === item.id ? 'ring-2 ring-primary' : ''
                          }`}
                          style={{ left: item.x, top: item.y, width: item.width }}
                          onClick={(event) => {
                            event.stopPropagation();
                            setActiveTextId(item.id);
                            setActivePageIndex(index);
                          }}
                        >
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <button
                              type="button"
                              className="px-1.5 py-0.5 text-[10px] bg-bg-card border border-border-color rounded cursor-move"
                              onPointerDown={(event) => startTextDrag(item, event)}
                              title="Переместить"
                            >
                              Перетащить
                            </button>
                            <button
                              type="button"
                              className="px-1.5 py-0.5 text-[10px] bg-bg-card border border-border-color rounded text-red-400"
                              onClick={(event) => {
                                event.stopPropagation();
                                removeTextAnnotation(item.id);
                              }}
                              title="Удалить текст"
                            >
                              Удалить
                            </button>
                          </div>
                          <textarea
                            value={item.text}
                            onChange={(event) => updateTextAnnotation(item.id, { text: event.target.value })}
                            onFocus={() => {
                              setActiveTextId(item.id);
                              setActivePageIndex(index);
                            }}
                            onBlur={() => {
                              if (!item.text.trim()) {
                                removeTextAnnotation(item.id);
                              }
                            }}
                            className="w-full resize-none bg-transparent border border-border-color rounded px-2 py-1 text-text-primary"
                            style={{
                              height: item.height,
                              fontSize: item.fontSize,
                              lineHeight: 1.25,
                              color: item.color,
                            }}
                            placeholder="Введите текст..."
                            rows={1}
                          />
                          <button
                            type="button"
                            className="absolute -bottom-2 -right-2 w-4 h-4 rounded bg-primary border border-white cursor-se-resize"
                            onPointerDown={(event) => startTextResize(item, event)}
                            title="Изменить размер рамки"
                          />
                        </div>
                      ))}
                    <canvas
                      ref={(node) => {
                        overlayRefs.current[index] = node;
                        if (node) {
                          initializeHistoryForCanvas(index, node);
                        }
                      }}
                      width={page.width}
                      height={page.height}
                      className="absolute inset-0 w-full h-full touch-none z-10"
                      style={{ cursor: activeTool === 'text' ? 'text' : 'crosshair' }}
                      onPointerDown={(event) => handleCanvasPointerDown(index, event)}
                      onPointerMove={(event) => handleCanvasPointerMove(index, event)}
                      onPointerUp={() => finishDrawing(index)}
                      onPointerLeave={() => finishDrawing(index)}
                    />
                  </div>
                  {pages.length > 1 && (
                    <div className="px-3 py-2 text-xs text-text-secondary bg-bg-card border-t border-border-color">
                      Страница {index + 1}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
