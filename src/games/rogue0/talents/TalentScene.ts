import Phaser from 'phaser';
import type { GameContext } from '../context';
import {
  talentTreeLayout,
  maxTreeScroll,
  type TalentLayout,
  type Rect,
} from './talentTreeLayout';
import { isTalentUnlocked, type TalentBonusKind, type TalentNode } from './talentTree';

const FONT = 'VT323, monospace';
const GOLD = '#f0c477';
const DIM = '#9b8584';
const PANEL = 0x1b1420;

const ICON_COLORS: Record<TalentBonusKind, number> = {
  maxHealth: 0xe06f6f,
  armor: 0xa9b7c9,
  evasion: 0x8fd6a0,
  regen: 0x7fd98c,
  lowHpDamage: 0xe08a5a,
  typedDamage: 0x8fa9e0,
  haste: 0xe0c76f,
};

// A separate scene, like StoreScene: it owns the whole viewport and the
// dungeon is paused underneath it.
export class TalentScene extends Phaser.Scene {
  private context: GameContext;
  private selected = 0;
  private message = '';
  private scrollY = 0;
  private dragging = false;
  private dragged = false;
  private dragStartY = 0;
  private dragStartScroll = 0;

  constructor(context: GameContext) {
    super({ key: 'talent-scene', active: false });
    this.context = context;
  }

  create(): void {
    this.selected = 0;
    this.message = '';
    this.scrollY = 0;
    this.cameras.main.setBackgroundColor('#171117');
    this.input.keyboard?.on('keydown', this.onKey, this);
    this.input.on('wheel', this.onWheel, this);
    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerup', this.onPointerUp, this);
    this.scale.on('resize', this.renderTree, this);
    this.events.once('shutdown', () => {
      this.input.keyboard?.off('keydown', this.onKey, this);
      this.input.off('wheel', this.onWheel, this);
      this.input.off('pointerdown', this.onPointerDown, this);
      this.input.off('pointermove', this.onPointerMove, this);
      this.input.off('pointerup', this.onPointerUp, this);
      this.scale.off('resize', this.renderTree, this);
      this.context.talentTreeOpen = false;
      this.context.onTalentTreeOpenChange?.(false);
    });
    this.renderTree();
  }

  private text(x: number, y: number, value: string, size: number, width?: number): Phaser.GameObjects.Text {
    return this.add.text(x, y, value, {
      fontFamily: FONT,
      fontSize: size,
      color: '#eee0cc',
      wordWrap: width ? { width, useAdvancedWrap: true } : undefined,
    });
  }

  private button(rect: Rect, label: string, action: () => void, enabled = true): void {
    const bg = this.add.rectangle(rect.x, rect.y, rect.width, rect.height, 0x302432)
      .setOrigin(0).setStrokeStyle(1, enabled ? 0xb29061 : 0x514752);
    this.text(rect.x + rect.width / 2, rect.y + rect.height / 2, label,
      Math.max(13, Math.min(22, rect.height * 0.42))).setOrigin(0.5)
      .setColor(enabled ? GOLD : DIM);
    if (enabled) bg.setInteractive({ useHandCursor: true }).on('pointerup', action);
  }

  private nodes(): TalentNode[] {
    return this.context.player?.talentTreeNodes ?? [];
  }

  private inViewport(point: { x: number; y: number }, layout: TalentLayout): boolean {
    const v = layout.viewport;
    return point.x >= v.x && point.x < v.x + v.width && point.y >= v.y && point.y < v.y + v.height;
  }

  private renderTree(): void {
    this.children.removeAll(true);
    const player = this.context.player;
    if (!player) return;
    const nodes = this.nodes();
    if (!nodes.length) return;
    this.selected = Phaser.Math.Clamp(this.selected, 0, nodes.length - 1);
    const layout = talentTreeLayout(this.scale.width, this.scale.height, nodes);
    this.scrollY = Phaser.Math.Clamp(this.scrollY, 0, maxTreeScroll(layout));
    this.drawLayout(layout, player);
  }

  private drawIcon(g: Phaser.GameObjects.Graphics, kind: TalentBonusKind | undefined,
    x: number, y: number, size: number): void {
    const color = ICON_COLORS[kind ?? 'armor'];
    const s = size;
    g.fillStyle(color, 1);
    g.lineStyle(Math.max(1.5, s * 0.12), color, 1);
    switch (kind) {
      case 'maxHealth':
        g.fillCircle(x + s * 0.32, y + s * 0.38, s * 0.25);
        g.fillCircle(x + s * 0.68, y + s * 0.38, s * 0.25);
        g.fillTriangle(x + s * 0.08, y + s * 0.52, x + s * 0.92, y + s * 0.52, x + s * 0.5, y + s * 0.95);
        break;
      case 'armor':
        g.fillTriangle(x + s * 0.5, y, x + s, y + s * 0.32, x, y + s * 0.32);
        g.fillRect(x + s * 0.12, y + s * 0.32, s * 0.76, s * 0.5);
        g.fillTriangle(x + s * 0.12, y + s * 0.82, x + s * 0.88, y + s * 0.82, x + s * 0.5, y + s);
        break;
      case 'evasion':
        g.lineBetween(x + s * 0.1, y + s * 0.75, x + s * 0.5, y + s * 0.25);
        g.lineBetween(x + s * 0.5, y + s * 0.25, x + s * 0.9, y + s * 0.75);
        g.lineBetween(x + s * 0.1, y + s * 0.45, x + s * 0.5, y);
        break;
      case 'regen':
        g.fillRect(x + s * 0.38, y + s * 0.08, s * 0.24, s * 0.84);
        g.fillRect(x + s * 0.08, y + s * 0.38, s * 0.84, s * 0.24);
        break;
      case 'lowHpDamage':
        g.lineBetween(x + s * 0.22, y + s * 0.86, x + s * 0.78, y + s * 0.2);
        g.fillTriangle(x + s * 0.68, y + s * 0.12, x + s * 0.94, y + s * 0.38, x + s * 0.56, y + s * 0.38);
        g.lineBetween(x + s * 0.18, y + s * 0.52, x + s * 0.48, y + s * 0.82);
        break;
      case 'typedDamage':
        g.fillTriangle(x + s * 0.55, y, x + s * 0.2, y + s * 0.56, x + s * 0.52, y + s * 0.5);
        g.fillTriangle(x + s * 0.45, y + s * 0.46, x + s * 0.8, y + s * 0.44, x + s * 0.42, y + s);
        break;
      case 'haste':
        g.lineBetween(x + s * 0.08, y + s * 0.2, x + s * 0.45, y + s * 0.5);
        g.lineBetween(x + s * 0.45, y + s * 0.5, x + s * 0.08, y + s * 0.8);
        g.lineBetween(x + s * 0.52, y + s * 0.2, x + s * 0.9, y + s * 0.5);
        g.lineBetween(x + s * 0.9, y + s * 0.5, x + s * 0.52, y + s * 0.8);
        break;
    }
  }

  private drawLayout(layout: TalentLayout, player: NonNullable<GameContext['player']>): void {
    const nodes = this.nodes();
    const ranks = player.talentRanks ?? {};
    this.add.rectangle(layout.panel.x, layout.panel.y, layout.panel.width, layout.panel.height, PANEL)
      .setOrigin(0).setStrokeStyle(2, 0x7a6247);

    // Tree content, shifted by the scroll offset. A covering frame below hides
    // anything outside the pane (Phaser 4 WebGL ignores geometry masks).
    const links = this.add.graphics();
    nodes.forEach(entry => {
      entry.requires.forEach(requirement => {
        const from = layout.nodes.find(box => box.id === requirement)?.rect;
        const to = layout.nodes.find(box => box.id === entry.id)?.rect;
        if (!from || !to) return;
        const active = (ranks[requirement] ?? 0) >= 1;
        links.lineStyle(Math.max(1, Math.round(2 * layout.scale)), active ? 0xe0b45f : 0x6b5a70, active ? 0.95 : 0.7);
        links.lineBetween(from.x + from.width / 2, from.y + from.height - this.scrollY,
          to.x + to.width / 2, to.y - this.scrollY);
      });
    });

    const views = nodes.map((entry, index) => ({
      entry,
      box: layout.nodes[index].rect,
      y: layout.nodes[index].rect.y - this.scrollY,
      index,
    }));
    // Backgrounds first, then icons, then labels — creation order is draw
    // order, so icons sit above their cards and below the covering frame.
    views.forEach(view => {
      const { box, y, index, entry } = view;
      const unlocked = isTalentUnlocked(entry, ranks, player.level);
      const bg = this.add.rectangle(box.x, y, box.width, box.height,
        index === this.selected ? 0x3a2c45 : 0x271e30)
        .setOrigin(0)
        .setStrokeStyle(index === this.selected ? 2 : 1, unlocked ? 0xd0a25c : 0x514752);
      bg.setInteractive({ useHandCursor: true })
        .on('pointerover', () => {
          if (this.selected !== index && !this.dragging) { this.selected = index; this.renderTree(); }
        })
        .on('pointerup', (pointer: Phaser.Input.Pointer) => {
          if (this.dragged || !this.inViewport(pointer, layout)) return;
          this.selected = index; this.message = ''; this.renderTree();
        });
    });
    const nodeIcons = this.add.graphics();
    views.forEach(({ entry, box, y }) => {
      if (y + box.height < layout.viewport.y || y > layout.viewport.y + layout.viewport.height) return;
      this.drawIcon(nodeIcons, entry.bonus?.kind, box.x + 10, y + 10,
        Math.min(30 * layout.scale, box.height * 0.28));
    });
    views.forEach(({ entry, box, y }) => {
      const rank = player.talentRank(entry.id);
      const unlocked = isTalentUnlocked(entry, ranks, player.level);
      const iconSize = Math.min(30 * layout.scale, box.height * 0.28);
      const textX = box.x + 14 + iconSize;
      const nameSize = Math.max(10, Math.min(17, 16 * layout.scale));
      this.text(textX, y + 8, entry.name, nameSize, box.width - (textX - box.x) - 8)
        .setColor(unlocked ? GOLD : DIM);
      this.text(box.x + 10, y + 14 + iconSize, `T${entry.tier} · ${rank}/${entry.maxRank}${unlocked ? '' : ' · locked'}`,
        Math.max(9, Math.min(14, 13 * layout.scale))).setColor(unlocked ? '#e8e1d5' : DIM);
      this.text(box.x + 10, y + 18 + iconSize + 14, entry.description,
        Math.max(9, Math.min(13, 12 * layout.scale)), box.width - 20)
        .setColor(unlocked ? '#c9bfae' : DIM);
    });

    // Opaque frame over the scrolled content, then the fixed chrome on top.
    const p = layout.panel, v = layout.viewport;
    this.add.rectangle(p.x, p.y, p.width, v.y - p.y, PANEL).setOrigin(0);
    this.add.rectangle(p.x, v.y + v.height, p.width, p.y + p.height - v.y - v.height, PANEL).setOrigin(0);
    this.add.rectangle(p.x, v.y, v.x - p.x, v.height, PANEL).setOrigin(0);
    this.add.rectangle(v.x + v.width, v.y, p.x + p.width - v.x - v.width, v.height, PANEL).setOrigin(0);

    const titleSize = Math.max(14, Math.min(24, 22 * layout.scale));
    this.text(p.x + 16, p.y + 10, `TALENTS · ${player.name}`, titleSize).setColor(GOLD);
    this.text(p.x + 16, p.y + 12 + titleSize,
      `Level ${player.level} · unspent points: ${player.talentPoints} · drag or scroll the tree`,
      Math.max(10, Math.min(16, 15 * layout.scale)));
    if (this.message) {
      this.text(p.x + 16, p.y + 12 + 2 * titleSize, this.message,
        Math.max(10, Math.min(15, 14 * layout.scale))).setColor(GOLD);
    }
    this.button(layout.close, 'Close [Esc]', () => this.close());

    const detail = layout.detail;
    this.add.rectangle(detail.x, detail.y, detail.width, detail.height, 0x221a29)
      .setOrigin(0).setStrokeStyle(1, 0xaa8864);
    const detailIcons = this.add.graphics();
    const entry = nodes[this.selected];
    const rank = player.talentRank(entry.id);
    const unlocked = isTalentUnlocked(entry, ranks, player.level);
    const bodySize = Math.max(11, Math.min(18, 17 * layout.scale));
    let y = detail.y + 10;
    this.drawIcon(detailIcons, entry.bonus?.kind, detail.x + 12, y + 2, bodySize * 1.6);
    this.text(detail.x + 18 + bodySize * 1.6, y, entry.name, bodySize + 2, detail.width - 34 - bodySize * 1.6).setColor(GOLD);
    y += bodySize + 12;
    this.text(detail.x + 12, y, `${entry.branch} · rank ${rank}/${entry.maxRank} · level ${entry.minLevel}+`,
      bodySize, detail.width - 24);
    y += bodySize + 6;
    this.text(detail.x + 12, y, entry.description, bodySize, detail.width - 24);
    y += bodySize + 10;
    if (!unlocked) {
      this.text(detail.x + 12, y, `Unlocked by: ${entry.requires.map(id =>
        nodes.find(node => node.id === id)?.name ?? id).join(', ') || `level ${entry.minLevel}`}`,
        bodySize, detail.width - 24).setColor('#e69898');
    }
    this.text(detail.x + 12, y + bodySize + 4, 'Branches are independent — specialise in part of the tree.',
      Math.max(10, bodySize - 1), detail.width - 24).setColor(DIM);
    const canLearn = unlocked && rank < entry.maxRank && player.talentPoints > 0 && player.healthPoints > 0;
    const reason = !unlocked ? 'Locked' : rank >= entry.maxRank ? 'Maxed'
      : player.talentPoints <= 0 ? 'No points' : '';
    this.button(layout.rankUp, reason ? `Rank up · ${reason}` : 'Rank up (1 point)',
      () => this.rankUp(), canLearn);
  }

  private rankUp(): void {
    const player = this.context.player;
    const entry = this.nodes()[this.selected];
    if (!player || !entry || !this.context.talentTreeOpen) return;
    if (!player.learnTalent(entry.id)) return;
    this.message = `Learned ${entry.name} (${player.talentRank(entry.id)}/${entry.maxRank}).`;
    this.context.saveNow?.();
    this.renderTree();
  }

  private close(): void {
    if (!this.context.talentTreeOpen) return;
    this.context.saveNow?.();
    this.context.talentTreeOpen = false;
    this.context.onTalentTreeOpenChange?.(false);
    this.context.player!.inputBuffer = [];
    this.context.player!.walkPath = [];
    this.scene.wake('ui-scene');
    this.scene.bringToTop('ui-scene');
    this.scene.resume('scene0');
    this.scene.stop();
  }

  private scrollBy(delta: number): void {
    const layout = talentTreeLayout(this.scale.width, this.scale.height, this.nodes());
    this.scrollY = Phaser.Math.Clamp(this.scrollY + delta, 0, maxTreeScroll(layout));
    this.renderTree();
  }

  private onWheel(_pointer: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number): void {
    if (!this.context.talentTreeOpen) return;
    const layout = talentTreeLayout(this.scale.width, this.scale.height, this.nodes());
    if (!this.inViewport({ x: this.input.activePointer.x, y: this.input.activePointer.y }, layout)) return;
    this.scrollBy(dy);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    const layout = talentTreeLayout(this.scale.width, this.scale.height, this.nodes());
    if (!this.inViewport(pointer, layout)) return;
    this.dragging = true;
    this.dragged = false;
    this.dragStartY = pointer.y;
    this.dragStartScroll = this.scrollY;
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.dragging) return;
    const delta = pointer.y - this.dragStartY;
    if (Math.abs(delta) > 6) this.dragged = true;
    this.scrollY = this.dragStartScroll - delta;
    this.renderTree();
  }

  private onPointerUp(): void {
    this.dragging = false;
  }

  private onKey(event: KeyboardEvent): void {
    if (!this.context.talentTreeOpen || event.repeat) return;
    event.preventDefault();
    const key = event.key;
    if (key === 'Escape') { this.close(); return; }
    const nodes = this.nodes();
    if (!nodes.length) return;
    const layout = talentTreeLayout(this.scale.width, this.scale.height, nodes);
    const horizontalStep = layout.mode === 'wide' ? 1 : 3;
    const verticalStep = layout.mode === 'wide' ? 3 : 1;
    const moves: Record<string, number> = {
      ArrowLeft: -horizontalStep, h: -horizontalStep, ArrowRight: horizontalStep, l: horizontalStep,
      ArrowUp: -verticalStep, k: -verticalStep, ArrowDown: verticalStep, j: verticalStep,
    };
    if (moves[key] !== undefined) {
      this.selected = Phaser.Math.Clamp(this.selected + moves[key], 0, nodes.length - 1);
      this.message = '';
      const box = layout.nodes[this.selected].rect;
      const top = box.y - this.scrollY, bottom = top + box.height;
      if (top < layout.viewport.y) this.scrollBy(top - layout.viewport.y);
      else if (bottom > layout.viewport.y + layout.viewport.height) {
        this.scrollBy(bottom - layout.viewport.y - layout.viewport.height);
      } else this.renderTree();
    } else if (key === 'Enter' || key === ' ') {
      this.rankUp();
    }
  }
}
