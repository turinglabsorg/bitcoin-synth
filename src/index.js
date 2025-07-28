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
let delayAmount = 0.25;
let harmonyIntensity = 0.8;
let drumVolume = 0.6;
let synthVolume = 0.8;
let drumComplexity = 0.5;
const keyToMidi = { C: 60, D: 62, E: 64, F: 65, G: 67, A: 69, B: 71 };

// Drum synthesis system
class DrumSynth {
    constructor(audioContext) {
        this.context = audioContext;
    }

    // Kick drum - low frequency sine wave with quick decay
    playKick(volume = 0.7) {
        try {
            if (this.context.state === 'suspended') {
                this.context.resume();
            }

            const osc = this.context.createOscillator();
            const gainNode = this.context.createGain();
            const filter = this.context.createBiquadFilter();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(80, this.context.currentTime); // Slightly higher for more punch
            osc.frequency.exponentialRampToValueAtTime(40, this.context.currentTime + 0.1);

            filter.type = 'lowpass';
            filter.frequency.value = 200; // Higher cutoff for more presence

            gainNode.gain.setValueAtTime(volume * 1.5, this.context.currentTime); // Louder
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.4);

            osc.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(this.context.destination);

            osc.start(this.context.currentTime);
            osc.stop(this.context.currentTime + 0.4);

            console.log('🥁 Kick drum played at volume:', volume * 1.5);
        } catch (error) {
            console.error('❌ Kick drum error:', error);
        }
    }

    // Snare drum - noise burst with bandpass filter
    playSnare(volume = 0.5) {
        try {
            if (this.context.state === 'suspended') {
                this.context.resume();
            }

            const bufferSize = this.context.sampleRate * 0.3;
            const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
            const output = buffer.getChannelData(0);

            // Generate white noise
            for (let i = 0; i < bufferSize; i++) {
                output[i] = (Math.random() * 2 - 1);
            }

            const source = this.context.createBufferSource();
            source.buffer = buffer;

            const filter = this.context.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 300; // Higher frequency for more snap
            filter.Q.value = 2; // More resonance

            const gainNode = this.context.createGain();
            gainNode.gain.setValueAtTime(volume * 3.5, this.context.currentTime); // Much louder - increased from 2 to 3.5
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.3);

            source.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(this.context.destination);

            source.start(this.context.currentTime);

            console.log('🥁 Snare drum played at volume:', volume * 3.5);
        } catch (error) {
            console.error('❌ Snare drum error:', error);
        }
    }

    // Hi-hat - high frequency noise burst
    playHiHat(volume = 0.3, open = false) {
        try {
            if (this.context.state === 'suspended') {
                this.context.resume();
            }

            const bufferSize = this.context.sampleRate * (open ? 0.3 : 0.1);
            const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
            const output = buffer.getChannelData(0);

            // Generate filtered noise
            for (let i = 0; i < bufferSize; i++) {
                output[i] = (Math.random() * 2 - 1) * Math.exp(-i / bufferSize * 8);
            }

            const source = this.context.createBufferSource();
            source.buffer = buffer;

            const filter = this.context.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.value = open ? 6000 : 8000; // Lower frequency for more audibility

            const gainNode = this.context.createGain();
            gainNode.gain.setValueAtTime(volume * 2, this.context.currentTime); // Louder
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + (open ? 0.3 : 0.15));

            source.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(this.context.destination);

            source.start(this.context.currentTime);

            console.log('🥁 Hi-hat played:', open ? 'open' : 'closed', 'volume:', volume * 2);
        } catch (error) {
            console.error('❌ Hi-hat error:', error);
        }
    }

    // Cymbal - warm, less noisy crash sound
    playCymbal(volume = 0.4) {
        const osc1 = this.context.createOscillator();
        const osc2 = this.context.createOscillator();
        const gainNode = this.context.createGain();
        const filter = this.context.createBiquadFilter();
        const lowpassFilter = this.context.createBiquadFilter();

        // Use only two oscillators with warmer waveforms
        osc1.type = 'sine';
        osc2.type = 'triangle';

        // Much lower frequencies for warmer sound
        osc1.frequency.value = 200;
        osc2.frequency.value = 400;

        // Gentle highpass filter
        filter.type = 'highpass';
        filter.frequency.value = 800;

        // Strong lowpass filter to cut harsh highs
        lowpassFilter.type = 'lowpass';
        lowpassFilter.frequency.value = 2000;

        // Softer gain envelope
        gainNode.gain.setValueAtTime(volume * 0.4, this.context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.8);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(lowpassFilter);
        lowpassFilter.connect(gainNode);
        gainNode.connect(this.context.destination);

        osc1.start(this.context.currentTime);
        osc2.start(this.context.currentTime);
        osc1.stop(this.context.currentTime + 0.8);
        osc2.stop(this.context.currentTime + 0.8);
    }
}

// Initialize drum synth
const drums = new DrumSynth(context);



// Standalone Drum Pad System
class DrumPad {
    constructor(drumSynth) {
        this.drums = drumSynth;
        this.isLooping = false;
        this.loopInterval = null;
        this.bpm = 120;
        this.step = 0;

        // Basic 4/4 pattern
        this.pattern = {
            kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
            snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
            hihat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
        };

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Create beat grid buttons
        this.createBeatGrid();

        // Individual drum pad buttons (for backward compatibility)
        const kickPad = document.getElementById('kick-pad');
        const snarePad = document.getElementById('snare-pad');
        const hihatPad = document.getElementById('hihat-pad');
        const cymbalPad = document.getElementById('cymbal-pad');

        if (kickPad) kickPad.onclick = () => {
            console.log('🔴 Kick pad pressed');
            this.playKick();
        };

        if (snarePad) snarePad.onclick = () => {
            console.log('🟢 Snare pad pressed');
            this.playSnare();
        };

        if (hihatPad) hihatPad.onclick = () => {
            console.log('🔵 Hi-hat pad pressed');
            this.playHiHat();
        };

        if (cymbalPad) cymbalPad.onclick = () => {
            console.log('🟡 Cymbal pad pressed');
            this.playCymbal();
        };

        // Loop toggle button
        document.getElementById('drum-loop-toggle').onclick = () => {
            this.toggleLoop();
        };



        // BPM slider
        const bpmSlider = document.getElementById('drum-bpm');
        const bpmValue = document.getElementById('bpm-value');

        if (bpmSlider && bpmValue) {
            bpmSlider.oninput = () => {
                this.bpm = parseInt(bpmSlider.value);
                bpmValue.textContent = this.bpm;

                // Restart loop if running to apply new BPM
                if (this.isLooping) {
                    this.stopLoop();
                    this.startLoop();
                }
            };
        }

        // Composer controls
        const clearPattern = document.getElementById('clear-pattern');
        const randomPattern = document.getElementById('random-pattern');
        const txFillPattern = document.getElementById('tx-fill-pattern');

        if (clearPattern) clearPattern.onclick = () => {
            this.clearPattern();
        };

        if (randomPattern) randomPattern.onclick = () => {
            this.generateRandomPattern();
        };

        if (txFillPattern) txFillPattern.onclick = () => {
            this.applyTransactionFills();
        };
    }

    playKick() {
        if (context.state === 'suspended') {
            context.resume();
        }
        this.drums.playKick(0.8 * drumVolume);
    }

    playSnare() {
        if (context.state === 'suspended') {
            context.resume();
        }
        this.drums.playSnare(0.7 * drumVolume);
    }

    playHiHat() {
        if (context.state === 'suspended') {
            context.resume();
        }
        this.drums.playHiHat(0.5 * drumVolume, false);
    }

    playCymbal() {
        if (context.state === 'suspended') {
            context.resume();
        }
        this.drums.playCymbal(0.4 * drumVolume); // Reduced from 0.6 to 0.4
    }

    startLoop() {
        if (this.isLooping) return;

        console.log('🔄 Starting drum loop at', this.bpm, 'BPM');
        this.isLooping = true;
        this.step = 0;

        const stepTime = (60 / this.bpm) * 1000 / 4; // 16th note timing

        this.loopInterval = setInterval(() => {
            // Play drums based on pattern
            if (this.pattern.kick[this.step]) {
                this.playKick();
            }
            if (this.pattern.snare[this.step]) {
                this.playSnare();
            }
            if (this.pattern.hihat[this.step]) {
                this.playHiHat();
            }

            this.step = (this.step + 1) % 16;
        }, stepTime);

        // Update button text
        document.getElementById('drum-loop-toggle').textContent = '⏹️ Stop Loop';
    }

    stopLoop() {
        if (!this.isLooping) return;

        console.log('⏹️ Stopping drum loop');
        this.isLooping = false;

        if (this.loopInterval) {
            clearInterval(this.loopInterval);
            this.loopInterval = null;
        }

        // Update button text
        document.getElementById('drum-loop-toggle').textContent = '🔄 Start Loop';


    }

    toggleLoop() {
        if (this.isLooping) {
            this.stopLoop();
        } else {
            this.startLoop();
        }
    }

    // Generate drum pattern from transaction hex data
    generatePatternFromTransaction(hexString) {
        console.log('🔍 Generating pattern from transaction hex:', hexString.substring(0, 64) + '...');

        // Initialize empty 16-step patterns
        const pattern = {
            kick: new Array(16).fill(0),
            snare: new Array(16).fill(0),
            hihat: new Array(16).fill(0),
            cymbal: new Array(16).fill(0)
        };

        // Extract transaction bytes for fills
        const txBytes = [];
        for (let i = 0; i < Math.min(hexString.length, 128); i += 2) {
            txBytes.push(parseInt(hexString.substr(i, 2), 16));
        }

        // Create basic musical patterns
        const basicPatterns = {
            // Basic 4/4 patterns
            kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
            snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
            hihat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
            cymbal: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        };

        // Copy basic patterns
        pattern.kick = [...basicPatterns.kick];
        pattern.snare = [...basicPatterns.snare];
        pattern.hihat = [...basicPatterns.hihat];
        pattern.cymbal = [...basicPatterns.cymbal];

        // Add transaction-based fills
        const fills = this.generateTransactionFills(txBytes);
        fills.forEach(fill => {
            if (fill.type === 'kick') pattern.kick[fill.step] = 1;
            else if (fill.type === 'snare') pattern.snare[fill.step] = 1;
            else if (fill.type === 'hihat') pattern.hihat[fill.step] = fill.open ? 2 : 1;
            else if (fill.type === 'cymbal') pattern.cymbal[fill.step] = 1;
        });

        console.log('🎵 Generated pattern with transaction fills:');
        console.log('Kick:  ', pattern.kick.join(''));
        console.log('Snare: ', pattern.snare.join(''));
        console.log('Hi-hat:', pattern.hihat.join(''));
        console.log('Cymbal:', pattern.cymbal.join(''));

        return pattern;
    }

    // Generate fills based on transaction data
    generateTransactionFills(txBytes) {
        const fills = [];

        // Analyze transaction characteristics
        const avgByte = txBytes.reduce((a, b) => a + b, 0) / txBytes.length;
        const byteVariance = txBytes.reduce((sum, byte) => sum + Math.pow(byte - avgByte, 2), 0) / txBytes.length;
        const entropy = Math.sqrt(byteVariance) / 255;

        console.log('🎲 Transaction analysis for fills:', { avgByte, entropy, byteCount: txBytes.length });

        // Generate fills based on transaction characteristics
        for (let i = 0; i < txBytes.length; i += 4) {
            const chunk = txBytes.slice(i, i + 4);
            if (chunk.length === 4) {
                const chunkSum = chunk.reduce((a, b) => a + b, 0);
                const fillStep = i % 16;

                // High intensity chunks create fills
                if (chunkSum > 600) { // High average
                    fills.push({
                        step: fillStep,
                        type: 'kick',
                        intensity: chunkSum / (4 * 255)
                    });

                    if (chunk[1] > 128) {
                        fills.push({
                            step: (fillStep + 1) % 16,
                            type: 'snare',
                            intensity: chunk[1] / 255
                        });
                    }
                }

                // High variance chunks create syncopated fills
                const chunkVariance = chunk.reduce((sum, byte) => sum + Math.pow(byte - chunkSum / 4, 2), 0) / 4;
                if (chunkVariance > 2000) {
                    const syncopatedStep = (fillStep + 2) % 16;
                    fills.push({
                        step: syncopatedStep,
                        type: 'hihat',
                        open: chunk[2] > 128,
                        intensity: chunkVariance / 10000
                    });
                }

                // Very high bytes create cymbal accents
                if (chunk.some(byte => byte > 240)) {
                    fills.push({
                        step: fillStep,
                        type: 'cymbal',
                        intensity: Math.max(...chunk) / 255
                    });
                }
            }
        }

        // Add entropy-based random fills
        if (entropy > 0.5) {
            const randomFills = Math.floor(entropy * 4);
            for (let i = 0; i < randomFills; i++) {
                const step = txBytes[i % txBytes.length] % 16;
                const drumType = txBytes[i % txBytes.length] % 4;

                fills.push({
                    step: step,
                    type: ['kick', 'snare', 'hihat', 'cymbal'][drumType],
                    open: drumType === 2 && txBytes[i % txBytes.length] > 128,
                    intensity: txBytes[i % txBytes.length] / 255
                });
            }
        }

        console.log('🥁 Generated', fills.length, 'transaction fills');
        return fills;
    }

    // Create beat grid buttons
    createBeatGrid() {
        const drumTypes = ['kick', 'snare', 'hihat', 'cymbal'];

        drumTypes.forEach(drumType => {
            const grid = document.getElementById(`${drumType}-grid`);
            if (!grid) return;

            grid.innerHTML = '';

            for (let i = 0; i < 16; i++) {
                const button = document.createElement('button');
                button.className = 'beat-button';
                button.dataset.step = i;
                button.dataset.drum = drumType;
                button.textContent = (i + 1) % 4 === 0 ? '|' : '';

                button.onclick = () => {
                    this.toggleBeat(drumType, i);
                };

                grid.appendChild(button);
            }
        });
    }

    // Toggle beat on/off
    toggleBeat(drumType, step) {
        const button = document.querySelector(`[data-drum="${drumType}"][data-step="${step}"]`);
        if (!button) return;

        const isActive = button.classList.contains('active');

        if (isActive) {
            button.classList.remove('active');
            this.pattern[drumType][step] = 0;
        } else {
            button.classList.add('active', drumType);
            this.pattern[drumType][step] = drumType === 'hihat' ? 1 : 1;
        }

        console.log(`🎵 ${drumType} ${isActive ? 'removed' : 'added'} at step ${step}`);
    }

    // Clear pattern
    clearPattern() {
        this.pattern = {
            kick: new Array(16).fill(0),
            snare: new Array(16).fill(0),
            hihat: new Array(16).fill(0),
            cymbal: new Array(16).fill(0)
        };

        // Clear all buttons
        document.querySelectorAll('.beat-button').forEach(button => {
            button.classList.remove('active', 'kick', 'snare', 'hihat', 'cymbal');
        });

        console.log('🗑️ Pattern cleared');
    }

    // Generate random pattern
    generateRandomPattern() {
        this.clearPattern();

        const drumTypes = ['kick', 'snare', 'hihat', 'cymbal'];

        drumTypes.forEach(drumType => {
            for (let i = 0; i < 16; i++) {
                if (Math.random() < 0.3) { // 30% chance for each beat
                    this.pattern[drumType][i] = 1;
                    const button = document.querySelector(`[data-drum="${drumType}"][data-step="${i}"]`);
                    if (button) {
                        button.classList.add('active', drumType);
                    }
                }
            }
        });

        // Ensure basic musical structure
        this.pattern.kick[0] = 1;
        this.pattern.kick[8] = 1;
        this.pattern.snare[4] = 1;
        this.pattern.snare[12] = 1;

        // Update buttons for basic structure
        [0, 8].forEach(step => {
            const button = document.querySelector(`[data-drum="kick"][data-step="${step}"]`);
            if (button) button.classList.add('active', 'kick');
        });

        [4, 12].forEach(step => {
            const button = document.querySelector(`[data-drum="snare"][data-step="${step}"]`);
            if (button) button.classList.add('active', 'snare');
        });

        console.log('🎲 Random pattern generated');
    }

    // Apply transaction fills to current pattern
    applyTransactionFills() {
        const rawTxElement = document.getElementById('rawtx');
        if (!rawTxElement || !rawTxElement.textContent) {
            console.log('⚠️ No transaction data available for fills');
            return;
        }

        const hexString = rawTxElement.textContent.trim();
        if (hexString.length < 10 || hexString === 'Still need to be fetched, press play..') {
            console.log('⚠️ No valid transaction hex available');
            return;
        }

        // First, clear the pattern
        this.clearPattern();

        // Extract transaction bytes
        const txBytes = [];
        for (let i = 0; i < Math.min(hexString.length, 128); i += 2) {
            txBytes.push(parseInt(hexString.substr(i, 2), 16));
        }

        // Generate fills
        const fills = this.generateTransactionFills(txBytes);

        // Apply fills to pattern and buttons
        fills.forEach(fill => {
            this.pattern[fill.type][fill.step] = fill.type === 'hihat' ? (fill.open ? 2 : 1) : 1;

            const button = document.querySelector(`[data-drum="${fill.type}"][data-step="${fill.step}"]`);
            if (button) {
                button.classList.add('active', fill.type);
            }
        });

        console.log('🔗 Applied', fills.length, 'transaction fills to pattern');
    }

    // Update pattern from composer
    updatePatternFromComposer() {
        const drumTypes = ['kick', 'snare', 'hihat', 'cymbal'];

        drumTypes.forEach(drumType => {
            for (let i = 0; i < 16; i++) {
                const button = document.querySelector(`[data-drum="${drumType}"][data-step="${i}"]`);
                if (button && button.classList.contains('active')) {
                    this.pattern[drumType][i] = drumType === 'hihat' ? 1 : 1;
                } else {
                    this.pattern[drumType][i] = 0;
                }
            }
        });
    }

    // Update composer buttons from pattern
    updateComposerFromPattern() {
        const drumTypes = ['kick', 'snare', 'hihat', 'cymbal'];

        // Clear all buttons first
        document.querySelectorAll('.beat-button').forEach(button => {
            button.classList.remove('active', 'kick', 'snare', 'hihat', 'cymbal');
        });

        // Update buttons based on pattern
        drumTypes.forEach(drumType => {
            for (let i = 0; i < 16; i++) {
                if (this.pattern[drumType][i] > 0) {
                    const button = document.querySelector(`[data-drum="${drumType}"][data-step="${i}"]`);
                    if (button) {
                        button.classList.add('active', drumType);
                    }
                }
            }
        });
    }

    // Start loop with transaction-based pattern
    startTransactionLoop(hexString) {
        // Generate pattern from transaction
        this.pattern = this.generatePatternFromTransaction(hexString);

        // Update composer buttons to reflect the pattern
        this.updateComposerFromPattern();

        // If loop is not running, start it
        if (!this.isLooping) {
            this.startLoop();
        }



        console.log('🔗 Switched to transaction-based pattern');
    }



    // Updated loop function to handle open hi-hats and cymbals
    startLoop() {
        if (this.isLooping) return;

        console.log('🔄 Starting drum loop at', this.bpm, 'BPM');
        this.isLooping = true;
        this.step = 0;

        const stepTime = (60 / this.bpm) * 1000 / 4; // 16th note timing

        this.loopInterval = setInterval(() => {
            // Play drums based on pattern
            if (this.pattern.kick[this.step]) {
                this.playKick();
            }
            if (this.pattern.snare[this.step]) {
                this.playSnare();
            }
            if (this.pattern.hihat[this.step] === 1) {
                this.playHiHat(); // Closed hi-hat
            } else if (this.pattern.hihat[this.step] === 2) {
                this.drums.playHiHat(0.5 * drumVolume, true); // Open hi-hat
            }
            if (this.pattern.cymbal && this.pattern.cymbal[this.step]) {
                this.playCymbal();
            }

            this.step = (this.step + 1) % 16;
        }, stepTime);

        // Update button text
        document.getElementById('drum-loop-toggle').textContent = '⏹️ Stop Loop';
    }
}

// Initialize drum pad after DOM is ready
let drumPad;

// Drum pattern engine - generates beats based on blockchain data
class DrumPatternEngine {
    constructor(drumSynth) {
        this.drums = drumSynth;
        this.patterns = {
            // Basic patterns by mood
            happy: {
                kick: [1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0],
                snare: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
                hihat: [1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1],
                openhat: [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1]
            },
            sad: {
                kick: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
                snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
                hihat: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
                openhat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0]
            },
            complex: {
                kick: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 0],
                snare: [0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1],
                hihat: [1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0],
                openhat: [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0]
            }
        };
        this.currentPattern = this.patterns.complex;
        this.stepIndex = 0;
        this.isPlaying = false;
    }

    // Generate dynamic pattern from blockchain hex data
    generatePatternFromHex(hexString) {
        const bytes = [];
        for (let i = 0; i < Math.min(hexString.length, 32); i += 2) {
            bytes.push(parseInt(hexString.substr(i, 2), 16));
        }

        // Generate kick pattern - use lower 4 bits
        const kickPattern = bytes.slice(0, 16).map(byte => (byte & 0x0F) > (8 - drumComplexity * 6) ? 1 : 0);

        // Generate snare pattern - use middle bits
        const snarePattern = bytes.slice(0, 16).map(byte => ((byte >> 2) & 0x0F) > (10 - drumComplexity * 4) ? 1 : 0);

        // Generate hi-hat pattern - use upper bits  
        const hihatPattern = bytes.slice(0, 16).map(byte => ((byte >> 4) & 0x0F) > (6 - drumComplexity * 2) ? 1 : 0);

        // Generate open hi-hat pattern - sparse, use full byte value
        const openhatPattern = bytes.slice(0, 16).map(byte => byte > (200 - drumComplexity * 50) ? 1 : 0);

        return {
            kick: kickPattern,
            snare: snarePattern,
            hihat: hihatPattern,
            openhat: openhatPattern
        };
    }

    // Play drum pattern step
    playStep(pattern, stepIndex, beatDelay) {
        if (!pattern || drumVolume <= 0) return;

        const step = stepIndex % 16;
        const volume = drumVolume;

        timeout.push(setTimeout(() => {
            if (pattern.kick[step]) {
                this.drums.playKick(volume * 0.8);
            }
            if (pattern.snare[step]) {
                this.drums.playSnare(volume * 0.6);
            }
            if (pattern.hihat[step] && !pattern.openhat[step]) {
                this.drums.playHiHat(volume * 0.4, false);
            }
            if (pattern.openhat[step]) {
                this.drums.playHiHat(volume * 0.5, true);
            }

            // Occasional cymbal crashes based on mood and complexity
            if (mood > 0.6 && drumComplexity > 0.7 && step === 0 && Math.random() < 0.3) {
                this.drums.playCymbal(volume * 0.3);
            }
        }, beatDelay));
    }

    // Generate and play drum sequence for transaction
    playDrumSequence(hexString, totalDuration) {
        console.log('🥁 Starting drum sequence - Volume:', drumVolume, 'Duration:', totalDuration);
        if (drumVolume <= 0) {
            console.log('🔇 Drums muted (volume = 0)');
            return;
        }

        // Generate pattern from blockchain data
        const blockchainPattern = this.generatePatternFromHex(hexString);
        console.log('🎵 Generated blockchain pattern:', blockchainPattern);

        // Mix with mood-based base pattern for musicality
        let moodType = mood > 0.6 ? 'happy' : mood < 0.4 ? 'sad' : 'complex';
        const basePattern = this.patterns[moodType];

        // Combine patterns based on drum complexity
        const finalPattern = {
            kick: blockchainPattern.kick.map((val, idx) =>
                val || (drumComplexity < 0.3 ? 0 : basePattern.kick[idx])),
            snare: blockchainPattern.snare.map((val, idx) =>
                val || (drumComplexity < 0.5 ? 0 : basePattern.snare[idx])),
            hihat: blockchainPattern.hihat.map((val, idx) =>
                val || (drumComplexity < 0.2 ? 0 : basePattern.hihat[idx])),
            openhat: blockchainPattern.openhat.map((val, idx) =>
                val || (drumComplexity < 0.7 ? 0 : basePattern.openhat[idx]))
        };

        // Calculate timing - 16th note timing based on tempo
        const sixteenthNote = (60 / (120 * tempo)) * 1000 / 4; // 120 BPM base, adjusted by tempo
        const totalSteps = Math.floor(totalDuration / sixteenthNote);

        console.log('⏱️ Drum timing - 16th note:', sixteenthNote, 'ms, Total steps:', totalSteps);
        console.log('🎼 Final pattern (first 8 steps):', {
            kick: finalPattern.kick.slice(0, 8),
            snare: finalPattern.snare.slice(0, 8),
            hihat: finalPattern.hihat.slice(0, 8)
        });

        // Play drum sequence
        for (let step = 0; step < totalSteps; step++) {
            this.playStep(finalPattern, step, step * sixteenthNote);
        }

        console.log('🚀 Scheduled', totalSteps, 'drum steps');
    }
}

// Initialize drum pattern engine
const drumEngine = new DrumPatternEngine(drums);

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function playSound(note, byte, time, amplitude, filterOffset) {
    timeout[time] = setTimeout(function () {
        if (context.state === 'suspended') {
            context.resume();
        }

        // Skip playing if synth volume is 0
        if (synthVolume <= 0) {
            return;
        }

        // Ensure parameters are finite
        amplitude = Math.min(0.8, Math.max(0.3, amplitude));
        filterOffset = Math.min(0.9, Math.max(0.4, filterOffset));

        // Apply synth volume
        amplitude = amplitude * synthVolume;

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
    // Harmony slider setup
    const harmonySlider = document.getElementById('harmony-slider');
    const harmonyValue = document.getElementById('harmony-value');
    if (harmonySlider && harmonyValue) {
        harmonySlider.oninput = function () {
            harmonyIntensity = parseFloat(this.value);
            harmonyValue.textContent = harmonyIntensity.toFixed(2);
        };
        // Initialize value
        harmonyValue.textContent = harmonySlider.value;
        harmonyIntensity = parseFloat(harmonySlider.value);
    }

    // Synth volume slider setup
    const synthVolumeSlider = document.getElementById('synth-volume-slider');
    const synthVolumeValue = document.getElementById('synth-volume-value');
    if (synthVolumeSlider && synthVolumeValue) {
        synthVolumeSlider.oninput = function () {
            synthVolume = parseFloat(this.value);
            synthVolumeValue.textContent = synthVolume.toFixed(2);
        };
        // Initialize value
        synthVolumeValue.textContent = synthVolumeSlider.value;
        synthVolume = parseFloat(synthVolumeSlider.value);
    }

    // Drum volume slider setup
    const drumVolumeSlider = document.getElementById('drum-volume-slider');
    const drumVolumeValue = document.getElementById('drum-volume-value');
    if (drumVolumeSlider && drumVolumeValue) {
        drumVolumeSlider.oninput = function () {
            drumVolume = parseFloat(this.value);
            drumVolumeValue.textContent = drumVolume.toFixed(2);
        };
        // Initialize value
        drumVolumeValue.textContent = drumVolumeSlider.value;
        drumVolume = parseFloat(drumVolumeSlider.value);
    }


    // Initialize drum pad
    drumPad = new DrumPad(drums);
    console.log('🥁 Drum pad initialized!');

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
        updateVisibility();

        // Set up ambient synth parameters (default)
        synth.setDelayFeedback(delayAmount); // User controlled delay feedback
        synth.setDelayTimeTempo(90 + delayAmount * 100, 0.25 + delayAmount * 0.25); // User controlled delay time
        synth.setFilterCutoff(0.3); // Start with a lower cutoff
        synth.setFilterResonance(0.4); // Add some resonance
        synth.setFilterEnvMod(0.6); // More filter envelope modulation
        synth.setAmpAttackTime(0.2); // Softer attack
        synth.setAmpReleaseTime(0.8); // Longer release

        let prevNote = 60; // Start from middle C

        // --- Enhanced Melody Instrument with Advanced Harmonization ---
        function playMelodyNotes() {
            let melodyNotes = 8 + Math.floor(Math.random() * 8); // 8-16 notes
            let melodyBase = 60 + Math.floor(Math.random() * 12); // C4-B4

            // Define scales and modes for more sophisticated harmonies
            const majorScale = [0, 2, 4, 5, 7, 9, 11];
            const minorScale = [0, 2, 3, 5, 7, 8, 10];
            const dorianScale = [0, 2, 3, 5, 7, 9, 10];
            const mixolydianScale = [0, 2, 4, 5, 7, 9, 10];
            const pentatonicMajor = [0, 2, 4, 7, 9];
            const pentatonicMinor = [0, 3, 5, 7, 10];

            // Advanced chord voicings and extensions
            const chordLibrary = {
                majorTriad: [0, 4, 7],
                minorTriad: [0, 3, 7],
                major7: [0, 4, 7, 11],
                minor7: [0, 3, 7, 10],
                dominant7: [0, 4, 7, 10],
                major9: [0, 4, 7, 11, 14],
                minor9: [0, 3, 7, 10, 14],
                sus2: [0, 2, 7],
                sus4: [0, 5, 7],
                add9: [0, 4, 7, 14],
                diminished: [0, 3, 6],
                halfDiminished: [0, 3, 6, 10],
                augmented: [0, 4, 8],
                major6: [0, 4, 7, 9],
                minor6: [0, 3, 7, 9],
                eleventh: [0, 4, 7, 10, 14, 17],
                thirteenth: [0, 4, 7, 10, 14, 17, 21]
            };

            // Chord progression patterns based on mood
            const progressionLibrary = {
                happy: [
                    ['majorTriad', 'major6', 'major9', 'major7'],
                    ['majorTriad', 'add9', 'sus4', 'major6'],
                    ['major9', 'sus2', 'major7', 'add9'],
                    ['majorTriad', 'augmented', 'major6', 'major7']
                ],
                sad: [
                    ['minorTriad', 'minor6', 'minor7', 'minor9'],
                    ['minorTriad', 'diminished', 'halfDiminished', 'minor7'],
                    ['minor9', 'minor6', 'halfDiminished', 'minorTriad'],
                    ['minorTriad', 'sus2', 'minor7', 'minor6']
                ],
                complex: [
                    ['major7', 'dominant7', 'minor9', 'major6'],
                    ['minor7', 'halfDiminished', 'major9', 'sus4'],
                    ['eleventh', 'major9', 'minor7', 'dominant7'],
                    ['thirteenth', 'minor9', 'major7', 'sus2']
                ]
            };

            // Get root midi from key
            const rootMidi = keyToMidi[key] || 60;

            // Select progression based on mood and complexity
            let progressionType = mood > 0.7 ? 'happy' : mood < 0.3 ? 'sad' : 'complex';
            let progression = progressionLibrary[progressionType][Math.floor(Math.random() * progressionLibrary[progressionType].length)];
            let chordIndex = 0;

            // Select scale based on mood and complexity
            let scale;
            if (mood > 0.8) {
                scale = Math.random() < 0.5 ? majorScale : pentatonicMajor;
            } else if (mood < 0.2) {
                scale = Math.random() < 0.5 ? minorScale : pentatonicMinor;
            } else if (mood > 0.6) {
                scale = Math.random() < 0.3 ? majorScale : dorianScale;
            } else if (mood < 0.4) {
                scale = Math.random() < 0.3 ? minorScale : mixolydianScale;
            } else {
                // Complex mood - use all scales
                const scales = [majorScale, minorScale, dorianScale, mixolydianScale, pentatonicMajor, pentatonicMinor];
                scale = scales[Math.floor(Math.random() * scales.length)];
            }

            for (let m = 0; m < melodyNotes; m++) {
                let melodyDelay = m * (300 + Math.floor(Math.random() * (mood > 0.5 ? 350 : 600)));
                // Pick a scale degree
                let scaleIdx = Math.floor(Math.random() * scale.length);
                let melodyNote = rootMidi + scale[scaleIdx] + 12 * Math.floor(Math.random() * 2); // 1-2 octaves
                // Add more leaps and syncopation for happy mood
                if (mood > 0.5 && Math.random() < 0.6) {
                    // Jump to another scale degree
                    let leapIdx = (scaleIdx + (Math.random() < 0.5 ? 2 : 4)) % scale.length;
                    melodyNote = rootMidi + scale[leapIdx] + 12 * Math.floor(Math.random() * 2);
                } else if (mood <= 0.5 && Math.random() < 0.6) {
                    // Jump to another scale degree
                    let leapIdx = (scaleIdx + (Math.random() < 0.5 ? 2 : 5)) % scale.length;
                    melodyNote = rootMidi + scale[leapIdx] + 12 * Math.floor(Math.random() * 2);
                }
                // Occasionally add a quick flourish (double or triple note)
                if (mood > 0.5 && Math.random() < 0.25) {
                    for (let f = 0; f < 2 + Math.floor(Math.random() * 2); f++) {
                        setTimeout(() => {
                            let flourishIdx = (scaleIdx + (Math.random() < 0.5 ? 1 : -1)) % scale.length;
                            let flourishNote = rootMidi + scale[(flourishIdx + scale.length) % scale.length] + 12 * Math.floor(Math.random() * 2);
                            let melAmp = 1.3 * (0.7 + Math.random() * 0.6) * synthVolume;
                            if (synthVolume > 0) {
                                synth.playNote(flourishNote, melAmp, 0.8, 0);
                            }
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
                    let melAmp = 0.8 * (0.7 + Math.random() * 0.6) * synthVolume; // Lowered amplitude for melody
                    if (synthVolume > 0) {
                        synth.playNote(melodyNote, melAmp, 0.8, 0);
                    }
                    // --- Advanced Multi-Voice Harmonization ---
                    const currentChordName = progression[chordIndex % progression.length];
                    const currentChord = chordLibrary[currentChordName];
                    chordIndex = (chordIndex + (Math.random() < 0.3 ? 1 : 0)) % progression.length; // Sometimes advance chord

                    // Voice leading and harmonic movement
                    const harmonies = [];
                    const voiceCount = Math.min(currentChord.length, 3 + Math.floor(Math.random() * 2)); // 3-4 voices

                    // Add chord tones with voice leading
                    for (let v = 0; v < voiceCount; v++) {
                        if (Math.random() < (0.4 + harmonyIntensity * 0.5)) { // Controlled by harmony slider
                            let interval = currentChord[v % currentChord.length];
                            // Octave displacement for voice separation
                            if (v > 0) interval += 12 * Math.floor(v / 3); // Spread voices across octaves
                            harmonies.push({
                                interval: interval,
                                voice: v,
                                delay: v * 15 + Math.random() * 10, // Slight voice staggering
                                waveform: v % 3 // Different waveforms per voice
                            });
                        }
                    }

                    // Add passing tones and non-chord tones for complexity
                    if (Math.random() < (0.2 + harmonyIntensity * 0.3)) { // Controlled by harmony slider
                        const passingTone = currentChord[0] + (Math.random() < 0.5 ? 1 : -1); // Semitone approach
                        harmonies.push({
                            interval: passingTone,
                            voice: 99, // Special voice for passing tones
                            delay: 50 + Math.random() * 30,
                            waveform: 0, // Sine for subtlety
                            amplitude: 0.2 // Quieter
                        });
                    }

                    // Play harmonized voices with advanced effects
                    harmonies.forEach((harmony, i) => {
                        setTimeout(() => {
                            let harmonyNote = melodyNote + harmony.interval;
                            let harmonyAmp = (harmony.amplitude || (melAmp * (0.25 + Math.random() * 0.15))) * synthVolume; // Varied amplitude

                            // Save synth state
                            let prevWave = synth.wave;
                            let prevFilterCutoff = synth._filter.frequency.value;

                            // Set voice-specific parameters
                            synth.setOscWave(harmony.waveform); // Different waveforms per voice

                            // Voice-specific filtering for separation
                            if (harmony.voice < 2) {
                                synth.setFilterCutoff(0.6 + harmony.voice * 0.1); // Higher voices brighter
                            } else {
                                synth.setFilterCutoff(0.4 - (harmony.voice - 2) * 0.05); // Lower voices darker
                            }

                            if (synthVolume > 0) {
                                synth.playNote(harmonyNote, harmonyAmp, 0.8, 0);
                            }

                            // Restore synth state
                            synth.setOscWave(prevWave === 'sine' ? 0 : prevWave === 'square' ? 1 : prevWave === 'sawtooth' ? 2 : 3);
                            synth.setFilterCutoff(prevFilterCutoff);

                        }, harmony.delay);
                    });

                    // Add harmonic resonance effect (sympathetic harmonics)
                    if (Math.random() < (harmonyIntensity * 0.4)) { // Controlled by harmony slider
                        setTimeout(() => {
                            const resonantFreqs = [melodyNote + 19, melodyNote + 24, melodyNote + 28]; // Natural harmonics
                            resonantFreqs.forEach((freq, idx) => {
                                setTimeout(() => {
                                    if (synthVolume > 0) {
                                        synth.playNote(freq, melAmp * 0.1 * (1 - idx * 0.3) * synthVolume, 0.9, 0);
                                    }
                                }, idx * 10);
                            });
                        }, 80);
                    }
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

        // --- Bass Harmonization Layer ---
        function playBassHarmonies() {
            const bassNotes = 6 + Math.floor(Math.random() * 4); // 6-10 bass notes
            const bassProgression = progression.slice(); // Copy melody progression
            let bassChordIndex = 0;

            for (let b = 0; b < bassNotes; b++) {
                let bassDelay = b * (600 + Math.floor(Math.random() * 400)); // Slower than melody

                timeout.push(setTimeout(() => {
                    const currentBassChord = chordLibrary[bassProgression[bassChordIndex % bassProgression.length]];
                    bassChordIndex++;

                    // Play root and fifth in bass register
                    const bassRoot = rootMidi - 12 + currentBassChord[0]; // One octave lower
                    const bassFifth = bassRoot + (currentBassChord[2] || 7); // Fifth if available

                    // Save/restore synth config for bass
                    let prevWave = synth.wave;
                    let prevAttack = synth._ampAttackTime;
                    let prevRelease = synth._ampReleaseTime;

                    // Set bass parameters
                    synth.setOscWave(2); // Sawtooth for bass
                    synth.setAmpAttackTime(0.1);
                    synth.setAmpReleaseTime(0.6);
                    synth.setFilterCutoff(0.25); // Dark bass tone

                    // Play bass root
                    if (synthVolume > 0) {
                        synth.playNote(bassRoot, (0.4 + Math.random() * 0.2) * synthVolume, 0.7, 0);
                    }

                    // Play bass fifth with slight delay
                    setTimeout(() => {
                        if (synthVolume > 0) {
                            synth.playNote(bassFifth, (0.25 + Math.random() * 0.15) * synthVolume, 0.7, 0);
                        }
                    }, 100 + Math.random() * 50);

                    // Restore config
                    synth.setOscWave(prevWave === 'sine' ? 0 : prevWave === 'square' ? 1 : prevWave === 'sawtooth' ? 2 : 3);
                    synth.setAmpAttackTime(prevAttack / 5);
                    synth.setAmpReleaseTime(prevRelease / 5);

                }, bassDelay));
            }
        }

        // --- Atmospheric Pad Layer ---
        function playAtmosphericPad() {
            if (Math.random() < (harmonyIntensity * 0.8)) { // Controlled by harmony slider
                const padDelay = 200 + Math.random() * 300;

                timeout.push(setTimeout(() => {
                    const padChord = chordLibrary[progression[0]]; // Use first chord of progression
                    const padRoot = rootMidi + 12; // Higher register

                    // Save synth state
                    let prevWave = synth.wave;
                    let prevAttack = synth._ampAttackTime;
                    let prevRelease = synth._ampReleaseTime;
                    let prevFilterCutoff = synth._filter.frequency.value;

                    // Set pad parameters
                    synth.setOscWave(0); // Sine for smooth pad
                    synth.setAmpAttackTime(0.8); // Slow attack
                    synth.setAmpReleaseTime(2.0); // Long release
                    synth.setFilterCutoff(0.35); // Soft filtering

                    // Play pad chord tones with staggered timing
                    padChord.slice(0, 4).forEach((interval, idx) => { // Max 4 voices
                        setTimeout(() => {
                            const padNote = padRoot + interval;
                            const padAmp = 0.15 * (1 - idx * 0.1) * synthVolume; // Decreasing amplitude
                            if (synthVolume > 0) {
                                synth.playNote(padNote, padAmp, 0.9, 0);
                            }
                        }, idx * 200);
                    });

                    // Restore config after pad
                    setTimeout(() => {
                        synth.setOscWave(prevWave === 'sine' ? 0 : prevWave === 'square' ? 1 : prevWave === 'sawtooth' ? 2 : 3);
                        synth.setAmpAttackTime(prevAttack / 5);
                        synth.setAmpReleaseTime(prevRelease / 5);
                        synth.setFilterCutoff(prevFilterCutoff);
                    }, 1000);

                }, padDelay));
            }
        }

        // --- End Melody Instrument ---

        // Progress bar setup
        const totalNotes = Math.floor(toplay.length / 2);
        showProgressBar();
        setProgressBar(0);

        // Auto-update drum pattern to follow new transaction
        if (drumPad && drumPad.isLooping) {
            console.log('🔗 Auto-updating drum pattern to follow new transaction');
            setTimeout(() => {
                drumPad.applyTransactionFills();
            }, 200); // Small delay to ensure transaction display is updated
        }

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

            // --- Enhanced Ambient Harmonization ---
            if (Math.random() < (harmonyIntensity * 0.5)) { // Controlled by harmony slider
                const ambientIntervals = mood > 0.5 ? [4, 7, 12] : [3, 7, 10]; // Major/minor harmonies
                ambientIntervals.forEach((interval, idx) => {
                    if (Math.random() < 0.6) { // Probabilistic harmonies
                        setTimeout(() => {
                            const harmonyNote = midiNote + interval;
                            const harmonyAmp = dynamicAmp * (0.3 - idx * 0.08) * synthVolume; // Decreasing volume
                            playSound(harmonyNote, byteHex, 0, harmonyAmp, filterOffset + 0.1);
                        }, (idx + 1) * (20 + Math.random() * 15));
                    }
                });
            }

            // --- Extra dynamic: quick grace note (octave up or down) ---
            if (mood > 0.5 && Math.random() < 0.35) { // more grace notes
                var graceNote = midiNote + (Math.random() < 0.5 ? 12 : -12);
                if (graceNote >= 48 && graceNote <= 84) {
                    setTimeout(() => {
                        playSound(graceNote, byteHex, 0, dynamicAmp * 1.1 * synthVolume, filterOffset);
                    }, 40 + Math.random() * 80); // quicker after main note
                }
            }

            // --- Harmonic Resonance for Ambient Layer ---
            if (Math.random() < (harmonyIntensity * 0.25)) { // Controlled by harmony slider
                setTimeout(() => {
                    // Natural harmonic series
                    const harmonicFreqs = [midiNote + 12, midiNote + 19, midiNote + 24];
                    harmonicFreqs.forEach((freq, idx) => {
                        setTimeout(() => {
                            playSound(freq, byteHex, 0, dynamicAmp * 0.15 * (1 - idx * 0.3) * synthVolume, filterOffset + 0.2);
                        }, idx * 15);
                    });
                }, 60 + Math.random() * 40);
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
        playBassHarmonies();
        playAtmosphericPad();



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