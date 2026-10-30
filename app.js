'use strict';

/* ================= 音樂資料 ================= */
const LET = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const NAT = [0, 2, 4, 5, 7, 9, 11];
const MAJ = [0, 2, 4, 5, 7, 9, 11];
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const QUAL = ['M', 'm', 'm', 'M', 'M', 'm', 'd'];
const Q = {
  M: { zh: '大', full: '大和弦', sym: '', formula: 'R 3 5', cls: 'qM' },
  m: { zh: '小', full: '小和弦', sym: 'm', formula: 'R ♭3 5', cls: 'qm' },
  d: { zh: '減', full: '減和弦', sym: '°', formula: 'R ♭3 ♭5', cls: 'qd' },
};
const KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
// 來自筆記的口訣（只適用於 C 大調）
const MNEMONIC = [
  ['Cat Eat Grass'], ["Don't Fall Asleep"], ['Every Good Boy'], ['Fat Angry Cat'],
  ['Go Back Down', 'Give Back Dollars'], ['Always Cook Eggs'], ['Best Dog Friends'],
];
const PITCH = {
  name: ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
  num: ['1', '2', '3', '4', '5', '6', '7'],
  sol: ['Do', 'Re', 'Mi', 'Fa', 'So', 'La', 'Si'],
  mn: { 0: 'C Like Donuts', 1: 'ReaD', 4: 'So Good', 6: 'Si Ba La' },
};
const STRINGS = ['E', 'A', 'D', 'G'];
const OPEN_HZ = [41.2034, 55, 73.4162, 97.9989];
const FINGER = ['', '食', '中', '無', '小'];

// 指型：以 A 弦根音為基準。s=弦(0=E,1=A,2=D,3=G) d=相對根音的格數 f=建議指法(食1 中2 無3 小4)
const SHAPES = {
  M: [{ name: '指型', pts: [
    { r: 'R', s: 1, d: 0, f: 2 }, { r: '3', s: 2, d: -1, f: 1 }, { r: '5', s: 2, d: 2, f: 4 }] }],
  m: [
    { name: '指型 A', pts: [
      { r: 'R', s: 1, d: 0, f: 2 }, { r: '♭3', s: 2, d: -2, f: 1 }, { r: '5', s: 2, d: 2, f: 4 }] },
    { name: '指型 B', pts: [
      { r: 'R', s: 1, d: 0, f: 1 }, { r: '5', s: 2, d: 2, f: 3 }, { r: '♭3', s: 1, d: 3, f: 4 }] },
  ],
  d: [
    { name: '指型 A', pts: [
      { r: 'R', s: 1, d: 0 }, { r: '♭3', s: 2, d: -2 }, { r: '♭5', s: 2, d: 1 }] },
    { name: '指型 B', pts: [
      { r: 'R', s: 1, d: 0 }, { r: '♭5', s: 2, d: 1 }, { r: '♭3', s: 1, d: 3 }] },
  ],
};
const ptCls = r => (r === 'R' ? 'root' : r.endsWith('3') ? 't3' : 't5');

const pcOfName = n => {
  let a = 0;
  for (const c of n.slice(1)) a += c === '#' ? 1 : -1;
  return (NAT[LET.indexOf(n[0])] + a + 12) % 12;
};

function buildKey(k) {
  const li = LET.indexOf(k[0]), rpc = pcOfName(k);
  const scale = [], pcs = [];
  for (let i = 0; i < 7; i++) {
    const L = (li + i) % 7, pc = (rpc + MAJ[i]) % 12;
    let a = (((pc - NAT[L]) % 12) + 12) % 12;
    if (a > 6) a -= 12;
    scale.push(LET[L] + (a > 0 ? '#'.repeat(a) : 'b'.repeat(-a)));
    pcs.push(pc);
  }
  const degrees = scale.map((root, i) => {
    const f = (((pcs[i] - 9) % 12) + 12) % 12; // A 弦上的格數
    return {
      i, roman: ROMAN[i], root, pc: pcs[i], q: QUAL[i],
      notes: [root, scale[(i + 2) % 7], scale[(i + 4) % 7]],
      fret: f < 3 ? f + 12 : f,
      mn: k === 'C' ? MNEMONIC[i] : null,
    };
  });
  return { key: k, scale, pcs, degrees };
}

const chordLabel = d => `${d.root} ${Q[d.q].zh}`;
const fmtKey = k => k.replace('b', '♭').replace('#', '♯');
const fmtN = n => n.replace('b', '♭').replace('#', '♯');
const fmtNotes = d => d.notes.map(fmtN).join(' ');

/* ================= 狀態與儲存 ================= */
const store = {
  get(k, def) { try { const v = localStorage.getItem('basschord.' + k); return v ? JSON.parse(v) : def; } catch { return def; } },
  set(k, v) { try { localStorage.setItem('basschord.' + k, JSON.stringify(v)); } catch { /* ignore */ } },
};
const state = {
  tab: store.get('tab', 'pitch'),
  lesson: store.get('lesson', 1),
  key: store.get('key', 'C'),
  deg: 0,
  cover: { notes: false, mn: false, q: false },
  revealed: new Set(),
  qtypes: new Set(store.get('qtypes', ['deg2chord', 'chord2notes', 'quality', 'mnemonic', 'shape', 'fret', 'pitch'])),
  boxes: store.get('boxes', {}),
  stats: store.get('stats', { right: 0, wrong: 0, streak: 0, best: 0 }),
  q: null,
};
let K = buildKey(state.key);

/* ================= 聲音 ================= */
let ac;
function audio() {
  ac = ac || new (window.AudioContext || window.webkitAudioContext)();
  if (ac.state !== 'running') ac.resume();   // iOS 的音訊預設休眠，每次播放前先喚醒
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* 不支援就略過 */ }
  return ac;
}
// 貝斯音：基音加上 2、3 倍泛音，手機小喇叭放不出低頻時也聽得到音高
function tone(freq, at = 0, dur = 0.9, vol = 0.22) {
  try {
    const c = audio(), t = c.currentTime + at, g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(c.destination);
    [[1, 'triangle', 0.57], [2, 'sine', 0.29], [3, 'sine', 0.14]].forEach(([m, type, w]) => {
      const o = c.createOscillator(), og = c.createGain();
      o.type = type; o.frequency.value = freq * m; og.gain.value = w;
      o.connect(og).connect(g); o.start(t); o.stop(t + dur + 0.05);
    });
  } catch { /* 無音訊支援 */ }
}
// 節拍聲：很短、很輕的「嗒」，避免蓋過貝斯音
function click(accent, vol = 0.05) {
  try {
    const c = audio(), t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.value = accent ? 1200 : 800;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.06);
  } catch { /* 無音訊支援 */ }
}
const fretHz = (s, f) => OPEN_HZ[s] * 2 ** (f / 12);
// 依音高由低到高排序（根音 → 三音 → 五音），回傳每個指型點的順序
const pitchOrder = (d, pts) => {
  const idx = pts.map((p, i) => i).sort((a, b) => fretHz(pts[a].s, d.fret + pts[a].d) - fretHz(pts[b].s, d.fret + pts[b].d));
  return pts.map((p, i) => idx.indexOf(i));
};
function playChord(d) {
  const pts = SHAPES[d.q][0].pts;
  pts.map(p => fretHz(p.s, d.fret + p.d)).sort((a, b) => a - b).forEach((hz, i) => {
    tone(hz, i * 0.4, 0.8);
    tone(hz, 1.4, 1.4, 0.14);
  });
}

/* ================= 動畫：依序亮起每個音 ================= */
const animTimers = [];
function animClear() {
  animTimers.forEach(clearTimeout); animTimers.length = 0;
  document.querySelectorAll('svg.board .dot.hot').forEach(e => e.classList.remove('hot'));
  document.querySelectorAll('svg.board .ring').forEach(r => { r.style.opacity = 0; });
  document.querySelectorAll('svg.board .trail').forEach(t => t.remove());
  document.querySelectorAll('.npb.now').forEach(e => e.classList.remove('now'));
  document.querySelectorAll('.npc.dim').forEach(e => e.classList.remove('dim'));
}
const later = (fn, ms) => animTimers.push(setTimeout(fn, ms));
// 把光圈滑到某個音，留下一條軌跡線，並讓該音放大發光
function focusDot(svg, dot, prev, ms) {
  svg.querySelectorAll('.dot.hot').forEach(e => e.classList.remove('hot'));
  const x = +dot.getAttribute('cx'), y = +dot.getAttribute('cy'), ring = svg.querySelector('.ring');
  if (ring) {
    if (ring.style.opacity !== '1') {
      ring.style.transition = 'none'; ring.style.transform = `translate(${x}px,${y}px)`;
      void ring.getBoundingClientRect(); ring.style.opacity = 1;
    }
    ring.style.transition = `transform ${ms}ms cubic-bezier(.25,1.3,.5,1), opacity .2s`;
    ring.style.transform = `translate(${x}px,${y}px)`;
  }
  if (prev && prev !== dot) {
    const px = +prev.getAttribute('cx'), py = +prev.getAttribute('cy'), len = Math.hypot(x - px, y - py);
    const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    ln.setAttribute('class', 'trail');
    ln.setAttribute('x1', px); ln.setAttribute('y1', py); ln.setAttribute('x2', x); ln.setAttribute('y2', y);
    ln.style.strokeDasharray = len; ln.style.strokeDashoffset = len;
    svg.insertBefore(ln, svg.querySelector('.dot'));
    void ln.getBoundingClientRect();
    ln.style.transition = `stroke-dashoffset ${ms}ms ease-out`; ln.style.strokeDashoffset = 0;
  }
  void dot.getBoundingClientRect();
  dot.classList.add('hot');
}
const chordDots = svg => [...svg.querySelectorAll('.dot[data-ord]')].sort((a, b) => a.dataset.ord - b.dataset.ord);
// 和弦試聽：根音 → 三音 → 五音 依序亮起，最後三個音一起閃一下
function animateChord(svg) {
  const dots = chordDots(svg);
  if (!dots.length) return;
  animClear();
  dots.forEach((d, i) => later(() => focusDot(svg, d, dots[i - 1], 300), i * 400));
  later(() => {
    svg.querySelectorAll('.trail').forEach(t => t.remove());
    const ring = svg.querySelector('.ring'); if (ring) ring.style.opacity = 0;
    svg.querySelectorAll('.dot.hot').forEach(e => e.classList.remove('hot'));
    dots.forEach(d => { void d.getBoundingClientRect(); d.classList.add('hot'); });
  }, 1400);
  later(animClear, 2900);
}

/* ================= 指板 SVG ================= */
function boardSVG(o) {
  const cw = o.cw || 46, ch = o.ch || 32, L = o.left || 38, T = o.strNums ? 40 : 22, R = o.right || 28;
  const rows = o.to - o.from + 1, W = L + cw * 3 + R, H = T + ch * rows + 8;
  const sx = s => L + s * cw, ry = f => T + (f - o.from) * ch;
  const rad = Math.min(12, ch / 2 - 3);
  let h = `<svg class="board" viewBox="0 0 ${W} ${H}" width="${o.width || W}" role="img" aria-label="${o.aria || '貝斯指板'}">`;
  STRINGS.forEach((n, s) => {
    if (o.strNums) h += `<text class="sn sno" x="${sx(s)}" y="13">${4 - s}</text><text class="sn" x="${sx(s)}" y="31">${n}</text>`;
    else h += `<text class="sn" x="${sx(s)}" y="13">${n}</text>`;
  });
  for (let r = 0; r <= rows; r++) {
    const y = T + r * ch, nut = o.from + r === 1;
    h += `<line class="${nut ? 'nut' : 'ln'}" x1="${L}" x2="${L + cw * 3}" y1="${y}" y2="${y}"/>`;
  }
  for (let s = 0; s < 4; s++) h += `<line class="str" x1="${sx(s)}" x2="${sx(s)}" y1="${T}" y2="${T + ch * rows}"/>`;
  if (o.fretNums !== false) {
    for (let f = o.from; f <= o.to; f++) {
      const t = o.fretLabel ? o.fretLabel(f) : f;
      if (t !== '') h += `<text class="fn ${o.fretStrong && o.fretStrong.includes(f) ? 'fnb' : ''}" x="${L - 18}" y="${ry(f) + ch / 2 + 4}">${t}</text>`;
    }
  }
  (o.links || []).forEach(l => {
    h += `<line class="link ${l.cls || ''}" x1="${sx(l.a.s)}" y1="${ry(l.a.f) + ch / 2}" x2="${sx(l.b.s)}" y2="${ry(l.b.f) + ch / 2}"/>`;
  });
  if (o.click) {
    for (let f = o.from; f <= o.to; f++) {
      h += `<rect class="hit" data-act="tap" data-fret="${f}" x="${sx(1) - cw / 2}" y="${ry(f)}" width="${cw}" height="${ch}"/>`;
    }
  }
  (o.marks || []).forEach(m => {
    if (m.f < o.from || m.f > o.to) return;
    const x = sx(m.s), y = ry(m.f) + ch / 2;
    h += `<circle class="dot ${m.cls || ''}" cx="${x}" cy="${y}" r="${rad}"${m.ord !== undefined ? ` data-ord="${m.ord}"` : ''}${m.beats ? ` data-b="${m.beats.join(' ')}"` : ''}/>`;
    if (m.label) h += `<text class="lbl" x="${x}" y="${y + 4}">${m.label}</text>`;
    if (m.fin) h += `<text class="fin" x="${x + rad + 3}" y="${y + 4}">${FINGER[m.fin]}</text>`;
    if (m.tag) h += `<text class="fin ${m.tagCls || 'tagn'}" x="${x + rad + 3}" y="${y + 4}">${m.tag}</text>`;
  });
  if (o.anim) h += `<circle class="ring" cx="0" cy="0" r="${rad + 6}"/>`;
  return h + '</svg>';
}

function shapeMarks(d, sh, opts = {}) {
  const ord = pitchOrder(d, sh.pts);
  return sh.pts.map((p, i) => ({
    s: p.s, f: d.fret + p.d, cls: ptCls(p.r), ord: ord[i],
    label: opts.hideLabels ? (p.r === 'R' ? '◎' : '') : p.r,
    fin: opts.hideFin ? 0 : p.f,
  }));
}
const shapeSVG = (d, sh, opts) => boardSVG({
  from: d.fret - 2, to: d.fret + 3, marks: shapeMarks(d, sh, opts), width: 190, aria: '和弦指型', anim: true,
});

/* ================= 畫面：音高 ================= */
function viewPitch() {
  const row = (title, tag, arr, cls = '') => `<tr><th>${title}${tag ? `<span class="tag">${tag}</span>` : ''}</th>${
    arr.map((v, i) => `<td><button data-act="note" data-i="${i}" class="${cls}">${v}</button></td>`).join('')}</tr>`;
  return `
  <h2>音高</h2>
  <p class="sub">點一下音符可試聽（C 為中央 C，中央 La = 440Hz）。</p>
  <div class="card"><table class="ptable">
    ${row('音名', '固定調 · 絕對音', PITCH.name)}
    ${row('簡譜', '首調 · 相對音', PITCH.num)}
    ${row('唱名', '', PITCH.sol)}
  </table></div>
  <h3>口訣（來自筆記）</h3>
  <div class="card"><div class="mn">
    <span><b>C</b> Like Donuts → Do</span>
    <span><b>D</b> ReaD → Re</span>
    <span><b>G</b> So Good → So</span>
    <span><b>B</b> Si Ba La → Si / La</span>
  </div></div>
  <h3>重點</h3>
  <div class="card small">
    音名（C D E F G A B）是固定的，不論什麼調，C 永遠是 C；<br>
    簡譜（1–7）與唱名（Do–Si）是「首調」：依調性而變，1 = Do = 該調的主音。<br>
    在 C 調時，兩者剛好一一對應：C=1=Do、D=2=Re、E=3=Mi、F=4=Fa、G=5=So、A=6=La、B=7=Si。
  </div>`;
}

/* ================= 畫面：三和弦 ================= */
// 距離：根音、三音、五音的距離（大和弦一種，小和弦與減和弦各兩種指型）
const DIST = { M: ['0-1-2'], m: ['0-2-2', '0-3-2'], d: ['0-2-1', '0-3-1'] };

function viewChordsLesson1() {
  const c = state.cover;
  const cell = (col, i, html, cls = '') => {
    const hid = c[col] && !state.revealed.has(col + i);
    return `<td class="${cls} ${hid ? 'covered-cell' : ''}" data-col="${col}" data-i="${i}"><span class="${hid ? 'covered' : ''}">${html}</span></td>`;
  };
  const rows = K.degrees.map(d => `
    <tr data-i="${d.i}" class="${d.i === state.deg ? 'sel' : ''}">
      <td class="rn">${d.roman}</td>
      ${cell('notes', d.i, `<span class="nt">${fmtNotes(d)}</span>`)}
      ${cell('q', d.i, Q[d.q].zh, 'q ' + Q[d.q].cls)}
      <td class="dist">${DIST[d.q].map(v => `<span class="nw">${v}</span>`).join('<span class="small"> 或 </span>')}</td>
      ${cell('mn', d.i, d.mn ? d.mn[0] : '—', 'small')}
    </tr>`).join('');
  return `
  <h2>${fmtKey(K.key)} 大調順階和弦</h2>
  <p class="sub">以大調音階為材料，由 3 度＋3 度堆疊出的和弦（R 3 5）。</p>
  <div class="cover-opts">遮住自我測試：
    <label><input type="checkbox" data-cover="notes" ${c.notes ? 'checked' : ''}>和弦音</label>
    <label><input type="checkbox" data-cover="mn" ${c.mn ? 'checked' : ''}>口訣</label>
    <label><input type="checkbox" data-cover="q" ${c.q ? 'checked' : ''}>大小</label>
  </div>
  <div class="card"><table class="tri">
    <thead><tr><th>級數</th><th>和弦音</th><th style="text-align:center">大小</th><th>距離</th><th>口訣</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  ${K.key === 'C' ? '' : '<p class="small">口訣只適用於 C 大調。</p>'}
  <p class="small">大 · 小 · 小 · 大 · 大 · 小 · 減 —— 每個大調都一樣。</p>
  <p class="small distnote"><b>距離</b>：數字代表每個音之間大致相距的格數，是大致的相對關係，是幫助記憶的方法。以 C 大調來說，根音是 0，下一個音大約距離 1 格，第三個音大約距離 2 格。以小和弦指型 B 來說：第一個音與第二個音在同一條弦上，相距 3 格；第三個音大約與第一個音相距 2 格。（個人的記憶方法）</p></div>
  ${chordDetail(K.degrees[state.deg])}`;
}

function chordDetail(d) {
  const q = Q[d.q];
  const shapes = SHAPES[d.q].map(sh => `<div class="shape"><h4>${sh.name}</h4>${shapeSVG(d, sh)}</div>`).join('');
  return `<div class="card">
    <div class="row" style="justify-content:space-between">
      <div><h2 style="margin:0">${d.roman} · <span class="${q.cls}">${fmtN(d.root)} ${q.full}</span></h2>
      <div class="small">${fmtNotes(d)} ｜ ${q.formula.replace('b', '♭')}${d.mn ? ' ｜ ' + d.mn.join(' / ') : ''}</div></div>
      <button class="btn" data-act="play">▶ 試聽</button>
    </div>
    <p class="small">A 弦第 ${d.fret} 格為根音（◎ / R）。手指：食＝食指、中＝中指、無＝無名指、小＝小指。</p>
    <div class="shapes">${shapes}</div>
    <div class="row" style="margin-top:12px"><button class="btn" data-act="toboard">在指板上看</button></div>
  </div>`;
}

/* ================= 畫面：指板 ================= */
function viewBoard() {
  const d = K.degrees[state.deg];
  const map = new Map();
  for (let f = 0; f <= 16; f++) {
    const pc = (9 + f) % 12, idx = K.pcs.indexOf(pc);
    if (idx >= 0) map.set(`1:${f}`, { s: 1, f, cls: 'scale', label: fmtN(K.scale[idx]) });
  }
  const ord = pitchOrder(d, SHAPES[d.q][0].pts);
  SHAPES[d.q][0].pts.forEach((p, i) => {
    map.set(`${p.s}:${d.fret + p.d}`, { s: p.s, f: d.fret + p.d, cls: ptCls(p.r), label: p.r, ord: ord[i] });
  });
  const chips = K.degrees.map(x => `<button class="chip ${x.i === state.deg ? 'on' : ''}" data-act="deg" data-i="${x.i}">${x.roman}</button>`).join('');
  return `
  <h2>A 弦上的 ${fmtKey(K.key)} 大調</h2>
  <p class="sub">在 A 弦找出音階的音，並彈出相對應的順階和弦。選一個級數看和弦指型。</p>
  <div class="chips">${chips}</div>
  <div class="card">
    <div class="row" style="justify-content:space-between">
      <b class="${Q[d.q].cls}">${d.roman} · ${fmtN(d.root)} ${Q[d.q].full}</b>
      <button class="btn" data-act="play">▶ 試聽</button>
    </div>
    <div class="legend"><span><i style="background:var(--M)"></i>R</span><span><i style="background:var(--m)"></i>3 / ♭3</span><span><i style="background:#4cc38a"></i>5 / ♭5</span><span><i style="background:#323842"></i>音階音</span></div>
    ${boardSVG({ from: 0, to: 16, ch: 28, cw: 54, marks: [...map.values()], width: 300, anim: true })}
  </div>`;
}

/* ================= 畫面：筆記 ================= */
/* ================= 原始筆記（密碼保護） ================= */
// 注意：這是純前端的簡易門鎖，只擋住一般使用者，不是真正的加密。
const DEFAULT_PW_HASH = '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4'; // 預設密碼 1234 的 SHA-256
const pwStore = {
  hash: () => { try { return localStorage.getItem('basschord.pwhash') || DEFAULT_PW_HASH; } catch { return DEFAULT_PW_HASH; } },
  save: h => { try { localStorage.setItem('basschord.pwhash', h); } catch { /* ignore */ } },
  unlocked: () => { try { return sessionStorage.getItem('basschord.unlocked') === '1'; } catch { return state.notesOpen === true; } },
  setUnlocked: v => { state.notesOpen = v; try { v ? sessionStorage.setItem('basschord.unlocked', '1') : sessionStorage.removeItem('basschord.unlocked'); } catch { /* ignore */ } },
};
async function sha256(text) {
  if (window.crypto && crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  let h = 5381; for (const c of text) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0; // 沒有 crypto 時的備用雜湊
  return 'x' + h.toString(16);
}
async function checkPw(text) {
  const h = await sha256(text), saved = pwStore.hash();
  if (h === saved) return true;
  // 預設密碼在不支援 crypto 的環境下用備用雜湊比對
  return saved === DEFAULT_PW_HASH && !(window.crypto && crypto.subtle) && text === '1234';
}

function viewNotes() {
  if (!pwStore.unlocked()) {
    return `<h2>原始筆記</h2><p class="sub">這一頁需要密碼。</p>
    <form class="card pwform" id="pwform" autocomplete="off">
      <label for="notepw">密碼</label>
      <div class="row"><input id="notepw" type="password" inputmode="text" autocomplete="off" aria-label="密碼">
      <button class="btn primary" type="submit">解鎖</button></div>
      <p class="pwmsg" id="pwmsg" role="alert">${state.pwError ? '密碼不對，請再試一次。' : ''}</p>
    </form>`;
  }
  const caps = ['音高：音名 / 簡譜 / 唱名', '三和弦：順階和弦與口訣', '三和弦練習（一）：A 弦上找出音階與和弦', '指型：大小三和弦的指法', '歌曲：Fly Me To The Moon（和弦簡化標注）', '三和弦練習（二）：E 弦根音與高八度的三度音（雙音彈法）'];
  return `<div class="row" style="justify-content:space-between"><h2 style="margin:0">原始筆記</h2><button class="btn" data-act="lock">鎖上</button></div>
  <p class="sub">App 內容整理自這 6 頁筆記。</p>
  <div class="gallery">${caps.map((c, i) => `<figure><img src="assets/note-${i + 1}.${i === 4 ? 'webp' : 'jpg'}" alt="${c}" loading="lazy"><figcaption>${c}</figcaption></figure>`).join('')}</div>
  <h3>更改密碼</h3>
  <form class="card pwform" id="pwchange" autocomplete="off">
    <label for="newpw">新密碼</label>
    <div class="row"><input id="newpw" type="password" autocomplete="off" aria-label="新密碼">
    <button class="btn" type="submit">儲存</button></div>
    <p class="pwmsg" id="pwchangemsg" role="status">${state.pwSaved ? '密碼已更新。' : ''}</p>
  </form>`;
}

/* ================= 歌曲練習 ================= */
// 規則：和弦字母後面有「-」→ 小和弦；有「ø」→ 減和弦；其餘（沒有「-」）→ 大和弦。
// 每小節 4 拍：一個和弦 = 根音、三音、五音＋下一小節根音的前一個調內音；
// 兩個和弦 = 每個和弦只彈根音和三音。「*」開頭表示筆記上用黃色標出的和弦。
const SONGS = [{
  id: 'fly-me-to-the-moon', title: 'Fly Me To The Moon', composer: 'Bart Howard',
  style: 'Medium Swing', key: 'C', bpm: 91,
  sections: [
    { name: 'A', bars: [
      ['A-7'], ['D-7'], ['G7'], ['CΔ7'],
      ['FΔ7'], ['Bø7'], ['*E7♭9'], ['A-7', 'A7'],
      ['D-7'], ['G7'], ['CΔ7', 'F7'], ['*E-7', 'A7'],
      ['D-7'], ['G7'], ['CΔ7'], ['Bø7', 'E7♭9']] },
    { name: 'B', bars: [
      ['A-7'], ['D-7'], ['G7'], ['CΔ7'],
      ['FΔ7'], ['Bø7'], ['E7♭9'], ['A-7', 'A7'],
      ['D-7'], ['G7'], ['E-7'], ['A7'],
      ['D-7'], ['G7'], ['CΔ7'], ['Bø7', 'E7♭9']] },
  ],
}];

const TRIAD_SEMI = { M: [0, 4, 7], m: [0, 3, 7], d: [0, 3, 6] };
const BEAT_ROLE = { R: 'r', 3: 't', 5: 'f', '→': 'a' };

function spellTone(root, step, semis) {
  const li = (LET.indexOf(root[0]) + step) % 7, pc = (pcOfName(root) + semis) % 12;
  let a = (((pc - NAT[li]) % 12) + 12) % 12;
  if (a > 6) a -= 12;
  return LET[li] + (a > 0 ? '#'.repeat(a) : 'b'.repeat(-a));
}

function parseChord(raw) {
  const hl = raw.startsWith('*'), sym = hl ? raw.slice(1) : raw;
  const m = sym.match(/^([A-G][#b♯♭]?)(.*)$/);
  const root = m[1].replace('♯', '#').replace('♭', 'b'), rest = m[2];
  const q = rest.includes('-') ? 'm' : rest.includes('ø') ? 'd' : 'M';
  const pc = pcOfName(root), f = (((pc - 9) % 12) + 12) % 12;
  return {
    sym, hl, root, q, pc, fret: f < 3 ? f + 12 : f,
    notes: [0, 2, 4].map((st, i) => spellTone(root, st, TRIAD_SEMI[q][i])),
    rule: q === 'm' ? `「${sym}」有「-」→ 小和弦` : q === 'd' ? `「${sym}」有「ø」→ 減和弦` : `「${sym}」沒有「-」→ 大和弦`,
  };
}

function planSong(song) {
  const key = buildKey(song.key);
  const bars = song.sections.flatMap(s => s.bars.map(b => ({ sec: s.name, chords: b.map(parseChord) })));
  bars.forEach((bar, n) => { bar.n = n + 1; });
  assignShapes(bars);
  const beatOf = (c, role) => {
    const pt = c.pos.pts.find(p => p.role === role), i = role === 'R' ? 0 : role === '3' ? 1 : 2;
    return { note: c.notes[i], role, s: pt.s, f: pt.f, fin: pt.fin };
  };
  bars.forEach((bar, n) => {
    const next = bars[(n + 1) % bars.length].chords[0], [c0, c1] = bar.chords;
    if (c1) {
      bar.beats = [beatOf(c0, 'R'), beatOf(c0, '3'), beatOf(c1, 'R'), beatOf(c1, '3')];
      return;
    }
    // 第 4 拍：下一小節根音的前一個調內音，選離上一個音和下一個根音最近的位置
    const idx = key.pcs.indexOf(next.pc);
    const prevPc = idx >= 0 ? key.pcs[(idx + 6) % 7] : (next.pc + 11) % 12;
    const name = idx >= 0 ? key.scale[(idx + 6) % 7] : spellTone(next.root, 6, (prevPc - next.pc + 12) % 12);
    const nr = next.pos.pts.find(p => p.role === 'R'), last = c0.pos.pts.find(p => p.role === '5');
    const dist = (a, b) => Math.abs(a.f - b.f) + 1.5 * Math.abs(a.s - b.s);
    let best = null;
    OPEN_PC.forEach((o, s2) => {
      const f = (prevPc - o + 12) % 12;
      if (f < 1 || f > FRET_MAX) return;
      const cost = dist({ s: s2, f }, nr) + 0.5 * dist({ s: s2, f }, last);
      if (!best || cost < best.cost) best = { s: s2, f, cost };
    });
    bar.beats = [beatOf(c0, 'R'), beatOf(c0, '3'), beatOf(c0, '5'), { note: name, role: '→', s: best.s, f: best.f }];
  });
  return bars;
}

// 三和弦頁教的指型（大 / 小 / 減），根音在最低的那條弦，三音、五音在上一條弦。
// 只用第 1–8 格、不用空弦：每個和弦找出所有放得下的位置，整首歌一起挑「手移動最少」的組合。
const OPEN_PC = [4, 9, 2, 7]; // E A D G
const FRET_MAX = 8;
function chordSpots(c) {
  const out = [];
  for (let s = 0; s <= 2; s++) {
    for (let n = 1; n <= FRET_MAX; n++) {
      if ((OPEN_PC[s] + n) % 12 !== c.pc) continue;
      SHAPES[c.q].forEach((sh, v) => {
        if (c.q === 'd' && v > 0) return; // 歌曲裡減和弦只用指型 A
        const pts = sh.pts.map(p => ({ r: p.r, role: p.r === 'R' ? 'R' : p.r.endsWith('3') ? '3' : '5', s: s + p.s - 1, f: n + p.d, fin: p.f }));
        if (pts.every(p => p.s <= 3 && p.f >= 1 && p.f <= FRET_MAX)) {
          out.push({ s, n, v, name: sh.name, pts, mean: pts.reduce((a, p) => a + p.f, 0) / pts.length });
        }
      });
    }
  }
  return out;
}
function assignShapes(bars) {
  const chords = bars.flatMap(b => b.chords), cands = chords.map(chordSpots);
  const cost = (a, b) => Math.abs(a.mean - b.mean) + 0.5 * Math.abs(a.s - b.s) + (b.v ? 0.2 : 0) + (b.s !== 1 ? 0.3 : 0);
  let prev = cands[0].map(c => ({ c, tot: 0, from: -1 }));
  const table = [prev];
  for (let i = 1; i < chords.length; i++) {
    prev = cands[i].map(c => {
      let best = null;
      table[i - 1].forEach((p, j) => { const t = p.tot + cost(p.c, c); if (!best || t < best.tot) best = { c, tot: t, from: j }; });
      return best;
    });
    table.push(prev);
  }
  let j = prev.reduce((bi, p, i, a) => (p.tot < a[bi].tot ? i : bi), 0);
  for (let i = chords.length - 1; i >= 0; i--) {
    const e = table[i][j]; chords[i].pos = e.c; j = e.from;
  }
}

const songPlans = new Map();
const curSong = () => SONGS.find(s => s.id === state.song.id) || SONGS[0];
const curPlan = () => {
  const s = curSong();
  if (!songPlans.has(s.id)) songPlans.set(s.id, planSong(s));
  return songPlans.get(s.id);
};
state.song = {
  id: store.get('song', SONGS[0].id), from: 0, to: Infinity, countIn: true, follow: true, lastBar: -1, count: 0, countText: '', sel: 0, bpm: store.get('bpm', SONGS[0].bpm),
  click: true, notes: true, cover: false, revealed: new Set(),
  playing: false, pos: 0, beat: 0, timer: null, t: 0,
};
const songHi = () => Math.min(state.song.to, curPlan().length - 1);
const songBars = () => curPlan().map((b, i) => i).filter(i => i >= state.song.from && i <= songHi());
const secRange = name => {
  const idx = curPlan().map((b, i) => i).filter(i => name === 'all' || curPlan()[i].sec === name);
  return [idx[0], idx[idx.length - 1]];
};
function setSongRange(from, to) {
  const sg = state.song, n = curPlan().length;
  sg.from = Math.max(0, Math.min(from, n - 1)); sg.to = Math.max(sg.from, Math.min(to, n - 1));
  sg.pos = 0; sg.beat = 0; sg.count = 0; sg.countText = '';
}
const noteLabel = (b, covered) => `<i class="bc ${BEAT_ROLE[b.role]}"><span class="${covered ? 'covered' : ''}">${fmtN(b.note)}</span></i>`;

function viewSong() {
  const sg = state.song, song = curSong(), plan = curPlan();
  const secs = ['all', ...song.sections.map(s => s.name)];
  const hi = songHi();
  const chips = secs.map(s => { const r = secRange(s); return `<button class="chip ${sg.from === r[0] && hi === r[1] ? 'on' : ''}" data-act="songsec" data-sec="${s}">${s === 'all' ? '全曲' : s + ' 段'}</button>`; }).join('');
  const opts = v => plan.map((b, i) => `<option value="${i}" ${i === v ? 'selected' : ''}>${b.n}</option>`).join('');
  let grid = '', lastSec = '';
  plan.forEach((bar, i) => {
    if (bar.sec !== lastSec) { grid += `<div class="secname">${bar.sec} 段</div>`; lastSec = bar.sec; }
    const hide = sg.cover && !sg.revealed.has(i);
    const syms = bar.chords.map(c => `<span class="cs ${Q[c.q].cls} ${c.hl ? 'hlc' : ''}">${fmtN(c.sym)}</span>`).join('');
    const quals = bar.chords.map(c => `<span class="${Q[c.q].cls}">${Q[c.q].zh}</span>`).join('<span class="small"> / </span>');
    grid += `<button class="bar ${i === sg.sel ? 'sel' : ''} ${i < sg.from || i > hi ? 'out' : ''}" data-act="songbar" data-bar="${i}">
      <span class="bn">${bar.n}</span><span class="syms">${syms}</span>
      <span class="ql ${hide ? 'covered' : ''}">${quals}</span>
      <span class="beats">${bar.beats.map((b, k) => `<span class="bw" data-beat="${k}">${noteLabel(b, hide)}</span>`).join('')}</span>
    </button>`;
  });
  return `
  <h2>${song.title}</h2>
  <p class="sub">${song.composer} ｜ ${song.style} ｜ ${fmtKey(song.key)} 大調 ｜ ${bpmNow()} bpm</p>
  <div class="card small rules">
    <b>簡化規則</b>：看字母後面——有「-」彈<b class="qm">小和弦</b>；有「ø」彈<b class="qd">減和弦</b>；沒有「-」彈<b class="qM">大和弦</b>。<br>
    一個和弦的小節：<i class="bc r">根音</i><i class="bc t">三音</i><i class="bc f">五音</i><i class="bc a">接下一小節</i>（下一小節根音的前一個調內音）。<br>
    兩個和弦的小節：每個和弦只彈 <i class="bc r">根音</i><i class="bc t">三音</i>。<br>手指跟「三和弦」頁一樣：食＝食指、中＝中指、無＝無名指、小＝小指。 <span class="hlc cs">黃色</span> 為筆記標出的對比和弦。
  </div>
  <div class="chips">${chips}</div>
  <div class="row looprange small">循環範圍：第
    <select id="loopfrom" data-range="from" aria-label="循環起點小節">${opts(sg.from)}</select> 到第
    <select id="loopto" data-range="to" aria-label="循環終點小節">${opts(hi)}</select> 小節
  </div>
  <div class="row songctl">
    <button class="btn primary" data-act="songplay">${sg.playing ? '■ 停止' : '▶ 跟拍練習'}</button>
    <button class="btn" data-act="bpm" data-d="-5" aria-label="慢一點">−</button>
    <b class="bpmv">${bpmNow()}</b>
    <button class="btn" data-act="bpm" data-d="5" aria-label="快一點">＋</button>
    <label class="small"><input type="checkbox" data-song="click" ${sg.click ? 'checked' : ''}> 節拍聲</label>
    <label class="small"><input type="checkbox" data-song="notes" ${sg.notes ? 'checked' : ''}> 音符聲</label>
    <label class="small"><input type="checkbox" data-song="cover" ${sg.cover ? 'checked' : ''}> 遮住音名</label>
    <label class="small"><input type="checkbox" data-song="countIn" ${sg.countIn ? 'checked' : ''}> 起拍一小節</label>
    <label class="small"><input type="checkbox" data-song="follow" ${sg.follow ? 'checked' : ''}> 自動滾動</label>
  </div>
  <div class="row songhint small">建議先用慢速（約 60 bpm）把指型和換弦練順，熟了再加到 ${song.bpm} bpm。
    <button class="btn" data-act="bpmset" data-v="60">慢速 60</button>
    <button class="btn" data-act="bpmset" data-v="${song.bpm}">原速 ${song.bpm}</button>
  </div>
  <div class="nowpanel" id="nowpanel" data-bar="${sg.sel}">${songPanelInner(sg.sel)}</div>
  <div class="barsgrid">${grid}</div>`;
}
const bpmNow = () => state.song.bpm;

function songBeatHz(b) { return fretHz(b.s, b.f); }
// 目前小節的指板：四拍的位置各標上拍數，播放時光圈在音與音之間滑動
function songPanelInner(bi) {
  const bar = curPlan()[bi], key = buildKey(curSong().key), pos = new Map();
  // 底圖：前六格上的調內音（只標音名），像標準的貝斯指板音名圖
  STRINGS.forEach((n, s) => {
    for (let f = 1; f <= FRET_MAX; f++) {
      const idx = key.pcs.indexOf((OPEN_PC[s] + f) % 12);
      if (idx >= 0) pos.set(`${s}:${f}`, { s, f, cls: 'nat', label: fmtN(key.scale[idx]), beats: [] });
    }
  });
  bar.beats.forEach((b, k) => {
    const id = `${b.s}:${b.f}`, old = pos.get(id);
    const m = old && old.cls !== 'nat' ? old : { s: b.s, f: b.f, beats: [] };
    m.cls = { R: 'root', 3: 't3', 5: 't5', '→': 'appr' }[b.role]; m.label = fmtN(b.note); m.tagCls = 'tagn';
    m.beats.push(k);
    if (b.fin) m.fin = b.fin;
    pos.set(id, m);
  });
  // 和弦名稱旁標出「大和弦／小和弦／減和弦」；一小節兩個和弦時，播放中會讓目前這個亮起
  const syms = bar.chords.map((c, ci) => `<span class="npc" data-ci="${ci}"><span class="cs ${Q[c.q].cls} ${c.hl ? 'hlc' : ''}">${fmtN(c.sym)}</span><span class="npq ${Q[c.q].cls}">${Q[c.q].full}</span></span>`).join('');
  // 音塊的高低依「絕對音高」排列：整首歌最低的音在最下面，最高的音在最上面
  const semi = b => 12 * Math.log2(songBeatHz(b) / OPEN_HZ[0]);
  const all = curPlan().flatMap(x => x.beats.map(semi)), lo = Math.min(...all), hi = Math.max(...all);
  const chips = bar.beats.map((b, k) => {
    const t = hi > lo ? (semi(b) - lo) / (hi - lo) : 0.5;
    return `<span class="npb ${BEAT_ROLE[b.role]}" data-beat="${k}" style="left:${k * 25 + 0.5}%;top:calc(${(1 - t).toFixed(3)} * (100% - 56px))"><small>${k + 1}</small>${fmtN(b.note)}${b.fin ? `<em>${FINGER[b.fin]}</em>` : ''}</span>`;
  }).join('');
  return `<div class="npboard">${boardSVG({ from: 1, to: FRET_MAX, ch: 36, cw: 54, left: 66, right: 32, strNums: true, fretStrong: [3, 5, 7], fretLabel: f => (f === 3 || f === 5 || f === 7 ? `${f} 格 ▸` : String(f)), marks: [...pos.values()], anim: true, aria: '前六格指板，這一小節的音位置' })}</div>
    <div class="npinfo"><div class="npt">第 ${bar.n} 小節<span class="npcount">${state.song.countText || ''}</span></div><div class="npchords">${syms}</div><div class="npbeats pitch">${chips}</div><div class="small nphint">音塊越高，音越高</div></div>`;
}
function songFocusBeat(k, ms) {
  const pan = document.querySelector('#nowpanel'), svg = pan && pan.querySelector('svg.board');
  if (!svg) return;
  const dot = b => svg.querySelector(`.dot[data-b~="${b}"]`);
  pan.querySelectorAll('.npb.now').forEach(e => e.classList.remove('now'));
  pan.querySelector(`.npb[data-beat="${k}"]`)?.classList.add('now');
  const cs = pan.querySelectorAll('.npc');
  if (cs.length > 1) cs.forEach((e, ci) => e.classList.toggle('dim', ci !== (k < 2 ? 0 : 1)));
  if (k === 0) svg.querySelectorAll('.trail').forEach(t => t.remove());
  if (dot(k)) focusDot(svg, dot(k), k > 0 ? dot(k - 1) : null, ms);
}
function songBarPlay(bar, bpm = state.song.bpm) {
  const dt = 60 / bpm;
  animClear();
  bar.beats.forEach((b, i) => {
    tone(songBeatHz(b), i * dt, dt * 0.9, 0.3);
    later(() => songFocusBeat(i, Math.min(300, dt * 600)), i * dt * 1000);
  });
  later(animClear, 4 * dt * 1000 + 500);
}

// 讓「正在彈」面板顯示某一小節（不移動光圈），並更新起拍文字
function songShow(bi) {
  const pan = document.querySelector('#nowpanel');
  if (!pan) return;
  if (+pan.dataset.bar !== bi) { pan.dataset.bar = bi; pan.innerHTML = songPanelInner(bi); }
  const c = pan.querySelector('.npcount');
  if (c) c.textContent = state.song.countText;
}

// 自動滾動：讓正在彈的小節停在「固定面板下緣」到「畫面底部」之間的正中央
function songCenter(el) {
  const pan = document.querySelector('#nowpanel'), top = pan ? pan.getBoundingClientRect().bottom : 0;
  const r = el.getBoundingClientRect(), delta = (r.top + r.height / 2) - (top + window.innerHeight) / 2;
  if (Math.abs(delta) < 8) return;
  const calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollBy({ top: delta, behavior: calm ? 'auto' : 'smooth' });
}

function songMark() {
  const sg = state.song;
  document.querySelectorAll('.bar.now, .bw.now').forEach(e => e.classList.remove('now'));
  if (state.tab !== 'song') return;
  const bi = sg.playing ? songBars()[sg.pos] : sg.sel;
  songShow(bi);
  if (!sg.playing || sg.count > 0) return;
  const el = document.querySelector(`.bar[data-bar="${bi}"]`);
  if (!el) return;
  el.classList.add('now');
  el.querySelector(`.bw[data-beat="${sg.beat}"]`)?.classList.add('now');
  if (sg.follow && sg.lastBar !== bi) songCenter(el);
  sg.lastBar = bi;
  songFocusBeat(sg.beat, Math.min(300, (60000 / sg.bpm) * 0.6));
}

function songTick() {
  const sg = state.song, list = songBars();
  if (!sg.playing || !list.length) return;
  if (sg.pos >= list.length) sg.pos = 0;
  if (sg.count > 0) { // 起拍：只打節拍，不移動小節
    const k = 4 - sg.count;
    click(k === 0, 0.07);
    sg.countText = `預備 ${k + 1}`;
    songShow(list[sg.pos]);
    sg.count--;
    if (sg.count === 0) sg.beat = 0;
  } else {
    if (sg.countText) { sg.countText = ''; songShow(list[sg.pos]); }
    const bar = curPlan()[list[sg.pos]], b = bar.beats[sg.beat];
    if (sg.click) click(sg.beat === 0);
    if (sg.notes) tone(songBeatHz(b), 0, (60 / sg.bpm) * 0.9, 0.3);
    songMark();
    sg.beat++;
    if (sg.beat >= 4) { sg.beat = 0; sg.pos = (sg.pos + 1) % list.length; }
  }
  sg.t += 60000 / sg.bpm;
  sg.timer = setTimeout(songTick, Math.max(0, sg.t - performance.now()));
}
function songStart() {
  const sg = state.song;
  sg.playing = true; sg.pos = 0; sg.beat = 0; sg.t = performance.now();
  const list = songBars(), at = list.indexOf(sg.sel);
  if (at >= 0) sg.pos = at;
  sg.count = sg.countIn ? 4 : 0; sg.countText = ''; sg.lastBar = -1;
  songTick();
}
function songStop() {
  const sg = state.song;
  sg.playing = false; clearTimeout(sg.timer); sg.timer = null; sg.count = 0; sg.countText = ''; sg.lastBar = -1;
  animClear(); songMark();
}

/* ================= 測驗 ================= */
const QTYPES = {
  deg2chord: '級數 → 和弦', chord2notes: '和弦 → 組成音', quality: '大 / 小 / 減',
  mnemonic: '口訣 → 和弦', shape: '指型辨識', fret: '指板找根音', pitch: '音名・簡譜・唱名',
};
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = (arr, n, exclude) => shuffle(arr.filter(x => x !== exclude)).slice(0, n);

function questionPool() {
  const pool = [];
  const idx = [0, 1, 2, 3, 4, 5, 6];
  for (const t of state.qtypes) {
    if (t === 'mnemonic' && K.key !== 'C') continue;
    if (t === 'shape') ['M0', 'm0', 'm1', 'd0', 'd1'].forEach(v => pool.push({ t, v, id: `shape:${v}` }));
    else if (t === 'pitch') ['n2s', 's2n', 'n2u', 'u2n'].forEach(v => idx.forEach(i => pool.push({ t, i, v, id: `pitch:${v}:${i}` })));
    else idx.forEach(i => pool.push({ t, i, id: `${t}:${K.key}:${i}` }));
  }
  return pool;
}
const boxOf = id => state.boxes[id] || 0;

function nextTemplate() {
  const pool = questionPool();
  if (!pool.length) return null;
  const cands = pool.length > 1 ? pool.filter(p => !state.q || p.id !== state.q.id) : pool;
  const w = cands.map(p => 6 - Math.max(1, boxOf(p.id)));
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < cands.length; i++) { r -= w[i]; if (r <= 0) return cands[i]; }
  return cands[0];
}

function makeQuestion(t) {
  const d = K.degrees[t.i];
  const base = { id: t.id, answered: false };
  switch (t.t) {
    case 'deg2chord': {
      const wrong = pick([...K.degrees.filter(x => x !== d).map(chordLabel),
        ...Object.keys(Q).filter(k => k !== d.q).map(k => `${d.root} ${Q[k].zh}`)], 3, chordLabel(d));
      return { ...base, prompt: `${fmtKey(K.key)} 大調的 ${d.roman} 級和弦是？`, options: shuffle([chordLabel(d), ...new Set(wrong)].slice(0, 4)), answer: chordLabel(d),
        explain: `${d.roman} = ${fmtN(d.root)} ${Q[d.q].full}（${fmtNotes(d)}）` };
    }
    case 'chord2notes': {
      const ans = fmtNotes(d);
      const wrong = pick(K.degrees.filter(x => x !== d).map(fmtNotes), 3, ans);
      return { ...base, prompt: `${fmtN(d.root)} ${Q[d.q].full} 的組成音是？`, options: shuffle([ans, ...wrong]), answer: ans,
        explain: `${d.roman} 級 ${fmtN(d.root)} ${Q[d.q].full} = ${ans}` };
    }
    case 'quality':
      return { ...base, prompt: `${fmtKey(K.key)} 大調 ${d.roman} 級（${fmtN(d.root)}）是大、小還是減和弦？`, cols: 3,
        options: ['大和弦', '小和弦', '減和弦'], answer: Q[d.q].full,
        explain: `${d.roman} 級是${Q[d.q].full}（${Q[d.q].formula.replace('b', '♭')}）。順序：大 小 小 大 大 小 減` };
    case 'mnemonic': {
      const mn = d.mn[Math.floor(Math.random() * d.mn.length)];
      const wrong = pick(K.degrees.filter(x => x !== d).map(chordLabel), 3);
      return { ...base, prompt: `口訣「${mn}」是 C 大調哪個和弦？`, options: shuffle([chordLabel(d), ...wrong]), answer: chordLabel(d),
        explain: `${mn} = ${fmtNotes(d)} → ${d.roman} 級 ${d.root} ${Q[d.q].full}` };
    }
    case 'shape': {
      const qk = t.v[0], sh = SHAPES[qk][+t.v[1]];
      const dd = { ...K.degrees[0], q: qk, fret: 3 + Math.floor(Math.random() * 8) };
      return { ...base, prompt: '這個指型是哪一種三和弦？（◎ 是根音）', cols: 3,
        board: boardSVG({ from: dd.fret - 2, to: dd.fret + 3, marks: shapeMarks(dd, sh, { hideLabels: true, hideFin: true }), width: 200 }),
        options: ['大和弦', '小和弦', '減和弦'], answer: Q[qk].full,
        explain: `${Q[qk].full}：${Q[qk].formula.replace('b', '♭')}` };
    }
    case 'fret':
      return { ...base, kind: 'tap', answerFret: d.fret,
        prompt: `在 A 弦上點出 ${fmtN(d.root)}（${fmtKey(K.key)} 大調 ${d.roman} 級）的根音位置`,
        explain: `${fmtN(d.root)} 在 A 弦第 ${d.fret} 格` };
    case 'pitch': {
      const i = t.i, L = { n: PITCH.name, s: PITCH.num, u: PITCH.sol };
      const [from, to] = [t.v[0], t.v[2]];
      const lab = { n: '音名', s: '簡譜', u: '唱名' };
      const ans = L[to][i];
      return { ...base, prompt: `C 調：${lab[from]}「${L[from][i]}」對應的${lab[to]}是？`, options: shuffle([ans, ...pick(L[to], 3, ans)]), answer: ans,
        explain: `${PITCH.name[i]} = ${PITCH.num[i]} = ${PITCH.sol[i]}` };
    }
  }
}

function newQuestion() {
  const t = nextTemplate();
  state.q = t ? makeQuestion(t) : null;
}

function record(id, ok) {
  state.boxes[id] = ok ? Math.min(5, boxOf(id) + 1) : 1;
  const s = state.stats;
  if (ok) { s.right++; s.streak++; s.best = Math.max(s.best, s.streak); } else { s.wrong++; s.streak = 0; }
  store.set('boxes', state.boxes); store.set('stats', s);
}

function viewQuiz() {
  const chips = Object.entries(QTYPES).map(([k, v]) =>
    `<button class="chip ${state.qtypes.has(k) ? 'on' : ''}" data-act="qtype" data-t="${k}">${v}</button>`).join('');
  const pool = questionPool();
  const mastered = pool.filter(p => boxOf(p.id) >= 4).length;
  const pct = pool.length ? Math.round(mastered / pool.length * 100) : 0;
  const s = state.stats, tot = s.right + s.wrong;
  if (!state.q && pool.length) newQuestion();
  return `
  <h2>測驗</h2>
  <p class="sub">答錯的題目會更常出現（間隔重複）；連續答對後會逐漸熟悉。目前調性：${fmtKey(K.key)} 大調</p>
  <div class="chips">${chips}</div>
  <div class="stats"><span>正確率 <b>${tot ? Math.round(s.right / tot * 100) : 0}%</b></span><span>連對 <b>${s.streak}</b></span><span>最佳 <b>${s.best}</b></span>
    <span style="margin-left:auto">掌握 <b>${pct}%</b></span></div>
  <div class="bar"><i style="width:${pct}%"></i></div>
  <div class="card" id="qcard">${questionHTML()}</div>
  <button class="btn" data-act="reset" style="margin-top:8px">${state.confirmReset ? '再按一次確認清除' : '重設進度'}</button>`;
}

function questionHTML() {
  const q = state.q;
  if (!q) return '<p>請至少選擇一種題型。（口訣題只在 C 大調出現）</p>';
  let h = `<p class="prompt">${q.prompt}</p>`;
  if (q.kind === 'tap') {
    const marks = [];
    if (q.answered) {
      marks.push({ s: 1, f: q.answerFret, cls: 'ok', label: fmtN(K.degrees.find(x => x.fret === q.answerFret).root) });
      if (q.picked !== undefined && !q.right) marks.push({ s: 1, f: q.picked, cls: 'bad', label: '✕' });
    }
    h += boardSVG({ from: 0, to: 16, ch: 28, cw: 54, width: 300, click: !q.answered, marks });
  } else {
    if (q.board) h += `<div style="margin-bottom:8px">${q.board}</div>`;
    h += `<div class="opts ${q.cols === 3 ? 'three' : ''}">${q.options.map(o => {
      let c = 'opt';
      if (q.answered) c += o === q.answer ? ' right' : o === q.picked ? ' wrong' : '';
      return `<button class="${c}" data-act="ans" data-v="${o}" ${q.answered ? 'disabled' : ''}>${o}</button>`;
    }).join('')}</div>`;
  }
  if (q.answered) {
    h += `<div class="fb ${q.right ? 'ok' : 'no'}">${q.right ? '✓ 答對了！' : '✗ 再記一次：'} ${q.explain}</div>
      <button class="btn primary next" data-act="next">下一題</button>`;
  }
  return h;
}

function answer(value) {
  const q = state.q;
  if (!q || q.answered) return;
  q.answered = true; q.picked = value;
  q.right = q.kind === 'tap' ? (value === q.answerFret || value % 12 === q.answerFret % 12) : value === q.answer;
  if (q.kind === 'tap' && q.right) q.answerFret = value;
  record(q.id, q.right);
  render();
}

/* ================= 路由與事件 ================= */
/* ================= 三和弦：第二課（雙音彈法） ================= */
// 根音在 E 弦；三度音在 G 弦（高八度）。兩隻手指一起彈，不是分開彈。
//  Ⓐ 三度音：「下一弦」+「左一格」（大三度；小三度 ♭3 是「左二格」）
//  Ⓑ 八度音：「下二弦」+「右二格」
//  合起來：根音往下三弦、往右一格就是大三度（小三度不動格）。
function dyadOf(d) {
  const n = ((d.pc - 4 + 12) % 12) || 12, t = n + (d.q === 'M' ? 1 : 0);
  return { n, t, third: d.notes[1], lbl: d.q === 'M' ? '3' : '♭3' };
}
function lessonTabs() {
  const tab = (n, name) => `<button class="chip ${state.lesson === n ? 'on' : ''}" data-act="lesson" data-n="${n}">${name}</button>`;
  return `<div class="chips">${tab(1, '第一課　順階和弦')}${tab(2, '第二課　雙音彈法')}</div>`;
}
function viewChords() {
  return lessonTabs() + (state.lesson === 2 ? viewChordsLesson2() : viewChordsLesson1());
}
function viewChordsLesson2() {
  const sel = K.degrees[state.deg], marks = [], links = [];
  K.degrees.forEach(d => {
    const y = dyadOf(d), on = d.i === state.deg;
    [0, 12].forEach(off => {
      if (off && y.n + off > 13) return;
      const a = { s: 0, f: y.n + off }, b = { s: 3, f: y.t + off };
      links.push({ a, b, cls: on ? 'on' : '' });
      marks.push({ ...a, cls: on ? 'root sel' : 'nat', label: fmtN(d.root) });
      marks.push({ ...b, cls: on ? 't3 sel' : 'nat', label: y.lbl });
    });
  });
  links.sort((p, q) => (p.cls === 'on') - (q.cls === 'on'));
  const y = dyadOf(sel), q = Q[sel.q];
  const chips = K.degrees.map(x => `<button class="chip ${x.i === state.deg ? 'on' : ''}" data-act="deg" data-i="${x.i}">${x.roman}</button>`).join('');
  return `
  <h2>三和弦練習（二）</h2>
  <p class="sub">在 E 弦上找出 ${fmtKey(K.key)} 大調音階的音，並彈出相對應的順階和弦。這種彈法不是分開彈，而是<b>根音</b>和<b>高八度的三度音</b>用兩隻手指一起彈。</p>
  <div class="card small lesson2rules">
    <div><b>Ⓐ 三度音</b>有「下一弦」＋「左一格」的規則（小三度 ♭3 是「左二格」）。</div>
    <div><b>Ⓑ 八度音</b>有「下二弦」＋「右二格」的規則。</div>
    <div>因為 Ⓐ 和 Ⓑ，所以順階和弦的根音（R）和和弦中的三度音（高八度的三度音），在圖上就有固定的相對關係：<b>根音往下三條弦、往右一格是大三度，小三度（♭3）則是同一格。</b></div>
  </div>
  <div class="chips">${chips}</div>
  <div class="card">
    <div class="row" style="justify-content:space-between">
      <div><b class="${q.cls}">${sel.roman} · ${fmtN(sel.root)} ${q.full}</b>
        <div class="small">根音 ${fmtN(sel.root)}：E 弦第 ${y.n} 格　＋　${y.lbl === '3' ? '三度音' : '小三度音（♭3）'} ${fmtN(y.third)}：G 弦第 ${y.t} 格　｜　兩隻手指一起彈</div></div>
      <button class="btn" data-act="dyad">▶ 一起彈</button>
    </div>
    <div class="legend"><span><i style="background:var(--M)"></i>根音</span><span><i style="background:var(--m)"></i>三度音（高八度）</span></div>
    ${boardSVG({ from: 1, to: 15, ch: 26, cw: 54, left: 52, right: 40, strNums: true, marks, links, width: 300, aria: 'E 弦根音與 G 弦三度音' })}
  </div>`;
}
function playDyad(d) {
  const y = dyadOf(d);
  tone(fretHz(0, y.n), 0, 1.4, 0.25); tone(fretHz(3, y.t), 0, 1.4, 0.25);   // 同時彈
  const svg = $('#view svg.board');
  if (!svg) return;
  animClear();
  svg.querySelectorAll('.dot.sel').forEach(e => { void e.getBoundingClientRect(); e.classList.add('hot'); });
  later(animClear, 1600);
}

const VIEWS = { pitch: viewPitch, chords: viewChords, board: viewBoard, song: viewSong, quiz: viewQuiz, notes: viewNotes };
const $ = s => document.querySelector(s);

function render() {
  if (state.tab !== 'song' && state.song.playing) songStop();
  $('#view').innerHTML = VIEWS[state.tab]();
  if (state.tab === 'song') songMark();
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === state.tab));
}

function setKey(k) {
  state.key = k; K = buildKey(k); state.q = null; state.revealed.clear();
  store.set('key', k); $('#key').value = k; render();
}

function init() {
  $('#key').innerHTML = KEYS.map(k => `<option value="${k}">${fmtKey(k)}</option>`).join('');
  $('#key').value = state.key;
  $('#key').addEventListener('change', e => setKey(e.target.value));
  $('#tabs').addEventListener('click', e => {
    const t = e.target.closest('button')?.dataset.tab;
    if (!t) return;
    state.tab = t; store.set('tab', t); window.scrollTo(0, 0); render();
  });

  $('#view').addEventListener('click', e => {
    const a = e.target.closest('[data-act]');
    if (a) {
      const act = a.dataset.act;
      if (act === 'note') {
        const midi = [60, 62, 64, 65, 67, 69, 71][+a.dataset.i];
        tone(440 * 2 ** ((midi - 69) / 12), 0, 1.0, 0.3);
      } else if (act === 'play') {
        playChord(K.degrees[state.deg]);
        const svg = $('#view .shapes svg.board') || $('#view svg.board');
        if (svg) animateChord(svg);
      }
      else if (act === 'dyad') playDyad(K.degrees[state.deg]);
      else if (act === 'lesson') { state.lesson = +a.dataset.n; store.set('lesson', state.lesson); render(); }
      else if (act === 'deg') { state.deg = +a.dataset.i; render(); }
      else if (act === 'toboard') { state.tab = 'board'; store.set('tab', 'board'); window.scrollTo(0, 0); render(); }
      else if (act === 'qtype') {
        const t = a.dataset.t;
        if (state.qtypes.has(t) && state.qtypes.size > 1) state.qtypes.delete(t); else state.qtypes.add(t);
        store.set('qtypes', [...state.qtypes]); state.q = null; render();
      } else if (act === 'songsec') {
        const sg = state.song, r = secRange(a.dataset.sec);
        setSongRange(r[0], r[1]);
        if (!songBars().includes(sg.sel)) sg.sel = r[0];
        render();
      } else if (act === 'songbar') {
        const sg = state.song, i = +a.dataset.bar;
        sg.sel = i; sg.revealed.add(i);
        if (sg.playing) { const at = songBars().indexOf(i); if (at >= 0) { sg.pos = at; sg.beat = 0; } }
        render();
        if (!sg.playing) songBarPlay(curPlan()[i]); // 點小節就彈這一小節，並在指板上依序亮起
      } else if (act === 'songplay') { if (state.song.playing) songStop(); else songStart(); render(); }
      else if (act === 'bpmset') { state.song.bpm = +a.dataset.v; store.set('bpm', state.song.bpm); render(); }
      else if (act === 'bpm') {
        const sg = state.song; sg.bpm = Math.max(40, Math.min(160, sg.bpm + +a.dataset.d));
        store.set('bpm', sg.bpm); render();
      } else if (act === 'lock') { pwStore.setUnlocked(false); state.pwError = false; render(); }
      else if (act === 'ans') answer(a.dataset.v);
      else if (act === 'tap') {
        const f = +a.dataset.fret;
        if (state.q && !state.q.answered) {
          tone(fretHz(1, f), 0, 0.6, 0.2);
          answer(f);
        }
      } else if (act === 'next') { newQuestion(); render(); }
      else if (act === 'reset') {
        if (state.confirmReset) {
          state.confirmReset = false;
          state.boxes = {}; state.stats = { right: 0, wrong: 0, streak: 0, best: 0 };
          store.set('boxes', {}); store.set('stats', state.stats); state.q = null; render();
        } else { state.confirmReset = true; render(); }
      }
      return;
    }
    // 三和弦表：點遮住的格子 → 顯示；點列 → 選擇級數
    const cell = e.target.closest('td[data-col]');
    if (cell && state.cover[cell.dataset.col] && !state.revealed.has(cell.dataset.col + cell.dataset.i)) {
      state.revealed.add(cell.dataset.col + cell.dataset.i); render(); return;
    }
    const tr = e.target.closest('.tri tbody tr');
    if (tr) { state.deg = +tr.dataset.i; render(); }
  });

  $('#view').addEventListener('submit', async e => {
    e.preventDefault();
    if (e.target.id === 'pwform') {
      const ok = await checkPw($('#notepw').value);
      state.pwError = !ok; pwStore.setUnlocked(ok); render();
      if (!ok) { const el = $('#notepw'); if (el) el.focus(); }
    } else if (e.target.id === 'pwchange') {
      const v = $('#newpw').value;
      if (!v) { $('#pwchangemsg').textContent = '請先輸入新密碼。'; return; }
      pwStore.save(await sha256(v)); state.pwSaved = true; render(); state.pwSaved = false;
    }
  });

  $('#view').addEventListener('change', e => {
    const rg = e.target.dataset.range;
    if (rg) {
      const sg = state.song, v = +e.target.value;
      if (rg === 'from') setSongRange(v, Math.max(v, songHi())); else setSongRange(Math.min(sg.from, v), v);
      render(); return;
    }
    const sc = e.target.dataset.song;
    if (sc) { state.song[sc] = e.target.checked; if (sc === 'cover') state.song.revealed.clear(); render(); return; }
    const c = e.target.dataset.cover;
    if (c) { state.cover[c] = e.target.checked; state.revealed.clear(); render(); }
  });

  render();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
}
init();
