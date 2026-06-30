import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';

const makeDistortionCurve = (amount) => {
  if (amount <= 0) return null;
  const k = amount;
  const n_samples = 44100;
  const curve = new Float32Array(n_samples);
  const deg = Math.PI / 180;
  for (let i = 0; i < n_samples; ++i) {
    const x = (i * 2) / n_samples - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  return curve;
};


// Helper: Standard browser WAV Encoder for Sound Forge Mixdown export
const encodeWAV = (audioBuffer) => {
  const numOfChan = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  
  let result;
  if (numOfChan === 2) {
    result = interleave(audioBuffer.getChannelData(0), audioBuffer.getChannelData(1));
  } else {
    result = audioBuffer.getChannelData(0);
  }
  
  const buffer = new ArrayBuffer(44 + result.length * 2);
  const view = new DataView(buffer);
  
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + result.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numOfChan, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numOfChan * 2, true);
  view.setUint16(32, numOfChan * 2, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, result.length * 2, true);
  
  floatTo16BitPCM(view, 44, result);
  return new Blob([view], { type: 'audio/wav' });
};

const interleave = (inputL, inputR) => {
  const length = inputL.length + inputR.length;
  const result = new Float32Array(length);
  let index = 0;
  let inputIndex = 0;
  while (index < length) {
    result[index++] = inputL[inputIndex];
    result[index++] = inputR[inputIndex];
    inputIndex++;
  }
  return result;
};

const floatTo16BitPCM = (output, offset, input) => {
  for (let i = 0; i < input.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
};

const writeString = (view, offset, string) => {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
};

// --- Web Audio Dynamic Synthesizer Loop Step Sequencer ---
const scheduleSynthClip = (ctx, destination, synthType, startTime, duration, startOffset) => {
  const endTime = startTime + duration;
  if (startOffset >= endTime) return [];

  const activeNodes = [];
  const startSchedulingFrom = Math.max(startOffset, startTime);
  const tempoBpm = 120;
  const beatDuration = 60 / tempoBpm; // 0.5s
  
  let currentBeatTime = startTime;
  
  while (currentBeatTime < endTime) {
    if (currentBeatTime >= startSchedulingFrom) {
      const scheduleTime = ctx.currentTime + (currentBeatTime - startOffset);
      
      if (synthType === 'drums') {
        const beatIndex = Math.round((currentBeatTime - startTime) / beatDuration) % 4;
        if (beatIndex === 0 || beatIndex === 2) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(150, scheduleTime);
          osc.frequency.exponentialRampToValueAtTime(0.01, scheduleTime + 0.15);
          gain.gain.setValueAtTime(0.3, scheduleTime);
          gain.gain.exponentialRampToValueAtTime(0.01, scheduleTime + 0.18);
          osc.connect(gain);
          gain.connect(destination);
          osc.start(scheduleTime);
          osc.stop(scheduleTime + 0.2);
          activeNodes.push(osc);
        } else {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(180, scheduleTime);
          gain.gain.setValueAtTime(0.12, scheduleTime);
          gain.gain.exponentialRampToValueAtTime(0.01, scheduleTime + 0.1);
          osc.connect(gain);
          gain.connect(destination);
          osc.start(scheduleTime);
          osc.stop(scheduleTime + 0.15);
          activeNodes.push(osc);
          
          const bufferSize = ctx.sampleRate * 0.12;
          const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
          const outputData = noiseBuffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) {
            outputData[i] = Math.random() * 2 - 1;
          }
          const noiseSource = ctx.createBufferSource();
          noiseSource.buffer = noiseBuffer;
          const noiseGain = ctx.createGain();
          noiseGain.gain.setValueAtTime(0.1, scheduleTime);
          noiseGain.gain.exponentialRampToValueAtTime(0.01, scheduleTime + 0.12);
          noiseSource.connect(noiseGain);
          noiseGain.connect(destination);
          noiseSource.start(scheduleTime);
          noiseSource.stop(scheduleTime + 0.15);
          activeNodes.push(noiseSource);
        }
      } else if (synthType === 'bass') {
        const notes = [66, 66, 82.5, 99];
        const beatIndex = Math.round((currentBeatTime - startTime) / beatDuration) % 4;
        const freq = notes[beatIndex];
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, scheduleTime);
        gain.gain.setValueAtTime(0.25, scheduleTime);
        gain.gain.exponentialRampToValueAtTime(0.01, scheduleTime + 0.4);
        osc.connect(gain);
        gain.connect(destination);
        osc.start(scheduleTime);
        osc.stop(scheduleTime + 0.45);
        activeNodes.push(osc);
      } else if (synthType === 'pads') {
        const chords = [
          [264, 330, 396],
          [297, 352, 445.5],
          [264, 330, 396],
          [352, 440, 528]
        ];
        const measureIndex = Math.floor((currentBeatTime - startTime) / (beatDuration * 4)) % chords.length;
        const chordFreqs = chords[measureIndex];
        chordFreqs.forEach(freq => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, scheduleTime);
          gain.gain.setValueAtTime(0.0, scheduleTime);
          gain.gain.linearRampToValueAtTime(0.06, scheduleTime + 0.8);
          gain.gain.exponentialRampToValueAtTime(0.001, scheduleTime + 1.9);
          osc.connect(gain);
          gain.connect(destination);
          osc.start(scheduleTime);
          osc.stop(scheduleTime + 2.0);
          activeNodes.push(osc);
        });
      } else if (synthType === 'chimes') {
        const pattern = [528, 660, 792, 1056];
        const beatIndex = Math.round((currentBeatTime - startTime) / (beatDuration / 2)) % 8;
        if (beatIndex < pattern.length) {
          const freq = pattern[beatIndex];
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, scheduleTime);
          gain.gain.setValueAtTime(0.08, scheduleTime);
          gain.gain.exponentialRampToValueAtTime(0.001, scheduleTime + 0.2);
          osc.connect(gain);
          gain.connect(destination);
          osc.start(scheduleTime);
          osc.stop(scheduleTime + 0.25);
          activeNodes.push(osc);
        }
      }
    }
    
    if (synthType === 'chimes') {
      currentBeatTime += beatDuration / 2;
    } else if (synthType === 'pads') {
      currentBeatTime += beatDuration * 4;
    } else {
      currentBeatTime += beatDuration;
    }
  }
  return activeNodes;
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

const WorkstationScreen = ({ userData, navigate, duetPayload }) => {
  const isPaidUser = userData?.tier !== 'Free';

  // --- DAW Track States ---
  const [tracks, setTracks] = useState([
    { id: 1, name: 'Vocal Track 1', type: 'vocal', volume: 80, pan: 0, mute: false, solo: false, isRecording: false, clips: [], fxDelayTime: 0.3, fxDelayFeedback: 30, fxFilterCutoff: 1500, fxFilterType: 'lowpass', fxDistortion: 0, fxPitchShift: 0, fxExpanded: false },
    { id: 2, name: 'Backing Instrumental', type: 'backing', volume: 70, pan: 0, mute: false, solo: false, clips: [], fxDelayTime: 0.3, fxDelayFeedback: 30, fxFilterCutoff: 1500, fxFilterType: 'lowpass', fxDistortion: 0, fxPitchShift: 0, fxExpanded: false },
    { id: 3, name: 'Solfeggio Osc Drone', type: 'osc', volume: 20, pan: 0, mute: false, solo: false, hz: 528, filename: 'Synth sine carrier', fxDelayTime: 0.3, fxDelayFeedback: 30, fxFilterCutoff: 1500, fxFilterType: 'lowpass', fxDistortion: 0, fxPitchShift: 0, fxExpanded: false },
    { id: 4, name: 'Ambient Space Loop', type: 'sfx', volume: 40, pan: 0, mute: false, solo: false, clips: [], fxDelayTime: 0.3, fxDelayFeedback: 30, fxFilterCutoff: 1500, fxFilterType: 'lowpass', fxDistortion: 0, fxPitchShift: 0, fxExpanded: false }
  ]);

  // --- Tool States ---
  const [activeTool, setActiveTool] = useState('select'); // 'select' or 'slice'
  const draggedClipRef = useRef(null);

  // --- Transport States ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [masterVolume, setMasterVolume] = useState(85);
  const [isMixdownRunning, setIsMixdownRunning] = useState(false);
  const [mixdownProgress, setMixdownProgress] = useState(0);
  const [limiterActive, setLimiterActive] = useState(true);
  const [selectedResonance, setSelectedResonance] = useState(528);

  // --- Instrumentals Library States ---
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [librarySongs, setLibrarySongs] = useState([
    { id: 'm1', title: 'Cosmic Resonance', artist: 'Solfeggio 528Hz Guide', audioUrl: 'https://upload.wikimedia.org/wikipedia/commons/5/52/Mozart_-_Clarinet_Quintet_in_A_major%2C_K._581_-_II._Larghetto.mp3' },
    { id: 'm2', title: 'Solar Plexus Alignment', artist: 'Theta Wave 432Hz Beat', audioUrl: 'https://upload.wikimedia.org/wikipedia/commons/1/1a/Suite_1_-_Prelude_in_G_major.mp3' },
    { id: 'm3', title: 'Throat Chakra Cleansing', artist: '741Hz Ambient Drone', audioUrl: 'https://upload.wikimedia.org/wikipedia/commons/8/87/Beethoven_-_Symphony_No._5_in_C_minor%2C_Op._67_-_I._Allegro_con_brio.mp3' }
  ]);
  const [targetTrackId, setTargetTrackId] = useState(null);
  const [libraryTab, setLibraryTab] = useState('cover'); // 'cover' or 'synth'

  // --- Master EQ States & Refs ---
  const [eqBass, setEqBass] = useState(0);
  const [eqMid, setEqMid] = useState(0);
  const [eqTreble, setEqTreble] = useState(0);

  const eqBassRef = useRef(null);
  const eqMidRef = useRef(null);
  const eqTrebleRef = useRef(null);

  // --- Web Audio Graph Refs ---
  const audioCtxRef = useRef(null);
  const activeSourcesRef = useRef({});
  const oscNodesRef = useRef({});
  const trackGainsRef = useRef({});
  const trackPannersRef = useRef({});
  const masterGainRef = useRef(null);

  // --- Track-Level Insert FX Refs ---
  const trackFiltersRef = useRef({});
  const trackDelaysRef = useRef({});
  const trackDelayFeedbacksRef = useRef({});
  const trackDistortionsRef = useRef({});

  // --- Transport Timer Refs ---
  const timelineTimerRef = useRef(null);
  const playbackStartTimeRef = useRef(0);
  const pausedTimeRef = useRef(0);

  // --- Waveform Canvas Refs ---
  const canvasRefs = useRef({});

  // --- Mic Recording Refs ---
  const mediaRecorderRef = useRef(null);
  const recChunksRef = useRef([]);
  const streamRef = useRef(null);

  // Load duet partner vocals on mount if redirected from social feed duet button
  useEffect(() => {
    if (duetPayload) {
      const loadDuetVocals = async () => {
        const ctx = getAudioContext();
        try {
          const response = await fetch(duetPayload.playbackUrl);
          const arrayBuffer = await response.arrayBuffer();
          const decoded = await ctx.decodeAudioData(arrayBuffer);
          const duetClip = {
            id: 'clip_duet',
            buffer: decoded,
            name: `Duet: ${duetPayload.userDisplayName}`,
            startTime: 0,
            duration: decoded.duration,
            offset: 0,
            type: 'audio'
          };
          setTracks(prev => prev.map(t => {
            if (t.id === 2) {
              return { ...t, clips: [duetClip], filename: duetPayload.song.title };
            }
            if (t.id === 1) {
              return { ...t, name: 'Your Vocals (Mic)' };
            }
            return t;
          }));
        } catch(e) {
          console.error("Failed to load duet guide vocals:", e);
        }
      };
      loadDuetVocals();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duetPayload]);

  // Get max timeline length
  const getTimelineDuration = () => {
    let max = 30; // base 30 seconds grid
    tracks.forEach(t => {
      t.clips?.forEach(c => {
        max = Math.max(max, c.startTime + c.duration);
      });
    });
    return Math.ceil(max);
  };

  const timelineDuration = getTimelineDuration();

  // Initialize main context
  const getAudioContext = () => {
    if (!audioCtxRef.current) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      audioCtxRef.current = new AudioCtxClass();
      
      // Create master gain
      masterGainRef.current = audioCtxRef.current.createGain();
      masterGainRef.current.gain.setValueAtTime((masterVolume / 100) * 0.8, audioCtxRef.current.currentTime);
      
      // Create Master EQ filters
      eqBassRef.current = audioCtxRef.current.createBiquadFilter();
      eqBassRef.current.type = 'lowshelf';
      eqBassRef.current.frequency.setValueAtTime(100, audioCtxRef.current.currentTime);
      eqBassRef.current.gain.setValueAtTime(eqBass, audioCtxRef.current.currentTime);

      eqMidRef.current = audioCtxRef.current.createBiquadFilter();
      eqMidRef.current.type = 'peaking';
      eqMidRef.current.frequency.setValueAtTime(1000, audioCtxRef.current.currentTime);
      eqMidRef.current.Q.setValueAtTime(1.0, audioCtxRef.current.currentTime);
      eqMidRef.current.gain.setValueAtTime(eqMid, audioCtxRef.current.currentTime);

      eqTrebleRef.current = audioCtxRef.current.createBiquadFilter();
      eqTrebleRef.current.type = 'highshelf';
      eqTrebleRef.current.frequency.setValueAtTime(8000, audioCtxRef.current.currentTime);
      eqTrebleRef.current.gain.setValueAtTime(eqTreble, audioCtxRef.current.currentTime);

      // Connect: masterGain -> bass -> mid -> treble -> destination
      masterGainRef.current.connect(eqBassRef.current);
      eqBassRef.current.connect(eqMidRef.current);
      eqMidRef.current.connect(eqTrebleRef.current);
      eqTrebleRef.current.connect(audioCtxRef.current.destination);
    }
    return audioCtxRef.current;
  };

  // Sync Master EQ values dynamically
  useEffect(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    if (eqBassRef.current) {
      eqBassRef.current.gain.setValueAtTime(eqBass, ctx.currentTime);
    }
    if (eqMidRef.current) {
      eqMidRef.current.gain.setValueAtTime(eqMid, ctx.currentTime);
    }
    if (eqTrebleRef.current) {
      eqTrebleRef.current.gain.setValueAtTime(eqTreble, ctx.currentTime);
    }
  }, [eqBass, eqMid, eqTreble]);

  // Sync master volume fader
  useEffect(() => {
    if (masterGainRef.current && audioCtxRef.current) {
      masterGainRef.current.gain.setValueAtTime((masterVolume / 100) * 0.8, audioCtxRef.current.currentTime);
    }
  }, [masterVolume]);

  // Load songs database library on mount
  useEffect(() => {
    const loadSongs = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "songs"));
        const songs = [];
        querySnapshot.forEach((doc) => {
          songs.push({ id: doc.id, ...doc.data() });
        });
        if (songs.length > 0) {
          setLibrarySongs(songs);
        }
      } catch (err) {
        console.warn("Could not load songs database library:", err);
      }
    };
    loadSongs();
  }, []);

  // Sync individual track gains/pans during playback
  useEffect(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    tracks.forEach(t => {
      // Calculate active volume (accounting for Solo/Mute logic)
      const hasAnySolo = tracks.some(tr => tr.solo);
      let targetGain = (t.volume / 100);

      if (t.mute) {
        targetGain = 0;
      } else if (hasAnySolo && !t.solo) {
        targetGain = 0;
      }

      if (trackGainsRef.current[t.id]) {
        trackGainsRef.current[t.id].gain.setValueAtTime(targetGain, ctx.currentTime);
      }
      if (trackPannersRef.current[t.id] && trackPannersRef.current[t.id].pan) {
        trackPannersRef.current[t.id].pan.setValueAtTime(t.pan, ctx.currentTime);
      }

      // Sync Real-Time track FX values
      if (trackFiltersRef.current[t.id]) {
        trackFiltersRef.current[t.id].type = t.fxFilterType || 'lowpass';
        trackFiltersRef.current[t.id].frequency.setValueAtTime(t.fxFilterCutoff || 1500, ctx.currentTime);
      }
      if (trackDelaysRef.current[t.id]) {
        trackDelaysRef.current[t.id].delayTime.setValueAtTime(t.fxDelayTime || 0.0, ctx.currentTime);
      }
      if (trackDelayFeedbacksRef.current[t.id]) {
        trackDelayFeedbacksRef.current[t.id].gain.setValueAtTime((t.fxDelayFeedback || 0) / 100, ctx.currentTime);
      }
      if (trackDistortionsRef.current[t.id]) {
        if (t.fxDistortion > 0) {
          trackDistortionsRef.current[t.id].curve = makeDistortionCurve(t.fxDistortion);
        } else {
          trackDistortionsRef.current[t.id].curve = null;
        }
      }

      // Re-configure oscillators dynamically if hz changes
      if (t.type === 'osc' && oscNodesRef.current[t.id] && isPlaying) {
        oscNodesRef.current[t.id].frequency.setValueAtTime(t.hz, ctx.currentTime);
      }
    });
  }, [tracks, isPlaying]);

  // --- Dynamic Waveform Renderer ---
  const drawWaveform = (trackId, clips = []) => {
    const canvas = canvasRefs.current[trackId];
    if (!canvas) return;
    const canvasCtx = canvas.getContext('2d');
    const width = canvas.width = canvas.offsetWidth;
    const height = canvas.height = canvas.offsetHeight;

    canvasCtx.fillStyle = 'rgba(7, 6, 48, 0.45)';
    canvasCtx.fillRect(0, 0, width, height);

    // Draw timeline vertical grids
    canvasCtx.strokeStyle = 'rgba(255,255,255,0.03)';
    canvasCtx.lineWidth = 1;
    const pxPerSec = width / timelineDuration;
    for (let sec = 5; sec < timelineDuration; sec += 5) {
      const x = sec * pxPerSec;
      canvasCtx.beginPath();
      canvasCtx.moveTo(x, 0);
      canvasCtx.lineTo(x, height);
      canvasCtx.stroke();
    }

    if (!clips || clips.length === 0) return;

    clips.forEach(clip => {
      const xStart = (clip.startTime / timelineDuration) * width;
      const xWidth = (clip.duration / timelineDuration) * width;
      const amp = height / 2;

      // Draw clip frame background
      canvasCtx.fillStyle = clip.type === 'synth' ? 'rgba(0, 255, 135, 0.08)' : 'rgba(0, 242, 255, 0.08)';
      canvasCtx.fillRect(xStart, 0, xWidth, height);

      // Draw clip border
      canvasCtx.strokeStyle = clip.type === 'synth' ? '#00ff87' : trackId === 1 ? '#00f2ff' : '#ff00c1';
      canvasCtx.lineWidth = 1.5;
      canvasCtx.strokeRect(xStart, 0, xWidth, height);

      if (clip.buffer) {
        const data = clip.buffer.getChannelData(0);
        const sampleRate = clip.buffer.sampleRate;
        const startIndex = Math.floor(clip.offset * sampleRate);
        const endIndex = Math.floor((clip.offset + clip.duration) * sampleRate);
        const bufferLen = endIndex - startIndex;

        if (bufferLen > 0) {
          const step = Math.ceil(bufferLen / xWidth);
          canvasCtx.beginPath();
          canvasCtx.strokeStyle = clip.type === 'synth' ? '#00ff87' : trackId === 1 ? '#00f2ff' : '#ff00c1';
          
          for (let i = 0; i < xWidth; i++) {
            let min = 1.0;
            let max = -1.0;
            const startPtr = startIndex + Math.floor(i * step);
            for (let j = 0; j < step; j++) {
              const datum = data[startPtr + j];
              if (datum !== undefined) {
                if (datum < min) min = datum;
                if (datum > max) max = datum;
              }
            }
            if (min === 1.0) min = 0;
            if (max === -1.0) max = 0;
            
            canvasCtx.moveTo(xStart + i, (1 + min) * amp);
            canvasCtx.lineTo(xStart + i, (1 + max) * amp);
          }
          canvasCtx.stroke();
        }
      } else if (clip.type === 'synth') {
        canvasCtx.fillStyle = 'rgba(0, 255, 135, 0.4)';
        const notesCount = 8;
        const noteW = xWidth / notesCount;
        for (let i = 0; i < notesCount; i++) {
          const noteH = 6 + Math.sin(i * 1.5) * 4;
          const noteY = (height / 2) - (noteH / 2) + Math.cos(i) * 12;
          canvasCtx.fillRect(xStart + i * noteW + 2, noteY, noteW - 4, noteH);
        }
      }

      // Draw clip label text
      canvasCtx.font = '8px monospace';
      canvasCtx.fillStyle = '#fff';
      canvasCtx.fillText(clip.name, xStart + 5, 12);
    });
  };

  // Reactive canvas redraw effect
  useEffect(() => {
    if (isPaidUser) {
      tracks.forEach(t => {
        drawWaveform(t.id, t.clips);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPaidUser, tracks, timelineDuration]);

  // --- Interactive Timeline Mouse Coordinates Drag & Split Handlers ---
  const handleCanvasMouseDown = (trackId, e) => {
    const canvas = canvasRefs.current[trackId];
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / canvas.offsetWidth;
    const clickTime = percent * timelineDuration;

    const track = tracks.find(tr => tr.id === trackId);
    if (!track) return;

    const clickedClip = track.clips.find(clip => 
      clickTime >= clip.startTime && clickTime <= (clip.startTime + clip.duration)
    );

    if (!clickedClip) return;

    if (activeTool === 'slice') {
      const splitPoint = clickTime;
      const duration1 = splitPoint - clickedClip.startTime;
      const duration2 = clickedClip.duration - duration1;

      if (duration1 < 0.2 || duration2 < 0.2) return;

      const clip1 = {
        ...clickedClip,
        id: clickedClip.id + '_s1',
        duration: duration1
      };

      const clip2 = {
        ...clickedClip,
        id: clickedClip.id + '_s2',
        startTime: splitPoint,
        offset: clickedClip.offset + duration1,
        duration: duration2,
        name: clickedClip.name + ' (slice)'
      };

      setTracks(prev => prev.map(tr => {
        if (tr.id === trackId) {
          const filteredClips = tr.clips.filter(c => c.id !== clickedClip.id);
          return {
            ...tr,
            clips: [...filteredClips, clip1, clip2]
          };
        }
        return tr;
      }));
    } else {
      draggedClipRef.current = {
        trackId,
        clipId: clickedClip.id,
        initialStartTime: clickedClip.startTime,
        clickTimelineTime: clickTime
      };
    }
  };

  const handleCanvasMouseMove = (trackId, e) => {
    if (!draggedClipRef.current) return;
    const drag = draggedClipRef.current;
    if (drag.trackId !== trackId) return;

    const canvas = canvasRefs.current[trackId];
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / canvas.offsetWidth;
    const currentTimelineTime = percent * timelineDuration;

    const delta = currentTimelineTime - drag.clickTimelineTime;
    let nextStartTime = drag.initialStartTime + delta;
    if (nextStartTime < 0) nextStartTime = 0;

    setTracks(prev => prev.map(tr => {
      if (tr.id === trackId) {
        return {
          ...tr,
          clips: tr.clips.map(c => {
            if (c.id === drag.clipId) {
              return { ...c, startTime: nextStartTime };
            }
            return c;
          })
        };
      }
      return tr;
    }));
  };

  const handleCanvasMouseUp = () => {
    draggedClipRef.current = null;
  };

  // --- Transport Controls with Multi-Clip Scheduling ---
  const playAll = () => {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    if (isPlaying) return;

    const startOffset = pausedTimeRef.current;
    playbackStartTimeRef.current = ctx.currentTime - startOffset;

    tracks.forEach(t => {
      const gainNode = ctx.createGain();
      const pannerNode = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
      
      const hasAnySolo = tracks.some(tr => tr.solo);
      let initialVolume = (t.volume / 100);
      if (t.mute || (hasAnySolo && !t.solo)) initialVolume = 0;
      
      gainNode.gain.setValueAtTime(initialVolume, ctx.currentTime);
      if (pannerNode.pan) pannerNode.pan.setValueAtTime(t.pan, ctx.currentTime);

      const filterNode = ctx.createBiquadFilter();
      filterNode.type = t.fxFilterType || 'lowpass';
      filterNode.frequency.setValueAtTime(t.fxFilterCutoff || 1500, ctx.currentTime);

      const distortionNode = ctx.createWaveShaper();
      if (t.fxDistortion > 0) {
        distortionNode.curve = makeDistortionCurve(t.fxDistortion);
        distortionNode.oversample = '4x';
      }

      const delayNode = ctx.createDelay(1.0);
      delayNode.delayTime.setValueAtTime(t.fxDelayTime || 0.0, ctx.currentTime);

      const delayFeedbackNode = ctx.createGain();
      delayFeedbackNode.gain.setValueAtTime((t.fxDelayFeedback || 0) / 100, ctx.currentTime);

      delayNode.connect(delayFeedbackNode);
      delayFeedbackNode.connect(delayNode);

      // Pitch shifting
      const pitchRatio = Math.pow(2, (t.fxPitchShift || 0) / 12);
      const pitchNode = createPitchShifterNode(ctx, pitchRatio);

      pitchNode.output.connect(filterNode);
      filterNode.connect(distortionNode);
      distortionNode.connect(gainNode);
      distortionNode.connect(delayNode);
      delayNode.connect(gainNode);
      gainNode.connect(pannerNode);
      pannerNode.connect(masterGainRef.current);

      trackGainsRef.current[t.id] = gainNode;
      trackPannersRef.current[t.id] = pannerNode;
      trackFiltersRef.current[t.id] = filterNode;
      trackDelaysRef.current[t.id] = delayNode;
      trackDelayFeedbacksRef.current[t.id] = delayFeedbackNode;
      trackDistortionsRef.current[t.id] = distortionNode;

      // Schedule all active clips on this track
      t.clips?.forEach(clip => {
        if (clip.startTime + clip.duration <= startOffset) return;

        if (clip.buffer) {
          const source = ctx.createBufferSource();
          source.buffer = clip.buffer;
          source.connect(pitchNode.input);

          if (startOffset <= clip.startTime) {
            source.start(ctx.currentTime + (clip.startTime - startOffset), clip.offset, clip.duration);
          } else {
            const playedPercent = startOffset - clip.startTime;
            source.start(ctx.currentTime, clip.offset + playedPercent, clip.duration - playedPercent);
          }
          activeSourcesRef.current[clip.id] = source;
        } else if (clip.type === 'synth') {
          const nodes = scheduleSynthClip(ctx, pitchNode.input, clip.synthConfig.instrument, clip.startTime, clip.duration, startOffset);
          activeSourcesRef.current[clip.id] = nodes;
        }
      });

      // Legacy Oscillator
      if (t.type === 'osc') {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(t.hz, ctx.currentTime);
        osc.connect(pitchNode.input);
        osc.start(0);
        oscNodesRef.current[t.id] = osc;
      }
    });

    setIsPlaying(true);

    timelineTimerRef.current = setInterval(() => {
      const elapsed = ctx.currentTime - playbackStartTimeRef.current;
      if (elapsed >= timelineDuration) {
        stopAll();
      } else {
        setCurrentTime(elapsed);
      }
    }, 50);
  };

  const pauseAll = () => {
    if (!isPlaying) return;
    clearInterval(timelineTimerRef.current);
    pausedTimeRef.current = currentTime;
    
    tracks.forEach(t => {
      t.clips?.forEach(c => {
        if (activeSourcesRef.current[c.id]) {
          const nodes = activeSourcesRef.current[c.id];
          if (Array.isArray(nodes)) {
            nodes.forEach(n => { try { n.stop(); } catch(e){} });
          } else {
            try { nodes.stop(); } catch(e){}
          }
          delete activeSourcesRef.current[c.id];
        }
      });
      if (oscNodesRef.current[t.id]) {
        try { oscNodesRef.current[t.id].stop(); } catch(e){}
        delete oscNodesRef.current[t.id];
      }
    });

    trackFiltersRef.current = {};
    trackDelaysRef.current = {};
    trackDelayFeedbacksRef.current = {};
    trackDistortionsRef.current = {};
    setIsPlaying(false);
  };

  const stopAll = () => {
    clearInterval(timelineTimerRef.current);
    
    tracks.forEach(t => {
      t.clips?.forEach(c => {
        if (activeSourcesRef.current[c.id]) {
          const nodes = activeSourcesRef.current[c.id];
          if (Array.isArray(nodes)) {
            nodes.forEach(n => { try { n.stop(); } catch(e){} });
          } else {
            try { nodes.stop(); } catch(e){}
          }
          delete activeSourcesRef.current[c.id];
        }
      });
      if (oscNodesRef.current[t.id]) {
        try { oscNodesRef.current[t.id].stop(); } catch(e){}
        delete oscNodesRef.current[t.id];
      }
    });

    trackFiltersRef.current = {};
    trackDelaysRef.current = {};
    trackDelayFeedbacksRef.current = {};
    trackDistortionsRef.current = {};

    pausedTimeRef.current = 0;
    setCurrentTime(0);
    setIsPlaying(false);
  };

  // --- Local Audio Loader ---
  const handleFileUpload = (trackId, file) => {
    if (!file) return;
    const ctx = getAudioContext();
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target.result;
        const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);
        const newClip = {
          id: 'clip_' + Date.now(),
          buffer: decodedBuffer,
          name: file.name,
          startTime: 0,
          duration: decodedBuffer.duration,
          offset: 0,
          type: 'audio'
        };

        setTracks(prev => prev.map(t => {
          if (t.id === trackId) {
            return { ...t, clips: [...t.clips, newClip], filename: file.name };
          }
          return t;
        }));
      } catch (err) {
        console.error("Audio decode error:", err);
        alert("Failed to decode audio file. Make sure it is a valid MP3/WAV file.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // --- Database Backing Track URL Loader ---
  const importSongFromUrl = async (trackId, song) => {
    setIsLibraryOpen(false);
    const ctx = getAudioContext();
    try {
      const response = await fetch(song.audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);
      const newClip = {
        id: 'clip_' + Date.now(),
        buffer: decodedBuffer,
        name: song.title,
        startTime: 0,
        duration: decodedBuffer.duration,
        offset: 0,
        type: 'audio'
      };
      
      setTracks(prev => prev.map(t => {
        if (t.id === trackId) {
          return { ...t, clips: [...t.clips, newClip], filename: song.title };
        }
        return t;
      }));
    } catch(err) {
      console.error("Failed to fetch and decode library audio:", err);
      alert("Failed to load select song buffer. Check network status.");
    }
  };

  const importSynthClip = (trackId, instrumentName) => {
    setIsLibraryOpen(false);
    
    let clipName = '';
    if (instrumentName === 'drums') clipName = 'Muladhara Grounding Drum Beat';
    else if (instrumentName === 'bass') clipName = 'Solfeggio Sub-Bass (528Hz)';
    else if (instrumentName === 'pads') clipName = 'Anahata Ethereal Pads';
    else if (instrumentName === 'chimes') clipName = 'Ajna Solar Lead Chimes';

    const newClip = {
      id: 'synth_' + Date.now(),
      buffer: null,
      name: clipName,
      startTime: 0,
      duration: 10.0,
      offset: 0,
      type: 'synth',
      synthConfig: { instrument: instrumentName }
    };

    setTracks(prev => prev.map(t => {
      if (t.id === trackId) {
        return {
          ...t,
          clips: [...t.clips, newClip]
        };
      }
      return t;
    }));
  };

  // --- Microphone Recording directly to timeline track ---
  const handleToggleRecord = async (trackId) => {
    const track = tracks.find(t => t.id === trackId);
    if (!track) return;

    if (track.isRecording) {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(tr => tr.stop());
      }
      setTracks(prev => prev.map(t => t.id === trackId ? { ...t, isRecording: false } : t));
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        streamRef.current = stream;
        recChunksRef.current = [];

        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) recChunksRef.current.push(event.data);
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(recChunksRef.current, { type: 'audio/wav' });
          const reader = new FileReader();

          reader.onload = async (e) => {
            const ctx = getAudioContext();
            const decoded = await ctx.decodeAudioData(e.target.result);
            const newClip = {
              id: 'clip_rec_' + Date.now(),
              buffer: decoded,
              name: `VocalCapture_${Date.now()}.wav`,
              startTime: 0,
              duration: decoded.duration,
              offset: 0,
              type: 'audio'
            };
            
            setTracks(prev => prev.map(t => {
              if (t.id === trackId) {
                return { ...t, clips: [...t.clips, newClip], filename: `VocalCapture_${Date.now()}.wav` };
              }
              return t;
            }));
          };
          reader.readAsArrayBuffer(audioBlob);
        };

        mediaRecorder.start();
        setTracks(prev => prev.map(t => t.id === trackId ? { ...t, isRecording: true } : t));
      } catch (err) {
        console.error("Mic DAW input fail:", err);
        alert("Could not initialize microphone. Please check system permissions.");
      }
    }
  };

  // --- Sound Forge Offline Mixdown Suite ---
  const initiateMixdown = async () => {
    if (isPlaying) stopAll();
    setIsMixdownRunning(true);
    setMixdownProgress(10);

    const length = timelineDuration;
    const sampleRate = 44100;
    const renderDuration = length;

    try {
      const OfflineCtxClass = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      const offlineCtx = new OfflineCtxClass(2, sampleRate * renderDuration, sampleRate);

      const limiter = offlineCtx.createDynamicsCompressor();
      limiter.threshold.setValueAtTime(limiterActive ? -1.0 : -0.1, offlineCtx.currentTime);
      limiter.knee.setValueAtTime(30, offlineCtx.currentTime);
      limiter.ratio.setValueAtTime(12, offlineCtx.currentTime);
      limiter.attack.setValueAtTime(0.003, offlineCtx.currentTime);
      limiter.release.setValueAtTime(0.08, offlineCtx.currentTime);
      limiter.connect(offlineCtx.destination);

      const offlineBass = offlineCtx.createBiquadFilter();
      offlineBass.type = 'lowshelf';
      offlineBass.frequency.setValueAtTime(100, offlineCtx.currentTime);
      offlineBass.gain.setValueAtTime(eqBass, offlineCtx.currentTime);

      const offlineMid = offlineCtx.createBiquadFilter();
      offlineMid.type = 'peaking';
      offlineMid.frequency.setValueAtTime(1000, offlineCtx.currentTime);
      offlineMid.Q.setValueAtTime(1.0, offlineCtx.currentTime);
      offlineMid.gain.setValueAtTime(eqMid, offlineCtx.currentTime);

      const offlineTreble = offlineCtx.createBiquadFilter();
      offlineTreble.type = 'highshelf';
      offlineTreble.frequency.setValueAtTime(8000, offlineCtx.currentTime);
      offlineTreble.gain.setValueAtTime(eqTreble, offlineCtx.currentTime);

      offlineBass.connect(offlineMid);
      offlineMid.connect(offlineTreble);
      offlineTreble.connect(limiter);

      setMixdownProgress(40);

      tracks.forEach(t => {
        const hasAnySolo = tracks.some(tr => tr.solo);
        let trackGain = (t.volume / 100);
        if (t.mute || (hasAnySolo && !t.solo)) trackGain = 0;

        const gainNode = offlineCtx.createGain();
        gainNode.gain.setValueAtTime(trackGain, offlineCtx.currentTime);

        const pannerNode = offlineCtx.createStereoPanner ? offlineCtx.createStereoPanner() : offlineCtx.createGain();
        if (pannerNode.pan) pannerNode.pan.setValueAtTime(t.pan, offlineCtx.currentTime);

        const filterNode = offlineCtx.createBiquadFilter();
        filterNode.type = t.fxFilterType || 'lowpass';
        filterNode.frequency.setValueAtTime(t.fxFilterCutoff || 1500, offlineCtx.currentTime);

        const distortionNode = offlineCtx.createWaveShaper();
        if (t.fxDistortion > 0) {
          distortionNode.curve = makeDistortionCurve(t.fxDistortion);
          distortionNode.oversample = '4x';
        }

        const delayNode = offlineCtx.createDelay(1.0);
        delayNode.delayTime.setValueAtTime(t.fxDelayTime || 0.0, offlineCtx.currentTime);
        
        const delayFeedbackNode = offlineCtx.createGain();
        delayFeedbackNode.gain.setValueAtTime((t.fxDelayFeedback || 0) / 100, offlineCtx.currentTime);

        delayNode.connect(delayFeedbackNode);
        delayFeedbackNode.connect(delayNode);

        const pitchRatio = Math.pow(2, (t.fxPitchShift || 0) / 12);
        const pitchNode = createPitchShifterNode(offlineCtx, pitchRatio);

        pitchNode.output.connect(filterNode);
        filterNode.connect(distortionNode);
        distortionNode.connect(gainNode);
        distortionNode.connect(delayNode);
        delayNode.connect(gainNode);
        gainNode.connect(pannerNode);
        pannerNode.connect(offlineBass);

        t.clips?.forEach(clip => {
          if (clip.buffer) {
            const source = offlineCtx.createBufferSource();
            source.buffer = clip.buffer;
            source.connect(pitchNode.input);
            source.start(clip.startTime, clip.offset, clip.duration);
          } else if (clip.type === 'synth') {
            scheduleSynthClip(offlineCtx, pitchNode.input, clip.synthConfig.instrument, clip.startTime, clip.duration, 0);
          }
        });
      });

      setMixdownProgress(60);

      // Inject Master Solfeggio Drone directly into finalized mixdown
      if (selectedResonance) {
        const droneGain = offlineCtx.createGain();
        droneGain.gain.setValueAtTime(0.04, offlineCtx.currentTime); // Subtle resonance
        
        const droneLeft = offlineCtx.createOscillator();
        const droneRight = offlineCtx.createOscillator();
        droneLeft.type = droneRight.type = 'sine';
        droneLeft.frequency.setValueAtTime(selectedResonance, offlineCtx.currentTime);
        droneRight.frequency.setValueAtTime(selectedResonance + 8, offlineCtx.currentTime); // Binaural offset
        
        const merger = offlineCtx.createChannelMerger(2);
        droneLeft.connect(merger, 0, 0);
        droneRight.connect(merger, 0, 1);
        
        merger.connect(droneGain);
        droneGain.connect(offlineBass);

        droneLeft.start(0);
        droneRight.start(0);
        droneLeft.stop(renderDuration);
        droneRight.stop(renderDuration);
      }

      setMixdownProgress(80);

      // Run rendering
      const renderedBuffer = await offlineCtx.startRendering();
      
      // Encode to WAV and trigger download
      const wavBlob = encodeWAV(renderedBuffer);
      const downloadUrl = URL.createObjectURL(wavBlob);
      
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `Ariyus-Studio-Master-${selectedResonance}Hz.wav`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setMixdownProgress(100);
      setTimeout(() => {
        setIsMixdownRunning(false);
        setMixdownProgress(0);
        alert('Master multi-track file rendered and encoded as WAV successfully!');
      }, 1000);

    } catch (e) {
      console.error("Master mixdown compilation failed:", e);
      setIsMixdownRunning(false);
      alert("Mixdown rendering error occurred.");
    }
  };

  // --- locked Free Screen ---
  if (!isPaidUser) {
    return (
      <div className="screen-wrapper" style={{ display: 'grid', placeItems: 'center', height: '80vh' }}>
        <div className="glass-panel" style={{ maxWidth: '500px', textAlign: 'center', borderColor: 'var(--secondary-glow)', boxShadow: '0 0 25px rgba(255,0,193,0.25)' }}>
          <h2 style={{ textShadow: '0 0 10px var(--secondary-glow)', justifyContent: 'center' }}>
            🔒 Ariyus Studio DAW Workstation
          </h2>
          <p style={{ color: 'var(--text-dim)', fontSize: '1rem', lineHeight: '1.6', margin: '20px 0' }}>
            Unlock our premium, web-based multi-track DAW recording workspace! Personally drag and drop instrumentals, record custom vocal takes in sync, edit pans/faders, and run Sound Forge mastering exports.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', textAlign: 'left', fontSize: '0.85rem', marginBottom: '25px', background: 'rgba(0,0,0,0.15)', padding: '15px', borderRadius: '8px' }}>
            <div>🔊 Synchronized Playback</div>
            <div>🎙 Multi-Track Recording</div>
            <div>🎚 Sony Vegas Faders</div>
            <div>⚡ Sound Forge Mixdown</div>
          </div>
          <button className="glowing-button secondary" onClick={() => navigate('Upgrade')} style={{ margin: 0, width: '100%', padding: '12px' }}>
            Upgrade Membership Plan
          </button>
        </div>
      </div>
    );
  }

  // --- Render Workstation UI ---
  const playheadPercent = (currentTime / timelineDuration) * 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h2 style={{ textShadow: '0 0 10px var(--primary-glow)', margin: 0 }}>Ariyus Studio DAW</h2>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', margin: '4px 0 0' }}>Professional multi-track mixing console and mastering suite</p>
        </div>
        <button className="glowing-button secondary" onClick={initiateMixdown} disabled={isMixdownRunning} style={{ margin: 0 }}>
          {isMixdownRunning ? `Mixdown Rendering (${mixdownProgress}%)` : '⚡ Sound Forge Mixdown Master'}
        </button>
      </div>

      {/* Main DAW workspace container */}
      <div className="daw-workspace">
        
        {/* Transport controls bar */}
        <div className="daw-transport-bar">
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button className="daw-track-btn" onClick={playAll} style={{ color: '#00ff87', borderColor: '#00ff87' }}>▶ Play All</button>
            <button className="daw-track-btn" onClick={pauseAll}>⏸ Pause</button>
            <button className="daw-track-btn" onClick={stopAll}>⏹ Stop</button>
          </div>

          <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Master volume fader */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-dim)' }}>Master Out:</span>
              <input 
                type="range" 
                min="0" max="100" 
                value={masterVolume} 
                onChange={e => setMasterVolume(parseInt(e.target.value))} 
                className="slider-input" 
                style={{ width: '120px', height: '6px' }} 
              />
              <span style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>{masterVolume}%</span>
            </div>

            {/* Limiter Toggle */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Limiter:</span>
              <button 
                className={`daw-track-btn ${limiterActive ? 'active solo' : ''}`}
                onClick={() => setLimiterActive(!limiterActive)}
                style={{ fontSize: '0.65rem', padding: '2px 6px' }}
              >
                {limiterActive ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* Master EQ Console */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', background: 'rgba(255, 255, 255, 0.04)', padding: '5px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--primary-glow)', fontWeight: 'bold' }}>Master EQ:</span>
              
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>Chest (Bass):</span>
                <input 
                  type="range" 
                  min="-12" max="12" step="0.5"
                  value={eqBass} 
                  onChange={e => setEqBass(parseFloat(e.target.value))} 
                  className="slider-input" 
                  style={{ width: '60px', height: '4px' }} 
                />
                <span style={{ fontSize: '0.65rem', fontFamily: 'monospace', width: '38px', textAlign: 'right' }}>{eqBass > 0 ? `+${eqBass}` : eqBass}dB</span>
              </div>

              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>Heart (Mid):</span>
                <input 
                  type="range" 
                  min="-12" max="12" step="0.5"
                  value={eqMid} 
                  onChange={e => setEqMid(parseFloat(e.target.value))} 
                  className="slider-input" 
                  style={{ width: '60px', height: '4px' }} 
                />
                <span style={{ fontSize: '0.65rem', fontFamily: 'monospace', width: '38px', textAlign: 'right' }}>{eqMid > 0 ? `+${eqMid}` : eqMid}dB</span>
              </div>

              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>Throat (Treb):</span>
                <input 
                  type="range" 
                  min="-12" max="12" step="0.5"
                  value={eqTreble} 
                  onChange={e => setEqTreble(parseFloat(e.target.value))} 
                  className="slider-input" 
                  style={{ width: '60px', height: '4px' }} 
                />
                <span style={{ fontSize: '0.65rem', fontFamily: 'monospace', width: '38px', textAlign: 'right' }}>{eqTreble > 0 ? `+${eqTreble}` : eqTreble}dB</span>
              </div>
            </div>

            {/* Solfeggio Resonance overlay */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Mix Resonator:</span>
              <select 
                value={selectedResonance}
                onChange={e => setSelectedResonance(parseInt(e.target.value))}
                className="glass-input" 
                style={{ width: '100px', padding: '4px 8px', margin: 0, fontSize: '0.75rem', height: '28px' }}
              >
                <option value={0}>None</option>
                <option value={396}>396 Hz</option>
                <option value={417}>417 Hz</option>
                <option value={432}>432 Hz</option>
                <option value={528}>528 Hz</option>
                <option value={639}>639 Hz</option>
                <option value={741}>741 Hz</option>
                <option value={852}>852 Hz</option>
              </select>
            </div>
          </div>
        </div>

        {/* Editing Tools Bar */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '8px 12px', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Edit Tools:</span>
          <button 
            className={`daw-track-btn ${activeTool === 'select' ? 'active solo' : ''}`}
            onClick={() => setActiveTool('select')}
            style={{ fontSize: '0.7rem', padding: '4px 10px' }}
          >
            🖱 Select & Drag Clip
          </button>
          <button 
            className={`daw-track-btn ${activeTool === 'slice' ? 'active rec' : ''}`}
            onClick={() => setActiveTool('slice')}
            style={{ fontSize: '0.7rem', padding: '4px 10px' }}
          >
            ✂ Split / Slice Clip
          </button>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginLeft: '15px' }}>
            {activeTool === 'select' ? 'Drag clips horizontally to re-align timing.' : 'Click inside any clip to slice it into two segments.'}
          </span>
        </div>

        {/* Timeline Grid container */}
        <div className="daw-timeline-container">
          
          {/* Time Ruler */}
          <div className="daw-timeline-ruler">
            {Array.from({ length: Math.ceil(timelineDuration / 5) + 1 }).map((_, i) => (
              <div key={i} className="daw-ruler-marker" style={{ width: '250px' }}>
                {(i * 5).toFixed(1)}s
              </div>
            ))}
          </div>

          {/* Tracks vertically stacked */}
          {tracks.map(t => (
            <div key={t.id} className="daw-track-row">
              
              {/* Track Left controls */}
              <div className="daw-track-controls">
                <div className="daw-track-controls-header">
                  <strong>{t.name}</strong>
                  {t.type === 'vocal' && (
                    <button 
                      className={`daw-track-btn ${t.isRecording ? 'active rec' : ''}`}
                      onClick={() => handleToggleRecord(t.id)}
                      style={{ fontSize: '0.65rem', padding: '2px 6px' }}
                    >
                      {t.isRecording ? '● REC' : '🎙 Record'}
                    </button>
                  )}
                </div>

                {/* Mute and Solo */}
                <div className="daw-track-buttons-row" style={{ flexWrap: 'wrap', gap: '5px' }}>
                  <button 
                    className={`daw-track-btn ${t.mute ? 'active mute' : ''}`}
                    onClick={() => setTracks(prev => prev.map(tr => tr.id === t.id ? { ...tr, mute: !tr.mute } : tr))}
                  >
                    Mute
                  </button>
                  <button 
                    className={`daw-track-btn ${t.solo ? 'active solo' : ''}`}
                    onClick={() => setTracks(prev => prev.map(tr => tr.id === t.id ? { ...tr, solo: !tr.solo } : tr))}
                  >
                    Solo
                  </button>
                  {t.type !== 'osc' && (
                    <>
                      <label className="daw-track-btn" style={{ padding: '3px 8px', display: 'inline-block' }}>
                        Import
                        <input 
                          type="file" 
                          accept="audio/*" 
                          onChange={e => handleFileUpload(t.id, e.target.files[0])}
                          style={{ display: 'none' }} 
                        />
                      </label>
                      <button 
                        className="daw-track-btn"
                        onClick={() => {
                          setTargetTrackId(t.id);
                          setIsLibraryOpen(true);
                        }}
                      >
                        📁 Lib
                      </button>
                    </>
                  )}
                  <button 
                    className={`daw-track-btn ${t.fxExpanded ? 'active solo' : ''}`}
                    onClick={() => setTracks(prev => prev.map(tr => tr.id === t.id ? { ...tr, fxExpanded: !tr.fxExpanded } : tr))}
                  >
                    ✦ FX
                  </button>
                </div>

                {/* Volume Fader */}
                <div className="daw-track-slider-group">
                  <label>Vol</label>
                  <input 
                    type="range" 
                    min="0" max="100" 
                    value={t.volume} 
                    onChange={e => setTracks(prev => prev.map(tr => tr.id === t.id ? { ...tr, volume: parseInt(e.target.value) } : tr))}
                    className="slider-input" 
                    style={{ height: '5px' }}
                  />
                  <span style={{ fontSize: '0.65rem', fontFamily: 'monospace', width: '25px' }}>{t.volume}%</span>
                </div>

                {/* Pan Slider */}
                <div className="daw-track-slider-group" style={{ marginBottom: t.fxExpanded ? '8px' : '0' }}>
                  <label>Pan</label>
                  <input 
                    type="range" 
                    min="-100" max="100" 
                    value={t.pan * 100} 
                    onChange={e => setTracks(prev => prev.map(tr => tr.id === t.id ? { ...tr, pan: parseInt(e.target.value) / 100 } : tr))}
                    className="slider-input" 
                    style={{ height: '5px' }}
                  />
                  <span style={{ fontSize: '0.65rem', fontFamily: 'monospace', width: '25px' }}>
                    {t.pan === 0 ? 'C' : t.pan > 0 ? `R${Math.round(t.pan * 10)}` : `L${Math.round(Math.abs(t.pan) * 10)}`}
                  </span>
                </div>

                {/* Track-level insert FX panel */}
                {t.fxExpanded && (
                  <div style={{ marginTop: '10px', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                    <strong style={{ fontSize: '0.72rem', color: 'var(--primary-glow)', textTransform: 'uppercase' }}>✦ FX Inserts</strong>
                    
                    {/* Delay */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-dim)' }}>
                        <span>Echo Delay:</span>
                        <span>{t.fxDelayTime.toFixed(2)}s</span>
                      </div>
                      <input 
                        type="range" min="0" max="1" step="0.05" value={t.fxDelayTime} 
                        onChange={e => setTracks(prev => prev.map(tr => tr.id === t.id ? { ...tr, fxDelayTime: parseFloat(e.target.value) } : tr))}
                        className="slider-input"
                        style={{ height: '3px' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-dim)' }}>
                        <span>Echo Feedback:</span>
                        <span>{t.fxDelayFeedback}%</span>
                      </div>
                      <input 
                        type="range" min="0" max="90" step="5" value={t.fxDelayFeedback} 
                        onChange={e => setTracks(prev => prev.map(tr => tr.id === t.id ? { ...tr, fxDelayFeedback: parseInt(e.target.value) } : tr))}
                        className="slider-input"
                        style={{ height: '3px' }}
                      />
                    </div>

                    {/* Filter */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-dim)' }}>
                        <span>Filter Cutoff:</span>
                        <span>{t.fxFilterCutoff}Hz</span>
                      </div>
                      <input 
                        type="range" min="100" max="8000" step="100" value={t.fxFilterCutoff} 
                        onChange={e => setTracks(prev => prev.map(tr => tr.id === t.id ? { ...tr, fxFilterCutoff: parseInt(e.target.value) } : tr))}
                        className="slider-input"
                        style={{ height: '3px' }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '5px', alignItems: 'center', fontSize: '0.65rem' }}>
                      <span style={{ color: 'var(--text-dim)' }}>Type:</span>
                      <button 
                        className={`daw-track-btn ${t.fxFilterType === 'lowpass' ? 'active solo' : ''}`}
                        style={{ fontSize: '0.6rem', padding: '1px 4px' }}
                        onClick={() => setTracks(prev => prev.map(tr => tr.id === t.id ? { ...tr, fxFilterType: 'lowpass' } : tr))}
                      >LPF</button>
                      <button 
                        className={`daw-track-btn ${t.fxFilterType === 'highpass' ? 'active solo' : ''}`}
                        style={{ fontSize: '0.6rem', padding: '1px 4px' }}
                        onClick={() => setTracks(prev => prev.map(tr => tr.id === t.id ? { ...tr, fxFilterType: 'highpass' } : tr))}
                      >HPF</button>
                    </div>

                    {/* Tube Saturation */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-dim)' }}>
                        <span>Tube Drive:</span>
                        <span>{t.fxDistortion}</span>
                      </div>
                      <input 
                        type="range" min="0" max="80" step="5" value={t.fxDistortion} 
                        onChange={e => setTracks(prev => prev.map(tr => tr.id === t.id ? { ...tr, fxDistortion: parseInt(e.target.value) } : tr))}
                        className="slider-input"
                        style={{ height: '3px' }}
                      />
                    </div>

                    {/* Vocal Key Shift */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-dim)' }}>
                        <span>Vocal Key Shift:</span>
                        <span>{t.fxPitchShift > 0 ? `+${t.fxPitchShift}` : t.fxPitchShift} semitones</span>
                      </div>
                      <input 
                        type="range" min="-12" max="12" step="1" value={t.fxPitchShift || 0} 
                        onChange={e => setTracks(prev => prev.map(tr => tr.id === t.id ? { ...tr, fxPitchShift: parseInt(e.target.value) } : tr))}
                        className="slider-input"
                        style={{ height: '3px' }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Track Right Timeline Waveform */}
              <div 
                className="daw-track-timeline"
                onMouseDown={(e) => handleCanvasMouseDown(t.id, e)}
                onMouseMove={(e) => handleCanvasMouseMove(t.id, e)}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
              >
                {/* Visual Canvas */}
                <canvas 
                  ref={el => { canvasRefs.current[t.id] = el; }} 
                  style={{ width: '100%', height: '100%' }} 
                />
                
                {/* Waveform Label */}
                <div style={{ position: 'absolute', bottom: '8px', left: '12px', fontSize: '0.7rem', color: 'var(--text-dim)', background: 'rgba(0,0,0,0.6)', padding: '2px 6px', borderRadius: '4px' }}>
                  {t.filename || 'Timeline Grid (Empty Track Node)'}
                </div>

                {/* Playhead */}
                {isPlaying && (
                  <div className="daw-playhead" style={{ left: `${playheadPercent}%` }} />
                )}
              </div>

            </div>
          ))}

        </div>
      </div>

      {/* Backing Instrumental library modal drawer */}
      {isLibraryOpen && (
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
          <div className="glass-panel" style={{ maxWidth: '500px', width: '100%', borderColor: 'var(--primary-glow)' }}>
            <h3 style={{ margin: '0 0 5px 0' }}>Sound & Instrument Database</h3>
            
            {/* Library Tabs */}
            <div style={{ display: 'flex', gap: '5px', margin: '12px 0 15px 0', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px' }}>
              <button 
                className={`daw-track-btn ${libraryTab === 'cover' ? 'active solo' : ''}`}
                onClick={() => setLibraryTab('cover')}
                style={{ fontSize: '0.75rem', padding: '5px 12px' }}
              >
                Cover Backing Tracks
              </button>
              <button 
                className={`daw-track-btn ${libraryTab === 'synth' ? 'active rec' : ''}`}
                onClick={() => setLibraryTab('synth')}
                style={{ fontSize: '0.75rem', padding: '5px 12px' }}
              >
                ACID Synth Loops
              </button>
            </div>

            {libraryTab === 'cover' ? (
              <>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', margin: '0 0 10px 0' }}>Select a cover track from the library catalog to import onto the DAW timeline.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '260px', overflowY: 'auto' }}>
                  {librarySongs.map(song => (
                    <div 
                      key={song.id} 
                      className="glass-panel" 
                      style={{ margin: 0, background: 'rgba(255,255,255,0.02)', padding: '10px 15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                      onClick={() => importSongFromUrl(targetTrackId, song)}
                    >
                      <div>
                        <b style={{ color: '#fff', fontSize: '0.9rem' }}>{song.title}</b>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>{song.artist}</div>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--primary-glow)', fontWeight: 'bold' }}>Import →</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', margin: '0 0 10px 0' }}>Insert custom synthesized loops generated in real-time by the Web Audio matrix.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '260px', overflowY: 'auto' }}>
                  {[
                    { id: 'drums', name: 'Muladhara Grounding Drum Beat', desc: 'Synthesized TR-808 style organic kicks and noise snares.' },
                    { id: 'bass', name: 'Solfeggio Sub-Bass (528Hz)', desc: 'Pulsating deep sub-bass line matching target scale frequency.' },
                    { id: 'pads', name: 'Anahata Ethereal Pads', desc: 'Warm chord sweeps to elevate vocal warmth and cohesion.' },
                    { id: 'chimes', name: 'Ajna Solar Lead Chimes', desc: 'Bell-like arpeggiating chimes to stimulate clarity.' }
                  ].map(synth => (
                    <div 
                      key={synth.id} 
                      className="glass-panel" 
                      style={{ margin: 0, background: 'rgba(255,255,255,0.02)', padding: '10px 15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                      onClick={() => importSynthClip(targetTrackId, synth.id)}
                    >
                      <div>
                        <b style={{ color: '#00ff87', fontSize: '0.9rem' }}>{synth.name}</b>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>{synth.desc}</div>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: '#00ff87', fontWeight: 'bold' }}>Generate +</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            
            <button className="glowing-button" onClick={() => setIsLibraryOpen(false)} style={{ width: '100%', marginTop: '15px', marginBottom: 0 }}>Close Library</button>
          </div>
        </div>
      )}

    </div>
  );
};

export default WorkstationScreen;
