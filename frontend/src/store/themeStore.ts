import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useAlertStore } from './alertStore';

type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

// Определяем системную тему
const getSystemTheme = (): Theme => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light'; // По умолчанию светлая тема
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: getSystemTheme(),
      toggleTheme: () =>
        set((state) => {
          const newTheme = state.theme === 'dark' ? 'light' : 'dark';

          // Показываем предупреждение при каждом переключении на светлую тему
          if (newTheme === 'light') {
            // Небольшая задержка, чтобы тема успела примениться визуально
            setTimeout(() => {
              useAlertStore.getState().addAlert(
                'Светлая тема находится в бета-версии. Возможны проблемы с контрастностью и отображением некоторых элементов.',
                'warning'
              );
            }, 100);
          }

          // Применяем тему к document
          document.documentElement.classList.remove('light', 'dark');
          document.documentElement.classList.add(newTheme);
          return { theme: newTheme };
        }),
      setTheme: (theme) => {
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add(theme);
        set({ theme });
      },
    }),
    {
      name: 'theme-storage',
      onRehydrateStorage: () => (state) => {
        // Применяем сохраненную тему при загрузке
        if (state) {
          document.documentElement.classList.add(state.theme);
        }
      },
    }
  )
);
