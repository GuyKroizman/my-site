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

/**
 * Targeting instructions in the log strip. Phone players only get tap wording;
 * keyboard/mouse players keep the original cursor and hotkey instructions.
 */
export function throwTargetHint(name: string, wand: boolean, touch = isTouchFirstDevice()): string {
  if (wand) {
    return touch
      ? `Target ${name}: tap an enemy, then tap it again to fire, or tap any tile in sight to fire there. Walls and closed doors block the bolt. Open the backpack to cancel.`
      : `Target ${name}: tap an enemy to select it, tap it again (or Enter) to fire. Move the cursor past your sight to zap into the dark; walls and closed doors still block the bolt. Tap the wand again to fire at the highlighted foe. Open the backpack or press Esc to cancel.`;
  }
  return touch
    ? `Target ${name}: tap any tile in sight to throw. Open the backpack to cancel.`
    : `Target ${name}: tap any tile in sight, or move cursor + Enter. Esc cancels.`;
}

/**
 * Message logged when the hero first steps onto the stairs. Tapping the tile
 * while standing on it is the phone equivalent of the keyboard descend key.
 */
export function stairsHint(exit: boolean, touch = isTouchFirstDevice()): string {
  if (touch) {
    return exit
      ? "You stand on the exit. Tap the stairs to escape the dungeon."
      : "You stand on the stairs. Tap the stairs to descend.";
  }
  return exit
    ? "You stand on the exit. Press > (or .) to escape the dungeon."
    : "You stand on the stairs. Press > (or .) to descend.";
}
