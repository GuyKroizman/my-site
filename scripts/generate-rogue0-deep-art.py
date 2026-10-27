"""Original deeper-dungeon pixel art. Run from repo root with Pillow."""
from pathlib import Path
from PIL import Image, ImageDraw

out = Path('public/rogue0')
themes = []

# Sandstone ruins: large worn pavers and staggered, stratified masonry.
floor = Image.new('RGBA', (16, 16), '#392e24')
d = ImageDraw.Draw(floor)
for box, color in [((0, 0, 10, 6), '#65503a'), ((12, 0, 15, 6), '#594631'),
                   ((0, 8, 4, 15), '#5a4834'), ((6, 8, 15, 15), '#614d36')]:
    d.rectangle(box, fill=color)
    x, y, r, b = box
    d.line((x + 1, y, r, y), fill='#766045')
d.line([(6, 0), (5, 2), (6, 3)], fill='#433728')
for p in [(2, 4), (9, 11), (12, 13), (3, 10)]:
    d.point(p, fill='#81694a')
wall = Image.new('RGBA', (16, 16), '#493624')
d = ImageDraw.Draw(wall)
for x, y, width in [(-4, 0, 12), (9, 0, 10), (0, 8, 12), (13, 8, 10)]:
    d.rectangle((x, y, x + width - 2, y + 6), fill='#98764b')
    d.line((x, y, x + width - 2, y), fill='#c1a16c')
    d.line((x + 1, y + 3, x + width - 3, y + 3), fill='#85623e')
    d.line((x, y + 6, x + width - 2, y + 6), fill='#684c30')
d.line([(4, 9), (3, 11), (4, 12), (4, 14)], fill='#57422d')
themes.append(('sandstone', floor, wall))

# Crystal vault: diamond-cut violet paving and faceted mineral walls.
floor = Image.new('RGBA', (16, 16), '#272236')
d = ImageDraw.Draw(floor)
d.polygon([(7, 0), (14, 7), (7, 14), (0, 7)], fill='#463956')
d.line([(0, 7), (7, 0), (14, 7)], fill='#5a496c')
d.line([(2, 8), (7, 13), (12, 8)], fill='#382e48')
for x, y in [(0, 0), (15, 0), (0, 15), (15, 15)]:
    d.rectangle((max(0, x - 2), max(0, y - 2), min(15, x + 2), min(15, y + 2)), fill='#393047')
d.point((7, 6), fill='#706085')
wall = Image.new('RGBA', (16, 16), '#302740')
d = ImageDraw.Draw(wall)
for points, color in [([(0, 2), (5, 0), (7, 8), (2, 15), (0, 12)], '#74608e'),
                      ([(5, 0), (10, 0), (12, 6), (7, 8)], '#9881ae'),
                      ([(7, 8), (12, 6), (15, 12), (10, 15), (2, 15)], '#59496e'),
                      ([(12, 0), (15, 0), (15, 10), (12, 6)], '#67547d')]:
    d.polygon(points, fill=color)
d.line([(1, 3), (5, 1), (7, 7)], fill='#b6a0c9')
d.line([(8, 9), (11, 8), (13, 11)], fill='#8d79a7')
themes.append(('crystal', floor, wall))

# Volcanic depths: rough basalt plates and charcoal walls with ember seams.
floor = Image.new('RGBA', (16, 16), '#241f20')
d = ImageDraw.Draw(floor)
for points, color in [([(0, 0), (8, 0), (6, 5), (2, 7), (0, 5)], '#3b3536'),
                      ([(10, 0), (15, 0), (15, 8), (9, 6), (8, 4)], '#443b3b'),
                      ([(0, 9), (5, 7), (9, 10), (7, 15), (0, 15)], '#393334'),
                      ([(11, 8), (15, 10), (15, 15), (9, 15)], '#4a3e3c')]:
    d.polygon(points, fill=color)
d.line([(8, 1), (7, 5), (9, 7)], fill='#79402d')
d.point((7, 5), fill='#a55a30')
wall = Image.new('RGBA', (16, 16), '#231e21')
d = ImageDraw.Draw(wall)
for points, color in [([(0, 0), (7, 0), (6, 7), (0, 5)], '#645557'),
                      ([(9, 0), (15, 0), (15, 6), (10, 8), (8, 5)], '#514449'),
                      ([(0, 8), (5, 9), (8, 15), (0, 15)], '#51454a'),
                      ([(8, 10), (15, 8), (15, 15), (10, 15)], '#70605e')]:
    d.polygon(points, fill=color)
d.line([(0, 0), (6, 0), (5, 5)], fill='#887474')
d.line([(9, 1), (7, 7), (6, 8), (9, 14)], fill='#bb542d')
d.line([(7, 7), (3, 6), (0, 7)], fill='#7f3628')
d.point((7, 7), fill='#ee9950')
themes.append(('volcanic', floor, wall))

preview = Image.new('RGBA', (3 * 128, 80))
for i, (name, floor, wall) in enumerate(themes):
    floor.save(out / f'{name}-floor.png')
    wall.save(out / f'{name}-wall.png')
    atlas = Image.open(out / 'stone-tiles.png').convert('RGBA')
    atlas.paste(floor, (0, 0))
    atlas.paste(wall, (0, 13 * 17))
    atlas.save(out / f'{name}-tiles.png')
    for y in range(5):
        for x in range(8):
            preview.paste(wall if y == 0 or x in (0, 7) else floor, (i * 128 + x * 16, y * 16))
preview.resize((1152, 240), Image.Resampling.NEAREST).save('/tmp/rogue0-deep-preview.png')
