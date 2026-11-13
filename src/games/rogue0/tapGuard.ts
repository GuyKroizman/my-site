import type { GameContext } from './context';

/**
 * True when a `pointerup` ends a gesture that moved the map rather than a tap
 * on the control the finger happens to be over.
 *
 * Phaser fires a game object's `pointerup` wherever the pointer is released,
 * not where it was pressed, so a one-finger pan that starts on the map and
 * ends over the HUD used to open the log or press a toolbar button. The scene
 * sets `mapGesture` as soon as a gesture pans or pinches and only clears it on
 * the next fresh map press, so every release of that gesture is ignored - even a
 * second finger lifted after the delay that ends a pinch. `panning` and
 * `pinching` describe the camera state and are checked too, so a scene that
 * only toggles those still suppresses the accidental tap.
 */
export function isMapGesture(context: GameContext): boolean {
  return !!context.mapGesture || context.panning || context.pinching;
}

/**
 * Only activate a gesture that started on this control, not a map release that
 * happens to land on it. Do not gate HUD taps on isMapGesture: Phaser's top UI
 * scene consumes HUD presses before scene0 can clear its latched gesture flags.
 */
export function onTap(
  context: GameContext,
  target: Phaser.GameObjects.GameObject,
  handler: () => void
): void {
  // Keep the context argument for callers, but world gesture state is not the
  // authority for a press owned by the UI scene.
  void context;
  let press: { id: number; time: number; x: number; y: number } | undefined;
  const moved = (p: Phaser.Input.Pointer) => !!press &&
    (Math.abs(p.x - press.x) > 8 || Math.abs(p.y - press.y) > 8);
  target.on('pointerdown', (p: Phaser.Input.Pointer) => {
    press = { id: p.id, time: p.downTime, x: p.x, y: p.y };
  });
  target.on('pointermove', (p: Phaser.Input.Pointer) => {
    if (press?.id === p.id && moved(p)) press = undefined;
  });
  target.on('pointerout', (p: Phaser.Input.Pointer) => {
    if (press?.id === p.id) press = undefined;
  });
  target.on('pointerup', (p: Phaser.Input.Pointer) => {
    if (!press || press.id !== p.id) return;
    const activate = press.time === p.downTime && !moved(p);
    press = undefined;
    if (activate) handler();
  });
}
