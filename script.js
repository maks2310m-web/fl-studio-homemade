//Global variables 

const STEP_W = 40; // Grid size (PX)
const ROW_H = 20; //Grid Height
const STEPS_PER_BEAT = 4;
const STEPS = 40; //How much steps, increases time.
const ROWS = 28; // How much rows(notes), can be only a number divided by 7.


//HTML DOM elements

const grid     = document.getElementById("grid");
const cursor   = document.getElementById("cursor");

//Sound elements
const MetronomeSound = new Audio('audio/metronome-tick.wav')



const BPMInput = document.getElementById("BPM");
let BPM = Number(BPMInput.value);
BPMInput.addEventListener("input", () => {
  BPM = Number(BPMInput.value) || 0;
  console.log("BPM Changed to:", BPM)
});

// let Variables
let notes = [];
let isPlaying = false;
let currentStep = 0;
let playInterval = null;

function moveCursorToStep(step) {
  cursor.style.left = (step * STEP_W) + "px";
}

function getStepMs() {
  const beatMs = 60000 / BPM;
  return beatMs / STEPS_PER_BEAT;
}

function startPlayBack() {

  currentStep = 0;
  moveCursorToStep(currentStep);

  // если вдруг уже был запущен интервал – чистим его
  if (playInterval) {
    clearInterval(playInterval);
  }

  playInterval = setInterval(() => {
    currentStep++;

    // если дошли до конца — стоп
    if (currentStep >= STEPS) {
      isPlaying = false;
      pauseStopWatch();
      stopPlayBack();
      return;
    }

    // двигаем курсор
    moveCursorToStep(currentStep);

    // играем звук метронома, если есть
    if (typeof primaryBeat !== "undefined") {
      primaryBeat.currentTime = 0;
      primaryBeat.play();
    }

  }, getStepMs());
}

function stopPlayBack() {
  if (playInterval) {
    clearInterval(playInterval);
    playInterval = null;
  }
}




// Grid Size
grid.style.width = `${STEP_W * STEPS}px`;
grid.style.height = `${ROW_H * ROWS}px`;


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
  isPlaying = true;

  playIcon.src = "img/Pause Button.svg";
  playIcon.alt = "Pause";
  playBtn.title ="Pause";

} else {
  onPause();
  isPlaying = false;

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

  const col = Math.floor(x / STEP_W);
  const row = Math.floor(y / ROW_H);

  createNote(col, row, 1);
});

// Creating Note inside of the grid
function createNote(col, row, length = 1) {
  const note = document.createElement("div");
  note.className = "note";
  note.style.left = `${col * STEP_W +1.45}px`;
  note.style.top = `${row * ROW_H +1}px`;
  note.style.width = `${length * STEP_W -1.2}px`;

  const handle = document.createElement("div");
  handle.className = "resize-handle";
  note.appendChild(handle);

  grid.appendChild(note);

  const noteObj = { el: note, col, row, length };
  notes.push(noteObj);

  note.addEventListener("contextmenu", () => removeNote(noteObj))
  window.addEventListener(`contextmenu`, (e) => {
    e.preventDefault();
});
}

// Remove note 
function removeNote(noteObj) {
  grid.removeChild(noteObj.el);
  notes = notes.filter(n => n !== noteObj);
}






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



let Metronome = false

  let soundInterval = beatMs;

  let startStopMetronome = playBtn.addEventListener('click', () => {
    soundInterval = calculateSoundInterval();
      startMetronome(soundInterval);
  })

  const MetronomeButton = document.getElementById("metronome")
  let MetronomeState = false;
  let MetronomeSwitch = MetronomeButton.addEventListener('click', () => {
    if (MetronomeState == false){
      MetronomeState = true;
      MetronomeSound.play();
      }
    })


  function startMetronome(si) {
      timerId = setInterval(() => {
          getStepMs()
          MetronomeSound.play();
          MetronomeSound.currentTime = 0;
      },si);
      
  }

 

let calculateSoundInterval = () => {
    return (60/BPM)*1000;
}

let updateBpmInDisplay = display.addEventListener('change', ()=> {
    soundInterval = calculateSoundInterval();
})