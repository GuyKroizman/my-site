"""Original Rogue0 pixel art; run from the repository root (requires Pillow)."""
from pathlib import Path
from PIL import Image, ImageDraw

out = Path('public/rogue0')
out.mkdir(exist_ok=True)
# Broken, partly buried dungeon flagstones. Earth fills irregular joints;
# low-contrast mottling, no bevels or directional shadows suggesting height.
floor = Image.new('RGBA', (16, 16), '#30312c')
d = ImageDraw.Draw(floor)
for points, color in [
    ([(0, 0), (5, 0), (6, 2), (5, 5), (2, 6), (0, 4)], '#3d403b'),
    ([(8, 0), (14, 0), (15, 2), (13, 5), (9, 6), (7, 3)], '#393d39'),
    ([(2, 8), (5, 7), (9, 8), (10, 11), (7, 14), (3, 13), (1, 10)], '#41433c'),
    ([(12, 8), (15, 7), (15, 14), (11, 15), (10, 13)], '#383c36'),
    ([(0, 13), (1, 14), (5, 15), (0, 15)], '#3b3d36'),
]:
    d.polygon(points, fill=color)
# Embedded grit, damp discoloration and worn chips, kept quiet behind actors.
for x, y, color in [(3, 2, '#46473f'), (4, 4, '#383c35'),
                     (10, 2, '#3e423a'), (11, 3, '#343a32'),
                     (5, 10, '#47483e'), (6, 11, '#3b3f35'),
                     (3, 12, '#373a31'), (13, 10, '#414337'),
                     (0, 7, '#3a382e'), (6, 6, '#403c30'),
                     (8, 15, '#39382d'), (14, 6, '#373c2e')]:
    d.point((x, y), fill=color)
d.line([(9, 0), (9, 1), (10, 2)], fill='#30352f')
d.line([(8, 9), (7, 10), (7, 12)], fill='#33372e')
floor.save(out / 'stone-floor.png')
atlas = Image.open('public/colored.png').convert('RGBA')
atlas.paste(floor, (0, 0))
# Original worn masonry: broad horizontal blocks, recessed mortar, restrained
# green-gray damp staining. Unlike floor stones, wall faces have edge lighting.
wall = Image.new('RGBA', (16, 16), '#303637')
w = ImageDraw.Draw(wall)
for x, y, width, color in [
    (-3, 0, 10, '#727b78'), (8, 0, 9, '#808784'),
    (0, 6, 10, '#626d69'), (11, 6, 8, '#707975'),
    (-5, 12, 10, '#58635e'), (6, 12, 10, '#64706a'),
]:
    w.rectangle((x, y, x + width - 1, y + 4), fill=color)
    w.line((x + 1, y, x + width - 2, y), fill='#929b94' if y == 0 else '#7e8981')
    w.line((x + width - 1, y + 1, x + width - 1, y + 4), fill='#46524c')
    w.line((x, y + 4, x + width - 1, y + 4), fill='#434e49')
# Chips interrupt straight edges; mineral marks and moss stay subtle.
for x, y, color in [(2, 0, '#515e57'), (13, 6, '#444f48'),
                     (7, 12, '#3f4c43'), (4, 2, '#89918a'),
                     (12, 2, '#939a93'), (3, 8, '#748177'),
                     (8, 9, '#56694e'), (14, 14, '#52644c'),
                     (1, 14, '#4b5e46')]:
    w.point((x, y), fill=color)
w.line([(12, 1), (11, 2), (11, 3)], fill='#65716a')
wall.save(out / 'stone-wall.png')
atlas.paste(wall, (0, 13 * 17))
atlas.save(out / 'stone-tiles.png')

# Adult explorer: compact head, broad armored shoulders, long torso/legs,
# stubble, leather harness, gloves and heavy boots. 22px art on a 16px cell.
rows = [
'......oooo......',
'.....ohhhho.....',
'.....ohHHho.....',
'.....osesSo.....',
'.....ossSso.....',
'.....ohshho.....',
'....oohhhoo.....',
'..ooLLbbbbLoo...',
'.oLLLBtBBbLLLo..',
'.oLLBBBtBbBLLo..',
'.okobBBBtBbokoo.',
'.okobBBBbtbokko.',
'.okobBBBbtbokko.',
'.okootttttoooko.',
'..ooottLtttoo...',
'....oPPPPPoo....',
'....oPPoPPo.....',
'....oPPoPPo.....',
'....oPPoPPo.....',
'....okko kko....'.replace(' ', 'o'),
'...okkkookkko...',
'...oooooooooo...',
]
palette = {'.': (0, 0, 0, 0), 'o': '#20232a', 'h': '#694d3d', 'H': '#a27b52',
           's': '#c99770', 'S': '#edc59a', 'e': '#252b32', 'B': '#337dae',
           'b': '#28506f', 'L': '#a0b6b9', 't': '#815c38', 'P': '#566373', 'k': '#72513a'}
hero = Image.new('RGBA', (16, len(rows)))
p = ImageDraw.Draw(hero)
for y, row in enumerate(rows):
    assert len(row) == 16
    for x, c in enumerate(row):
        p.point((x, y), fill=palette[c])
hero.save(out / 'hero-color.png')
# Tall, sparse blades: 24px artwork anchored by its roots to a 16px cell.
# Transparent gaps let the wall/floor behind the leaves remain visible.
for variant in range(3):
    grass = Image.new('RGBA', (16, 24))
    g = ImageDraw.Draw(grass)
    for i, (root, tip, height) in enumerate([(2, 0, 19), (5, 3, 24), (8, 10, 17), (11, 13, 22), (14, 15, 15)]):
        tip = max(0, min(15, tip + (variant - 1) * (1 if i % 2 else -1)))
        top = 24 - height + (variant if i % 2 else 0)
        bend = (root + tip) // 2
        g.line([(root, 23), (root, 16), (bend, 9), (tip, top)], fill='#29472e', width=2)
        g.line([(root, 22), (root, 16), (bend, 9), (tip, top)], fill=['#54843b', '#6a9946', '#416b35'][i % 3], width=1)
        leaf = max(0, min(15, root + (3 if i % 2 else -3)))
        g.line([(root, 18), (leaf, 13), (leaf, 10 + variant)], fill='#608a3e', width=1)
    grass.save(out / f'tall-grass-{variant}.png')
# Preview uses the actual exported assets, not a separate illustration.
preview = Image.new('RGBA', (80, 48))
for y in range(0, 48, 16):
    for x in range(0, 80, 16):
        preview.paste(floor, (x, y))
preview.alpha_composite(hero, (32, 32 - hero.height))
preview.resize((640, 384), Image.Resampling.NEAREST).save('/tmp/rogue0-world-art-preview.png')
# Show the actual leaf overlap against an atlas wall, with roots on floor.
wall = atlas.crop((0, 13 * 17, 16, 13 * 17 + 16))
for x in range(0, 80, 16):
    preview.paste(wall, (x, 0))
    if x != 32:
        preview.alpha_composite(Image.open(out / f'tall-grass-{(x // 16) % 3}.png'), (x, 8))
preview.alpha_composite(hero, (32, 32 - hero.height))
preview.resize((640, 384), Image.Resampling.NEAREST).save('/tmp/rogue0-grass-preview.png')
