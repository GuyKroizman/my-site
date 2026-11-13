# rogue0 — Floor-6 Store (design + implementation plan)

Status: **implemented v1** (portal door, store scene, buy/sell, persistent
stock, save round-trip). Manual and headless checks are listed below; touch /
small-screen playtesting and gold tuning are still open.

Art: `src/games/rogue0/assets/shop.png` (600 × 338, confirmed). It is loaded
once, during `scene0.preload`, so the store opens without a loading pause.

Goal: fix the run's biggest open gap — gold has no sink — with one authored
store on floor 6. The store is a separate full-screen scene, not a dungeon
room: a strange free-standing door in the middle of a floor-6 room opens onto a
portal, and a shop UI built on `shop.png` replaces the level.

---

## 0. Implementation notes (v1)

Landed files:

- `store/storeLayout.ts`, `shopPricing.ts`, `shopStock.ts`, `shopModel.ts`,
  `shopItems.ts`, `StoreScene.ts`, `store/portal.ts`
- `portalVisuals.ts`
- Portal/dungeon wiring in `tiles.ts`, `terrain.ts`, `scene0.ts`,
  `heroNavigation.ts`, `heroInput.ts`, `context.ts`, `dungeon` integration is
  local to `scene0.tryStoreDoor`.
- Save integration in `runPersistence.ts` and `scene0.autosave`.
- Tests: `test-rogue0-store-layout`, `test-rogue0-shop-pricing`,
  `test-rogue0-shop-stock`, `test-rogue0-shop-transactions`,
  `test-rogue0-store-glyph`, `test-rogue0-portal`; chained as
  `npm run test:rogue0:store` and included in `npm run test:rogue0`.

Verified so far:

- Floor 6 always places one free-standing portal door in an open room; floors
  5/7 do not.
- Closed front/back portal (frames 0/9) → first bump opens it (frames 1–8 or
  10–17) and costs one open-door action → second bump enters; `q`/Leave resumes
  exactly. The hero can walk behind the door and sees the back panel.
- Buy and sell update gold/backpack/stock; selling does not identify; cursed
  items pay half.
- Arrow keys, mouse clicks, Buy/Sell modals and the Store's own toolbar work;
  the level HUD is absent.
- Reload while on floor 6 restores the sold stock, backpack, gold and the open
  door state.
- `npm run test:rogue0`, `npm run test:rogue0:store` and `npm run build` pass.
- Headless Chromium checks covered walking around and behind the free-standing
  door, front/back frames, the two-step bump from behind, enter/leave,
  buy/sell, keyboard navigation, mouse click, HP/hunger freeze during the
  store, and save/reload.

Not yet verified: real touch gestures, 360 × 640 portrait layout, a live gold
economy playtest, and the final production-site visual pass.

---

## 1. Goals / non-goals

**Goals**

- One portal, on floor 6 only, that only the hero can use.
- A store that looks and behaves differently from a dungeon level.
- 15 shelf slots aligned to the art: 5 items on each of three shelves.
- Buy and sell, with a real price curve, using the gold the run already drops.
- Browse with `hjkl`, arrow keys, mouse and touch.
- Item modal: image, description, price, Buy.
- Sell modal listing every **non-equipped** backpack item.
- No healing and no damage while inside. Leaving resumes the run exactly where
  it stopped.

**Non-goals for this phase**

- No restock/reputation/haggling/shopkeeper dialogue.
- No Ankh, no new item classes. (Ankh remains a separate roadmap item.)
- No buying pre-equipped, no selling equipped items, no using/equipping inside.
- No shops on other floors, no second currency, no stock refresh exploit.
- No portal on boss floors; floor 5 is the first boss arena and stays as-is.

---

## 2. Player flow

1. Hero reaches floor 6 and explores until the strange door is in sight.
2. Moving into the closed door opens it: the ornate door swings back and a
   swirling portal animation fills the open frame. This costs one action, like
   an ordinary door. The log says what happened.
3. Moving into the open doorway again enters the store. The hero never stands
   on the door tile — it stands free in the room, and the hero can walk around
   and stand behind it to see the back panel.
4. The dungeon scene pauses, the level HUD sleeps, and the store scene opens
   with a short fade.
5. Grid selection starts on the first shelf slot. `hjkl`/arrows move, `Enter`
   opens the selected item, mouse hover highlights, click/tap opens.
6. Buy modal shows the item, its description, price, and a Buy button (with
   the exact reason when disabled: sold out / not enough gold / backpack full).
7. **Sell** opens the backpack list (non-equipped only); select an item, then
   sell one or the whole stack.
8. **Leave** (button, `Esc`, or `q`) returns to the dungeon in front of the
   still-open portal. Moving into it again re-enters the store; stock does not
   refresh.

Entry is a two-step bump interaction, never automatic on step-on. The hero
never shares a tile with the portal, so there is no “standing on it” state and
no immediate re-entry after a reload.

---

## 3. World integration: the floor-6 portal

### 3.1 Placement

- `SHOP_FLOOR = 6` lives in `store/shopStock.ts`; `placeStorePortal` checks it
  and no gameplay/Phaser import is involved.
- The portal is a **free-standing door in an open room tile**, facing the
  viewer (south). The hero can walk around it and stand behind it.
- `scene0.setupFloor` places exactly one `portal` feature on floor 6, using the
  completed map and the existing feature overlay:
  - choose a reachable floor tile with a **clear 3×3 ring** of floor and no
    other features (so the hero can walk behind and around it);
  - prefer the open centre of a room (largest 5×5 open score), not a corridor;
  - avoid the spawn, stairs and upstairs tiles, and stay at least 10 tiles from
    the spawn when possible;
  - the map tile stays floor (`0`); the portal feature makes it non-walkable
    for occupancy/pathfinding, so actors route around it;
  - if no full 3×3 area exists, fall back to a tile whose four cardinal
    neighbours are clear, still guaranteeing a front and a back tile.
- Push it into `features`; return `{ x, y, approachX, approachY }` with the
  approach directly south (front).
- `context.portal` is set from the feature list in `setupFloor` (so restored
  floors work too). The path grid is updated to make the door tile unwalkable
  on fresh floors, where it was built before the feature was placed.

### 3.2 Rendering

- `tiles.ts`: add `"portal"` to `TerrainFeature` plus a state field
  `portal?: "closed" | "open"` on `TileState`/`FeaturePlacement`. The feature is
  non-walkable; the map tile remains floor.
- New `portalVisuals.ts` generates a free-standing door unlike the ordinary
  wooden door:
  - **closed front:** a carved stone/dark-metal door with a violet sigil;
  - **closed back:** a plain darker panel with a handle;
  - **open front/back:** the door panels are drawn back and the frame contains
    an 8-frame vortex (stone frame, teal/violet spiral); frames advance in
    `scene0.update` while visible.
- Register the textures in `scene0.create()`. In `featureVisual()` and the
  portal update, choose the front frame when the hero is south of the door and
  the back frame when the hero is north (`player.y < portal.y`).
  `syncFeatures` treats it as upright (`actorOriginY`, feet-anchored, terrain
  depth), so the door occludes a hero behind it and the hero occludes it from
  the front. No wall decal is involved because the tile is floor.
- Inspect text:
  - closed: “A strange door. It is unlike the others in this dungeon.”
  - open: “An open doorway with a swirling portal inside. Only you can pass
    through it. Move into it to enter the store.”
- `checkPortal` gives a one-time hint when the hero is adjacent, mirroring
  `checkStairs`/`stairsHinted`: “A strange door stands here. Move into it to
  open it.” After opening: “The doorway swirls with another place. Move into it
  to enter the store.”

### 3.3 Entry / exit

Scene 0 owns the transition; the store never touches `turnManager`.

The interaction is implemented by `scene0.tryStoreDoor`, wired to
`context.onPortalBump` and called from `heroNavigation.stepManually` before
`dungeon.openDoor`. Walking into the portal and tapping it both take the same
path:

```ts
if (context.onPortalBump?.(newX, newY)) return;
```

- `tryStoreDoor` handles:
  - closed: set `portal: 'open'`, sync features, log “The strange door opens,
    revealing a swirling portal.”, `spendTurn('openDoor')`;
  - open: generate/restore `context.shop`, save, sleep the HUD, launch the
    store, pause scene 0;
  - invalid: return `true` so the bump is consumed without moving.
- First bump opens the door and costs a normal open-door action. Monsters get
  their turns as usual.
- Second bump enters: `context.onEnterStore` is wired by scene 0. The store
  opens without spending a turn because no world action occurs.
- Tapping the portal while adjacent routes to the same bump direction, so
  touch and mouse follow the identical two-step flow. In `heroInput`, check
  `context.portalX/portalY` before the generic `setWalkTarget` path and call
  `hero.stepManually(sign(dx), sign(dy))` when the tap is adjacent.
- The first bump is an ordinary door action; the second is a UI transition,
  not a world action. This keeps the turn timeline clean and means opening the
  store can never damage, heal, hunger or advance the clock.

```ts
// enter (validate: floor 6, portal open, hero adjacent, no modal,
// canAct, nothing moving, no pending trap arrows)
ensureShopState(context);          // generate + persist stock
context.saveNow?.();               // checkpoint position + stock first
this.scene.launch('store-scene');
this.scene.bringToTop('store-scene');
this.scene.sleep('ui-scene');      // sleeping scenes do not render
this.scene.pause();                // freezes world update, effects, scheduler
```

```ts
// exit (from StoreScene)
this.scene.wake('ui-scene');
this.scene.bringToTop('ui-scene');
this.scene.resume('scene0');
this.context.saveNow?.();
this.scene.stop();                 // stop itself last
```

- On exit the hero is still on the approach tile; the door remains open. A
  deliberate extra bump re-enters, so a reload cannot loop into the store.
- `context.storeOpen` is set on create/cleared on shutdown so:
  - `isModalOpen()` also returns true while the store is open (defensive even
    though scene 0 is paused);
  - the React host can hide the DOM menu button during the store via
    `context.onStoreOpenChange` (optional polish).
- `player.inputBuffer` and `walkPath` are cleared before pausing, as the
  inventory modal already does.

### 3.4 “Only the hero can enter”

- The door occupies a floor tile but blocks occupancy, so no actor can stand on
  it. Actors can walk around and behind it; monsters cannot open or enter it.
- Only the hero's bump handler calls `tryStoreDoor`; it checks `context.player`,
  adjacency to the portal and floor 6.
- If a monster stands on the front or back tile, the hero must deal with it
  first; the clear 3×3 ring keeps the door reachable from other sides.
- Sleeping scene 0 means nothing can follow the hero inside. On return the
  floor is exactly as frozen.

### 3.5 Save compatibility

- The portal is part of the floor's `features` snapshot, including its
  closed/open state, so it round-trips with normal floor saves automatically.
- Old saves restored on floor 6 with no portal, or with the earlier wall-door
  version: `placeStorePortal` removes an invalid wall portal and adds a
  free-standing room door, preserving the old open state. `setupFloor` restores
  the feature snapshot and updates the path grid; autosave follows. Floors
  below are unaffected.
- `context.shop` is written in the autosave root (see §11); saves without it
  load unchanged and generate stock on first entry.

---

## 4. Store scene

### 4.1 Scene stack

`StoreScene` is registered in `config.ts` with `active: false`:

```ts
scene: [new Scene0(context), new StoreScene(context)]
// constructor: super({ key: 'store-scene', active: false })
```

`shop.png` and every item texture are already global when it launches. It has
its own camera, dark letterbox background, and never builds a tilemap, FOV,
hero or monsters.

### 4.2 Shelf geometry (art coordinates)

| shelf | item band (y) | board below |
|------:|:-------------:|:-----------:|
| 1 | 13 – 66 | 66 – 80 |
| 2 | 81 – 130 | 130 – 143 |
| 3 | 144 – 195 | 195 – 208 |

- Items span `x = 46 … 552` (506 px), split into **5 columns of 101.2 px**.
- Slot index is row-major: `index = row * 5 + col`.
  - `x0 = 46 + col * 101.2`, `x1 = x0 + 101.2`
  - `y0/y1` from the table.
- Interactive hit area: cell inset by 6 px horizontally and 4 px vertically
  (≈ 89 × 45 px), so the whole cell is a comfortable touch target.
- Item icon: 16 × 16 art scaled to fit ~42 × 42 px inside the cell, centred,
  bottom-aligned 3 px above the board. Cap at 3× so pixel art stays crisp.
- Selection: 2 px gold inset frame; hover selects the slot. Sold-out slot:
  empty peg + small “SOLD”.
- Price is shown in the item modal and in the toolbar message; the shelves
  stay free of permanent price clutter. The modal is the source of truth.

```
  46                         552
  ┌──[1]──[2]──[3]──[4]──[5]──┐  y 13..66
  ╞═══════════════════════════╡  66..80
  ┌──[6]──[7]──[8]──[9]──[10]─┐  81..130
  ╞═══════════════════════════╡  130..143
  ┌──[11]─[12]─[13]─[14]─[15]─┐ 144..195
  ╞═══════════════════════════╡  195..208
  │       [Sell] [123g] [Leave]│  counter
  └───────────────────────────┘
```

### 4.3 Responsive layout

Keep all math in a pure `storeLayout.ts` so it is testable without Phaser.

- Landscape (view aspect ≥ 1.2): scale to fill the viewport height, capped at
  ~3.2×; centre the art; toolbar overlays the red counter.
- Portrait / square (view aspect < 1.2): scale to fit the width (cap ~1.4×);
  place the art in the top portion and put the toolbar in the letterbox below.
- Recompute on `scale.on('resize')`; keep selection and the open modal.
- Modals are built in **screen space** (like `InventoryWindow`) so their text
  does not shrink with the background.
- Minimum target size is 44 CSS px; `360 × 640` portrait is the smallest
  supported layout and must be checked by hand.

Pure API:

```ts
STORE_ART = { width: 600, height: 338 };
shelfSlots(): Rect[15];                 // art coordinates
storeLayout(viewW, viewH): {
  scale, offsetX, offsetY, mode: 'overlay' | 'stacked'
};
artToScreen(rect, layout): Rect;
screenToArt(x, y, layout): { x, y };
slotAt(artX, artY): number | undefined;
moveSelection(index, dx, dy): number;   // clamps at 5 × 3 edges
```

Use one scaled container for the background, slots and shelf highlights;
Phaser transforms child hit areas automatically. Toolbar and modals are
screen-space siblings above it.

The store is a self-contained UI. The level HUD scene is asleep, so **sleep,
inspect/search, the hero modal, the log window, quickslots and the inventory
hotkeys do not exist inside the store**. Only the store's own controls below
are active; there is no use/equip action here.

### 4.4 Controls

| Input | Action |
|---|---|
| `h` / `←` | previous column (clamped) |
| `l` / `→` | next column (clamped) |
| `k` / `↑` | row above (clamped) |
| `j` / `↓` | row below (clamped) |
| `Enter` / `Space` | open selected item modal |
| `s` | open sell modal |
| `Esc` | close modal; if none, leave the store |
| `q` | leave the store |
| mouse hover | highlight slot |
| click / tap slot | open item modal |
| click / tap Sell | sell modal |
| click / tap Leave | leave |

Modals:

- Buy modal: `Enter` = Buy, `Esc` = close. The Buy button is not
  keyboard-focused by default, so a repeated Enter after opening cannot buy by
  accident.
- Sell modal: grid navigation with the same keys; `Enter` opens/selects an
  item; then `1` = sell one, `a` = sell all, `Esc` = back to the grid.
- Only one modal exists at a time; input routes to the top layer first.

### 4.5 HUD / flavour

- Bottom counter: `Sell` button, gold readout (`◈ 123g`), `Leave` button.
- A one-line message strip for “Bought …”, “Sold … for 12g”, “Backpack full”.
  Also mirror the message into `context.messages` (via `dungeon.log`) so it
  appears in the dungeon log after leaving.
- Small “Safe: time is paused” note. The hero's HP/hunger/status bars are not
  shown, because none of them can change here.

---

## 5. Stock

### 5.1 Slot plan (floor 6, tier 2 band)

**All 15 slots are random for now.** The shelves keep their themes so the shop
still reads as consumables / tools / gear, but no slot is guaranteed. A later
pass can add guaranteed slots (e.g. one Healing potion and one Identify
scroll) without changing the stock format.

| row | slots | pool |
|---|---|---|
| 1 | 0–4 | consumables: potions, scrolls, rations |
| 2 | 5–9 | tools: wands, rings, glyph stones (including the rare Stone of Infusion), potions/scrolls |
| 3 | 10–14 | gear: tier-2 weapons, armor, rings, occasional artifact |

- All 15 slots are filled from their row pool (weighted; cheap items more
  likely than artifacts).
- Stock is **identified and uncursed**, level 0, fully charged wands. A shop
  should be trustworthy.
- No gold, chests, remains, gems-as-junk or starting gear.
- Random picks are rolled once and persisted; the player cannot reroll by
  leaving and re-entering.
- `floorProgression(6).tier === 2`; do not invent a floor-6-only tier.
- **Future:** `planShopStock` will accept an optional `guarantees` list
  (slot → kind) so specific items can be pinned later. Keep the signature
  backward-compatible now, but do not implement guarantees yet.

### 5.2 Testable split

```ts
// pure, no Phaser
planShopStock(floor, random): StockSlot[];     // length 15, row-major
// runtime side
ensureShopState(context): ShopState;           // shopItems.ts, idempotent
```

`StockSlot` is a descriptor (`kind`, `tier`, `level`, `count`), so the plan can
be unit-tested without constructing items.

### 5.3 Persistence

Stock lives in `context.shop` and is written into the run save. Sold slots stay
sold for the rest of the run. A new run starts a new shop.

---

## 6. Pricing

All math lives in a pure `shopPricing.ts` with no Phaser import.

```ts
buyPrice(item)  = roundTo5(baseValue(item) * 1.5)   // min 5
sellPrice(item) = max(1, floor(baseValue(item) * 0.4))
```

- Equipment base: `categoryBase * tier + 8 * level`.
- Wands base: `34 * tier + 3 * charges`.
- Stacks are priced per unit.
- Cursed items sell for 50 % (the shopkeeper takes the risk).
- Unidentified items can be sold at the normal formula price, but **selling
  never identifies them** and never touches the knowledge log. The shopkeeper
  knows what the item is; the player does not get a free identification. There
  is deliberately no blind-price table and no reveal message.
- Buy price is always strictly greater than sell price, so buy-back loops
  cannot generate gold.

Starter table (tuned low; the economy is deliberately tight):

| category | base | notes |
|---|---:|---|
| Ration | 8 | buy 10, sell 3 |
| common potion | 15 | Healing 18, Strength 30, Experience 45 |
| common scroll | 18 | Identify 20, Remove Curse 26, Upgrade 38 |
| glyph stone | 18 | Blink, Detect Curse |
| Stone of Infusion | 60 | rare charm; buy 90 / sell 24 |
| wand | 34 × tier | +3 per charge |
| weapon / armor | 26 × tier | +8 per upgrade |
| ring | 30 × tier | +8 per upgrade |
| artifact | 80 | keep rare; 10 % roll on slot 14 |

Examples (tier 2): Shortsword = 52 → buy 80 / sell 20; Leather Armor = 52 →
80 / 20; Ring = 60 → buy 90 / sell 24; Wand of Frost (3 charges) = 77 → buy
115 / sell 30; Scroll of Upgrade = 38 → buy 55 / sell 15.

The Stone of Infusion is stocked in row 2 at one third the weight of each
ordinary glyph stone. It is a normal consumable: buying it spends gold and
stock but no turn. Using it then opens the usual "choose weapon or armor"
targeting flow and engraves a random glyph. See `equipmentGlyphs.ts`.

Gold is currently sparse (default monster drop 3 g at ~25 %; chests add a
little). The shop's main input is therefore **selling unused loot**, which is
intended. If playtesting shows the player can never afford anything, raise gold
drops or chest gold — do not make the shop cheaper by default.

---

## 7. Buy flow

1. Open the modal for the selected slot (closed if `sold` or no item).
2. Modal shows icon, name, tier/level/charges, description, curse warning
   (shop stock is uncursed, so normally absent), price, and gold after purchase.
3. Buy checks, in order:
   - slot still has stock;
   - `not enough gold`;
   - would the purchase stack into an existing backpack stack? (`canStackItems`)
     otherwise `backpack.length < capacity`;
4. On success:
   - deduct gold;
   - take one unit:
     - stack: `splitStackItem`, decrement stock count, keep slot until 0;
     - single: transfer the stock item and clear `slot.item`, `slot.sold = true`;
   - `player.addItem(purchased)` (it pushes into `context.entities` and the
     backpack; no turn is spent);
   - log “You buy X for Ng.”;
   - update gold and the slot; `context.saveNow?.()`;
   - if `addItem` unexpectedly fails, refund gold and restore the stock slot.
5. Buying never equips, uses, heals or spends world time.

## 8. Sell flow

1. Sell button (or `s`) opens a modal listing **every non-equipped item in the
   backpack** (normally the whole backpack). Equipped items are never listed.
2. Each cell: icon, stack count, name, unit sell price. Selecting shows the
   detail panel with “Sell 1” and “Sell all” buttons.
3. Sell checks: item still in the backpack, not equipped (`slotOf === undefined`),
   not a container, not a gold pile.
4. On success:
   - `player.gold += sellPrice * qty`;
   - remove `qty` from the bag (whole stack or one unit);
   - remove the sold entity from `context.entities`, clear quickslot references
     (the lazy `quickslotItem` cleanup also handles this), clear item UI;
   - leave `identified`, curse knowledge and the consumable knowledge log
     untouched: selling is not an appraisal;
   - log “You sell X for Ng.”;
   - update the list and gold; `context.saveNow?.()`;
   - empty list → “You have nothing to sell.”
5. Selling never drops anything on the floor and never spends time.

---

## 9. Rules / edge cases

| Situation | Behaviour |
|---|---|
| First bump into the closed portal | Opens the door, reveals the portal animation, costs one open-door action |
| Bump into the open portal | Enters the store; no turn spent |
| Hero stands next to the portal | Door remains open; moving into it again re-enters |
| Monster next to / on the approach tile | Monsters cannot open or enter; the hero must deal with it first |
| Hero opens the store while poisoned/burning/frozen | Effects pause; they resume unchanged on exit |
| Hero has 0 gold | Store opens; Buy buttons show “Need Ng” |
| Backpack full | Buying a non-stackable item is blocked with the reason; selling still works |
| Item is a stack | Buy one unit at a time; sell one or all |
| Item is unidentified | Can be sold; it stays unidentified and the knowledge log is unchanged |
| Item is cursed | Can be sold (only if not equipped); half price |
| Item is equipped | Not listed for sale |
| Leave and re-enter | Same stock, sold slots stay sold; the door stays open |
| Reload while in store | Run restores in front of the portal; store is closed; door state and stock are intact |
| Reload on an old save without `shop` | Stock generated on first entry and saved |
| Save from before portals / wall-door saves | Portal migrated to a floor-6 room tile, preserving its open state |
| Level HUD inside the store | None: sleep/inspect/search/hero modal/log/quickslots are unavailable; no use/equip |
| Window resized / orientation change | Store re-lays out; selection and modal survive |
| Hero quits to the start screen from the store | `saveNow` flushes first; buy/sell history is already saved |

---

## 10. Time, damage and healing freeze

Entering the store calls `scene0.scene.pause()`. This stops:

- `TurnManager.update` (monster turns, hero turns),
- hunger/regeneration (`refresh()` runs only from the scheduler),
- status-effect ticks (`tickEffects`) and gas/terrain events,
- animations/tweens in scene 0 (frozen frame behind the store),
- hero input (scene paused),
- the entire level HUD (UI scene asleep), so sleep/inspect/search/hero modal,
  log history, quickslots and inventory hotkeys are gone while shopping.

Store actions are plain mutations of gold/backpack/stock and never call
`spendTurn`, `useItem`, heal or damage. Therefore HP, hunger, effect phases and
`simulationTime` are identical before and after. On `resume`, the original
timer phase continues exactly where it stopped — effects do not “catch up”.

This is stricter and simpler than “run the clock but suppress damage”, and it
matches the requirement “will not heal nor take any further damage”.

---

## 11. Data model & persistence

```ts
// context.ts
type ShopStock = {
  item?: Entity;   // absent once the slot is bought out
  price: number;   // per unit, fixed when the stock is generated
  sold: boolean;
};
type ShopState = {
  version: 1;
  floor: number;         // 6
  stock: ShopStock[];    // always 15, row-major
};
type GameContext = {
  shop?: ShopState;
  storeOpen?: boolean;
  onStoreOpenChange?: (open: boolean) => void;
  onEnterStore?: () => void;
  portalX?: number; portalY?: number;
};
```

- `context.shop` is added to the autosave root object in `scene0.autosave` and
  to `RunState` (`runPersistence.ts`) so `decodeRunSave` restores it; stock item
  entities get their `context` reattached by the existing `decodeGraph` hydrate.
- The portal's open/closed state is stored on the feature itself
  (`portal?: 'closed' | 'open'`), so it rides in the normal floor snapshot and
  needs no separate context field. Only the coordinates are exposed as
  `context.portalX/portalY` for adjacency checks and hints.
- `storeOpen` is runtime-only and never serialized.
- If a loaded `shop` has the wrong version/floor or not exactly 15 stock
  entries, discard it and regenerate on the next entry (do not fail the save).
- `saveFloor()` excludes carried items; shop stock is carried by the save root,
  not by the floor snapshot.
- Old autosave graphs are unaffected: the new root key is optional and
  `encodeGraph` handles `undefined`.

---

## 12. Code changes

### New files

| File | Purpose |
|---|---|
| `store/storeLayout.ts` | art constants, 15 slot rects, responsive layout, inverse hit-test, 5 × 3 navigation (pure) |
| `store/shopPricing.ts` | category/override table, buy/sell formulas, stack/cursed modifiers (pure) |
| `store/shopStock.ts` | `planShopStock` (pure descriptors), row pools, `SHOP_FLOOR` |
| `store/shopItems.ts` | `ensureShopState`: constructs/fills the persisted stock from the registry (browser-only) |
| `store/portal.ts` | random free-standing room-door placement, existing-portal lookup and old wall-door migration (pure) |
| `store/shopModel.ts` | `ShopState` helpers and buy/sell transaction results (no Phaser) |
| `store/StoreScene.ts` | Phaser scene: background, shelves, selection, toolbar, modals, input, layout |
| `portalVisuals.ts` | closed/open door art (front + side), 4-frame portal vortex, glow, and `portalPassage` orientation helper |
| `STORE.md` | this document |

### Modified files

| File | Change |
|---|---|
| `tiles.ts` | `portal` feature + `portal: 'closed' \| 'open'` state + inspect label/description |
| `terrain.ts` | `setFeature` accepts portal state; portal is blocking |
| `heroNavigation.ts` | bump hook before `openDoor` |
| `heroInput.ts` | tap an adjacent portal / walk to its approach |
| `scene0.ts` | load `shop.png`, generate the portal atlas, `featureVisual`/`syncFeatures` front/back closed/open frames, frame animation, room placement, path-grid update, adjacency hint, `tryStoreDoor`, entry/exit + pause, old-save migration, autosave `shop` |
| `ui.ts` | HUD hotkeys are ignored while `storeOpen` |
| `context.ts` | `shop`, `storeOpen`, `onStoreOpenChange`, `portalX/Y`, `onEnterStore`; `isModalOpen` includes store |
| `runPersistence.ts` | `RunState.shop` and restore |
| `Rogue0.tsx` | hide the DOM menu button while `storeOpen` |
| `package.json` | `test:rogue0:store` + per-suite scripts, chained into `test:rogue0` |
| `PLAN.md` | priority 1 points at this design and records v1 |

No change to item classes: pricing reads existing fields
(`equipSlot`, `textureKey`, `name`, `tier`, `level`, `charges`, `count`,
`cursed`). Selling deliberately reads but never writes `identified`.

---

## 13. Tests

All suites start with `recordTestRun('<name>')` and are added to
`npm run test:rogue0` + a per-suite script, following the existing pattern.

1. **`test-rogue0-store-layout.mjs`**
   - 15 rects, 5 columns × 3 rows, row-major;
   - every rect lies inside the art and inside its shelf band;
   - no overlaps; column widths consistent;
   - `storeLayout` round-trips `artToScreen`/`screenToArt` at 1920×1080,
     1280×720, 800×400 and 360×640;
   - `slotAt` hits the correct cell, returns `undefined` on shelf boards;
   - `moveSelection` clamps at all four edges.
2. **`test-rogue0-shop-pricing.mjs`**
   - category/name mapping for potions, scrolls, wands, rings, artifacts,
     tiered gear, rations, stones, gems;
   - tier/level/charge scaling; stack per-unit price;
   - buy = rounded 1.5×, sell = 0.4×, sell < buy for every case;
   - cursed ×0.5; min sell 1; no NaN for unknown junk.
3. **`test-rogue0-shop-stock.mjs`**
   - plan is exactly 15 slots, row-major;
   - every slot comes from its row's legal pool; no guarantees are assumed;
   - only valid kinds, floor-6 tier 2, artifacts only in the rare slot;
   - counts/charges sane; repeated plans never exceed 15 and never repeat a
     unique slot type beyond its pool allowance.
4. **`test-rogue0-shop-transactions.mjs`** (stub entities)
   - buy deducts gold, adds to backpack, stacks when possible, marks sold,
     refuses with poor/backpack-full, count reaches 0 exactly once;
   - sell lists only non-equipped, pays per unit, removes one/all, clears
     quickslot references, refuses equipped/container/gold;
   - selling an unidentified item leaves `identified` false and the knowledge
     log untouched; cursed items pay half;
   - no buy/sell path changes HP, hunger, effects, `spendTurn` or
     `simulationTime`;
   - shop state round-trips through `encodeGraph`/`decodeGraph` with item
     references intact.
5. **`test-rogue0-portal.mjs`**
   - `placeStorePortal` only on floor 6; floors 5, 7, 12 return `undefined`;
   - 20 `generateMap(6)` rolls: exactly one portal feature, on a **floor tile**
     with a clear 3×3 ring, a front tile and a walk-behind tile, and the map
     tile stays `0`;
   - revisits return the existing portal and never append a second one;
   - terrain snapshot/restore keeps `portal: 'open' | 'closed'`;
   - front/back frame mapping: closed 0/9, open 1–8/10–17;
   - an old wall-mounted portal is replaced by a room door and keeps its open
     state;
   - `isModalOpen({storeOpen:true})` is true.
   - The first bump (open-door turn) and second bump (enter) are verified
     manually in the browser; they need the scene's turn manager.
6. **Shop graph round-trip** is covered inside
   `test-rogue0-shop-transactions.mjs` (stock depletion + shared backpack
   references); a live reload was also checked manually.

Manual checklist (the headless suites cannot cover visuals): first bump opens
the door and the vortex animates, second bump enters, door stays open on exit,
frozen HP/hunger/effect timers, no damage with poison/burning active, every
slot aligned to the shelves, mouse hover, touch taps, portrait 360×640, modal
disabled states, reload while shopping, buy→sell gold math.

---

## 14. Acceptance criteria

- [ ] Floor 6 always generates exactly one portal door; no other floor has one.
- [ ] The portal is a free-standing door on a floor-6 room tile, facing south.
      The hero can walk behind it and sees the back panel. First bump opens it
      and reveals the animated vortex; second bump enters. Monsters cannot use
      it.
- [ ] The store uses `shop.png` with 15 items exactly on the three shelves,
      5 per row, and no item overlaps a shelf board.
- [ ] Inside the store there is no level HUD: no sleep, inspect/search, hero
      modal, log window, quickslots, use or equip.
- [ ] `hjkl`, arrows, mouse and touch all navigate; Enter/click/tap opens the
      item modal with image, description, price and Buy.
- [ ] Buy updates gold, backpack and stock; sold slots persist.
- [ ] Sell opens a modal listing only non-equipped backpack items and can sell
      one or a whole stack. Selling never identifies the item; cursed items
      pay half.
- [ ] HP, hunger, status effects and simulation time do not change in the
      store; leaving resumes the exact frozen state.
- [ ] Reload while in the store restores floor 6 in front of the portal with
      the same door state and stock; old saves still load.
- [ ] `npm run test:rogue0` and the production build pass.

---

## 15. Decisions and remaining open questions

Decided in this design review (no longer open):

- Two-step bump entry: first bump opens the door, second enters.
- The portal is a free-standing room door; the hero never occupies its tile
  and can walk behind it.
- Selling never identifies an item.
- Cursed items sell at half price.
- The store has its own UI; the level HUD (sleep/inspect/hero modal/etc.) is
  unavailable, and there is no use/equip inside.
- Stock is for the run's lifetime; sold slots stay sold and never restock.
- Stock contents are fully random for now (row-themed pools); guaranteed items
  are a later addition, not part of this phase.
- The door stays open after leaving; the next bump re-enters.
- Portal placement is random on floor 6, persisted with the floor.
- Everything pauses while shopping, including status-effect expiry.

Still open:

1. **Gold tuning:** prices above assume the current sparse gold and selling
   loot as the main income. If the shop feels unreachable, raise gold drops
   rather than cutting prices — confirm that's the preferred lever.

---

## 16. Suggested implementation order

1. Pure modules + tests: `shopPricing`, `storeLayout`, `shopStock.plan`,
   `shopModel` (no Phaser). This locks the economy and geometry early.
2. Portal: `tiles`/`terrain` feature + state, `store/portal.ts` room
   placement, `portalVisuals`, `heroNavigation` bump + tap,
   `scene0.tryStoreDoor`, render/animations/inspect/hint, entry/exit + pause,
   migration. Test with the scenario harness on floor 6.
3. Store scene read-only: background, shelves, stock, selection, keyboard /
   mouse / touch, gold/Leave toolbar, resize.
4. Buy modal + transactions, then sell modal + transactions; wire
   `saveNow` after each.
5. Save integration: `context.shop`, autosave root, `RunState`, reload test.
6. Polish: animations, message strip, mobile layout, help text, menu-button
   hiding, docs.
7. Run `npm run test:rogue0` and the production build; update `PLAN.md`.
