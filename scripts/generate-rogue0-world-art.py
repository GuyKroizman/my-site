"""Original Rogue0 pixel art; run from the repository root (requires Pillow)."""
from pathlib import Path
from PIL import Image, ImageDraw

out = Path('public/rogue0')
out.mkdir(exist_ok=True)
# Seamless staggered paving. Quiet cool grays keep actors and loot prominent.
floor = Image.new('RGBA', (16, 16), '#343b3d')
d = ImageDraw.Draw(floor)
for x, y, w, h, color in [(0, 0, 9, 7, '#42494b'), (10, 0, 6, 7, '#3c4447'),
                          (-4, 8, 9, 8, '#394246'), (6, 8, 10, 8, '#454c4d')]:
    d.rectangle((x, y, x+w-1, y+h-1), fill=color)
    # No bevel highlights or side shadows: all stones lie in one plane.
for x, y in [(2, 3), (7, 5), (12, 2), (1, 11), (9, 10), (13, 13)]:
    d.point((x, y), fill='#454d4e')
d.line((11, 9, 12, 10, 12, 12), fill='#343c40')
floor.save(out / 'stone-floor.png')
atlas = Image.open('public/colored.png').convert('RGBA')
atlas.paste(floor, (0, 0))
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
# Preview uses the actual exported assets, not a separate illustration.
preview = Image.new('RGBA', (80, 48))
for y in range(0, 48, 16):
    for x in range(0, 80, 16):
        preview.paste(floor, (x, y))
preview.alpha_composite(hero, (32, 32 - hero.height))
preview.resize((640, 384), Image.Resampling.NEAREST).save('/tmp/rogue0-world-art-preview.png')
