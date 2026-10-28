"""Generate the cultist's original 16x22 transparent pixel-art sprite (Pillow)."""
from pathlib import Path
from PIL import Image

PALETTE = {
    '.': (0, 0, 0, 0),
    'o': '#211b32',  # outline
    'd': '#392744',  # robe shadow
    'p': '#643b78',  # violet cloth
    'h': '#9760a3',  # hood highlights
    'v': '#101c25',  # hidden face
    'g': '#78db94',  # necromantic light
    'G': '#d2ffd1',
    'b': '#a89d87',  # bone staff
    'B': '#e4dcc0',
    's': '#665443',
    't': '#c39b62',  # ritual clasp / hem
}
PIXELS = [
    '................',
    '......oo........',
    '.....ohpo.......',
    '....ohppdo......',
    '...ohppppdo..BB.',
    '...opvvvvpdo.BbB',
    '..ohvvvvvvpo.bvb',
    '..opvGvGvvdo..b.',
    '..odvvvvvvdo..s.',
    '...opvvvpdo...b.',
    '...ohptppdo...s.',
    '..opppBpppdo..b.',
    '.opdppgpppdobBs.',
    '.odpdpppdppobBb.',
    '..opdpppdpdo..s.',
    '...oppppdpo...b.',
    '...ophppdpo...s.',
    '..odphppddpo..b.',
    '..opphppdpdo..s.',
    '.odptptptpdo..b.',
    '.oooo..ooooo..s.',
    '................',
]
assert len(PIXELS) == 22 and all(len(row) == 16 for row in PIXELS)
image = Image.new('RGBA', (16, 22))
for y, row in enumerate(PIXELS):
    for x, pixel in enumerate(row):
        color = PALETTE[pixel]
        if isinstance(color, str):
            color = tuple(bytes.fromhex(color[1:])) + (255,)
        image.putpixel((x, y), color)
path = Path(__file__).resolve().parents[1] / 'public/rogue0/monsters/cultist.png'
path.parent.mkdir(parents=True, exist_ok=True)
image.save(path)
print(path)
