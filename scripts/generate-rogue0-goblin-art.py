"""Generate an original folklore goblin bowman; no franchise artwork (Pillow)."""
from pathlib import Path
from PIL import Image

PALETTE = {
    '.': '#00000000', 'o': '#172327ff',
    'g': '#568440ff', 'G': '#9abc58ff', 'd': '#345533ff',
    'e': '#ffbc57ff', 'f': '#eee0b3ff',
    'l': '#72503aff', 'L': '#b0814cff', 'b': '#422f2cff',
    'w': '#cf9958ff', 's': '#8b9585ff', 'a': '#d5d8bdff',
}
PIXELS = [
    '................',
    '.....ooo........',
    '....oGGgo.......',
    '.o..oGGgdo..o...',
    '.oGoGGGggdoGo...',
    '..oGgeogego.....',
    '...ogGGggdo..w..',
    '....oGggdo...sw.',
    '....ogffo....s.w',
    '.....ooo.....s.w',
    '....oLlbo....s.w',
    '...oGlLllo...s.w',
    '..oGgoLllogGos.w',
    '..ogooLlaaaaaaaw',
    '...o.obLlo...s.w',
    '.....oLLbo...s.w',
    '....olbblo...sw.',
    '....ogoodo...w..',
    '....og..go......',
    '...olb..blo.....',
    '...ooo..ooo.....',
    '................',
]
assert len(PIXELS) == 22 and all(len(row) == 16 for row in PIXELS)
image = Image.new('RGBA', (16, 22))
for y, row in enumerate(PIXELS):
    for x, pixel in enumerate(row):
        image.putpixel((x, y), tuple(bytes.fromhex(PALETTE[pixel][1:])))
path = Path(__file__).resolve().parents[1] / 'public/rogue0/monsters/goblin.png'
path.parent.mkdir(parents=True, exist_ok=True)
image.save(path)
print(path)
