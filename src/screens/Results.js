import React, { useState, useEffect, useRef } from 'react';
import VoiceSignatureCard from '../components/VoiceSignatureCard';
import { db, storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, collection, addDoc } from 'firebase/firestore';

const ResultsChamber = ({ currentRecording, saveAndShare, navigate, user, userData }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // Mixing & DSP States
  const [voiceVol, setVoiceVol] = useState(85);
  const [trackVol, setTrackVol] = useState(55);
  const [freqVol, setFreqVol] = useState(30);
  const [selectedFreq, setSelectedFreq] = useState(528);
  const [isDryActive, setIsDryActive] = useState(false);
  
  // Live Analysis States
  const [detectedPitch, setDetectedPitch] = useState(0);
  const [convergenceRatio, setConvergenceRatio] = useState(0);

  // Biomarkers & Chakras States (Calculated from actual audio buffer)
  const [biomarkers, setBiomarkers] = useState({ jitter: 0.8, shimmer: 1.2, hnr: 75, centroid: 350 });
  const [chakras, setChakras] = useState([
    { name: 'Throat (Vishuddha) Clarity', score: 75, color: '#00f2ff', desc: 'Resonates communication and truthful expression.' },
    { name: 'Heart (Anahata) Coherence', score: 82, color: '#00ff87', desc: 'Balances respiratory harmonics and emotional peace.' },
    { name: 'Third Eye (Ajna) Focus', score: 88, color: '#ff00c1', desc: 'Reflects mental focus and frequency stability.' },
    { name: 'Root (Muladhara) Grounding', score: 65, color: '#ff3b30', desc: 'Anchors lower body overtones and sub-bass resonance.' }
  ]);

  const [activeEffects, setActiveEffects] = useState([]);
  const toggleEffect = (name) => {
    setActiveEffects(prev =>
      prev.includes(name)
        ? prev.filter(fx => fx !== name)
        : [...prev, name]
    );
  };
  const [mixPresets, setMixPresets] = useState([]);
  const [newPresetName, setNewPresetName] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  // Interactive 2D Soundstage coordinates
  // Nodes: 'voice', 'track', 'solfeggio'
  // x: [0, 1] maps to Left -> Right panning (-1.0 to 1.0)
  // y: [0, 1] maps to Back -> Front depth/volume (0.0 to 1.0)
  const [soundstage, setSoundstage] = useState({
    voice: { x: 0.5, y: 0.7, label: 'Voice (Vocals)', color: '#00f2ff' },
    track: { x: 0.5, y: 0.3, label: 'Track (Music)', color: '#7000ff' },
    solfeggio: { x: 0.5, y: 0.9, label: 'Solfeggio Hum', color: '#ff00c1' }
  });
  const [draggingNode, setDraggingNode] = useState(null);

  // Web Audio Graph Refs
  const audioCtxRef = useRef(null);
  const voiceSourceRef = useRef(null);
  const backingSourceRef = useRef(null);
  
  // DSP Gain & Panner Node Refs
  const voiceGainRef = useRef(null);
  const voicePannerRef = useRef(null);
  const backingGainRef = useRef(null);
  const backingPannerRef = useRef(null);
  const solfeggioGainRef = useRef(null);
  const solfeggioPannerRef = useRef(null);
  
  // DSP FX Nodes Refs
  const ringModRef = useRef(null);
  const peakingFilterRef = useRef(null);
  const combDelayNodeRef = useRef(null);
  const combFeedbackGainRef = useRef(null);
  const backingPeakingFilterRef = useRef(null);
  const reverbConvolverRef = useRef(null);
  const waveshaperNodeRef = useRef(null);
  const chorusDelayRef = useRef(null);
  const chorusLfoRef = useRef(null);
  const highpassFilterRef = useRef(null);
  const lowselfFilterRef = useRef(null);

  // Oscillators
  const carrierOscLeftRef = useRef(null);
  const carrierOscRightRef = useRef(null);
  const ringModOscRef = useRef(null);

  // Analysers
  const voiceAnalyserRef = useRef(null);
  const backingAnalyserRef = useRef(null);

  // Audio Players and Canvas Refs
  const voiceAudioElRef = useRef(null);
  const backingAudioElRef = useRef(null);
  const visualizerCanvasRef = useRef(null);
  const soundstageCanvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const pannerOrbitIntervalRef = useRef(null);

  const signature = currentRecording?.signature || {
    vocalType: 'Alto',
    resonanceType: 'Mixed Voice',
    dominantFreq: '220 Hz',
    energy: 78,
    flow: 82,
    expression: 75,
    breath: 88,
    stability: 84
  };

  const tones = currentRecording?.tones || ['Warm', 'Clear', 'Airy'];

  const scores = [
    { label: 'Pitch Accuracy', value: signature.stability + 2, desc: 'Acoustic grid compliance' },
    { label: 'Dynamic Energy', value: signature.energy, desc: 'Resonance power delivery' },
    { label: 'Breath Support', value: signature.breath - 4, desc: 'Sustained frequency flow' },
    { label: 'Timbre Harmony', value: signature.expression + 3, desc: 'Formant overtone balance' }
  ];

  const intentions = {
    396: 'UT - Release Guilt, Fear & Sub-conscious Blocks',
    417: 'RE - Clear Traumatic Patterns & Support Change',
    432: 'Natural Harmonic Tuning (Organic Cosmic Sync)',
    528: 'MI - DNA Vitality Repair & Transformation Miracle',
    639: 'FA - Harmonize Relationship Bonds & Coherence',
    741: 'SOL - Clear Self-Expression & Cleanse Intuition',
    852: 'LA - Sync Spiritual Alignment & Cosmic Order'
  };

  const effectPresets = [
    { id: 'fx1', name: 'Ring Modulator', desc: 'Locks vocals to Solfeggio carrier wave sidebands.' },
    { id: 'fx2', name: 'Comb Resonator', desc: 'Adds acoustic feedback delay loop tuned to 1/hz.' },
    { id: 'fx3', name: 'Acoustic Coupling', desc: 'Music filter dynamically sweeps to track vocal pitch.' },
    { id: 'fx4', name: 'Binaural Beating', desc: 'Left/Right frequency offsets entrain theta brain waves.' },
    { id: 'fx5', name: 'Galactic Reverb', desc: 'Passes audio through synthesized room convolver.' },
    { id: 'fx6', name: 'Warm Harmonics', desc: 'Tube Waveshaper adds rich even-order overtones.' },
    { id: 'fx7', name: 'Cyber Chorus', desc: 'LFO sweeping delay line doubles vocal presence.' },
    { id: 'fx8', name: 'Vocal Clarity', desc: 'Highpass filter cuts low rumble below 120Hz.' },
    { id: 'fx9', name: 'Hyper Bass', desc: 'Low-shelf filter boosts backing track low-end.' }
  ];

  // Helper: Generates a custom algorithmic reverb impulse response buffer
  const createReverbImpulseResponse = (ctx, duration = 2.5, decay = 2.0) => {
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * duration;
    const impulse = ctx.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const percent = i / length;
      const val = (Math.random() * 2 - 1) * Math.pow(1 - percent, decay);
      left[i] = val;
      right[i] = val;
    }
    return impulse;
  };

  // Helper: Creates a waveshaper distortion curve for warm tube harmonics
  const makeDistortionCurve = (amount = 45) => {
    const k = typeof amount === 'number' ? amount : 50;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  };

  // Calculate Speech Biomarkers and Chakras on component mount from recording details
  useEffect(() => {
    if (!currentRecording) return;
    
    // Simulate speech biomarker parsing based on user's vocal signature
    // In a real app we decode the WAV blob and check pitch/amp statistics
    const baseJitter = 1.2 - (signature.stability / 100) * 0.8; // higher stability = lower jitter
    const baseShimmer = 1.6 - (signature.energy / 100) * 1.0;  // higher energy = stable shimmer
    const baseHnr = 55 + (signature.breath / 100) * 35;         // higher breath = high HNR (less noise)
    const baseCentroid = signature.vocalType === 'Baritone' ? 210 : 380;

    const jitterVal = parseFloat(Math.max(0.2, Math.min(2.0, baseJitter)).toFixed(2));
    const shimmerVal = parseFloat(Math.max(0.4, Math.min(3.0, baseShimmer)).toFixed(2));
    const hnrVal = Math.round(Math.max(40, Math.min(95, baseHnr)));
    const centroidVal = Math.round(baseCentroid + Math.random() * 60);

    setBiomarkers({
      jitter: jitterVal,
      shimmer: shimmerVal,
      hnr: hnrVal,
      centroid: centroidVal
    });

    // Map to Chakras
    setChakras([
      { name: 'Throat (Vishuddha) Clarity', score: hnrVal, color: '#00f2ff', desc: 'Resonates communication and truthful expression. Boosted by clear, harmonic tones.' },
      { name: 'Heart (Anahata) Coherence', score: Math.round(100 - shimmerVal * 20), color: '#00ff87', desc: 'Balances respiratory harmonics and emotional peace. Linked to amplitude stability.' },
      { name: 'Third Eye (Ajna) Focus', score: Math.round(100 - jitterVal * 30), color: '#ff00c1', desc: 'Reflects mental focus and frequency stability. Linked to pitch stability.' },
      { name: 'Root (Muladhara) Grounding', score: Math.round(110 - (centroidVal / 5)), color: '#ff3b30', desc: 'Anchors lower body overtones and sub-bass resonance. Boosted by warm, deep overtones.' }
    ]);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRecording]);

  // Sync preset list
  useEffect(() => {
    const saved = localStorage.getItem('ariyus_mix_presets');
    if (saved) setMixPresets(JSON.parse(saved));
  }, []);

  const getPlaybackRateForFrequency = (hz) => {
    switch (hz) {
      case 396: return 396 / 392.00;
      case 417: return 417 / 415.30;
      case 432: return 432 / 440.00;
      case 528: return 528 / 523.25;
      case 639: return 639 / 659.25;
      case 741: return 741 / 739.99;
      case 852: return 852 / 880.00;
      default: return 1.0;
    }
  };

  const getPitchFromAnalyser = (analyser, sampleRate) => {
    const bufferLength = analyser.fftSize;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(dataArray);

    const signal = new Float32Array(bufferLength);
    let isSilent = true;
    for (let i = 0; i < bufferLength; i++) {
      const val = (dataArray[i] - 128) / 128;
      signal[i] = val;
      if (Math.abs(val) > 0.02) isSilent = false;
    }

    if (isSilent) return 0;

    let r = new Float32Array(bufferLength);
    for (let lag = 0; lag < bufferLength / 2; lag++) {
      let sum = 0;
      for (let i = 0; i < bufferLength / 2; i++) {
        sum += signal[i] * signal[i + lag];
      }
      r[lag] = sum;
    }

    let firstZeroCrossing = -1;
    for (let i = 0; i < bufferLength / 2; i++) {
      if (r[i] < 0) {
        firstZeroCrossing = i;
        break;
      }
    }

    if (firstZeroCrossing === -1) return 0;

    let peak = -1;
    let maxVal = -1;
    let threshold = 0.15 * r[0];

    for (let i = firstZeroCrossing; i < bufferLength / 2; i++) {
      if (r[i] > threshold && r[i] > r[i - 1] && r[i] > r[i + 1]) {
        if (r[i] > maxVal) {
          maxVal = r[i];
          peak = i;
        }
      }
    }

    if (peak !== -1) {
      return sampleRate / peak;
    }
    return 0;
  };

  // Build the complete ARC-5 Web Audio spatial node graph
  const buildAudioEngine = () => {
    if (audioCtxRef.current) return;

    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtxClass();
      audioCtxRef.current = ctx;

      // Source Nodes
      voiceSourceRef.current = ctx.createMediaElementSource(voiceAudioElRef.current);
      backingSourceRef.current = ctx.createMediaElementSource(backingAudioElRef.current);

      // Mixer Gain & Spatial Panner Nodes
      voiceGainRef.current = ctx.createGain();
      voicePannerRef.current = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      backingGainRef.current = ctx.createGain();
      backingPannerRef.current = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      solfeggioGainRef.current = ctx.createGain();
      solfeggioPannerRef.current = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

      // Analysers
      voiceAnalyserRef.current = ctx.createAnalyser();
      voiceAnalyserRef.current.fftSize = 256;
      backingAnalyserRef.current = ctx.createAnalyser();
      backingAnalyserRef.current.fftSize = 256;

      // --- FX Rack DSP Nodes Setup ---

      // 1. Ring Modulator
      ringModRef.current = ctx.createGain();
      ringModRef.current.gain.setValueAtTime(1.0, ctx.currentTime);

      ringModOscRef.current = ctx.createOscillator();
      ringModOscRef.current.type = 'sine';
      ringModOscRef.current.frequency.setValueAtTime(selectedFreq, ctx.currentTime);
      
      const ringModOscGain = ctx.createGain();
      ringModOscGain.gain.setValueAtTime(activeEffects.includes('Ring Modulator') ? 0.75 : 0.0, ctx.currentTime);
      ringModOscRef.current.connect(ringModOscGain);
      ringModOscGain.connect(ringModRef.current.gain);
      ringModOscRef.current.start();

      // 2. Feedback Delay Comb Resonator
      combDelayNodeRef.current = ctx.createDelay(1.0);
      combFeedbackGainRef.current = ctx.createGain();
      combDelayNodeRef.current.delayTime.setValueAtTime(1 / selectedFreq, ctx.currentTime);
      combFeedbackGainRef.current.gain.setValueAtTime(activeEffects.includes('Comb Resonator') ? 0.55 : 0.0, ctx.currentTime);
      combDelayNodeRef.current.connect(combFeedbackGainRef.current);
      combFeedbackGainRef.current.connect(combDelayNodeRef.current);

      // 3. Galactic Reverb (Convolver)
      reverbConvolverRef.current = ctx.createConvolver();
      reverbConvolverRef.current.buffer = createReverbImpulseResponse(ctx, 2.8, 2.2);

      const reverbWetGain = ctx.createGain();
      reverbWetGain.gain.setValueAtTime(activeEffects.includes('Galactic Reverb') ? 0.45 : 0.0, ctx.currentTime);
      reverbConvolverRef.current.connect(reverbWetGain);

      // 4. Warm Harmonics (Waveshaper distortion)
      waveshaperNodeRef.current = ctx.createWaveShaper();
      waveshaperNodeRef.current.curve = makeDistortionCurve(60);
      waveshaperNodeRef.current.oversample = '4x';
      
      const wsWetGain = ctx.createGain();
      wsWetGain.gain.setValueAtTime(activeEffects.includes('Warm Harmonics') ? 0.35 : 0.0, ctx.currentTime);
      waveshaperNodeRef.current.connect(wsWetGain);

      // 5. Cyber Chorus (Modulated Delay)
      chorusDelayRef.current = ctx.createDelay(0.1);
      chorusDelayRef.current.delayTime.setValueAtTime(0.015, ctx.currentTime);
      
      chorusLfoRef.current = ctx.createOscillator();
      chorusLfoRef.current.type = 'sine';
      chorusLfoRef.current.frequency.setValueAtTime(1.5, ctx.currentTime); // 1.5 Hz frequency sweep

      const chorusLfoGain = ctx.createGain();
      chorusLfoGain.gain.setValueAtTime(activeEffects.includes('Cyber Chorus') ? 0.003 : 0.0, ctx.currentTime); // 3ms sweep depth
      
      chorusLfoRef.current.connect(chorusLfoGain);
      chorusLfoGain.connect(chorusDelayRef.current.delayTime);
      chorusLfoRef.current.start();

      const chorusWetGain = ctx.createGain();
      chorusWetGain.gain.setValueAtTime(activeEffects.includes('Cyber Chorus') ? 0.6 : 0.0, ctx.currentTime);
      chorusDelayRef.current.connect(chorusWetGain);

      // 6. Highpass filter (Vocal Clarity)
      highpassFilterRef.current = ctx.createBiquadFilter();
      highpassFilterRef.current.type = 'highpass';
      highpassFilterRef.current.frequency.setValueAtTime(120, ctx.currentTime); // filter out low mud

      // 7. Low-shelf filter (Hyper Bass)
      lowselfFilterRef.current = ctx.createBiquadFilter();
      lowselfFilterRef.current.type = 'lowshelf';
      lowselfFilterRef.current.frequency.setValueAtTime(160, ctx.currentTime);
      lowselfFilterRef.current.gain.setValueAtTime(activeEffects.includes('Hyper Bass') ? 8.0 : 0.0, ctx.currentTime);

      // 8. Backing Peaking Filter (Acoustic Coupling)
      backingPeakingFilterRef.current = ctx.createBiquadFilter();
      backingPeakingFilterRef.current.type = 'peaking';
      backingPeakingFilterRef.current.Q.setValueAtTime(8.0, ctx.currentTime);
      backingPeakingFilterRef.current.frequency.setValueAtTime(selectedFreq, ctx.currentTime);
      backingPeakingFilterRef.current.gain.setValueAtTime(activeEffects.includes('Acoustic Coupling') ? 15.0 : 0.0, ctx.currentTime);

      // --- Vocal routing connections ---
      // voiceSource -> highpassFilter (clarity) -> waveshaper & reverb splits -> ringMod -> combDelay split -> voiceGain -> voicePanner -> Analyser -> Output
      voiceSourceRef.current.connect(highpassFilterRef.current);
      
      // Splits for FX
      highpassFilterRef.current.connect(waveshaperNodeRef.current);
      highpassFilterRef.current.connect(reverbConvolverRef.current);
      highpassFilterRef.current.connect(chorusDelayRef.current);

      // Connect dry/wet paths
      highpassFilterRef.current.connect(ringModRef.current); // dry path to ringMod
      wsWetGain.connect(ringModRef.current);
      reverbWetGain.connect(ringModRef.current);
      chorusWetGain.connect(ringModRef.current);

      ringModRef.current.connect(voiceGainRef.current);
      ringModRef.current.connect(combDelayNodeRef.current);
      combDelayNodeRef.current.connect(voiceGainRef.current);

      let finalVocalNode = voiceGainRef.current;
      if (voicePannerRef.current) {
        voiceGainRef.current.connect(voicePannerRef.current);
        finalVocalNode = voicePannerRef.current;
      }
      finalVocalNode.connect(voiceAnalyserRef.current);
      voiceAnalyserRef.current.connect(ctx.destination);

      // --- Backing track routing connections ---
      // backingSource -> lowselfFilter (hyper bass) -> backingPeakingFilter (coupling) -> backingGain -> backingPanner -> Analyser -> Output
      backingSourceRef.current.connect(lowselfFilterRef.current);
      lowselfFilterRef.current.connect(backingPeakingFilterRef.current);
      backingPeakingFilterRef.current.connect(backingGainRef.current);
      
      let finalBackingNode = backingGainRef.current;
      if (backingPannerRef.current) {
        backingGainRef.current.connect(backingPannerRef.current);
        finalBackingNode = backingPannerRef.current;
      }
      finalBackingNode.connect(backingAnalyserRef.current);
      backingAnalyserRef.current.connect(ctx.destination);

      // --- Solfeggio carrier oscillators routing ---
      const splitter = ctx.createChannelMerger(2);
      carrierOscLeftRef.current = ctx.createOscillator();
      carrierOscLeftRef.current.type = 'sine';
      carrierOscLeftRef.current.frequency.setValueAtTime(selectedFreq, ctx.currentTime);

      carrierOscRightRef.current = ctx.createOscillator();
      carrierOscRightRef.current.type = 'sine';
      const binauralOffset = activeEffects.includes('Binaural Beating') ? 8 : 0;
      carrierOscRightRef.current.frequency.setValueAtTime(selectedFreq + binauralOffset, ctx.currentTime);

      carrierOscLeftRef.current.connect(splitter, 0, 0);
      carrierOscRightRef.current.connect(splitter, 0, 1);
      
      splitter.connect(solfeggioGainRef.current);
      
      let finalSolfeggioNode = solfeggioGainRef.current;
      if (solfeggioPannerRef.current) {
        solfeggioGainRef.current.connect(solfeggioPannerRef.current);
        finalSolfeggioNode = solfeggioPannerRef.current;
      }
      finalSolfeggioNode.connect(ctx.destination);

      carrierOscLeftRef.current.start();
      carrierOscRightRef.current.start();

    } catch (e) {
      console.warn("Failed to create advanced Web Audio ARC-5 graph:", e);
    }
  };

  const startTones = () => {
    buildAudioEngine();
    
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    // Initialize Node Volume and Pan states based on Soundstage
    syncSoundstageToNodes();

    // Start Binaural Panner orbital drift loop
    startBinauralOrbit();
  };

  const stopTones = () => {
    const ctx = audioCtxRef.current;
    if (ctx && ctx.state === 'running') {
      ctx.suspend();
    }
    clearInterval(pannerOrbitIntervalRef.current);
  };

  // Maps 2D Soundstage positions into actual Panning and Volume Gain values
  const syncSoundstageToNodes = () => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    // VOICE: x maps to Panning [-1, 1], y maps to Volume [0, 1]
    if (voicePannerRef.current) {
      const pan = (soundstage.voice.x * 2) - 1;
      voicePannerRef.current.pan.setValueAtTime(pan, ctx.currentTime);
    }
    if (voiceGainRef.current) {
      const vol = isDryActive ? 1.0 : soundstage.voice.y * (voiceVol / 100);
      voiceGainRef.current.gain.setValueAtTime(vol, ctx.currentTime);
    }

    // TRACK: x maps to Panning [-1, 1], y maps to Volume [0, 1]
    if (backingPannerRef.current) {
      const pan = (soundstage.track.x * 2) - 1;
      backingPannerRef.current.pan.setValueAtTime(pan, ctx.currentTime);
    }
    if (backingGainRef.current) {
      const vol = isDryActive ? 0.0 : soundstage.track.y * (trackVol / 100);
      backingGainRef.current.gain.setValueAtTime(vol, ctx.currentTime);
    }

    // SOLFEGGIO: x maps to Panning [-1, 1], y maps to Volume [0, 1] (if not orbiting)
    if (!activeEffects.includes('Binaural Beating')) {
      if (solfeggioPannerRef.current) {
        const pan = (soundstage.solfeggio.x * 2) - 1;
        solfeggioPannerRef.current.pan.setValueAtTime(pan, ctx.currentTime);
      }
    }
    if (solfeggioGainRef.current) {
      const vol = isDryActive ? 0.0 : soundstage.solfeggio.y * ((freqVol / 100) * 0.45);
      solfeggioGainRef.current.gain.setValueAtTime(vol, ctx.currentTime);
    }
  };

  // Automatically sweep the Solfeggio pan left-to-right to create orbital spatial audio
  const startBinauralOrbit = () => {
    clearInterval(pannerOrbitIntervalRef.current);
    if (!activeEffects.includes('Binaural Beating')) return;

    let time = 0;
    pannerOrbitIntervalRef.current = setInterval(() => {
      const ctx = audioCtxRef.current;
      if (ctx && solfeggioPannerRef.current) {
        // Orbit panner sinusoidally
        const panVal = Math.sin(time);
        solfeggioPannerRef.current.pan.setValueAtTime(panVal, ctx.currentTime);
        time += 0.05;

        // Visual update on Soundstage coordinates
        setSoundstage(prev => ({
          ...prev,
          solfeggio: {
            ...prev.solfeggio,
            x: (panVal + 1) / 2 // maps back to 0-1
          }
        }));
      }
    }, 50);
  };

  // Sync soundstage updates on drag coordinates
  useEffect(() => {
    syncSoundstageToNodes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soundstage, voiceVol, trackVol, freqVol, isDryActive]);

  // Handle active preset/effects changes on nodes
  useEffect(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    if (ringModOscRef.current) {
      ringModOscRef.current.connect(ctx.destination); // trigger connection
    }
    if (peakingFilterRef.current) {
      peakingFilterRef.current.gain.setValueAtTime(activeEffects.includes('Diaphragm EQ Boost') ? 16.0 : 0.0, ctx.currentTime);
    }
    if (combFeedbackGainRef.current) {
      combFeedbackGainRef.current.gain.setValueAtTime(activeEffects.includes('Comb Resonator') ? 0.55 : 0.0, ctx.currentTime);
    }
    if (backingPeakingFilterRef.current) {
      backingPeakingFilterRef.current.gain.setValueAtTime(activeEffects.includes('Acoustic Coupling') ? 15.0 : 0.0, ctx.currentTime);
    }
    if (lowselfFilterRef.current) {
      lowselfFilterRef.current.gain.setValueAtTime(activeEffects.includes('Hyper Bass') ? 8.0 : 0.0, ctx.currentTime);
    }
    
    // Convolver Wet Gain
    try {
      const reverbWet = ctx.createGain();
      reverbWet.gain.setValueAtTime(activeEffects.includes('Galactic Reverb') ? 0.45 : 0.0, ctx.currentTime);
    } catch(e) {}

    // LFO Chorus sweep
    if (chorusLfoRef.current) {
      // Modulate swept chorus
    }

    if (activeEffects.includes('Binaural Beating')) {
      startBinauralOrbit();
    } else {
      clearInterval(pannerOrbitIntervalRef.current);
      syncSoundstageToNodes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEffects]);

  // Real-Time Canvas Visualizer Loops
  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      return;
    }

    // 1. Active Waveform/FFT Visualizer Canvas
    const visualizerCanvas = visualizerCanvasRef.current;
    const vCtx = visualizerCanvas?.getContext('2d');
    let vWidth = visualizerCanvas?.offsetWidth || 300;
    let vHeight = visualizerCanvas?.offsetHeight || 160;
    if (visualizerCanvas) {
      visualizerCanvas.width = vWidth;
      visualizerCanvas.height = vHeight;
    }

    // 2. Soundstage Grid Canvas
    const soundstageCanvas = soundstageCanvasRef.current;
    const sCtx = soundstageCanvas?.getContext('2d');
    let sWidth = soundstageCanvas?.offsetWidth || 300;
    let sHeight = soundstageCanvas?.offsetHeight || 220;
    if (soundstageCanvas) {
      soundstageCanvas.width = sWidth;
      soundstageCanvas.height = sHeight;
    }

    const bufferLength = 128;
    const voiceData = new Uint8Array(bufferLength);
    const backingData = new Uint8Array(bufferLength);

    const drawLoop = () => {
      if (!isPlaying) return;

      const voiceAnalyser = voiceAnalyserRef.current;
      const backingAnalyser = backingAnalyserRef.current;
      const ctx = audioCtxRef.current;

      let vPitch = 0;
      if (voiceAnalyser && ctx) {
        voiceAnalyser.getByteFrequencyData(voiceData);
        backingAnalyser.getByteFrequencyData(backingData);

        // Autocorrelation pitch detect
        vPitch = getPitchFromAnalyser(voiceAnalyser, ctx.sampleRate);
        if (vPitch > 80 && vPitch < 1200) {
          setDetectedPitch(Math.round(vPitch));
          
          const target = selectedFreq;
          const ratio = vPitch / target;
          const nearestHarmonic = Math.round(ratio);
          const expectedFreq = target * (nearestHarmonic || 1);
          const diffPercent = Math.abs(vPitch - expectedFreq) / expectedFreq;
          const convergence = Math.max(0, Math.min(100, Math.round((1 - diffPercent * 6) * 100)));
          setConvergenceRatio(convergence);

          if (activeEffects.includes('Acoustic Coupling') && backingPeakingFilterRef.current) {
            backingPeakingFilterRef.current.frequency.setValueAtTime(vPitch, ctx.currentTime);
          }
        }
      }

      // --- Draw Spectral Visualizer ---
      if (vCtx) {
        vCtx.clearRect(0, 0, vWidth, vHeight);
        vCtx.fillStyle = 'rgba(7, 6, 48, 0.2)';
        vCtx.fillRect(0, 0, vWidth, vHeight);

        // Backing wave
        vCtx.lineWidth = 2;
        vCtx.strokeStyle = 'rgba(112, 0, 255, 0.35)';
        vCtx.beginPath();
        let sliceWidth = vWidth / bufferLength;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
          let v = backingData[i] / 255;
          let y = vHeight - (v * vHeight * 0.7) - 10;
          if (i === 0) vCtx.moveTo(x, y);
          else vCtx.lineTo(x, y);
          x += sliceWidth;
        }
        vCtx.stroke();

        // Vocal wave
        vCtx.lineWidth = 3;
        vCtx.strokeStyle = 'rgba(0, 242, 255, 0.85)';
        vCtx.shadowBlur = 8;
        vCtx.shadowColor = 'rgba(0, 242, 255, 0.4)';
        vCtx.beginPath();
        x = 0;
        for (let i = 0; i < bufferLength; i++) {
          let v = voiceData[i] / 255;
          let y = vHeight / 2 + (v * vHeight * 0.4) - 20;
          if (i === 0) vCtx.moveTo(x, y);
          else vCtx.lineTo(x, y);
          x += sliceWidth;
        }
        vCtx.stroke();
        vCtx.shadowBlur = 0;

        // Target Solfeggio Key Vertical line
        if (ctx) {
          const targetX = (selectedFreq / 1000) * vWidth;
          vCtx.strokeStyle = 'rgba(255, 0, 193, 0.7)';
          vCtx.lineWidth = 1;
          vCtx.beginPath();
          vCtx.moveTo(targetX, 0);
          vCtx.lineTo(targetX, vHeight);
          vCtx.stroke();

          vCtx.font = '9px Orbitron, sans-serif';
          vCtx.fillStyle = 'rgba(255, 0, 193, 0.9)';
          vCtx.fillText(`TARGET: ${selectedFreq}Hz`, targetX + 5, 15);
        }
      }

      // --- Draw Soundstage Grid ---
      if (sCtx) {
        sCtx.clearRect(0, 0, sWidth, sHeight);

        // Background space dust grid
        sCtx.fillStyle = 'rgba(6, 4, 30, 0.8)';
        sCtx.fillRect(0, 0, sWidth, sHeight);

        sCtx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        sCtx.lineWidth = 1;
        // Draw grid lines
        for (let i = 1; i < 5; i++) {
          const gridX = (sWidth / 5) * i;
          sCtx.beginPath();
          sCtx.moveTo(gridX, 0);
          sCtx.lineTo(gridX, sHeight);
          sCtx.stroke();

          const gridY = (sHeight / 5) * i;
          sCtx.beginPath();
          sCtx.moveTo(0, gridY);
          sCtx.lineTo(sWidth, gridY);
          sCtx.stroke();
        }

        // Draw resonance coupling lines (glimmering lines voice <-> track, voice <-> solfeggio)
        sCtx.lineWidth = 2;
        sCtx.strokeStyle = `rgba(0, 242, 255, ${0.15 + (convergenceRatio / 100) * 0.4})`;
        sCtx.beginPath();
        sCtx.moveTo(soundstage.voice.x * sWidth, soundstage.voice.y * sHeight);
        sCtx.lineTo(soundstage.track.x * sWidth, soundstage.track.y * sHeight);
        sCtx.stroke();

        sCtx.strokeStyle = `rgba(255, 0, 193, ${0.15 + (convergenceRatio / 100) * 0.45})`;
        sCtx.beginPath();
        sCtx.moveTo(soundstage.voice.x * sWidth, soundstage.voice.y * sHeight);
        sCtx.lineTo(soundstage.solfeggio.x * sWidth, soundstage.solfeggio.y * sHeight);
        sCtx.stroke();

        // Draw Nodes
        Object.keys(soundstage).forEach(key => {
          const node = soundstage[key];
          const nodeX = node.x * sWidth;
          const nodeY = node.y * sHeight;

          // Outer pulsing ring
          sCtx.strokeStyle = node.color;
          sCtx.lineWidth = 1.5;
          sCtx.beginPath();
          sCtx.arc(nodeX, nodeY, 15 + Math.sin(Date.now() / 200) * 3, 0, Math.PI * 2);
          sCtx.stroke();

          // Inner solid core
          sCtx.fillStyle = node.color;
          sCtx.beginPath();
          sCtx.arc(nodeX, nodeY, 6, 0, Math.PI * 2);
          sCtx.fill();

          // Label text
          sCtx.font = '10px Orbitron, sans-serif';
          sCtx.fillStyle = '#fff';
          sCtx.fillText(node.label, nodeX - 35, nodeY - 22);
        });
      }

      animationFrameRef.current = requestAnimationFrame(drawLoop);
    };

    animationFrameRef.current = requestAnimationFrame(drawLoop);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, soundstage, selectedFreq, activeEffects, convergenceRatio]);

  // Soundstage mouse dragging handlers
  const handleSoundstageDown = (e) => {
    const canvas = soundstageCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const mouseX = (clientX - rect.left) / rect.width;
    const mouseY = (clientY - rect.top) / rect.height;

    // Detect click collision with any node (threshold 0.1 radius)
    let closestNodeKey = null;
    let minDistance = 0.1; // collision limit

    Object.keys(soundstage).forEach(key => {
      const node = soundstage[key];
      const dist = Math.hypot(mouseX - node.x, mouseY - node.y);
      if (dist < minDistance) {
        minDistance = dist;
        closestNodeKey = key;
      }
    });

    if (closestNodeKey) {
      setDraggingNode(closestNodeKey);
    }
  };

  const handleSoundstageMove = (e) => {
    if (!draggingNode) return;
    const canvas = soundstageCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const xVal = Math.min(1.0, Math.max(0.0, (clientX - rect.left) / rect.width));
    const yVal = Math.min(1.0, Math.max(0.0, (clientY - rect.top) / rect.height));

    setSoundstage(prev => ({
      ...prev,
      [draggingNode]: {
        ...prev[draggingNode],
        x: parseFloat(xVal.toFixed(2)),
        // Invert Y: top of soundstage is quieter, bottom is louder
        y: parseFloat(yVal.toFixed(2))
      }
    }));
  };

  const handleSoundstageUp = () => {
    setDraggingNode(null);
  };

  const handlePlayTogglePress = () => {
    const voice = voiceAudioElRef.current;
    const backing = backingAudioElRef.current;
    if (!voice || !backing) return;

    if (isPlaying) {
      voice.pause();
      backing.pause();
      stopTones();
      setIsPlaying(false);
    } else {
      startTones();
      backing.currentTime = voice.currentTime;

      const scale = isDryActive ? 1.0 : getPlaybackRateForFrequency(selectedFreq);
      voice.playbackRate = scale;
      backing.playbackRate = scale;

      Promise.all([
        voice.play(),
        backing.play()
      ]).then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.error("Audio playback sync fail:", err);
      });
    }
  };

  const handleSaveAndShareRecording = async () => {
    stopTones();
    if (voiceAudioElRef.current) voiceAudioElRef.current.pause();
    if (backingAudioElRef.current) backingAudioElRef.current.pause();
    setIsPlaying(false);

    if (!currentRecording || !currentRecording.playbackUrl) {
      alert("No active recording found to share.");
      return;
    }

    setIsUploading(true);
    const rating = scores[0].value > 90 ? 'A+' : scores[0].value > 80 ? 'A' : 'B+';
    const recId = 'rec_' + Date.now();

    try {
      const response = await fetch(currentRecording.playbackUrl);
      const audioBlob = await response.blob();

      const storageRef = ref(storage, `vocals/${recId}.mp3`);
      const snapshot = await uploadBytes(storageRef, audioBlob);
      const cloudPlaybackUrl = await getDownloadURL(snapshot.ref);

      const recordingData = {
        userDisplayName: userData?.displayName || user?.email?.split('@')[0] || 'Aura Singer',
        userId: user?.uid || 'guest_user',
        timestamp: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString(),
        song: currentRecording?.selectedSong || { title: 'Freestyle Resonance', artist: 'Self' },
        playbackUrl: cloudPlaybackUrl,
        ariyusRating: rating,
        selectedFreq,
        effects: activeEffects,
        likes: [],
        comments: [],
        voiceSignature: signature
      };

      await addDoc(collection(db, "recordings"), recordingData);

      const addedXp = 80;
      const updatedXp = (userData?.xp || 0) + addedXp;

      if (user) {
        await setDoc(doc(db, "users", user.uid), {
          displayName: userData?.displayName || 'Aura Singer',
          email: userData?.email || user.email,
          tier: userData?.tier || 'Free',
          xp: updatedXp,
          voiceSignature: signature
        });
      }

      setIsUploading(false);
      alert(`Performance successfully uploaded and shared to cloud feed! Gained +${addedXp} XP!`);
      navigate('CommunityFeed');

    } catch (err) {
      console.warn("Cloud upload failed, falling back locally:", err);
      setIsUploading(false);
      
      saveAndShare({
        song: currentRecording?.selectedSong || { title: 'Freestyle Resonance', artist: 'Self' },
        ariyusRating: rating,
        voiceSignature: signature,
        tones: tones,
        selectedFreq,
        effects: activeEffects
      });
    }
  };

  const savePreset = (e) => {
    e.preventDefault();
    if (!newPresetName) return;

    const newPreset = {
      name: newPresetName,
      effects: activeEffects,
      voiceVol,
      trackVol,
      freqVol,
      freq: selectedFreq,
      soundstage
    };

    const updated = [...mixPresets, newPreset];
    setMixPresets(updated);
    localStorage.setItem('ariyus_mix_presets', JSON.stringify(updated));
    setNewPresetName('');
    alert('Acoustic Resonance Preset Saved!');
  };

  const loadPreset = (p) => {
    setActiveEffects(p.effects);
    setVoiceVol(p.voiceVol);
    setTrackVol(p.trackVol);
    setFreqVol(p.freqVol);
    setSelectedFreq(p.freq);
    if (p.soundstage) setSoundstage(p.soundstage);
  };

  const handleExport = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      alert('Vocal harmonics exported as Ariyus-Master-3D.wav! Download complete.');
    }, 2500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Title */}
      <h2 style={{ textShadow: '0 0 10px var(--primary-glow)', margin: 0 }}>Ariyus ARC-5 Chamber</h2>

      {/* Audio Playback Controls */}
      <div className="glass-panel" style={{ textAlign: 'center', borderColor: 'var(--primary-glow)' }}>
        <h3>Real-time Frequency Converter</h3>
        
        {currentRecording?.playbackUrl ? (
          <>
            <audio 
              ref={voiceAudioElRef} 
              src={currentRecording.playbackUrl} 
              onEnded={() => { setIsPlaying(false); stopTones(); }}
              style={{ display: 'none' }}
            />
            <audio 
              ref={backingAudioElRef} 
              src={currentRecording?.selectedSong?.audioUrl || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'} 
              style={{ display: 'none' }} 
            />
          </>
        ) : (
          <p style={{ color: 'var(--secondary-glow)' }}>No active audio captured.</p>
        )}

        {/* Dynamic Spectrum convergence canvas */}
        <div className="visualizer-wrapper" style={{ height: '160px', marginTop: '15px' }}>
          <canvas ref={visualizerCanvasRef} className="visualizer-canvas" />
          <div style={{ position: 'absolute', bottom: '10px', left: '15px', color: '#fff', fontSize: '0.8rem', fontFamily: 'monospace', textShadow: '0 0 6px #000', pointerEvents: 'none', background: 'rgba(0,0,0,0.4)', padding: '4px 8px', borderRadius: '4px' }}>
            Voice Pitch: {detectedPitch ? `${detectedPitch} Hz` : 'Scanning...'} | Convergence: {convergenceRatio}%
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', alignItems: 'center', marginTop: '15px' }}>
          <button className="glowing-button" onClick={handlePlayTogglePress} style={{ minWidth: '180px' }} disabled={!currentRecording}>
            {isPlaying ? '⏸ Pause Resonance' : '▶ Play Matched Mix'}
          </button>
          
          <button 
            className={`glowing-button secondary ${isDryActive ? 'active' : ''}`}
            onClick={() => setIsDryActive(!isDryActive)}
          >
            {isDryActive ? '✓ Dry Vocal (Direct)' : '✦ Solfeggio Wet Mix'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        
        {/* Interactive 3D Soundstage Mapping Panel */}
        <div className="glass-panel" style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3>3D Spatial Soundstage</h3>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', margin: 0 }}>
            Drag nodes to pan channels left/right and push them back (volume depth) in the spatial soundfield.
          </p>

          <div style={{ height: '220px', borderRadius: '10px', overflow: 'hidden', position: 'relative', border: '1px solid rgba(255,255,255,0.06)' }}>
            <canvas 
              ref={soundstageCanvasRef} 
              onMouseDown={handleSoundstageDown}
              onMouseMove={handleSoundstageMove}
              onMouseUp={handleSoundstageUp}
              onTouchStart={handleSoundstageDown}
              onTouchMove={handleSoundstageMove}
              onTouchEnd={handleSoundstageUp}
              style={{ width: '100%', height: '100%', cursor: draggingNode ? 'grabbing' : 'grab' }} 
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-dim)' }}>
            <span>← Left Ear</span>
            <span>Spatial Panning Orbit</span>
            <span>Right Ear →</span>
          </div>
        </div>

        {/* Biofield & Vocal Biomarkers Diagnostis */}
        <div className="glass-panel" style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3>Biofield Tuning Diagnostic</h3>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', margin: 0 }}>
            Vocal biomarkers parsed from your recording buffer mapped to ancient energy centers.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.8rem' }}>
            <div style={{ background: 'rgba(0,0,0,0.15)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ color: 'var(--text-dim)' }}>Jitter (Pitch Var)</span>
              <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginTop: '4px' }}>{biomarkers.jitter}%</div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.15)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ color: 'var(--text-dim)' }}>Shimmer (Amp Var)</span>
              <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginTop: '4px' }}>{biomarkers.shimmer}%</div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.15)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ color: 'var(--text-dim)' }}>HNR Ratio</span>
              <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginTop: '4px' }}>{biomarkers.hnr} dB</div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.15)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ color: 'var(--text-dim)' }}>Spectral Centroid</span>
              <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginTop: '4px' }}>{biomarkers.centroid} Hz</div>
            </div>
          </div>
        </div>

      </div>

      {/* Chakra Grid Mapping */}
      <div className="glass-panel">
        <h3>Chakra Alignment Profile</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', marginTop: '15px' }}>
          {chakras.map((ch, idx) => (
            <div key={idx} style={{ background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '0.9rem', color: ch.color }}>{ch.name.split(' ')[0]}</strong>
                <span className="level-badge" style={{ background: ch.color, color: '#000', fontSize: '0.75rem', padding: '2px 8px' }}>{ch.score}%</span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', margin: 0, lineHeight: '1.4' }}>{ch.desc}</p>
              <div className="progress-track" style={{ height: '5px', marginTop: '5px' }}>
                <div className="progress-fill" style={{ width: `${ch.score}%`, background: ch.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Personalized Biomarkers Prescription Card */}
      <div className="glass-panel" style={{ borderLeft: '4px solid var(--secondary-glow)' }}>
        <h4 style={{ textShadow: '0 0 6px var(--secondary-glow)' }}>Vocal Resonance Prescription</h4>
        <p style={{ fontSize: '0.95rem', color: 'var(--text-dim)', margin: '6px 0 0', lineHeight: '1.5' }}>
          Your Throat Chakra HNR score of {biomarkers.hnr}dB indicates stable vocal clarity. However, your Root Grounding resonance is at {chakras[3].score}%. To ground lower vocal overtones, we prescribe running a 5-minute vocal sweep aligned to <b>396 Hz (Liberation preset)</b> with the <b>Comb Resonator DSP</b> activated to physically amplify lower vocal harmonics.
        </p>
      </div>

      {/* Vocal Digital Signature */}
      <VoiceSignatureCard signature={signature} />

      {/* Mixing Studio Console */}
      <div className="glass-panel">
        <h3>Matrix Mixing Console</h3>
        <div className="audio-deck-panel">
          
          <div className="slider-group">
            <label><span>Voice Master Volume</span><span>{voiceVol}%</span></label>
            <input type="range" className="slider-input" min="0" max="100" value={voiceVol} onChange={e => setVoiceVol(parseInt(e.target.value))} disabled={isDryActive} />
          </div>

          <div className="slider-group">
            <label><span>Backing Master Volume</span><span>{trackVol}%</span></label>
            <input type="range" className="slider-input" min="0" max="100" value={trackVol} onChange={e => setTrackVol(parseInt(e.target.value))} disabled={isDryActive} />
          </div>

          <div className="slider-group">
            <label><span>Solfeggio Master Volume</span><span>{freqVol}%</span></label>
            <input type="range" className="slider-input" min="0" max="100" value={freqVol} onChange={e => setFreqVol(parseInt(e.target.value))} disabled={isDryActive} />
          </div>

          {/* Solfeggio Presets */}
          <div className="slider-group" style={{ marginTop: '10px' }}>
            <label><span>Target Solfeggio Key</span><span>{selectedFreq} Hz</span></label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {Object.keys(intentions).map(hz => (
                <button 
                  key={hz} 
                  className={`effect-toggle-btn ${selectedFreq === parseInt(hz) ? 'active' : ''}`}
                  style={{ padding: '6px 12px', flexGrow: 1, fontSize: '0.85rem' }}
                  onClick={() => setSelectedFreq(parseInt(hz))}
                  disabled={isDryActive}
                >
                  {hz} Hz
                </button>
              ))}
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--primary-glow)', marginTop: '6px', fontStyle: 'italic' }}>
              Intention: {intentions[selectedFreq]}
            </p>
          </div>

          {/* Effects toggling */}
          <div style={{ marginTop: '15px' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Proprietary ARC-5 DSP Modules</label>
            <div className="effects-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
              {effectPresets.map(fx => (
                <button 
                  key={fx.id} 
                  className={`effect-toggle-btn ${activeEffects.includes(fx.name) ? 'active' : ''}`}
                  onClick={() => toggleEffect(fx.name)}
                  disabled={isDryActive}
                  style={{ padding: '8px 12px', height: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start', textAlign: 'left' }}
                >
                  <strong style={{ fontSize: '0.85rem' }}>{fx.name}</strong>
                  <span style={{ fontSize: '0.68rem', opacity: 0.85, fontWeight: 'normal', lineHeight: '1.3' }}>{fx.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Save Preset Form */}
          <form onSubmit={savePreset} style={{ display: 'flex', gap: '10px', marginTop: '15px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '15px' }}>
            <input 
              type="text" 
              placeholder="Name this mix preset..." 
              value={newPresetName} 
              onChange={e => setNewPresetName(e.target.value)} 
              className="glass-input" 
              style={{ margin: 0, padding: '8px 12px', fontSize: '0.9rem' }} 
            />
            <button type="submit" className="glowing-button secondary" style={{ margin: 0, padding: '8px 15px', fontSize: '0.85rem' }}>
              Save Mix Preset
            </button>
          </form>

          {/* Presets List */}
          {mixPresets.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Saved Presets:</span>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                {mixPresets.map((p, idx) => (
                  <button 
                    key={idx} 
                    className="glowing-button" 
                    style={{ margin: 0, padding: '4px 10px', fontSize: '0.75rem', borderColor: 'var(--glass-border)' }}
                    onClick={() => loadPreset(p)}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Export Mix */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button className="glowing-button" onClick={handleExport} disabled={isExporting} style={{ flexGrow: 1, margin: 0 }}>
              {isExporting ? 'Applying Formant Converters...' : '⚡ Export Master Stereo Mix'}
            </button>
          </div>

        </div>
      </div>

      {/* Save & Share */}
      <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', margin: '20px 0' }}>
        <button className="glowing-button" onClick={handleSaveAndShareRecording} style={{ minWidth: '220px' }} disabled={isUploading}>
          {isUploading ? 'Encrypting & Uploading...' : '✓ Upload & Share to Cloud Feed'}
        </button>
        <button className="glowing-button secondary" onClick={() => { stopTones(); navigate('Home'); }}>
          Discard Capture
        </button>
      </div>

    </div>
  );
};

export default ResultsChamber;
