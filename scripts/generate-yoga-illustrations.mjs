// Original geometric pose illustrations for the Yoga Session Builder.
// Run from the repository root: node scripts/generate-yoga-illustrations.mjs
import { mkdirSync, writeFileSync } from 'node:fs'

// Each figure: head center, torso, arms, legs. Optional `hair` (path `d`) and
// `bun` (cx, cy) override the default head hair; Viewbox is 220 × 170.
const figures = {
  mountain: { head: [110, 35], torso: 'M110 55 L110 98', arms: 'M102 59 L92 85 L89 104 M118 59 L128 85 L131 104', legs: 'M105 99 L101 125 L99 148 L88 148 M115 99 L119 125 L121 148 L132 148' },
  'upward-salute': { head: [110, 44], torso: 'M110 63 L110 101', arms: 'M102 64 L88 45 L99 17 M118 64 L132 45 L121 17', legs: 'M105 102 L102 127 L100 148 L91 148 M115 102 L118 127 L120 148 L129 148' },
  chair: { head: [103, 48], torso: 'M117 69 L144 104', arms: 'M117 69 L81 24', legs: 'M144 104 L122 123 L130 148 L110 148', hair: 'M103 35 Q115 36 115 48 Q115 58 108 58 L99 44 Q98 37 103 35 Z', bun: [115, 42] },
  'forward-fold': { head: [132, 119], torso: 'M96 83 Q125 82 135 103', arms: 'M129 98 L151 121 L149 145 M132 102 L128 128 L126 147', legs: 'M93 84 L90 113 L94 147 L100 147 M99 86 L104 113 L110 147 L116 147', hair: 'M142 118 Q147 132 132 131 Q121 131 121 122 Q131 127 137 116Z', bun: [142, 127] },
  'halfway-lift': { head: [146, 82], torso: 'M96 83 L132 83', arms: 'M124 84 L107 101 L96 115 M130 85 L116 104 L106 119', legs: 'M93 84 L90 113 L94 147 L100 147 M99 86 L104 113 L110 147 L116 147' },
  'wide-legged-forward-fold': { head: [130, 124], torso: 'M118 92 L80 78', arms: 'M118 90 L108 118 L102 147 M126 95 L134 118 L138 147', legs: 'M80 78 L68 112 L58 145 L66 147 M80 78 L115 112 L174 145 L180 147', hair: 'M123 115 Q114 124 123 133 Q118 131 118 124 Q118 117 123 115 Z', bun: [114, 124] },
  'downward-dog': { head: [74, 112], torso: 'M88 96 L124 59', arms: 'M89 96 L62 122 L42 147 L29 147 M95 101 L73 127 L56 149 L45 149', legs: 'M124 60 L145 104 L170 147 L181 147 M130 62 L154 101 L186 145 L196 145' },
  plank: { head: [47, 81], torso: 'M65 88 L126 105', arms: 'M68 91 L61 118 L61 149 L49 149 M75 94 L78 120 L79 147 L68 147', legs: 'M126 105 L155 123 L188 145 L187 150 M123 109 L153 131 L176 149 L187 149' },
  chaturanga: { head: [26, 128], torso: 'M44 127 L108 138', arms: 'M44 127 L50 137 L42 147 M47 129 L53 138 L45 147', legs: 'M108 138 L148 142 L176 145 L184 147 M104 139 L144 143 L172 146 L180 148', hair: 'M16 129 Q11 115 26 116 Q37 116 37 125 Q27 120 21 131Z', bun: [16, 120] },
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
  'janu-sirsasana': { head: [138, 110], torso: 'M78 138 Q96 102 126 114', arms: 'M112 112 L142 130 L178 143 M120 115 L150 134 L184 146', legs: 'M78 140 L130 143 L181 147 M80 138 L44 126 L96 149' },
  'easy-seat': { head: [110, 58], torso: 'M110 77 L110 123', arms: 'M101 82 L85 109 L67 124 M119 82 L135 109 L152 124', legs: 'M104 124 Q64 123 61 140 Q65 150 113 149 L137 147 M116 124 Q153 123 159 140 Q151 156 105 147 L84 144' },
  'neck-roll': { head: [127, 60], torso: 'M110 77 L110 123', arms: 'M101 82 L85 109 L67 124 M119 82 L135 109 L152 124', legs: 'M104 124 Q64 123 61 140 Q65 150 113 149 L137 147 M116 124 Q153 123 159 140 Q151 156 105 147 L84 144' },
  'seated-reach': { head: [110, 58], torso: 'M110 77 L110 123', arms: 'M101 80 L88 50 L99 22 M119 80 L132 50 L121 22', legs: 'M104 124 Q64 123 61 140 Q65 150 113 149 L137 147 M116 124 Q153 123 159 140 Q151 156 105 147 L84 144' },
  'seated-twist': { head: [107, 67], torso: 'M112 89 Q108 108 96 128', arms: 'M97 87 L78 105 L58 146 M112 89 L98 109 L74 125', legs: 'M96 128 L72 122 L92 144 L99 147 M100 128 L128 132 L112 146 L106 147', hair: 'M97 60 Q91 67 97 74 Q94 67 97 60 Z', bun: [89, 65] },
  butterfly: { head: [110, 54], torso: 'M110 75 L110 119', arms: 'M101 80 L90 107 L106 140 M119 80 L130 107 L114 140', legs: 'M104 121 Q57 115 62 133 L106 150 M116 121 Q163 115 158 133 L114 150' },
  pigeon: { head: [124, 52], torso: 'M120 68 C118 80 116 92 114 104', arms: 'M120 68 L135 95 L149 119 M122 70 L139 97 L152 123', legs: 'M114 104 L90 123 L66 142 L60 145 M114 104 L148 118 L139 143 L145 146', hair: 'M120 42 Q109 52 120 62 Q115 52 120 42 Z', bun: [114, 46] },
  'legs-up-wall': { head: [38, 132], torso: 'M57 137 L112 137', arms: 'M57 138 L82 150 L108 152 M58 136 L82 124 L108 122', legs: 'M112 137 L113 90 L113 46 L113 38 M120 137 L121 92 L121 48 L121 40', hair: 'M28 131 Q23 145 38 144 Q49 144 49 135 Q39 140 33 129Z', bun: [28, 142] },
  savasana: { head: [38, 132], torso: 'M57 137 L114 137', arms: 'M62 138 L87 152 L118 156 M66 133 L91 121 L119 122', legs: 'M114 134 L151 131 L185 129 L196 124 M114 141 L148 146 L181 151 L194 148', hair: 'M28 131 Q23 145 38 144 Q49 144 49 135 Q39 140 33 129Z', bun: [28, 142] },
  'warrior-three': { head: [173, 80], torso: 'M 156 90 L 120 90', arms: 'M 155 89 L 179 95 L 203 96 M 156 94 L 180 98 L 204 99', legs: 'M 120 90 L 121 118 L 120 143 L 128 146 M 120 90 L 90 90 L 59 89 L 52 88', hair: 'M 166 71 Q 158 80 166 89 Q 163 80 166 71 Z', bun: [158, 76] },
  'crescent-lunge': { head: [100, 54], torso: 'M 96 74 L 102 106', arms: 'M 100 74 L 112 54 L 116 28 M 94 76 L 86 56 L 90 28', legs: 'M 102 106 L 130 116 L 128 147 L 140 147 M 102 106 L 78 144 L 45 147 L 36 147', hair: 'M90 55 Q85 41 100 42 Q111 42 111 51 Q101 46 95 57Z', bun: [90, 46] },
  'extended-side-angle': { head: [141, 58], torso: 'M128 74 Q110 87 96 103', arms: 'M129 74 L154 72 L172 34 M127 79 L118 107 L134 145', legs: 'M95 103 L126 116 L142 144 L152 146 M95 103 L66 127 L34 144 L24 146', hair: 'M136 48 Q128 57 134 68 Q135 57 139 49 Z', bun: [130, 64] },
  'half-moon': { head: [176, 75], torso: 'M 155 80 L 106 92', arms: 'M 155 80 L 160 55 L 172 28 M 152 82 L 148 112 L 144 145', legs: 'M 106 92 L 107 118 L 108 140 L 118 144 M 106 92 L 78 90 L 52 89 L 42 88', hair: 'M 165.6 71.4 A 11 11 0 0 0 168.2 82.8 Q 172 76 165.6 71.4 Z', bun: [166, 67] },
  eagle: { head: [118, 35], torso: 'M117 47 C114 60 112 78 110 96', arms: 'M114 49 L110 63 L124 68 M119 50 L129 64 L112 69', legs: 'M109 96 L107 118 L109 141 L117 145 M114 96 L135 113 L114 130 L106 131', hair: 'M113.4 45 A11 11 0 0 1 113.4 25 Q114.5 35 113.4 45 Z', bun: [105, 27] },
  garland: { head: [110, 58], torso: 'M110 68 L110 106', arms: 'M100 68 L54 98 L108 76 M120 68 L166 98 L112 76 M108 76 L108 68 M112 76 L112 68', legs: 'M110 106 L54 102 L64 148 L42 148 M110 106 L166 102 L156 148 L178 148', bun: [110, 45] },
  'upward-dog': { head: [65, 68], torso: 'M 73 86 L 111 115', arms: 'M 73 86 L 70 116 L 67 146 M 77 87 L 74 116 L 71 146', legs: 'M 111 115 L 137 125 L 157 141 L 168 146 M 114 117 L 140 127 L 159 142 L 169 146', hair: 'M75 69 Q80 55 65 56 Q54 56 54 65 Q64 60 70 71Z', bun: [75, 60] },
  sphinx: { head: [68, 95], torso: 'M82 106 C94 110 110 122 125 140', arms: 'M82 106 L82 146 L57 147 M79 104 L79 145 L55 146', legs: 'M125 140 L152 145 L178 147 L187 147 M125 142 L150 146 L175 147.5 L184 147.5', hair: 'M74 84 Q83 95 73 106 Q77 95 74 84 Z', bun: [81, 83] },
  locust: { head: [58, 100], torso: 'M78 110 Q106 114 134 139', arms: 'M78 110 L103 126 L125 135 M77 113 L107 129 L129 138', legs: 'M134 139 L156 131 L184 120 L191 116 M131 141 L152 134 L180 124 L187 120', hair: 'M68 101 Q73 87 58 88 Q47 88 47 97 Q57 92 63 103Z', bun: [68, 92] },
  camel: { head: [92, 62], torso: 'M104 80 C111 92 118 102 124 112', arms: 'M104 80 L94 112 L88 147 M106 82 L96 114 L94 147', legs: 'M124 112 L124 147 L88 147 L74 147 M130 112 L130 147 L94 147 L80 147', hair: 'M82 61 Q77 75 92 74 Q103 74 103 65 Q93 70 87 59Z', bun: [82, 70] },
  'knees-to-chest': { head: [52, 138], torso: 'M62 143 L120 142', arms: 'M68 142 L86 122 L106 110 M76 144 L90 124 L110 112', legs: 'M120 141 L100 112 L124 100 L132 94 M120 143 L97 115 L127 103 L135 97', hair: 'M42 137 C37 140 37 148 43 151 C47 148 47 140 42 137 Z', bun: [42, 146] },
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
