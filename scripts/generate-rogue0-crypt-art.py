"""Original blue-slate crypt tiles for floors 5–10. Run from repo root with Pillow."""
from pathlib import Path
from PIL import Image, ImageDraw

out = Path('public/rogue0')
floor = Image.new('RGBA', (16, 16), '#202936')
d = ImageDraw.Draw(floor)
# Cut square slate slabs, contrasting with the early floors' irregular rubble.
for x, y, color in [(0, 0, '#354555'), (8, 0, '#304050'),
                     (0, 8, '#2e3d4d'), (8, 8, '#394959')]:
    d.rectangle((x, y, x + 6, y + 6), fill=color)
    d.line((x, y, x + 6, y), fill='#445566')
    d.point((x + 3, y + 4), fill='#405161')
d.line([(10, 8), (11, 10), (10, 12)], fill='#263440')
floor.save(out / 'crypt-floor.png')
wall = Image.new('RGBA', (16, 16), '#1c2635')
d = ImageDraw.Draw(wall)
# Tall dressed blocks with frosty bevels and a narrow brass inlay.
for x, y, color in [(0, -4, '#52657b'), (8, 0, '#60738a'),
                     (0, 8, '#4b6077'), (8, 12, '#566980')]:
    d.rectangle((x, y, x + 6, y + 10), fill=color)
    d.line((x, y, x + 6, y), fill='#94a9ba')
    d.line((x, y + 1, x, y + 9), fill='#788da2')
    d.line((x + 6, y + 1, x + 6, y + 10), fill='#35465d')
d.line((0, 6, 15, 6), fill='#a58a55')
d.line((0, 7, 15, 7), fill='#574b35')
d.point((11, 3), fill='#8ba0b4')
wall.save(out / 'crypt-wall.png')
# Keep the existing atlas layout/indices, including one-pixel spacing.
atlas = Image.open(out / 'stone-tiles.png').convert('RGBA')
atlas.paste(floor, (0, 0))
atlas.paste(wall, (0, 13 * 17))
atlas.save(out / 'crypt-tiles.png')
preview = Image.new('RGBA', (128, 80))
for y in range(5):
    for x in range(8):
        preview.paste(wall if y == 0 or x in (0, 7) else floor, (x * 16, y * 16))
preview.resize((768, 480), Image.Resampling.NEAREST).save('/tmp/rogue0-crypt-preview.png')
