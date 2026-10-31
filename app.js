'use strict';

const KEY = 'liftlog.v1';
const CATEGORIES = ['胸', '背', '肩', '腿', '臀', '二頭', '三頭', '核心'];
// 一般連鎖健身房常見的器材與動作
const DEFAULT_LIBRARY = {
  胸: ['槓鈴臥推', '上斜槓鈴臥推', '啞鈴臥推', '上斜啞鈴臥推', '史密斯臥推', '坐姿推胸機', '上斜推胸機', '蝴蝶機夾胸', '繩索夾胸', '雙槓撐體', '伏地挺身'],
  背: ['硬舉', '引體向上', '輔助引體向上機', '滑輪下拉', '坐姿繩索划船', '坐姿划船機', '槓鈴划船', '單臂啞鈴划船', 'T 槓划船', '直臂下拉', '羅馬椅背伸展'],
  肩: ['槓鈴肩推', '啞鈴肩推', '坐姿肩推機', '啞鈴側平舉', '繩索側平舉', '側平舉機', '啞鈴前平舉', '反向飛鳥機', '臉拉', '聳肩'],
  腿: ['槓鈴深蹲', '史密斯深蹲', '哈克深蹲機', '腿推機', '腿伸展機', '坐姿腿彎舉機', '俯臥腿彎舉機', '羅馬尼亞硬舉', '保加利亞分腿蹲', '弓箭步', '站姿提踵機', '坐姿提踵機'],
  臀: ['槓鈴臀推', '臀推機', '髖外展機', '髖內收機', '繩索後踢腿'],
  二頭: ['槓鈴彎舉', '啞鈴彎舉', '錘式彎舉', '牧師椅彎舉', '繩索彎舉', '二頭彎舉機'],
  三頭: ['繩索下壓', '過頭繩索伸展', '仰臥臂屈伸', '窄握臥推', '三頭伸展機'],
  核心: ['捲腹', '捲腹機', '繩索捲腹', '懸垂舉腿', '健腹輪', '俄羅斯轉體'],
};
// 複合動作的次要部位：選這些部位時也會列出來
const SECONDARY = {
  槓鈴臥推: ['三頭', '肩'], 上斜槓鈴臥推: ['肩', '三頭'], 啞鈴臥推: ['三頭'], 上斜啞鈴臥推: ['肩'],
  史密斯臥推: ['三頭'], 坐姿推胸機: ['三頭'], 上斜推胸機: ['肩'], 雙槓撐體: ['三頭', '肩'], 伏地挺身: ['三頭', '核心'],
  硬舉: ['腿', '臀', '核心'], 引體向上: ['二頭'], 輔助引體向上機: ['二頭'], 滑輪下拉: ['二頭'],
  坐姿繩索划船: ['二頭'], 坐姿划船機: ['二頭'], 槓鈴划船: ['二頭'], 單臂啞鈴划船: ['二頭'], 'T 槓划船': ['二頭'],
  羅馬椅背伸展: ['臀'],
  槓鈴肩推: ['三頭'], 啞鈴肩推: ['三頭'], 坐姿肩推機: ['三頭'], 反向飛鳥機: ['背'], 臉拉: ['背'], 聳肩: ['背'],
  槓鈴深蹲: ['臀', '核心'], 史密斯深蹲: ['臀'], 哈克深蹲機: ['臀'], 腿推機: ['臀'], 羅馬尼亞硬舉: ['臀', '背'],
  保加利亞分腿蹲: ['臀'], 弓箭步: ['臀'],
  槓鈴臀推: ['腿'], 臀推機: ['腿'],
  窄握臥推: ['胸'], 懸垂舉腿: ['腿'],
};
const DEFAULTS_VERSION = 2;
const defaultExercises = () => Object.entries(DEFAULT_LIBRARY).flatMap(([main, names]) =>
  names.map(name => ({ name, categories: [main, ...(SECONDARY[name] || [])] })));
const categoryOrder = c => { const i = CATEGORIES.indexOf(c); return i < 0 ? CATEGORIES.length : i; };
const sortCategories = list => [...list].sort((a, b) => categoryOrder(a) - categoryOrder(b) || a.localeCompare(b, 'zh-Hant'));
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
  diet: '<path d="M3.5 11.5h17a8.5 8.5 0 0 1-17 0z"/><path d="M8.5 8c0-1.2 1.2-1.6 1.2-3M12.5 8c0-1.2 1.2-1.6 1.2-3"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  copy: '<rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2.5"/><path d="M15.5 8.5V6.5a2.5 2.5 0 0 0-2.5-2.5H6.5A2.5 2.5 0 0 0 4 6.5V13a2.5 2.5 0 0 0 2.5 2.5h2"/>',
  dumbbell: '<path d="M7 12h10"/><rect x="4" y="8" width="3" height="8" rx="1"/><rect x="17" y="8" width="3" height="8" rx="1"/><path d="M2.5 10.5v3M21.5 10.5v3"/>',
};
const icon = (name, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICON[name]}</svg>`;

// 常吃食物的起始清單（數字是概略值，使用者可以刪改）
const DEFAULT_FOODS = [
  ['雞胸肉（100g）', 165, 31], ['乳清蛋白（1 匙）', 120, 24], ['雞蛋（1 顆）', 75, 7],
  ['無糖豆漿（400ml）', 140, 14], ['希臘優格（100g）', 100, 10], ['白飯（1 碗）', 280, 5],
];
const defaultFoods = () => DEFAULT_FOODS.map(([name, kcal, protein]) => ({ id: uid(), name, kcal, protein }));
const DEFAULT_GOALS = { proteinPerKg: 2, kcal: null };

// ---------- storage ----------
function freshDb() {
  return { defaultsVersion: DEFAULTS_VERSION, exercises: defaultExercises(), workouts: [], body: [], foods: defaultFoods(), meals: [], goals: { ...DEFAULT_GOALS } };
}
function normalize(d) {
  if (!d || typeof d !== 'object') throw new Error('格式不對');
  const out = {
    defaultsVersion: +d.defaultsVersion || 1,
    exercises: Array.isArray(d.exercises) ? d.exercises.filter(e => e && e.name).map(e => {
      // 舊版是單一 category，新版是 categories 陣列（第一個是主要部位）
      const cats = Array.isArray(e.categories) ? e.categories : [e.category];
      const clean = [...new Set(cats.map(c => String(c || '').trim()).filter(Boolean))];
      return { name: String(e.name), categories: clean.length ? clean : ['其他'] };
    }) : [],
    workouts: Array.isArray(d.workouts) ? d.workouts.filter(w => w && w.date && w.exercise) : [],
    body: Array.isArray(d.body) ? d.body.filter(b => b && b.date) : [],
    // 舊資料沒有飲食欄位：給起始的常吃清單
    foods: Array.isArray(d.foods) ? d.foods.filter(f => f && f.name) : defaultFoods(),
    meals: Array.isArray(d.meals) ? d.meals.filter(m => m && m.date) : [],
    goals: { ...DEFAULT_GOALS, ...(d.goals && typeof d.goals === 'object' ? d.goals : {}) },
  };
  out.workouts.forEach(w => { w.id ||= uid(); w.ts ||= 0; w.weight = +w.weight || 0; w.sets = +w.sets || 1; w.reps = +w.reps || 1; w.note ||= ''; });
  out.body.forEach(b => { b.id ||= uid(); b.ts ||= 0; b.note ||= ''; });
  out.foods.forEach(f => { f.id ||= uid(); f.name = String(f.name); f.kcal = +f.kcal || 0; f.protein = +f.protein || 0; });
  out.meals.forEach(m => { m.id ||= uid(); m.ts ||= 0; m.name = String(m.name || ''); m.kcal = +m.kcal || 0; m.protein = +m.protein || 0; m.qty = +m.qty || 1; });
  return migrate(out);
}
// 舊版只有 8 個動作：補上新的動作庫，舊動作和紀錄都保留
function migrate(d) {
  if (d.defaultsVersion >= DEFAULTS_VERSION) return d;
  for (const e of d.exercises) e.categories = e.categories.map(c => c === '手臂' ? '二頭' : c);
  for (const e of defaultExercises()) {
    const have = d.exercises.find(x => x.name === e.name);
    if (have) have.categories = e.categories;
    else d.exercises.push(e);
  }
  d.defaultsVersion = DEFAULTS_VERSION;
  return d;
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
persist(); // 寫回遷移後的動作清單
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

// ---------- state ----------
const state = {
  tab: 'log',
  editing: { history: false, body: false, exercises: false, diet: false, foods: false },
  dietDate: todayStr(),
  dietQty: 1,
  dietForm: { name: '', kcal: '', protein: '', fav: false },
  newFood: { name: '', kcal: '', protein: '' },
  chartMode: 'train',
  chartExercise: null,
  aiWeeks: 12, // 0 = 全部
  saved: { workout: false, body: false },
  form: { category: '', exercise: '', date: todayStr(), weight: 20, sets: 3, reps: 10, note: '' },
  bodyForm: { date: todayStr(), weight: '', bodyFat: '', muscle: '', note: '' },
  newEx: { name: '', categories: [] },
};

const catsOf = name => db.exercises.find(e => e.name === name)?.categories || ['其他'];
const catOf = name => catsOf(name)[0];
// 主要部位是這個部位的排前面，次要的排後面
const exercisesIn = cat => {
  const hits = db.exercises.filter(e => e.categories.includes(cat));
  return [...hits.filter(e => e.categories[0] === cat), ...hits.filter(e => e.categories[0] !== cat)].map(e => e.name);
};
const allCategories = () => sortCategories([...new Set([...CATEGORIES.filter(c => db.exercises.some(e => e.categories.includes(c))), ...db.exercises.flatMap(e => e.categories)])]);

// ---------- 飲食 ----------
const QTYS = [0.5, 1, 1.5, 2];
function dayTotals(date) {
  return db.meals.filter(m => m.date === date)
    .reduce((t, m) => ({ kcal: t.kcal + m.kcal, protein: t.protein + m.protein }), { kcal: 0, protein: 0 });
}
const latestWeight = () => db.body.filter(b => b.weight != null).sort(byNewest)[0]?.weight ?? null;
// 蛋白質目標 = 最新體重 × 每公斤克數；熱量目標使用者自己填
function goals() {
  const w = latestWeight();
  const perKg = parseNum(db.goals.proteinPerKg);
  return {
    protein: w && perKg ? Math.round(w * perKg) : null,
    kcal: parseNum(db.goals.kcal),
  };
}

// 換部位時：先選這個部位最近練過的動作，沒有就選第一個
function pickCategory(cat) {
  state.form.category = cat;
  const names = exercisesIn(cat);
  const recent = db.workouts.filter(w => names.includes(w.exercise)).sort(byNewest)[0];
  state.form.exercise = recent?.exercise || names[0] || '';
  fillFromLast(state.form.exercise);
}

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
  if (recent) {
    state.form.category = catOf(recent.exercise);
    state.form.exercise = recent.exercise;
    fillFromLast(recent.exercise);
  } else {
    pickCategory(allCategories()[0] || '其他');
  }
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
function plainSelect(field, options, selected, label) {
  const opts = options.map(o => `<option${o === selected ? ' selected' : ''}>${esc(o)}</option>`).join('');
  return `<span class="selectwrap"><select data-field="${field}" aria-label="${label}">${opts}</select>${icon('updown')}</span>`;
}
// 圖表用：只列有紀錄的動作，按部位分組
function exerciseSelect(field, selected, names) {
  const groups = {};
  for (const n of names) (groups[catOf(n)] ||= []).push(n);
  const opts = sortCategories(Object.keys(groups)).map(cat =>
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
    return `${title('記錄訓練', '<button class="linkbtn" data-act="tab" data-k="history">歷史</button>')}
      <section class="group">
        <label class="row"><span class="k">部位</span>${plainSelect('category', allCategories(), f.category, '部位')}</label>
        <label class="row"><span class="k">動作</span>${plainSelect('exercise', exercisesIn(f.category), f.exercise, '動作')}</label>
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
    const back = `<button class="backbtn" data-act="tab" data-k="log">${icon('back')}訓練</button>`;
    const right = db.workouts.length ? `<button class="linkbtn" data-act="toggleEdit" data-k="history">${editing ? '完成' : '編輯'}</button>` : '';
    if (!db.workouts.length) {
      return back + title('歷史') + empty('dumbbell', '還沒有訓練紀錄', '存下第一組訓練之後，這裡會按日期排好。');
    }
    const days = {};
    for (const w of [...db.workouts].sort(byNewest)) (days[w.date] ||= []).push(w);
    return back + title('歷史', right) + Object.entries(days).map(([d, items]) => {
      const vol = items.reduce((s, w) => s + volume(w), 0);
      return `<div class="group-h"><span>${fmtDay(d)}</span><span>訓練量 ${fmtNum(vol)}</span></div>
        <section class="group">${items.map(w => workoutRow(w, editing)).join('')}</section>`;
    }).join('');
  },

  diet() {
    const d = state.dietDate;
    const meals = db.meals.filter(m => m.date === d).sort((a, b) => b.ts - a.ts);
    const t = dayTotals(d);
    const g = goals();
    const f = state.dietForm;
    const editing = state.editing.diet;
    const canAdd = parseNum(f.kcal) !== null || parseNum(f.protein) !== null;
    const meter = (label, value, goal, unit, hint) => {
      const pct = goal ? Math.min(100, (value / goal) * 100) : 0;
      const left = goal ? goal - value : null;
      return `<div class="row meter">
        <div class="meter-top"><span class="k">${label}</span>
          <span class="meta"><b>${fmtNum(value)}</b>${goal ? ` / ${fmtNum(goal)}` : ''} ${unit}</span></div>
        ${goal ? `<div class="bar" role="progressbar" aria-label="${label}" aria-valuenow="${Math.round(value)}" aria-valuemax="${Math.round(goal)}"><span style="width:${pct}%"></span></div>
          <div class="sub">${left > 0 ? `還差 ${fmtNum(left)} ${unit}` : `已達標${left < 0 ? `，多 ${fmtNum(-left)} ${unit}` : ''}`}</div>`
          : `<div class="sub">${hint}</div>`}
      </div>`;
    };
    return `${title('飲食')}
      <section class="group">
        <label class="row"><span class="k">日期</span><input type="date" data-field="d.date" value="${d}" max="${todayStr()}"></label>
      </section>
      <section class="group">
        ${meter('蛋白質', t.protein, g.protein, 'g', '到「身體」填體重，就會自動算出蛋白質目標')}
        ${meter('熱量', t.kcal, g.kcal, 'kcal', '到「設定」填每日熱量目標')}
      </section>

      <div class="group-h"><span>常吃的食物 · 點一下加入</span></div>
      <section class="group">
        <div class="row"><span class="k">份量</span>
          <span class="seg mini" role="tablist" aria-label="份量">${QTYS.map(q =>
            `<button role="tab" aria-selected="${state.dietQty === q}" data-act="dietQty" data-d="${q}">×${q}</button>`).join('')}</span>
        </div>
        ${db.foods.length ? db.foods.map(food => `<button class="row entry food" data-act="addFood" data-id="${food.id}">
          <span class="main name">${esc(food.name)}</span>
          <span class="meta">${fmtNum(food.kcal * state.dietQty)} kcal · ${fmtNum(food.protein * state.dietQty)} g</span>
          ${icon('plus')}
        </button>`).join('') : '<div class="row"><span class="sub">還沒有常吃的食物，用下面的手動輸入加一個，並勾選「存成常吃的食物」。</span></div>'}
      </section>

      <div class="group-h"><span>手動輸入</span></div>
      <section class="group">
        <div class="row"><input class="full" data-field="d.name" placeholder="名稱，例如：雞腿便當" value="${esc(f.name)}" aria-label="食物名稱"></div>
        <div class="row"><label class="k" for="d-kcal">熱量</label>
          <span class="ctl"><input id="d-kcal" class="num" inputmode="decimal" autocomplete="off" placeholder="—" data-field="d.kcal" value="${esc(f.kcal)}"><span class="unit">kcal</span></span></div>
        <div class="row"><label class="k" for="d-protein">蛋白質</label>
          <span class="ctl"><input id="d-protein" class="num" inputmode="decimal" autocomplete="off" placeholder="—" data-field="d.protein" value="${esc(f.protein)}"><span class="unit">g</span></span></div>
        <div class="row"><span class="k">存成常吃的食物</span>
          <button class="chip" aria-pressed="${f.fav}" data-act="toggleFav">${f.fav ? '會存' : '不存'}</button></div>
      </section>
      <button class="primary" data-act="addMeal"${canAdd ? '' : ' disabled'}>加入${d === todayStr() ? '今天' : fmtShort(d)}的飲食</button>

      ${meals.length ? `<div class="group-h"><span>${d === todayStr() ? '今天' : fmtDay(d)}吃了 · ${meals.length} 筆</span><button class="linkbtn" data-act="toggleEdit" data-k="diet">${editing ? '完成' : '編輯'}</button></div>
        <section class="group">${meals.map(m => `<div class="row entry">
          <div class="main"><div class="name">${esc(m.name || '未命名')}${m.qty !== 1 ? ` ×${m.qty}` : ''}</div></div>
          <div class="meta">${fmtNum(m.kcal)} kcal · ${fmtNum(m.protein)} g</div>
          ${editing ? `<button class="del" data-act="delMeal" data-id="${m.id}">刪除</button>` : ''}
        </div>`).join('')}</section>` : ''}`;
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
      <button role="tab" aria-selected="${state.chartMode === 'diet'}" data-act="chartMode" data-k="diet">飲食</button>
      <button role="tab" aria-selected="${state.chartMode === 'body'}" data-act="chartMode" data-k="body">身體</button>
    </div>`;
    if (state.chartMode === 'diet') {
      const days = dietDays(30);
      if (!days.length) return title('圖表') + seg + empty('diet', '還沒有飲食紀錄', '到「飲食」分頁點常吃的食物，就會畫出每天的蛋白質和熱量。');
      const g = goals();
      const avg = k => Math.round(days.reduce((s, x) => s + x[k], 0) / days.length);
      const hit = g.protein ? days.filter(x => x.protein >= g.protein).length : null;
      return title('圖表') + seg + `
        <p class="summary">有記錄的 ${days.length} 天平均 <b>${fmtNum(avg('protein'))} g</b> 蛋白質、<b>${fmtNum(avg('kcal'))} kcal</b>${hit !== null ? ` · 蛋白質達標 <b>${hit} 天</b>` : ''}</p>
        <section class="group chart-card" style="margin-top:16px">
          <div class="chart-h"><h2>每日蛋白質（g）</h2><small>${g.protein ? `目標 ${g.protein} g` : '有記錄的日子'}</small></div>
          <div class="chart" data-chart="diet:protein"></div>
        </section>
        <section class="group chart-card">
          <div class="chart-h"><h2>每日熱量（kcal）</h2><small>${g.kcal ? `目標 ${fmtNum(g.kcal)} kcal` : '有記錄的日子'}</small></div>
          <div class="chart" data-chart="diet:kcal"></div>
        </section>`;
    }
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
    const nameOk = state.newEx.name.trim() && !db.exercises.some(e => e.name === state.newEx.name.trim());
    const picked = state.newEx.categories;
    // 依主要部位分組
    const groups = {};
    for (const e of db.exercises) (groups[e.categories[0]] ||= []).push(e);
    const w = latestWeight();
    const g = goals();
    const nf = state.newFood;
    const foodOk = nf.name.trim() && (parseNum(nf.kcal) !== null || parseNum(nf.protein) !== null);
    return `${title('設定')}
      <div class="group-h"><span>飲食目標</span></div>
      <section class="group">
        <div class="row"><label class="k" for="g-ppk">蛋白質</label>
          <span class="ctl"><input id="g-ppk" class="num" inputmode="decimal" autocomplete="off" data-field="g.proteinPerKg" value="${esc(db.goals.proteinPerKg ?? '')}"><span class="unit">g / 每公斤體重</span></span></div>
        <div class="row"><label class="k" for="g-kcal">熱量</label>
          <span class="ctl"><input id="g-kcal" class="num" inputmode="numeric" autocomplete="off" placeholder="—" data-field="g.kcal" value="${esc(db.goals.kcal ?? '')}"><span class="unit">kcal / 天</span></span></div>
      </section>
      <p class="foot" id="goal-foot">${w ? `以最新體重 ${fmtNum(w)} kg 計算，每天蛋白質目標 ${g.protein ?? '—'} g。` : '到「身體」填體重後，會自動算出蛋白質目標。'}增肌常見 1.6–2.2 g/kg。</p>

      <div class="group-h"><span>常吃的食物 · ${db.foods.length}</span><button class="linkbtn" data-act="toggleEdit" data-k="foods">${state.editing.foods ? '完成' : '編輯'}</button></div>
      <section class="group">
        ${db.foods.map(f => `<div class="row entry">
          <div class="main">${esc(f.name)}</div><div class="meta">${fmtNum(f.kcal)} kcal · ${fmtNum(f.protein)} g</div>
          ${state.editing.foods ? `<button class="del" data-act="delFood" data-id="${f.id}">刪除</button>` : ''}
        </div>`).join('')}
        <div class="row"><input class="full" data-field="f.name" placeholder="新增：名稱和份量，例如：茶葉蛋（1 顆）" value="${esc(nf.name)}" aria-label="食物名稱"></div>
        <div class="row"><label class="k" for="f-kcal">熱量</label>
          <span class="ctl"><input id="f-kcal" class="num" inputmode="decimal" autocomplete="off" placeholder="—" data-field="f.kcal" value="${esc(nf.kcal)}"><span class="unit">kcal</span></span></div>
        <div class="row"><label class="k" for="f-protein">蛋白質</label>
          <span class="ctl"><input id="f-protein" class="num" inputmode="decimal" autocomplete="off" placeholder="—" data-field="f.protein" value="${esc(nf.protein)}"><span class="unit">g</span></span></div>
        <button class="row action" data-act="addFoodItem"${foodOk ? '' : ' disabled'}>${icon('plus')}新增常吃的食物</button>
      </section>
      <p class="foot">起始清單的數字是概略值，依你吃的品牌和份量修改會更準。營養標示上的「每份」數字可以直接填。</p>

      <div class="group-h"><span>新增動作</span></div>
      <section class="group">
        <div class="row"><input class="full" data-field="n.name" placeholder="動作名稱，例如：腿推（單腳）" value="${esc(state.newEx.name)}" aria-label="動作名稱"></div>
        <div class="row chips-row">
          <span class="k">部位</span>
          <span class="chips" role="group" aria-label="部位（可複選）">${CATEGORIES.map(c => {
            const i = picked.indexOf(c);
            return `<button class="chip" aria-pressed="${i >= 0}" data-act="toggleNewCat" data-k="${c}">${c}${i === 0 && picked.length > 1 ? '・主' : ''}</button>`;
          }).join('')}</span>
        </div>
        <button class="row action" data-act="addExercise"${nameOk && picked.length ? '' : ' disabled'}>${icon('plus')}新增</button>
      </section>
      <p class="foot">可以選多個部位，第一個點的是主要部位。</p>

      <div class="group-h"><span>動作清單 · ${db.exercises.length}</span><button class="linkbtn" data-act="toggleEdit" data-k="exercises">${editing ? '完成' : '編輯'}</button></div>
      ${sortCategories(Object.keys(groups)).map(cat => `
        <div class="group-h"><span>${esc(cat)}</span></div>
        <section class="group">${groups[cat].map(e => `<div class="row entry">
          <div class="main">${esc(e.name)}</div>
          <div class="meta">${e.categories.length > 1 ? `也練 ${esc(e.categories.slice(1).join('、'))}` : ''}</div>
          ${editing ? `<button class="del" data-act="delExercise" data-name="${esc(e.name)}">刪除</button>` : ''}
        </div>`).join('')}</section>`).join('')}
      <p class="foot">刪除動作不會刪掉它的歷史紀錄。</p>

      <div class="group-h"><span>資料</span></div>
      <section class="group">
        <button class="row action" data-act="exportWorkouts">匯出訓練紀錄（CSV · ${db.workouts.length} 筆）</button>
        <button class="row action" data-act="exportBody">匯出身體數據（CSV · ${db.body.length} 筆）</button>
        <button class="row action" data-act="exportDiet">匯出飲食紀錄（CSV · ${db.meals.length} 筆）</button>
        <button class="row action" data-act="backup">備份全部資料（JSON）</button>
        <button class="row action" data-act="restore">從備份還原</button>
      </section>
      <p class="foot">資料只存在這支手機的瀏覽器裡。從主畫面刪除這個 App 會一起刪掉資料，記得偶爾備份到 iCloud 雲碟。CSV 可以直接傳給 Claude 分析。</p>`;
  },
};

// ---------- AI 分析 prompt ----------
const AI_RANGES = [[4, '近 4 週'], [12, '近 12 週'], [0, '全部']];

function aiSection() {
  if (!db.workouts.length && !db.body.length && !db.meals.length) return '';
  return `<div class="group-h"><span>請 AI 分析</span></div>
    <section class="group">
      <div class="row"><span class="k">範圍</span>
        <span class="seg mini" role="tablist" aria-label="分析範圍">${AI_RANGES.map(([w, label]) =>
          `<button role="tab" aria-selected="${state.aiWeeks === w}" data-act="aiRange" data-d="${w}">${label}</button>`).join('')}</span>
      </div>
      <button class="row action" data-act="copyPrompt">${icon('copy')}複製分析 prompt</button>
    </section>
    <p class="foot">把訓練、飲食和身體數據整理成一段文字，貼到 Claude 或 ChatGPT 就能拿到建議。</p>`;
}

function buildPrompt(weeks) {
  const asc = (a, b) => a.date.localeCompare(b.date) || a.ts - b.ts;
  let from = '';
  if (weeks) {
    const s = weekStart(new Date());
    s.setDate(s.getDate() - 7 * (weeks - 1));
    from = ymd(s);
  }
  const ws = db.workouts.filter(w => w.date >= from).sort(asc);
  const bs = db.body.filter(b => b.date >= from).sort(asc);
  const ds = dietDays(Infinity).filter(x => x.date >= from).reverse();
  const g = goals();
  const start = from || [ws[0]?.date, bs[0]?.date, ds[0]?.date].filter(Boolean).sort()[0] || todayStr();
  const spanWeeks = weeks || Math.max(1, Math.ceil((parseYmd(todayStr()) - parseYmd(start)) / (7 * 864e5)));
  const days = new Set(ws.map(w => w.date)).size;

  // 各部位組數：主要部位算整組，次要部位另外列
  const main = {}, assist = {};
  for (const w of ws) {
    const [first, ...rest] = catsOf(w.exercise);
    main[first] = (main[first] || 0) + w.sets;
    for (const c of rest) assist[c] = (assist[c] || 0) + w.sets;
  }
  const parts = sortCategories([...new Set([...CATEGORIES, ...Object.keys(main), ...Object.keys(assist)])])
    .map(c => `${c} ${main[c] || 0} 組${assist[c] ? `（另有 ${assist[c]} 組複合動作帶到）` : ''}`).join('、');

  const rangeLabel = weeks ? `近 ${weeks} 週` : '全部紀錄';
  const lines = [
    `你是我的重訓教練兼運動營養顧問。以下是我用健身紀錄 App 記下的資料（${rangeLabel}，${start} 到 ${todayStr()}）。請用繁體中文回答，具體一點，不要泛泛而談：`,
    '',
    '1. 訓練頻率與一致性：每週練幾天、有沒有中斷',
    '2. 各部位訓練量是否平衡，哪些部位練太少或太多',
    '3. 主要動作的進步：重量或訓練量有沒有上升、哪些動作停滯',
    '4. 飲食：蛋白質和熱量是否足夠、穩不穩定，跟我的目標合不合',
    '5. 身體組成（體重、體脂率、骨骼肌重）的變化，以及跟訓練和飲食的關係',
    '6. 接下來 2–4 週最值得調整的 3–5 件事（動作選擇、組數次數、頻率、休息、飲食）',
    '',
    '資料不夠判斷的地方，請直接告訴我要補充什麼。',
    '',
    '## 摘要',
    `- 期間：${start} 到 ${todayStr()}（約 ${spanWeeks} 週）`,
    `- 訓練天數：${days} 天，平均每週 ${fmtNum(days / spanWeeks)} 天`,
    `- 各部位每週平均組數：${sortCategories(Object.keys(main)).map(c => `${c} ${fmtNum(main[c] / spanWeeks)}`).join('、') || '無'}`,
    `- 各部位總組數：${parts}`,
  ];
  if (ds.length) {
    const avg = k => fmtNum(Math.round(ds.reduce((s, x) => s + x[k], 0) / ds.length));
    lines.push(`- 飲食：記錄了 ${ds.length} 天，平均每天 ${avg('protein')} g 蛋白質、${avg('kcal')} kcal`);
  }
  lines.push(`- 每日目標：蛋白質 ${g.protein ? `${g.protein} g（體重 × ${db.goals.proteinPerKg} g/kg）` : '未設定'}、熱量 ${g.kcal ? `${fmtNum(g.kcal)} kcal` : '未設定'}`);
  if (ws.length) {
    lines.push('', '## 訓練紀錄（CSV，重量單位 kg）', 'date,exercise,body_parts,weight_kg,sets,reps,note',
      ...ws.map(w => [w.date, w.exercise, catsOf(w.exercise).join('/'), w.weight, w.sets, w.reps, w.note].map(csvCell).join(',')));
  } else {
    lines.push('', '## 訓練紀錄', '這段期間沒有訓練紀錄。');
  }
  if (bs.length) {
    lines.push('', '## 身體數據（CSV，InBody 或體重計）', 'date,weight_kg,body_fat_pct,skeletal_muscle_kg,note',
      ...bs.map(b => [b.date, b.weight, b.bodyFat, b.muscle, b.note].map(csvCell).join(',')));
  } else {
    lines.push('', '## 身體數據', '這段期間沒有身體數據。');
  }
  if (ds.length) {
    lines.push('', '## 飲食（CSV，每日合計；沒列出的日子是沒記錄，不代表沒吃）', 'date,kcal,protein_g',
      ...ds.map(x => [x.date, Math.round(x.kcal), Math.round(x.protein)].join(',')));
  } else {
    lines.push('', '## 飲食', '這段期間沒有飲食紀錄。');
  }
  return lines.join('\n');
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    // 舊版 Safari 退回用隱藏的 textarea 複製
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

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
// 有記錄飲食的日子，新到舊，最多 limit 天
function dietDays(limit) {
  const byDate = {};
  for (const m of db.meals) {
    const t = (byDate[m.date] ||= { date: m.date, kcal: 0, protein: 0 });
    t.kcal += m.kcal;
    t.protein += m.protein;
  }
  return Object.values(byDate).sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
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
    } else if (kind.startsWith('diet:')) {
      const key = kind.slice(5), unit = key === 'protein' ? 'g' : 'kcal';
      const pts = dietDays(30).reverse()
        .map(x => ({ label: fmtShort(x.date), value: x[key], tip: `${fmtShort(x.date)} · ${fmtNum(x[key])} ${unit}` }));
      Charts.draw(c, pts, { type: 'bar', zero: true, target: goals()[key], ariaLabel: key === 'protein' ? '每日蛋白質' : '每日熱量' });
    }
  });
}

// ---------- render ----------
// 歷史從「訓練」頁右上角進入，不佔分頁
const TABS = [['log', '訓練'], ['diet', '飲食'], ['body', '身體'], ['charts', '圖表'], ['settings', '設定']];
function renderTabs() {
  const active = state.tab === 'history' ? 'log' : state.tab;
  $('#tabs').innerHTML = TABS.map(([k, label]) =>
    `<button role="tab" aria-selected="${active === k}" data-act="tab" data-k="${k}">${icon(k === 'log' ? 'dumbbell' : k)}<span>${label}</span></button>`).join('');
}
function render() {
  $('#view').innerHTML = views[state.tab]() + (state.tab === 'charts' ? aiSection() : '');
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
  aiRange: (_, w) => { state.aiWeeks = w; render(); },
  copyPrompt: async () => {
    const ok = await copyText(buildPrompt(state.aiWeeks));
    toast(ok ? '已複製，貼到 Claude 或 ChatGPT 就好' : '複製失敗，請再按一次');
  },
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
    if (!name || !state.newEx.categories.length || db.exercises.some(e => e.name === name)) return;
    db.exercises.push({ name, categories: [...state.newEx.categories] });
    persist();
    state.newEx = { name: '', categories: [] };
    render();
    toast(`已新增「${name}」`);
  },
  toggleNewCat: c => {
    const cats = state.newEx.categories;
    const i = cats.indexOf(c);
    if (i >= 0) cats.splice(i, 1); else cats.push(c);
    render();
  },
  exportWorkouts: () => shareFile(`workouts-${todayStr()}.csv`,
    toCsv(['date', 'exercise', 'weight_kg', 'sets', 'reps', 'volume', 'note'],
      [...db.workouts].sort((a, b) => a.date.localeCompare(b.date) || a.ts - b.ts).map(w => [w.date, w.exercise, w.weight, w.sets, w.reps, volume(w), w.note])),
    'text/csv'),
  exportBody: () => shareFile(`body-${todayStr()}.csv`,
    toCsv(['date', 'weight_kg', 'body_fat_pct', 'skeletal_muscle_kg', 'note'],
      [...db.body].sort((a, b) => a.date.localeCompare(b.date) || a.ts - b.ts).map(b => [b.date, b.weight, b.bodyFat, b.muscle, b.note])),
    'text/csv'),
  exportDiet: () => shareFile(`diet-${todayStr()}.csv`,
    toCsv(['date', 'food', 'qty', 'kcal', 'protein_g'],
      [...db.meals].sort((a, b) => a.date.localeCompare(b.date) || a.ts - b.ts).map(m => [m.date, m.name, m.qty, m.kcal, m.protein])),
    'text/csv'),
  dietQty: (_, q) => { state.dietQty = q; render(); },
  addFood: (_, __, el) => {
    const food = db.foods.find(f => f.id === el.dataset.id);
    if (!food) return;
    const q = state.dietQty;
    const meal = { id: uid(), ts: Date.now(), date: state.dietDate, name: food.name, qty: q, kcal: food.kcal * q, protein: food.protein * q };
    db.meals.push(meal);
    if (!persist()) return;
    render();
    toast(`已加入 ${food.name}${q !== 1 ? ` ×${q}` : ''}`, () => { db.meals = db.meals.filter(m => m.id !== meal.id); persist(); render(); });
  },
  toggleFav: () => { state.dietForm.fav = !state.dietForm.fav; render(); },
  addMeal: () => {
    const f = state.dietForm;
    const kcal = parseNum(f.kcal) ?? 0, protein = parseNum(f.protein) ?? 0;
    const name = f.name.trim();
    db.meals.push({ id: uid(), ts: Date.now(), date: state.dietDate, name, qty: 1, kcal, protein });
    const savedFav = f.fav && name && !db.foods.some(x => x.name === name);
    if (savedFav) db.foods.push({ id: uid(), name, kcal, protein });
    if (!persist()) return;
    state.dietForm = { name: '', kcal: '', protein: '', fav: false };
    render();
    toast(savedFav ? `已加入，也存成常吃的食物` : '已加入');
  },
  delMeal: (_, __, el) => removeWith('meals', el.dataset.id, '一筆飲食'),
  delFood: (_, __, el) => removeWith('foods', el.dataset.id, '常吃的食物'),
  addFoodItem: () => {
    const nf = state.newFood;
    const name = nf.name.trim();
    if (!name) return;
    db.foods.push({ id: uid(), name, kcal: parseNum(nf.kcal) ?? 0, protein: parseNum(nf.protein) ?? 0 });
    persist();
    state.newFood = { name: '', kcal: '', protein: '' };
    render();
    toast(`已新增「${name}」`);
  },
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
  else if (field === 'd.date') state.dietDate = value || todayStr();
  else if (field.startsWith('d.')) state.dietForm[field.slice(2)] = value;
  else if (field.startsWith('f.')) state.newFood[field.slice(2)] = value;
  else if (field.startsWith('g.')) { db.goals[field.slice(2)] = value.trim() === '' ? null : parseNum(value); persist(); }
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
    if (btn) btn.disabled = !name || !state.newEx.categories.length || db.exercises.some(e => e.name === name);
  } else if (field.startsWith('d.') && field !== 'd.date') {
    const btn = $('[data-act="addMeal"]');
    if (btn) btn.disabled = parseNum(state.dietForm.kcal) === null && parseNum(state.dietForm.protein) === null;
  } else if (field.startsWith('f.')) {
    const btn = $('[data-act="addFoodItem"]');
    const nf = state.newFood;
    if (btn) btn.disabled = !nf.name.trim() || (parseNum(nf.kcal) === null && parseNum(nf.protein) === null);
  } else if (field.startsWith('g.')) {
    const foot = $('#goal-foot');
    const w = latestWeight(), g = goals();
    if (foot && w) foot.textContent = `以最新體重 ${fmtNum(w)} kg 計算，每天蛋白質目標 ${g.protein ?? '—'} g。增肌常見 1.6–2.2 g/kg。`;
  }
});
document.addEventListener('change', ev => {
  const field = ev.target.dataset?.field;
  if (field) setField(field, ev.target.value);
  if (field === 'category') { pickCategory(state.form.category); render(); }
  if (field === 'exercise') { fillFromLast(state.form.exercise); render(); }
  if (field === 'chartExercise' || field === 'd.date') render();
});

$('#importFile').addEventListener('change', async ev => {
  const file = ev.target.files[0];
  ev.target.value = '';
  if (!file) return;
  try {
    const next = normalize(JSON.parse(await file.text()));
    const ok = confirm(`用備份取代目前的資料？\n\n備份裡有 ${next.workouts.length} 筆訓練、${next.meals.length} 筆飲食、${next.body.length} 筆身體數據。\n目前的 ${db.workouts.length} 筆訓練、${db.meals.length} 筆飲食、${db.body.length} 筆身體數據會被取代。`);
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
  // 新版接手時重新載入一次，不用手動關掉再開
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    location.reload();
  });
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
    .then(reg => reg.update())
    .catch(() => {});
}

render();
