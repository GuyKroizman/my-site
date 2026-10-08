// @ts-nocheck
import type { GameContext } from "./context";

export class UI extends Phaser.Scene {
  context: GameContext;
  private key: string;
  active: boolean;
  private log: Phaser.GameObjects.Text | undefined;
  private floorText: Phaser.GameObjects.Text | undefined;

  constructor(context: GameContext) {
    super("ui-scene");

    this.context = context;
    this.key = "ui-scene";
    this.active = true;
    this.log = undefined;
    this.floorText = undefined;
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

    let height = this.context.player.createUI({ scene: this, x, y, width: 198 });
    y += height;

    this.add.line(x + 5, y, 0, 10, 175, 10, 0xcfc6b8).setOrigin(0);

    this.log = this.add.text(x + 10, y + 20, "", {
      font: "12px Arial",
      color: "#cfc6b8",
      wordWrap: {
        width: 180
      }
    });
  }

  update() {
    if (!this.log) return;

    const text = this.context.messages.join(`\n\n`);
    this.log.setText(text);
  }
}
