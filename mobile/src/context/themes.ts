export type ThemeType = 'ocean' | 'emerald' | 'purple' | 'sunset' | 'light' | 'light_mint' | 'light_peach';

export interface ThemeColors {
  bg: string;
  surface: string;
  accent: string;
  accentHover: string;
  border: string;
  text: string;
  textMuted: string;
}

export const themes: Record<ThemeType, ThemeColors> = {
  ocean: {
    bg: '#020617',
    surface: '#0f172a',
    accent: '#3b82f6',
    accentHover: '#2563eb',
    border: '#1e293b',
    text: '#f8fafc',
    textMuted: '#94a3b8',
  },
  emerald: {
    bg: '#09090b',
    surface: '#18181b',
    accent: '#10b981',
    accentHover: '#059669',
    border: '#27272a',
    text: '#fafafa',
    textMuted: '#a1a1aa',
  },
  purple: {
    bg: '#0a0a0a',
    surface: '#171717',
    accent: '#8b5cf6',
    accentHover: '#7c3aed',
    border: '#262626',
    text: '#fafafa',
    textMuted: '#a3a3a3',
  },
  sunset: {
    bg: '#0c0a09',
    surface: '#1c1917',
    accent: '#f43f5e',
    accentHover: '#e11d48',
    border: '#292524',
    text: '#fafaf9',
    textMuted: '#a8a29e',
  },
  light: {
    bg: '#f8fafc',
    surface: '#ffffff',
    accent: '#3b82f6',
    accentHover: '#1d4ed8',
    border: '#e2e8f0',
    text: '#0f172a',
    textMuted: '#64748b',
  },
  light_mint: {
    bg: '#f4fbf7',
    surface: '#ffffff',
    accent: '#10b981',
    accentHover: '#059669',
    border: '#e6f4ed',
    text: '#064e3b',
    textMuted: '#68a691',
  },
  light_peach: {
    bg: '#fffaf5',
    surface: '#ffffff',
    accent: '#f97316',
    accentHover: '#ea580c',
    border: '#fdf0e2',
    text: '#431407',
    textMuted: '#8a6255',
  },
};
