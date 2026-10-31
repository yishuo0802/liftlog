'use strict';

const KEY = 'liftlog.v1';
const DEFAULT_EXERCISES = [
  ['深蹲', '腿'], ['硬舉', '背'], ['臥推', '胸'], ['肩推', '肩'],
  ['引體向上', '背'], ['划船', '背'], ['腿推', '腿'], ['二頭彎舉', '手臂'],
];
const BODY_METRICS = [
  { key: 'weight', label: '體重', unit: 'kg' },
  { key: 'bodyFat', label: '體脂率', unit: '%' },
  { key: 'muscle', label: '骨骼肌重', unit: 'kg' },
];

// ---------- helpers ----------
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const z = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const todayStr = () => ymd(new Date());
const fmtNum = n => (Math.round(n * 10) / 10).toLocaleString('zh-TW', { maximumFractionDigits: 1 });
const fmtDay = s => parseYmd(s).toLocaleDateString('zh-TW', { year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short' });
const fmtShort = s => { const d = parseYmd(s); return `${d.getMonth() + 1}/${d.getDate()}`; };
const parseNum = s => { const v = parseFloat(String(s).replace(',', '.')); return Number.isFinite(v) ? v : null; };
const volume = w => w.weight * w.sets * w.reps;
const byNewest = (a, b) => b.date.localeCompare(a.date) || b.ts - a.ts;

const ICON = {
  log: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  history: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" stroke-width="2.6"/>',
  body: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8.5 10a5 5 0 0 1 7 0"/><path d="M12 10.5l1.5-2"/>',
  charts: '<path d="M4 19.5h16"/><path d="M5 15l4-4.5 3.5 3L19 6.5"/>',
  settings: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  plus: '<path d="M12 6v12M6 12h12"/>',
  minus: '<path d="M6 12h12"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  updown: '<path d="M8 9.5l4-4 4 4M8 14.5l4 4 4-4"/>',
  dumbbell: '<path d="M7 12h10"/><rect x="4" y="8" width="3" height="8" rx="1"/><rect x="17" y="8" width="3" height="8" rx="1"/><path d="M2.5 10.5v3M21.5 10.5v3"/>',
};
const icon = (name, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICON[name]}</svg>`;

// ---------- storage ----------
function freshDb() {
  return { exercises: DEFAULT_EXERCISES.map(([name, category]) => ({ name, category })), workouts: [], body: [] };
}
function normalize(d) {
  if (!d || typeof d !== 'object') throw new Error('格式不對');
  const out = {
    exercises: Array.isArray(d.exercises) ? d.exercises.filter(e => e && e.name).map(e => ({ name: String(e.name), category: String(e.category || '') })) : [],
    workouts: Array.isArray(d.workouts) ? d.workouts.filter(w => w && w.date && w.exercise) : [],
    body: Array.isArray(d.body) ? d.body.filter(b => b && b.date) : [],
  };
  out.workouts.forEach(w => { w.id ||= uid(); w.ts ||= 0; w.weight = +w.weight || 0; w.sets = +w.sets || 1; w.reps = +w.reps || 1; w.note ||= ''; });
  out.body.forEach(b => { b.id ||= uid(); b.ts ||= 0; b.note ||= ''; });
  return out;
}
function load() {
  try {
    const s = localStorage.getItem(KEY);
    if (s) return normalize(JSON.parse(s));
  } catch (e) { /* 讀取失敗時從空白開始 */ }
  return freshDb();
}
function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
    return true;
  } catch (e) {
    toast('沒存到：瀏覽器拒絕寫入。請到設定匯出備份。');
    return false;
  }
}
let db = load();
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

// ---------- state ----------
const state = {
  tab: 'log',
  editing: { history: false, body: false, exercises: false },
  chartMode: 'train',
  chartExercise: null,
  saved: { workout: false, body: false },
  form: { exercise: '', date: todayStr(), weight: 20, sets: 3, reps: 10, note: '' },
  bodyForm: { date: todayStr(), weight: '', bodyFat: '', muscle: '', note: '' },
  newEx: { name: '', category: '' },
};

function lastFor(name) {
  return db.workouts.filter(w => w.exercise === name).sort(byNewest)[0];
}
function fillFromLast(name) {
  const last = lastFor(name);
  if (!last) return;
  Object.assign(state.form, { weight: last.weight, sets: last.sets, reps: last.reps });
}
function initForm() {
  const recent = [...db.workouts].sort(byNewest)[0];
  state.form.exercise = recent?.exercise || db.exercises[0]?.name || '';
  fillFromLast(state.form.exercise);
}
initForm();

// ---------- toast ----------
let toastTimer;
let undoFn = null;
function toast(msg, undo) {
  const t = $('#toast');
  undoFn = undo || null;
  t.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button data-act="undo">復原</button>' : ''}`;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.classList.remove('show'); undoFn = null; }, undo ? 5000 : 3000);
}

// ---------- shared bits ----------
function exerciseSelect(field, selected, names) {
  const groups = {};
  for (const e of db.exercises) (groups[e.category || '其他'] ||= []).push(e.name);
  // 歷史紀錄裡有、但動作清單已刪除的動作，也要能選
  for (const n of names || []) if (!db.exercises.some(e => e.name === n)) (groups['其他'] ||= []).push(n);
  const opts = Object.keys(groups).sort((a, b) => a.localeCompare(b, 'zh-Hant')).map(cat =>
    `<optgroup label="${esc(cat)}">${groups[cat].map(n => `<option${n === selected ? ' selected' : ''}>${esc(n)}</option>`).join('')}</optgroup>`
  ).join('');
  return `<span class="selectwrap"><select data-field="${field}" aria-label="動作">${opts}</select>${icon('updown')}</span>`;
}
function stepper(key, step, label) {
  return `<span class="stepper">
    <button data-act="step" data-k="${key}" data-d="${-step}" aria-label="${label}減少">${icon('minus')}</button>
    <button data-act="step" data-k="${key}" data-d="${step}" aria-label="${label}增加">${icon('plus')}</button>
  </span>`;
}
function workoutRow(w, deletable) {
  return `<div class="row entry">
    <div class="main"><div class="name">${esc(w.exercise)}</div>${w.note ? `<div class="sub">${esc(w.note)}</div>` : ''}</div>
    <div class="meta">${fmtNum(w.weight)} kg × ${w.sets} × ${w.reps}</div>
    ${deletable ? `<button class="del" data-act="delWorkout" data-id="${w.id}">刪除</button>` : ''}
  </div>`;
}
function empty(iconName, title, text) {
  return `<div class="empty">${icon(iconName)}<h2>${esc(title)}</h2><p>${text}</p></div>`;
}
function title(text, right = '') {
  return `<header class="title"><h1>${esc(text)}</h1>${right}</header>`;
}

// ---------- views ----------
const views = {
  log() {
    const f = state.form;
    const today = db.workouts.filter(w => w.date === todayStr()).sort(byNewest);
    return `${title('記錄訓練')}
      <section class="group">
        <label class="row"><span class="k">動作</span>${exerciseSelect('exercise', f.exercise)}</label>
        <label class="row"><span class="k">日期</span><input type="date" data-field="date" value="${f.date}" max="${todayStr()}"></label>
      </section>
      <section class="group">
        <div class="row"><label class="k" for="w">重量</label>
          <span class="ctl"><input id="w" class="num" inputmode="decimal" autocomplete="off" data-field="weight" value="${f.weight}"><span class="unit">kg</span>${stepper('weight', 2.5, '重量')}</span></div>
        <div class="row"><span class="k">組數</span><span class="ctl"><span class="val">${f.sets}</span>${stepper('sets', 1, '組數')}</span></div>
        <div class="row"><span class="k">次數</span><span class="ctl"><span class="val">${f.reps}</span>${stepper('reps', 1, '次數')}</span></div>
        <div class="row"><input class="full" data-field="note" placeholder="備註（選填）" value="${esc(f.note)}" aria-label="備註"></div>
      </section>
      <button class="primary" data-act="saveWorkout"${f.exercise ? '' : ' disabled'}>
        ${state.saved.workout ? `${icon('check')}已儲存` : '儲存這組訓練'}
      </button>
      ${today.length ? `<div class="group-h"><span>今天 · ${today.length} 筆</span></div>
        <section class="group">${today.map(w => workoutRow(w, false)).join('')}</section>` : ''}`;
  },

  history() {
    const editing = state.editing.history;
    const right = db.workouts.length ? `<button class="linkbtn" data-act="toggleEdit" data-k="history">${editing ? '完成' : '編輯'}</button>` : '';
    if (!db.workouts.length) {
      return title('歷史') + empty('dumbbell', '還沒有訓練紀錄', '到「記錄」分頁存下第一組，這裡會按日期排好。');
    }
    const days = {};
    for (const w of [...db.workouts].sort(byNewest)) (days[w.date] ||= []).push(w);
    return title('歷史', right) + Object.entries(days).map(([d, items]) => {
      const vol = items.reduce((s, w) => s + volume(w), 0);
      return `<div class="group-h"><span>${fmtDay(d)}</span><span>訓練量 ${fmtNum(vol)}</span></div>
        <section class="group">${items.map(w => workoutRow(w, editing)).join('')}</section>`;
    }).join('');
  },

  body() {
    const f = state.bodyForm;
    const editing = state.editing.body;
    const canSave = BODY_METRICS.some(m => parseNum(f[m.key]) !== null);
    const list = [...db.body].sort(byNewest);
    return `${title('身體數據')}
      <section class="group">
        <label class="row"><span class="k">日期</span><input type="date" data-field="b.date" value="${f.date}" max="${todayStr()}"></label>
        ${BODY_METRICS.map(m => `<div class="row"><label class="k" for="b-${m.key}">${m.label}</label>
          <span class="ctl"><input id="b-${m.key}" class="num" inputmode="decimal" autocomplete="off" placeholder="—" data-field="b.${m.key}" value="${esc(f[m.key])}"><span class="unit">${m.unit}</span></span></div>`).join('')}
        <div class="row"><input class="full" data-field="b.note" placeholder="備註（例如：InBody、早上空腹）" value="${esc(f.note)}" aria-label="備註"></div>
      </section>
      <p class="foot">填你有量到的就好，不用三項都填。</p>
      <button class="primary" data-act="saveBody"${canSave ? '' : ' disabled'}>
        ${state.saved.body ? `${icon('check')}已儲存` : '儲存身體數據'}
      </button>
      ${list.length ? `<div class="group-h"><span>紀錄</span><button class="linkbtn" data-act="toggleEdit" data-k="body">${editing ? '完成' : '編輯'}</button></div>
        <section class="group">${list.map(b => `<div class="row entry">
          <div class="main"><div class="name">${fmtDay(b.date)}</div>${b.note ? `<div class="sub">${esc(b.note)}</div>` : ''}</div>
          <div class="meta">${BODY_METRICS.filter(m => b[m.key] != null).map(m => `${fmtNum(b[m.key])} ${m.unit}`).join(' · ')}</div>
          ${editing ? `<button class="del" data-act="delBody" data-id="${b.id}">刪除</button>` : ''}
        </div>`).join('')}</section>` : ''}`;
  },

  charts() {
    const seg = `<div class="seg" role="tablist" aria-label="圖表類型">
      <button role="tab" aria-selected="${state.chartMode === 'train'}" data-act="chartMode" data-k="train">訓練</button>
      <button role="tab" aria-selected="${state.chartMode === 'body'}" data-act="chartMode" data-k="body">身體</button>
    </div>`;
    if (state.chartMode === 'body') {
      if (!db.body.length) return title('圖表') + seg + empty('body', '還沒有身體數據', '到「身體」分頁輸入體重或 InBody 的數字，就會畫出趨勢。');
      return title('圖表') + seg + BODY_METRICS.map(m => {
        const pts = db.body.filter(b => b[m.key] != null).sort((a, b) => a.date.localeCompare(b.date) || a.ts - b.ts);
        if (!pts.length) return '';
        const first = pts[0][m.key], last = pts[pts.length - 1][m.key], delta = last - first;
        const deltaTxt = pts.length > 1 ? `（${delta > 0 ? '+' : delta < 0 ? '−' : '±'}${fmtNum(Math.abs(delta))}）` : '';
        return `<section class="group chart-card" style="margin-top:20px">
          <div class="chart-h"><h2>${m.label}（${m.unit}）</h2><small>最新 ${fmtNum(last)} ${m.unit}${deltaTxt}</small></div>
          <div class="chart" data-chart="body:${m.key}"></div></section>`;
      }).join('');
    }

    if (!db.workouts.length) return title('圖表') + seg + empty('charts', '還沒有資料', '記錄幾次訓練之後，這裡會出現每週頻率和重量趨勢。');
    const weeks = weeklyFrequency();
    const thisWeek = weeks[weeks.length - 1].days;
    const avg4 = weeks.slice(-4).reduce((s, w) => s + w.days, 0) / 4;
    const names = [...new Set(db.workouts.map(w => w.exercise))];
    if (!names.includes(state.chartExercise)) state.chartExercise = lastFor(names[0]) && [...db.workouts].sort(byNewest)[0].exercise;
    return title('圖表') + seg + `
      <p class="summary">本週練了 <b>${thisWeek} 天</b> · 近 4 週平均 <b>${fmtNum(avg4)} 天</b></p>
      <section class="group chart-card" style="margin-top:16px">
        <div class="chart-h"><h2>每週訓練天數</h2><small>近 12 週</small></div>
        <div class="chart" data-chart="freq"></div>
      </section>
      <div class="group-h"><span>單一動作</span></div>
      <section class="group">
        <label class="row"><span class="k">動作</span>${exerciseSelect('chartExercise', state.chartExercise, names)}</label>
      </section>
      <section class="group chart-card">
        <div class="chart-h"><h2>最大重量（kg）</h2><small>每次訓練的最重一組</small></div>
        <div class="chart" data-chart="max"></div>
      </section>
      <section class="group chart-card">
        <div class="chart-h"><h2>訓練量</h2><small>重量 × 組數 × 次數</small></div>
        <div class="chart" data-chart="vol"></div>
      </section>`;
  },

  settings() {
    const editing = state.editing.exercises;
    const cats = [...new Set(db.exercises.map(e => e.category).filter(Boolean))];
    const ex = [...db.exercises].sort((a, b) => (a.category || '').localeCompare(b.category || '', 'zh-Hant') || a.name.localeCompare(b.name, 'zh-Hant'));
    const nameOk = state.newEx.name.trim() && !db.exercises.some(e => e.name === state.newEx.name.trim());
    return `${title('設定')}
      <div class="group-h"><span>新增動作</span></div>
      <section class="group">
        <div class="row"><input class="full" data-field="n.name" placeholder="動作名稱，例如：保加利亞分腿蹲" value="${esc(state.newEx.name)}" aria-label="動作名稱"></div>
        <div class="row"><input class="full" data-field="n.category" list="cats" placeholder="部位，例如：腿" value="${esc(state.newEx.category)}" aria-label="部位"></div>
        <button class="row action" data-act="addExercise"${nameOk ? '' : ' disabled'}>${icon('plus')}新增</button>
      </section>
      <datalist id="cats">${cats.map(c => `<option value="${esc(c)}">`).join('')}</datalist>

      <div class="group-h"><span>動作清單 · ${db.exercises.length}</span><button class="linkbtn" data-act="toggleEdit" data-k="exercises">${editing ? '完成' : '編輯'}</button></div>
      <section class="group">${ex.map(e => `<div class="row entry">
        <div class="main">${esc(e.name)}</div><div class="meta">${esc(e.category)}</div>
        ${editing ? `<button class="del" data-act="delExercise" data-name="${esc(e.name)}">刪除</button>` : ''}
      </div>`).join('')}</section>
      <p class="foot">刪除動作不會刪掉它的歷史紀錄。</p>

      <div class="group-h"><span>資料</span></div>
      <section class="group">
        <button class="row action" data-act="exportWorkouts">匯出訓練紀錄（CSV · ${db.workouts.length} 筆）</button>
        <button class="row action" data-act="exportBody">匯出身體數據（CSV · ${db.body.length} 筆）</button>
        <button class="row action" data-act="backup">備份全部資料（JSON）</button>
        <button class="row action" data-act="restore">從備份還原</button>
      </section>
      <p class="foot">資料只存在這支手機的瀏覽器裡。從主畫面刪除這個 App 會一起刪掉資料，記得偶爾備份到 iCloud 雲碟。CSV 可以直接傳給 Claude 分析。</p>`;
  },
};

// ---------- chart data ----------
function weekStart(d) {
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  s.setDate(s.getDate() - ((s.getDay() + 6) % 7)); // 週一開始
  return s;
}
function weeklyFrequency() {
  const start = weekStart(new Date());
  const out = [];
  for (let k = 11; k >= 0; k--) {
    const ws = new Date(start); ws.setDate(ws.getDate() - 7 * k);
    const we = new Date(ws); we.setDate(we.getDate() + 7);
    const a = ymd(ws), b = ymd(we);
    const days = new Set(db.workouts.filter(w => w.date >= a && w.date < b).map(w => w.date)).size;
    out.push({ start: a, days });
  }
  return out;
}
function drawCharts() {
  document.querySelectorAll('[data-chart]').forEach(c => {
    const kind = c.dataset.chart;
    if (kind === 'freq') {
      const pts = weeklyFrequency().map(w => ({ label: fmtShort(w.start), value: w.days, tip: `${fmtShort(w.start)} 那週 · ${w.days} 天` }));
      Charts.draw(c, pts, { type: 'bar', zero: true, ariaLabel: '近 12 週每週訓練天數' });
    } else if (kind === 'max' || kind === 'vol') {
      const days = {};
      for (const w of db.workouts.filter(w => w.exercise === state.chartExercise)) {
        const d = (days[w.date] ||= { max: 0, vol: 0 });
        d.max = Math.max(d.max, w.weight);
        d.vol += volume(w);
      }
      const rows = Object.entries(days).sort(([a], [b]) => a.localeCompare(b)).slice(-30);
      const pts = rows.map(([d, v]) => kind === 'max'
        ? { label: fmtShort(d), value: v.max, tip: `${fmtShort(d)} · ${fmtNum(v.max)} kg` }
        : { label: fmtShort(d), value: v.vol, tip: `${fmtShort(d)} · ${fmtNum(v.vol)}` });
      Charts.draw(c, pts, kind === 'max'
        ? { type: 'line', zero: false, ariaLabel: `${state.chartExercise}最大重量趨勢` }
        : { type: 'bar', zero: true, ariaLabel: `${state.chartExercise}訓練量` });
    } else if (kind.startsWith('body:')) {
      const m = BODY_METRICS.find(x => x.key === kind.slice(5));
      const pts = db.body.filter(b => b[m.key] != null).sort((a, b) => a.date.localeCompare(b.date) || a.ts - b.ts)
        .map(b => ({ label: fmtShort(b.date), value: b[m.key], tip: `${fmtShort(b.date)} · ${fmtNum(b[m.key])} ${m.unit}` }));
      Charts.draw(c, pts, { type: 'line', zero: false, ariaLabel: `${m.label}趨勢` });
    }
  });
}

// ---------- render ----------
const TABS = [['log', '記錄'], ['history', '歷史'], ['body', '身體'], ['charts', '圖表'], ['settings', '設定']];
function renderTabs() {
  $('#tabs').innerHTML = TABS.map(([k, label]) =>
    `<button role="tab" aria-selected="${state.tab === k}" data-act="tab" data-k="${k}">${icon(k)}<span>${label}</span></button>`).join('');
}
function render() {
  $('#view').innerHTML = views[state.tab]();
  renderTabs();
  if (state.tab === 'charts') drawCharts();
}

// ---------- export ----------
function csvCell(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(header, rows) {
  return '﻿' + [header, ...rows].map(r => r.map(csvCell).join(',')).join('\n');
}
async function shareFile(name, text, type) {
  const file = new File([text], name, { type });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file] });
      return;
    }
  } catch (e) {
    if (e.name === 'AbortError') return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// ---------- actions ----------
function flash(which) {
  state.saved[which] = true;
  render();
  setTimeout(() => { state.saved[which] = false; if (state.tab === (which === 'workout' ? 'log' : 'body')) render(); }, 1500);
}
function removeWith(list, id, label) {
  const idx = db[list].findIndex(x => x.id === id);
  if (idx < 0) return;
  const [item] = db[list].splice(idx, 1);
  persist();
  render();
  toast(`已刪除${label}`, () => { db[list].push(item); persist(); render(); });
}

const actions = {
  tab: k => { state.tab = k; window.scrollTo(0, 0); render(); },
  undo: () => { if (undoFn) { undoFn(); undoFn = null; $('#toast').classList.remove('show'); } },
  toggleEdit: k => { state.editing[k] = !state.editing[k]; render(); },
  chartMode: k => { state.chartMode = k; render(); },
  step: (k, d) => {
    const f = state.form;
    const min = k === 'weight' ? 0 : 1;
    const v = Math.max(min, Math.round(((parseNum(f[k]) ?? 0) + d) * 10) / 10);
    f[k] = v;
    render();
  },
  saveWorkout: () => {
    const f = state.form;
    const weight = parseNum(f.weight);
    if (weight === null || weight < 0) { toast('重量要填數字，例如 60 或 62.5'); return; }
    db.workouts.push({ id: uid(), ts: Date.now(), date: f.date || todayStr(), exercise: f.exercise, weight, sets: f.sets, reps: f.reps, note: f.note.trim() });
    if (!persist()) return;
    f.note = '';
    flash('workout');
  },
  saveBody: () => {
    const f = state.bodyForm;
    const entry = { id: uid(), ts: Date.now(), date: f.date || todayStr(), note: f.note.trim() };
    for (const m of BODY_METRICS) { const v = parseNum(f[m.key]); if (v !== null) entry[m.key] = v; }
    db.body.push(entry);
    if (!persist()) return;
    Object.assign(f, { weight: '', bodyFat: '', muscle: '', note: '' });
    flash('body');
  },
  delWorkout: (_, __, el) => removeWith('workouts', el.dataset.id, '一筆訓練'),
  delBody: (_, __, el) => removeWith('body', el.dataset.id, '一筆身體數據'),
  delExercise: (_, __, el) => {
    const name = el.dataset.name;
    const idx = db.exercises.findIndex(e => e.name === name);
    if (idx < 0) return;
    const [item] = db.exercises.splice(idx, 1);
    persist();
    render();
    toast(`已刪除「${name}」`, () => { db.exercises.push(item); persist(); render(); });
  },
  addExercise: () => {
    const name = state.newEx.name.trim();
    if (!name || db.exercises.some(e => e.name === name)) return;
    db.exercises.push({ name, category: state.newEx.category.trim() });
    persist();
    state.newEx = { name: '', category: '' };
    render();
    toast(`已新增「${name}」`);
  },
  exportWorkouts: () => shareFile(`workouts-${todayStr()}.csv`,
    toCsv(['date', 'exercise', 'weight_kg', 'sets', 'reps', 'volume', 'note'],
      [...db.workouts].sort((a, b) => a.date.localeCompare(b.date) || a.ts - b.ts).map(w => [w.date, w.exercise, w.weight, w.sets, w.reps, volume(w), w.note])),
    'text/csv'),
  exportBody: () => shareFile(`body-${todayStr()}.csv`,
    toCsv(['date', 'weight_kg', 'body_fat_pct', 'skeletal_muscle_kg', 'note'],
      [...db.body].sort((a, b) => a.date.localeCompare(b.date) || a.ts - b.ts).map(b => [b.date, b.weight, b.bodyFat, b.muscle, b.note])),
    'text/csv'),
  backup: () => shareFile(`liftlog-backup-${todayStr()}.json`, JSON.stringify({ app: 'liftlog', version: 1, ...db }, null, 1), 'application/json'),
  restore: () => $('#importFile').click(),
};

document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.act];
  if (fn) fn(el.dataset.k, parseFloat(el.dataset.d), el);
});

function setField(field, value) {
  if (field.startsWith('b.')) state.bodyForm[field.slice(2)] = value;
  else if (field.startsWith('n.')) state.newEx[field.slice(2)] = value;
  else if (field === 'chartExercise') state.chartExercise = value;
  else state.form[field] = value;
}
document.addEventListener('input', ev => {
  const field = ev.target.dataset?.field;
  if (!field) return;
  setField(field, ev.target.value);
  // 只更新按鈕可不可以按，不重畫整頁（避免輸入框失去焦點）
  if (field.startsWith('b.')) {
    const btn = $('[data-act="saveBody"]');
    if (btn) btn.disabled = !BODY_METRICS.some(m => parseNum(state.bodyForm[m.key]) !== null);
  } else if (field.startsWith('n.')) {
    const btn = $('[data-act="addExercise"]');
    const name = state.newEx.name.trim();
    if (btn) btn.disabled = !name || db.exercises.some(e => e.name === name);
  }
});
document.addEventListener('change', ev => {
  const field = ev.target.dataset?.field;
  if (field === 'exercise') { fillFromLast(state.form.exercise); render(); }
  if (field === 'chartExercise') render();
});

$('#importFile').addEventListener('change', async ev => {
  const file = ev.target.files[0];
  ev.target.value = '';
  if (!file) return;
  try {
    const next = normalize(JSON.parse(await file.text()));
    const ok = confirm(`用備份取代目前的資料？\n\n備份裡有 ${next.workouts.length} 筆訓練、${next.body.length} 筆身體數據。\n目前的 ${db.workouts.length} 筆訓練、${db.body.length} 筆身體數據會被取代。`);
    if (!ok) return;
    db = next;
    persist();
    initForm();
    render();
    toast('已從備份還原');
  } catch (e) {
    toast('這個檔案不是健身紀錄的備份，沒有變更任何資料。');
  }
});

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (state.tab === 'charts') drawCharts(); }, 150);
});

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

render();
