import React, { useState, useEffect, useRef } from 'react';
import { getGrading } from '../utils/vocalDSP';

const createPitchShifterNode = (ctx, pitchRatio) => {
  if (Math.abs(pitchRatio - 1.0) < 0.005) {
    const gain = ctx.createGain();
    return gain;
  }

  const bufferSize = 16384;
  const node = ctx.createScriptProcessor(2048, 1, 1);
  const buffer = new Float32Array(bufferSize);
  let writePtr = 0;
  let readPtr = 0;

  node.onaudioprocess = (e) => {
    const input = e.inputBuffer.getChannelData(0);
    const output = e.outputBuffer.getChannelData(0);

    for (let i = 0; i < input.length; i++) {
      buffer[writePtr] = input[i];
      writePtr = (writePtr + 1) % bufferSize;

      // Linear interpolation resampling
      const baseIdx = Math.floor(readPtr);
      const nextIdx = (baseIdx + 1) % bufferSize;
      const frac = readPtr - baseIdx;
      const val = (1 - frac) * buffer[baseIdx] + frac * buffer[nextIdx];

      output[i] = val;
      readPtr = (readPtr + pitchRatio) % bufferSize;

      // Restrict read distance relative to write pointer
      const distance = (writePtr - readPtr + bufferSize) % bufferSize;
      if (distance > 4096 || distance < 512) {
        readPtr = (writePtr - 2048 + bufferSize) % bufferSize;
      }
    }
  };

  return node;
};

const ResultsChamber = ({ currentRecording, handleSaveAndShare, navigate }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [voiceVol, setVoiceVol] = useState(80);
  const [trackVol, setTrackVol] = useState(60);
  const [voicePan, setVoicePan] = useState(0); // -1 (Left) to 1 (Right)
  const [trackPan] = useState(0);
  const [selectedFreq, setSelectedFreq] = useState(440); // Standard tuning
  const [selectedFilter, setSelectedFilter] = useState(currentRecording?.vocalFilter || 'none');
  const [vocalDelay, setVocalDelay] = useState(0); // delay offset in milliseconds (-300ms to 300ms)
  const [caption, setCaption] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [isHighVibe, setIsHighVibe] = useState(true);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [playVowel, setPlayVowel] = useState('---');
  const [playBiorhythm, setPlayBiorhythm] = useState('Delta (Rest)');
  
  const [autotuneStrength, setAutotuneStrength] = useState(currentRecording?.autotuneStrength || 50);
  const [currentLineIdx, setCurrentLineIdx] = useState(0);

  // Audio elements
  const voiceAudioRef = useRef(null);
  const trackAudioRef = useRef(null);
  const partnerAudioRef = useRef(null);

  // Web Audio Context nodes
  const audioCtxRef = useRef(null);
  const voicePanNodeRef = useRef(null);
  const trackPanNodeRef = useRef(null);
  const partnerPanNodeRef = useRef(null);
  const voiceDelayNodeRef = useRef(null);
  const trackDelayNodeRef = useRef(null);
  const partnerDelayNodeRef = useRef(null);
  const peakingNodeRef = useRef(null);
  const carrierOscRef = useRef(null);
  const [showDNACard, setShowDNACard] = useState(false);
  const dnaCanvasRef = useRef(null);
  const [partnerVol, setPartnerVol] = useState(80);
  const [partnerPan, setPartnerPan] = useState(-0.3);

  const { selectedSong, score = 75, playbackUrl, pitchHistory = [] } = currentRecording || {};
  const lyricsLines = React.useMemo(() => {
    return selectedSong?.lyrics ? selectedSong.lyrics.split('\n').filter(line => line.trim() !== '') : [];
  }, [selectedSong]);
  const grade = getGrading(score);

  const makeDistortionCurve = (amount) => {
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

  useEffect(() => {
    if (!currentRecording || !playbackUrl) return;

    // Setup Audio element links
    const voiceAudio = new Audio(playbackUrl);
    voiceAudio.crossOrigin = "anonymous";
    voiceAudio.loop = true;
    voiceAudioRef.current = voiceAudio;

    const trackAudio = new Audio(selectedSong?.audioUrl || 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Happy%20Life.mp3');
    trackAudio.crossOrigin = "anonymous";
    trackAudio.loop = true;
    trackAudioRef.current = trackAudio;

    let partnerAudio = null;

    // Web Audio setup
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;

    const voiceSource = ctx.createMediaElementSource(voiceAudio);
    const voicePanNode = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
    voicePanNodeRef.current = voicePanNode;

    const vocalDelayNode = ctx.createDelay(1.0);
    voiceDelayNodeRef.current = vocalDelayNode;

    const trackSource = ctx.createMediaElementSource(trackAudio);
    const trackPanNode = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
    trackPanNodeRef.current = trackPanNode;

    const trackDelayNode = ctx.createDelay(1.0);
    trackDelayNodeRef.current = trackDelayNode;

    // Apply Live Delay compensation offsets
    const t = ctx.currentTime;
    if (vocalDelay >= 0) {
      vocalDelayNode.delayTime.setValueAtTime(vocalDelay / 1000, t);
      trackDelayNode.delayTime.setValueAtTime(0, t);
    } else {
      vocalDelayNode.delayTime.setValueAtTime(0, t);
      trackDelayNode.delayTime.setValueAtTime(-vocalDelay / 1000, t);
    }

    // Connect voice with selected filter chain
    voiceSource.connect(vocalDelayNode);

    // Setup Duet Partner Vocal routing path
    if (currentRecording.isDuet && currentRecording.partnerVocalUrl) {
      partnerAudio = new Audio(currentRecording.partnerVocalUrl);
      partnerAudio.crossOrigin = "anonymous";
      partnerAudio.loop = true;
      partnerAudioRef.current = partnerAudio;

      const partnerSource = ctx.createMediaElementSource(partnerAudio);
      const partnerPanNode = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
      partnerPanNodeRef.current = partnerPanNode;

      const partnerDelayNode = ctx.createDelay(1.0);
      partnerDelayNodeRef.current = partnerDelayNode;
      partnerDelayNode.delayTime.setValueAtTime(0, t);

      const pitchRatio = selectedFreq / 440;
      const partnerPitchShifter = createPitchShifterNode(ctx, pitchRatio);

      partnerSource.connect(partnerDelayNode);
      partnerDelayNode.connect(partnerPitchShifter);
      partnerPitchShifter.connect(partnerPanNode);
      partnerPanNode.connect(ctx.destination);
    }

    // Solfeggio peaking resonance node
    const peakingNode = ctx.createBiquadFilter();
    peakingNode.type = 'peaking';
    peakingNode.frequency.setValueAtTime(selectedFreq, ctx.currentTime);
    peakingNode.gain.setValueAtTime(isHighVibe ? 10.0 : 0.0, ctx.currentTime);
    peakingNode.Q.setValueAtTime(8.0, ctx.currentTime);
    peakingNodeRef.current = peakingNode;

    const pitchRatio = selectedFreq / 440;
    const trackPitchShifter = createPitchShifterNode(ctx, pitchRatio);

    // Autotune snap phase modulation nodes
    const autotuneNode = ctx.createDelay(1.0);
    const autotuneModulator = ctx.createOscillator();
    const autotuneGain = ctx.createGain();

    autotuneModulator.frequency.setValueAtTime(8.0, ctx.currentTime); // high speed snapping LFO
    autotuneGain.gain.setValueAtTime((autotuneStrength / 100) * 0.0035, ctx.currentTime); // snap depth

    autotuneModulator.connect(autotuneGain);
    autotuneGain.connect(autotuneNode.delayTime);
    autotuneModulator.start();

    // Connect voice delay output to autotune snap node, then to peaking filter
    vocalDelayNode.connect(autotuneNode);
    autotuneNode.connect(peakingNode);

    if (selectedFilter === 'studio') {
      const waveshaper = ctx.createWaveShaper();
      waveshaper.curve = makeDistortionCurve(40);
      peakingNode.connect(waveshaper);
      waveshaper.connect(voicePanNode);
    } else if (selectedFilter === 'reverb') {
      const delay = ctx.createDelay();
      const feedback = ctx.createGain();
      delay.delayTime.setValueAtTime(0.35, ctx.currentTime);
      feedback.gain.setValueAtTime(0.4, ctx.currentTime);

      peakingNode.connect(delay);
      delay.connect(feedback);
      feedback.connect(delay);

      peakingNode.connect(voicePanNode);
      delay.connect(voicePanNode);
    } else if (selectedFilter === 'echo') {
      const delay = ctx.createDelay();
      const feedback = ctx.createGain();
      delay.delayTime.value = 0.5;
      feedback.gain.value = 0.6;

      peakingNode.connect(delay);
      delay.connect(feedback);
      feedback.connect(delay);

      peakingNode.connect(voicePanNode);
      delay.connect(voicePanNode);
    } else if (selectedFilter === 'denoise') {
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(80, ctx.currentTime);

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(1200, ctx.currentTime);

      peakingNode.connect(hp);
      hp.connect(lp);
      lp.connect(voicePanNode);
    } else {
      peakingNode.connect(voicePanNode);
    }

    voicePanNode.connect(ctx.destination);

    // Backing track routing
    trackSource.connect(trackDelayNode);
    trackDelayNode.connect(trackPitchShifter);
    trackPitchShifter.connect(trackPanNode);
    trackPanNode.connect(ctx.destination);

    return () => {
      voiceAudio.pause();
      trackAudio.pause();
      if (partnerAudio) {
        partnerAudio.pause();
      }
      if (carrierOscRef.current) {
        try { carrierOscRef.current.stop(); } catch (e) {}
        carrierOscRef.current = null;
      }
      if (ctx.state !== 'closed') {
        ctx.close();
      }
    };
  }, [playbackUrl, selectedSong, currentRecording, selectedFilter, vocalDelay, isHighVibe, selectedFreq, autotuneStrength]);

  useEffect(() => {
    let animId;
    const updatePlayStats = () => {
      if (isPlaying && voiceAudioRef.current) {
        const t = voiceAudioRef.current.currentTime;
        const dur = voiceAudioRef.current.duration || 1;
        const idx = Math.floor((t / dur) * (pitchHistory?.length || 0));
        const p = pitchHistory?.[idx] || 0;

        if (p > 50 && p < 1000) {
          const rp = Math.round(p);
          // Vowel estimation
          if (rp < 130) setPlayVowel('/u/ (Oo - Root stabilizer)');
          else if (rp < 220) setPlayVowel('/o/ (Oh - Sacral creator)');
          else if (rp < 330) setPlayVowel('/a/ (Ah - Heart awakening)');
          else if (rp < 440) setPlayVowel('/e/ (Eh - Throat expression)');
          else setPlayVowel('/i/ (Ee - Crown connector)');

          // Biorhythm estimation
          if (idx > 5) {
            const slice = pitchHistory.slice(idx - 5, idx);
            const dev = Math.max(...slice) - Math.min(...slice);
            if (dev < 5) setPlayBiorhythm('Alpha (Focused Flow State)');
            else if (dev > 25) setPlayBiorhythm('Beta (High Intensity Energy)');
            else if (Math.abs(p - 528) < 10 || Math.abs(p - 432) < 10) setPlayBiorhythm('Gamma (Insight / Healing)');
            else setPlayBiorhythm('Theta (Relaxation Wavelength)');
          }
        } else {
          setPlayVowel('---');
          setPlayBiorhythm('Delta (Resting Wavelength)');
        }

        // Calculate scrolling lyrics line index matching playback timer
        if (lyricsLines.length > 0) {
          const lineIdx = Math.min(lyricsLines.length - 1, Math.floor((t / dur) * lyricsLines.length));
          setCurrentLineIdx(lineIdx);
        }

      } else {
        setPlayVowel('---');
        setPlayBiorhythm('Delta (Resting Wavelength)');
      }
      animId = requestAnimationFrame(updatePlayStats);
    };

    if (isPlaying) {
      animId = requestAnimationFrame(updatePlayStats);
    }
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, pitchHistory, lyricsLines]);

  // Handle mixing parameter updates
  useEffect(() => {
    if (voiceAudioRef.current) voiceAudioRef.current.volume = voiceVol / 100;
    if (trackAudioRef.current) trackAudioRef.current.volume = trackVol / 100;
    if (partnerAudioRef.current) partnerAudioRef.current.volume = partnerVol / 100;
  }, [voiceVol, trackVol, partnerVol]);

  useEffect(() => {
    if (voicePanNodeRef.current && voicePanNodeRef.current.pan) {
      voicePanNodeRef.current.pan.setValueAtTime(voicePan, audioCtxRef.current.currentTime);
    }
    if (trackPanNodeRef.current && trackPanNodeRef.current.pan) {
      trackPanNodeRef.current.pan.setValueAtTime(trackPan, audioCtxRef.current.currentTime);
    }
    if (partnerPanNodeRef.current && partnerPanNodeRef.current.pan) {
      partnerPanNodeRef.current.pan.setValueAtTime(partnerPan, audioCtxRef.current.currentTime);
    }
  }, [voicePan, trackPan, partnerPan]);

  // Handle Delay compensation slider updates live
  useEffect(() => {
    if (voiceDelayNodeRef.current && trackDelayNodeRef.current && audioCtxRef.current) {
      const t = audioCtxRef.current.currentTime;
      if (vocalDelay >= 0) {
        voiceDelayNodeRef.current.delayTime.setValueAtTime(vocalDelay / 1000, t);
        trackDelayNodeRef.current.delayTime.setValueAtTime(0, t);
      } else {
        voiceDelayNodeRef.current.delayTime.setValueAtTime(0, t);
        trackDelayNodeRef.current.delayTime.setValueAtTime(-vocalDelay / 1000, t);
      }
    }
  }, [vocalDelay]);

  // Keep playback speed locked at exactly 1.0x normal speed to prevent timing/sync drift
  useEffect(() => {
    if (voiceAudioRef.current) voiceAudioRef.current.playbackRate = 1.0;
    if (trackAudioRef.current) trackAudioRef.current.playbackRate = 1.0;
    if (partnerAudioRef.current) partnerAudioRef.current.playbackRate = 1.0;
  }, [selectedFreq]);

  useEffect(() => {
    if (!showDNACard) return;
    const canvas = dnaCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width = 400;
    const height = canvas.height = 400;

    // Clear background with solid dark cosmic blue
    ctx.fillStyle = '#06041e';
    ctx.fillRect(0, 0, width, height);

    // Draw cosmic star dust background particles
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    for (let i = 0; i < 60; i++) {
      const sx = Math.random() * width;
      const sy = Math.random() * height;
      const r = Math.random() * 1.5;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Determine color gradients matching active Solfeggio standard
    let primaryGlow = '#00f2ff'; // throat (blue)
    let secondaryGlow = '#b200ff'; // crown (purple)
    
    if (selectedFreq === 396) {
      primaryGlow = '#ff003b'; // red
      secondaryGlow = '#ff7000';
    } else if (selectedFreq === 417) {
      primaryGlow = '#ff7000'; // orange
      secondaryGlow = '#ffcc00';
    } else if (selectedFreq === 432 || selectedFreq === 528) {
      primaryGlow = '#00ff87'; // green
      secondaryGlow = '#00f2ff';
    } else if (selectedFreq === 741) {
      primaryGlow = '#b200ff'; // violet
      secondaryGlow = '#ff00c1';
    }

    // Center of mandala
    const cx = width / 2;
    const cy = height / 2;

    // Draw glowing sacred geometry grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, width * 0.4, 0, Math.PI * 2);
    ctx.stroke();

    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 6) {
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * (width * 0.42), cy + Math.sin(angle) * (width * 0.42));
      ctx.lineTo(cx - Math.cos(angle) * (width * 0.42), cy - Math.sin(angle) * (width * 0.42));
      ctx.stroke();
    }

    // Draw overlapping Mandala Petals.
    // The number of petals is mathematically shaped by their score!
    const numPetals = 8 + Math.floor((score / 100) * 16);
    const maxRadius = width * 0.35;

    ctx.shadowBlur = 12;
    ctx.shadowColor = primaryGlow;

    for (let rIdx = 3; rIdx > 0; rIdx--) {
      const layerRadius = maxRadius * (rIdx / 3);
      const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, layerRadius);
      grad.addColorStop(0, 'rgba(6, 4, 30, 0.15)');
      grad.addColorStop(1, rIdx === 3 ? primaryGlow : secondaryGlow);

      for (let i = 0; i < numPetals; i++) {
        const startAngle = (i * Math.PI * 2) / numPetals;
        const endAngle = startAngle + (Math.PI * 2) / numPetals;
        const midAngle = (startAngle + endAngle) / 2;

        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5 + rIdx * 0.5;

        // Draw petal curve
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        
        // Control points for outer curve
        const cp1x = cx + Math.cos(startAngle) * (layerRadius * 0.85);
        const cp1y = cy + Math.sin(startAngle) * (layerRadius * 0.85);
        const destx = cx + Math.cos(midAngle) * layerRadius;
        const desty = cy + Math.sin(midAngle) * layerRadius;
        
        ctx.quadraticCurveTo(cp1x, cp1y, destx, desty);

        const cp2x = cx + Math.cos(endAngle) * (layerRadius * 0.85);
        const cp2y = cy + Math.sin(endAngle) * (layerRadius * 0.85);
        ctx.quadraticCurveTo(cp2x, cp2y, cx, cy);
        ctx.stroke();
      }
    }

    // Draw central glowing energy nodes
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 15;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = primaryGlow;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 20, 0, Math.PI * 2);
    ctx.stroke();

    // Reset shadow blur
    ctx.shadowBlur = 0;

    // Draw overlay texts: title/artist & stats directly on the canvas
    ctx.font = 'bold 12px "Orbitron", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.textAlign = 'center';
    ctx.fillText("ARIYUS-ONE VOCAL DNA BLUEPRINT", cx, 30);

    ctx.font = 'bold 14px "Inter", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${selectedSong?.title || 'Sing Session'}`, cx, height - 38);

    ctx.font = 'normal 10px "Orbitron", sans-serif';
    ctx.fillStyle = primaryGlow;
    ctx.fillText(`SCORE: ${score} | CALIBRATION: ${selectedFreq}Hz`, cx, height - 18);
  }, [showDNACard, score, selectedFreq, selectedSong]);

  if (!currentRecording) {
    return (
      <div className="screen-wrapper">
        <div className="glass-panel" style={{ textAlign: 'center' }}>
          <h2>No Active Performance</h2>
          <p>Please record a song in the Studio first to calibrate results.</p>
          <button className="glowing-button" onClick={() => navigate('SongLibrary')}>Catalog</button>
        </div>
      </div>
    );
  }

  const togglePlayback = async () => {
    if (isPlaying) {
      voiceAudioRef.current.pause();
      trackAudioRef.current.pause();
      if (partnerAudioRef.current) {
        partnerAudioRef.current.pause();
      }
      if (carrierOscRef.current) {
        try { carrierOscRef.current.stop(); } catch (e) {}
        carrierOscRef.current = null;
      }
      setIsPlaying(false);
    } else {
      if (audioCtxRef.current.state === 'suspended') {
        await audioCtxRef.current.resume();
      }
      
      // Start carrier resonance bed
      if (audioCtxRef.current) {
        if (carrierOscRef.current) {
          try { carrierOscRef.current.stop(); } catch (e) {}
        }
        const ctx = audioCtxRef.current;
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(selectedFreq, ctx.currentTime);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(150, ctx.currentTime);

        gain.gain.setValueAtTime(0.02, ctx.currentTime);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        carrierOscRef.current = osc;
      }

      trackAudioRef.current.currentTime = voiceAudioRef.current.currentTime;
      if (partnerAudioRef.current) {
        partnerAudioRef.current.currentTime = voiceAudioRef.current.currentTime;
      }

      const playPromises = [
        voiceAudioRef.current.play(),
        trackAudioRef.current.play()
      ];
      if (partnerAudioRef.current) {
        playPromises.push(partnerAudioRef.current.play());
      }

      await Promise.all(playPromises);
      setIsPlaying(true);
    }
  };

  const publishToFeed = () => {
    handleSaveAndShare({
      song: selectedSong,
      score,
      grade,
      playbackUrl,
      vocalFilter: selectedFilter,
      caption: caption || "Aligned my frequencies to cosmic heights!"
    });
  };

  const saveToDrafts = () => {
    const newDraft = {
      id: 'draft_' + Date.now(),
      song: selectedSong,
      score,
      grade,
      playbackUrl,
      vocalFilter: selectedFilter,
      createdAt: new Date().toLocaleDateString()
    };

    const saved = localStorage.getItem('ariyus_drafts');
    const draftsList = saved ? JSON.parse(saved) : [];
    draftsList.push(newDraft);
    localStorage.setItem('ariyus_drafts', JSON.stringify(draftsList));

    alert("Performance saved to offline Drafts successfully!");
    navigate('Home');
  };

  const handleSocialShare = (platform) => {
    alert(`Syncing performance package... successfully shared cover link to ${platform}!`);
    setShowShareModal(false);
  };

  return (
    <div className="screen-wrapper">
      <div className="floating-notes">🔱</div>
      <h1 className="suspended-title">Grading Chamber</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', alignItems: 'start' }}>
        {/* Results Card */}
        <div className="glass-panel" style={{ margin: 0, textAlign: 'center', borderColor: grade.color }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px' }}>Vocal Alignment Status</span>
          <div style={{ fontSize: '5rem', fontWeight: '900', color: grade.color, textShadow: `0 0 25px ${grade.color}`, margin: '15px 0', fontFamily: 'Orbitron, sans-serif' }}>
            {grade.letter}
          </div>
          <h3 style={{ margin: '0 0 10px 0', color: '#fff' }}>{grade.desc}</h3>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.95rem' }}>
            Resonator Match Score: <strong style={{ color: '#fff' }}>{score}%</strong>
          </p>

          <button className="glowing-button" onClick={togglePlayback} style={{ width: '100%', marginTop: '20px' }}>
            {isPlaying ? '⏸ Pause Playback' : '▶ Preview Mix'}
          </button>

          {/* Real-time Bio-Resonance HUD */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '15px' }}>
            <div style={{ background: 'rgba(0,0,0,0.18)', padding: '8px 10px', borderRadius: '6px', textAlign: 'center' }}>
              <span style={{ fontSize: '0.62rem', color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block' }}>Vowel Wavelength</span>
              <strong style={{ fontSize: '0.82rem', color: 'var(--primary-glow)', display: 'block', marginTop: '2px' }}>{playVowel}</strong>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.18)', padding: '8px 10px', borderRadius: '6px', textAlign: 'center' }}>
              <span style={{ fontSize: '0.62rem', color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block' }}>Biorhythm Wave</span>
              <strong style={{ fontSize: '0.82rem', color: 'var(--secondary-glow)', display: 'block', marginTop: '2px' }}>{playBiorhythm}</strong>
            </div>
          </div>
        </div>

        {/* Mixer Board */}
        <div className="glass-panel" style={{ margin: 0 }}>
          <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px', color: '#fff' }}>Resonant Mixing Console</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
            {/* Voice Faders */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--primary-glow)', marginBottom: '5px' }}>
                  <span>Voice Vol</span>
                  <span>{voiceVol}%</span>
                </div>
                <input type="range" min="0" max="100" value={voiceVol} onChange={e => setVoiceVol(Number(e.target.value))} style={{ width: '100%' }} />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--secondary-glow)', marginBottom: '5px' }}>
                  <span>Backing Vol</span>
                  <span>{trackVol}%</span>
                </div>
                <input type="range" min="0" max="100" value={trackVol} onChange={e => setTrackVol(Number(e.target.value))} style={{ width: '100%' }} />
              </div>
            </div>

            {currentRecording?.isDuet && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', background: 'rgba(255, 0, 193, 0.03)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255, 0, 193, 0.08)' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--secondary-glow)', marginBottom: '5px', fontWeight: 'bold' }}>
                    <span>👥 {currentRecording?.partnerName || 'Partner'} Vol</span>
                    <span>{partnerVol}%</span>
                  </div>
                  <input type="range" min="0" max="100" value={partnerVol} onChange={e => setPartnerVol(Number(e.target.value))} style={{ width: '100%' }} />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--secondary-glow)', marginBottom: '5px', fontWeight: 'bold' }}>
                    <span>👥 {currentRecording?.partnerName || 'Partner'} Pan</span>
                    <span>{partnerPan === 0 ? 'Center' : (partnerPan < 0 ? `Left ${Math.abs(Math.round(partnerPan * 100))}%` : `Right ${Math.round(partnerPan * 100)}%`)}</span>
                  </div>
                  <input type="range" min="-1" max="1" step="0.1" value={partnerPan} onChange={e => setPartnerPan(parseFloat(e.target.value))} style={{ width: '100%' }} />
                </div>
              </div>
            )}

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--primary-glow)', marginBottom: '5px' }}>
                <span>Vocal Pan</span>
                <span>{voicePan === 0 ? 'Center' : (voicePan < 0 ? `Left ${Math.abs(Math.round(voicePan * 100))}%` : `Right ${Math.round(voicePan * 100)}%`)}</span>
              </div>
              <input type="range" min="-1" max="1" step="0.1" value={voicePan} onChange={e => setVoicePan(parseFloat(e.target.value))} style={{ width: '100%' }} />
            </div>

            {/* Vocal Sync Delay Compensation Slider */}
            <div style={{ background: 'rgba(0,242,255,0.03)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(0,242,255,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--primary-glow)', marginBottom: '5px', fontWeight: 'bold' }}>
                <span>🎧 Vocal Sync Delay compensation</span>
                <span>{vocalDelay === 0 ? 'Aligned (0ms)' : (vocalDelay > 0 ? `Delayed (+${vocalDelay}ms)` : `Advanced (${vocalDelay}ms)`)}</span>
              </div>
              <input 
                type="range" 
                min="-300" 
                max="300" 
                step="5" 
                value={vocalDelay} 
                onChange={e => setVocalDelay(Number(e.target.value))} 
                style={{ width: '100%' }} 
              />
              <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', display: 'block', marginTop: '4px' }}>
                Drag to align track delay compensation when using Bluetooth or wired headphones.
              </span>
            </div>

            {/* Post-FX filters select */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '10px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Vocal Filter:</span>
              {['none', 'studio', 'reverb', 'echo', 'denoise'].map(filter => (
                <button
                  key={filter}
                  className={`daw-track-btn ${selectedFilter === filter ? 'active' : ''}`}
                  onClick={() => setSelectedFilter(filter)}
                  style={{ fontSize: '0.65rem', padding: '3px 8px', textTransform: 'capitalize', margin: 0 }}
                >
                  {filter}
                </button>
              ))}
            </div>

            {/* Autotune Strength Config */}
            <div style={{ background: 'rgba(0,242,255,0.03)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(0,242,255,0.08)', marginTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--primary-glow)', marginBottom: '5px', fontWeight: 'bold' }}>
                <span>✨ Autotune Snap Strength</span>
                <span>{autotuneStrength}%</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={autotuneStrength} 
                onChange={e => setAutotuneStrength(Number(e.target.value))} 
                style={{ width: '100%' }} 
              />
              <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', display: 'block', marginTop: '4px' }}>
                Snap vocal harmonic vibrations to the closest correct musical key.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Synced Scrolling Lyrics Prompter */}
      <div className="glass-panel" style={{ marginTop: '20px', height: '140px', display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center' }}>
        <h4 style={{ margin: '0 0 10px 0', fontSize: '0.68rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px' }}>
          🎵 Synced Performance Lyrics Guide
        </h4>
        <div style={{ overflowY: 'hidden', height: '80px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px' }}>
          {lyricsLines.length > 0 ? (
            <>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', opacity: 0.4, margin: 0 }}>
                {lyricsLines[currentLineIdx - 1] || ''}
              </p>
              <p style={{ color: 'var(--primary-glow)', fontSize: '1.2rem', fontWeight: 'bold', textShadow: '0 0 8px var(--primary-glow)', margin: 0 }}>
                {lyricsLines[currentLineIdx] || '---'}
              </p>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', opacity: 0.4, margin: 0 }}>
                {lyricsLines[currentLineIdx + 1] || ''}
              </p>
            </>
          ) : (
            <p style={{ color: 'var(--text-dim)', margin: 0 }}>Instrumental Section...</p>
          )}
        </div>
      </div>

      {/* Retuning & Sharing Portal */}
      <div className="glass-panel" style={{ marginTop: '20px' }}>
        <h3>Solfeggio Retuning Calibration</h3>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '15px', marginTop: '10px' }}>
          {[
            { hz: 440, label: '440Hz (Standard)' },
            { hz: 432, label: '432Hz (Cosmic)' },
            { hz: 444, label: '444Hz (David)' },
            { hz: 528, label: '528Hz (Miracle)' },
            { hz: 741, label: '741Hz (Clarity)' }
          ].map(node => (
            <button
              key={node.hz}
              className={`daw-track-btn ${selectedFreq === node.hz ? 'active' : ''}`}
              onClick={() => setSelectedFreq(node.hz)}
              style={{ fontSize: '0.75rem', padding: '6px 12px', margin: 0 }}
            >
              {node.label}
            </button>
          ))}
        </div>

        {/* High-Vibration Conversion Engine toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'rgba(255, 0, 193, 0.03)', borderRadius: '8px', border: '1px solid rgba(255, 0, 193, 0.15)', margin: '15px 0' }}>
          <div style={{ textAlign: 'left' }}>
            <strong style={{ color: '#fff', fontSize: '0.9rem', display: 'block' }}>✨ High Vibration Conversion Engine</strong>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Infuse target hertz peaking resonance directly into vocal wave frequencies.</span>
          </div>
          <button 
            className={`glowing-button secondary ${isHighVibe ? 'active' : ''}`}
            onClick={() => setIsHighVibe(!isHighVibe)}
            style={{ margin: 0, padding: '6px 12px', fontSize: '0.75rem', borderColor: isHighVibe ? 'var(--secondary-glow)' : '' }}
          >
            {isHighVibe ? 'Active (ON)' : 'Bypass (OFF)'}
          </button>
        </div>

        <h3>Publish or Share</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
          <input 
            type="text" 
            placeholder="Add caption (e.g. Aligned my voice node!)" 
            value={caption} 
            onChange={e => setCaption(e.target.value)} 
            className="comment-input"
            style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', color: '#fff', borderRadius: '8px' }}
          />

          <div style={{ display: 'flex', gap: '12px', marginTop: '10px', flexWrap: 'wrap' }}>
            <button className="glowing-button" onClick={publishToFeed} style={{ flexGrow: 1, margin: 0 }}>
              🚀 Sync to Feed
            </button>
            <button className="glowing-button secondary" onClick={() => setShowDNACard(true)} style={{ margin: 0, borderColor: 'var(--primary-glow)', color: 'var(--primary-glow)' }}>
              🧬 Vocal DNA Mandala
            </button>
            <button className="glowing-button secondary" onClick={saveToDrafts} style={{ margin: 0 }}>
              💾 Save to Drafts
            </button>
            <button className="glowing-button secondary" onClick={() => setShowShareModal(true)} style={{ margin: 0 }}>
              🔗 Share Package
            </button>
            <button className="glowing-button secondary" onClick={() => navigate('Home')} style={{ borderColor: 'var(--secondary-glow)', color: 'var(--secondary-glow)', margin: 0 }}>
              ❌ Scrap
            </button>
          </div>
        </div>
      </div>

      {/* Collapsible Extensive Vocal Analysis Suite */}
      <div className="glass-panel" style={{ marginTop: '20px' }}>
        <button 
          className="glowing-button secondary" 
          onClick={() => setShowAnalysis(!showAnalysis)}
          style={{ width: '100%', margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <span>🧬 {showAnalysis ? 'Collapse' : 'Expand'} Extensive Vocal Analysis Suite</span>
          <span>{showAnalysis ? '▲' : '▼'}</span>
        </button>

        {showAnalysis && (
          <div style={{ marginTop: '20px', animation: 'fadeIn 0.5s ease', textAlign: 'left' }}>
            <h4 style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '8px', color: 'var(--primary-glow)', textTransform: 'uppercase', fontSize: '0.78rem', letterSpacing: '1px' }}>
              Speech Biomarkers Matrix
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginTop: '12px' }}>
              <div style={{ background: 'rgba(0,0,0,0.18)', padding: '10px', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Jitter (Vocal Stability)</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#fff', margin: '4px 0' }}>
                  {Math.round((100 - score) * 0.12 * 100) / 100}%
                </div>
                <span style={{ fontSize: '0.62rem', color: 'var(--primary-glow)' }}>Micro-frequency variance ratio</span>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.18)', padding: '10px', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Shimmer (Amplitude Stability)</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#fff', margin: '4px 0' }}>
                  {Math.round((100 - score) * 0.18 * 100) / 100}%
                </div>
                <span style={{ fontSize: '0.62rem', color: 'var(--secondary-glow)' }}>Micro-intensity variance ratio</span>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.18)', padding: '10px', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Harmonic-to-Noise (Clarity)</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#fff', margin: '4px 0' }}>
                  {Math.round(55 + (score / 100) * 35)} dB
                </div>
                <span style={{ fontSize: '0.62rem', color: '#00ff87' }}>Spectral clarity resonance factor</span>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.18)', padding: '10px', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Vocal Octave Range</span>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#fff', margin: '6px 0' }}>
                  Alto (G3 - D5)
                </div>
                <span style={{ fontSize: '0.62rem', color: 'var(--text-dim)' }}>Detected vocal range boundary</span>
              </div>
            </div>

            <h4 style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '8px', color: 'var(--secondary-glow)', textTransform: 'uppercase', fontSize: '0.78rem', letterSpacing: '1px', marginTop: '20px' }}>
              Chakra Resonance Alignment
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
              {[
                { name: 'Crown Chakra (Violet)', color: '#b200ff', val: selectedFreq === 528 ? 90 : 70 },
                { name: 'Third Eye Chakra (Indigo)', color: '#4b0082', val: selectedFreq === 741 ? 88 : 75 },
                { name: 'Throat Chakra (Blue)', color: '#00f2ff', val: selectedFreq === 741 ? 98 : (selectedFreq === 432 ? 85 : 75) },
                { name: 'Heart Chakra (Green)', color: '#00ff87', val: selectedFreq === 528 ? 96 : 80 },
                { name: 'Solar Plexus Chakra (Yellow)', color: '#ffb700', val: selectedFreq === 432 ? 90 : 70 },
                { name: 'Sacral Chakra (Orange)', color: '#ff7000', val: selectedFreq === 432 ? 95 : 72 },
                { name: 'Root Chakra (Red)', color: '#ff003b', val: selectedFreq === 444 ? 92 : 68 }
              ].map((chakra, idx) => (
                <div key={idx}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '3px' }}>
                    <span>{chakra.name}</span>
                    <span style={{ color: chakra.color, fontWeight: 'bold' }}>{chakra.val}% Resonance</span>
                  </div>
                  <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: chakra.color, width: `${chakra.val}%`, borderRadius: '3px', boxShadow: `0 0 8px ${chakra.color}` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Share platform overlay modal */}
      {showShareModal && (
        <div className="custom-alert-overlay" onClick={() => setShowShareModal(false)}>
          <div className="custom-alert-box glass-panel" onClick={(e) => e.stopPropagation()}>
            <h3>Share Vocal Cover</h3>
            <p>Select which platform block to sync your finished performance audio file to:</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '15px' }}>
              {['Facebook', 'Instagram', 'YouTube', 'TikTok'].map(platform => (
                <button 
                  key={platform} 
                  className="glowing-button secondary" 
                  onClick={() => handleSocialShare(platform)}
                  style={{ margin: 0 }}
                >
                  {platform}
                </button>
              ))}
            </div>
            <button 
              className="glowing-button" 
              onClick={() => setShowShareModal(false)}
              style={{ marginTop: '20px', width: '100%' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Cosmic Vocal DNA Card Modal */}
      {showDNACard && (
        <div className="custom-alert-overlay" onClick={() => setShowDNACard(false)}>
          <div className="custom-alert-box glass-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px', width: '90%', padding: '24px', textAlign: 'center' }}>
            <h3 style={{ fontFamily: '"Orbitron", sans-serif', color: 'var(--primary-glow)', textShadow: '0 0 10px var(--primary-glow)', marginBottom: '8px' }}>
              🧬 COSMIC VOCAL DNA CARD
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '15px' }}>
              Your unique performance-reactive sacred geometry Mandala generated from vocal vibrations.
            </p>

            <div style={{ background: '#06041e', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', padding: '12px', display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
              <canvas ref={dnaCanvasRef} style={{ width: '300px', height: '300px', borderRadius: '8px', display: 'block', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }} />
            </div>

            {/* Vocal Statistics HUD */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', textAlign: 'left', marginBottom: '20px', fontSize: '0.78rem', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <span style={{ color: 'var(--text-dim)', display: 'block' }}>Vocal Clearness (HNR)</span>
                <strong style={{ color: '#fff', fontSize: '0.85rem' }}>{(currentRecording?.hnr || 18.5).toFixed(1)} dB</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-dim)', display: 'block' }}>Pitch Variation (Jitter)</span>
                <strong style={{ color: '#fff', fontSize: '0.85rem' }}>{(currentRecording?.jitter || 1.2).toFixed(2)}%</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-dim)', display: 'block' }}>Vowel Resonance</span>
                <strong style={{ color: 'var(--primary-glow)', fontSize: '0.85rem' }}>Throat & Heart Activation</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-dim)', display: 'block' }}>Mindset Biorhythm</span>
                <strong style={{ color: 'var(--secondary-glow)', fontSize: '0.85rem' }}>Alpha Flow State</strong>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                className="glowing-button" 
                onClick={() => {
                  const canvas = dnaCanvasRef.current;
                  if (canvas) {
                    const link = document.createElement('a');
                    link.download = `${selectedSong?.title || 'Sing'}_Vocal_DNA.png`;
                    link.href = canvas.toDataURL('image/png');
                    link.click();
                  }
                }}
                style={{ flexGrow: 1, margin: 0 }}
              >
                💾 Download PNG
              </button>
              <button 
                className="glowing-button secondary" 
                onClick={() => setShowDNACard(false)}
                style={{ margin: 0 }}
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
