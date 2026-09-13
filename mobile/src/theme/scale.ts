import { Dimensions } from 'react-native';

/**
 * Type scaling.
 *
 * The handoff was drawn against a 402pt frame and, being a design file, it was
 * set a little tighter than reads comfortably in the hand. Two corrections
 * happen here, in one place, so no screen has to think about either:
 *
 *  1. **Screen width.** A bigger phone gets proportionally bigger type instead
 *     of the same pt sizes floating in more space.
 *  2. **Legibility.** Small text gets the larger bump — 12pt captions are the
 *     ones that actually hurt to read. Display numbers get none beyond the
 *     width factor, because they're already large and growing them further
 *     pushes `$1,234.56` off the edge.
 */

/** The frame the design was drawn against — iPhone 16 Pro. */
const DESIGN_WIDTH = 402;

/**
 * Above this, extra width is space rather than a reason for bigger type. It
 * also keeps the web preview sane: react-native-web reports the browser window,
 * not the phone frame the app is rendered into.
 */
const MAX_WIDTH = 440;

const widthFactor = Math.max(
  1,
  Math.min(Dimensions.get('window').width, MAX_WIDTH) / DESIGN_WIDTH,
);

/**
 * How much of a legibility bump a given size gets, on top of the width factor.
 *
 * Raised across the board after reading the app on a real phone rather than in
 * a design frame — everything was a step smaller than comfortable. Body and
 * caption text moves most, because that's where it hurt; display numbers move
 * least, since `$1,234.56` at 48pt is already close to the edge of a 402pt
 * screen and the `fit` prop is what saves it when it isn't.
 */
function legibility(size: number): number {
  if (size <= 13) return 1.28;
  if (size <= 20) return 1.2;
  if (size <= 40) return 1.1;
  return 1.04;
}

/** A font size from the design, corrected for this screen. */
export function scaleFont(size: number): number {
  return Math.round(size * widthFactor * legibility(size));
}

/**
 * A fixed width that has to keep holding its text — a bar chart's label column,
 * an amount gutter. Scaled on the same curve as the ~14pt text inside it, so
 * columns don't start clipping once the type grows.
 */
export function scaleWidth(px: number): number {
  return Math.round(px * widthFactor * 1.2);
}

/**
 * The smallest line height Baloo 2 can take before iOS slices the tops off
 * glyphs.
 *
 * iOS caps a line's usable ascent at `lineHeight − descent`, and Baloo 2's
 * descent is 0.524em. Measured against the font's own glyph boxes, `$` reaches
 * 0.703em above the baseline and so needs 1.227em, digits need 1.149em, and the
 * dot on a `j` needs 1.235em. The design asks for 0.95 and 1.0 on its display
 * type — fine in CSS, where the glyph simply overflows its line box, but on
 * device it clips. This is the floor that keeps every number whole.
 */
export const MIN_LINE_HEIGHT = 1.25;
