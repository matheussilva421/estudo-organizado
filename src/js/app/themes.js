// =============================================
// THEME MANAGEMENT
// =============================================
import { scheduleSave, state } from '../store.js?v=8.37';

export const THEME_OPTIONS = [
  { value: 'grafite', label: 'Grafite' },
  { value: 'ardosia', label: 'Ardósia' },
  { value: 'platina', label: 'Platina' },
  { value: 'terminal', label: 'Terminal' },
  { value: 'neon', label: 'Neon' },
  { value: 'arrakis', label: 'Arrakis' },
  { value: 'codex', label: 'Codex' },
  { value: 'plasma', label: 'Plasma' },
];

const THEME_VALUES = THEME_OPTIONS.map((theme) => theme.value);
const LEGACY_THEME_ALIASES = {
  light: 'grafite',
  dark: 'grafite',
  obsidiana: 'ardosia',
  contraste: 'platina',
  abismo: 'grafite',
  cyberpunk2077: 'grafite',
  furtivo: 'ardosia',
  matrix: 'ardosia',
  rubi: 'platina',
  pergaminho: 'platina',
};

export function normalizeTheme(themeName, legacyDarkMode = false) {
  if (THEME_VALUES.includes(themeName)) return themeName;
  if (themeName && LEGACY_THEME_ALIASES[themeName]) return LEGACY_THEME_ALIASES[themeName];
  return legacyDarkMode ? 'grafite' : 'grafite';
}

export function getThemeLabel(themeName) {
  const normalizedTheme = normalizeTheme(themeName);
  return THEME_OPTIONS.find((theme) => theme.value === normalizedTheme)?.label || 'Grafite';
}

function getNextTheme(themeName) {
  const currentIndex = THEME_VALUES.indexOf(normalizeTheme(themeName));
  return THEME_VALUES[(currentIndex + 1) % THEME_VALUES.length];
}

/**
 * Aplica ou troca tema visual
 * @param {boolean} [toggle=false] - Se true, avanca para o proximo tema
 */
export function applyTheme(toggle = false) {
  if (toggle) {
    const currentTheme = normalizeTheme(state.config.tema, state.config.darkMode);
    const nextTheme = getNextTheme(currentTheme);
    state.config.tema = nextTheme;
    state.config.darkMode = true;
    state.config.lastTheme = nextTheme;
    scheduleSave();
  }
  const theme = normalizeTheme(state.config.tema, state.config.darkMode);
  document.documentElement.setAttribute('data-theme', theme);

  const btn = document.getElementById('theme-toggle-btn');
  if (btn) {
    const themeLabel = getThemeLabel(theme);
    // Icon-only button — keep label only as tooltip / a11y text.
    btn.innerHTML = '<i class="fa fa-palette" aria-hidden="true"></i>';
    btn.setAttribute('title', `Tema atual: ${themeLabel}. Clique para trocar.`);
    btn.setAttribute('aria-label', `Tema atual: ${themeLabel}. Clique para trocar.`);
  }
}
