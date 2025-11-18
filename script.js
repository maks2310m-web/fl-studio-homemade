// Переменные в сетке 
const STEP_W = 40;  // ширина клетки
const ROW_H  = 25;  // высота строки
const STEPS  = 32;  // количество колонок (времени)
const ROWS   = 21;   // количество рядов (нот)

// хтмл элементы 
const grid     = document.getElementById("grid");
const cursor   = document.getElementById("cursor");
const playBtn  = document.getElementById("play");
const stopBtn  = document.getElementById("stop");
const playIcon = document.getElementById("playIcon");

// изменяемые значения
let notes = [];
let isPlaying = false;
let currentStep = 0;
let playInterval = null;
let BPM = 140;

// --- Размеры сетки ---
grid.style.width = `${STEP_W * STEPS}px`;
grid.style.height = `${ROW_H * ROWS}px`;

// --- Добавление ноты по клику ---
grid.addEventListener("click", (e) => {
  if (e.target !== grid) return; // чтобы не ставить на ноты
  const rect = grid.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const col = Math.floor(x / STEP_W);
  const row = Math.floor(y / ROW_H);
  createNote(col, row, 1);
});

// --- Создание ноты ---
function createNote(col, row, length = 1) {
  const note = document.createElement("div");
  note.className = "note";
  note.style.left = `${col * STEP_W +1}px`;
  note.style.top = `${row * ROW_H + 2}px`;
  note.style.width = `${length * STEP_W -0.9}px`;

  const handle = document.createElement("div");
  handle.className = "resize-handle";
  note.appendChild(handle);

  grid.appendChild(note);

  const noteObj = { el: note, col, row, length };
  notes.push(noteObj);

  note.addEventListener("dblclick", () => removeNote(noteObj));
}

// Remove note 
function removeNote(noteObj) {
  grid.removeChild(noteObj.el);
  notes = notes.filter(n => n !== noteObj);
}

//timer
function startCountdown(){
  timerId = setInterval ( () =>{
    let val = +s.
  })


//Play cursor
