import { isMobileBrowser } from '../../utils/runtime.ts';

/**
 * True when Rogue0 is running on a touch-first device (phone/tablet, or an
 * emulated touch device). Keyboard shortcut hints are useless there: there is
 * no physical keyboard to press, so the labels only add clutter.
 */
export function isTouchFirstDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (isMobileBrowser()) return true;
  return typeof window !== 'undefined' &&
    'ontouchstart' in window &&
    window.matchMedia?.('(pointer: coarse)').matches === true;
}

/**
 * Remove bracketed keyboard hints from a button label on touch devices.
 * Examples: "Wait  [Space]" -> "Wait",
 *           "Inspect  [x] · Search  [s]" -> "Inspect · Search".
 *
 * The second argument is only used by tests to force a device without
 * touching global state; callers pass just the label.
 */
export function buttonLabel(label: string, touch = isTouchFirstDevice()): string {
  return touch ? label.replace(/\s*\[[^\]]+\]/g, '') : label;
}
