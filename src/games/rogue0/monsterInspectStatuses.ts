import type Phaser from 'phaser';
import type { Entity } from './entity';
import { STATUS_ICON_TEXTURE, statusIconFrame } from './statusIconTextures.ts';
import { statusDurationLabel } from './heroViewModel.ts';

/** Status badges belong to inspection, never to the world above an actor. */
export class MonsterInspectStatuses {
  private root: Phaser.GameObjects.Container;
  private signature = '';
  private target?: Entity;
  private page = 0;
  private contentHeight = 0;
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene, parent: Phaser.GameObjects.Container) {
    this.scene = scene;
    this.root = scene.add.container(10, 26);
    parent.add(this.root);
  }

  setY(y: number): void {
    this.root.setY(y);
  }

  /** Compact labelled badges; paginate rather than lose effects on short screens. */
  update(target: Entity | undefined, width: number, maxHeight: number): number {
    if (target !== this.target) {
      this.target = target;
      this.page = 0;
      this.signature = '';
    }
    const effects = target?.effects ?? [];
    const columns = width >= 260 ? 2 : 1;
    const rows = Math.max(1, Math.floor((maxHeight - 38) / 44));
    const pageSize = columns * rows;
    const pages = Math.max(1, Math.ceil(effects.length / pageSize));
    this.page = Math.min(this.page, pages - 1);
    const signature = JSON.stringify([width, rows, this.page,
      effects.map(effect => [effect.id, effect.name, statusDurationLabel(effect)])]);
    if (signature === this.signature) return this.contentHeight;
    this.signature = signature;
    this.root.removeAll(true);
    this.contentHeight = 0;
    if (!effects.length) return 0;
    const textStyle = { fontFamily: 'VT323, monospace', fontSize: 16, color: '#e8e1d5' };
    this.root.add(this.scene.add.text(0, 0, 'Status effects', { ...textStyle, color: '#f0b429' }));
    const shown = effects.slice(this.page * pageSize, (this.page + 1) * pageSize);
    shown.forEach((effect, i) => {
      const x = (i % columns) * (width / columns);
      const y = 20 + Math.floor(i / columns) * 44;
      const icon = this.scene.add.image(x, y + 4, STATUS_ICON_TEXTURE, statusIconFrame(effect.id))
        .setOrigin(0).setDisplaySize(24, 24);
      const label = this.scene.add.text(x + 30, y,
        `${effect.name} (${statusDurationLabel(effect)})`, {
          ...textStyle, wordWrap: { width: width / columns - 34 }
        });
      this.root.add([icon, label]);
    });
    this.contentHeight = 20 + Math.ceil(shown.length / columns) * 44;
    if (pages > 1) {
      const more = this.scene.add.text(0, this.contentHeight, `More statuses (${this.page + 1}/${pages}) →`,
        { ...textStyle, color: '#f0b429' }).setInteractive({ useHandCursor: true });
      more.on('pointerup', () => {
        this.page = (this.page + 1) % pages;
        this.signature = '';
        this.update(this.target, width, maxHeight);
      });
      this.root.add(more);
      // Reserve a full page even on the last one so the dialog does not jump.
      this.contentHeight = 20 + rows * 44 + 20;
    }
    return this.contentHeight;
  }
}
