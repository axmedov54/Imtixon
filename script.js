

/* =========================================================
   Dars jadvali — kesishgan darslarni aniqlash
   Vaqtlar ichkarida daqiqalarda saqlanadi (masalan 09:30 -> 570)
   ========================================================= */

const STORAGE_KEY = "darslar-kesishuvi-v1";
const DAYS = ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba"];

const form = document.getElementById("lesson-form");
const nameInput = document.getElementById("name");
const dayInput = document.getElementById("day");
const startInput = document.getElementById("start");
const endInput = document.getElementById("end");
const nameError = document.getElementById("name-error");
const startError = document.getElementById("start-error");
const endError = document.getElementById("end-error");
const formError = document.getElementById("form-error");
const statusBox = document.getElementById("status");
const tbody = document.getElementById("lessons-body");
const emptyBox = document.getElementById("empty");
const summary = document.getElementById("summary");
const summaryText = document.getElementById("summary-text");
const conflictList = document.getElementById("conflict-list");
const timelinePanel = document.getElementById("timeline-panel");
const timelineBox = document.getElementById("timeline");
const demoBtn = document.getElementById("demo-btn");
const clearBtn = document.getElementById("clear-btn");

let lessons = load();
let nextId = lessons.reduce((m, l) => Math.max(m, l.id), 0) + 1;

/* ---------- Yordamchi funksiyalar ---------- */

function toMinutes(value) {            // "09:30" -> 570
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

function fmt(min) {                    // 570 -> "09:30"
  const h = String(Math.floor(min / 60)).padStart(2, "0");
  const m = String(min % 60).padStart(2, "0");
  return `${h}:${m}`;
}

function fmtDuration(min) {            // 90 -> "1 soat 30 daqiqa"
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h} soat ${m} daqiqa`;
  if (h) return `${h} soat`;
  return `${m} daqiqa`;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/* Ikki dars kesishadimi? Faqat bir xil kunda va vaqti ustma-ust tushsa.
   Biri tugagan zahoti ikkinchisi boshlansa — kesishmaydi. */
function overlapOf(a, b) {
  if (a.day !== b.day) return null;
  const s = Math.max(a.start, b.start);
  const e = Math.min(a.end, b.end);
  return s < e ? { start: s, end: e } : null;
}

function findConflicts(list) {
  const pairs = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const o = overlapOf(list[i], list[j]);
      if (o) pairs.push({ a: list[i], b: list[j], overlap: o });
    }
  }
  return pairs;
}

function sorted(list) {
  return [...list].sort((x, y) => x.day - y.day || x.start - y.start || x.end - y.end || x.id - y.id);
}

/* ---------- Saqlash ---------- */

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data
      .map(l => (l && l.day === undefined ? { ...l, day: 0 } : l))
      .filter(l =>
        l && typeof l.name === "string" &&
        Number.isInteger(l.day) && l.day >= 0 && l.day <= 6 &&
        Number.isInteger(l.start) && Number.isInteger(l.end) && l.end > l.start
      );
  } catch (_) {
    return [];
  }
}

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(lessons)); } catch (_) { /* ruxsat yo'q */ }
}

/* ---------- Xatolarni ko'rsatish ---------- */

function setFieldError(input, box, message) {
  box.textContent = message || "";
  if (message) input.setAttribute("aria-invalid", "true");
  else input.removeAttribute("aria-invalid");
}

function clearErrors() {
  setFieldError(nameInput, nameError, "");
  setFieldError(startInput, startError, "");
  setFieldError(endInput, endError, "");
  formError.textContent = "";
  startInput.removeAttribute("aria-invalid");
  endInput.removeAttribute("aria-invalid");
}

function showStatus(message, warn) {
  statusBox.textContent = message;
  statusBox.classList.toggle("warn", !!warn);
}

/* ---------- Tekshiruv ---------- */

function validate() {
  clearErrors();
  const name = nameInput.value.trim();
  let firstBad = null;

  if (!name) {
    setFieldError(nameInput, nameError, "Dars nomini kiriting.");
    firstBad = firstBad || nameInput;
  }
  if (!startInput.value) {
    setFieldError(startInput, startError, "Boshlanish vaqtini tanlang.");
    firstBad = firstBad || startInput;
  }
  if (!endInput.value) {
    setFieldError(endInput, endError, "Tugash vaqtini tanlang.");
    firstBad = firstBad || endInput;
  }

  if (startInput.value && endInput.value) {
    const s = toMinutes(startInput.value);
    const e = toMinutes(endInput.value);
    if (e < s) {
      formError.textContent =
        `Tugash vaqti (${fmt(e)}) boshlanish vaqtidan (${fmt(s)}) oldin bo'lishi mumkin emas. ` +
        `Dars boshlanganidan keyin tugashi kerak — vaqtlarni tekshirib qayta kiriting.`;
      startInput.setAttribute("aria-invalid", "true");
      endInput.setAttribute("aria-invalid", "true");
      firstBad = firstBad || endInput;
    } else if (e === s) {
      formError.textContent =
        `Boshlanish va tugash vaqti bir xil (${fmt(s)}). Dars kamida 1 daqiqa davom etishi kerak.`;
      startInput.setAttribute("aria-invalid", "true");
      endInput.setAttribute("aria-invalid", "true");
      firstBad = firstBad || endInput;
    }
  }

  if (firstBad) {
    firstBad.focus();
    return null;
  }
  return { name, day: Number(dayInput.value), start: toMinutes(startInput.value), end: toMinutes(endInput.value) };
}

/* ---------- Chizish ---------- */

function render() {
  const list = sorted(lessons);
  const pairs = findConflicts(list);

  // Har bir darsning kim bilan kesishishi
  const partners = new Map(list.map(l => [l.id, []]));
  pairs.forEach(p => {
    partners.get(p.a.id).push(p.b);
    partners.get(p.b.id).push(p.a);
  });

  renderTable(list, partners);
  renderSummary(list, pairs);
  renderTimeline(list, pairs);
}

function renderTable(list, partners) {
  tbody.replaceChildren();
  emptyBox.hidden = list.length > 0;

  list.forEach((l, i) => {
    const tr = document.createElement("tr");
    const withOthers = partners.get(l.id);
    const bad = withOthers.length > 0;
    if (bad) tr.classList.add("conflict");

    tr.append(
      el("td", "", String(i + 1)),
      el("td", "", DAYS[l.day]),
      el("td", "name", l.name),
      el("td", "", fmt(l.start)),
      el("td", "", fmt(l.end)),
      el("td", "", fmtDuration(l.end - l.start))
    );

    const status = document.createElement("td");
    if (bad) {
      status.append(el("span", "badge bad", "Kesishadi"));
      status.append(el("span", "with", "bilan: " + withOthers.map(o => o.name).join(", ")));
    } else {
      status.append(el("span", "badge ok", "Kesishmaydi"));
    }
    tr.append(status);

    const actions = document.createElement("td");
    const del = el("button", "del", "O'chirish");
    del.type = "button";
    del.setAttribute("aria-label", `“${l.name}” darsini o'chirish`);
    del.addEventListener("click", () => removeLesson(l.id));
    actions.append(del);
    tr.append(actions);

    tbody.append(tr);
  });
}

function renderSummary(list, pairs) {
  summary.classList.remove("is-clear", "is-conflict", "is-empty");
  conflictList.replaceChildren();

  if (list.length === 0) {
    summary.classList.add("is-empty");
    summaryText.textContent = "Darslar kiritilgach, kesishuvlar shu yerda ko'rinadi.";
    return;
  }
  if (list.length === 1) {
    summary.classList.add("is-clear");
    summaryText.textContent = "Bitta dars bor, kesishish mumkin emas. Yana dars qo'shing.";
    return;
  }
  if (pairs.length === 0) {
    summary.classList.add("is-clear");
    summaryText.textContent = "Darslar kesishmaydi — hammasi alohida vaqtda.";
    return;
  }

  summary.classList.add("is-conflict");
  const involved = new Set();
  pairs.forEach(p => { involved.add(p.a.id); involved.add(p.b.id); });
  summaryText.textContent =
    `${pairs.length} ta kesishuv topildi. Jami ${involved.size} ta dars bir vaqtga tushib qolgan.`;

  pairs.forEach(p => {
    const li = document.createElement("li");
    const strong1 = el("b", "", p.a.name);
    const strong2 = el("b", "", p.b.name);
    li.append(el("span", "day-tag", DAYS[p.a.day]));
    li.append(strong1, " va ", strong2, " darslari kesishadi");
    li.append(el("span", "when",
      `Umumiy vaqt: ${fmt(p.overlap.start)} – ${fmt(p.overlap.end)} (${fmtDuration(p.overlap.end - p.overlap.start)})`));
    conflictList.append(li);
  });
}

function renderTimeline(list, pairs) {
  timelineBox.replaceChildren();
  if (list.length === 0) {
    timelinePanel.hidden = true;
    return;
  }
  timelinePanel.hidden = false;

  const days = [...new Set(list.map(l => l.day))].sort((a, b) => a - b);
  days.forEach(day => {
    const dayLessons = list.filter(l => l.day === day);
    const dayPairs = pairs.filter(p => p.a.day === day);

    const block = el("div", "tl-day");
    const title = el("h3", "tl-day-title", DAYS[day]);
    if (dayPairs.length) title.classList.add("has-conflict");
    block.append(title);
    block.append(buildDayTimeline(dayLessons, dayPairs));
    timelineBox.append(block);
  });
}

function buildDayTimeline(list, pairs) {
  const box = el("div", "tl-body");

  const minStart = Math.min(...list.map(l => l.start));
  const maxEnd = Math.max(...list.map(l => l.end));
  const rs = Math.floor(minStart / 60) * 60;
  let re = Math.ceil(maxEnd / 60) * 60;
  if (re === rs) re = rs + 60;
  const range = re - rs;
  const step = range / 60 > 12 ? 120 : 60;
  const pct = v => ((v - rs) / range) * 100;

  box.style.setProperty("--grid-step", (step / range) * 100 + "%");

  // Vaqt o'qi
  const axis = el("div", "tl-axis");
  axis.setAttribute("aria-hidden", "true");
  for (let t = rs; t <= re; t += step) {
    const tick = el("span", "tl-tick", fmt(t));
    tick.style.left = pct(t) + "%";
    if (t === rs) tick.style.transform = "translateX(0)";
    if (t === re) tick.style.transform = "translateX(-100%)";
    axis.append(tick);
  }
  box.append(axis);

  // Qatorlar
  list.forEach(l => {
    const row = el("div", "tl-row");
    const label = el("span", "tl-label", l.name);
    label.title = l.name;
    row.append(label);

    const track = el("div", "tl-track");
    const bar = el("div", "tl-bar");
    bar.style.left = pct(l.start) + "%";
    bar.style.width = ((l.end - l.start) / range) * 100 + "%";

    const mine = pairs.filter(p => p.a.id === l.id || p.b.id === l.id);
    if (mine.length) bar.classList.add("has-conflict");
    mine.forEach(p => {
      const seg = el("div", "tl-over");
      seg.style.left = ((p.overlap.start - l.start) / (l.end - l.start)) * 100 + "%";
      seg.style.width = ((p.overlap.end - p.overlap.start) / (l.end - l.start)) * 100 + "%";
      bar.append(seg);
    });
    bar.title = `${l.name}: ${fmt(l.start)} – ${fmt(l.end)}`;

    track.append(bar);
    row.append(track);
    box.append(row);
  });
  return box;
}

/* ---------- Amallar ---------- */

function addLesson(data) {
  const before = findConflicts(lessons).length;
  const lesson = { id: nextId++, ...data };
  const hits = lessons.filter(l => overlapOf(l, lesson));
  lessons.push(lesson);
  if (typeof markPast === "function") markPast([lesson]);
  save();
  render();

  if (hits.length) {
    const first = hits[0];
    const o = overlapOf(first, lesson);
    const more = hits.length > 1 ? ` va yana ${hits.length - 1} ta dars bilan` : "";
    showStatus(
      `Diqqat: ${DAYS[lesson.day]} kuni “${lesson.name}” darsi “${first.name}”${more} kesishadi (${fmt(o.start)} – ${fmt(o.end)}).`,
      true
    );
    summary.classList.remove("pulse");
    void summary.offsetWidth;
    summary.classList.add("pulse");
  } else {
    showStatus(`“${lesson.name}” darsi qo'shildi.`, false);
  }
  return before;
}

function removeLesson(id) {
  const l = lessons.find(x => x.id === id);
  lessons = lessons.filter(x => x.id !== id);
  save();
  render();
  if (l) showStatus(`“${l.name}” darsi o'chirildi.`, false);
}

form.addEventListener("submit", e => {
  e.preventDefault();
  showStatus("");
  const data = validate();
  if (!data) return;
  addLesson(data);
  form.reset();
  dayInput.value = String(data.day);
  nameInput.focus();
});

// Foydalanuvchi tuzatishni boshlashi bilan xabarlar tozalanadi
[nameInput, startInput, endInput].forEach(input => {
  input.addEventListener("input", () => {
    if (input === nameInput) setFieldError(nameInput, nameError, "");
    if (input === startInput) setFieldError(startInput, startError, "");
    if (input === endInput) setFieldError(endInput, endError, "");
    formError.textContent = "";
    if (startInput.getAttribute("aria-invalid") && !startError.textContent) startInput.removeAttribute("aria-invalid");
    if (endInput.getAttribute("aria-invalid") && !endError.textContent) endInput.removeAttribute("aria-invalid");
  });
});

demoBtn.addEventListener("click", () => {
  const demo = [
    ["Matematika", 0, "08:30", "10:00"],
    ["Fizika", 0, "09:30", "11:00"],
    ["Ona tili", 0, "11:00", "12:00"],
    ["Ingliz tili", 1, "11:30", "12:30"],
    ["Informatika", 1, "11:00", "12:00"],
    ["Tarix", 2, "09:00", "10:00"]
  ];
  lessons = demo.map(([name, day, s, e], i) => ({ id: i + 1, name, day, start: toMinutes(s), end: toMinutes(e) }));
  nextId = lessons.length + 1;
  markPast(lessons);
  save();
  clearErrors();
  render();
  showStatus("Namuna darslar yuklandi.", false);
});

clearBtn.addEventListener("click", () => {
  if (lessons.length === 0) return;
  if (!confirm("Barcha darslar o'chirilsin?")) return;
  lessons = [];
  save();
  render();
  showStatus("Jadval tozalandi.", false);
});

render();

/* =========================================================
   Dars tugaganda ogohlantirish: ovoz + bildirishnoma + xabar
   ========================================================= */

const ALERT_KEY = "darslar-kesishuvi-alert";
const alertToggle = document.getElementById("alert-toggle");
const alertHint = document.getElementById("alert-hint");
const nextEnd = document.getElementById("next-end");
const testBtn = document.getElementById("test-btn");
const toast = document.getElementById("toast");
const toastText = document.getElementById("toast-text");
const toastClose = document.getElementById("toast-close");

let alertOn = false;
try { alertOn = localStorage.getItem(ALERT_KEY) === "1"; } catch (_) {}
alertToggle.checked = alertOn;

const fired = new Set();      // bugun allaqachon xabar berilgan darslar
let audioCtx = null;
let toastTimer = null;

/* Brauzer ovozni faqat foydalanuvchi bosgandan keyin ruxsat qiladi */
function unlockAudio() {
  try {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audioCtx = new AC();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
  } catch (_) {}
}
["pointerdown", "keydown"].forEach(ev => document.addEventListener(ev, unlockAudio));

function playChime() {
  unlockAudio();
  if (!audioCtx) return;
  const notes = [659, 880, 1109];            // E5, A5, C#6
  [0, 1.1].forEach(offset => {               // ikki marta takrorlanadi
    notes.forEach((freq, i) => {
      const t = audioCtx.currentTime + offset + i * 0.24;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.35, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + 0.6);
    });
  });
}

/* O'zbek ovozi o'rnatilgan bo'lsagina gapirtiramiz */
function speak(text) {
  if (!("speechSynthesis" in window)) return;
  const voice = speechSynthesis.getVoices().find(v => v.lang && v.lang.toLowerCase().startsWith("uz"));
  if (!voice) return;
  const u = new SpeechSynthesisUtterance(text);
  u.voice = voice;
  u.lang = voice.lang;
  setTimeout(() => speechSynthesis.speak(u), 1500);   // qo'ng'iroqdan keyin
}

function showToast(text) {
  toastText.textContent = text;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 30000);
}
toastClose.addEventListener("click", () => { toast.hidden = true; });

function notify(title, body) {
  if ("Notification" in window && Notification.permission === "granted") {
    try { new Notification(title, { body, tag: "dars-tugadi" }); } catch (_) {}
  }
}

function lessonEnded(l) {
  const text = `“${l.name}” — dars tugadi`;
  playChime();
  notify("Dars tugadi", `“${l.name}” darsi ${fmt(l.end)} da tugadi.`);
  showToast(text);
  speak(text);
}

function updateHint() {
  if (!alertOn) {
    alertHint.textContent = "Yoqilsa, dars tugagan zahoti ovoz chalinadi va “dars tugadi” xabari chiqadi.";
    return;
  }
  let msg = "Ogohlantirish faqat sayt ochiq turganda ishlaydi.";
  if (!("Notification" in window)) {
    msg = "Bu brauzer bildirishnomani qo'llamaydi. Ovoz va sahifadagi xabar ishlaydi. " + msg;
  } else if (Notification.permission === "denied") {
    msg = "Bildirishnoma brauzerda bloklangan. Ovoz va sahifadagi xabar ishlaydi; bildirishnoma uchun sayt sozlamalaridan ruxsat bering. " + msg;
  } else if (Notification.permission === "default") {
    msg = "Bildirishnoma uchun brauzer ruxsat so'rashi mumkin. " + msg;
  } else {
    msg = "Bildirishnoma, ovoz va sahifadagi xabar yoqilgan. " + msg;
  }
  alertHint.textContent = msg;
}

/* Allaqachon tugab bo'lgan darslar uchun yangi xabar bermaslik */
function markPast(list) {
  const now = new Date();
  const today = (now.getDay() + 6) % 7;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  list.forEach(l => {
    if (l.day === today && l.end <= nowMin) fired.add(firedKey(now, l));
  });
}
function firedKey(now, l) { return `${now.toDateString()}-${l.id}-${l.end}`; }

function tick() {
  const now = new Date();
  const today = (now.getDay() + 6) % 7;

  if (alertOn) {
    lessons.forEach(l => {
      if (l.day !== today) return;
      const endAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, l.end, 0, 0);
      const diff = now - endAt;
      const key = firedKey(now, l);
      // 2 daqiqalik oyna: fon sahifada taymer sekinlashsa ham o'tkazib yubormaydi
      if (diff >= 0 && diff < 120000 && !fired.has(key)) {
        fired.add(key);
        lessonEnded(l);
      }
    });
  }
  updateNextEnd(now, today);
}

function updateNextEnd(now, today) {
  if (!alertOn) { nextEnd.textContent = ""; return; }
  const nowMin = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const upcoming = lessons
    .filter(l => l.day === today && l.end > nowMin)
    .sort((a, b) => a.end - b.end)[0];
  nextEnd.textContent = upcoming
    ? `Keyingi: “${upcoming.name}” soat ${fmt(upcoming.end)} da tugaydi.`
    : "Bugun tugashi kutilayotgan dars yo'q.";
}

alertToggle.addEventListener("change", () => {
  alertOn = alertToggle.checked;
  try { localStorage.setItem(ALERT_KEY, alertOn ? "1" : "0"); } catch (_) {}
  if (alertOn) {
    unlockAudio();
    markPast(lessons);
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().then(updateHint).catch(updateHint);
    }
  }
  updateHint();
  tick();
});

testBtn.addEventListener("click", () => {
  unlockAudio();
  const finish = () => {
    playChime();
    notify("Dars tugadi", "Sinov: “Namuna dars” darsi tugadi.");
    showToast("“Namuna dars” — dars tugadi (sinov)");
    updateHint();
  };
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission().then(finish).catch(finish);
  } else {
    finish();
  }
});

if ("speechSynthesis" in window) speechSynthesis.getVoices();   // ovozlar ro'yxatini oldindan yuklash

markPast(lessons);
updateHint();
setInterval(tick, 1000);
document.addEventListener("visibilitychange", tick);
tick();
