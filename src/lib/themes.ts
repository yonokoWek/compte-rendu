export interface ThemePreset {
  id: string;
  name: string;
  colors: {
    primary: string;
    primaryHover: string;
    primaryLight: string;
    primaryText: string;
  };
}

export const THEME_PRESETS: ThemePreset[] = [
  { id: 'orange', name: 'Orange', colors: { primary: '#ea580c', primaryHover: '#c2410c', primaryLight: '#fff7ed', primaryText: '#ffffff' } },
  { id: 'emerald', name: 'Émeraude', colors: { primary: '#059669', primaryHover: '#047857', primaryLight: '#ecfdf5', primaryText: '#ffffff' } },
  { id: 'rose', name: 'Rose', colors: { primary: '#e11d48', primaryHover: '#be123c', primaryLight: '#fff1f2', primaryText: '#ffffff' } },
  { id: 'violet', name: 'Violet', colors: { primary: '#7c3aed', primaryHover: '#6d28d9', primaryLight: '#f5f3ff', primaryText: '#ffffff' } },
  { id: 'sky', name: 'Ciel', colors: { primary: '#0284c7', primaryHover: '#0369a1', primaryLight: '#f0f9ff', primaryText: '#ffffff' } },
  { id: 'amber', name: 'Ambre', colors: { primary: '#d97706', primaryHover: '#b45309', primaryLight: '#fffbeb', primaryText: '#ffffff' } },
  { id: 'teal', name: 'Turquoise', colors: { primary: '#0d9488', primaryHover: '#0f766e', primaryLight: '#f0fdfa', primaryText: '#ffffff' } },
  { id: 'fuchsia', name: 'Fuchsia', colors: { primary: '#c026d3', primaryHover: '#a21caf', primaryLight: '#fdf4ff', primaryText: '#ffffff' } },
];

export function getPreset(id: string): ThemePreset {
  return THEME_PRESETS.find((p) => p.id === id) || THEME_PRESETS[0];
}

export function applyThemeCSSVariables(preset: ThemePreset): Record<string, string> {
  return {
    '--theme-primary': preset.colors.primary,
    '--theme-primary-hover': preset.colors.primaryHover,
    '--theme-primary-light': preset.colors.primaryLight,
    '--theme-primary-text': preset.colors.primaryText,
  };
}
