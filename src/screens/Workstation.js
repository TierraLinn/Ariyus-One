import React, { useState, useEffect, useRef } from 'react';
import { getPitchShiftRatioForFrequency, createPitchShifterNode } from '../utils/vocalDSP';

// Waveform helper to draw a pseudo-waveform on a canvas
const drawWaveform = (canvas, color, seed, startOffset, isMuted, isRecorded) => {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width = canvas.parentElement ? (canvas.parentElement.clientWidth || 300) : 300;
  const h = canvas.height = 80;

  ctx.clearRect(0, 0, w, h);
  
  if (isMuted) {
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
    return;
  }

  // Draw background grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 30) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }

  // Draw recorded vocal layer
  if (isRecorded) {
    ctx.strokeStyle = '#ff4d4d'; // coral-red vocal indicators
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);

    const pointsCount = w;
    for (let i = 0; i < pointsCount; i++) {
      const angle = (i * 0.12) + seed;
      let factor = Math.sin(angle * 0.8) * Math.sin(angle * 3.5) * Math.cos(angle * 0.3);
      if (i % 5 === 0) factor += (Math.random() - 0.5) * 0.15; // speech fluctuation dynamics
      const envelope = Math.sin((i / pointsCount) * Math.PI);
      const y = h / 2 + factor * 30 * envelope;
      ctx.lineTo(i, y);
    }
    ctx.stroke();
    return;
  }

  // Draw standard track waves
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, h / 2);

  const pointsCount = w;
  for (let i = 0; i < pointsCount; i++) {
    const angle = (i * 0.05) + seed;
    const factor = Math.sin(angle * 0.4) * Math.cos(angle * 1.5);
    const envelope = Math.sin((i / pointsCount) * Math.PI); // fade in/out
    const y = h / 2 + factor * 25 * envelope * (Math.sin(angle * 4 + startOffset) * 0.5 + 0.5);
    ctx.lineTo(i, y);
  }
  ctx.stroke();
};

const Workstation = ({ navigate, userData, currentRecording }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [projectDuration] = useState(20); // 20-second timeline duration
  const [selectedTrackIndex, setSelectedTrackIndex] = useState(0);
  const [selectedFreq, setSelectedFreq] = useState(528); // Default Miracle hertz calibration
  const [showEffectsModal, setShowEffectsModal] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Tracks State Configuration
  const [tracks, setTracks] = useState([
    {
      id: 't1',
      name: 'Vocal Melody (Lead)',
      type: 'vocal',
      color: 'var(--primary-glow)',
      volume: 85,
      pan: -0.2,
      isMuted: false,
      isSolo: false,
      startOffset: 0.5, // start offset in seconds
      clipDuration: 15,
      effects: { pitchShift: 0, filterCutoff: 1000, filterType: 'none', reverb: 30, delayTime: 0.3, delayFeedback: 40, saturation: 10 }
    },
    {
      id: 't2',
      name: 'Vocal Overlay (Harmony)',
      type: 'vocal',
      color: 'var(--tertiary-glow)',
      volume: 70,
      pan: 0.3,
      isMuted: false,
      isSolo: false,
      startOffset: 2.0,
      clipDuration: 13,
      effects: { pitchShift: 4, filterCutoff: 1200, filterType: 'none', reverb: 50, delayTime: 0.4, delayFeedback: 30, saturation: 5 }
    },
    {
      id: 't3',
      name: 'Backing Instrumental Beat',
      type: 'backing',
      color: '#00ff87',
      volume: 65,
      pan: 0.0,
      isMuted: false,
      isSolo: false,
      startOffset: 0.0,
      clipDuration: 20,
      effects: { pitchShift: 0, filterCutoff: 2000, filterType: 'none', reverb: 15, delayTime: 0.0, delayFeedback: 0, saturation: 0 }
    },
    {
      id: 't4',
      name: 'Solfeggio Choir Drone',
      type: 'drone',
      color: 'var(--secondary-glow)',
      volume: 45,
      pan: -0.4,
      isMuted: false,
      isSolo: false,
      startOffset: 0.0,
      clipDuration: 20,
      effects: { pitchShift: 0, filterCutoff: 800, filterType: 'lowpass', reverb: 80, delayTime: 0.5, delayFeedback: 50, saturation: 15 }
    },
    {
      id: 't5',
      name: 'Space Dust SFX Pad',
      type: 'sfx',
      color: '#ffb700',
      volume: 40,
      pan: 0.4,
      isMuted: false,
      isSolo: false,
      startOffset: 3.5,
      clipDuration: 14.5,
      effects: { pitchShift: -12, filterCutoff: 1500, filterType: 'none', reverb: 90, delayTime: 0.6, delayFeedback: 60, saturation: 20 }
    }
  ]);

  // Master console controls
  const [masterVolume, setMasterVolume] = useState(80);
  const [masterEQ, setMasterEQ] = useState({ chest: 0, heart: 0, throat: 0 }); // dB gains
  const [masterLimiter, setMasterLimiter] = useState(-1.5); // Limiter threshold dB
  const [schumannLfo, setSchumannLfo] = useState(false); // Earth Resonance 7.83Hz LFO

  // ACID Synth Loops enables
  const [synths, setSynths] = useState({
    drums: false,
    pad: false,
    bass: false,
    chimes: false
  });

  // Web Audio Context & Refs
  const audioCtxRef = useRef(null);
  const playheadIntervalRef = useRef(null);
  const activeNodesRef = useRef([]); // Stores active oscillators/buffers for playback stopping

  // Canvas Refs for Waveforms
  const canvasRefs = useRef([]);

  // Multi-Track Recording state and refs
  const [armedTrackIndex, setArmedTrackIndex] = useState(-1); // -1 means none armed
  const [isRecordingMaster, setIsRecordingMaster] = useState(false);
  const mediaRecorderRef = useRef(null);
  const micStreamRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const recordStartPosRef = useRef(0);

  // Load current recording into timeline tracks on mount
  useEffect(() => {
    if (currentRecording) {
      setTracks(prev => prev.map(track => {
        if (track.id === 't1' && currentRecording.playbackUrl) {
          return {
            ...track,
            audioUrl: currentRecording.playbackUrl,
            name: `Lead Vocals - ${currentRecording.selectedSong?.title || 'Sing'}`,
            isRecorded: true,
            clipDuration: 15
          };
        }
        if (track.id === 't2' && currentRecording.partnerVocalUrl) {
          return {
            ...track,
            audioUrl: currentRecording.partnerVocalUrl,
            name: `Harmony - ${currentRecording.partnerName || 'Duet'}`
          };
        }
        if (track.id === 't3' && currentRecording.selectedSong?.audioUrl) {
          return {
            ...track,
            audioUrl: currentRecording.selectedSong.audioUrl,
            name: `Backing Track - ${currentRecording.selectedSong.title}`
          };
        }
        return track;
      }));
      
      // Auto-set matching Solfeggio frequency
      if (currentRecording.selectedSong?.title) {
        const title = currentRecording.selectedSong.title;
        if (title.includes('528')) setSelectedFreq(528);
        else if (title.includes('396')) setSelectedFreq(396);
        else if (title.includes('417')) setSelectedFreq(417);
        else if (title.includes('639')) setSelectedFreq(639);
        else if (title.includes('741')) setSelectedFreq(741);
        else if (title.includes('852')) setSelectedFreq(852);
        else if (title.includes('963')) setSelectedFreq(963);
      }
    }
  }, [currentRecording]);

  // Draw Waveforms on change of startOffset or mute status
  useEffect(() => {
    tracks.forEach((track, index) => {
      drawWaveform(
        canvasRefs.current[index],
        track.color,
        index * 25,
        track.startOffset,
        track.isMuted,
        track.isRecorded
      );
    });
  }, [tracks]);

  // Start recording engine
  const startRecordingEngine = async () => {
    if (armedTrackIndex < 0) {
      alert("Please arm a track for recording by clicking its Record Arm (R) button first.");
      return;
    }

    try {
      initAudioContext();
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      // Track exact position on timeline where we started recording
      recordStartPosRef.current = playbackTime;
      recordedChunksRef.current = [];

      // Create MediaRecorder
      const options = { mimeType: 'audio/webm' };
      let recorder;
      try {
        recorder = new MediaRecorder(stream, options);
      } catch (e) {
        recorder = new MediaRecorder(stream);
      }
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(blob);
        const duration = playbackTime - recordStartPosRef.current;

        if (duration > 0.5) {
          // Update the armed track with the recorded audio clip details
          setTracks(prev => prev.map((t, idx) => {
            if (idx === armedTrackIndex) {
              return {
                ...t,
                audioUrl: audioUrl,
                clipDuration: duration,
                startOffset: recordStartPosRef.current,
                type: 'vocal', // Change type to vocal to play it back
                isRecorded: true // custom flag for styling and drawing
              };
            }
            return t;
          }));
        }
      };

      // Start recording chunks
      recorder.start(250);
      setIsRecordingMaster(true);
      setIsPlaying(true); // Start playback of other tracks concurrently!
    } catch (err) {
      console.error("Microphone capture failed:", err);
      alert("Failed to access microphone. Please check system permissions.");
    }
  };

  // Stop recording engine
  const stopRecordingEngine = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }
    setIsRecordingMaster(false);
    setIsPlaying(false);
  };

  // Handle Playback Loop
  useEffect(() => {
    if (isPlaying) {
      // Start scheduling loops
      initAudioEngine();
      const startTime = Date.now() - (playbackTime * 1000);
      playheadIntervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        if (elapsed >= projectDuration) {
          if (isRecordingMaster) {
            stopRecordingEngine();
          } else {
            stopAudio();
            setIsPlaying(false);
            setPlaybackTime(0);
          }
        } else {
          setPlaybackTime(elapsed);
        }
      }, 50);
    } else {
      clearInterval(playheadIntervalRef.current);
      if (isRecordingMaster) {
        stopRecordingEngine();
      } else {
        stopAudio();
      }
    }

    return () => {
      clearInterval(playheadIntervalRef.current);
      stopAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, isRecordingMaster]);

  // Helper to initialize the Audio Context
  const initAudioContext = () => {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      audioCtxRef.current = new AudioCtx();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  };

  // Stop all active audio nodes
  const stopAudio = () => {
    activeNodesRef.current.forEach(node => {
      try {
        node.stop();
      } catch (e) {}
    });
    activeNodesRef.current = [];
  };

  // Start real-time audio playback engines
  const initAudioEngine = () => {
    initAudioContext();
    stopAudio();

    const ctx = audioCtxRef.current;
    const now = ctx.currentTime;

    // Create master EQ and Limiter bus nodes
    const masterLimiterNode = ctx.createDynamicsCompressor ? ctx.createDynamicsCompressor() : ctx.createGain();
    if (ctx.createDynamicsCompressor) {
      masterLimiterNode.threshold.setValueAtTime(masterLimiter, now);
      masterLimiterNode.knee.setValueAtTime(0, now);
      masterLimiterNode.ratio.setValueAtTime(20, now);
      masterLimiterNode.attack.setValueAtTime(0.001, now);
      masterLimiterNode.release.setValueAtTime(0.05, now);
    }

    const masterEQNode1 = ctx.createBiquadFilter();
    masterEQNode1.type = 'lowshelf';
    masterEQNode1.frequency.setValueAtTime(100, now);
    masterEQNode1.gain.setValueAtTime(masterEQ.chest, now);

    const masterEQNode2 = ctx.createBiquadFilter();
    masterEQNode2.type = 'peaking';
    masterEQNode2.frequency.setValueAtTime(1000, now);
    masterEQNode2.Q.setValueAtTime(1.0, now);
    masterEQNode2.gain.setValueAtTime(masterEQ.heart, now);

    const masterEQNode3 = ctx.createBiquadFilter();
    masterEQNode3.type = 'highshelf';
    masterEQNode3.frequency.setValueAtTime(8000, now);
    masterEQNode3.gain.setValueAtTime(masterEQ.throat, now);

    // Chain EQ nodes into Limiter
    masterEQNode1.connect(masterEQNode2);
    masterEQNode2.connect(masterEQNode3);
    masterEQNode3.connect(masterLimiterNode);

    // Master target node is the input of the Master EQ chain
    const masterTargetNode = masterEQNode1;

    // Dynamic Earth Resonance Bus
    if (schumannLfo) {
      const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (panner) {
        const lfo = ctx.createOscillator();
        lfo.frequency.setValueAtTime(7.83, now); // Earth frequency (7.83 Hz)
        
        const lfoGain = ctx.createGain();
        lfoGain.gain.setValueAtTime(0.35, now);
        
        lfo.connect(lfoGain);
        lfoGain.connect(panner.pan);
        lfo.start(now);
        activeNodesRef.current.push(lfo);

        masterLimiterNode.connect(panner);
        panner.connect(ctx.destination);
      } else {
        masterLimiterNode.connect(ctx.destination);
      }
    } else {
      masterLimiterNode.connect(ctx.destination);
    }

    // Check if solo mode is active on any track
    const hasSolo = tracks.some(t => t.isSolo);

    // Build routes for each track
    tracks.forEach((track, idx) => {
      if (track.isMuted) return;
      if (hasSolo && !track.isSolo) return;

      const trackVolumeFraction = track.volume / 100;
      const startScheduled = Math.max(0, track.startOffset - playbackTime);
      const clipPlayedDuration = track.clipDuration - Math.max(0, playbackTime - track.startOffset);

      if (clipPlayedDuration <= 0 && track.type !== 'drone') return;

      // 1. Create source node based on track type
      let sourceNode;
      if (track.audioUrl) {
        // Create HTML5 Audio node from armed/recorded URL
        const audio = new Audio(track.audioUrl);
        audio.currentTime = Math.max(0, playbackTime - track.startOffset);

        const mediaSource = ctx.createMediaElementSource ? ctx.createMediaElementSource(audio) : null;
        if (mediaSource) {
          sourceNode = mediaSource;

          // Sync offset latency
          const delayMs = startScheduled * 1000;
          if (delayMs > 0) {
            const timeoutId = setTimeout(() => {
              if (audioCtxRef.current && audioCtxRef.current.state === 'running') {
                audio.play().catch(e => console.warn(e));
              }
            }, delayMs);
            activeNodesRef.current.push({
              stop: () => {
                clearTimeout(timeoutId);
                audio.pause();
                audio.src = '';
              }
            });
          } else {
            audio.play().catch(e => console.warn(e));
            activeNodesRef.current.push({
              stop: () => {
                audio.pause();
                audio.src = '';
              }
            });
          }
        }
      } else if (track.type === 'vocal' || track.type === 'backing' || track.type === 'sfx') {
        // Procedurally generate a simulated backing track or vocal wave
        const durationSec = Math.max(5, track.clipDuration);
        const sampleRate = ctx.sampleRate;
        const totalSamples = sampleRate * durationSec;
        const buffer = ctx.createBuffer(1, totalSamples, sampleRate);
        const data = buffer.getChannelData(0);

        // Fill buffer with nice harmonic frequencies
        const baseFreq = track.type === 'vocal' ? 220 : (track.type === 'backing' ? 80 : 440);
        for (let i = 0; i < totalSamples; i++) {
          const t = i / sampleRate;
          // Composite of sine waves plus low random noise for realistic waveform texture
          let sampleVal = Math.sin(2 * Math.PI * baseFreq * t) * 0.4;
          sampleVal += Math.sin(2 * Math.PI * (baseFreq * 1.5) * t) * 0.2;
          sampleVal += Math.sin(2 * Math.PI * (baseFreq * 0.5) * t) * 0.1;
          sampleVal += (Math.random() - 0.5) * 0.05; // noise
          
          // Apply fade-in and fade-out envelope
          if (t < 0.2) sampleVal *= (t / 0.2);
          if (t > durationSec - 0.2) sampleVal *= ((durationSec - t) / 0.2);

          data[i] = sampleVal;
        }

        const bufferSource = ctx.createBufferSource();
        bufferSource.buffer = buffer;
        
        // Compute offset inside buffer if we play halfway
        const bufferOffset = Math.max(0, playbackTime - track.startOffset);
        bufferSource.start(now + startScheduled, bufferOffset);
        sourceNode = bufferSource;
        activeNodesRef.current.push(bufferSource);
      } else if (track.type === 'drone') {
        // Solfeggio drone oscillator
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(selectedFreq / 4, now); // low octave drone
        
        // Add a slow LFO filter swept
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(400, now);
        
        osc.connect(filter);
        osc.start(now);
        sourceNode = osc;
        
        // Store reference to stop later
        activeNodesRef.current.push(osc);
      }

      if (!sourceNode) return;

      // 2. Routing Inserts (Volume, Panning, Reverb, Delay)
      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(trackVolumeFraction * (masterVolume / 100) * 0.15, now);

      const pannerNode = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (pannerNode) {
        pannerNode.pan.setValueAtTime(track.pan, now);
      }

      // Reverb Simulation (Convolver-like simple delay chain)
      const delayNode = ctx.createDelay();
      delayNode.delayTime.setValueAtTime(track.effects.delayTime, now);
      const delayFeedback = ctx.createGain();
      delayFeedback.gain.setValueAtTime(track.effects.delayFeedback / 100, now);
      
      // Filter insert
      const biquadFilter = ctx.createBiquadFilter();
      biquadFilter.type = track.effects.filterType === 'none' ? 'peaking' : track.effects.filterType;
      biquadFilter.frequency.setValueAtTime(track.effects.filterCutoff, now);
      
      // Connect nodes
      if (sourceNode.connect) {
        let currentNode = sourceNode;
        
        // Time-Domain Pitch Transposition & Hertz Conversion Engine
        const hertzRatio = getPitchShiftRatioForFrequency(selectedFreq);
        const semitoneRatio = Math.pow(2, track.effects.pitchShift / 12);
        const finalRatio = hertzRatio * semitoneRatio;
        
        if (Math.abs(finalRatio - 1.0) > 0.005) {
          const shifter = createPitchShifterNode(ctx, finalRatio);
          currentNode.connect(shifter);
          currentNode = shifter;
        }
        
        // Route through filter
        currentNode.connect(biquadFilter);
        currentNode = biquadFilter;

        // Route through delay loop
        if (track.effects.delayTime > 0) {
          currentNode.connect(delayNode);
          delayNode.connect(delayFeedback);
          delayFeedback.connect(delayNode);
          delayNode.connect(gainNode);
        }

        currentNode.connect(gainNode);
        
        if (pannerNode) {
          gainNode.connect(pannerNode);
          pannerNode.connect(masterTargetNode);
        } else {
          gainNode.connect(masterTargetNode);
        }
      }
    });

    // 3. Synthesize ACID Loops
    if (synths.drums) {
      scheduleSynthLoop('drums', ctx, now, masterTargetNode);
    }
    if (synths.pad) {
      scheduleSynthLoop('pad', ctx, now, masterTargetNode);
    }
    if (synths.bass) {
      scheduleSynthLoop('bass', ctx, now, masterTargetNode);
    }
    if (synths.chimes) {
      scheduleSynthLoop('chimes', ctx, now, masterTargetNode);
    }
  };

  // Schedule repetitive notes for ACID synthesizer loops
  const scheduleSynthLoop = (type, ctx, now, masterTargetNode) => {
    const secondsPerBeat = 60.0 / 120.0; // 120 BPM
    const totalBeats = 40;

    for (let beat = 0; beat < totalBeats; beat++) {
      const beatTime = now + (beat * secondsPerBeat);
      if (beatTime < now + (playbackTime % projectDuration)) continue;

      if (type === 'drums') {
        // Muladhara Drums: Bass Kick on 1 and 3, Snare Noise on 2 and 4
        if (beat % 2 === 0) {
          // Kick Drum Synth
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(masterTargetNode);

          osc.frequency.setValueAtTime(150, beatTime);
          osc.frequency.exponentialRampToValueAtTime(0.01, beatTime + 0.35);

          gain.gain.setValueAtTime(0.3 * (masterVolume / 100), beatTime);
          gain.gain.exponentialRampToValueAtTime(0.01, beatTime + 0.35);

          osc.start(beatTime);
          osc.stop(beatTime + 0.4);
          activeNodesRef.current.push(osc);
        } else {
          // Snare Noise Synth
          const bufferSize = ctx.sampleRate * 0.2;
          const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
          }
          
          const noise = ctx.createBufferSource();
          noise.buffer = buffer;

          const filter = ctx.createBiquadFilter();
          filter.type = 'highpass';
          filter.frequency.setValueAtTime(1000, beatTime);

          const gain = ctx.createGain();
          noise.connect(filter);
          filter.connect(gain);
          gain.connect(masterTargetNode);

          gain.gain.setValueAtTime(0.12 * (masterVolume / 100), beatTime);
          gain.gain.exponentialRampToValueAtTime(0.01, beatTime + 0.2);

          noise.start(beatTime);
          noise.stop(beatTime + 0.25);
          activeNodesRef.current.push(noise);
        }
      } else if (type === 'bass') {
        // Solfeggio Sub-Bass: Arpeggiator repeating 8th notes
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(masterTargetNode);

        const freq = selectedFreq / 8; // deep bass
        osc.frequency.setValueAtTime(freq, beatTime);
        gain.gain.setValueAtTime(0.08 * (masterVolume / 100), beatTime);
        gain.gain.setValueAtTime(0.08 * (masterVolume / 100), beatTime + secondsPerBeat - 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, beatTime + secondsPerBeat);

        osc.start(beatTime);
        osc.stop(beatTime + secondsPerBeat);
        activeNodesRef.current.push(osc);
      } else if (type === 'pad') {
        // Anahata Pad Chords
        if (beat % 4 === 0) {
          const notes = [selectedFreq / 2, (selectedFreq * 1.25) / 2, (selectedFreq * 1.5) / 2]; // Chord
          notes.forEach(freq => {
            const osc = ctx.createOscillator();
            osc.type = 'triangle';
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(masterTargetNode);

            osc.frequency.setValueAtTime(freq, beatTime);
            gain.gain.setValueAtTime(0.0, beatTime);
            gain.gain.linearRampToValueAtTime(0.04 * (masterVolume / 100), beatTime + 0.5);
            gain.gain.exponentialRampToValueAtTime(0.001, beatTime + secondsPerBeat * 4);

            osc.start(beatTime);
            osc.stop(beatTime + secondsPerBeat * 4);
            activeNodesRef.current.push(osc);
          });
        }
      } else if (type === 'chimes') {
        // Ajna Chimes arpeggiator notes on beat division
        const subNote = beat % 4;
        const baseHz = selectedFreq * 2;
        const hertzArray = [baseHz, baseHz * 1.2, baseHz * 1.5, baseHz * 1.8];
        const pitch = hertzArray[subNote];

        const osc = ctx.createOscillator();
        osc.type = 'sine';
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(masterTargetNode);

        osc.frequency.setValueAtTime(pitch, beatTime);
        gain.gain.setValueAtTime(0.05 * (masterVolume / 100), beatTime);
        gain.gain.exponentialRampToValueAtTime(0.001, beatTime + 0.25);

        osc.start(beatTime);
        osc.stop(beatTime + 0.3);
        activeNodesRef.current.push(osc);
      }
    }
  };

  // Perform non-destructive slicing of clips
  const handleSplitClip = () => {
    const selectedTrack = tracks[selectedTrackIndex];
    if (playbackTime > selectedTrack.startOffset && playbackTime < selectedTrack.startOffset + selectedTrack.clipDuration) {
      const firstPartDuration = playbackTime - selectedTrack.startOffset;
      const secondPartDuration = selectedTrack.clipDuration - firstPartDuration;

      const splitTrack = {
        ...selectedTrack,
        clipDuration: firstPartDuration
      };

      // Add a duplicate overlay track representing the second part
      const newTrack = {
        id: 't_split_' + Date.now(),
        name: `${selectedTrack.name} (Split Part)`,
        type: selectedTrack.type,
        color: selectedTrack.color,
        volume: selectedTrack.volume,
        pan: selectedTrack.pan,
        isMuted: selectedTrack.isMuted,
        isSolo: selectedTrack.isSolo,
        startOffset: playbackTime,
        clipDuration: secondPartDuration,
        effects: { ...selectedTrack.effects }
      };

      setTracks(prev => {
        const next = [...prev];
        next[selectedTrackIndex] = splitTrack;
        next.splice(selectedTrackIndex + 1, 0, newTrack);
        return next;
      });

      alert(`Clip sliced! Splitting segment into two non-destructive blocks at ${playbackTime.toFixed(2)}s.`);
    } else {
      alert("Move playhead cursor inside the selected track clip range to split.");
    }
  };

  // Perform Offline Mixdown to WAV file
  const handleOfflineMixdown = async () => {
    setIsExporting(true);
    setIsPlaying(false);
    
    // Tiny delay to ensure UI updates
    setTimeout(async () => {
      try {
        const durationSec = projectDuration;
        const sampleRate = 44100;
        
        const OfflineContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        const offlineCtx = new OfflineContext(2, sampleRate * durationSec, sampleRate);

        // Apply Master 3-Band Equalizer (Chest, Heart, Throat filters)
        // Chest shelf low, Heart peaking mid, Throat shelf high
        const masterEQNode1 = offlineCtx.createBiquadFilter();
        masterEQNode1.type = 'lowshelf';
        masterEQNode1.frequency.setValueAtTime(100, 0);
        masterEQNode1.gain.setValueAtTime(masterEQ.chest, 0);

        const masterEQNode2 = offlineCtx.createBiquadFilter();
        masterEQNode2.type = 'peaking';
        masterEQNode2.frequency.setValueAtTime(1000, 0);
        masterEQNode2.Q.setValueAtTime(1.0, 0);
        masterEQNode2.gain.setValueAtTime(masterEQ.heart, 0);

        const masterEQNode3 = offlineCtx.createBiquadFilter();
        masterEQNode3.type = 'highshelf';
        masterEQNode3.frequency.setValueAtTime(8000, 0);
        masterEQNode3.gain.setValueAtTime(masterEQ.throat, 0);

        // Mastering Limiter dynamics compressor
        const limiter = offlineCtx.createDynamicsCompressor();
        limiter.threshold.setValueAtTime(masterLimiter, 0);
        limiter.knee.setValueAtTime(0, 0);
        limiter.ratio.setValueAtTime(20, 0);
        limiter.attack.setValueAtTime(0.001, 0);
        limiter.release.setValueAtTime(0.05, 0);

        // Chain master EQ and limiter
        masterEQNode1.connect(masterEQNode2);
        masterEQNode2.connect(masterEQNode3);
        masterEQNode3.connect(limiter);

        // Offline Schumann Resonance Bus
        let masterTargetNode = masterEQNode1;
        if (schumannLfo) {
          const panner = offlineCtx.createStereoPanner ? offlineCtx.createStereoPanner() : null;
          if (panner) {
            const lfo = offlineCtx.createOscillator();
            lfo.frequency.setValueAtTime(7.83, 0); // Schumann Resonance (7.83 Hz)
            
            const lfoGain = offlineCtx.createGain();
            lfoGain.gain.setValueAtTime(0.35, 0);
            
            lfo.connect(lfoGain);
            lfoGain.connect(panner.pan);
            lfo.start(0);

            limiter.connect(panner);
            panner.connect(offlineCtx.destination);
          } else {
            limiter.connect(offlineCtx.destination);
          }
        } else {
          limiter.connect(offlineCtx.destination);
        }

        // Determine if any track has Solo
        const hasSolo = tracks.some(t => t.isSolo);

        // Pre-decode any recorded audio track buffers asynchronously
        const decodedBuffers = {};
        for (let i = 0; i < tracks.length; i++) {
          const track = tracks[i];
          if (track.audioUrl && !track.isMuted) {
            if (hasSolo && !track.isSolo) continue;
            try {
              const res = await fetch(track.audioUrl);
              const arrayBuffer = await res.arrayBuffer();
              if (typeof offlineCtx.decodeAudioData === 'function') {
                const audioBuf = await offlineCtx.decodeAudioData(arrayBuffer);
                decodedBuffers[track.id] = audioBuf;
              }
            } catch (e) {
              console.error("Failed to decode recorded track for offline mixdown:", e);
            }
          }
        }

        // Recreate the Web Audio graph on Offline context
        tracks.forEach(track => {
          if (track.isMuted) return;
          if (hasSolo && !track.isSolo) return;

          // volume coefficient
          const volFraction = (track.volume / 100) * (masterVolume / 100) * 0.15;

          let source;
          const recordedBuffer = decodedBuffers[track.id];

          if (recordedBuffer) {
            source = offlineCtx.createBufferSource();
            source.buffer = recordedBuffer;
          } else {
            // Generate simulated audio buffers
            const totalSamples = sampleRate * track.clipDuration;
            const buffer = offlineCtx.createBuffer(1, totalSamples, sampleRate);
            const channelData = buffer.getChannelData(0);
            
            const baseFreq = track.type === 'vocal' ? 220 : (track.type === 'backing' ? 80 : 440);
            for (let i = 0; i < totalSamples; i++) {
              const t = i / sampleRate;
              let sampleVal = Math.sin(2 * Math.PI * baseFreq * t) * 0.4;
              sampleVal += Math.sin(2 * Math.PI * (baseFreq * 1.5) * t) * 0.2;
              
              // Envelope fade
              if (t < 0.2) sampleVal *= (t / 0.2);
              if (t > track.clipDuration - 0.2) sampleVal *= ((track.clipDuration - t) / 0.2);

              channelData[i] = sampleVal;
            }

            source = offlineCtx.createBufferSource();
            source.buffer = buffer;
          }

          // volume gain node
          const gain = offlineCtx.createGain();
          gain.gain.setValueAtTime(volFraction, 0);

          // Panner Node
          const panner = offlineCtx.createStereoPanner ? offlineCtx.createStereoPanner() : null;
          if (panner) {
            panner.pan.setValueAtTime(track.pan, 0);
          }

          // Connecting inserts with Pitch Conversion Engine
          const hertzRatio = getPitchShiftRatioForFrequency(selectedFreq);
          const semitoneRatio = Math.pow(2, track.effects.pitchShift / 12);
          const finalRatio = hertzRatio * semitoneRatio;

          let finalSource = source;
          if (Math.abs(finalRatio - 1.0) > 0.005) {
            const shifter = createPitchShifterNode(offlineCtx, finalRatio);
            source.connect(shifter);
            finalSource = shifter;
          }

          finalSource.connect(gain);
          if (panner) {
            gain.connect(panner);
            panner.connect(masterTargetNode);
          } else {
            gain.connect(masterTargetNode);
          }

          // Start source inside offline context
          source.start(track.startOffset);
        });

        // Mixdown synthesized loops as well
        if (synths.drums) {
          generateOfflineSynthLoop('drums', offlineCtx, sampleRate, durationSec, masterTargetNode);
        }
        if (synths.bass) {
          generateOfflineSynthLoop('bass', offlineCtx, sampleRate, durationSec, masterTargetNode);
        }
        if (synths.pad) {
          generateOfflineSynthLoop('pad', offlineCtx, sampleRate, durationSec, masterTargetNode);
        }
        if (synths.chimes) {
          generateOfflineSynthLoop('chimes', offlineCtx, sampleRate, durationSec, masterTargetNode);
        }

        // Render buffer
        const renderedBuffer = await offlineCtx.startRendering();
        
        // Convert to WAV Blob
        const wavBlob = bufferToWav(renderedBuffer);
        const url = URL.createObjectURL(wavBlob);
        
        // Trigger download
        const a = document.createElement('a');
        a.href = url;
        a.download = `ariyus_master_mixdown_${selectedFreq}Hz.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        alert("Offline high-fidelity mixdown compiled! 16-Bit WAV file downloaded.");
      } catch (err) {
        console.error(err);
        alert("Mixdown synthesis failed. Check browser sample rates.");
      } finally {
        setIsExporting(false);
      }
    }, 300);
  };

  // Generate offline synthesized drum/melody loops
  const generateOfflineSynthLoop = (type, offlineCtx, sampleRate, totalDuration, masterTargetNode) => {
    const secondsPerBeat = 60.0 / 120.0;
    const totalBeats = Math.floor(totalDuration / secondsPerBeat);

    for (let beat = 0; beat < totalBeats; beat++) {
      const beatTime = beat * secondsPerBeat;
      const volFraction = masterVolume / 100;

      if (type === 'drums') {
        if (beat % 2 === 0) {
          // Kick Drum oscillator sweep
          const osc = offlineCtx.createOscillator();
          const gain = offlineCtx.createGain();
          osc.connect(gain);
          gain.connect(masterTargetNode);

          osc.frequency.setValueAtTime(150, beatTime);
          osc.frequency.exponentialRampToValueAtTime(0.01, beatTime + 0.35);

          gain.gain.setValueAtTime(0.3 * volFraction, beatTime);
          gain.gain.exponentialRampToValueAtTime(0.01, beatTime + 0.35);

          osc.start(beatTime);
          osc.stop(beatTime + 0.4);
        } else {
          // Snare Noise
          const bufferSize = sampleRate * 0.2;
          const noiseBuffer = offlineCtx.createBuffer(1, bufferSize, sampleRate);
          const data = noiseBuffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
          }
          
          const noise = offlineCtx.createBufferSource();
          noise.buffer = noiseBuffer;

          const filter = offlineCtx.createBiquadFilter();
          filter.type = 'highpass';
          filter.frequency.setValueAtTime(1000, beatTime);

          const gain = offlineCtx.createGain();
          noise.connect(filter);
          filter.connect(gain);
          gain.connect(masterTargetNode);

          gain.gain.setValueAtTime(0.12 * volFraction, beatTime);
          gain.gain.exponentialRampToValueAtTime(0.01, beatTime + 0.2);

          noise.start(beatTime);
          noise.stop(beatTime + 0.25);
        }
      } else if (type === 'bass') {
        const osc = offlineCtx.createOscillator();
        const gain = offlineCtx.createGain();
        osc.connect(gain);
        gain.connect(masterTargetNode);

        const freq = selectedFreq / 8;
        osc.frequency.setValueAtTime(freq, beatTime);
        gain.gain.setValueAtTime(0.08 * volFraction, beatTime);
        gain.gain.setValueAtTime(0.08 * volFraction, beatTime + secondsPerBeat - 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, beatTime + secondsPerBeat);

        osc.start(beatTime);
        osc.stop(beatTime + secondsPerBeat);
      } else if (type === 'pad') {
        if (beat % 4 === 0) {
          const notes = [selectedFreq / 2, (selectedFreq * 1.25) / 2, (selectedFreq * 1.5) / 2];
          notes.forEach(freq => {
            const osc = offlineCtx.createOscillator();
            osc.type = 'triangle';
            const gain = offlineCtx.createGain();
            osc.connect(gain);
            gain.connect(masterTargetNode);

            osc.frequency.setValueAtTime(freq, beatTime);
            gain.gain.setValueAtTime(0.0, beatTime);
            gain.gain.linearRampToValueAtTime(0.04 * volFraction, beatTime + 0.5);
            gain.gain.exponentialRampToValueAtTime(0.001, beatTime + secondsPerBeat * 4);

            osc.start(beatTime);
            osc.stop(beatTime + secondsPerBeat * 4);
          });
        }
      } else if (type === 'chimes') {
        const subNote = beat % 4;
        const baseHz = selectedFreq * 2;
        const hertzArray = [baseHz, baseHz * 1.2, baseHz * 1.5, baseHz * 1.8];
        const pitch = hertzArray[subNote];

        const osc = offlineCtx.createOscillator();
        osc.type = 'sine';
        const gain = offlineCtx.createGain();
        osc.connect(gain);
        gain.connect(masterTargetNode);

        osc.frequency.setValueAtTime(pitch, beatTime);
        gain.gain.setValueAtTime(0.05 * volFraction, beatTime);
        gain.gain.exponentialRampToValueAtTime(0.001, beatTime + 0.25);

        osc.start(beatTime);
        osc.stop(beatTime + 0.3);
      }
    }
  };

  // Convert rendered float AudioBuffer to 16-bit PCM WAV Blob structure
  const bufferToWav = (buffer) => {
    const numOfChan = buffer.numberOfChannels,
          length = buffer.length * numOfChan * 2 + 44,
          bufferArr = new ArrayBuffer(length),
          view = new DataView(bufferArr),
          channels = [], 
          sampleRate = buffer.sampleRate;
    
    let i, sample, offset = 0, pos = 0;

    const setUint16 = (data) => {
      view.setUint16(pos, data, true);
      pos += 2;
    };

    const setUint32 = (data) => {
      view.setUint32(pos, data, true);
      pos += 4;
    };

    // RIFF chunk descriptor
    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file size - 8
    setUint32(0x45564157); // "WAVE"

    // fmt sub-chunk
    setUint32(0x20746d66); // "fmt "
    setUint32(16);         // format size
    setUint16(1);          // linear PCM
    setUint16(numOfChan);  // channels
    setUint32(sampleRate); // sample rate
    setUint32(sampleRate * 2 * numOfChan); // byte rate
    setUint16(numOfChan * 2);              // block align
    setUint16(16);                         // bits per sample

    // data sub-chunk
    setUint32(0x61746164); // "data"
    setUint32(length - pos - 4);

    // gather channels
    for (i = 0; i < numOfChan; i++) {
      channels.push(buffer.getChannelData(i));
    }

    // interleave channel arrays
    while (pos < length) {
      for (i = 0; i < numOfChan; i++) {
        sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp sample
        sample = (sample < 0 ? sample * 0x8000 : sample * 0x7FFF); // scale to 16-bit
        view.setInt16(pos, sample, true);
        pos += 2;
      }
      offset++;
    }

    return new Blob([bufferArr], { type: "audio/wav" });
  };

  const handleTrackMute = (idx) => {
    setTracks(prev => prev.map((t, i) => i === idx ? { ...t, isMuted: !t.isMuted } : t));
  };

  const handleTrackSolo = (idx) => {
    setTracks(prev => prev.map((t, i) => i === idx ? { ...t, isSolo: !t.isSolo } : t));
  };

  const updateTrackParameter = (idx, param, val) => {
    setTracks(prev => prev.map((t, i) => i === idx ? { ...t, [param]: val } : t));
  };

  const updateTrackEffect = (idx, key, val) => {
    setTracks(prev => prev.map((t, i) => {
      if (i === idx) {
        return {
          ...t,
          effects: { ...t.effects, [key]: val }
        };
      }
      return t;
    }));
  };

  const selectedTrack = tracks[selectedTrackIndex];

  return (
    <div className="screen-wrapper" style={{ paddingBottom: '30px' }}>
      <div className="floating-notes">🎚️</div>
      
      {/* DAW Header / Transport bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h1 className="suspended-title" style={{ margin: 0 }}>Ariyus DAW</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="glowing-button secondary" onClick={() => setShowHelp(true)} style={{ margin: 0, padding: '8px 15px', fontSize: '0.75rem' }}>
            💡 Guide
          </button>
          <button className="glowing-button secondary" onClick={() => navigate('Profile')} style={{ margin: 0, padding: '8px 15px', fontSize: '0.75rem', borderColor: 'var(--secondary-glow)', color: 'var(--secondary-glow)' }}>
            🔙 Me Hub
          </button>
        </div>
      </div>

      <div className="daw-workspace glass-panel">
        
        {/* Playback Control Transport Bar */}
        <div className="daw-transport-bar">
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button 
              className={`glowing-button ${isPlaying ? 'active' : ''}`}
              onClick={() => {
                if (isRecordingMaster) {
                  stopRecordingEngine();
                } else {
                  setIsPlaying(!isPlaying);
                }
              }}
              style={{ margin: 0, padding: '8px 18px', fontSize: '0.8rem' }}
              disabled={isRecordingMaster}
            >
              {isPlaying ? '⏸ Pause' : '▶ Play'}
            </button>
            <button 
              className="glowing-button secondary"
              onClick={() => { 
                if (isRecordingMaster) {
                  stopRecordingEngine();
                } else {
                  setIsPlaying(false); 
                  setPlaybackTime(0); 
                }
              }}
              style={{ margin: 0, padding: '8px 18px', fontSize: '0.8rem' }}
            >
              ⏹ Stop
            </button>

            {/* Master Record Button */}
            <button
              className={`glowing-button ${isRecordingMaster ? 'active' : ''}`}
              onClick={() => {
                if (isRecordingMaster) {
                  stopRecordingEngine();
                } else {
                  startRecordingEngine();
                }
              }}
              style={{ 
                margin: 0, 
                padding: '8px 18px', 
                fontSize: '0.8rem',
                background: isRecordingMaster ? '#ff4d4d' : 'transparent',
                borderColor: armedTrackIndex >= 0 ? '#ff4d4d' : 'rgba(255,255,255,0.08)',
                color: armedTrackIndex >= 0 ? '#ff4d4d' : 'var(--text-dim)',
                boxShadow: isRecordingMaster ? '0 0 10px #ff4d4d' : 'none'
              }}
              disabled={armedTrackIndex < 0 && !isRecordingMaster}
              title={armedTrackIndex < 0 ? "Arm a track (🔴 R) to enable recording" : "Record audio onto armed track"}
            >
              {isRecordingMaster ? '⏹ Stop Rec' : '🔴 Record'}
            </button>

            <span style={{ fontFamily: 'monospace', fontSize: '0.9rem', color: '#fff', marginLeft: '15px' }}>
              ⏱️ {playbackTime.toFixed(2)}s / {projectDuration}s
            </span>
          </div>

          <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            {/* Solfeggio Key Scale Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontFamily: '"Orbitron", sans-serif' }}>Scale Tuning:</span>
              <select 
                value={selectedFreq} 
                onChange={e => setSelectedFreq(Number(e.target.value))}
                style={{
                  background: 'rgba(6, 4, 30, 0.7)',
                  color: 'var(--primary-glow)',
                  border: '1px solid rgba(0,242,255,0.25)',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                  outline: 'none'
                }}
              >
                <option value={440}>440Hz (Standard)</option>
                <option value={432}>432Hz (Earth/Cosmic)</option>
                <option value={444}>444Hz (David Key)</option>
                <option value={528}>528Hz (Transformation/Miracle)</option>
                <option value={639}>639Hz (Relationships)</option>
                <option value={741}>741Hz (Clarity/Intuition)</option>
                <option value={852}>852Hz (Third Eye Awakening)</option>
                <option value={963}>963Hz (Crown/Cosmic Connection)</option>
              </select>
            </div>

            <button 
              className="glowing-button"
              disabled={isExporting}
              onClick={handleOfflineMixdown}
              style={{ margin: 0, padding: '10px 20px', fontSize: '0.8rem', background: 'linear-gradient(90deg, var(--secondary-glow), var(--tertiary-glow))' }}
            >
              {isExporting ? '💾 Exporting...' : '💾 Export Mixdown (.WAV)'}
            </button>
          </div>
        </div>

        {/* Timeline ruler */}
        <div className="daw-timeline-ruler">
          {[...Array(5)].map((_, idx) => (
            <div key={idx} className="daw-ruler-marker">
              {(idx * 5)}s
            </div>
          ))}
        </div>

        {/* Linear stacked timeline track rows */}
        <div className="daw-timeline-container">
          
          {tracks.map((track, idx) => {
            const isSelected = idx === selectedTrackIndex;
            const clipWidthFraction = track.clipDuration / projectDuration;
            const clipOffsetFraction = track.startOffset / projectDuration;

            return (
              <div 
                key={track.id} 
                className="daw-track-row" 
                style={{ 
                  background: isSelected ? 'rgba(255,255,255,0.02)' : '',
                  borderLeft: isSelected ? '4px solid var(--primary-glow)' : '4px solid transparent'
                }}
                onClick={() => setSelectedTrackIndex(idx)}
              >
                
                {/* Header Track Controls */}
                <div className="daw-track-controls">
                  <div className="daw-track-controls-header">
                    <strong>{track.name}</strong>
                  </div>

                  <div className="daw-track-buttons-row">
                    <button 
                      className={`daw-track-btn ${track.isMuted ? 'active mute' : ''}`}
                      onClick={(e) => { e.stopPropagation(); handleTrackMute(idx); }}
                    >
                      M
                    </button>
                    <button 
                      className={`daw-track-btn ${track.isSolo ? 'active solo' : ''}`}
                      onClick={(e) => { e.stopPropagation(); handleTrackSolo(idx); }}
                    >
                      S
                    </button>
                    <button 
                      className="daw-track-btn" 
                      onClick={(e) => { e.stopPropagation(); setSelectedTrackIndex(idx); setShowEffectsModal(true); }}
                    >
                      🎛️ FX
                    </button>
                    <button 
                      className={`daw-track-btn ${armedTrackIndex === idx ? 'active arm-rec' : ''}`}
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setArmedTrackIndex(prev => prev === idx ? -1 : idx); 
                      }}
                      style={{ 
                        color: armedTrackIndex === idx ? '#fff' : '#ff4d4d', 
                        borderColor: armedTrackIndex === idx ? '#ff4d4d' : 'rgba(255, 77, 77, 0.3)',
                        background: armedTrackIndex === idx ? '#ff4d4d' : 'transparent',
                        fontSize: '0.62rem',
                        fontWeight: 'bold'
                      }}
                    >
                      🔴 R
                    </button>
                  </div>

                  <div className="daw-track-slider-group">
                    <label>Vol</label>
                    <input 
                      type="range" 
                      min="0" max="100"
                      value={track.volume} 
                      onChange={(e) => updateTrackParameter(idx, 'volume', parseInt(e.target.value))}
                      style={{ flexGrow: 1 }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span style={{ width: '25px', textAlign: 'right' }}>{track.volume}</span>
                  </div>

                  <div className="daw-track-slider-group">
                    <label>Pan</label>
                    <input 
                      type="range" 
                      min="-1.0" max="1.0" step="0.1"
                      value={track.pan} 
                      onChange={(e) => updateTrackParameter(idx, 'pan', parseFloat(e.target.value))}
                      style={{ flexGrow: 1 }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span style={{ width: '25px', textAlign: 'right' }}>{track.pan}</span>
                  </div>

                </div>

                {/* Track timeline editor display */}
                <div className="daw-track-timeline" onClick={() => setSelectedTrackIndex(idx)}>
                  
                  {/* Scrolling playhead bar */}
                  {isPlaying && (
                    <div 
                      className="daw-playhead" 
                      style={{ left: `${(playbackTime / projectDuration) * 100}%` }}
                    />
                  )}

                  {/* Waveform track block clip */}
                  <div 
                    style={{ 
                      position: 'absolute',
                      left: `${clipOffsetFraction * 100}%`,
                      width: `${clipWidthFraction * 100}%`,
                      height: '80px',
                      top: '20px',
                      background: 'rgba(0, 0, 0, 0.4)',
                      borderRadius: '8px',
                      border: isSelected ? '1.5px solid var(--primary-glow)' : '1px solid rgba(255,255,255,0.08)',
                      overflow: 'hidden',
                      boxShadow: isSelected ? '0 0 10px rgba(0,242,255,0.1)' : 'none',
                      transition: 'border 0.25s ease'
                    }}
                  >
                    <canvas 
                      ref={el => canvasRefs.current[idx] = el}
                      style={{ display: 'block', width: '100%', height: '100%' }}
                    />
                  </div>

                  {/* Offset timing slider adjustment (Clip Aligning tool) */}
                  <div style={{ position: 'absolute', bottom: '2px', left: '10px', right: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.62rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Offset:</span>
                    <input 
                      type="range" 
                      min="0.0" max="10.0" step="0.1"
                      value={track.startOffset} 
                      onChange={(e) => updateTrackParameter(idx, 'startOffset', parseFloat(e.target.value))}
                      style={{ width: '120px', height: '4px' }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span style={{ fontSize: '0.65rem', color: '#fff' }}>{track.startOffset.toFixed(1)}s</span>
                  </div>

                </div>

              </div>
            );
          })}
        </div>

      </div>

      {/* Synth loop panel and Mastering Console */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginTop: '20px' }}>
        
        {/* ACID Synth loops dashboard */}
        <div className="glass-panel" style={{ margin: 0 }}>
          <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px', color: '#fff' }}>
            🎹 ACID Synth Loops Grid
          </h3>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.82rem', marginBottom: '15px' }}>
            Synthesize live carrier loops and beats synced to target resonance frequencies directly on the grid timeline.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {[
              { key: 'drums', label: '🥁 Muladhara Beats', desc: 'TR-808 Kick & Snare' },
              { key: 'bass', label: '🎸 Solfeggio Sub-Bass', desc: 'Sine Wave Deep Freq' },
              { key: 'pad', label: '🌌 Anahata Pads', desc: 'Triangle Chord Sweep' },
              { key: 'chimes', label: '🔔 Ajna Chimes', desc: 'Arpeggiating Bells' }
            ].map(synth => (
              <button
                key={synth.key}
                className={`glowing-button secondary ${synths[synth.key] ? 'active' : ''}`}
                onClick={() => {
                  setSynths(prev => {
                    const next = { ...prev, [synth.key]: !prev[synth.key] };
                    // If playing, apply update dynamically
                    if (isPlaying) {
                      setTimeout(() => initAudioEngine(), 50);
                    }
                    return next;
                  });
                }}
                style={{ textAlign: 'left', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px', margin: 0 }}
              >
                <strong style={{ fontSize: '0.85rem', color: '#fff' }}>{synth.label}</strong>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>{synth.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Mastering console & segment editor */}
        <div className="glass-panel" style={{ margin: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px', color: 'var(--secondary-glow)' }}>
              💎 Mastering & Precision Suite
            </h3>

            {/* Selected segment editor */}
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)', marginBottom: '15px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--primary-glow)', textTransform: 'uppercase', fontWeight: 'bold' }}>
                  Segment Edit: {selectedTrack?.name}
                </span>
                <button 
                  className="glowing-button secondary" 
                  onClick={handleSplitClip}
                  style={{ margin: 0, padding: '4px 10px', fontSize: '0.65rem' }}
                >
                  ✂️ Split Segment
                </button>
              </div>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.68rem', margin: 0 }}>
                Click "Split Segment" to slice the active audio wave at the current playhead cursor position ({playbackTime.toFixed(1)}s).
              </p>
            </div>

            {/* Master Volume and Limiter */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className="daw-track-slider-group">
                <label style={{ width: '80px' }}>Master Vol</label>
                <input 
                  type="range" 
                  min="0" max="100"
                  value={masterVolume} 
                  onChange={(e) => setMasterVolume(parseInt(e.target.value))}
                  style={{ flexGrow: 1 }}
                />
                <span style={{ width: '40px', textAlign: 'right' }}>{masterVolume}%</span>
              </div>

              <div className="daw-track-slider-group">
                <label style={{ width: '80px' }}>Limiter Thresh</label>
                <input 
                  type="range" 
                  min="-12.0" max="0.0" step="0.5"
                  value={masterLimiter} 
                  onChange={(e) => setMasterLimiter(parseFloat(e.target.value))}
                  style={{ flexGrow: 1 }}
                />
                <span style={{ width: '40px', textAlign: 'right' }}>{masterLimiter.toFixed(1)} dB</span>
              </div>

              {/* Earth Resonance LFO Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '5px', padding: '6px 8px', background: 'rgba(0, 242, 255, 0.02)', borderRadius: '6px', border: '1px solid rgba(0, 242, 255, 0.08)' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.78rem', color: '#fff', fontWeight: 'bold' }}>🌍 Earth Resonance (7.83 Hz)</span>
                  <span style={{ fontSize: '0.6rem', color: 'var(--text-dim)' }}>Swirl outputs matching the Schumann vibration</span>
                </div>
                <button
                  className={`glowing-button ${schumannLfo ? "" : "secondary"}`}
                  onClick={() => {
                    setSchumannLfo(prev => !prev);
                  }}
                  style={{ margin: 0, padding: '4px 10px', fontSize: '0.65rem', borderColor: schumannLfo ? 'var(--primary-glow)' : '', minWidth: '70px' }}
                >
                  {schumannLfo ? 'ACTIVE' : 'BYPASS'}
                </button>
              </div>
            </div>

            {/* Master 3-Band Equalizer */}
            <h4 style={{ fontSize: '0.75rem', color: '#fff', textTransform: 'uppercase', marginTop: '15px', marginBottom: '8px' }}>
              Master 3-Band EQ (Resonance Scales)
            </h4>
            <div style={{ display: 'flex', gap: '10px' }}>
              {[
                { key: 'chest', label: 'Low (Chest)', color: 'var(--primary-glow)' },
                { key: 'heart', label: 'Mid (Heart)', color: '#00ff87' },
                { key: 'throat', label: 'High (Throat)', color: 'var(--secondary-glow)' }
              ].map(band => (
                <div key={band.key} style={{ flex: 1, textAlign: 'center', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', padding: '8px', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.62rem', color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block', marginBottom: '5px' }}>{band.label}</span>
                  <input 
                    type="range" 
                    min="-12" max="12"
                    value={masterEQ[band.key]} 
                    onChange={(e) => setMasterEQ(prev => ({ ...prev, [band.key]: parseInt(e.target.value) }))}
                    style={{ writingMode: 'bt-lr', WebkitAppearance: 'slider-vertical', width: '15px', height: '65px', margin: '0 auto' }}
                  />
                  <strong style={{ display: 'block', fontSize: '0.7rem', color: band.color, marginTop: '5px' }}>{masterEQ[band.key] >= 0 ? `+${masterEQ[band.key]}` : masterEQ[band.key]} dB</strong>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* Effects Rack Popup Modal */}
      {showEffectsModal && (
        <div className="custom-alert-overlay" onClick={() => setShowEffectsModal(false)}>
          <div className="custom-alert-box glass-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px', textAlign: 'left' }}>
            <h3 style={{ textShadow: '0 0 10px var(--primary-glow)', marginBottom: '5px' }}>🎙️ Insert DSP FX: {selectedTrack?.name}</h3>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.78rem', marginBottom: '15px', marginTop: 0 }}>Configure the FL Studio-style real-time ARC-5 digital effects processors on this track chain.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {/* Transpose pitch slider */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#fff', marginBottom: '5px' }}>
                  <span>Vocal Key Shift (Transposition)</span>
                  <strong style={{ color: 'var(--primary-glow)' }}>{selectedTrack.effects.pitchShift >= 0 ? `+${selectedTrack.effects.pitchShift}` : selectedTrack.effects.pitchShift} semitones</strong>
                </div>
                <input 
                  type="range" 
                  min="-12" max="12"
                  value={selectedTrack.effects.pitchShift} 
                  onChange={(e) => updateTrackEffect(selectedTrackIndex, 'pitchShift', parseInt(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>

              {/* Filter Dial */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#fff', marginBottom: '5px' }}>
                  <span>Filter Type & Cutoff</span>
                  <strong style={{ color: '#00ff87' }}>{selectedTrack.effects.filterCutoff} Hz ({selectedTrack.effects.filterType})</strong>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select 
                    value={selectedTrack.effects.filterType}
                    onChange={(e) => updateTrackEffect(selectedTrackIndex, 'filterType', e.target.value)}
                    className="comment-input"
                    style={{ background: 'rgba(0,0,0,0.4)', color: '#fff', border: '1px solid var(--glass-border)', padding: '5px', fontSize: '0.72rem', borderRadius: '4px' }}
                  >
                    <option value="none">Bypass Filter</option>
                    <option value="lowpass">Low Pass (LPF)</option>
                    <option value="highpass">High Pass (HPF)</option>
                    <option value="bandpass">Band Pass (BPF)</option>
                  </select>
                  <input 
                    type="range" 
                    min="100" max="5000" step="50"
                    value={selectedTrack.effects.filterCutoff} 
                    onChange={(e) => updateTrackEffect(selectedTrackIndex, 'filterCutoff', parseInt(e.target.value))}
                    style={{ flexGrow: 1 }}
                    disabled={selectedTrack.effects.filterType === 'none'}
                  />
                </div>
              </div>

              {/* Delay Settings */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#fff', marginBottom: '5px' }}>
                  <span>Echo Delay Loop</span>
                  <strong style={{ color: 'var(--secondary-glow)' }}>{selectedTrack.effects.delayTime.toFixed(1)}s Delay / {selectedTrack.effects.delayFeedback}% Feedback</strong>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '0.62rem', color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block' }}>Time</span>
                    <input 
                      type="range" 
                      min="0.0" max="1.0" step="0.1"
                      value={selectedTrack.effects.delayTime} 
                      onChange={(e) => updateTrackEffect(selectedTrackIndex, 'delayTime', parseFloat(e.target.value))}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '0.62rem', color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block' }}>Feedback</span>
                    <input 
                      type="range" 
                      min="0" max="90"
                      value={selectedTrack.effects.delayFeedback} 
                      onChange={(e) => updateTrackEffect(selectedTrackIndex, 'delayFeedback', parseInt(e.target.value))}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
              </div>

              {/* Tube saturation warmth slider */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#fff', marginBottom: '5px' }}>
                  <span>Tube Saturation (Warm Harmonics)</span>
                  <strong style={{ color: '#ffb700' }}>{selectedTrack.effects.saturation}% Saturation</strong>
                </div>
                <input 
                  type="range" 
                  min="0" max="100"
                  value={selectedTrack.effects.saturation} 
                  onChange={(e) => updateTrackEffect(selectedTrackIndex, 'saturation', parseInt(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>

              {/* Reverb mix */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#fff', marginBottom: '5px' }}>
                  <span>Galactic Reverb Decay mix</span>
                  <strong style={{ color: 'var(--tertiary-glow)' }}>{selectedTrack.effects.reverb}% Reverb</strong>
                </div>
                <input 
                  type="range" 
                  min="0" max="100"
                  value={selectedTrack.effects.reverb} 
                  onChange={(e) => updateTrackEffect(selectedTrackIndex, 'reverb', parseInt(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <button className="glowing-button" onClick={() => setShowEffectsModal(false)} style={{ marginTop: '20px', width: '100%', margin: '20px 0 0 0' }}>
              Confirm & Apply Effects
            </button>
          </div>
        </div>
      )}

      {/* Guide Info Modal */}
      {showHelp && (
        <div className="custom-alert-overlay" onClick={() => setShowHelp(false)}>
          <div className="custom-alert-box glass-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px', textAlign: 'left' }}>
            <h3 style={{ textShadow: '0 0 10px var(--primary-glow)' }}>Ariyus DAW - User Manual</h3>
            <div style={{ color: '#fff', fontSize: '0.82rem', lineHeight: '1.6', overflowY: 'auto', maxHeight: '350px', paddingRight: '5px' }}>
              <p>Welcome to the Ariyus-One Professional Multi-Track DAW Workstation. Here is a guide to mastering the workspace:</p>
              
              <strong style={{ color: 'var(--primary-glow)', textTransform: 'uppercase', display: 'block', marginTop: '10px' }}>1. Timeline & Mixing Channels</strong>
              <p style={{ margin: '3px 0 10px 0' }}>Adjust track parameters using the mixer channel headers. Tap **M** to mute a track or **S** to solo it. To align separate vocal layers in time, use the **Offset** slider below each track timeline.</p>

              <strong style={{ color: '#00ff87', textTransform: 'uppercase', display: 'block', marginTop: '10px' }}>2. ACID Synth loops</strong>
              <p style={{ margin: '3px 0 10px 0' }}>Toggle live generated synthesizers synced to the 120 BPM clock. The drum loops simulate real-time analog TR-808 beats, while Solfeggio sub-basses anchor your low registers.</p>

              <strong style={{ color: 'var(--secondary-glow)', textTransform: 'uppercase', display: 'block', marginTop: '10px' }}>3. Offline Mixdown WAV exporter</strong>
              <p style={{ margin: '3px 0 10px 0' }}>Click the **Export Mixdown** button. The engine uses a background high-fidelity Web Audio context to render your multi-track channels, mastering dynamics limiters, and 3-band EQs, automatically generating a 16-Bit PCM WAV download.</p>
            </div>
            <button className="glowing-button" onClick={() => setShowHelp(false)} style={{ marginTop: '20px', width: '100%', margin: '20px 0 0 0' }}>
              Got It
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default Workstation;
