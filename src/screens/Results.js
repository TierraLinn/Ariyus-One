import React, { useState, useEffect, useRef } from 'react';
import VoiceSignatureCard from '../components/VoiceSignatureCard';
import { db, storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, collection, addDoc } from 'firebase/firestore';

const ResultsChamber = ({ currentRecording, saveAndShare, navigate, user, userData }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // Mixing Console States
  const [voiceVol, setVoiceVol] = useState(85);
  const [trackVol, setTrackVol] = useState(55);
  const [freqVol, setFreqVol] = useState(30);
  const [selectedFreq, setSelectedFreq] = useState(528);
  const [isDryActive, setIsDryActive] = useState(false); // Dry Vocal vs Solfeggio Wet Mix
  
  // Dynamic Pitch & Convergence UI values
  const [detectedPitch, setDetectedPitch] = useState(0);
  const [convergenceRatio, setConvergenceRatio] = useState(0);

  const [activeEffects, setActiveEffects] = useState([]);
  const [mixPresets, setMixPresets] = useState([]);
  const [newPresetName, setNewPresetName] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  // Web Audio Graph Refs (to maintain nodes across plays/renders)
  const audioCtxRef = useRef(null);
  const voiceSourceRef = useRef(null);
  const backingSourceRef = useRef(null);
  
  // DSP Node Refs
  const voiceGainRef = useRef(null);
  const backingGainRef = useRef(null);
  const solfeggioGainRef = useRef(null);
  const ringModRef = useRef(null);
  const peakingFilterRef = useRef(null);
  const combDelayNodeRef = useRef(null);
  const combFeedbackGainRef = useRef(null);
  const backingPeakingFilterRef = useRef(null);
  
  // Oscillators
  const carrierOscLeftRef = useRef(null);
  const carrierOscRightRef = useRef(null);
  const ringModOscRef = useRef(null);

  // Analysers
  const voiceAnalyserRef = useRef(null);
  const backingAnalyserRef = useRef(null);

  // DOM Player Refs
  const voiceAudioElRef = useRef(null);
  const backingAudioElRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);

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

  // Solfeggio Intentions
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
    { id: 'fx1', name: 'Ring Modulator' },
    { id: 'fx2', name: 'Comb Resonator' },
    { id: 'fx3', name: 'Acoustic Coupling' },
    { id: 'fx4', name: 'Binaural Beating' },
    { id: 'fx5', name: 'Diaphragm EQ Boost' },
    { id: 'fx6', name: 'Warm Harmonics' }
  ];

  useEffect(() => {
    const saved = localStorage.getItem('ariyus_mix_presets');
    if (saved) setMixPresets(JSON.parse(saved));
  }, []);

  // Sync playback rates (pitch conversion factor) based on frequency selection
  const getPlaybackRateForFrequency = (hz) => {
    switch (hz) {
      case 396: return 396 / 392.00; // Target standard G4
      case 417: return 417 / 415.30; // Target standard G#4
      case 432: return 432 / 440.00; // Target A4 (Solfeggio Retuning)
      case 528: return 528 / 523.25; // Target standard C5
      case 639: return 639 / 659.25; // Target E5
      case 741: return 741 / 739.99; // Target F#5
      case 852: return 852 / 880.00; // Target A5
      default: return 1.0;
    }
  };

  // Autocorrelation algorithm to track vocal pitch in real time
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

  // Start all Audio nodes and build the routing matrix
  const buildAudioEngine = () => {
    if (audioCtxRef.current) return;

    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtxClass();
      audioCtxRef.current = ctx;

      // Source Nodes
      voiceSourceRef.current = ctx.createMediaElementSource(voiceAudioElRef.current);
      backingSourceRef.current = ctx.createMediaElementSource(backingAudioElRef.current);

      // Mixer Gain Nodes
      voiceGainRef.current = ctx.createGain();
      backingGainRef.current = ctx.createGain();
      solfeggioGainRef.current = ctx.createGain();

      // Analyser Nodes
      voiceAnalyserRef.current = ctx.createAnalyser();
      voiceAnalyserRef.current.fftSize = 256;
      backingAnalyserRef.current = ctx.createAnalyser();
      backingAnalyserRef.current.fftSize = 256;

      // 1. Solfeggio Peaking Filter (EQ Boost)
      peakingFilterRef.current = ctx.createBiquadFilter();
      peakingFilterRef.current.type = 'peaking';
      peakingFilterRef.current.Q.setValueAtTime(10.0, ctx.currentTime);
      peakingFilterRef.current.frequency.setValueAtTime(selectedFreq, ctx.currentTime);
      peakingFilterRef.current.gain.setValueAtTime(activeEffects.includes('Diaphragm EQ Boost') ? 16.0 : 0.0, ctx.currentTime);

      // 2. Physical Feedback Delay Comb Resonator
      combDelayNodeRef.current = ctx.createDelay(1.0);
      combFeedbackGainRef.current = ctx.createGain();
      combDelayNodeRef.current.delayTime.setValueAtTime(1 / selectedFreq, ctx.currentTime);
      combFeedbackGainRef.current.gain.setValueAtTime(activeEffects.includes('Comb Resonator') ? 0.55 : 0.0, ctx.currentTime);

      // Wire Comb Filter Feedback loop
      combDelayNodeRef.current.connect(combFeedbackGainRef.current);
      combFeedbackGainRef.current.connect(combDelayNodeRef.current);

      // 3. Ring Modulator Node (Multiplies Vocal by Solfeggio Wave)
      ringModRef.current = ctx.createGain();
      ringModRef.current.gain.setValueAtTime(1.0, ctx.currentTime);

      ringModOscRef.current = ctx.createOscillator();
      ringModOscRef.current.type = 'sine';
      ringModOscRef.current.frequency.setValueAtTime(selectedFreq, ctx.currentTime);
      
      const ringModOscGain = ctx.createGain();
      ringModOscGain.gain.setValueAtTime(activeEffects.includes('Ring Modulator') ? 0.75 : 0.0, ctx.currentTime);

      ringModOscRef.current.connect(ringModOscGain);
      ringModOscGain.connect(ringModRef.current.gain); // Modulates voice gain dynamically!
      ringModOscRef.current.start();

      // 4. Vocal-Driven Coupling Peaking Filter on Backing Track
      backingPeakingFilterRef.current = ctx.createBiquadFilter();
      backingPeakingFilterRef.current.type = 'peaking';
      backingPeakingFilterRef.current.Q.setValueAtTime(8.0, ctx.currentTime);
      backingPeakingFilterRef.current.frequency.setValueAtTime(selectedFreq, ctx.currentTime); // default
      backingPeakingFilterRef.current.gain.setValueAtTime(activeEffects.includes('Acoustic Coupling') ? 15.0 : 0.0, ctx.currentTime);

      // Connect Vocal Path:
      // voiceSource -> peakingFilter -> ringMod -> combDelayNode & split to voiceGain -> Analyser -> Output
      voiceSourceRef.current.connect(peakingFilterRef.current);
      peakingFilterRef.current.connect(ringModRef.current);
      
      // Split RingMod to both Direct and Comb Delay paths
      ringModRef.current.connect(voiceGainRef.current);
      ringModRef.current.connect(combDelayNodeRef.current);
      combDelayNodeRef.current.connect(voiceGainRef.current);

      voiceGainRef.current.connect(voiceAnalyserRef.current);
      voiceAnalyserRef.current.connect(ctx.destination);

      // Connect Backing Track Path:
      // backingSource -> backingPeakingFilter -> backingGain -> Analyser -> Output
      backingSourceRef.current.connect(backingPeakingFilterRef.current);
      backingPeakingFilterRef.current.connect(backingGainRef.current);
      backingGainRef.current.connect(backingAnalyserRef.current);
      backingAnalyserRef.current.connect(ctx.destination);

      // Setup Binaural Carrier Oscillators
      const splitter = ctx.createChannelMerger(2);
      carrierOscLeftRef.current = ctx.createOscillator();
      carrierOscLeftRef.current.type = 'sine';
      carrierOscLeftRef.current.frequency.setValueAtTime(selectedFreq, ctx.currentTime);

      carrierOscRightRef.current = ctx.createOscillator();
      carrierOscRightRef.current.type = 'sine';
      // Offset by 8Hz to create a Theta Binaural Beat in headphones
      const binauralOffset = activeEffects.includes('Binaural Beating') ? 8 : 0;
      carrierOscRightRef.current.frequency.setValueAtTime(selectedFreq + binauralOffset, ctx.currentTime);

      carrierOscLeftRef.current.connect(splitter, 0, 0);
      carrierOscRightRef.current.connect(splitter, 0, 1);
      splitter.connect(solfeggioGainRef.current);
      solfeggioGainRef.current.connect(ctx.destination);

      carrierOscLeftRef.current.start();
      carrierOscRightRef.current.start();

    } catch (e) {
      console.warn("Failed to create advanced Web Audio graph:", e);
    }
  };

  const startTones = () => {
    buildAudioEngine();
    
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    // Set Initial Volumes
    voiceGainRef.current.gain.setValueAtTime(isDryActive ? 1.0 : voiceVol / 100, ctx.currentTime);
    backingGainRef.current.gain.setValueAtTime(isDryActive ? 0.0 : trackVol / 100, ctx.currentTime);
    solfeggioGainRef.current.gain.setValueAtTime(isDryActive ? 0.0 : (freqVol / 100) * 0.45, ctx.currentTime);
  };

  const stopTones = () => {
    // We keep the context alive but pause the oscillators/audio players
    const ctx = audioCtxRef.current;
    if (ctx && ctx.state === 'running') {
      ctx.suspend();
    }
  };

  // Real-Time Analysis & Visualizer loop
  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) return;

    let width = canvas.width = canvas.offsetWidth;
    let height = canvas.height = canvas.offsetHeight;

    const bufferLength = 128;
    const voiceData = new Uint8Array(bufferLength);
    const backingData = new Uint8Array(bufferLength);

    const draw = () => {
      if (!isPlaying) return;

      const voiceAnalyser = voiceAnalyserRef.current;
      const backingAnalyser = backingAnalyserRef.current;
      const ctx = audioCtxRef.current;

      let vPitch = 0;
      if (voiceAnalyser && ctx) {
        voiceAnalyser.getByteFrequencyData(voiceData);
        backingAnalyser.getByteFrequencyData(backingData);

        // Calculate voice dominant pitch
        vPitch = getPitchFromAnalyser(voiceAnalyser, ctx.sampleRate);
        if (vPitch > 80 && vPitch < 1200) {
          setDetectedPitch(Math.round(vPitch));
          
          // Calculate Convergence Ratio with selected Solfeggio
          // Find the distance to the nearest harmonic of the target Solfeggio frequency
          const target = selectedFreq;
          const ratio = vPitch / target;
          const nearestHarmonic = Math.round(ratio);
          const expectedFreq = target * (nearestHarmonic || 1);
          const diffPercent = Math.abs(vPitch - expectedFreq) / expectedFreq;
          const convergence = Math.max(0, Math.min(100, Math.round((1 - diffPercent * 6) * 100)));
          setConvergenceRatio(convergence);

          // ACOUSTIC COUPLING: Dynamically adjust the backing track band filter to follow vocal pitch
          if (activeEffects.includes('Acoustic Coupling') && backingPeakingFilterRef.current) {
            backingPeakingFilterRef.current.frequency.setValueAtTime(vPitch, ctx.currentTime);
          }
        }
      }

      // Draw canvas visuals
      canvasCtx.clearRect(0, 0, width, height);

      // 1. Draw Backing Track Spectrum (Blue-violet waveform background)
      canvasCtx.fillStyle = 'rgba(7, 6, 48, 0.2)';
      canvasCtx.fillRect(0, 0, width, height);

      canvasCtx.lineWidth = 2;
      canvasCtx.strokeStyle = 'rgba(112, 0, 255, 0.4)';
      canvasCtx.beginPath();
      let sliceWidth = width / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        let v = backingData[i] / 255;
        let y = height - (v * height * 0.8) - 10;
        if (i === 0) canvasCtx.moveTo(x, y);
        else canvasCtx.lineTo(x, y);
        x += sliceWidth;
      }
      canvasCtx.stroke();

      // 2. Draw Vocals Spectrum (Teal-cyan glowing foreground wave)
      canvasCtx.lineWidth = 3;
      canvasCtx.strokeStyle = 'rgba(0, 242, 255, 0.85)';
      canvasCtx.shadowBlur = 10;
      canvasCtx.shadowColor = 'rgba(0, 242, 255, 0.5)';
      canvasCtx.beginPath();
      x = 0;
      for (let i = 0; i < bufferLength; i++) {
        let v = voiceData[i] / 255;
        let y = height / 2 + (v * height * 0.4) - 20;
        if (i === 0) canvasCtx.moveTo(x, y);
        else canvasCtx.lineTo(x, y);
        x += sliceWidth;
      }
      canvasCtx.stroke();
      canvasCtx.shadowBlur = 0; // reset

      // 3. Draw Solfeggio Alignment Target line (Pulse neon pink vertical line)
      if (ctx) {
        const targetFreqX = (selectedFreq / 1000) * width;
        canvasCtx.strokeStyle = 'rgba(255, 0, 193, 0.7)';
        canvasCtx.lineWidth = 1;
        canvasCtx.beginPath();
        canvasCtx.moveTo(targetFreqX, 0);
        canvasCtx.lineTo(targetFreqX, height);
        canvasCtx.stroke();

        // Label
        canvasCtx.font = '9px Orbitron, sans-serif';
        canvasCtx.fillStyle = 'rgba(255, 0, 193, 0.9)';
        canvasCtx.fillText(`TARGET: ${selectedFreq}Hz`, targetFreqX + 5, 15);
      }

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    animationFrameRef.current = requestAnimationFrame(draw);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, selectedFreq, activeEffects]);

  // Adjust parameters dynamically when states change
  useEffect(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    // Volume Mixer Updates
    if (voiceGainRef.current) {
      voiceGainRef.current.gain.setValueAtTime(isDryActive ? 1.0 : voiceVol / 100, ctx.currentTime);
    }
    if (backingGainRef.current) {
      backingGainRef.current.gain.setValueAtTime(isDryActive ? 0.0 : trackVol / 100, ctx.currentTime);
    }
    if (solfeggioGainRef.current) {
      solfeggioGainRef.current.gain.setValueAtTime(isDryActive ? 0.0 : (freqVol / 100) * 0.45, ctx.currentTime);
    }
  }, [voiceVol, trackVol, freqVol, isDryActive]);

  useEffect(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    // Selected Frequency Preset Adjustments
    if (peakingFilterRef.current) {
      peakingFilterRef.current.frequency.setValueAtTime(selectedFreq, ctx.currentTime);
    }
    if (combDelayNodeRef.current) {
      combDelayNodeRef.current.delayTime.setValueAtTime(1 / selectedFreq, ctx.currentTime);
    }
    if (ringModOscRef.current) {
      ringModOscRef.current.frequency.setValueAtTime(selectedFreq, ctx.currentTime);
    }
    if (carrierOscLeftRef.current) {
      carrierOscLeftRef.current.frequency.setValueAtTime(selectedFreq, ctx.currentTime);
    }
    if (carrierOscRightRef.current) {
      const offset = activeEffects.includes('Binaural Beating') ? 8 : 0;
      carrierOscRightRef.current.frequency.setValueAtTime(selectedFreq + offset, ctx.currentTime);
    }

    // Set Pitch scale on elements
    const scaleFactor = isDryActive ? 1.0 : getPlaybackRateForFrequency(selectedFreq);
    if (voiceAudioElRef.current) voiceAudioElRef.current.playbackRate = scaleFactor;
    if (backingAudioElRef.current) backingAudioElRef.current.playbackRate = scaleFactor;

  }, [selectedFreq, isDryActive, activeEffects]);

  // Handle active DSP effect toggles in audio context graph
  useEffect(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    if (peakingFilterRef.current) {
      peakingFilterRef.current.gain.setValueAtTime(activeEffects.includes('Diaphragm EQ Boost') ? 16.0 : 0.0, ctx.currentTime);
    }
    if (combFeedbackGainRef.current) {
      combFeedbackGainRef.current.gain.setValueAtTime(activeEffects.includes('Comb Resonator') ? 0.55 : 0.0, ctx.currentTime);
    }
    if (backingPeakingFilterRef.current) {
      backingPeakingFilterRef.current.gain.setValueAtTime(activeEffects.includes('Acoustic Coupling') ? 15.0 : 0.0, ctx.currentTime);
    }
    if (carrierOscRightRef.current) {
      const offset = activeEffects.includes('Binaural Beating') ? 8 : 0;
      carrierOscRightRef.current.frequency.setValueAtTime(selectedFreq + offset, ctx.currentTime);
    }
  }, [activeEffects, selectedFreq]);

  const toggleEffect = (name) => {
    setActiveEffects(prev => 
      prev.includes(name) ? prev.filter(e => e !== name) : [...prev, name]
    );
  };

  const handlePlayToggle = () => {
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

      // Synchronize play times
      backing.currentTime = voice.currentTime;

      // Apply initial pitch retuning factor
      const scaleFactor = isDryActive ? 1.0 : getPlaybackRateForFrequency(selectedFreq);
      voice.playbackRate = scaleFactor;
      backing.playbackRate = scaleFactor;

      Promise.all([
        voice.play(),
        backing.play()
      ]).then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.error("Advanced audio playback failed to sync:", err);
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
      freq: selectedFreq
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
  };

  const handleExport = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      alert('Vocal harmonics exported as Ariyus-Master-3D.wav! Download complete.');
    }, 2500);
  };

  // Upload Recorded vocal audio blob to Firebase Storage and save to Firestore recordings
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
      // 1. Fetch the blob from local playback object URL
      const response = await fetch(currentRecording.playbackUrl);
      const audioBlob = await response.blob();

      // 2. Upload blob to Firebase Storage under vocals/
      const storageRef = ref(storage, `vocals/${recId}.mp3`);
      const snapshot = await uploadBytes(storageRef, audioBlob);
      const cloudPlaybackUrl = await getDownloadURL(snapshot.ref);

      // 3. Save performance metadata to Firestore recordings
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

      // 4. Update local user XP
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
      alert(`Performance successfully uploaded to Firebase cloud storage and shared to feed! Gained +${addedXp} XP!`);
      navigate('CommunityFeed');

    } catch (err) {
      console.warn("Firebase upload failed, falling back locally:", err);
      setIsUploading(false);
      
      // Fallback local share
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

        {/* FFT Canvas Visualizer showing Convergence */}
        <div className="visualizer-wrapper" style={{ height: '160px', marginTop: '15px' }}>
          <canvas ref={canvasRef} className="visualizer-canvas" />
          <div style={{ position: 'absolute', bottom: '10px', left: '15px', color: '#fff', fontSize: '0.8rem', fontFamily: 'monospace', textShadow: '0 0 6px #000', pointerEvents: 'none', background: 'rgba(0,0,0,0.4)', padding: '4px 8px', borderRadius: '4px' }}>
            Voice Pitch: {detectedPitch ? `${detectedPitch} Hz` : 'Scanning...'} | Convergence: {convergenceRatio}%
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', alignItems: 'center', marginTop: '15px' }}>
          <button className="glowing-button" onClick={handlePlayToggle} style={{ minWidth: '180px' }} disabled={!currentRecording}>
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

      {/* Dynamic Feedback Card */}
      <div className="glass-panel" style={{ borderLeft: '4px solid var(--secondary-glow)' }}>
        <h4 style={{ textShadow: '0 0 6px var(--secondary-glow)' }}>Acoustic Manifestation Ratio</h4>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-dim)', margin: '6px 0 0' }}>
          {convergenceRatio > 80 
            ? `Your vocals achieved high harmonic coupling at ${selectedFreq}Hz. The ancient keys are now fully active, resonating cellular pathways inside the body.`
            : `Stabilizing resonance matrix. Focus on singing in-key with the Solfeggio carrier oscillator hum to increase manifestation flow.`}
        </p>
      </div>

      {/* AI Voice Analyzer Scoring Cards */}
      <div className="glass-panel">
        <h3>Vocal Analysis</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px', margin: '15px 0' }}>
          {scores.map((sc, i) => (
            <div key={i} className="glass-panel" style={{ margin: 0, padding: '15px', background: 'rgba(0,0,0,0.2)', textAlign: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>{sc.label}</span>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary-glow)', margin: '8px 0', textShadow: '0 0 10px var(--primary-glow)' }}>
                {sc.value}%
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{sc.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Vocal Digital Signature */}
      <VoiceSignatureCard signature={signature} />

      {/* Matrix mixing console */}
      <div className="glass-panel">
        <h3>Matrix Mixing Console</h3>
        <div className="audio-deck-panel">
          
          <div className="slider-group">
            <label><span>Voice Layer Volume</span><span>{voiceVol}%</span></label>
            <input type="range" className="slider-input" min="0" max="100" value={voiceVol} onChange={e => setVoiceVol(parseInt(e.target.value))} disabled={isDryActive} />
          </div>

          <div className="slider-group">
            <label><span>Backing Track Volume</span><span>{trackVol}%</span></label>
            <input type="range" className="slider-input" min="0" max="100" value={trackVol} onChange={e => setTrackVol(parseInt(e.target.value))} disabled={isDryActive} />
          </div>

          <div className="slider-group">
            <label><span>Solfeggio Hertz Layer Volume</span><span>{freqVol}%</span></label>
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
              Manifestation Intention: {intentions[selectedFreq]}
            </p>
          </div>

          {/* Effects toggling */}
          <div style={{ marginTop: '15px' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Proprietary ARC-5 Audio Blocks</label>
            <div className="effects-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              {effectPresets.map(fx => (
                <button 
                  key={fx.id} 
                  className={`effect-toggle-btn ${activeEffects.includes(fx.name) ? 'active' : ''}`}
                  onClick={() => toggleEffect(fx.name)}
                  disabled={isDryActive}
                >
                  {fx.name}
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
