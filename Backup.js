//Global variables 

const STEP_WIDTH = 40; // Grid size (PX)
const ROW_HEIGHT = 20; //Grid Height
const STEPS_PER_BEAT = 4;
const STEPS = 40; //How much steps, increases time.
const ROWS = 28; // How much rows(notes), can be only a number divided by 7.

//HTML DOM elements

const grid     = document.getElementById("grid");
const cursor   = document.getElementById("cursor");

//Sound elements
const MetronomeSound = new Audio('audio/metronome-tick.wav')

const BPMInput = document.getElementById("BPM");
let BPM = Number(BPMInput.value) || 120;
BPMInput.addEventListener("input",() => {
  BPM = Number(BPMInput.value) || 0;
  console.log("BPM Changed to:", BPM)
});

// let Variables
let notes = [];
let isPlaying = false;
let currentStep = 0;
let playInterval = null;

function moveCursorToStep(step) {
  cursor.style.left = (step * STEP_WIDTH) + "px";
}

function getStepMs() {
  const beatMs = 60000 / BPM;
  return beatMs / STEPS_PER_BEAT;
}

function startPlayBack() {

  currentStep = 0;
  moveCursorToStep(currentStep);


  if (playInterval) {
    clearInterval(playInterval);
  }

  playInterval = setInterval(() => {
    currentStep++;


    if (currentStep >= STEPS) {
      isPlaying = false;
      pauseStopWatch();
      stopPlayBack();
      return;
    }

    // двигаем курсор
    moveCursorToStep(currentStep);

    // играем звук метронома, если есть
    
  }, getStepMs());
}

function stopPlayBack() {
  if (playInterval) {
    clearInterval(playInterval);
    playInterval = null;
  }
}




// Grid Size
grid.style.width = `${STEP_WIDTH * STEPS}px`;
grid.style.height = `${ROW_HEIGHT * ROWS}px`;


// Play Button 

const playBtn = document.getElementById("play");
const playIcon = document.getElementById("playIcon");

// Play Button Logic
playBtn.addEventListener("click", togglePlay);
// all events on play, i can easily add more of them if needed later
function onPlay() {
  isPlaying = true;
  startPlayBack();
  startStopWatch(true)

}
// all events on pause, i can easily add more of them if needed later
function onPause() {
  isPlaying = false;
pauseStopWatch();
stopPlayBack();
}

function togglePlay() {
if (!isPlaying) {
  onPlay(); 


  playIcon.src = "img/Pause Button.svg";
  playIcon.alt = "Pause";
  playBtn.title ="Pause";

} else {
  onPause();


  playIcon.src =  "img/Play Button.svg";
  playIcon.alt =  "Play";
  playBtn.title = "Play";
  }
}
//Event on spacebar
window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    togglePlay();
  }
})







// --- Добавление ноты по клику
grid.addEventListener("click", (e) => {
  if (e.target !== grid) return;

  const x = e.offsetX;
  const y = e.offsetY;

  const col = Math.floor(x / STEP_WIDTH);
  const row = Math.floor(y / ROW_HEIGHT);

  createNote(col, row, 1);
});

// Creating Note inside of the grid
function createNote(col, row, length = 1) {
  const note = document.createElement("div");
  note.className = "note";
  note.style.left = `${col * STEP_WIDTH +1.45}px`;
  note.style.top = `${row * ROW_HEIGHT +1}px`;
  note.style.width = `${length * STEP_WIDTH -1.2}px`;

  const handle = document.createElement("div");
  handle.className = "resize-handle";
  note.appendChild(handle);

  grid.appendChild(note);

  const noteObj = { el: note, col, row, length };
  notes.push(noteObj);

  NoteResize(noteObj);

  note.addEventListener("contextmenu", () => removeNote(noteObj))
}

function NoteResize(noteObj) {
  const note = noteObj.el;
  const handle = note.querySelector('.resize-handle');
  if (!handle) return;

  let isResizing = false;
  let startX = 0;
  let startLength = noteObj.length;

  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation(); // чтобы клик по хэндлу не считался кликом по grid

    isResizing = true;
    startX = e.clientX;
    startLength = noteObj.length;

    // слушаем движение мыши по всему окну
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  });

  function onMouseMove(e) {
    if (!isResizing) return;

    const deltaX = e.clientX - startX;          // в пикселях
    const deltaSteps = Math.round(deltaX / STEP_WIDTH); // в шагах

    let newLength = startLength + deltaSteps;
    if (newLength < 1) newLength = 1;           // не даём длине быть 0 или меньше

    noteObj.length = newLength;
    note.style.width = `${newLength * STEP_WIDTH - 1.2}px`;
  }

  function onMouseUp() {
    if (!isResizing) return;
    isResizing = false;

    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  }
}
//Prevent context menu on grid... USED LINK:https://pqina.nl/blog/disable-right-click-with-javascript/#:~:text=To%20only%20disable%20it%20in,)%20%7B%20return%3B%20%7D%20e.

grid.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });











const stopWatch = document.getElementById("stopWatch");
//playBtn already defined
let timeoutId = null;
let ms = 0;
let sec = 0;
let min = 0;
// Start Stopwatch
function startStopWatch(flag = false) {
  if (flag) {
}

timeoutId = setTimeout(function(flag){
  ms = parseInt(ms);
  sec = parseInt(sec);
  min = parseInt(min);

  ms++;
  if (ms == 100){
    sec = sec + 1;
    ms = 0;
  }
  if (sec == 60){
    min = min + 1;
    sec = 0;
  }
  if (ms < 10 ) {
    ms = "0" + ms;
  }
    if (sec < 10 ) {
    sec = "0" + sec;
  }
    if (min < 10 ) {
    min = "0" + min;
  }
stopWatch.innerHTML = min + ":" + sec + ":" + ms;
  startStopWatch();
  } ,10); //Set timeout delay time to 10ms
} 
function pauseStopWatch() {
  clearTimeout(timeoutId);

}

console.log("Grid size:", grid.style.width, grid.style.height);



const MetronomeButton = document.getElementById("metronome")

let MetronomeState = false; 
let metronomeTimerId = null;
function updateMetronome() {
    if (metronomeTimerId) {
    clearInterval(metronomeTimerId);
    metronomeTimerId = null;
  }

if (!isPlaying || !MetronomeState || BPM <= 0) return;
const interval = getStepMs();
  metronomeTimerId = setInterval(() => {
    MetronomeSound.currentTime = 0;
    MetronomeSound.play();
  }, interval);
}
MetronomeButton.addEventListener("click", () => {
 MetronomeState = !MetronomeState; // change state
  updateMetronome();               //update timer
});


