/**
 * Decorative study desk for the premium home hero. Purely presentational:
 * colours follow the active theme and nothing here represents academic data.
 */
export function StudyScene() {
  return (
    <svg
      className="study-scene"
      viewBox="0 0 520 300"
      role="presentation"
      focusable="false"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="scene-light" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.34" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="scene-screen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.85" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.25" />
        </linearGradient>
      </defs>
      <path d="M196 58 L318 58 L382 236 L132 236 Z" fill="url(#scene-light)" />
      <path d="M300 52 a26 26 0 0 1 34 -26" stroke="var(--control-border)" strokeWidth="4" fill="none" />
      <path d="M334 26 l-46 -6 l-14 30 l58 -4 z" fill="var(--card-hover)" stroke="var(--control-border)" strokeWidth="2" />
      <path d="M100 236 h356" stroke="var(--control-border)" strokeWidth="3" strokeLinecap="round" />
      <rect x="150" y="196" width="86" height="18" rx="5" fill="var(--card)" stroke="var(--control-border)" strokeWidth="1.5" />
      <rect x="144" y="178" width="98" height="18" rx="5" fill="var(--card-hover)" stroke="var(--control-border)" strokeWidth="1.5" />
      <rect x="154" y="160" width="78" height="18" rx="5" fill="var(--card)" stroke="var(--control-border)" strokeWidth="1.5" />
      <path d="M286 236 l8 -74 h96 l8 74 z" fill="var(--surface)" stroke="var(--control-border)" strokeWidth="2" />
      <rect x="300" y="166" width="84" height="52" rx="4" fill="url(#scene-screen)" opacity="0.55" />
      <path d="M318 194 h48 M318 184 h30" stroke="var(--accent-text)" strokeOpacity="0.5" strokeWidth="3" strokeLinecap="round" />
      <rect x="414" y="196" width="26" height="34" rx="6" fill="var(--card)" stroke="var(--control-border)" strokeWidth="1.5" />
      <path d="M440 204 q10 12 0 22" stroke="var(--control-border)" strokeWidth="2" fill="none" />
      <path d="M106 236 q-18 -36 6 -58 q16 22 6 58" fill="var(--card-hover)" stroke="var(--control-border)" strokeWidth="1.5" />
    </svg>
  );
}
