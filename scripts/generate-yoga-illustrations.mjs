// Original geometric pose illustrations for the Yoga Session Builder.
// Run from the repository root: node scripts/generate-yoga-illustrations.mjs
import { mkdirSync, writeFileSync } from 'node:fs'

// Each figure: head center, torso, arms, legs. Optional `hair` (path `d`) and
// `bun` (cx, cy) override the default head hair; Viewbox is 220 × 170.
const figures = {
  mountain: { head: [110, 35], torso: 'M110 55 L110 98', arms: 'M102 59 L92 85 L89 104 M118 59 L128 85 L131 104', legs: 'M105 99 L101 125 L99 148 L88 148 M115 99 L119 125 L121 148 L132 148' },
  'upward-salute': { head: [110, 44], torso: 'M110 63 L110 101', arms: 'M102 64 L88 45 L99 17 M118 64 L132 45 L121 17', legs: 'M105 102 L102 127 L100 148 L91 148 M115 102 L118 127 L120 148 L129 148' },
  chair: { head: [96, 40], torso: 'M90 62 L108 110', arms: 'M84 64 L66 42 L71 14 M96 66 L104 44 L106 15', legs: 'M108 110 L120 128 L112 148 L118 148 M114 112 L127 130 L119 148 L125 148' },
  'forward-fold': { head: [132, 119], torso: 'M96 83 Q125 82 135 103', arms: 'M129 98 L151 121 L149 145 M132 102 L128 128 L126 147', legs: 'M93 84 L90 113 L94 147 L100 147 M99 86 L104 113 L110 147 L116 147', hair: 'M142 118 Q147 132 132 131 Q121 131 121 122 Q131 127 137 116Z', bun: [142, 127] },
  'halfway-lift': { head: [146, 82], torso: 'M96 83 L132 83', arms: 'M124 84 L107 101 L96 115 M130 85 L116 104 L106 119', legs: 'M93 84 L90 113 L94 147 L100 147 M99 86 L104 113 L110 147 L116 147' },
  'wide-legged-forward-fold': { head: [110, 126], torso: 'M110 88 L110 124', arms: 'M104 92 L96 118 L90 145 M116 92 L124 118 L130 145', legs: 'M105 89 L96 114 L46 147 L52 147 M115 89 L124 114 L180 147 L186 147', hair: 'M120 125 Q125 139 110 138 Q99 138 99 129 Q109 134 115 123Z', bun: [120, 134] },
  'downward-dog': { head: [74, 112], torso: 'M88 96 L124 59', arms: 'M89 96 L62 122 L42 147 L29 147 M95 101 L73 127 L56 149 L45 149', legs: 'M124 60 L145 104 L170 147 L181 147 M130 62 L154 101 L186 145 L196 145' },
  plank: { head: [47, 81], torso: 'M65 88 L126 105', arms: 'M68 91 L61 118 L61 149 L49 149 M75 94 L78 120 L79 147 L68 147', legs: 'M126 105 L155 123 L188 145 L187 150 M123 109 L153 131 L176 149 L187 149' },
  chaturanga: { head: [40, 116], torso: 'M58 120 L122 134', arms: 'M62 122 L74 128 L62 147 M68 124 L80 130 L70 147', legs: 'M122 134 L156 138 L190 145 L196 145 M126 134 L160 140 L188 147 L196 147' },
  cobra: { head: [64, 76], torso: 'M76 91 Q83 125 121 140', arms: 'M77 97 L76 145 L68 145 M84 98 L94 147 L86 147', legs: 'M121 140 L153 144 L186 149 L199 149 M117 143 L149 151 L179 151 L190 151', hair: 'M74 77 Q79 63 64 64 Q53 64 53 73 Q63 68 69 79Z', bun: [74, 68] },
  cat: { head: [56, 110], torso: 'M73 96 Q104 64 143 96', arms: 'M73 98 L70 124 L69 148 L56 148 M81 97 L84 122 L84 148 L72 148', legs: 'M142 98 L145 146 L175 147 L187 147 M135 100 L132 150 L164 152 L175 152' },
  cow: { head: [57, 79], torso: 'M73 97 Q105 124 143 96', arms: 'M74 99 L71 125 L69 148 L56 148 M81 101 L84 125 L84 149 L73 149', legs: 'M142 98 L145 146 L175 147 L187 147 M135 103 L132 150 L164 152 L175 152' },
  child: { head: [87, 132], torso: 'M101 125 Q123 98 146 117', arms: 'M103 122 L76 136 L42 143 L29 143 M107 127 L82 147 L49 151 L37 151', legs: 'M146 120 L157 143 L118 149 L165 149 L181 149 M147 125 L157 145 L126 152 L167 153' },
  'warrior-one': { head: [88, 43], torso: 'M91 62 L109 103', arms: 'M86 65 L70 45 L74 15 M99 64 L107 42 L105 14', legs: 'M108 102 L71 111 L67 148 L52 148 M116 105 L143 124 L167 148 L181 148' },
  'warrior-two': { head: [106, 39], torso: 'M108 59 L108 103', arms: 'M101 61 L64 65 L28 62 L19 59 M115 61 L150 64 L184 61 L195 59', legs: 'M104 105 L65 114 L61 147 L45 147 M114 106 L148 127 L175 148 L189 148' },
  triangle: { head: [116, 77], torso: 'M99 87 L126 110', arms: 'M100 89 L76 116 L56 141 M104 84 L120 52 L134 24', legs: 'M125 109 L88 129 L57 148 L43 148 M132 111 L156 129 L180 149 L194 149' },
  tree: { head: [110, 36], torso: 'M110 55 L110 98', arms: 'M101 59 L85 82 L109 73 M119 59 L135 82 L112 73', legs: 'M106 100 L105 125 L103 149 L115 149 M116 100 L140 113 L111 128' },
  boat: { head: [70, 85], torso: 'M78 103 L118 145', arms: 'M76 105 L110 111 L152 111 M80 109 L114 117 L156 117', legs: 'M116 145 L148 121 L176 111 L182 111 M122 145 L154 125 L180 119 L186 119' },
  bridge: { head: [38, 140], torso: 'M56 138 L111 108', arms: 'M60 139 L90 149 L124 149 L135 149 M65 143 L95 154 L126 154', legs: 'M111 109 L146 91 L163 147 L170 147 M114 116 L141 103 L150 151 L159 151', hair: 'M28 139 Q23 153 38 152 Q49 152 49 143 Q39 148 33 137Z', bun: [28, 150] },
  'seated-fold': { head: [131, 107], torso: 'M78 138 Q90 99 116 112', arms: 'M110 115 L137 137 L168 141 M116 118 L145 143 L173 146', legs: 'M81 140 L125 147 L173 147 L178 136 M78 148 L121 154 L173 154 L180 143' },
  'easy-seat': { head: [110, 58], torso: 'M110 77 L110 123', arms: 'M101 82 L85 109 L67 124 M119 82 L135 109 L152 124', legs: 'M104 124 Q64 123 61 140 Q65 150 113 149 L137 147 M116 124 Q153 123 159 140 Q151 156 105 147 L84 144' },
  'seated-reach': { head: [110, 58], torso: 'M110 77 L110 123', arms: 'M101 80 L88 50 L99 22 M119 80 L132 50 L121 22', legs: 'M104 124 Q64 123 61 140 Q65 150 113 149 L137 147 M116 124 Q153 123 159 140 Q151 156 105 147 L84 144' },
  'seated-twist': { head: [108, 50], torso: 'M104 70 L116 118', arms: 'M102 78 L84 104 L70 118 M114 80 L134 104 L148 118', legs: 'M104 121 Q64 123 61 140 Q65 150 113 149 L137 147 M116 121 Q153 123 159 140 Q151 156 105 147 L84 144' },
  butterfly: { head: [110, 54], torso: 'M110 75 L110 119', arms: 'M101 80 L90 107 L106 140 M119 80 L130 107 L114 140', legs: 'M104 121 Q57 115 62 133 L106 150 M116 121 Q163 115 158 133 L114 150' },
  pigeon: { head: [128, 46], torso: 'M112 118 L124 66', arms: 'M116 70 L100 96 L94 142 M126 70 L136 96 L138 142', legs: 'M110 118 L78 122 L40 145 L34 145 M112 118 L146 128 L128 146 L122 146' },
  'legs-up-wall': { head: [38, 132], torso: 'M57 137 L112 137', arms: 'M57 138 L82 150 L108 152 M58 136 L82 124 L108 122', legs: 'M112 137 L113 90 L113 46 L113 38 M120 137 L121 92 L121 48 L121 40', hair: 'M28 131 Q23 145 38 144 Q49 144 49 135 Q39 140 33 129Z', bun: [28, 142] },
  savasana: { head: [38, 132], torso: 'M57 137 L114 137', arms: 'M62 138 L87 152 L118 156 M66 133 L91 121 L119 122', legs: 'M114 134 L151 131 L185 129 L196 124 M114 141 L148 146 L181 151 L194 148', hair: 'M28 131 Q23 145 38 144 Q49 144 49 135 Q39 140 33 129Z', bun: [28, 142] },
  'warrior-three': { head: [150, 70], torso: 'M110 105 L140 72', arms: 'M142 74 L162 78 L178 80 M138 76 L156 84 L170 88', legs: 'M110 105 L112 128 L110 147 L116 147 M110 105 L78 92 L40 82 L34 82' },
  'crescent-lunge': { head: [96, 40], torso: 'M98 62 L112 104', arms: 'M92 64 L76 42 L80 14 M106 64 L116 42 L114 14', legs: 'M110 104 L124 122 L132 147 L138 147 M110 104 L82 146 L56 146 L50 146' },
  'extended-side-angle': { head: [120, 74], torso: 'M100 86 L118 106', arms: 'M100 88 L84 112 L78 134 M120 88 L136 68 L148 52', legs: 'M104 100 L74 112 L62 147 L48 147 M112 102 L142 122 L170 147 L184 147' },
  'half-moon': { head: [176, 75], torso: 'M 155 80 L 106 92', arms: 'M 155 80 L 160 55 L 172 28 M 152 82 L 148 112 L 144 145', legs: 'M 106 92 L 107 118 L 108 140 L 118 144 M 106 92 L 78 90 L 52 89 L 42 88', hair: 'M 165.6 71.4 A 11 11 0 0 0 168.2 82.8 Q 172 76 165.6 71.4 Z', bun: [166, 67] },
  eagle: { head: [118, 35], torso: 'M117 47 C114 60 112 78 110 96', arms: 'M114 49 L110 63 L124 68 M119 50 L129 64 L112 69', legs: 'M109 96 L107 118 L109 141 L117 145 M114 96 L135 113 L114 130 L106 131', hair: 'M113.4 45 A11 11 0 0 1 113.4 25 Q114.5 35 113.4 45 Z', bun: [105, 27] },
  garland: { head: [110, 60], torso: 'M105 80 L100 120', arms: 'M105 80 L90 115 L105 95 M105 80 L120 115 L105 95', legs: 'M100 120 L60 115 L70 147 L80 147 M100 120 L140 115 L130 147 L140 147', hair: 'M103 52 Q95 60 103 68 Q99 60 103 52 Z', bun: [96, 58] },
  'upward-dog': { head: [56, 62], torso: 'M72 76 Q80 108 120 130', arms: 'M72 80 L62 116 L60 148 L52 148 M80 84 L74 120 L72 147 L64 147', legs: 'M120 130 L156 140 L190 147 L196 147 M117 133 L150 146 L184 149 L190 149', hair: 'M66 63 Q71 49 56 50 Q45 50 45 59 Q55 54 61 65Z', bun: [66, 54] },
  sphinx: { head: [52, 88], torso: 'M66 100 Q72 128 116 142', arms: 'M66 102 L58 146 L78 146 M74 104 L70 146 L88 146', legs: 'M116 142 L150 146 L190 149 L196 149 M112 144 L146 150 L180 152 L190 152', hair: 'M62 89 Q67 75 52 76 Q41 76 41 85 Q51 80 57 91Z', bun: [62, 80] },
  locust: { head: [60, 70], torso: 'M74 84 Q80 110 120 130', arms: 'M74 86 L60 108 L46 118 M82 88 L70 110 L58 122', legs: 'M120 130 L150 120 L186 108 L192 108 M117 132 L146 124 L178 116 L184 116', hair: 'M70 71 Q75 57 60 58 Q49 58 49 67 Q59 62 65 73Z', bun: [70, 62] },
  camel: { head: [92, 62], torso: 'M104 80 C111 92 118 102 124 112', arms: 'M104 80 L94 112 L88 147 M106 82 L96 114 L94 147', legs: 'M124 112 L124 147 L88 147 L74 147 M130 112 L130 147 L94 147 L80 147', hair: 'M82 61 Q77 75 92 74 Q103 74 103 65 Q93 70 87 59Z', bun: [82, 70] },
  'knees-to-chest': { head: [38, 132], torso: 'M57 137 L110 137', arms: 'M57 138 L84 126 L104 114 M60 134 L86 122 L102 116', legs: 'M110 137 L126 112 L140 96 L146 96 M112 137 L130 116 L144 102 L150 102', hair: 'M28 131 Q23 145 38 144 Q49 144 49 135 Q39 140 33 129Z', bun: [28, 142] },
  'happy-baby': { head: [66, 136], torso: 'M83 136 Q108 139 132 139', arms: 'M83 136 L74 112 L86 88 M85 139 L78 118 L92 94', legs: 'M130 138 L90 116 L88 84 L96 84 M133 140 L96 120 L94 90 L102 90', hair: 'M58.3 145.2 A12 12 0 0 1 55.6 130 Q62 138 58.3 145.2 Z', bun: [55, 141] },
  'reclined-twist': { head: [78, 136], torso: 'M92 145 L172 145', arms: 'M92 145 L70 147 L50 146 M92 145 L120 143 L155 145', legs: 'M172 145 L115 125 L135 142 L140 144 M169 143 L112 123 L132 140 L137 142', hair: 'M69 130 A11 11 0 0 0 69 142 A6 6 0 0 1 73 132 Z', bun: [66, 136] },
  'figure-four': { head: [25, 136], torso: 'M 42 138 L 98 138', arms: 'M 42 138 L 72 146 L 108 130 M 42 138 L 70 148 L 106 134', legs: 'M 98 138 L 118 100 L 102 146 L 108 147 M 98 138 L 130 118 L 112 116 L 117 114', hair: 'M 16 129 A 7 7 0 0 0 16 143 A 5 5 0 0 1 16 129 Z', bun: [14, 136] },
  'bird-dog': { head: [70, 70], torso: 'M84 80 L134 80', arms: 'M84 80 L66 80 L44 80 M84 80 L84 110 L84 147', legs: 'M134 80 L156 80 L181 80 L186 80 M134 80 L134 147 L156 147 L161 147', hair: 'M70 59 Q81 70 70 81 Q76 70 70 59 Z', bun: [85, 70] },
}

mkdirSync('public/yoga/poses', { recursive: true })
for (const [id, f] of Object.entries(figures)) {
  const [x, y] = f.head
  const hair = f.hair ?? `M${x - 10} ${y + 1} Q${x - 15} ${y - 13} ${x} ${y - 12} Q${x + 11} ${y - 12} ${x + 11} ${y - 3} Q${x + 1} ${y - 8} ${x - 5} ${y + 3}Z`
  const [bx, by] = f.bun ?? [x - 10, y - 8]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="340" viewBox="0 0 220 170">
  <title>${id.replaceAll('-', ' ')} — original Still illustration</title>
  <path d="M40 147V86a70 70 0 0 1 140 0v61Z" fill="#e6e9dc"/>
  <circle cx="166" cy="39" r="17" fill="#efcfac" opacity=".65"/>
  <ellipse cx="111" cy="153" rx="88" ry="5" fill="#ccd4c3" opacity=".65"/>
  <path d="${f.legs}" stroke="#3e6051" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="${f.torso}" stroke="#bb7960" stroke-width="19" fill="none" stroke-linecap="round"/>
  <path d="${f.arms}" stroke="#cd9678" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="${x}" cy="${y}" r="11" fill="#cd9678"/>
  <path d="${hair}" fill="#364d41"/>
  <circle cx="${bx}" cy="${by}" r="5" fill="#364d41"/>
</svg>`
  writeFileSync(`public/yoga/poses/${id}.svg`, svg)
}
console.log(`Generated ${Object.keys(figures).length} local pose illustrations.`)
