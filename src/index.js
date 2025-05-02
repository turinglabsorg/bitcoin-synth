import _ from 'lodash';
var AudioSynth = require('audiosynth');
const axios = require('axios')

var AudioContext = window.AudioContext || window.webkitAudioContext;

var context = new AudioContext();
var synth = new AudioSynth(context);
var txns = []
var hex
var isplaying = false
var timeout = []
var playingindex = 0
var nextblock = ''

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function playSound(note, byte, time, amplitude, filterOffset) {
    timeout[time] = setTimeout(function () {
        if (context.state === 'suspended') {
            context.resume();
        }
        // Ensure parameters are finite
        amplitude = Math.min(0.8, Math.max(0.3, amplitude));
        filterOffset = Math.min(0.9, Math.max(0.4, filterOffset));

        // Log note for debugging
        try {
            synth.playNote(note, amplitude, filterOffset, 0);
            document.getElementById("nowplaying").innerHTML = byte;
            updateVisibility();
        } catch (e) {
            console.error('Failed to play note:', note, 'Error:', e);
        }
    }, time)
}


let isPaused = true;
let playPauseBtn;
let hasStarted = false;

function setIndicator(state) {
    if (!playPauseBtn) return;
    if (state === 'playing') {
        playPauseBtn.textContent = '⏸️ Pause';
        isPaused = false;
    } else {
        playPauseBtn.textContent = '▶️ Play';
        isPaused = true;
    }
}

function pausePlayback() {
    stopSounds();
    setIndicator('paused');
}

function resumePlayback() {
    setIndicator('playing');
    if (!hasStarted) {
        hasStarted = true;
        // Remove the initial message
        const msg = document.getElementById('start-message');
        if (msg) msg.remove();
        parselastblock();
    } else {
        playNext();
    }
}

document.addEventListener('DOMContentLoaded', function () {
    playPauseBtn = document.getElementById('playpause-indicator');
    setIndicator('paused');
    if (playPauseBtn) {
        playPauseBtn.onclick = function () {
            if (isPaused) {
                resumePlayback();
            } else {
                pausePlayback();
            }
        };
    }
});

function updateNextButtonVisibility() {
    const nextBtn = document.getElementById('next');
    if (!nextBtn) return;
    // If there is a next transaction, show the button; otherwise, hide it
    if (txns[parseInt(playingindex) + 1] !== undefined) {
        nextBtn.style.display = '';
    } else {
        nextBtn.style.display = 'none';
    }
}

function updateVisibility() {
    const ids = ['txplaying', 'rawtx', 'nowplaying'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (el.textContent && el.textContent.trim() !== '') {
                el.style.display = '';
            } else {
                el.style.display = 'none';
            }
        }
    });
}

// Progress bar helpers
function showProgressBar() {
    const bar = document.getElementById('progress-bar');
    if (bar) bar.style.display = '';
}
function hideProgressBar() {
    const bar = document.getElementById('progress-bar');
    if (bar) bar.style.display = 'none';
    const fill = document.getElementById('progress-bar-fill');
    if (fill) fill.style.width = '0';
}
function setProgressBar(percent) {
    const fill = document.getElementById('progress-bar-fill');
    if (fill) fill.style.width = percent + '%';
}

async function playTransaction(index) {
    // Clear all previous timeouts before starting a new transaction
    for (var k in timeout) {
        clearTimeout(timeout[k]);
    }
    timeout = [];
    if (context.state === 'suspended') {
        await context.resume();
    }
    setIndicator('playing');
    hideProgressBar(); // Hide and reset before starting
    setProgressBar(0);
    if (txns[parseInt(index)] !== undefined) {
        var tx = await axios.get(`https://mempool.space/api/tx/${txns[parseInt(index)]}/hex`)
        var toplay = tx.data
        playingindex = index
        document.getElementById("txplaying").innerHTML = 'Playing TXID<br><a target="_blank" href="https://mempool.space/tx/' + txns[parseInt(index)] + '/">' + txns[parseInt(index)].substring(0, 25) + '...</a>';
        document.getElementById("rawtx").innerHTML = toplay;
        updateVisibility();

        // Set up ambient synth parameters (default)
        synth.setDelayFeedback(0.6); // Increase delay feedback for more ambience
        synth.setDelayTimeTempo(90, 0.375); // Slower tempo with dotted eighth note delay
        synth.setFilterCutoff(0.3); // Start with a lower cutoff
        synth.setFilterResonance(0.4); // Add some resonance
        synth.setFilterEnvMod(0.6); // More filter envelope modulation
        synth.setAmpAttackTime(0.2); // Softer attack
        synth.setAmpReleaseTime(0.8); // Longer release

        let prevNote = 60; // Start from middle C

        // --- Melody Instrument ---
        function playMelodyNotes() {
            let melodyNotes = 8 + Math.floor(Math.random() * 8); // 8-16 notes
            let melodyBase = 60 + Math.floor(Math.random() * 12); // C4-B4
            for (let m = 0; m < melodyNotes; m++) {
                let melodyDelay = m * (600 + Math.floor(Math.random() * 600)); // 600-1200ms between notes
                let melodyNote = melodyBase + Math.floor(Math.random() * 12); // Random note in an octave
                timeout.push(setTimeout(() => {
                    // Save/restore synth config
                    let prevWave = synth.wave;
                    let prevAttack = synth._ampAttackTime;
                    let prevRelease = synth._ampReleaseTime;
                    let prevDelayFeedback = synth._leftFeedback.gain.value;
                    let prevDelayTime = synth._leftDelay.delayTime.value;
                    let prevDelayTimeTempo = synth._rightDelay.delayTime.value;
                    // Set melody params
                    synth.setOscWave(0); // Sine wave for defined melody
                    synth.setDelayFeedback(0.5);
                    synth.setDelayTimeTempo(110, 0.25);
                    synth.setAmpAttackTime(0.05); // Percussive
                    synth.setAmpReleaseTime(0.2); // Percussive
                    synth.playNote(melodyNote, 1.0, 0.7, 0); // Melody amplitude set to 1.0
                    // Restore config
                    synth.setOscWave(prevWave === 'sine' ? 0 : prevWave === 'square' ? 1 : prevWave === 'sawtooth' ? 2 : 3);
                    synth.setAmpAttackTime(prevAttack / 5);
                    synth.setAmpReleaseTime(prevRelease / 5);
                    synth.setDelayFeedback(prevDelayFeedback);
                    synth._leftDelay.delayTime.value = prevDelayTime;
                    synth._rightDelay.delayTime.value = prevDelayTimeTempo;
                }, melodyDelay));
            }
        }
        // --- End Melody Instrument ---

        // Progress bar setup
        const totalNotes = Math.floor(toplay.length / 2);
        showProgressBar();
        setProgressBar(0);

        // Recursive function to play each note in sequence (ambient background)
        function playNoteAt(i) {
            if (i > toplay.length) {
                setProgressBar(100);
                timeout.push(setTimeout(function () {
                    hideProgressBar();
                    playNext();
                }, 500));
                return;
            }
            var byteHex = toplay.substr(i, 2)
            var byteVal = parseInt(byteHex, 16)
            var delay = 100 + (byteVal % 100); // Vary time between 100-200ms
            var noteOffset = (byteVal % 24) - 12; // Range of two octaves, centered
            var midiNote = Math.max(36, Math.min(96, prevNote + noteOffset));
            prevNote = midiNote; // Remember last note for smoother progression
            var amplitude = 0.1 + (byteVal % 64) / 256; // Range 0.1-0.35
            var filterOffset = 0.4 + (byteVal % 128) / 256; // Range 0.4-0.9
            if (Math.random() < 0.5) {
                synth.setOscWave(0); // Sine (rain-like)
            } else {
                synth.setOscWave(2); // Sawtooth (ambient)
            }
            // Update progress bar
            setProgressBar(Math.min(100, Math.round((i / toplay.length) * 100)));
            playSound(midiNote, byteHex, 0, amplitude, filterOffset);
            timeout.push(setTimeout(function () {
                playNoteAt(i + 2);
            }, delay));
        }
        playNoteAt(0);
        playMelodyNotes();
        updateNextButtonVisibility();
    } else {
        document.getElementById("txplaying").innerHTML = '';
        document.getElementById("rawtx").innerHTML = '';
        document.getElementById("nowplaying").innerHTML = '';
        updateVisibility();
        updateNextButtonVisibility();
        hideProgressBar();
    }
}

function playNext() {
    isplaying = false
    var playnext = parseInt(playingindex) + 1
    for (var k in timeout) {
        clearTimeout(timeout[k])
    }
    timeout = [];
    hideProgressBar();
    setProgressBar(0);
    if (txns[playnext] !== undefined) {
        playTransaction(playnext)
    } else {
        parseblock(nextblock)
    }
    updateNextButtonVisibility();
}

function stopSounds() {
    for (var k in timeout) {
        clearTimeout(timeout[k])
    }
    timeout = [];
    setIndicator('paused');
    hideProgressBar();
    setProgressBar(0);
}

async function parseblock(blockHash) {
    console.log('PARSING BLOCK ' + blockHash)
    setIndicator('playing');
    const blockData = await axios.get(`https://mempool.space/api/block/${blockHash}`)
    isplaying = false
    nextblock = blockData.data.previousblockhash
    await sleep(2000)
    const blockTxs = await axios.get(`https://mempool.space/api/block/${blockHash}/txs`)
    for (var i = 0; i < blockTxs.data.length; i++) {
        txns.push(blockTxs.data[i].txid)
    }
    playTransaction(0)
    updateNextButtonVisibility();
}

async function parselastblock() {
    console.log('PARSING LAST BLOCK')
    var blockchain = await axios.get('https://mempool.space/api/v1/blocks')
    var lastblock = blockchain.data[0]
    parseblock(lastblock.id)
}

document.getElementById('next').onclick = function () {
    if (context.state === 'suspended') {
        context.resume();
    }
    setIndicator('playing');
    playNext()
}

document.body.onkeyup = function (e) {
    if (e.keyCode == 32) {
        if (context.state === 'suspended') {
            context.resume();
        }
        setIndicator('playing');
        playNext()
    }
}