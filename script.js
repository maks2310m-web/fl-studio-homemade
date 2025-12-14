/* =========================================================
  TIME SYSTEM
   ========================================================= */

// 4 beats per bar → 384 ticks
const BEATS_PER_BAR = 4;

const TICKS_PER_BEAT = 96;
const TICKS_PER_BAR  = BEATS_PER_BAR * TICKS_PER_BEAT;

// STEP = 1/4 beat
const STEPS_PER_BEAT = 4;
const TICKS_PER_STEP = TICKS_PER_BEAT / STEPS_PER_BEAT; // 24

const MIN_NOTE_TICKS = 1;
const DEFAULT_NOTE_TICKS = 6;

// Pattern length
let BARS_TOTAL  = 4;
let TOTAL_TICKS = BARS_TOTAL * TICKS_PER_BAR;


/* =========================================================
  VISUAL GRID SETTINGS
   ========================================================= */

const TICK_WIDTH  = 4;
const ROW_HEIGHT  = 20;
const ROWS        = 60; // 5 octaves × 12 notes (C2–B6)


/* =========================================================
  DOM ELEMENTS
   ========================================================= */

const grid      = document.getElementById("grid");
const cursor    = document.getElementById("cursor");
const playBtn   = document.getElementById("play");
const stopBtn = document.getElementById("stop")
const playIcon  = document.getElementById("playIcon");
const BPMInput  = document.getElementById("BPM");
const stopWatch = document.getElementById("stopWatch");
const metronomeBtn    = document.getElementById("metronome");
const pianoRoll = document.getElementById("piano-roll");
const followBtn = document.getElementById("follow");
const noteLane = document.getElementById("note-lane");
const audioInput = document.getElementById("audio");
const fileLabel = document.getElementById("fileLabel");

/* =========================================================
  AUDIO 
   ========================================================= */

const MetronomeSound = new Audio("audio/metronome-tick.wav");

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const masterGain = audioCtx.createGain();
masterGain.gain.value = 0.20;
masterGain.connect(audioCtx.destination);

/* --- Piano sample (default + user upload) --- */
const PIANO_SAMPLE_URL = "audio/piano-c4.mp3";
const ROOT_MIDI = 60; // C4

let pianoBuffer = null;
let pianoLoadingPromise = null;

async function setPianoBufferFromArrayBuffer(arrayBuffer) {
  try {
    const decoded = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
    pianoBuffer = decoded;
    pianoLoadingPromise = null;
    return true;
  } catch (err) {
    console.log("decodeAudioData error:", err);
    return false;
  }
}

async function ensurePianoLoaded() {
  if (pianoBuffer) return true;

  if (!pianoLoadingPromise) {
    pianoLoadingPromise = fetch("audio/Piano_C4.wav")
      .then(r => r.arrayBuffer())
      .then(ab => setPianoBufferFromArrayBuffer(ab))
      .catch(err => {
        console.log("Piano sample load error:", err);
        return false;
      });
  }

  return pianoLoadingPromise;
}

function playPiano(noteObj) {
  if (!pianoBuffer) return false;

  const midi = rowToMidi(noteObj.row);
  const rate = Math.pow(2, (midi - ROOT_MIDI) / 12);

  const src = audioCtx.createBufferSource();
  src.buffer = pianoBuffer;
  src.playbackRate.value = rate;

  const gain = audioCtx.createGain();
  const now = audioCtx.currentTime;

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.18, now + 0.01);

  const durSec = (noteObj.lengthTicks * getTickMs()) / 1000;
  const stopAt = now + Math.max(0.03, durSec);

  gain.gain.exponentialRampToValueAtTime(0.0001, Math.max(now + 0.02, stopAt - 0.02));

  src.connect(gain);
  gain.connect(masterGain);

  src.start(now);
  src.stop(stopAt);

  return true;
}

/* --- user upload hook --- */
if (audioInput) {
  audioInput.addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (audioCtx.state === "suspended") await audioCtx.resume();

    const ab = await file.arrayBuffer();
    const ok = await setPianoBufferFromArrayBuffer(ab);

    if (fileLabel) {
      fileLabel.textContent = ok ? file.name : "LOAD ERROR";
    }
  });
}




/* =========================================================
  NOTES
   ========================================================= */

const MIDI_C2 = 36;
const MIDI_B6 = 95;
function rowToMidi(row) {
  return MIDI_B6 - row;
}
//Pitch for each note
function midiToFreq(midi) {
  return 440 * Math.pow(2,(midi -69) /12);
}

/* =========================================================
  NOTE LANING
   ========================================================= */
const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

function midiToName(midi) {
  const name = NOTE_NAMES[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

function renderNoteLane() {
  if (!noteLane) return;

  noteLane.innerHTML = "";

  for (let row = 0; row < ROWS; row++) {
    const midi = rowToMidi(row);
    const label = document.createElement("div");
    label.className = "note-label";

    // подсветка "черных" клавиш
    const n = midi % 12;
    if ([1,3,6,8,10].includes(n)) label.classList.add("black");

    label.textContent = midiToName(midi);
    noteLane.appendChild(label);
  }
}

renderNoteLane();


/* =========================================================
  APP STATE
   ========================================================= */
let followCursorOn = false;
let isPlaying    = false;
let currentTick  = 0;
let playInterval = null;
let BPM = Number(BPMInput.value) || 120;

// notes stored in TICKS
let notes = [];

// metronome
let metronomeOn      = false;
let metronomeTimerId = null;


/* =========================================================
  GRID SETUP
   ========================================================= */

grid.style.width  = `${TICK_WIDTH * TOTAL_TICKS}px`;
grid.style.height = `${ROW_HEIGHT * ROWS}px`;

grid.addEventListener("contextmenu", (e) => e.preventDefault());


/* =========================================================
  TIME / TRANSPORT
   ========================================================= */

function getTickMs() {
  const beatMs = 60000 / BPM;
  return beatMs / TICKS_PER_BEAT;
}

function triggerNotesAtTick(tick) {
  for (const note of notes) {
    if (note.startTick === tick) {

      if (audioCtx.state === "suspended") audioCtx.resume();

      ensurePianoLoaded().then(() => {
        playPiano(note);
      });

      flashNote(note);
    }
  }
}

function flashNote(noteObj) {
  noteObj.el.classList.add("playing");
  setTimeout(() => noteObj.el.classList.remove("playing"), 120);
}


function moveCursorToTick(tick) {
  if (tick < 0) tick = 0;
  if (tick >= TOTAL_TICKS) tick = TOTAL_TICKS - 1;
  cursor.style.left = (tick * TICK_WIDTH) + "px";
}

function startPlayback() {

  moveCursorToTick(currentTick);
  updateTimeDisplay();
  triggerNotesAtTick(currentTick);

  if (playInterval) clearInterval(playInterval);

  playInterval = setInterval(() => {
    
    currentTick++;

    if (currentTick >= TOTAL_TICKS) {
      currentTick = 0; // loop
    }

    moveCursorToTick(currentTick);
    followCursor();
    updateTimeDisplay();

    // later: trigger notes here
  triggerNotesAtTick(currentTick);
  }, getTickMs());
}

function stopPlayback() {
  if (playInterval) {
    clearInterval(playInterval);
    playInterval = null;
  }
}


/* =========================================================
   TIMER (derived from currentTick)
   ========================================================= */

function updateTimeDisplay() {
  const totalMs = currentTick * getTickMs();

  const minutes = Math.floor(totalMs / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const cs      = Math.floor((totalMs % 1000) / 10);

  stopWatch.textContent =
    `${minutes.toString().padStart(2,"0")}:` +
    `${seconds.toString().padStart(2,"0")}:` +
    `${cs.toString().padStart(2,"0")}`;
}


/* =========================================================
   PLAY BUTTON / BPM, EVENT LISTENERS
   ========================================================= */

async function onPlay() {
  await audioCtx.resume();
  await ensurePianoLoaded();

  isPlaying = true;
  startPlayback();
  updateMetronome();
  playIcon.src = "img/Pause Button.svg";
}

function onPause() {
  isPlaying = false;
  stopPlayback();
  updateMetronome();
  playIcon.src = "img/Play Button.svg";
}

function togglePlay() {
  isPlaying ? onPause() : onPlay();
}

playBtn.addEventListener("click", togglePlay);

window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    togglePlay();
  }
});

BPMInput.addEventListener("input", () => {
  BPM = Number(BPMInput.value) || 120;
  if (isPlaying) startPlayback();
  updateMetronome();
});


stopBtn.addEventListener("click", () => {
  moveCursorToTick(currentTick);
  updateTimeDisplay();
  stopPlayback();
  updateMetronome();
  playIcon.src = "img/Play Button.svg";
  isPlaying = false;
});

followBtn.addEventListener("click", () => {
  followCursorOn = !followCursorOn;
  followBtn.classList.toggle("active", followCursorOn);
});



/* =========================================================
   FOLLOW CURSOR
   ========================================================= */
function followCursor() {
  if (!followCursorOn) return;

  const cursorX = currentTick * TICK_WIDTH;
  const viewLeft = pianoRoll.scrollLeft;
  const viewRight = viewLeft + pianoRoll.clientWidth;

  const margin = 80;

  if (cursorX < viewLeft + margin) {
    pianoRoll.scrollLeft = Math.max(0, cursorX - margin);
  } else if (cursorX > viewRight - margin) {
    pianoRoll.scrollLeft = cursorX - (pianoRoll.clientWidth - margin);
  }
}

    


/* =========================================================
   NOTES (tick-based)
   ========================================================= */

function hasOverlap(row, startTick, lengthTicks, ignoreNoteObj = null) {
  const end = startTick + lengthTicks;

  for (const n of notes) {
    if (n === ignoreNoteObj) continue;
    if (n.row !== row) continue;

    const nStart = n.startTick;
    const nEnd = n.startTick + n.lengthTicks;

    // пересечение интервалов (start,end)
    if (startTick < nEnd && end > nStart) {
      return true;
    }
  }
  return false;
}

   
grid.addEventListener("click", (e) => {
  if (e.target !== grid) return;

  const startTick = Math.floor(e.offsetX / TICK_WIDTH);
  const row       = Math.floor(e.offsetY / ROW_HEIGHT);

if (hasOverlap(row, startTick, DEFAULT_NOTE_TICKS)) return;
createNote(startTick, row, DEFAULT_NOTE_TICKS);
});

function createNote(startTick, row, lengthTicks) {
  lengthTicks = Number(lengthTicks);
  if (!Number.isFinite(lengthTicks) || lengthTicks < MIN_NOTE_TICKS) lengthTicks = MIN_NOTE_TICKS;

  const note = document.createElement("div");
  note.className = "note";

  note.style.left  = `${startTick * TICK_WIDTH + 1}px`;
  note.style.top   = `${row * ROW_HEIGHT + 1}px`;
  note.style.width = `${lengthTicks * TICK_WIDTH - 2}px`;

  const handleLeft = document.createElement("div");
  handleLeft.className = "resize-handle left";

  const handleRight = document.createElement("div");
  handleRight.className = "resize-handle right";

  note.appendChild(handleLeft);
  note.appendChild(handleRight);

  grid.appendChild(note);

  const noteObj = { el: note, startTick, lengthTicks, row };
  notes.push(noteObj);

  setupNoteResize(noteObj);
  setupNoteDrag(noteObj);

  note.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    removeNote(noteObj);
  });
}

function removeNote(noteObj) {
  grid.removeChild(noteObj.el);
  notes = notes.filter(n => n !== noteObj);
}

function setupNoteResize(noteObj) {

  let isResizing = false;
  let resizeSide = null; // "left" | "right"

  let startX = 0;
  let startTick = 0;
  let startLength = 0;

  const leftHandle = noteObj.el.querySelector(".resize-handle.left");
  const rightHandle = noteObj.el.querySelector(".resize-handle.right");

  leftHandle.addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation();

    isResizing = true;
    resizeSide = "left";

    startX = e.clientX;
    startTick = noteObj.startTick;
    startLength = noteObj.lengthTicks;

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  });

  rightHandle.addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation();

    isResizing = true;
    resizeSide = "right";

    startX = e.clientX;
    startTick = noteObj.startTick;
    startLength = noteObj.lengthTicks;

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  });

  function onMove(e) {
    if (!isResizing) return;

    const deltaTicks = Math.round((e.clientX - startX) / TICK_WIDTH);

    if (resizeSide === "right") {
      let newLen = startLength + deltaTicks;
      if (newLen < MIN_NOTE_TICKS) newLen = MIN_NOTE_TICKS;

      noteObj.lengthTicks = newLen;
    }

    if (resizeSide === "left") {
      let newStartTick = startTick + deltaTicks;
      let newLen = startLength - deltaTicks;

      if (newLen < MIN_NOTE_TICKS) {
        newLen = MIN_NOTE_TICKS;
        newStartTick = startTick + (startLength - MIN_NOTE_TICKS);
      }

      if (newStartTick < 0) {
        newLen += newStartTick;
        newStartTick = 0;
        if (newLen < MIN_NOTE_TICKS) newLen = MIN_NOTE_TICKS;
      }

      noteObj.startTick = newStartTick;
      noteObj.lengthTicks = newLen;
    }

    if (noteObj.startTick + noteObj.lengthTicks > TOTAL_TICKS) {
      noteObj.lengthTicks = TOTAL_TICKS - noteObj.startTick;
      if (noteObj.lengthTicks < MIN_NOTE_TICKS) {
        noteObj.lengthTicks = MIN_NOTE_TICKS;
        noteObj.startTick = Math.max(0, TOTAL_TICKS - MIN_NOTE_TICKS);
      }
    }

    noteObj.el.style.left  = `${noteObj.startTick * TICK_WIDTH + 1}px`;
    noteObj.el.style.width = `${noteObj.lengthTicks * TICK_WIDTH - 2}px`;
  }

  function onUp() {
    if (!isResizing) return;
    isResizing = false;

    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
  }
}

function setupNoteDrag(noteObj) {
  const note = noteObj.el;

  let dragging = false;
  let startMouseX = 0;
  let startMouseY = 0;

  let startTick = 0;
  let startRow = 0;

  note.addEventListener("mousedown", (e) => {
    // если клик по хэндлу — не начинаем drag
    if (e.target.closest(".resize-handle")) return;

    e.preventDefault();

    dragging = true;

    startMouseX = e.clientX;
    startMouseY = e.clientY;

    startTick = noteObj.startTick;
    startRow = noteObj.row;

    window.addEventListener("mousemove", onDragMove);
    window.addEventListener("mouseup", onDragEnd);
  });

  function onDragMove(e) {
    if (!dragging) return;

    const dx = e.clientX - startMouseX;
    const dy = e.clientY - startMouseY;

    const deltaTicks = Math.round(dx / TICK_WIDTH);
    const deltaRows  = Math.round(dy / ROW_HEIGHT);

    let newStartTick = startTick + deltaTicks;
    let newRow       = startRow + deltaRows;

    // clamp X: не выходить за ширину (учитываем длину ноты)
    const maxStartTick = TOTAL_TICKS - noteObj.lengthTicks;
    if (newStartTick < 0) newStartTick = 0;
    if (newStartTick > maxStartTick) newStartTick = maxStartTick;

    // clamp Y: 0..ROWS-1
    if (newRow < 0) newRow = 0;
    if (newRow > ROWS - 1) newRow = ROWS - 1;

    // update state
    noteObj.startTick = newStartTick;
    noteObj.row = newRow;

    // update DOM
    note.style.left = `${newStartTick * TICK_WIDTH + 1}px`;
    note.style.top  = `${newRow * ROW_HEIGHT + 1}px`;
  }

  function onDragEnd() {
    if (!dragging) return;
    dragging = false;

    window.removeEventListener("mousemove", onDragMove);
    window.removeEventListener("mouseup", onDragEnd);
  }
}

/* =========================================================
   METRONOME (simple beat click)
   ========================================================= */

function updateMetronome() {
  if (metronomeTimerId) {
    clearInterval(metronomeTimerId);
    metronomeTimerId = null;
  }

  if (!isPlaying || !metronomeOn || BPM <= 0) return;

  const interval = 60000 / BPM ;

  metronomeTimerId = setInterval(() => {
    MetronomeSound.currentTime = 0;
    MetronomeSound.play();
  }, interval);
}

metronomeBtn.addEventListener("click", () => {
  metronomeOn = !metronomeOn;
  metronomeBtn.classList.toggle("active", metronomeOn);
  updateMetronome();
});
