"""Generate original 16px scroll glyphs; export editable sources with LibreSprite.
Requires Pillow and libresprite on PATH. Run from the repository root.
"""
from pathlib import Path
import subprocess
from tempfile import TemporaryDirectory
from PIL import Image, ImageDraw

OUT = Path('public/rogue0/items')
GLYPHS = {
    'fireball': ['..#..', '.##..', '.#.#.', '#..##', '.###.'],
    'lightning': ['...##', '..##.', '.###.', '..#..', '.#...'],
    'identify': ['.....', '.###.', '#.#.#', '.###.', '.....'],
    'upgrade': ['..#..', '.###.', '#.#.#', '..#..', '..#..'],
    'remove-curse': ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
    'teleport': ['###..', '..#..', '..#..', '..#..', '..###'],
    'rage': ['#.#.#', '#.#.#', '.###.', '..#..', '.#.#.'],
    'terror': ['.###.', '#.#.#', '#####', '.#.#.', '.###.'],
    'recharging': ['..#..', '..#..', '#####', '..#..', '..#..'],
}
with TemporaryDirectory() as temp:
    base = Image.open(OUT / 'scroll.png').convert('RGBA')
    for name, glyph in GLYPHS.items():
        image = base.copy()
        draw = ImageDraw.Draw(image)
        draw.rectangle((5, 5, 9, 9), fill='#efd395')
        for y, row in enumerate(glyph):
            for x, pixel in enumerate(row):
                if pixel == '#':
                    draw.point((5 + x, 5 + y), fill='#67485a')
        source = Path(temp) / f'{name}.png'
        image.save(source)
        editable = OUT / f'scroll-{name}.aseprite'
        subprocess.run(['libresprite', '-b', str(source), '--save-as', str(editable)], check=True)
        subprocess.run(['libresprite', '-b', str(editable), '--save-as', str(OUT / f'scroll-{name}.png')], check=True)
    preview = Image.new('RGBA', (16 * len(GLYPHS), 16), '#242332')
    for i, name in enumerate(GLYPHS):
        sprite = Image.open(OUT / f'scroll-{name}.png').convert('RGBA')
        preview.alpha_composite(sprite, (i * 16, 0))
    preview.resize((16 * len(GLYPHS) * 6, 96), Image.Resampling.NEAREST).save('/tmp/rogue0-scrolls-preview.png')
