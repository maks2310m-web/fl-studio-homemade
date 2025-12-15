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

// SNAP: half-step = 1/8 beat = 12 ticks
const SNAP_TICKS = TICKS_PER_STEP / 2; // 12

const MIN_NOTE_TICKS     = SNAP_TICKS;     // минимальная длина ноты = 12 тиков
const DEFAULT_NOTE_TICKS = TICKS_PER_STEP; // дефолт = 1 step (24), можешь поменять на SNAP_TICKS если хочешь

// Pattern length
let BARS_TOTAL  = 4;
let TOTAL_TICKS = BARS_TOTAL * TICKS_PER_BAR;


/* =========================================================
  VISUAL GRID SETTINGS
   ========================================================= */

const TICK_WIDTH  = 2;
const ROW_HEIGHT  = 20;
const ROWS        = 60; // 5 octaves × 12 notes (C2–B6)


/* =========================================================
  DOM ELEMENTS
   ========================================================= */

const grid      = document.getElementById("grid");
const cursor    = document.getElementById("cursor");
const playBtn   = document.getElementById("play");
const stopBtn   = document.getElementById("stop");
const playIcon  = document.getElementById("playIcon");
const BPMInput  = document.getElementById("BPM");
const stopWatch = document.getElementById("stopWatch");
const metronomeBtn = document.getElementById("metronome");
const pianoRoll = document.getElementById("piano-roll");
const followBtn = document.getElementById("follow");
const noteLane  = document.getElementById("note-lane");
const audioInput = document.getElementById("audio");
const fileLabel  = document.getElementById("fileLabel");
const timeline = document.getElementById("timeline");
const timelineGrid = document.getElementById("timeline-grid");
const timelineCursor = document.getElementById("timeline-cursor");


/* =========================================================
  SNAP HELPERS (NOTES ONLY)
   ========================================================= */

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function snapTick(tick, mode = "round") {
  const q = tick / SNAP_TICKS;
  const snapped =
    mode === "floor" ? Math.floor(q) * SNAP_TICKS :
    mode === "ceil"  ? Math.ceil(q)  * SNAP_TICKS :
                       Math.round(q) * SNAP_TICKS;
  return snapped;
}

function snapLen(len) {
  let v = snapTick(len, "round");
  if (v < MIN_NOTE_TICKS) v = MIN_NOTE_TICKS;
  return v;
}


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
let pianoStartOffset = 0;

const MIN_NOTE_PLAY_SEC = 0.30;
const FADE_IN_SEC = 0.005;
const FADE_OUT_SEC = 0.02;

function findFirstSoundOffset(buffer, threshold = 0.001, maxSearchSec = 1.0) {
  const data = buffer.getChannelData(0);
  const sr = buffer.sampleRate;

  const limit = Math.min(data.length, Math.floor(maxSearchSec * sr));
  for (let i = 0; i < limit; i++) {
    const v = data[i];
    if (v > threshold || v < -threshold) return i / sr;
  }
  return 0;
}

let pianoLoadingPromise = null;

async function setPianoBufferFromArrayBuffer(arrayBuffer) {
  try {
    const decoded = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
    pianoBuffer = decoded;
    pianoStartOffset = findFirstSoundOffset(decoded);
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
    pianoLoadingPromise = fetch(PIANO_SAMPLE_URL)
      .then(r => r.arrayBuffer())
      .then(ab => setPianoBufferFromArrayBuffer(ab))
      .catch(err => {
        console.log("Piano sample load error:", err);
        return false;
      });
  }
  return pianoLoadingPromise;
}

function playPiano(noteObj, overrideDurSec = null) {
  if (!pianoBuffer) return false;

  const midi = rowToMidi(noteObj.row);
  const rate = Math.pow(2, (midi - ROOT_MIDI) / 12);

  const src = audioCtx.createBufferSource();
  src.buffer = pianoBuffer;
  src.playbackRate.value = rate;

  const gain = audioCtx.createGain();
  const now = audioCtx.currentTime;

  const durSecFromGrid = (noteObj.lengthTicks * getTickMs()) / 1000;
  const wanted = overrideDurSec != null
    ? overrideDurSec
    : Math.max(MIN_NOTE_PLAY_SEC, durSecFromGrid);

  const maxPossible = (pianoBuffer.duration - pianoStartOffset) / rate;
  const realDur = Math.max(0.03, Math.min(wanted, maxPossible));

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.18, now + FADE_IN_SEC);

  const stopAt = now + realDur;
  const releaseAt = Math.max(now + 0.02, stopAt - FADE_OUT_SEC);
  gain.gain.exponentialRampToValueAtTime(0.0001, releaseAt);

  src.connect(gain);
  gain.connect(masterGain);

  src.start(now, pianoStartOffset);
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

    if (fileLabel) fileLabel.textContent = ok ? file.name : "LOAD ERROR";
  });
}


/* =========================================================
  NOTES / PITCH
   ========================================================= */

const MIDI_C2 = 36;
const MIDI_B6 = 95;

function rowToMidi(row) {
  return MIDI_B6 - row;
}


/* =========================================================
  NOTE LANE
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
let isPlaying = false;
let currentTick = 0;
let playInterval = null;
let BPM = Number(BPMInput.value) || 120;

let notes = [];

let metronomeOn = false;
let metronomeTimerId = null;


/* =========================================================
  GRID SETUP
   ========================================================= */

grid.style.width  = `${TICK_WIDTH * TOTAL_TICKS}px`;
grid.style.height = `${ROW_HEIGHT * ROWS}px`;

if (timelineGrid) {
  timelineGrid.style.width = `${TICK_WIDTH * TOTAL_TICKS}px`;
  renderTimeline();
}
if (timeline) timeline.style.width = `${TICK_WIDTH * TOTAL_TICKS}px`;

grid.addEventListener("contextmenu", (e) => e.preventDefault());


/* =========================================================
  TIME / TRANSPORT (UNCHANGED: 1 tick step)
   ========================================================= */

function getTickMs() {
  const beatMs = 60000 / BPM;
  return beatMs / TICKS_PER_BEAT;
}

function triggerNotesAtTick(tick) {
  for (const note of notes) {
    if (note.startTick === tick) {
      if (audioCtx.state === "suspended") audioCtx.resume();
      ensurePianoLoaded().then(() => playPiano(note));
      flashNote(note);
    }
  }
}

function flashNote(noteObj) {
  noteObj.el.classList.add("playing");
  setTimeout(() => noteObj.el.classList.remove("playing"), 120);
}

function moveCursorToTick(tick) {
  tick = clamp(tick, 0, TOTAL_TICKS - 1);

  const x = (tick * TICK_WIDTH) + "px";
  cursor.style.left = x;
  if (timelineCursor) timelineCursor.style.left = x;
}

function startPlayback() {
  moveCursorToTick(currentTick);
  updateTimeDisplay();
  triggerNotesAtTick(currentTick);

  if (playInterval) clearInterval(playInterval);

  // важно: обратно по 1 тику (как было) — без доп. лагов
  playInterval = setInterval(() => {
    currentTick++;

    if (currentTick >= TOTAL_TICKS) currentTick = 0;

    moveCursorToTick(currentTick);
    followCursor();
    updateTimeDisplay();
    triggerNotesAtTick(currentTick);
  }, getTickMs());
}

function stopPlayback() {
  if (playInterval) {
    clearInterval(playInterval);
    playInterval = null;
  }
}

function renderTimeline() {
  if (!timelineGrid) return;

  timelineGrid.innerHTML = "";
  for (let b = 0; b < BARS_TOTAL; b++) {
    const label = document.createElement("div");
    label.className = "bar-label";
    label.textContent = (b + 1);

    const x = b * TICKS_PER_BAR * TICK_WIDTH + 6;
    label.style.left = x + "px";
    timelineGrid.appendChild(label);
  }
}


/* =========================================================
  TIMER
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
  PLAY BUTTON / BPM
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
  currentTick = 0;
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
  MOVE CURSOR FROM TIMELINE (unchanged)
   ========================================================= */

function setCursorFromTimelineClientX(clientX) {
  if (!timeline) return;

  const rect = timeline.getBoundingClientRect();
  const xInTimeline = clientX - rect.left;

  const x = xInTimeline + pianoRoll.scrollLeft;
  const tick = Math.floor(x / TICK_WIDTH);

  currentTick = clamp(tick, 0, TOTAL_TICKS - 1);
  moveCursorToTick(currentTick);
  updateTimeDisplay();
}

let timelineDragging = false;

if (timeline) {
  timeline.addEventListener("mousedown", (e) => {
    timelineDragging = true;
    setCursorFromTimelineClientX(e.clientX);
  });

  window.addEventListener("mousemove", (e) => {
    if (!timelineDragging) return;
    setCursorFromTimelineClientX(e.clientX);
  });

  window.addEventListener("mouseup", () => {
    timelineDragging = false;
  });
}


/* =========================================================
  NOTES (SNAP ONLY HERE)
   ========================================================= */

function hasOverlap(row, startTick, lengthTicks, ignoreNoteObj = null) {
  const end = startTick + lengthTicks;

  for (const n of notes) {
    if (n === ignoreNoteObj) continue;
    if (n.row !== row) continue;

    const nStart = n.startTick;
    const nEnd = n.startTick + n.lengthTicks;

    if (startTick < nEnd && end > nStart) return true;
  }
  return false;
}

grid.addEventListener("click", (e) => {
  if (e.target !== grid) return;

  const rawTick = Math.floor(e.offsetX / TICK_WIDTH);
  const startTick = snapTick(rawTick, "floor");
  const row = Math.floor(e.offsetY / ROW_HEIGHT);

  const len = snapLen(DEFAULT_NOTE_TICKS);

  if (hasOverlap(row, startTick, len)) return;
  createNote(startTick, row, len);
});

function createNote(startTick, row, lengthTicks) {
  startTick = snapTick(startTick, "round");
  lengthTicks = snapLen(lengthTicks);

  startTick = clamp(startTick, 0, TOTAL_TICKS - 1);
  if (startTick + lengthTicks > TOTAL_TICKS) {
    startTick = snapTick(TOTAL_TICKS - lengthTicks, "floor");
  }

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
  let resizeSide = null;

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

    const deltaTicksRaw = Math.round((e.clientX - startX) / TICK_WIDTH);

    let nextStart = noteObj.startTick;
    let nextLen = noteObj.lengthTicks;

    if (resizeSide === "right") {
      nextStart = startTick;
      nextLen = snapLen(startLength + deltaTicksRaw);
    }

    if (resizeSide === "left") {
      let newStart = startTick + deltaTicksRaw;
      let newLen = startLength - deltaTicksRaw;

      newStart = snapTick(newStart, "round");
      newLen = snapLen(newLen);

      if (newStart < 0) {
        newStart = 0;
        newLen = snapLen((startTick + startLength) - newStart);
      }

      nextStart = newStart;
      nextLen = newLen;
    }

    if (nextStart + nextLen > TOTAL_TICKS) {
      nextLen = snapLen(TOTAL_TICKS - nextStart);
      if (nextLen < MIN_NOTE_TICKS) {
        nextLen = MIN_NOTE_TICKS;
        nextStart = snapTick(TOTAL_TICKS - MIN_NOTE_TICKS, "floor");
      }
    }

    if (hasOverlap(noteObj.row, nextStart, nextLen, noteObj)) return;

    noteObj.startTick = nextStart;
    noteObj.lengthTicks = nextLen;

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

/* --- pitch preview on vertical change --- */
let lastPreviewAt = 0;
const PREVIEW_COOLDOWN_MS = 80;
function previewPitch(row) {
  const now = performance.now();
  if (now - lastPreviewAt < PREVIEW_COOLDOWN_MS) return;
  lastPreviewAt = now;

  if (audioCtx.state === "suspended") audioCtx.resume();
  ensurePianoLoaded().then(() => {
    // короткое превью (0.25s), чтобы не засирать звук
    playPiano({ row, lengthTicks: DEFAULT_NOTE_TICKS }, 0.25);
  });
}

function setupNoteDrag(noteObj) {
  const note = noteObj.el;

  let dragging = false;
  let startMouseX = 0;
  let startMouseY = 0;

  let startTick = 0;
  let startRow = 0;

  let lastRowPreviewed = noteObj.row;

  note.addEventListener("mousedown", (e) => {
    if (e.target.closest(".resize-handle")) return;

    e.preventDefault();

    dragging = true;

    startMouseX = e.clientX;
    startMouseY = e.clientY;

    startTick = noteObj.startTick;
    startRow = noteObj.row;

    lastRowPreviewed = noteObj.row;

    window.addEventListener("mousemove", onDragMove);
    window.addEventListener("mouseup", onDragEnd);
  });

  function onDragMove(e) {
    if (!dragging) return;

    const dx = e.clientX - startMouseX;
    const dy = e.clientY - startMouseY;

    const deltaTicksRaw = Math.round(dx / TICK_WIDTH);
    const deltaRows  = Math.round(dy / ROW_HEIGHT);

    let newStartTick = startTick + deltaTicksRaw;
    newStartTick = snapTick(newStartTick, "round");

    let newRow = startRow + deltaRows;

    const maxStartTick = TOTAL_TICKS - noteObj.lengthTicks;
    newStartTick = clamp(newStartTick, 0, maxStartTick);

    newRow = clamp(newRow, 0, ROWS - 1);

    if (hasOverlap(newRow, newStartTick, noteObj.lengthTicks, noteObj)) return;

    noteObj.startTick = newStartTick;
    noteObj.row = newRow;

    note.style.left = `${newStartTick * TICK_WIDTH + 1}px`;
    note.style.top  = `${newRow * ROW_HEIGHT + 1}px`;

    // preview when row changes
    if (newRow !== lastRowPreviewed) {
      lastRowPreviewed = newRow;
      previewPitch(newRow);
    }
  }

  function onDragEnd() {
    if (!dragging) return;
    dragging = false;

    window.removeEventListener("mousemove", onDragMove);
    window.removeEventListener("mouseup", onDragEnd);
  }
}


/* =========================================================
  METRONOME
   ========================================================= */

function updateMetronome() {
  if (metronomeTimerId) {
    clearInterval(metronomeTimerId);
    metronomeTimerId = null;
  }

  if (!isPlaying || !metronomeOn || BPM <= 0) return;

  const interval = 60000 / BPM;
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


/* =========================================================
  OPTIONAL: sync note-lane vertical scroll with piano-roll
   ========================================================= */
if (pianoRoll && noteLane) {
  pianoRoll.addEventListener("scroll", () => {
    noteLane.scrollTop = pianoRoll.scrollTop;
  });

  noteLane.addEventListener("wheel", (e) => {
    e.preventDefault();
    pianoRoll.scrollTop += e.deltaY;
  }, { passive: false });
}
