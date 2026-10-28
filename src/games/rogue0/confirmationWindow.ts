import { isModalOpen, type GameContext } from "./context";

/** Non-blocking confirmation rendered in the same UI scene as the HUD. */
export class ConfirmationWindow {
  private root: Phaser.GameObjects.Container;
  private backdrop: Phaser.GameObjects.Rectangle;
  private panel: Phaser.GameObjects.Rectangle;
  private title: Phaser.GameObjects.Text;
  private body: Phaser.GameObjects.Text;
  private cancel: Phaser.GameObjects.Text;
  private accept: Phaser.GameObjects.Text;
  private action?: () => void;

  constructor(private scene: Phaser.Scene, private context: GameContext) {
    this.root = scene.add.container(0, 0).setDepth(900).setVisible(false);
    this.backdrop = scene.add.rectangle(0, 0, 1, 1, 0x000000, 0.7).setOrigin(0).setInteractive();
    this.panel = scene.add.rectangle(0, 0, 1, 1, 0x1f1926).setOrigin(0).setStrokeStyle(2, 0x5a5060).setInteractive();
    const text = (label: string, color: string) => scene.add.text(0, 0, label, {
      fontFamily: "VT323, monospace", fontSize: 22, color,
    });
    this.title = text("Enter the chasm?", "#f0b429");
    this.body = text("", "#e8e1d5").setLineSpacing(3);
    this.cancel = text("Cancel", "#e8e1d5").setPadding(16, 12).setBackgroundColor("#332b3e").setInteractive({ useHandCursor: true });
    this.accept = text("Jump down", "#f0b429").setPadding(16, 12).setBackgroundColor("#332b3e").setOrigin(1, 0).setInteractive({ useHandCursor: true });
    this.root.add([this.backdrop, this.panel, this.title, this.body, this.cancel, this.accept]);
    this.cancel.on("pointerup", () => this.close());
    this.accept.on("pointerup", () => this.close(true));
    context.onConfirmChasm = (warning, action) => {
      if (isModalOpen(context)) return;
      this.action = action;
      context.confirmationOpen = true;
      this.body.setText(warning);
      this.root.setVisible(true);
      this.layout();
    };
    scene.events.once("shutdown", () => {
      this.close();
      context.onConfirmChasm = undefined;
    });
  }

  close(confirmed = false) {
    const action = this.action;
    this.action = undefined;
    this.context.confirmationOpen = false;
    this.root.setVisible(false);
    // Clear queued movement on either choice; never resume walking into danger.
    if (this.context.player) {
      this.context.player.walkPath = [];
      this.context.player.inputBuffer = [];
    }
    if (confirmed) action?.();
  }

  layout() {
    const { width, height } = this.scene.scale;
    const w = Math.min(440, width - 24);
    this.body.setWordWrapWidth(w - 32, true);
    const h = this.body.height + 132;
    const x = (width - w) / 2;
    const y = (height - h) / 2;
    this.backdrop.setSize(width, height);
    this.panel.setPosition(x, y).setSize(w, h);
    this.title.setPosition(x + 16, y + 14);
    this.body.setPosition(x + 16, y + 50);
    this.cancel.setPosition(x + 16, y + h - 62);
    this.accept.setPosition(x + w - 16, y + h - 62);
  }
}
