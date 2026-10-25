import { isModalOpen, type GameContext } from './context';
import { InventoryWindow } from './inventoryWindow';
import Wand from './items/wand';
import { attachTooltip } from './tooltip';

// Compact shortcuts beside the backpack; assignment never spends a turn.
export class QuickslotPane {
  private slots: { root: Phaser.GameObjects.Container; icon: Phaser.GameObjects.Sprite;
    label: Phaser.GameObjects.Text }[] = [];

  constructor(scene: Phaser.Scene, private context: GameContext, inventory: InventoryWindow) {
    for (let i = 0; i < 4; i++) {
      const root = scene.add.container(0, 0);
      const box = scene.add.rectangle(0, 0, 44, 44, 0x1f1926)
        .setStrokeStyle(2, 0x5a5060).setInteractive({ useHandCursor: true });
      const icon = scene.add.sprite(0, 0, 'tiles', 0).setVisible(false);
      const label = scene.add.text(19, 19, '+', { fontSize: '12px', color: '#f0b429' }).setOrigin(1);
      root.add([box, icon, label]);
      attachTooltip(scene, context, box, () => {
        const item = context.player?.quickslotItem(i);
        return `Quick slot ${i + 1}: ${item ? item.displayName : 'empty'}\nHold to assign`;
      });
      let timer: Phaser.Time.TimerEvent | undefined;
      let pressed = false;
      let held = false;
      const cancel = () => { timer?.remove(); timer = undefined; pressed = false; };
      box.on('pointerdown', () => {
        if (isModalOpen(context)) return;
        pressed = true;
        held = false;
        timer = scene.time.delayedCall(500, () => {
          if (!pressed || isModalOpen(context)) return;
          held = true;
          // Open on release so that release cannot accidentally select an item.
          box.setStrokeStyle(2, 0xf0b429);
        });
      });
      box.on('pointerout', () => { cancel(); box.setStrokeStyle(2, 0x5a5060); });
      box.on('pointerup', () => {
        const activate = pressed && !isModalOpen(context);
        cancel();
        box.setStrokeStyle(2, 0x5a5060);
        if (!activate) return;
        if (held) inventory.chooseQuickslot(i);
        else context.player?.activateQuickslot(i);
      });
      scene.events.once('shutdown', cancel);
      this.slots.push({ root, icon, label });
    }
  }

  layout(right: number, y: number, size = 34, gap = 3): void {
    this.slots.forEach((slot, i) => {
      slot.root.setPosition(right - size / 2 - (3 - i) * (size + gap), y);
      slot.root.setScale(size / 44);
    });
  }

  refresh(): void {
    this.slots.forEach(({ icon, label }, i) => {
      const item = this.context.player?.quickslotItem(i);
      icon.setVisible(!!item);
      if (!item) { label.setText('+'); return; }
      icon.setTexture(item.spriteTextureKey, item.spriteFrame);
      icon.clearTint();
      if (item.tint) icon.setTint(item.tint);
      label.setText(item instanceof Wand ? `${item.charges}` : item.count > 1 ? `${item.count}` : '');
    });
  }
}
