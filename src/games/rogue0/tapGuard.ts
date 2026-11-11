import type { GameContext } from './context';

/**
 * True when a `pointerup` ends a gesture that moved the map rather than a tap
 * on the control the finger happens to be over.
 *
 * Phaser fires a game object's `pointerup` wherever the pointer is released,
 * not where it was pressed, so a one-finger pan that starts on the map and
 * ends over the HUD used to open the log or press a toolbar button. The scene
 * sets `mapGesture` as soon as a gesture pans or pinches and only clears it on
 * the next fresh press, so every release of that gesture is ignored - even a
 * second finger lifted after the delay that ends a pinch. `panning` and
 * `pinching` describe the camera state and are checked too, so a scene that
 * only toggles those still suppresses the accidental tap.
 */
export function isMapGesture(context: GameContext): boolean {
  return !!context.mapGesture || context.panning || context.pinching;
}

/** Attaches a tap handler that ignores releases ending a map gesture. */
export function onTap(
  context: GameContext,
  target: Phaser.GameObjects.GameObject,
  handler: () => void
): void {
  target.on('pointerup', () => {
    if (!isMapGesture(context)) handler();
  });
}
