import Phaser from 'phaser';
import type { GameContext } from '../context';
import type { Entity } from '../entity';
import { buyShopItem, purchaseFailure, sellableItems, sellShopItem, type ShopResult } from './shopModel';
import { sellPrice } from './shopPricing';
import { artToScreen, moveSelection, shelfSlots, storeLayout } from './storeLayout';

const FONT = 'VT323, monospace';
const GOLD = '#f0c477';

// A separate scene, not an inventory window layered over the dungeon HUD.
export class StoreScene extends Phaser.Scene {
  private context: GameContext;
  private selected = 0;
  private sellSelected = 0;
  private mode: 'shelves' | 'buy' | 'sell' | 'sell-detail' = 'shelves';
  private detail?: Entity;
  private message = '';
  private slotBorders: Phaser.GameObjects.Rectangle[] = [];

  constructor(context: GameContext) { super({ key: 'store-scene', active: false }); this.context = context; }

  create(): void {
    this.selected = 0; this.sellSelected = 0; this.mode = 'shelves'; this.detail = undefined;
    this.message = 'Time is paused. Browse, buy or sell.';
    this.cameras.main.setBackgroundColor('#171117');
    this.input.keyboard?.on('keydown', this.key, this);
    this.scale.on('resize', this.renderStore, this);
    this.events.once('shutdown', () => {
      this.input.keyboard?.off('keydown', this.key, this);
      this.scale.off('resize', this.renderStore, this);
      this.context.storeOpen = false;
      this.context.onStoreOpenChange?.(false);
    });
    this.renderStore();
  }

  private text(x: number, y: number, value: string, size = 20, width?: number): Phaser.GameObjects.Text {
    return this.add.text(x, y, value, { fontFamily: FONT, fontSize: size, color: '#eee0cc',
      wordWrap: width ? { width, useAdvancedWrap: true } : undefined });
  }

  private button(x: number, y: number, width: number, label: string, action: () => void, enabled = true): void {
    const bg = this.add.rectangle(x, y, width, 44, 0x302432).setOrigin(0)
      .setStrokeStyle(1, enabled ? 0xb29061 : 0x514752);
    this.text(x + width / 2, y + 22, label, 20).setOrigin(0.5).setColor(enabled ? GOLD : '#817783');
    if (enabled) bg.setInteractive({ useHandCursor: true }).on('pointerup', () => {
      if (this.context.storeOpen) action();
    });
  }

  private icon(item: Entity, x: number, y: number, size: number): void {
    const sprite = this.add.sprite(x, y, item.spriteTextureKey, item.spriteFrame);
    sprite.setScale(Math.min(size / sprite.width, size / sprite.height, 3));
    if (item.tint) sprite.setTint(item.tint);
  }

  private select(index: number): void {
    this.selected = index;
    this.slotBorders.forEach((border, i) => border.setStrokeStyle(i === index ? 2 : 0, 0xf0c477));
  }

  private renderStore(): void {
    this.children.removeAll(true);
    this.slotBorders = [];
    const { width: w, height: h } = this.scale;
    const layout = storeLayout(w, h);
    this.add.image(layout.offsetX, layout.offsetY, 'shop-background').setOrigin(0).setScale(layout.scale);
    const shop = this.context.shop!;
    shelfSlots().forEach((slotRect, index) => {
      const rect = artToScreen(slotRect, layout);
      const slot = shop.stock[index];
      const border = this.add.rectangle(rect.x + 2, rect.y + 2, rect.width - 4, rect.height - 4, 0x000000, 0)
        .setOrigin(0).setInteractive({ useHandCursor: true });
      this.slotBorders.push(border);
      if (slot.item) {
        const iconSize = Math.min(rect.height - 6, 42 * layout.scale);
        this.icon(slot.item, rect.x + rect.width / 2, rect.y + rect.height - 3 - iconSize / 2, iconSize);
        if (slot.item.count > 1) this.text(rect.x + rect.width - 6, rect.y + rect.height - 6, `×${slot.item.count}`, 16).setOrigin(1);
      } else this.text(rect.x + rect.width / 2, rect.y + rect.height / 2, 'SOLD', Math.max(10, 13 * layout.scale)).setOrigin(0.5).setColor('#9b8584');
      border.on('pointerover', () => { if (this.mode === 'shelves') this.select(index); });
      border.on('pointerup', () => { if (this.mode === 'shelves') { this.select(index); this.openBuy(); } });
    });
    this.select(this.selected);
    const toolbarY = Math.min(h - 106, layout.offsetY + 245 * layout.scale);
    const panelW = Math.min(w - 16, 460), left = (w - panelW) / 2;
    this.add.rectangle(left - 4, toolbarY - 30, panelW + 8, 136, 0x1b1420, 0.94).setOrigin(0);
    this.text(w / 2, toolbarY - 25, `STORE  ·  ${this.context.player!.gold} gold`, 23).setOrigin(0.5, 0).setColor(GOLD);
    const bw = (panelW - 16) / 3;
    const short = bw < 120;
    this.button(left, toolbarY, bw, short ? 'Sell' : 'Sell [S]', () => this.openSell());
    this.button(left + bw + 8, toolbarY, bw, short ? 'View' : 'View [Enter]', () => this.openBuy());
    this.button(left + 2 * (bw + 8), toolbarY, bw, short ? 'Leave' : 'Leave [Q]', () => this.leave());
    this.text(left, toolbarY + 50, this.message, 18, panelW);
    // Large screen-space navigation is also available on touch devices whose
    // downscaled shelf bands are shorter than 44px (no overlapping hit boxes).
    if (layout.mode === 'stacked') {
      const y = Math.max(toolbarY + 110, layout.offsetY + 338 * layout.scale + 16);
      const labels = ['←', '↑', '↓', '→'];
      const dirs = [[-1, 0], [0, -1], [0, 1], [1, 0]];
      labels.forEach((label, i) => this.button(left + i * (panelW / 4), y, panelW / 4 - 4, label,
        () => this.select(moveSelection(this.selected, dirs[i][0], dirs[i][1]))));
    }
    if (this.mode !== 'shelves') this.renderModal(w, h);
  }

  private openBuy(): void {
    if (this.mode !== 'shelves') return;
    this.detail = this.context.shop!.stock[this.selected].item;
    if (!this.detail) { this.message = 'That shelf slot is sold out.'; this.renderStore(); return; }
    this.mode = 'buy'; this.renderStore();
  }
  private openSell(): void {
    if (this.mode !== 'shelves') return;
    this.mode = 'sell'; this.sellSelected = 0; this.detail = undefined; this.renderStore();
  }

  private renderModal(w: number, h: number): void {
    // Opaque pointer shield; dungeon and level HUD are separately paused/asleep.
    this.add.rectangle(0, 0, w, h, 0x000000, 0.8).setOrigin(0).setInteractive();
    const mw = Math.min(w - 16, 460), mh = Math.min(h - 16, 500);
    const x = (w - mw) / 2, y = (h - mh) / 2;
    this.add.rectangle(x, y, mw, mh, 0x221a29).setOrigin(0).setStrokeStyle(2, 0xaa8864).setInteractive();
    if (this.mode === 'sell') {
      this.text(x + 14, y + 12, 'SELL · UNEQUIPPED ITEMS', 23).setColor(GOLD);
      const items = sellableItems(this.context.player!);
      this.sellSelected = Math.max(0, Math.min(this.sellSelected, items.length - 1));
      const cell = (mw - 28) / 5;
      if (!items.length) this.text(x + 14, y + 70, 'You have nothing to sell.', 22);
      items.forEach((item, i) => {
        const cx = x + 14 + i % 5 * cell, cy = y + 50 + Math.floor(i / 5) * cell;
        this.add.rectangle(cx, cy, cell - 4, cell - 4, 0x382d3d).setOrigin(0)
          .setStrokeStyle(i === this.sellSelected ? 2 : 1, i === this.sellSelected ? 0xf0c477 : 0x66566d)
          .setInteractive({ useHandCursor: true }).on('pointerup', () => {
            this.sellSelected = i; this.detail = item; this.mode = 'sell-detail'; this.renderStore();
          });
        this.icon(item, cx + (cell - 4) / 2, cy + (cell - 4) / 2, Math.min(32, cell - 12));
        this.text(cx + 4, cy + cell - 20, `${sellPrice(item)}g`, 14).setColor(GOLD);
        if (item.count > 1) this.text(cx + cell - 8, cy + cell - 8, String(item.count), 16).setOrigin(1);
      });
      const selected = items[this.sellSelected];
      if (selected) this.text(x + 14, y + mh - 100, `${selected.displayName} · ${sellPrice(selected)}g each`, 20, mw - 28);
      this.button(x + 14, y + mh - 54, mw - 28, 'Back [Esc]', () => this.back());
      return;
    }
    const item = this.detail!;
    const buying = this.mode === 'buy';
    this.icon(item, x + 40, y + 40, 42);
    this.text(x + 72, y + 14, item.displayName, 23, mw - 86).setColor(GOLD);
    const description = item.identified
      ? [item.displayDescription, item.strengthDescription(this.context.player!.strength)].filter(Boolean).join('\n')
      : ['You have not identified this item.', item.curseDescription].filter(Boolean).join('\n');
    const desc = this.text(x + 14, y + 80, description, 19, mw - 28);
    // Long descriptions scroll inside the panel instead of covering buttons.
    // Phaser 4 only supports geometry masks in Canvas mode, so the panel window
    // is a crop over the text texture instead: cropY is how far it has scrolled.
    const maxDescHeight = Math.max(30, mh - 254);
    const descWidth = mw - 28;
    let cropY = 0;
    const applyCrop = () => {
      desc.setCrop(0, cropY, descWidth, Math.min(maxDescHeight, desc.height - cropY));
    };
    applyCrop();
    let dragY: number | undefined;
    const scroll = (delta: number) => {
      const maxScroll = Math.max(0, desc.height - maxDescHeight);
      const next = Phaser.Math.Clamp(cropY + delta, 0, maxScroll);
      if (next === cropY) return;
      cropY = next;
      applyCrop();
    };
    this.add.rectangle(x + 14, y + 80, descWidth, maxDescHeight, 0x000000, 0).setOrigin(0).setInteractive()
      .on('wheel', (_p: unknown, _over: unknown, _dx: number, dy: number) => scroll(dy))
      .on('pointerdown', (p: Phaser.Input.Pointer) => { dragY = p.y; })
      .on('pointermove', (p: Phaser.Input.Pointer) => { if (p.isDown && dragY !== undefined) { scroll(dragY - p.y); dragY = p.y; } })
      .on('pointerup', () => { dragY = undefined; });
    const price = buying ? this.context.shop!.stock[this.selected].price : sellPrice(item);
    const reason = buying ? purchaseFailure(this.context.player!, this.context.shop!, this.selected, item) : undefined;
    this.text(x + 14, y + mh - 166, `${price} gold each · Wallet: ${this.context.player!.gold}g`, 22, mw - 28).setColor(GOLD);
    if (reason) this.text(x + 14, y + mh - 140, reason.replace(/-/g, ' '), 18, mw - 28).setColor('#e69898');
    this.button(x + 14, y + mh - 110, buying ? mw - 28 : (mw - 36) / 2,
      buying ? 'Buy [Enter]' : 'Sell 1 [Enter]', () => this.trade(1), !reason);
    if (!buying) this.button(x + mw / 2 + 4, y + mh - 110, (mw - 36) / 2, `Sell all [A]`, () => this.trade(item.count));
    this.button(x + 14, y + mh - 54, mw - 28, 'Back [Esc]', () => this.back());
  }

  private trade(quantity: number): void {
    if (!this.context.storeOpen || !this.detail) return;
    let result: ShopResult;
    if (this.mode === 'buy') result = buyShopItem(this.context.player!, this.context.shop!, this.selected, this.detail);
    else if (this.mode === 'sell-detail') result = sellShopItem(this.context.player!, this.detail, quantity);
    else return;
    if (result.ok) {
      this.message = result.message;
      this.context.messages.unshift(result.message); this.context.messages = this.context.messages.slice(0, 20);
      this.mode = this.mode === 'buy' ? 'shelves' : 'sell'; this.detail = undefined;
      this.context.saveNow?.();
    } else this.message = result.reason.replace(/-/g, ' ');
    this.renderStore();
  }
  private back(): void {
    this.mode = this.mode === 'sell-detail' ? 'sell' : 'shelves'; this.detail = undefined; this.renderStore();
  }
  private leave(): void {
    if (this.mode !== 'shelves' || !this.context.storeOpen) return;
    this.context.saveNow?.();
    this.context.storeOpen = false;
    this.context.player!.inputBuffer = []; this.context.player!.walkPath = [];
    this.scene.wake('ui-scene'); this.scene.resume('scene0'); this.scene.stop();
  }
  private key(event: KeyboardEvent): void {
    if (!this.context.storeOpen || event.repeat) return;
    const key = event.key;
    event.preventDefault();
    if (key === 'Escape') { if (this.mode === 'shelves') this.leave(); else this.back(); return; }
    if (this.mode === 'buy' || this.mode === 'sell-detail') {
      if (key === 'Enter' || (key === '1' && this.mode === 'sell-detail')) this.trade(1);
      if (key === 'a' && this.mode === 'sell-detail') this.trade(this.detail!.count);
      return;
    }
    const directions: Record<string, [number, number]> = { h: [-1, 0], ArrowLeft: [-1, 0],
      l: [1, 0], ArrowRight: [1, 0], k: [0, -1], ArrowUp: [0, -1], j: [0, 1], ArrowDown: [0, 1] };
    if (this.mode === 'sell') {
      const items = sellableItems(this.context.player!);
      const dir = directions[key];
      if (dir) {
        const col = Math.max(0, Math.min(4, this.sellSelected % 5 + dir[0]));
        const row = Math.max(0, Math.min(Math.max(0, Math.ceil(items.length / 5) - 1), Math.floor(this.sellSelected / 5) + dir[1]));
        this.sellSelected = Math.max(0, Math.min(items.length - 1, row * 5 + col)); this.renderStore();
      } else if ((key === 'Enter' || key === ' ') && items[this.sellSelected]) {
        this.detail = items[this.sellSelected]; this.mode = 'sell-detail'; this.renderStore();
      }
      return;
    }
    if (directions[key]) this.select(moveSelection(this.selected, ...directions[key]));
    else if (key === 'Enter' || key === ' ') this.openBuy();
    else if (key === 's') this.openSell();
    else if (key === 'q') this.leave();
  }
}
