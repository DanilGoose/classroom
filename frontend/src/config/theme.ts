const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

const parseBooleanEnv = (value: string | undefined): boolean => {
  if (!value) {
    return false;
  }
  return TRUE_VALUES.has(value.trim().toLowerCase());
};

export const isLightThemeDisabled = parseBooleanEnv(
  import.meta.env.VITE_DISABLE_LIGHT_THEME
);
