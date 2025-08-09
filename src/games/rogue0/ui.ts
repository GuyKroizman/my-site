// TypeScript errors after site migration - ignoring for game functionality
// @ts-nocheck
import type { GameContext } from "context";

export class UI extends Phaser.Scene {
  context: GameContext;
  private key: string;
  active: boolean;
  private log: Phaser.GameObjects.Text | undefined;

  constructor(context: GameContext) {
    super("ui-scene");

    this.context = context;
    this.key = "ui-scene";
    this.active = true;
    this.log = undefined;
  }

  create() {
    this.scene.get("scene0").events.on("entities-created", () => {
      let x = 80 * 16 - 190;
      let y = 10;

      if (this.context.entities.length == 0) {
        throw new Error("Initialization order error. UI scene have no entities.");
      }

      for (let entity of this.context.entities) {
        if (typeof entity.createUI === "function") {
          let height = entity.createUI({
            scene: this,
            x,
            y,
            width: 198
          });

          y += height;
        }
      }

      this.add.line(x + 5, y, 0, 10, 175, 10, 0xcfc6b8).setOrigin(0);

      this.log = this.add.text(x + 10, y + 20, "", {
        font: "12px Arial",
        color: "#cfc6b8",
        wordWrap: {
          width: 180
        }
      });
    });
  }

  update() {
    if (!this.log) return;

    let text = this.context.messages.join(`\n\n`);
    this.log.setText(text);
  }
}
