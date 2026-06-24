import React, { useState, useEffect, useRef } from 'react';


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

const WorkstationScreen = ({ userData, navigate }) => {
  const isPaidUser = userData?.tier !== 'Free';

  // --- DAW Track States ---
  const [tracks, setTracks] = useState([
    { id: 1, name: 'Vocal Track 1', type: 'vocal', volume: 80, pan: 0, mute: false, solo: false, isRecording: false, buffer: null, filename: '' },
    { id: 2, name: 'Backing Instrumental', type: 'backing', volume: 70, pan: 0, mute: false, solo: false, buffer: null, filename: '' },
    { id: 3, name: 'Solfeggio Osc Drone', type: 'osc', volume: 20, pan: 0, mute: false, solo: false, hz: 528, filename: 'Synth sine carrier' },
    { id: 4, name: 'Ambient Space Loop', type: 'sfx', volume: 40, pan: 0, mute: false, solo: false, buffer: null, filename: '' }
  ]);

  // --- Transport States ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [masterVolume, setMasterVolume] = useState(85);
  const [isMixdownRunning, setIsMixdownRunning] = useState(false);
  const [mixdownProgress, setMixdownProgress] = useState(0);
  const [limiterActive, setLimiterActive] = useState(true);
  const [selectedResonance, setSelectedResonance] = useState(528);

  // --- Web Audio Graph Refs ---
  const audioCtxRef = useRef(null);
  const activeSourcesRef = useRef({});
  const oscNodesRef = useRef({});
  const trackGainsRef = useRef({});
  const trackPannersRef = useRef({});
  const masterGainRef = useRef(null);

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

  // Get max timeline length
  const getTimelineDuration = () => {
    let max = 30; // base 30 seconds grid
    tracks.forEach(t => {
      if (t.buffer) {
        max = Math.max(max, t.buffer.duration);
      }
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
      masterGainRef.current.connect(audioCtxRef.current.destination);
    }
    return audioCtxRef.current;
  };

  // Sync master volume fader
  useEffect(() => {
    if (masterGainRef.current && audioCtxRef.current) {
      masterGainRef.current.gain.setValueAtTime((masterVolume / 100) * 0.8, audioCtxRef.current.currentTime);
    }
  }, [masterVolume]);

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

      // Re-configure oscillators dynamically if hz changes
      if (t.type === 'osc' && oscNodesRef.current[t.id] && isPlaying) {
        oscNodesRef.current[t.id].frequency.setValueAtTime(t.hz, ctx.currentTime);
      }
    });
  }, [tracks, isPlaying]);

  // --- Dynamic Waveform Renderer ---
  const drawWaveform = (trackId, buffer) => {
    const canvas = canvasRefs.current[trackId];
    if (!canvas) return;
    const canvasCtx = canvas.getContext('2d');
    const width = canvas.width = canvas.offsetWidth;
    const height = canvas.height = canvas.offsetHeight;

    canvasCtx.fillStyle = 'rgba(7, 6, 48, 0.4)';
    canvasCtx.fillRect(0, 0, width, height);

    if (!buffer) {
      // Draw empty timeline grid
      canvasCtx.strokeStyle = 'rgba(255,255,255,0.03)';
      canvasCtx.lineWidth = 1;
      for (let i = 50; i < width; i += 50) {
        canvasCtx.beginPath();
        canvasCtx.moveTo(i, 0);
        canvasCtx.lineTo(i, height);
        canvasCtx.stroke();
      }
      return;
    }

    const data = buffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    const amp = height / 2;

    canvasCtx.lineWidth = 1.5;
    canvasCtx.strokeStyle = trackId === 1 ? '#00f2ff' : trackId === 2 ? '#ff00c1' : '#00ff87';
    canvasCtx.shadowBlur = 4;
    canvasCtx.shadowColor = canvasCtx.strokeStyle;
    canvasCtx.beginPath();

    for (let i = 0; i < width; i++) {
      let min = 1.0;
      let max = -1.0;
      for (let j = 0; j < step; j++) {
        const datum = data[i * step + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
      canvasCtx.moveTo(i, (1 + min) * amp);
      canvasCtx.lineTo(i, (1 + max) * amp);
    }
    canvasCtx.stroke();
    canvasCtx.shadowBlur = 0;
  };

  // Draw initial blank grids
  useEffect(() => {
    if (isPaidUser) {
      tracks.forEach(t => {
        if (!t.buffer) drawWaveform(t.id, null);
      });
    }
  }, [isPaidUser, tracks]);

  // --- Transport Controls ---
  const playAll = () => {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    if (isPlaying) return;

    // Schedule sources
    const startOffset = pausedTimeRef.current;
    playbackStartTimeRef.current = ctx.currentTime - startOffset;

    tracks.forEach(t => {
      // 1. Build channel nodes
      const gainNode = ctx.createGain();
      const pannerNode = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
      
      const hasAnySolo = tracks.some(tr => tr.solo);
      let initialVolume = (t.volume / 100);
      if (t.mute || (hasAnySolo && !t.solo)) initialVolume = 0;
      
      gainNode.gain.setValueAtTime(initialVolume, ctx.currentTime);
      if (pannerNode.pan) pannerNode.pan.setValueAtTime(t.pan, ctx.currentTime);

      gainNode.connect(pannerNode);
      pannerNode.connect(masterGainRef.current);

      trackGainsRef.current[t.id] = gainNode;
      trackPannersRef.current[t.id] = pannerNode;

      // 2. Build sound sources
      if (t.buffer) {
        const source = ctx.createBufferSource();
        source.buffer = t.buffer;
        source.connect(gainNode);
        
        // Start buffer scheduling
        source.start(0, startOffset);
        activeSourcesRef.current[t.id] = source;
      } else if (t.type === 'osc') {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(t.hz, ctx.currentTime);
        osc.connect(gainNode);
        osc.start(0);
        oscNodesRef.current[t.id] = osc;
      }
    });

    setIsPlaying(true);

    // Playhead alignment timer
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
    
    // Stop all active audio nodes
    tracks.forEach(t => {
      if (activeSourcesRef.current[t.id]) {
        try { activeSourcesRef.current[t.id].stop(); } catch(e){}
        delete activeSourcesRef.current[t.id];
      }
      if (oscNodesRef.current[t.id]) {
        try { oscNodesRef.current[t.id].stop(); } catch(e){}
        delete oscNodesRef.current[t.id];
      }
    });

    setIsPlaying(false);
  };

  const stopAll = () => {
    clearInterval(timelineTimerRef.current);
    
    tracks.forEach(t => {
      if (activeSourcesRef.current[t.id]) {
        try { activeSourcesRef.current[t.id].stop(); } catch(e){}
        delete activeSourcesRef.current[t.id];
      }
      if (oscNodesRef.current[t.id]) {
        try { oscNodesRef.current[t.id].stop(); } catch(e){}
        delete oscNodesRef.current[t.id];
      }
    });

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
        
        setTracks(prev => prev.map(t => {
          if (t.id === trackId) {
            return { ...t, buffer: decodedBuffer, filename: file.name };
          }
          return t;
        }));

        drawWaveform(trackId, decodedBuffer);
      } catch (err) {
        console.error("Audio decode error:", err);
        alert("Failed to decode audio file. Make sure it is a valid MP3/WAV file.");
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // --- Microphone Recording directly to timeline track ---
  const handleToggleRecord = async (trackId) => {
    const track = tracks.find(t => t.id === trackId);
    if (!track) return;

    if (track.isRecording) {
      // STOP recording
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(tr => tr.stop());
      }
      setTracks(prev => prev.map(t => t.id === trackId ? { ...t, isRecording: false } : t));
    } else {
      // START recording
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
            
            setTracks(prev => prev.map(t => {
              if (t.id === trackId) {
                return { ...t, buffer: decoded, filename: `VocalCapture_${Date.now()}.wav` };
              }
              return t;
            }));
            drawWaveform(trackId, decoded);
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

      // Sound Forge Master Chain: Limiter / Compressor Node
      const limiter = offlineCtx.createDynamicsCompressor();
      limiter.threshold.setValueAtTime(limiterActive ? -1.0 : -0.1, offlineCtx.currentTime);
      limiter.knee.setValueAtTime(30, offlineCtx.currentTime);
      limiter.ratio.setValueAtTime(12, offlineCtx.currentTime);
      limiter.attack.setValueAtTime(0.003, offlineCtx.currentTime);
      limiter.release.setValueAtTime(0.08, offlineCtx.currentTime);
      limiter.connect(offlineCtx.destination);

      setMixdownProgress(40);

      // Mix track buffers to offline contexts
      tracks.forEach(t => {
        const hasAnySolo = tracks.some(tr => tr.solo);
        let trackGain = (t.volume / 100);
        if (t.mute || (hasAnySolo && !t.solo)) trackGain = 0;

        const gainNode = offlineCtx.createGain();
        gainNode.gain.setValueAtTime(trackGain, offlineCtx.currentTime);

        const pannerNode = offlineCtx.createStereoPanner ? offlineCtx.createStereoPanner() : offlineCtx.createGain();
        if (pannerNode.pan) pannerNode.pan.setValueAtTime(t.pan, offlineCtx.currentTime);

        gainNode.connect(pannerNode);
        pannerNode.connect(limiter);

        if (t.buffer) {
          const source = offlineCtx.createBufferSource();
          source.buffer = t.buffer;
          source.connect(gainNode);
          source.start(0);
        } else if (t.type === 'osc') {
          // Render Solfeggio carrier
          const osc = offlineCtx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(t.hz, offlineCtx.currentTime);
          osc.connect(gainNode);
          osc.start(0);
          osc.stop(renderDuration);
        }
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
        droneGain.connect(limiter);

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
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Brickwall Limiter:</span>
              <button 
                className={`daw-track-btn ${limiterActive ? 'active solo' : ''}`}
                onClick={() => setLimiterActive(!limiterActive)}
                style={{ fontSize: '0.65rem', padding: '2px 6px' }}
              >
                {limiterActive ? 'ACTIVE' : 'OFF'}
              </button>
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
                <div className="daw-track-buttons-row">
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
                    <label className="daw-track-btn" style={{ padding: '3px 8px', display: 'inline-block' }}>
                      Import Audio
                      <input 
                        type="file" 
                        accept="audio/*" 
                        onChange={e => handleFileUpload(t.id, e.target.files[0])}
                        style={{ display: 'none' }} 
                      />
                    </label>
                  )}
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
                <div className="daw-track-slider-group">
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
              </div>

              {/* Track Right Timeline Waveform */}
              <div className="daw-track-timeline">
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

    </div>
  );
};

export default WorkstationScreen;
