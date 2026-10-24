import { isModalOpen, type GameContext } from './context';

/** Non-interactive hover help, kept inside the canvas at every screen size. */
export function attachTooltip(
  scene: Phaser.Scene,
  context: GameContext,
  target: Phaser.GameObjects.Rectangle,
  label: string | (() => string)
): void {
  const text = scene.add.text(0, 0, '', {
    fontFamily: 'VT323, monospace', fontSize: 18,
    color: '#e8e1d5', backgroundColor: '#1f1926',
    padding: { x: 8, y: 5 }
  }).setDepth(900).setVisible(false);
  let hoverTimer: Phaser.Time.TimerEvent | undefined;
  const hide = () => {
    hoverTimer?.remove();
    hoverTimer = undefined;
    text.setVisible(false);
  };
  const show = () => {
    hoverTimer = undefined;
    if (isModalOpen(context)) return;
    text.setWordWrapWidth(Math.max(40, scene.scale.width - 32));
    text.setText(typeof label === 'function' ? label() : label);
    const bounds = target.getBounds();
    const x = Phaser.Math.Clamp(bounds.centerX - text.width / 2, 4,
      Math.max(4, scene.scale.width - text.width - 4));
    const above = bounds.top - text.height - 6;
    const y = above >= 4 ? above : bounds.bottom + 6;
    text.setPosition(x, Phaser.Math.Clamp(y, 4,
      Math.max(4, scene.scale.height - text.height - 4))).setVisible(true);
  };
  target.on('pointerover', () => {
    hide();
    if (!isModalOpen(context)) hoverTimer = scene.time.delayedCall(2000, show);
  });
  target.on('pointerout', hide);
  target.on('pointerdown', hide);
  const update = () => { if (isModalOpen(context)) hide(); };
  scene.events.on('update', update);
  scene.scale.on('resize', hide);
  scene.events.once('shutdown', () => {
    hide();
    scene.events.off('update', update);
    scene.scale.off('resize', hide);
  });
}
