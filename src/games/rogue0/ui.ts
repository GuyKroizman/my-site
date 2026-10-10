// @ts-nocheck
import type { GameContext } from "./context";

export class UI extends Phaser.Scene {
  context: GameContext;
  private key: string;
  active: boolean;
  private log: Phaser.GameObjects.Text | undefined;
  private floorText: Phaser.GameObjects.Text | undefined;
  private statusText: Phaser.GameObjects.Text | undefined;

  constructor(context: GameContext) {
    super("ui-scene");

    this.context = context;
    this.key = "ui-scene";
    this.active = true;
    this.log = undefined;
    this.floorText = undefined;
    this.statusText = undefined;
  }

  create() {
    this.scene.get("scene0").events.on("entities-created", () => {
      this.buildPanel();
    });

    this.scene.get("scene0").events.on("floor-changed", () => {
      this.floorText?.setText(`Floor ${this.context.floor}`);
    });
  }

  buildPanel() {
    const x = 80 * 16 - 190;
    let y = 10;

    if (!this.context.player) {
      throw new Error("Initialization order error. UI scene has no player.");
    }

    this.floorText = this.add.text(x, y, `Floor ${this.context.floor}`, {
      font: "16px Arial",
      color: "#ffffff"
    });
    y += 24;

    const height = this.context.player.createUI({ scene: this, x, y, width: 198 });
    y += height;

    // Status / inspect panel.
    y += 8;
    this.statusText = this.add.text(x + 10, y, "", {
      font: "12px Arial",
      color: "#cfc6b8",
      wordWrap: { width: 180 }
    });
    y += 96;

    // Message log.
    this.add.line(x + 5, y, 0, 10, 175, 10, 0xcfc6b8).setOrigin(0);
    this.log = this.add.text(x + 10, y + 14, "", {
      font: "12px Arial",
      color: "#cfc6b8",
      wordWrap: { width: 180 }
    });
  }

  update() {
    if (!this.log) return;

    this.log.setText(this.context.messages.join(`\n\n`));
    this.updateStatus();
  }

  updateStatus() {
    if (!this.statusText) return;

    const e = this.context.inspectedEntity;
    if (!e) {
      this.statusText.setText("Hover a creature, or tap it with Inspect on.");
      return;
    }

    if (e.type === "enemy") {
      const hp = e.healthPoints ?? 0;
      const maxHp = e.maxHealthPoints ?? e.healthPoints ?? 0;
      const atk = typeof e.attack === "function" ? e.attack() : 0;
      const prot = typeof e.protection === "function" ? e.protection() : 0;
      const range = typeof e.range === "function" ? e.range() : 0;
      this.statusText.setText(
        `${e.name}\n${e.description}\nHP: ${hp}/${maxHp}\nATK: ${atk}  DEF: ${prot}  Range: ${range}`
      );
    } else {
      this.statusText.setText(`${e.name}\n${e.description}`);
    }
  }
}
