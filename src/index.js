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
let tempo = 1.0;
let mood = 0.0;
let key = 'C';
let delayAmount = 0.7;
const keyToMidi = { C: 60, D: 62, E: 64, F: 65, G: 67, A: 69, B: 71 };

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

function updateSynthDelay() {
    // Update delay for both ambient and melody synths
    synth.setDelayFeedback(delayAmount);
    synth.setDelayTimeTempo(90 + delayAmount * 100, 0.25 + delayAmount * 0.25);
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
    // Tempo slider setup
    const tempoSlider = document.getElementById('tempo-slider');
    const tempoValue = document.getElementById('tempo-value');
    if (tempoSlider && tempoValue) {
        tempoSlider.oninput = function () {
            tempo = parseFloat(this.value);
            tempoValue.textContent = tempo.toFixed(2) + 'x';
        };
    }
    // Mood slider setup
    const moodSlider = document.getElementById('mood-slider');
    const moodValue = document.getElementById('mood-value');
    if (moodSlider && moodValue) {
        moodSlider.oninput = function () {
            mood = parseFloat(this.value);
            if (mood <= 0.05) {
                moodValue.textContent = 'Sad';
            } else if (mood >= 0.95) {
                moodValue.textContent = 'Happy';
            } else {
                moodValue.textContent = mood.toFixed(2);
            }
        };
    }
    // Key slider setup
    const keySlider = document.getElementById('key-slider');
    const keyValue = document.getElementById('key-value');
    const keys = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    if (keySlider && keyValue) {
        keySlider.oninput = function () {
            const idx = parseInt(this.value);
            key = keys[idx];
            keyValue.textContent = key;
        };
        // Initialize value
        keyValue.textContent = keys[parseInt(keySlider.value)];
        key = keys[parseInt(keySlider.value)];
    }
    // Delay slider setup
    const delaySlider = document.getElementById('delay-slider');
    const delayValue = document.getElementById('delay-value');
    if (delaySlider && delayValue) {
        delaySlider.oninput = function () {
            delayAmount = parseFloat(this.value);
            delayValue.textContent = delayAmount.toFixed(2);
            updateSynthDelay();
        };
        // Initialize value
        delayValue.textContent = delaySlider.value;
        delayAmount = parseFloat(delaySlider.value);
        updateSynthDelay();
    }
    // Fetch and display BTC price and set mood on load
    updateMoodFromPrice();
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
    // Do not hide progress bar at the start of playback
    setProgressBar(0);
    if (txns[parseInt(index)] !== undefined) {
        var tx = await axios.get(`https://mempool.space/api/tx/${txns[parseInt(index)]}/hex`)
        var toplay = tx.data
        playingindex = index
        // Fetch block reference if available
        let blockRef = '';
        if (typeof nextblock !== 'undefined' && nextblock) {
            blockRef = `<br><span style='font-size:0.9em;color:#00ffea;'>Block: <a target="_blank" href="https://mempool.space/block/${nextblock}">${nextblock.substring(0, 26)}...</a></span>`;
        }
        document.getElementById("txplaying").innerHTML = 'Playing TXID<br><a target="_blank" href="https://mempool.space/tx/' + txns[parseInt(index)] + '/">' + txns[parseInt(index)].substring(0, 25) + '...</a>' + blockRef;
        document.getElementById("rawtx").innerHTML = toplay;
        document.getElementsByClassName('btcamp-btn-row')[0].style.marginTop = '0rem';
        updateVisibility();
        document.getElementsByClassName('btcamp-display')[0].style.display = 'flex';

        // Set up ambient synth parameters (default)
        synth.setDelayFeedback(delayAmount); // User controlled delay feedback
        synth.setDelayTimeTempo(90 + delayAmount * 100, 0.25 + delayAmount * 0.25); // User controlled delay time
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
            // Define major and minor scale intervals
            const majorScale = [0, 2, 4, 5, 7, 9, 11];
            const minorScale = [0, 2, 3, 5, 7, 8, 10];
            // Chord intervals for harmonization
            const majorChord = [0, 4, 7]; // root, major third, fifth
            const minorChord = [0, 3, 7]; // root, minor third, fifth
            // Get root midi from key
            const rootMidi = keyToMidi[key] || 60;
            for (let m = 0; m < melodyNotes; m++) {
                let melodyDelay = m * (300 + Math.floor(Math.random() * (mood > 0.5 ? 350 : 600)));
                // Pick a scale degree
                let scaleIdx = Math.floor(Math.random() * 7);
                let scale = mood > 0.5 ? majorScale : minorScale;
                let melodyNote = rootMidi + scale[scaleIdx] + 12 * Math.floor(Math.random() * 2); // 1-2 octaves
                // Add more leaps and syncopation for happy mood
                if (mood > 0.5 && Math.random() < 0.6) {
                    // Jump to another major scale degree
                    let leapIdx = (scaleIdx + (Math.random() < 0.5 ? 2 : 4)) % 7;
                    melodyNote = rootMidi + scale[leapIdx] + 12 * Math.floor(Math.random() * 2);
                } else if (mood <= 0.5 && Math.random() < 0.6) {
                    // Jump to another minor scale degree
                    let leapIdx = (scaleIdx + (Math.random() < 0.5 ? 2 : 5)) % 7;
                    melodyNote = rootMidi + scale[leapIdx] + 12 * Math.floor(Math.random() * 2);
                }
                // Occasionally add a quick flourish (double or triple note)
                if (mood > 0.5 && Math.random() < 0.25) {
                    for (let f = 0; f < 2 + Math.floor(Math.random() * 2); f++) {
                        setTimeout(() => {
                            let flourishIdx = (scaleIdx + (Math.random() < 0.5 ? 1 : -1)) % 7;
                            let flourishNote = rootMidi + scale[(flourishIdx + 7) % 7] + 12 * Math.floor(Math.random() * 2);
                            let melAmp = 1.3 * (0.7 + Math.random() * 0.6);
                            synth.playNote(flourishNote, melAmp, 0.8, 0);
                        }, melodyDelay + 30 * f);
                    }
                }
                timeout.push(setTimeout(() => {
                    // Save/restore synth config
                    let prevWave = synth.wave;
                    let prevAttack = synth._ampAttackTime;
                    let prevRelease = synth._ampReleaseTime;
                    let prevDelayFeedback = synth._leftFeedback.gain.value;
                    let prevDelayTime = synth._leftDelay.delayTime.value;
                    let prevDelayTimeTempo = synth._rightDelay.delayTime.value;
                    // Set melody params
                    synth.setOscWave(0); // Sine for melody
                    synth.setDelayFeedback(delayAmount);
                    synth.setDelayTimeTempo(90 + delayAmount * 100, 0.25 + delayAmount * 0.25);
                    synth.setAmpAttackTime(0.05);
                    synth.setAmpReleaseTime(0.2);
                    let melAmp = 0.8 * (0.7 + Math.random() * 0.6); // Lowered amplitude for melody
                    synth.playNote(melodyNote, melAmp, 0.8, 0);
                    // --- Harmonization ---
                    const harmonies = [];
                    let chord = mood > 0.5 ? majorChord : minorChord;
                    if (Math.random() < 0.8) harmonies.push(chord[1]); // third
                    if (Math.random() < 0.5) harmonies.push(chord[2]); // fifth
                    if (Math.random() < 0.2) harmonies.push(12); // octave
                    harmonies.forEach((interval, i) => {
                        setTimeout(() => {
                            let harmonyNote = melodyNote + interval;
                            let harmonyAmp = melAmp * (0.35 + Math.random() * 0.2); // Lowered amplitude for harmonies
                            synth.playNote(harmonyNote, harmonyAmp, 0.8, 0);
                        }, 10 + i * 20);
                    });
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
            var delay = (100 + (byteVal % 100)) * (1 / tempo); // Vary time, adjust by tempo
            // --- Mood-based note selection ---
            // Major scale intervals (C major): [0, 2, 4, 5, 7, 9, 11]
            var majorScale = [0, 2, 4, 5, 7, 9, 11];
            var noteOffset;
            var midiNote;
            var rootMidi = keyToMidi[key] || 60;
            if (mood > 0.5) {
                // Happier: snap to major scale, bias to upper-middle range, clamp max
                var scaleDegree = majorScale[Math.floor((byteVal % majorScale.length))];
                var base = rootMidi + Math.floor(mood * 12);
                midiNote = base + scaleDegree;
                // Clamp to 48-76 (E5)
                midiNote = Math.max(48, Math.min(76, midiNote));
                // Allow bigger jumps (up to 12 semitones)
                if (Math.abs(midiNote - prevNote) > 12) {
                    midiNote = prevNote + (midiNote > prevNote ? 12 : -12);
                }
            } else {
                noteOffset = (byteVal % 24) - 12;
                midiNote = Math.max(36, Math.min(72, prevNote + noteOffset));
            }
            prevNote = midiNote; // Remember last note for smoother progression
            var amplitude = 0.1 + (byteVal % 64) / 256; // Range 0.1-0.35
            var filterOffset = 0.4 + (byteVal % 128) / 256; // Range 0.4-0.9
            // Waveform and filter: happier = triangle, sadder = sine
            if (mood > 0.5) {
                synth.setOscWave(3); // Triangle (softer than saw)
                synth.setFilterCutoff(0.32); // Lower cutoff for less harshness (was 0.48)
            } else {
                synth.setOscWave(0); // Sine (dark)
                synth.setFilterCutoff(0.28); // Lowered for ambience
            }
            // Update progress bar
            setProgressBar(Math.min(100, Math.round((i / toplay.length) * 100)));
            // Add more dynamic amplitude for happy mood
            let dynamicAmp = amplitude * 0.25; // Lowered ambience volume
            if (mood > 0.5) {
                dynamicAmp *= 0.9 + Math.random() * 0.3; // 0.9x to 1.2x
            }
            playSound(midiNote, byteHex, 0, dynamicAmp, filterOffset);
            // --- Extra dynamic: quick grace note (octave up or down) ---
            if (mood > 0.5 && Math.random() < 0.35) { // more grace notes
                var graceNote = midiNote + (Math.random() < 0.5 ? 12 : -12);
                if (graceNote >= 48 && graceNote <= 84) {
                    setTimeout(() => {
                        playSound(graceNote, byteHex, 0, dynamicAmp * 1.1, filterOffset);
                    }, 40 + Math.random() * 80); // quicker after main note
                }
            }
            // --- More rhythmic and melodic variation when happy ---
            var nextDelay = delay;
            if (mood > 0.5) {
                // More rhythmic swing and random jumps
                nextDelay = delay * (0.5 + Math.random() * 1.2); // 50%-170% of delay
                // Occasionally jump by a 5th or 7th
                if (Math.random() < 0.18) {
                    prevNote += (Math.random() < 0.5 ? 7 : 5) * (Math.random() < 0.5 ? 1 : -1);
                    prevNote = Math.max(48, Math.min(76, prevNote));
                }
            }
            timeout.push(setTimeout(function () {
                playNoteAt(i + 2);
            }, nextDelay));
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

async function updateMoodFromPrice() {
    try {
        const res = await fetch('https://mempool.space/api/v1/prices');
        const data = await res.json();
        const price = data.USD;
        // Map price to mood (0 to 1, max at 150000)
        const moodValue = Math.min(1, Math.max(0, price / 150000));
        const moodSlider = document.getElementById('mood-slider');
        const moodLabel = document.getElementById('mood-value');
        const priceDisplay = document.getElementById('btc-price-display');
        if (moodSlider && moodLabel) {
            moodSlider.value = moodValue;
            mood = moodValue;
            if (moodValue <= 0.05) {
                moodLabel.textContent = 'Sad';
            } else if (moodValue >= 0.95) {
                moodLabel.textContent = 'Happy';
            } else {
                moodLabel.textContent = moodValue.toFixed(2);
            }
        }
        if (priceDisplay) {
            priceDisplay.textContent = `BTC/USD: $${price}`;
        }
    } catch (e) {
        const moodSlider = document.getElementById('mood-slider');
        const moodLabel = document.getElementById('mood-value');
        const priceDisplay = document.getElementById('btc-price-display');
        if (moodSlider && moodLabel) {
            moodSlider.value = 0.5;
            mood = 0.5;
            moodLabel.textContent = '0.50';
        }
        if (priceDisplay) {
            priceDisplay.textContent = 'BTC price unavailable';
        }
        console.error('Failed to fetch price:', e);
    }
}