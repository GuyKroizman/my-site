import Phaser from 'phaser';
import type { GameContext } from '../context';
import { talentTreeLayout, type TalentLayout } from './talentTreeLayout';
import { isTalentUnlocked } from './talentTree';

const FONT = 'VT323, monospace';
const GOLD = '#f0c477';
const DIM = '#9b8584';

// A separate scene, like StoreScene: it owns the whole viewport and the
// dungeon is paused underneath it.
export class TalentScene extends Phaser.Scene {
  private context: GameContext;
  private selected = 0;
  private message = '';

  constructor(context: GameContext) {
    super({ key: 'talent-scene', active: false });
    this.context = context;
  }

  create(): void {
    this.selected = 0;
    this.message = '';
    this.cameras.main.setBackgroundColor('#171117');
    this.input.keyboard?.on('keydown', this.onKey, this);
    this.scale.on('resize', this.renderTree, this);
    this.events.once('shutdown', () => {
      this.input.keyboard?.off('keydown', this.onKey, this);
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

  private button(rect: { x: number; y: number; width: number; height: number },
    label: string, action: () => void, enabled = true): void {
    const bg = this.add.rectangle(rect.x, rect.y, rect.width, rect.height, 0x302432)
      .setOrigin(0).setStrokeStyle(1, enabled ? 0xb29061 : 0x514752);
    this.text(rect.x + rect.width / 2, rect.y + rect.height / 2, label,
      Math.max(13, Math.min(22, rect.height * 0.42))).setOrigin(0.5)
      .setColor(enabled ? GOLD : DIM);
    if (enabled) bg.setInteractive({ useHandCursor: true }).on('pointerup', action);
  }

  private nodes() {
    return this.context.player?.talentTreeNodes ?? [];
  }

  private renderTree(): void {
    this.children.removeAll(true);
    const player = this.context.player;
    if (!player) return;
    const nodes = this.nodes();
    if (!nodes.length) return;
    this.selected = Phaser.Math.Clamp(this.selected, 0, nodes.length - 1);
    const layout = talentTreeLayout(this.scale.width, this.scale.height, nodes);
    this.drawLayout(layout, player);
  }

  private drawLayout(layout: TalentLayout, player: NonNullable<GameContext['player']>): void {
    this.add.rectangle(layout.panel.x, layout.panel.y, layout.panel.width, layout.panel.height, 0x1b1420)
      .setOrigin(0).setStrokeStyle(2, 0x7a6247);
    const titleSize = Math.max(14, Math.min(24, 22 * layout.scale));
    this.text(layout.panel.x + 16, layout.panel.y + 12, `TALENTS · ${player.name}`, titleSize).setColor(GOLD);
    this.text(layout.panel.x + 16, layout.panel.y + 12 + titleSize + 4,
      `Level ${player.level} · unspent points: ${player.talentPoints}`,
      Math.max(11, Math.min(18, 17 * layout.scale)));
    if (this.message) {
      this.text(layout.panel.x + 16, layout.panel.y + 12 + 2 * (titleSize + 4), this.message,
        Math.max(10, Math.min(16, 15 * layout.scale))).setColor(GOLD);
    }
    this.button(layout.close, 'Close [Esc]', () => this.close());

    const ranks = player.talentRanks ?? {};
    const links = this.add.graphics();
    links.lineStyle(Math.max(1, Math.round(2 * layout.scale)), 0xb29061, 0.7);
    this.nodes().forEach(entry => {
      entry.requires.forEach(requirement => {
        const from = layout.nodes.find(box => box.id === requirement)?.rect;
        const to = layout.nodes.find(box => box.id === entry.id)?.rect;
        if (!from || !to) return;
        links.lineBetween(from.x + from.width / 2, from.y + from.height / 2,
          to.x + to.width / 2, to.y + to.height / 2);
      });
    });

    this.nodes().forEach((entry, index) => {
      const rect = layout.nodes[index].rect;
      const rank = player.talentRank(entry.id);
      const unlocked = isTalentUnlocked(entry, ranks, player.level);
      const selected = index === this.selected;
      const bg = this.add.rectangle(rect.x, rect.y, rect.width, rect.height,
        selected ? 0x3a2c45 : 0x271e30)
        .setOrigin(0)
        .setStrokeStyle(selected ? 2 : 1, unlocked ? 0xd0a25c : 0x514752);
      bg.setInteractive({ useHandCursor: true })
        .on('pointerover', () => { if (this.selected !== index) { this.selected = index; this.renderTree(); } })
        .on('pointerup', () => { this.selected = index; this.renderTree(); });
      const nameSize = Math.max(10, Math.min(17, 16 * layout.scale));
      this.text(rect.x + 8, rect.y + 6, entry.name, nameSize, rect.width - 16)
        .setColor(unlocked ? GOLD : DIM);
      this.text(rect.x + 8, rect.y + 8 + nameSize, `T${entry.tier} · ${rank}/${entry.maxRank}${unlocked ? '' : ' · locked'}`,
        Math.max(9, Math.min(14, 13 * layout.scale))).setColor(unlocked ? '#e8e1d5' : DIM);
      this.text(rect.x + 8, rect.y + 10 + nameSize * 2, entry.description,
        Math.max(9, Math.min(13, 12 * layout.scale)), rect.width - 16).setColor(unlocked ? '#c9bfae' : DIM);
    });

    const detail = layout.detail;
    this.add.rectangle(detail.x, detail.y, detail.width, detail.height, 0x221a29)
      .setOrigin(0).setStrokeStyle(1, 0xaa8864);
    const entry = this.nodes()[this.selected];
    const rank = player.talentRank(entry.id);
    const unlocked = isTalentUnlocked(entry, ranks, player.level);
    const bodySize = Math.max(11, Math.min(19, 18 * layout.scale));
    let y = detail.y + 12;
    this.text(detail.x + 14, y, entry.name, bodySize + 3, detail.width - 28).setColor(GOLD);
    y += bodySize + 12;
    this.text(detail.x + 14, y, `${entry.branch} · rank ${rank}/${entry.maxRank} · level ${entry.minLevel}+`,
      bodySize, detail.width - 28);
    y += bodySize + 8;
    this.text(detail.x + 14, y, entry.description, bodySize, detail.width - 28);
    y += bodySize + 14;
    if (!unlocked) {
      this.text(detail.x + 14, y, `Requires: ${entry.requires.map(id =>
        this.nodes().find(node => node.id === id)?.name ?? id).join(', ') || `level ${entry.minLevel}`}`,
        bodySize, detail.width - 28).setColor('#e69898');
    }
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
      this.renderTree();
    } else if (key === 'Enter' || key === ' ') {
      this.rankUp();
    }
  }
}
