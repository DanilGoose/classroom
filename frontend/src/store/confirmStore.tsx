import { create } from 'zustand';

interface ConfirmState {
  isOpen: boolean;
  isExiting: boolean;
  message: string;
  onConfirm: (() => void) | null;
  onCancel: (() => void) | null;
  confirm: (message: string) => Promise<boolean>;
  handleConfirm: () => void;
  handleCancel: () => void;
  close: (callback: () => void) => void;
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  isOpen: false,
  isExiting: false,
  message: '',
  onConfirm: null,
  onCancel: null,

  confirm: (message: string) => {
    return new Promise<boolean>((resolve) => {
      set({
        isOpen: true,
        isExiting: false,
        message,
        onConfirm: () => {
          get().close(() => resolve(true));
        },
        onCancel: () => {
          get().close(() => resolve(false));
        },
      });
    });
  },

  close: (callback: () => void) => {
    // Запускаем анимацию выхода
    set({ isExiting: true });

    // Закрываем диалог после завершения анимации и вызываем callback
    setTimeout(() => {
      set({ isOpen: false, isExiting: false, message: '', onConfirm: null, onCancel: null });
      callback();
    }, 200);
  },

  handleConfirm: () => {
    const { onConfirm } = get();
    if (onConfirm) onConfirm();
  },

  handleCancel: () => {
    const { onCancel } = get();
    if (onCancel) onCancel();
  },
}));
