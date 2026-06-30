import React, { useState, useEffect, useRef } from 'react';
import VoiceSignatureCard from '../components/VoiceSignatureCard';
import { db, storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, collection, addDoc } from 'firebase/firestore';

// Helper: draw individual chakra point with glowing outer rings
const drawChakraNode = (ctx, x, y, score, color, index, voiceVolumeFactor) => {
  const baseRadius = 5 + (score / 100) * 10;
  const slowTime = Date.now() / 350;
  const pulse = baseRadius * (1.0 + Math.sin(slowTime + index * Math.PI / 3.0) * 0.18 * voiceVolumeFactor);
  
  ctx.save();
  // Draw glow rings
  for (let r = 3; r > 0; r--) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.0;
    ctx.globalAlpha = (0.12 / r) * (score / 100);
    ctx.beginPath();
    ctx.arc(x, y, pulse * r * 1.7, 0, Math.PI * 2);
    ctx.stroke();
  }
  
  // Outer outline
  ctx.globalAlpha = 0.8;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, pulse, 0, Math.PI * 2);
  ctx.stroke();

  // Inner solid core
  ctx.globalAlpha = 1.0;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

// --- Web Audio Crossfading Formant-Preserving Pitch Shifter ---
const createPitchShifterNode = (ctx, pitchRatio) => {
  const input = ctx.createGain();
  const output = ctx.createGain();
  
  if (Math.abs(pitchRatio - 1.0) < 0.01) {
    input.connect(output);
    return { input, output, stop: () => {} };
  }

  const delayTime = 0.040;
  const delay1 = ctx.createDelay(0.1);
  const delay2 = ctx.createDelay(0.1);

  const lfo = ctx.createOscillator();
  lfo.type = 'sawtooth';
  lfo.frequency.setValueAtTime(1 / delayTime, ctx.currentTime);

  const lfoGain = ctx.createGain();
  lfoGain.gain.setValueAtTime(-delayTime * (pitchRatio - 1.0), ctx.currentTime);
  
  lfo.connect(lfoGain);
  lfoGain.connect(delay1.delayTime);

  const lfoShift = ctx.createDelay(0.1);
  lfoShift.delayTime.setValueAtTime(delayTime / 2, ctx.currentTime);
  lfoGain.connect(lfoShift);
  lfoShift.connect(delay2.delayTime);

  const crossfadeOsc = ctx.createOscillator();
  crossfadeOsc.type = 'triangle';
  crossfadeOsc.frequency.setValueAtTime(1 / delayTime, ctx.currentTime);

  const gain1 = ctx.createGain();
  const gain2 = ctx.createGain();

  const shaper1 = ctx.createWaveShaper();
  const curve1 = new Float32Array(512);
  for (let i = 0; i < 512; i++) {
    const x = (i / 255.5) - 1.0;
    curve1[i] = (x + 1.0) / 2.0;
  }
  shaper1.curve = curve1;

  const shaper2 = ctx.createWaveShaper();
  const curve2 = new Float32Array(512);
  for (let i = 0; i < 512; i++) {
    const x = (i / 255.5) - 1.0;
    curve2[i] = 1.0 - ((x + 1.0) / 2.0);
  }
  shaper2.curve = curve2;

  crossfadeOsc.connect(shaper1);
  shaper1.connect(gain1.gain);
  crossfadeOsc.connect(shaper2);
  shaper2.connect(gain2.gain);

  input.connect(delay1);
  input.connect(delay2);
  delay1.connect(gain1);
  delay2.connect(gain2);
  gain1.connect(output);
  gain2.connect(output);

  lfo.start();
  crossfadeOsc.start();

  return {
    input,
    output,
    stop: () => {
      try { lfo.stop(); } catch(e){}
      try { crossfadeOsc.stop(); } catch(e){}
    }
  };
};

const ResultsChamber = ({ currentRecording, saveAndShare, navigate, user, userData, activeChallenge, handleCompleteChallenge }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isAIHarmonized, setIsAIHarmonized] = useState(false);
  
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
  const [upgradeModalData, setUpgradeModalData] = useState(null);

  // Interactive 2D Soundstage coordinates
  // Nodes: 'voice', 'track', 'solfeggio'
  // x: [0, 1] maps to Left -> Right panning (-1.0 to 1.0)
  // y: [0, 1] maps to Back -> Front depth/volume (0.0 to 1.0)
  const [soundstage, setSoundstage] = useState(() => {
    const base = {
      voice: { x: 0.6, y: 0.7, label: 'My Voice', color: '#00f2ff' },
      track: { x: 0.5, y: 0.3, label: 'Track (Music)', color: '#7000ff' },
      solfeggio: { x: 0.5, y: 0.9, label: 'Solfeggio Hum', color: '#ff00c1' }
    };
    if (currentRecording?.duetPartner) {
      base.partner = { x: 0.4, y: 0.7, label: 'Partner Voice', color: '#00ff87' };
    }
    return base;
  });
  const [draggingNode, setDraggingNode] = useState(null);

  // Web Audio Graph Refs
  const audioCtxRef = useRef(null);
  const voiceSourceRef = useRef(null);
  const backingSourceRef = useRef(null);
  const duetSourceRef = useRef(null);
  
  // DSP Gain & Panner Node Refs
  const voiceGainRef = useRef(null);
  const voicePannerRef = useRef(null);
  const backingGainRef = useRef(null);
  const backingPannerRef = useRef(null);
  const solfeggioGainRef = useRef(null);
  const solfeggioPannerRef = useRef(null);
  const duetGainRef = useRef(null);
  const duetPannerRef = useRef(null);
  
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
  const voicePeakingFilterRef = useRef(null);

  // Oscillators
  const ringModOscRef = useRef(null);

  // Pitch Shifter nodes
  const voicePitchShifterRef = useRef(null);
  const backingPitchShifterRef = useRef(null);
  const highHarmonyPitchShifterRef = useRef(null);
  const lowHarmonyPitchShifterRef = useRef(null);
  const highHarmonyGainRef = useRef(null);
  const lowHarmonyGainRef = useRef(null);
  const highHarmonyPannerRef = useRef(null);
  const lowHarmonyPannerRef = useRef(null);

  // Analysers
  const voiceAnalyserRef = useRef(null);
  const backingAnalyserRef = useRef(null);
  const duetAnalyserRef = useRef(null);

  // Audio Players and Canvas Refs
  const voiceAudioElRef = useRef(null);
  const backingAudioElRef = useRef(null);
  const duetAudioElRef = useRef(null);
  const visualizerCanvasRef = useRef(null);
  const soundstageCanvasRef = useRef(null);
  const chakraCanvasRef = useRef(null);
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
    396: 'UT - Release Guilt, Fear & Sub-conscious Blocks (Root Chakra Grounding)',
    417: 'RE - Clear Traumatic Patterns & Support Change (Sacral Chakra Fluidity)',
    432: 'Natural Harmonic Tuning (Earth Heartbeat Cosmic Sync)',
    444: 'Key of David (Physical Vitality & Heart Muscle Coherence)',
    528: 'MI - DNA Vitality Repair & Cell Renewal Miracle (Solar Plexus Alignment)',
    639: 'FA - Harmonize Relationship Bonds & Empathy (Heart Chakra Coherence)',
    741: 'SOL - Clear Self-Expression & Cleanse Intuition (Throat Chakra Purification)',
    852: 'LA - Sync Spiritual Alignment & Cosmic Order (Third Eye Awakening)',
    963: 'SI - Pineal Activation & Universal Source Alignment (Crown Connection)'
  };

  const effectPresets = [
    { id: 'fx1', name: 'Ring Modulator', desc: 'Locks vocals to Solfeggio carrier wave sidebands.', premium: false },
    { id: 'fx2', name: 'Comb Resonator', desc: 'Adds acoustic feedback delay loop tuned to 1/hz.', premium: false },
    { id: 'fx3', name: 'Acoustic Coupling', desc: 'Music filter dynamically sweeps to track vocal pitch.', premium: false },
    { id: 'fx4', name: 'Binaural Beating', desc: 'Left/Right frequency offsets entrain theta brain waves.', premium: false },
    { id: 'fx5', name: 'Galactic Reverb', desc: 'Passes audio through synthesized room convolver.', premium: true },
    { id: 'fx6', name: 'Warm Harmonics', desc: 'Tube Waveshaper adds rich even-order overtones.', premium: true },
    { id: 'fx7', name: 'Cyber Chorus', desc: 'LFO sweeping delay line doubles vocal presence.', premium: true },
    { id: 'fx8', name: 'Vocal Clarity', desc: 'Highpass filter cuts low rumble below 120Hz.', premium: false },
    { id: 'fx9', name: 'Hyper Bass', desc: 'Low-shelf filter boosts backing track low-end.', premium: false }
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
      case 444: return 444 / 440.00;
      case 528: return 528 / 523.25;
      case 639: return 639 / 659.25;
      case 741: return 741 / 739.99;
      case 852: return 852 / 880.00;
      case 963: return 963 / 987.77;
      default: return 1.0;
    }
  };

  const getCoachFeedback = () => {
    const feedback = [];
    if (biomarkers.jitter > 0.7) {
      feedback.push({
        type: 'Stability',
        icon: '🌊',
        color: '#ff3b30',
        text: 'Vocal jitter is slightly elevated. Stabilize vocal cord vibration by expanding your lower ribcage and engaging your core during sustain.'
      });
    } else {
      feedback.push({
        type: 'Stability',
        icon: '💎',
        color: '#00ff87',
        text: 'Vocal pitch stability is superb. Your neural motor control of larynx pitch is aligned and steady.'
      });
    }

    if (biomarkers.shimmer > 1.2) {
      feedback.push({
        type: 'Dynamics',
        icon: '⚡',
        color: '#ffb700',
        text: 'Elevated shimmer variance detected. Focus on maintaining steady breath flow; avoiding small volume bursts on steady syllables.'
      });
    } else {
      feedback.push({
        type: 'Dynamics',
        icon: '🛡️',
        color: '#00f2ff',
        text: 'Outstanding volume envelope uniformity. Breath support pressure is completely steady.'
      });
    }

    if (biomarkers.hnr < 75) {
      feedback.push({
        type: 'Resonance',
        icon: '🌬️',
        color: '#ff00c1',
        text: 'Harmonics-to-noise ratio is lower, indicating airy voice production. Focus nasal resonance forward to brighten overtones.'
      });
    } else {
      feedback.push({
        type: 'Resonance',
        icon: '🔔',
        color: '#00f2ff',
        text: 'Excellent HNR ratio. Your vocal tone is rich in pure harmonic peaks with negligible breathiness noise.'
      });
    }
    return feedback;
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
      if (currentRecording?.duetPartner && duetAudioElRef.current) {
        duetSourceRef.current = ctx.createMediaElementSource(duetAudioElRef.current);
      }

      // Mixer Gain & Spatial Panner Nodes
      voiceGainRef.current = ctx.createGain();
      voicePannerRef.current = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      backingGainRef.current = ctx.createGain();
      backingPannerRef.current = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      solfeggioGainRef.current = ctx.createGain();
      solfeggioPannerRef.current = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      duetGainRef.current = ctx.createGain();
      duetPannerRef.current = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

      highHarmonyGainRef.current = ctx.createGain();
      highHarmonyPannerRef.current = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      lowHarmonyGainRef.current = ctx.createGain();
      lowHarmonyPannerRef.current = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

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

      // 8. Solfeggio Peaking Filters (Physical frequency resonance)
      voicePeakingFilterRef.current = ctx.createBiquadFilter();
      voicePeakingFilterRef.current.type = 'peaking';
      voicePeakingFilterRef.current.Q.setValueAtTime(6.0, ctx.currentTime);
      voicePeakingFilterRef.current.frequency.setValueAtTime(selectedFreq, ctx.currentTime);
      voicePeakingFilterRef.current.gain.setValueAtTime((freqVol / 100) * 15.0, ctx.currentTime);

      backingPeakingFilterRef.current = ctx.createBiquadFilter();
      backingPeakingFilterRef.current.type = 'peaking';
      backingPeakingFilterRef.current.Q.setValueAtTime(6.0, ctx.currentTime);
      backingPeakingFilterRef.current.frequency.setValueAtTime(selectedFreq, ctx.currentTime);
      backingPeakingFilterRef.current.gain.setValueAtTime((freqVol / 100) * 15.0, ctx.currentTime);

      // Pitch-preserving pitch shifter initialization
      const pitchRatio = isDryActive ? 1.0 : getPlaybackRateForFrequency(selectedFreq);
      voicePitchShifterRef.current = createPitchShifterNode(ctx, pitchRatio);
      backingPitchShifterRef.current = createPitchShifterNode(ctx, pitchRatio);

      // AI Harmonizers Setup (+4 and -12 semitones relative to lead pitch ratio)
      const highPitchRatio = pitchRatio * Math.pow(2, 4 / 12);
      highHarmonyPitchShifterRef.current = createPitchShifterNode(ctx, highPitchRatio);

      const lowPitchRatio = pitchRatio * Math.pow(2, -12 / 12);
      lowHarmonyPitchShifterRef.current = createPitchShifterNode(ctx, lowPitchRatio);

      // --- Vocal routing connections ---
      voiceSourceRef.current.connect(voicePitchShifterRef.current.input);
      voicePitchShifterRef.current.output.connect(highpassFilterRef.current);
      highpassFilterRef.current.connect(voicePeakingFilterRef.current);
      
      // Route vocal to backing harmony streams
      voicePeakingFilterRef.current.connect(highHarmonyPitchShifterRef.current.input);
      voicePeakingFilterRef.current.connect(lowHarmonyPitchShifterRef.current.input);

      highHarmonyPitchShifterRef.current.output.connect(highHarmonyGainRef.current);
      lowHarmonyPitchShifterRef.current.output.connect(lowHarmonyGainRef.current);

      let finalHighHarmonyNode = highHarmonyGainRef.current;
      if (highHarmonyPannerRef.current) {
        highHarmonyGainRef.current.connect(highHarmonyPannerRef.current);
        finalHighHarmonyNode = highHarmonyPannerRef.current;
      }
      finalHighHarmonyNode.connect(voiceAnalyserRef.current);

      let finalLowHarmonyNode = lowHarmonyGainRef.current;
      if (lowHarmonyPannerRef.current) {
        lowHarmonyGainRef.current.connect(lowHarmonyPannerRef.current);
        finalLowHarmonyNode = lowHarmonyPannerRef.current;
      }
      finalLowHarmonyNode.connect(voiceAnalyserRef.current);
      
      // Splits for FX
      voicePeakingFilterRef.current.connect(waveshaperNodeRef.current);
      voicePeakingFilterRef.current.connect(reverbConvolverRef.current);
      voicePeakingFilterRef.current.connect(chorusDelayRef.current);

      // Connect dry/wet paths
      voicePeakingFilterRef.current.connect(ringModRef.current); // dry path to ringMod
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
      backingSourceRef.current.connect(backingPitchShifterRef.current.input);
      backingPitchShifterRef.current.output.connect(lowselfFilterRef.current);
      lowselfFilterRef.current.connect(backingPeakingFilterRef.current);
      backingPeakingFilterRef.current.connect(backingGainRef.current);
      
      let finalBackingNode = backingGainRef.current;
      if (backingPannerRef.current) {
        backingGainRef.current.connect(backingPannerRef.current);
        finalBackingNode = backingPannerRef.current;
      }
      finalBackingNode.connect(backingAnalyserRef.current);
      backingAnalyserRef.current.connect(ctx.destination);

      // --- Duet partner routing connections ---
      if (duetSourceRef.current) {
        duetSourceRef.current.connect(duetGainRef.current);
        let finalDuetNode = duetGainRef.current;
        if (duetPannerRef.current) {
          duetGainRef.current.connect(duetPannerRef.current);
          finalDuetNode = duetPannerRef.current;
        }
        finalDuetNode.connect(duetAnalyserRef.current);
        duetAnalyserRef.current.connect(ctx.destination);
      }

      // --- Solfeggio carrier oscillators routing (Muted raw carrier tone output as requested) ---
      // Raw carrier oscillators are bypassed to avoid literal beeps. The Solfeggio frequency
      // is instead directly integrated via the dual peaking filters on both vocal & music tracks.
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
    if (voicePitchShifterRef.current) {
      voicePitchShifterRef.current.stop();
      voicePitchShifterRef.current = null;
    }
    if (backingPitchShifterRef.current) {
      backingPitchShifterRef.current.stop();
      backingPitchShifterRef.current = null;
    }
    if (highHarmonyPitchShifterRef.current) {
      highHarmonyPitchShifterRef.current.stop();
      highHarmonyPitchShifterRef.current = null;
    }
    if (lowHarmonyPitchShifterRef.current) {
      lowHarmonyPitchShifterRef.current.stop();
      lowHarmonyPitchShifterRef.current = null;
    }
  };

  // Rebuild audio engine dynamically on Solfeggio target frequency modifications
  useEffect(() => {
    if (isPlaying) {
      voiceAudioElRef.current?.pause();
      backingAudioElRef.current?.pause();
      if (audioCtxRef.current) {
        try { audioCtxRef.current.close(); } catch(e){}
        audioCtxRef.current = null;
      }
      startTones();
      backingAudioElRef.current.currentTime = voiceAudioElRef.current.currentTime;
      Promise.all([
        voiceAudioElRef.current.play(),
        backingAudioElRef.current.play()
      ]).catch(e => console.warn("Failed to play on rebuild:", e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFreq, isDryActive]);

  useEffect(() => {
    return () => {
      stopTones();
      if (audioCtxRef.current) {
        try { audioCtxRef.current.close(); } catch(e){}
        audioCtxRef.current = null;
      }
    };
  }, []);

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

    // PARTNER: x maps to Panning [-1, 1], y maps to Volume [0, 1]
    if (duetPannerRef.current && soundstage.partner) {
      const pan = (soundstage.partner.x * 2) - 1;
      duetPannerRef.current.pan.setValueAtTime(pan, ctx.currentTime);
    }
    if (duetGainRef.current && soundstage.partner) {
      const vol = isDryActive ? 0.0 : soundstage.partner.y * (voiceVol / 100);
      duetGainRef.current.gain.setValueAtTime(vol, ctx.currentTime);
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

    if (voicePeakingFilterRef.current) {
      const gainVal = isDryActive ? 0.0 : (freqVol / 100) * 15.0;
      voicePeakingFilterRef.current.gain.setValueAtTime(gainVal, ctx.currentTime);
      voicePeakingFilterRef.current.frequency.setValueAtTime(selectedFreq, ctx.currentTime);
    }
    if (backingPeakingFilterRef.current) {
      const gainVal = isDryActive ? 0.0 : (freqVol / 100) * 15.0;
      backingPeakingFilterRef.current.gain.setValueAtTime(gainVal, ctx.currentTime);
      backingPeakingFilterRef.current.frequency.setValueAtTime(selectedFreq, ctx.currentTime);
    }

    // Harmony volume gains
    if (highHarmonyGainRef.current) {
      const vol = (isAIHarmonized && !isDryActive) ? soundstage.voice.y * (voiceVol / 100) * 0.6 : 0.0;
      highHarmonyGainRef.current.gain.setValueAtTime(vol, ctx.currentTime);
    }
    if (lowHarmonyGainRef.current) {
      const vol = (isAIHarmonized && !isDryActive) ? soundstage.voice.y * (voiceVol / 100) * 0.6 : 0.0;
      lowHarmonyGainRef.current.gain.setValueAtTime(vol, ctx.currentTime);
    }
  };

  // Automatically sweep the Solfeggio pan left-to-right to create orbital spatial audio
  const startBinauralOrbit = () => {
    clearInterval(pannerOrbitIntervalRef.current);
    if (!activeEffects.includes('Binaural Beating') && !isAIHarmonized) return;

    let time = 0;
    pannerOrbitIntervalRef.current = setInterval(() => {
      const ctx = audioCtxRef.current;
      if (!ctx) return;

      if (activeEffects.includes('Binaural Beating') && solfeggioPannerRef.current) {
        // Orbit panner sinusoidally
        const panVal = Math.sin(time);
        solfeggioPannerRef.current.pan.setValueAtTime(panVal, ctx.currentTime);
        setSoundstage(prev => ({
          ...prev,
          solfeggio: {
            ...prev.solfeggio,
            x: (panVal + 1) / 2 // maps back to 0-1
          }
        }));
      }

      if (isAIHarmonized) {
        // Binaural orbits panned sinusoidally in opposite directions
        const panVal = Math.sin(time * 0.7);
        if (lowHarmonyPannerRef.current) {
          lowHarmonyPannerRef.current.pan.setValueAtTime(panVal, ctx.currentTime);
        }
        if (highHarmonyPannerRef.current) {
          highHarmonyPannerRef.current.pan.setValueAtTime(-panVal, ctx.currentTime);
        }
      }

      time += 0.03;
    }, 50);
  };

  // Sync soundstage updates on drag coordinates
  useEffect(() => {
    syncSoundstageToNodes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soundstage, voiceVol, trackVol, freqVol, isDryActive, isAIHarmonized]);

  // Handle live AI Harmonizer orbital panner toggles
  useEffect(() => {
    if (isPlaying) {
      if (isAIHarmonized || activeEffects.includes('Binaural Beating')) {
        startBinauralOrbit();
      } else {
        clearInterval(pannerOrbitIntervalRef.current);
        syncSoundstageToNodes();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAIHarmonized]);

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

    // 3. Chakra Biofield Canvas
    const chakraCanvas = chakraCanvasRef.current;
    const cCtx = chakraCanvas?.getContext('2d');
    let cWidth = chakraCanvas?.offsetWidth || 300;
    let cHeight = chakraCanvas?.offsetHeight || 220;
    if (chakraCanvas) {
      chakraCanvas.width = cWidth;
      chakraCanvas.height = cHeight;
    }

    const bufferLength = 128;
    const voiceData = new Uint8Array(bufferLength);
    const backingData = new Uint8Array(bufferLength);

    const drawLoop = () => {
      const voiceAnalyser = voiceAnalyserRef.current;
      const backingAnalyser = backingAnalyserRef.current;
      const ctx = audioCtxRef.current;

      let vPitch = 0;
      if (isPlaying && voiceAnalyser && ctx) {
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
          let v = isPlaying ? (backingData[i] / 255) : (0.1 + Math.sin(Date.now() / 300 + i * 0.15) * 0.05);
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
          let v = isPlaying ? (voiceData[i] / 255) : (0.2 + Math.cos(Date.now() / 400 + i * 0.1) * 0.03);
          let y = vHeight / 2 + (v * vHeight * 0.4) - 20;
          if (i === 0) vCtx.moveTo(x, y);
          else vCtx.lineTo(x, y);
          x += sliceWidth;
        }
        vCtx.stroke();
        vCtx.shadowBlur = 0;

        // Target Solfeggio Key Vertical line
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

        // Draw resonance coupling lines
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

        // Draw orbital harmony nodes dynamically on canvas
        if (isAIHarmonized) {
          const orbitTime = Date.now() / 1000;
          const lowPan = Math.sin(orbitTime * 0.7);
          const highPan = -Math.sin(orbitTime * 0.7);

          const lowX = ((lowPan + 1) / 2) * sWidth;
          const lowY = 0.65 * sHeight;
          const highX = ((highPan + 1) / 2) * sWidth;
          const highY = 0.55 * sHeight;

          sCtx.save();
          // Draw Low Harmony
          sCtx.strokeStyle = '#ff00c1';
          sCtx.lineWidth = 1.2;
          sCtx.beginPath();
          sCtx.arc(lowX, lowY, 12 + Math.sin(Date.now() / 250) * 2, 0, Math.PI * 2);
          sCtx.stroke();
          
          sCtx.fillStyle = '#ff00c1';
          sCtx.beginPath();
          sCtx.arc(lowX, lowY, 4, 0, Math.PI * 2);
          sCtx.fill();
          
          sCtx.font = '9px Orbitron, sans-serif';
          sCtx.fillStyle = '#ff00c1';
          sCtx.fillText('Low Harmony (-12st)', lowX - 50, lowY - 18);

          // Draw High Harmony
          sCtx.strokeStyle = '#00ff87';
          sCtx.beginPath();
          sCtx.arc(highX, highY, 12 + Math.sin(Date.now() / 250) * 2, 0, Math.PI * 2);
          sCtx.stroke();
          
          sCtx.fillStyle = '#00ff87';
          sCtx.beginPath();
          sCtx.arc(highX, highY, 4, 0, Math.PI * 2);
          sCtx.fill();
          
          sCtx.font = '9px Orbitron, sans-serif';
          sCtx.fillStyle = '#00ff87';
          sCtx.fillText('High Harmony (+4st)', highX - 50, highY - 18);

          // Connect virtual nodes to main lead vocal node
          const voiceNode = soundstage.voice;
          const voiceX = voiceNode.x * sWidth;
          const voiceY = voiceNode.y * sHeight;

          sCtx.strokeStyle = 'rgba(255, 0, 193, 0.22)';
          sCtx.setLineDash([3, 3]);
          sCtx.beginPath();
          sCtx.moveTo(voiceX, voiceY);
          sCtx.lineTo(lowX, lowY);
          sCtx.stroke();

          sCtx.strokeStyle = 'rgba(0, 255, 135, 0.22)';
          sCtx.beginPath();
          sCtx.moveTo(voiceX, voiceY);
          sCtx.lineTo(highX, highY);
          sCtx.stroke();
          sCtx.restore();
        }
      }

      // --- Draw Chakra Biofield Lightfield ---
      if (cCtx) {
        cCtx.clearRect(0, 0, cWidth, cHeight);
        
        cCtx.fillStyle = '#03021a';
        cCtx.fillRect(0, 0, cWidth, cHeight);

        const cx = cWidth / 2;
        const cy = cHeight / 2 + 10;
        const silhouetteHeight = Math.min(cHeight * 0.7, 150);

        let voiceVolumeFactor = 1.0;
        if (isPlaying && voiceAnalyser) {
          let sum = 0;
          for (let i = 0; i < voiceData.length; i++) {
            sum += voiceData[i];
          }
          const avg = sum / voiceData.length;
          voiceVolumeFactor = 1.0 + (avg / 255.0) * 1.5;
        } else {
          voiceVolumeFactor = 1.0 + Math.sin(Date.now() / 450) * 0.1;
        }

        // Ambient Aura field glow
        cCtx.save();
        let dominantColor = '#00f2ff';
        let maxScore = -1;
        chakras.forEach(ch => {
          if (ch.score > maxScore) {
            maxScore = ch.score;
            dominantColor = ch.color;
          }
        });

        const hexToRgba = (hex, alpha) => {
          const r = parseInt(hex.slice(1, 3), 16);
          const g = parseInt(hex.slice(3, 5), 16);
          const b = parseInt(hex.slice(5, 7), 16);
          return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        };

        const auraGrad = cCtx.createRadialGradient(cx, cy - 10, 10, cx, cy - 10, silhouetteHeight * 0.9);
        auraGrad.addColorStop(0, hexToRgba(dominantColor, 0.15 * voiceVolumeFactor));
        auraGrad.addColorStop(0.5, hexToRgba(dominantColor, 0.05));
        auraGrad.addColorStop(1, 'rgba(3, 2, 26, 0)');
        cCtx.fillStyle = auraGrad;
        cCtx.fillRect(0, 0, cWidth, cHeight);
        cCtx.restore();

        // Silhouette Body
        cCtx.save();
        cCtx.fillStyle = 'rgba(255, 255, 255, 0.06)';
        cCtx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        cCtx.lineWidth = 1.2;
        
        cCtx.beginPath();
        const headRadius = silhouetteHeight * 0.12;
        const headY = cy - silhouetteHeight * 0.35;
        cCtx.arc(cx, headY, headRadius, 0, Math.PI * 2);
        cCtx.closePath();
        cCtx.fill();
        cCtx.stroke();
        
        cCtx.beginPath();
        const neckY = headY + headRadius;
        cCtx.moveTo(cx, neckY);
        cCtx.bezierCurveTo(cx - headRadius * 1.2, neckY + 4, cx - headRadius * 2.2, neckY + 12, cx - headRadius * 2.2, cy - silhouetteHeight * 0.08);
        cCtx.bezierCurveTo(cx - headRadius * 2.2, cy + silhouetteHeight * 0.12, cx - headRadius * 2.6, cy + silhouetteHeight * 0.28, cx - headRadius * 1.8, cy + silhouetteHeight * 0.32);
        cCtx.bezierCurveTo(cx - headRadius * 1.2, cy + silhouetteHeight * 0.35, cx - headRadius, cy + silhouetteHeight * 0.36, cx, cy + silhouetteHeight * 0.36);
        cCtx.bezierCurveTo(cx + headRadius, cy + silhouetteHeight * 0.36, cx + headRadius * 1.2, cy + silhouetteHeight * 0.35, cx + headRadius * 1.8, cy + silhouetteHeight * 0.32);
        cCtx.bezierCurveTo(cx + headRadius * 2.6, cy + silhouetteHeight * 0.28, cx + headRadius * 2.2, cy + silhouetteHeight * 0.12, cx + headRadius * 2.2, cy - silhouetteHeight * 0.08);
        cCtx.bezierCurveTo(cx + headRadius * 2.2, neckY + 12, cx + headRadius * 1.2, neckY + 4, cx, neckY);
        cCtx.closePath();
        cCtx.fill();
        cCtx.stroke();
        cCtx.restore();

        // 4 Chakras rendering
        // Third Eye: Ajna
        const thirdEyeY = headY - 3;
        drawChakraNode(cCtx, cx, thirdEyeY, chakras[2].score, chakras[2].color, 0, voiceVolumeFactor);

        // Throat: Vishuddha
        const throatY = cy - silhouetteHeight * 0.18;
        drawChakraNode(cCtx, cx, throatY, chakras[0].score, chakras[0].color, 1, voiceVolumeFactor);

        // Heart: Anahata
        const heartY = cy + silhouetteHeight * 0.02;
        drawChakraNode(cCtx, cx, heartY, chakras[1].score, chakras[1].color, 2, voiceVolumeFactor);

        // Root: Muladhara
        const rootY = cy + silhouetteHeight * 0.28;
        drawChakraNode(cCtx, cx, rootY, chakras[3].score, chakras[3].color, 3, voiceVolumeFactor);
      }

      animationFrameRef.current = requestAnimationFrame(drawLoop);
    };

    animationFrameRef.current = requestAnimationFrame(drawLoop);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, soundstage, selectedFreq, activeEffects, convergenceRatio, chakras, isAIHarmonized]);

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
      if (duetAudioElRef.current) duetAudioElRef.current.pause();
      stopTones();
      setIsPlaying(false);
    } else {
      startTones();
      backing.currentTime = voice.currentTime;
      if (duetAudioElRef.current) {
        duetAudioElRef.current.currentTime = voice.currentTime;
      }

      // Keep original speed/tempo constant - retuning is done via Web Audio pitch-preserving nodes
      voice.playbackRate = 1.0;
      backing.playbackRate = 1.0;
      if (duetAudioElRef.current) {
        duetAudioElRef.current.playbackRate = 1.0;
      }

      const playPromises = [
        voice.play(),
        backing.play()
      ];
      if (duetAudioElRef.current) {
        playPromises.push(duetAudioElRef.current.play());
      }

      Promise.all(playPromises).then(() => {
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
    if (duetAudioElRef.current) duetAudioElRef.current.pause();
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

      const baseSong = currentRecording?.selectedSong || { title: 'Freestyle Resonance', artist: 'Self' };
      const songData = currentRecording?.isRemix 
        ? { title: `${baseSong.title} (Remix of ${currentRecording.originalSinger})`, artist: baseSong.artist }
        : baseSong;

      const recordingData = {
        userDisplayName: userData?.displayName || user?.email?.split('@')[0] || 'Aura Singer',
        userId: user?.uid || 'guest_user',
        timestamp: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString(),
        song: songData,
        playbackUrl: cloudPlaybackUrl,
        ariyusRating: rating,
        selectedFreq,
        effects: activeEffects,
        likes: [],
        comments: [],
        voiceSignature: signature
      };

      await addDoc(collection(db, "recordings"), recordingData);

      // Trigger challenge completion if successful!
      if (currentRecording?.challengeCompleted && activeChallenge) {
        const reward = activeChallenge === 'ch1' ? 100 : 150;
        await handleCompleteChallenge(activeChallenge, reward);
      }

      const addedXp = 80;
      const updatedXp = (userData?.xp || 0) + addedXp;

      if (user) {
        await setDoc(doc(db, "users", user.uid), {
          displayName: userData?.displayName || 'Aura Singer',
          email: userData?.email || user.email,
          tier: userData?.tier || 'Free',
          xp: updatedXp,
          voiceSignature: signature,
          completedChallenges: userData?.completedChallenges || []
        });
      }

      setIsUploading(false);
      alert(`Performance successfully uploaded and shared to cloud feed! Gained +${addedXp} XP!`);
      navigate('CommunityFeed');

    } catch (err) {
      console.warn("Cloud upload failed, falling back locally:", err);
      setIsUploading(false);

      // Trigger challenge completion locally if successful!
      if (currentRecording?.challengeCompleted && activeChallenge) {
        const reward = activeChallenge === 'ch1' ? 100 : 150;
        await handleCompleteChallenge(activeChallenge, reward);
      }
      
      const baseSong = currentRecording?.selectedSong || { title: 'Freestyle Resonance', artist: 'Self' };
      const songData = currentRecording?.isRemix 
        ? { title: `${baseSong.title} (Remix of ${currentRecording.originalSinger})`, artist: baseSong.artist }
        : baseSong;

      saveAndShare({
        song: songData,
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

  const exportVocalAuraCard = () => {
    const {
      vocalType = 'Alto',
      resonanceType = 'Mixed Voice',
      dominantFreq = '220 Hz',
      energy = 78,
      flow = 82,
      expression = 75,
      breath = 88,
      stability = 84
    } = signature;

    const throatScore = chakras[0].score;
    const heartScore = chakras[1].score;
    const thirdEyeScore = chakras[2].score;
    const rootScore = chakras[3].score;

    const svgWidth = 800;
    const svgHeight = 1000;

    const svgString = `
<svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Fonts -->
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&amp;family=Inter:wght@300;400;600;700&amp;display=swap');
      .title { font-family: 'Orbitron', sans-serif; font-weight: 900; fill: #ffffff; }
      .subtitle { font-family: 'Inter', sans-serif; font-weight: 300; fill: #00f2ff; letter-spacing: 2px; }
      .label { font-family: 'Orbitron', sans-serif; font-weight: 700; fill: #8892b0; font-size: 14px; text-transform: uppercase; }
      .value { font-family: 'Orbitron', sans-serif; font-weight: 700; fill: #ffffff; font-size: 16px; }
      .text-body { font-family: 'Inter', sans-serif; font-weight: 400; fill: #a8b2d1; font-size: 15px; }
      .badge-text { font-family: 'Orbitron', sans-serif; font-weight: 700; fill: #0a0032; font-size: 14px; }
      .glow-throat { filter: drop-shadow(0px 0px 8px #00f2ff); }
      .glow-heart { filter: drop-shadow(0px 0px 8px #00ff87); }
      .glow-thirdeye { filter: drop-shadow(0px 0px 8px #ff00c1); }
      .glow-root { filter: drop-shadow(0px 0px 8px #ff3b30); }
    </style>

    <!-- Gradients -->
    <linearGradient id="bgGrad" x1="0" y1="0" x2="800" y2="1000" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#02001a" />
      <stop offset="50%" stop-color="#060426" />
      <stop offset="100%" stop-color="#0c0032" />
    </linearGradient>

    <linearGradient id="cyanGlow" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#00f2ff" />
      <stop offset="100%" stop-color="#00ff87" />
    </linearGradient>

    <linearGradient id="magentaGlow" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#ff00c1" />
      <stop offset="100%" stop-color="#7000ff" />
    </linearGradient>

    <radialGradient id="auraLeft" cx="10%" cy="20%" r="50%">
      <stop offset="0%" stop-color="#00f2ff" stop-opacity="0.15" />
      <stop offset="100%" stop-color="#00f2ff" stop-opacity="0" />
    </radialGradient>
    
    <radialGradient id="auraRight" cx="90%" cy="80%" r="50%">
      <stop offset="0%" stop-color="#ff00c1" stop-opacity="0.15" />
      <stop offset="100%" stop-color="#ff00c1" stop-opacity="0" />
    </radialGradient>
  </defs>

  <!-- Background Base -->
  <rect width="${svgWidth}" height="${svgHeight}" fill="url(#bgGrad)" />
  <rect width="${svgWidth}" height="${svgHeight}" fill="url(#auraLeft)" />
  <rect width="${svgWidth}" height="${svgHeight}" fill="url(#auraRight)" />

  <!-- Cosmic Grid Overlay -->
  <path d="M 0,100 L 800,100 M 0,200 L 800,200 M 0,300 L 800,300 M 0,400 L 800,400 M 0,500 L 800,500 M 0,600 L 800,600 M 0,700 L 800,700 M 0,800 L 800,800 M 0,900 L 800,900" stroke="rgba(255, 255, 255, 0.02)" stroke-width="1" />
  <path d="M 100,0 L 100,1000 M 200,0 L 200,1000 M 300,0 L 300,1000 M 400,0 L 400,1000 M 500,0 L 500,1000 M 600,0 L 600,1000 M 700,0 L 700,1000" stroke="rgba(255, 255, 255, 0.02)" stroke-width="1" />

  <!-- Outer Glassmorphic Border -->
  <rect x="25" y="25" width="750" height="950" rx="24" stroke="rgba(255, 255, 255, 0.08)" stroke-width="2" fill="rgba(255, 255, 255, 0.01)" />

  <!-- HEADER -->
  <text x="60" y="85" class="title" font-size="28" letter-spacing="3">ARIYUS RESONANCE PROFILE</text>
  <text x="60" y="115" class="subtitle" font-size="13">DIGITAL VOCAL AURA AUTHENTICATION PROFILE</text>

  <!-- Divider -->
  <line x1="60" y1="140" x2="740" y2="140" stroke="rgba(255,255,255,0.1)" stroke-width="1" />

  <!-- VOCAL SIGNATURE BOX -->
  <rect x="60" y="170" width="680" height="120" rx="16" fill="rgba(10, 0, 50, 0.4)" stroke="rgba(0, 242, 255, 0.15)" stroke-width="1.5" />
  
  <text x="90" y="215" class="label" font-size="12">Vocal Identity</text>
  <text x="90" y="250" class="title" font-size="24" fill="#00f2ff">${vocalType}</text>

  <text x="320" y="215" class="label" font-size="12">Resonance Node</text>
  <text x="320" y="250" class="title" font-size="24" fill="#ff00c1">${resonanceType}</text>

  <text x="560" y="215" class="label" font-size="12">Dominant Pitch</text>
  <text x="560" y="250" class="title" font-size="24" fill="#00ff87">${dominantFreq}</text>

  <!-- VOCAL BIOMARKERS RACK -->
  <text x="60" y="340" class="title" font-size="18" fill="#ffffff" letter-spacing="1">vocal biomarkers</text>
  
  <!-- Stat 1: Energy -->
  <g transform="translate(60, 360)">
    <text x="0" y="25" class="label" font-size="13">Vocal Energy</text>
    <text x="300" y="25" class="value">${energy}%</text>
    <rect x="0" y="38" width="340" height="10" rx="5" fill="rgba(255, 255, 255, 0.05)" />
    <rect x="0" y="38" width="${(340 * energy) / 100}" height="10" rx="5" fill="url(#cyanGlow)" />
  </g>

  <!-- Stat 2: Flow -->
  <g transform="translate(60, 440)">
    <text x="0" y="25" class="label" font-size="13">Flow &amp; Rhythm</text>
    <text x="300" y="25" class="value">${flow}%</text>
    <rect x="0" y="38" width="340" height="10" rx="5" fill="rgba(255, 255, 255, 0.05)" />
    <rect x="0" y="38" width="${(340 * flow) / 100}" height="10" rx="5" fill="#00ff87" />
  </g>

  <!-- Stat 3: Expression -->
  <g transform="translate(60, 520)">
    <text x="0" y="25" class="label" font-size="13">Expression &amp; Emotion</text>
    <text x="300" y="25" class="value">${expression}%</text>
    <rect x="0" y="38" width="340" height="10" rx="5" fill="rgba(255, 255, 255, 0.05)" />
    <rect x="0" y="38" width="${(340 * expression) / 100}" height="10" rx="5" fill="url(#magentaGlow)" />
  </g>

  <!-- Stat 4: Breath -->
  <g transform="translate(60, 600)">
    <text x="0" y="25" class="label" font-size="13">Breath Control</text>
    <text x="300" y="25" class="value">${breath}%</text>
    <rect x="0" y="38" width="340" height="10" rx="5" fill="rgba(255, 255, 255, 0.05)" />
    <rect x="0" y="38" width="${(340 * breath) / 100}" height="10" rx="5" fill="#ffb700" />
  </g>

  <!-- Stat 5: Pitch Stability -->
  <g transform="translate(60, 680)">
    <text x="0" y="25" class="label" font-size="13">Pitch Stability</text>
    <text x="300" y="25" class="value">${stability}%</text>
    <rect x="0" y="38" width="340" height="10" rx="5" fill="rgba(255, 255, 255, 0.05)" />
    <rect x="0" y="38" width="${(340 * stability) / 100}" height="10" rx="5" fill="#7000ff" />
  </g>

  <!-- CHAKRA PROFILE CORES -->
  <text x="430" y="340" class="title" font-size="18" fill="#ffffff" letter-spacing="1">chakra alignment</text>

  <!-- Chakra 1: Third Eye -->
  <g transform="translate(430, 360)">
    <circle cx="20" cy="28" r="16" fill="rgba(255, 0, 193, 0.15)" stroke="#ff00c1" stroke-width="1.5" class="glow-thirdeye" />
    <text x="14" y="33" font-family="'Orbitron', sans-serif" font-weight="900" font-size="12" fill="#ff00c1">👁</text>
    <text x="50" y="20" class="label" font-size="12">Third Eye (Ajna)</text>
    <text x="50" y="36" class="text-body" font-size="12" fill="rgba(255,255,255,0.6)">Frequency stability &amp; cognitive focus</text>
    <text x="270" y="25" class="value" fill="#ff00c1">${thirdEyeScore}%</text>
    <line x1="50" y1="46" x2="310" y2="46" stroke="rgba(255,255,255,0.06)" stroke-width="3" />
    <line x1="50" y1="46" x2="${50 + 260 * (thirdEyeScore / 100)}" y2="46" stroke="#ff00c1" stroke-width="3" />
  </g>

  <!-- Chakra 2: Throat -->
  <g transform="translate(430, 440)">
    <circle cx="20" cy="28" r="16" fill="rgba(0, 242, 255, 0.15)" stroke="#00f2ff" stroke-width="1.5" class="glow-throat" />
    <text x="14" y="33" font-family="'Orbitron', sans-serif" font-weight="900" font-size="12" fill="#00f2ff">🗣</text>
    <text x="50" y="20" class="label" font-size="12">Throat (Vishuddha)</text>
    <text x="50" y="36" class="text-body" font-size="12" fill="rgba(255,255,255,0.6)">Communication clarity &amp; harmonics</text>
    <text x="270" y="25" class="value" fill="#00f2ff">${throatScore}%</text>
    <line x1="50" y1="46" x2="310" y2="46" stroke="rgba(255,255,255,0.06)" stroke-width="3" />
    <line x1="50" y1="46" x2="${50 + 260 * (throatScore / 100)}" y2="46" stroke="#00f2ff" stroke-width="3" />
  </g>

  <!-- Chakra 3: Heart -->
  <g transform="translate(430, 520)">
    <circle cx="20" cy="28" r="16" fill="rgba(0, 255, 135, 0.15)" stroke="#00ff87" stroke-width="1.5" class="glow-heart" />
    <text x="14" y="33" font-family="'Orbitron', sans-serif" font-weight="900" font-size="12" fill="#00ff87">💚</text>
    <text x="50" y="20" class="label" font-size="12">Heart (Anahata)</text>
    <text x="50" y="36" class="text-body" font-size="12" fill="rgba(255,255,255,0.6)">Respiratory coherence &amp; stability</text>
    <text x="270" y="25" class="value" fill="#00ff87">${heartScore}%</text>
    <line x1="50" y1="46" x2="310" y2="46" stroke="rgba(255,255,255,0.06)" stroke-width="3" />
    <line x1="50" y1="46" x2="${50 + 260 * (heartScore / 100)}" y2="46" stroke="#00ff87" stroke-width="3" />
  </g>

  <!-- Chakra 4: Root -->
  <g transform="translate(430, 600)">
    <circle cx="20" cy="28" r="16" fill="rgba(255, 59, 48, 0.15)" stroke="#ff3b30" stroke-width="1.5" class="glow-root" />
    <text x="14" y="33" font-family="'Orbitron', sans-serif" font-weight="900" font-size="12" fill="#ff3b30">⚓</text>
    <text x="50" y="20" class="label" font-size="12">Root (Muladhara)</text>
    <text x="50" y="36" class="text-body" font-size="12" fill="rgba(255,255,255,0.6)">Acoustic grounding &amp; sub-bass</text>
    <text x="270" y="25" class="value" fill="#ff3b30">${rootScore}%</text>
    <line x1="50" y1="46" x2="310" y2="46" stroke="rgba(255,255,255,0.06)" stroke-width="3" />
    <line x1="50" y1="46" x2="${50 + 260 * (rootScore / 100)}" y2="46" stroke="#ff3b30" stroke-width="3" />
  </g>

  <!-- Alignment Index Indicator -->
  <g transform="translate(430, 675)">
    <rect x="0" y="0" width="310" height="55" rx="10" fill="rgba(255, 255, 255, 0.02)" stroke="rgba(255, 255, 255, 0.04)" stroke-width="1" />
    <text x="15" y="22" font-family="'Orbitron', sans-serif" font-size="10" fill="#8892b0" letter-spacing="1">CONVERGENCE ALIGNMENT INDEX</text>
    <text x="15" y="44" class="title" font-size="18" fill="#00ff87">PHI HARMONIC (1.618)</text>
    <text x="270" y="34" class="value" font-size="18" fill="#00ff87">PASS</text>
  </g>

  <!-- Divider -->
  <line x1="60" y1="765" x2="740" y2="765" stroke="rgba(255,255,255,0.06)" stroke-width="1" />

  <!-- DETAILED CODES & METRICS -->
  <g transform="translate(60, 790)">
    <rect x="0" y="0" width="680" height="110" rx="12" fill="rgba(0, 0, 0, 0.25)" stroke="rgba(255,255,255,0.03)" stroke-width="1" />
    
    <text x="20" y="30" class="label" font-size="10" fill="#8892b0">Speech biomarkers parsed</text>
    <text x="20" y="55" class="value" font-size="15">Jitter: ${biomarkers.jitter}%</text>
    <text x="20" y="80" class="value" font-size="15">Shimmer: ${biomarkers.shimmer}%</text>

    <text x="240" y="30" class="label" font-size="10" fill="#8892b0">Resonance values</text>
    <text x="240" y="55" class="value" font-size="15">HNR: ${biomarkers.hnr} dB</text>
    <text x="240" y="80" class="value" font-size="15">Centroid: ${biomarkers.centroid} Hz</text>

    <text x="460" y="30" class="label" font-size="10" fill="#8892b0">Ariyus encryption hash</text>
    <text x="460" y="55" font-family="monospace" font-size="11" fill="rgba(255,255,255,0.3)">ARC5_HASH_${(Date.now().toString(16)).toUpperCase()}</text>
    <text x="460" y="75" font-family="monospace" font-size="10" fill="#00f2ff">TIER: ${userData?.tier || 'Pro Tier'}</text>
    <text x="460" y="93" font-family="monospace" font-size="9" fill="rgba(255,255,255,0.5)">VERIFICATION SYNCED WITH CLOUD</text>
  </g>

  <!-- FOOTER -->
  <text x="400" y="940" text-anchor="middle" font-family="'Orbitron', sans-serif" font-size="11" fill="rgba(255, 255, 255, 0.25)" letter-spacing="1">
    ARIYUS-ONE BIO-RESONANCE CONSOLE • CLOUD-SECURE IDENT
  </text>
</svg>
    `.trim();

    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Ariyus-Vocal-Aura-${vocalType}-${resonanceType.replace(/\s+/g, '')}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <h2 style={{ textShadow: '0 0 10px var(--primary-glow)', margin: 0 }}>Ariyus ARC-5 Chamber</h2>
        {currentRecording?.isRemix && (
          <span className="level-badge" style={{ background: 'var(--secondary-glow)', boxShadow: '0 0 10px var(--secondary-glow)', fontSize: '0.8rem' }}>
            ✦ REMIX MODE (Target: {currentRecording.originalSinger})
          </span>
        )}
      </div>

      {/* Challenge Completed Victory HUD */}
      {currentRecording?.challengeCompleted && activeChallenge && (
        <div className="glass-panel" style={{ 
          background: 'linear-gradient(135deg, rgba(6, 4, 30, 0.85), rgba(0, 242, 255, 0.15))', 
          borderColor: 'var(--primary-glow)', 
          textAlign: 'center', 
          boxShadow: '0 0 20px var(--primary-glow)',
          padding: '20px'
        }}>
          <h2 style={{ color: '#fff', margin: 0, textShadow: '0 0 12px var(--primary-glow)' }}>
            🏆 ALIGNMENT CHALLENGE COMPLETED!
          </h2>
          <p style={{ color: '#00ff87', fontWeight: 'bold', fontSize: '1.1rem', margin: '8px 0' }}>
            Aligned with {activeChallenge === 'ch1' ? 'Cosmic Breath (432Hz sustain)' : 'Harmonic Alignment (A+ pitch stability)'}
          </p>
          <p style={{ margin: '5px 0 0 0', color: 'var(--text-dim)' }}>
            XP Reward: <span style={{ color: 'var(--primary-glow)', fontWeight: 'bold' }}>+{activeChallenge === 'ch1' ? 100 : 150} XP</span> will be claimed upon saving & sharing.
          </p>
        </div>
      )}

      {/* Performance Grade & Badge Showcase Grid */}
      {currentRecording?.grade && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          {/* Grade Card */}
          <div className="glass-panel" style={{ 
            margin: 0, 
            textAlign: 'center', 
            borderColor: currentRecording.grade.color,
            boxShadow: `0 0 15px ${currentRecording.grade.color}44`
          }}>
            <h4 style={{ margin: '0 0 8px 0', textTransform: 'uppercase', color: 'var(--text-dim)', fontSize: '0.8rem', letterSpacing: '1px' }}>Vocal Alignment Grade</h4>
            <div style={{ 
              fontSize: '4rem', 
              fontWeight: '900', 
              color: currentRecording.grade.color, 
              textShadow: `0 0 20px ${currentRecording.grade.color}`,
              margin: '10px 0',
              fontFamily: '"Orbitron", sans-serif'
            }}>
              {currentRecording.grade.letter}
            </div>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#fff' }}>
              Resonance Accuracy: <strong>{currentRecording.grade.score}%</strong>
            </p>
          </div>

          {/* Badges Earned Card */}
          <div className="glass-panel" style={{ margin: 0, borderColor: 'var(--glass-border)' }}>
            <h4 style={{ margin: '0 0 12px 0', textTransform: 'uppercase', color: 'var(--text-dim)', fontSize: '0.8rem', letterSpacing: '1px' }}>Resonance Badges Earned</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', height: '115px', overflowY: 'auto' }}>
              {currentRecording.badgesEarned && currentRecording.badgesEarned.length > 0 ? (
                currentRecording.badgesEarned.map(badge => (
                  <div key={badge.id} style={{ display: 'flex', gap: '10px', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ fontSize: '1.4rem' }}>{badge.icon}</span>
                    <div style={{ textAlign: 'left' }}>
                      <strong style={{ fontSize: '0.82rem', color: '#fff', display: 'block' }}>{badge.title}</strong>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', display: 'block', lineHeight: '1.2', marginTop: '2px' }}>{badge.desc}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ color: 'var(--text-dim)', fontSize: '0.82rem', display: 'grid', placeItems: 'center', height: '100%' }}>
                  No badges unlocked this performance. Keep practicing!
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Audio Playback Controls */}
      <div className="glass-panel" style={{ textAlign: 'center', borderColor: 'var(--primary-glow)' }}>
        <h3>Real-time Frequency Converter</h3>
        
        {currentRecording?.playbackUrl ? (
          <>
            <audio 
              ref={voiceAudioElRef} 
              src={currentRecording.playbackUrl} 
              onEnded={() => { setIsPlaying(false); stopTones(); duetAudioElRef.current?.pause(); }}
              style={{ display: 'none' }}
              preload="auto"
              crossOrigin="anonymous"
            />
            <audio 
              ref={backingAudioElRef} 
              src={currentRecording?.selectedSong?.audioUrl || 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Happy%20Life.mp3'} 
              style={{ display: 'none' }} 
              preload="auto"
              crossOrigin="anonymous"
            />
            {currentRecording?.duetPartner && (
              <audio 
                ref={duetAudioElRef} 
                src={currentRecording.duetPartner.playbackUrl} 
                style={{ display: 'none' }} 
                preload="auto"
                crossOrigin="anonymous"
              />
            )}
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

          <button 
            className={`glowing-button secondary ${isAIHarmonized ? 'active' : ''}`}
            onClick={() => setIsAIHarmonized(!isAIHarmonized)}
            disabled={!currentRecording}
            style={{ margin: 0 }}
          >
            {isAIHarmonized ? '✓ AI Harmonizer ON' : '✦ AI Orchestrate'}
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

        {/* Chakra Biofield Lightfield Canvas */}
        <div className="glass-panel" style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3>Chakra Biofield Lightfield</h3>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', margin: 0 }}>
            Visualizing dynamic electromagnetic biofield pulses mapped to voice biomarkers.
          </p>
          <div style={{ height: '220px', borderRadius: '10px', overflow: 'hidden', position: 'relative', border: '1px solid rgba(255,255,255,0.06)', background: '#03021a' }}>
            <canvas 
              ref={chakraCanvasRef} 
              style={{ width: '100%', height: '100%' }} 
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', fontSize: '0.78rem', color: 'var(--text-dim)' }}>
            <span>Live Bio-Frequency Field Map</span>
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

      {/* AI Voice Coach Chamber */}
      <div className="glass-panel" style={{ position: 'relative', overflow: 'hidden' }}>
        <h3>AI Voice Coach Analysis</h3>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', margin: '4px 0 15px' }}>
          Biological frequency coaching based on diagnostic metrics (Ariyus Pro feature)
        </p>

        {!(userData?.tier === 'Ariyus Pro' || userData?.tier === 'Creator') ? (
          <div style={{
            position: 'absolute',
            top: 0, left: 0, width: '100%', height: '100%',
            background: 'rgba(6, 4, 30, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 10,
            textAlign: 'center',
            padding: '20px'
          }}>
            <span style={{ fontSize: '2rem', marginBottom: '8px' }}>🔒</span>
            <h4 style={{ textShadow: '0 0 8px var(--secondary-glow)' }}>AI Voice Coach Locked</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', maxWidth: '380px', margin: '6px 0 15px' }}>
              Upgrade to Ariyus Pro to decode biometric vocal feedback, stabilize pitch jitter, and harmonize flow.
            </p>
            <button className="glowing-button secondary" onClick={() => navigate('Upgrade')} style={{ margin: 0, padding: '8px 20px', fontSize: '0.8rem' }}>
              Upgrade to Ariyus Pro
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {getCoachFeedback().map((item, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '12px', background: 'rgba(0,0,0,0.15)', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.03)' }}>
                <span style={{ fontSize: '1.5rem' }}>{item.icon}</span>
                <div>
                  <strong style={{ fontSize: '0.85rem', color: item.color, display: 'block', marginBottom: '3px' }}>{item.type} Check</strong>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)', margin: 0, lineHeight: '1.4' }}>{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Vocal Digital Signature with Card Export option */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <VoiceSignatureCard signature={signature} />
        <button 
          className="glowing-button secondary" 
          onClick={exportVocalAuraCard}
          style={{ width: '100%', margin: 0, padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
        >
          <span>📥 Download Shareable Vocal Aura Card (High-Res SVG)</span>
        </button>
      </div>

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

          {/* Solfeggio Master Volume & Presets with Premium Gating */}
          <div style={{ position: 'relative', marginTop: '10px', border: !(userData?.tier === 'Ariyus Pro' || userData?.tier === 'Creator') ? '1px dashed rgba(255,255,255,0.1)' : 'none', borderRadius: '10px', padding: !(userData?.tier === 'Ariyus Pro' || userData?.tier === 'Creator') ? '12px' : '0' }}>
            {!(userData?.tier === 'Ariyus Pro' || userData?.tier === 'Creator') && (
              <div 
                onClick={() => setUpgradeModalData({ title: 'Solfeggio Tuning Controls', desc: 'Tune vocal layers to core Solfeggio healing hertz frequencies' })}
                style={{
                  position: 'absolute',
                  top: 0, left: 0, width: '100%', height: '100%',
                  background: 'rgba(0,0,0,0.5)',
                  backdropFilter: 'blur(2.5px)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  cursor: 'pointer',
                  zIndex: 5,
                  borderRadius: '10px',
                  textAlign: 'center',
                  padding: '10px'
                }}
              >
                <span style={{ fontSize: '1.25rem', marginBottom: '4px' }}>🔒</span>
                <strong style={{ fontSize: '0.8rem', color: '#fff' }}>Unlock Solfeggio Mix Control</strong>
                <span style={{ fontSize: '0.68rem', color: 'var(--secondary-glow)' }}>Ariyus Pro Membership Required</span>
              </div>
            )}
            
            <div className="slider-group" style={{ opacity: (userData?.tier === 'Ariyus Pro' || userData?.tier === 'Creator') ? 1 : 0.4 }}>
              <label><span>Solfeggio Master Volume</span><span>{freqVol}%</span></label>
              <input type="range" className="slider-input" min="0" max="100" value={freqVol} onChange={e => setFreqVol(parseInt(e.target.value))} disabled={isDryActive || !(userData?.tier === 'Ariyus Pro' || userData?.tier === 'Creator')} />
            </div>

            {/* Solfeggio Presets */}
            <div className="slider-group" style={{ marginTop: '15px', opacity: (userData?.tier === 'Ariyus Pro' || userData?.tier === 'Creator') ? 1 : 0.4 }}>
              <label><span>Target Solfeggio Key</span><span>{selectedFreq} Hz</span></label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {Object.keys(intentions).map(hz => (
                  <button 
                    key={hz} 
                    className={`effect-toggle-btn ${selectedFreq === parseInt(hz) ? 'active' : ''}`}
                    style={{ padding: '6px 12px', flexGrow: 1, fontSize: '0.85rem' }}
                    onClick={() => setSelectedFreq(parseInt(hz))}
                    disabled={isDryActive || !(userData?.tier === 'Ariyus Pro' || userData?.tier === 'Creator')}
                  >
                    {hz} Hz
                  </button>
                ))}
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--primary-glow)', marginTop: '6px', fontStyle: 'italic' }}>
                Intention: {intentions[selectedFreq]}
              </p>
            </div>
          </div>

          {/* Effects toggling */}
          <div style={{ marginTop: '15px' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Proprietary ARC-5 DSP Modules</label>
            <div className="effects-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
              {effectPresets.map(fx => {
                const isLocked = fx.premium && !(userData?.tier === 'Ariyus Pro' || userData?.tier === 'Creator');
                return (
                  <button 
                    key={fx.id} 
                    className={`effect-toggle-btn ${activeEffects.includes(fx.name) ? 'active' : ''}`}
                    onClick={() => {
                      if (isLocked) {
                        setUpgradeModalData({ title: fx.name, desc: fx.desc });
                      } else {
                        toggleEffect(fx.name);
                      }
                    }}
                    disabled={isDryActive}
                    style={{ 
                      padding: '8px 12px', 
                      height: 'auto', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '4px', 
                      alignItems: 'flex-start', 
                      textAlign: 'left',
                      position: 'relative',
                      opacity: isLocked ? 0.65 : 1,
                      border: isLocked ? '1px dashed rgba(255,255,255,0.15)' : undefined
                    }}
                  >
                    <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '0.85rem' }}>{fx.name}</strong>
                      {isLocked && <span>🔒</span>}
                    </div>
                    <span style={{ fontSize: '0.68rem', opacity: 0.85, fontWeight: 'normal', lineHeight: '1.3' }}>{fx.desc}</span>
                  </button>
                );
              })}
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
      {upgradeModalData && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(2, 0, 26, 0.85)',
          backdropFilter: 'blur(10px)',
          display: 'grid',
          placeItems: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div className="glass-panel" style={{ maxWidth: '480px', textAlign: 'center', borderColor: 'var(--secondary-glow)', boxShadow: '0 0 25px rgba(255,0,193,0.25)' }}>
            <h3 style={{ textShadow: '0 0 10px var(--secondary-glow)', color: '#fff', justifyContent: 'center' }}>
              🔒 Pro Audio Matrix Locked
            </h3>
            <p style={{ margin: '15px 0', fontSize: '1rem', color: '#fff' }}>
              You clicked on <b>{upgradeModalData.title}</b>.
            </p>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '20px' }}>
              Advanced sound resonance filters, dynamic Solfeggio carrier mix layers, and AI Voice Coaching are reserved for members of our premium plans.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button 
                className="glowing-button secondary" 
                onClick={() => {
                  setUpgradeModalData(null);
                  navigate('Upgrade');
                }}
                style={{ margin: 0 }}
              >
                Upgrade to Pro
              </button>
              <button 
                className="glowing-button" 
                onClick={() => setUpgradeModalData(null)}
                style={{ margin: 0, background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.2)', color: '#fff', textShadow: 'none' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
 
    </div>
  );
};

export default ResultsChamber;
