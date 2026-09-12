/**
 * Design tokens for Semester Runway.
 *
 * Every value here is lifted verbatim from the Claude Design handoff
 * (`project/Semester Runway Prototype.dc.html`). The design medium was HTML with
 * inline styles, so these constants are the single place that translation lives:
 * screens reference `colors.ink`, never `'#1E1A17'`.
 *
 * The system is "envelope": a cream ground, ink rules instead of boxes, one ink
 * block per screen carrying the hero number, sage for money that is working for
 * you, coral/red for the run-out edge.
 */

export const colors = {
  /** App ground. */
  cream: '#FAF6EE',
  /** Near-black. Text, 2px rules, the one filled block per screen. */
  ink: '#1E1A17',
  /** Secondary copy on cream. */
  muted: '#5E554B',
  /** Tertiary copy, axis labels, dashed affordances. */
  tan: '#8A7F72',
  /** Hairline-weight rule between list rows (still 2px, just lighter). */
  ruleSoft: '#E4DCCB',
  /** Neutral fill for bars and the covered-so-far segment of the heat strip. */
  sand: '#C9BFAF',
  /** Money that is set aside or incoming. */
  sage: '#DDEDE3',
  /** Text weight of sage — earnings, on-track streaks. */
  green: '#2F7A57',
  /** The run-out zone: hatching, and the date itself when you don't make it. */
  coral: '#FF9E7A',
  /** Warning text on cream (coral is too light to read at body size). */
  red: '#C2481F',
  /** The run-out date when you *do* make it, on ink grounds. */
  mint: '#9FD3B5',
  /** Streak-broken / caution tint. */
  blush: '#FFE3D8',
  white: '#ffffff',
  /** Camera viewfinder weave. */
  scanWeaveA: '#26211D',
  scanWeaveB: '#211D19',
} as const;

/** Translucent ink/cream, used on the inverted (ink-ground) screens. */
export const alpha = {
  creamOn: (o: number) => `rgba(250,246,238,${o})`,
  inkOn: (o: number) => `rgba(30,26,23,${o})`,
} as const;

/**
 * Baloo 2 — the one family. The design used weights 600/700/800; React Native
 * selects a face by family name, not by numeric weight, so these are the names
 * to pass as `fontFamily`.
 */
export const fonts = {
  semibold: 'Baloo2_600SemiBold',
  bold: 'Baloo2_700Bold',
  extrabold: 'Baloo2_800ExtraBold',
} as const;

export type FontWeight = 600 | 700 | 800;

export const fontFor = (weight: FontWeight): string =>
  weight === 800 ? fonts.extrabold : weight === 700 ? fonts.bold : fonts.semibold;

/** Horizontal page gutter. Every screen in the design uses 22. */
export const GUTTER = 22;

/** Rule weights. The design has exactly two. */
export const RULE = 2;

/**
 * The design's frame reserved 62px above content for the status bar. On a real
 * device we take the safe-area inset instead and add the same 3px of air the
 * design had between the clock and the first line of content.
 */
export const STATUS_BAR_GAP = 3;

/** Space kept clear under a screen for the home indicator when there's no tab bar. */
export const HOME_INDICATOR_GAP = 30;
