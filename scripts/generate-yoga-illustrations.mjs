// Original geometric pose illustrations for the Yoga Session Builder.
// Run from the repository root: node scripts/generate-yoga-illustrations.mjs
import { mkdirSync, writeFileSync } from 'node:fs'

// Each figure: head center, torso, arms, legs. Optional `hair` (path `d`) and
// `bun` (cx, cy) override the default head hair; Viewbox is 220 × 170.
const figures = {
  mountain: { head: [110, 35], torso: 'M110 55 L110 98', arms: 'M102 59 L92 85 L89 104 M118 59 L128 85 L131 104', legs: 'M105 99 L101 125 L99 148 L88 148 M115 99 L119 125 L121 148 L132 148' },
  'upward-salute': { head: [110, 44], torso: 'M110 63 L110 101', arms: 'M102 64 L88 45 L99 17 M118 64 L132 45 L121 17', legs: 'M105 102 L102 127 L100 148 L91 148 M115 102 L118 127 L120 148 L129 148' },
  'forward-fold': { head: [132, 119], torso: 'M96 83 Q125 82 135 103', arms: 'M129 98 L151 121 L149 145 M132 102 L128 128 L126 147', legs: 'M93 84 L90 113 L94 147 L106 147 M99 86 L104 113 L110 147 L122 147' },
  'downward-dog': { head: [74, 112], torso: 'M88 96 L124 59', arms: 'M89 96 L62 122 L42 147 L29 147 M95 101 L73 127 L56 149 L45 149', legs: 'M124 60 L145 104 L170 147 L181 147 M130 62 L154 101 L186 145 L196 145' },
  plank: { head: [47, 81], torso: 'M65 88 L126 105', arms: 'M68 91 L61 118 L61 149 L49 149 M75 94 L78 120 L79 147 L68 147', legs: 'M126 105 L155 123 L188 145 L187 150 M123 109 L153 131 L176 149 L187 149' },
  cobra: { head: [64, 76], torso: 'M76 91 Q83 125 121 140', arms: 'M77 97 L61 122 L76 145 L88 145 M84 98 L78 122 L94 147 L102 147', legs: 'M121 140 L153 144 L186 149 L199 149 M117 143 L149 151 L179 151 L190 151' },
  cat: { head: [56, 110], torso: 'M73 96 Q104 64 143 96', arms: 'M73 98 L70 124 L69 148 L56 148 M81 97 L84 122 L84 148 L72 148', legs: 'M142 98 L145 146 L175 147 L187 147 M135 100 L132 150 L164 152 L175 152' },
  cow: { head: [57, 79], torso: 'M73 97 Q105 124 143 96', arms: 'M74 99 L71 125 L69 148 L56 148 M81 101 L84 125 L84 149 L73 149', legs: 'M142 98 L145 146 L175 147 L187 147 M135 103 L132 150 L164 152 L175 152' },
  child: { head: [87, 132], torso: 'M101 125 Q123 98 146 117', arms: 'M103 122 L76 136 L42 143 L29 143 M107 127 L82 147 L49 151 L37 151', legs: 'M146 120 L157 143 L118 149 L165 149 L181 149 M147 125 L157 145 L126 152 L167 153' },
  'warrior-one': { head: [88, 43], torso: 'M91 62 L109 103', arms: 'M86 65 L70 45 L74 15 M99 64 L107 42 L105 14', legs: 'M108 102 L71 111 L67 148 L52 148 M116 105 L143 124 L167 148 L181 148' },
  'warrior-two': { head: [106, 39], torso: 'M108 59 L108 103', arms: 'M101 61 L64 65 L28 62 L19 59 M115 61 L150 64 L184 61 L195 59', legs: 'M104 105 L65 114 L61 147 L45 147 M114 106 L148 127 L175 148 L189 148' },
  triangle: { head: [116, 77], torso: 'M99 87 L126 110', arms: 'M100 89 L76 116 L56 141 M104 84 L120 52 L134 24', legs: 'M125 109 L88 129 L57 148 L43 148 M132 111 L156 129 L180 149 L194 149' },
  tree: { head: [110, 36], torso: 'M110 55 L110 98', arms: 'M101 59 L85 82 L109 73 M119 59 L135 82 L112 73', legs: 'M106 100 L105 125 L103 149 L115 149 M116 100 L140 113 L111 128' },
  bridge: { head: [38, 140], torso: 'M56 138 L111 108', arms: 'M60 139 L90 149 L124 149 L135 149 M65 143 L95 154 L126 154', legs: 'M111 109 L146 91 L163 147 L170 147 M114 116 L141 103 L150 151 L159 151', hair: 'M28 139 Q23 153 38 152 Q49 152 49 143 Q39 148 33 137Z', bun: [28, 150] },
  'seated-fold': { head: [131, 107], torso: 'M78 138 Q90 99 116 112', arms: 'M110 115 L137 137 L168 141 M116 118 L145 143 L173 146', legs: 'M81 140 L125 147 L173 147 L178 136 M78 148 L121 154 L173 154 L180 143' },
  'easy-seat': { head: [110, 58], torso: 'M110 77 L110 123', arms: 'M101 82 L85 109 L67 124 M119 82 L135 109 L152 124', legs: 'M104 124 Q64 123 61 140 Q65 150 113 149 L137 147 M116 124 Q153 123 159 140 Q151 156 105 147 L84 144' },
  butterfly: { head: [110, 54], torso: 'M110 75 L110 119', arms: 'M101 80 L90 107 L106 140 M119 80 L130 107 L114 140', legs: 'M104 121 Q57 115 62 133 L106 150 M116 121 Q163 115 158 133 L114 150' },
  savasana: { head: [38, 132], torso: 'M57 137 L114 137', arms: 'M62 138 L87 152 L118 156 M66 133 L91 121 L119 122', legs: 'M114 134 L151 131 L185 129 L196 124 M114 141 L148 146 L181 151 L194 148' },
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
