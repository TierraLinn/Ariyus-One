import React, { useState, useEffect, useRef } from 'react';

const FrequencyLab = ({ navigate }) => {
  const [selectedHz, setSelectedHz] = useState(528);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(25);

  // Sound Generator Web Audio Refs
  const audioCtxRef = useRef(null);
  const oscRef = useRef(null);
  const gainNodeRef = useRef(null);

  // Vocal Scanner States
  const [isScanning, setIsScanning] = useState(false);
  const [scannedPitch, setScannedPitch] = useState(0);
  const [matchedHz, setMatchedHz] = useState(null);
  const [matchPercent, setMatchPercent] = useState(0);

  // Vocal Scanner Web Audio Refs
  const scanCtxRef = useRef(null);
  const scanStreamRef = useRef(null);
  const scanAnalyserRef = useRef(null);
  const scanCanvasRef = useRef(null);
  const scanAnimFrameRef = useRef(null);

  const solfeggioFrequencies = [
    { hz: 396, title: 'UT - Liberating Guilt & Fear', desc: 'Acoustic keys to release deep sub-conscious mental obstacles and guilt layers.', color: '#ff0055' },
    { hz: 417, title: 'RE - Undoing Situations', desc: 'Produces energy to clean traumatic patterns and support transformational changes.', color: '#ff6600' },
    { hz: 432, title: 'Natural Cosmic Vibration', desc: 'Matches natural cosmic harmonics, bringing clarity and calm to the acoustic model.', color: '#ffcc00' },
    { hz: 528, title: 'MI - Transformation & Miracles', desc: 'Known as the healing tone to spark cellular vitality and repair DNA helix elements.', color: '#00ff66' },
    { hz: 639, title: 'FA - Harmonic Connections', desc: 'Enhances relationship bonds, communications, and network coherence.', color: '#00ccff' },
    { hz: 741, title: 'SOL - Cleanse Expression', desc: 'Aids self-expression, toxic cleansing, and intuitive resolution keys.', color: '#0066ff' },
    { hz: 852, title: 'LA - Cosmic Order Sync', desc: 'Re-aligns local awareness with spiritual frameworks and absolute truth structures.', color: '#cc00ff' }
  ];

  const activeIntention = solfeggioFrequencies.find(f => f.hz === selectedHz) || {
    hz: selectedHz,
    title: 'Custom Frequency Resonance',
    desc: 'Unmapped acoustic spectrum node. Explore the response grid.',
    color: 'var(--primary-glow)'
  };

  // --- Sound Generator Code ---
  const startTone = () => {
    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtxClass();
      audioCtxRef.current = ctx;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(selectedHz, ctx.currentTime);
      
      const gainVal = (volume / 100) * 0.4;
      gain.gain.setValueAtTime(gainVal, ctx.currentTime);

      osc.connect(gain);
      gain.connect(ctx.destination);

      oscRef.current = osc;
      gainNodeRef.current = gain;
      osc.start();
      setIsPlaying(true);
    } catch (e) {
      console.error("Failed to play Solfeggio tone:", e);
    }
  };

  const stopTone = () => {
    if (oscRef.current) {
      try {
        oscRef.current.stop();
      } catch (e) {}
      oscRef.current = null;
    }
    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close();
      } catch (e) {}
      audioCtxRef.current = null;
    }
    setIsPlaying(false);
  };

  const handleTogglePlay = () => {
    if (isPlaying) stopTone();
    else startTone();
  };

  useEffect(() => {
    if (isPlaying && oscRef.current && audioCtxRef.current) {
      oscRef.current.frequency.setValueAtTime(selectedHz, audioCtxRef.current.currentTime);
    }
  }, [selectedHz, isPlaying]);

  useEffect(() => {
    if (isPlaying && gainNodeRef.current && audioCtxRef.current) {
      const gainVal = (volume / 100) * 0.4;
      gainNodeRef.current.gain.setValueAtTime(gainVal, audioCtxRef.current.currentTime);
    }
  }, [volume, isPlaying]);

  useEffect(() => {
    return () => {
      stopTone();
      stopVocalScanner();
    };
  }, []);

  // --- Vocal Tuning Scanner Code ---
  const getPitchFromStream = (analyser, sampleRate) => {
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

    // Autocorrelation Pitch Tracker
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

  const startVocalScanner = async () => {
    try {
      stopVocalScanner();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      scanStreamRef.current = stream;

      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtxClass();
      scanCtxRef.current = ctx;

      const sourceNode = ctx.createMediaStreamSource(stream);
      const analyserNode = ctx.createAnalyser();
      analyserNode.fftSize = 512;
      sourceNode.connect(analyserNode);
      scanAnalyserRef.current = analyserNode;

      setIsScanning(true);
      setScannedPitch(0);
      setMatchedHz(null);
      setMatchPercent(0);

      // Render Visualizer Loop
      const canvas = scanCanvasRef.current;
      if (!canvas) return;
      const canvasCtx = canvas.getContext('2d');
      if (!canvasCtx) return;

      const width = canvas.width = canvas.offsetWidth;
      const height = canvas.height = canvas.offsetHeight;
      const dataArray = new Uint8Array(analyserNode.frequencyBinCount);

      const scanDraw = () => {
        if (scanCtxRef.current?.state === 'closed') return;

        analyserNode.getByteTimeDomainData(dataArray);

        // Calculate pitch in real-time
        const pitch = getPitchFromStream(analyserNode, ctx.sampleRate);
        if (pitch > 80 && pitch < 1200) {
          setScannedPitch(Math.round(pitch));

          // Find closest Solfeggio frequency
          let closest = solfeggioFrequencies[0];
          let minDiff = Infinity;
          solfeggioFrequencies.forEach(f => {
            const ratio = pitch / f.hz;
            const nearestHarmonic = Math.round(ratio);
            const targetFreq = f.hz * (nearestHarmonic || 1);
            const diff = Math.abs(pitch - targetFreq);
            if (diff < minDiff) {
              minDiff = diff;
              closest = f;
            }
          });

          setMatchedHz(closest.hz);
          const ratio = pitch / closest.hz;
          const expectedFreq = closest.hz * (Math.round(ratio) || 1);
          const diffPercent = Math.abs(pitch - expectedFreq) / expectedFreq;
          const alignment = Math.max(0, Math.min(100, Math.round((1 - diffPercent * 6) * 100)));
          setMatchPercent(alignment);
        }

        // Draw mic waveform
        canvasCtx.fillStyle = 'rgba(7, 6, 48, 0.3)';
        canvasCtx.fillRect(0, 0, width, height);

        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = 'rgba(0, 242, 255, 0.85)';
        canvasCtx.shadowBlur = 8;
        canvasCtx.shadowColor = 'rgba(0, 242, 255, 0.4)';
        canvasCtx.beginPath();

        const sliceWidth = width / dataArray.length;
        let x = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * height) / 2;
          if (i === 0) canvasCtx.moveTo(x, y);
          else canvasCtx.lineTo(x, y);
          x += sliceWidth;
        }

        canvasCtx.lineTo(width, height / 2);
        canvasCtx.stroke();
        canvasCtx.shadowBlur = 0;

        scanAnimFrameRef.current = requestAnimationFrame(scanDraw);
      };

      scanAnimFrameRef.current = requestAnimationFrame(scanDraw);

    } catch (err) {
      console.warn("Could not capture microphone for scanning:", err);
      alert("Microphone permission required for Vocal Tuning Scan.");
      setIsScanning(false);
    }
  };

  const stopVocalScanner = () => {
    if (scanAnimFrameRef.current) {
      cancelAnimationFrame(scanAnimFrameRef.current);
    }
    if (scanStreamRef.current) {
      scanStreamRef.current.getTracks().forEach(track => track.stop());
      scanStreamRef.current = null;
    }
    if (scanCtxRef.current) {
      try {
        scanCtxRef.current.close();
      } catch (e) {}
      scanCtxRef.current = null;
    }
    setIsScanning(false);
    setScannedPitch(0);
    setMatchedHz(null);
    setMatchPercent(0);
  };

  const handleToggleScan = () => {
    if (isScanning) stopVocalScanner();
    else startVocalScanner();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Header */}
      <div>
        <h2 style={{ textShadow: '0 0 10px var(--primary-glow)', margin: 0 }}>Resonance Frequency Lab</h2>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', margin: '4px 0 0' }}>Explore Solfeggio soundscapes, generate signal tones, and scan your vocal alignment</p>
      </div>

      {/* Main Signal Generator Panel */}
      <div className="glass-panel" style={{ borderColor: isPlaying ? activeIntention.color : 'var(--glass-border)', boxShadow: isPlaying ? `0 0 25px ${activeIntention.color}44` : '' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Selected Frequency</span>
            <div className="hz-badge" style={{ fontSize: '3rem', color: isPlaying ? activeIntention.color : '#fff', textShadow: isPlaying ? `0 0 20px ${activeIntention.color}` : '' }}>
              {selectedHz} <span style={{ fontSize: '1.25rem' }}>Hz</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              className="glowing-button" 
              style={{ 
                minWidth: '180px',
                borderColor: isPlaying ? 'var(--secondary-glow)' : activeIntention.color,
                color: isPlaying ? 'var(--secondary-glow)' : activeIntention.color,
                boxShadow: isPlaying ? `0 0 15px var(--secondary-glow)` : `0 0 15px ${activeIntention.color}55`
              }}
              onClick={handleTogglePlay}
            >
              {isPlaying ? '⏹ Deactivate Signal' : '⚡ Activate Tone Hum'}
            </button>
          </div>
        </div>

        {/* Custom Hz Slider */}
        <div className="slider-group" style={{ marginTop: '20px' }}>
          <label><span>Manual Hertz Tuning</span><span>100Hz - 1000Hz</span></label>
          <input 
            type="range" 
            className="slider-input" 
            min="100" 
            max="1000" 
            value={selectedHz} 
            onChange={e => setSelectedHz(parseInt(e.target.value))} 
          />
        </div>

        {/* Volume Slider */}
        <div className="slider-group" style={{ marginTop: '15px' }}>
          <label><span>Signal Volume</span><span>{volume}%</span></label>
          <input 
            type="range" 
            className="slider-input" 
            min="0" 
            max="100" 
            value={volume} 
            onChange={e => setVolume(parseInt(e.target.value))} 
          />
        </div>
      </div>

      {/* Intention Details Card */}
      <div className="glass-panel" style={{ borderLeft: `4px solid ${activeIntention.color}`, margin: 0 }}>
        <h3 style={{ margin: 0, color: '#fff' }}>{activeIntention.title}</h3>
        <p style={{ marginTop: '8px', fontSize: '1rem', color: 'var(--text-dim)', margin: 0 }}>
          {activeIntention.desc}
        </p>
      </div>

      {/* Biofield Vocal Pitch Scanner */}
      <div className="glass-panel" style={{ borderColor: isScanning ? 'var(--primary-glow)' : 'var(--glass-border)', boxShadow: isScanning ? '0 0 15px rgba(0, 242, 255, 0.2)' : '', margin: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <h3 style={{ margin: 0, color: 'var(--primary-glow)' }}>Vocal Tuning Scanner</h3>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', margin: '4px 0 0' }}>Detect your throat's natural frequency and align it with a Solfeggio scale</p>
          </div>
          <button 
            className={`glowing-button ${isScanning ? 'secondary' : ''}`}
            onClick={handleToggleScan}
            style={{ margin: 0, minWidth: '160px' }}
          >
            {isScanning ? '⏹ Stop Scanner' : '🎙 Start Vocal Scan'}
          </button>
        </div>

        {isScanning && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', alignItems: 'center', marginTop: '15px' }}>
            {/* Live Waveform Canvas */}
            <div style={{ height: '100px', background: 'rgba(0,0,0,0.3)', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
              <canvas ref={scanCanvasRef} style={{ width: '100%', height: '100%' }} />
            </div>

            {/* Scanned Stats */}
            <div className="signature-card-grid" style={{ marginTop: 0, gridTemplateColumns: 'repeat(2, 1fr)' }}>
              <div className="sig-stat-box" style={{ background: 'rgba(0,0,0,0.2)' }}>
                <span className="title">Detected Pitch</span>
                <div className="val" style={{ color: 'var(--primary-glow)', fontSize: '1.8rem' }}>
                  {scannedPitch ? `${scannedPitch} Hz` : '---'}
                </div>
              </div>
              <div className="sig-stat-box" style={{ background: 'rgba(0,0,0,0.2)' }}>
                <span className="title">Alignment Match</span>
                <div className="val" style={{ color: 'var(--secondary-glow)', fontSize: '1.8rem' }}>
                  {matchedHz ? `${matchPercent}%` : '---'}
                </div>
              </div>
            </div>
          </div>
        )}

        {matchedHz && scannedPitch > 0 && (
          <div style={{ marginTop: '15px', borderLeft: '4px solid var(--primary-glow)', paddingLeft: '15px', background: 'rgba(0, 242, 255, 0.02)', padding: '10px 15px', borderRadius: '4px' }}>
            <h4 style={{ color: '#fff', fontSize: '0.95rem', margin: 0 }}>Matching Solfeggio Scale: <span style={{ color: 'var(--primary-glow)' }}>{matchedHz} Hz</span></h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', margin: '4px 0 0' }}>
              Your vocal vibration has achieved a {matchPercent}% resonance coupling with the <b>{solfeggioFrequencies.find(f => f.hz === matchedHz)?.title.split(' - ')[1]}</b> preset! Select this preset below to hum along.
            </p>
          </div>
        )}
      </div>

      {/* Solfeggio Presets Grid */}
      <div className="glass-panel" style={{ margin: 0 }}>
        <h3 style={{ marginBottom: '15px' }}>Solfeggio Resonance Scales</h3>
        <div className="frequency-grid">
          {solfeggioFrequencies.map((f) => {
            const isMatchedScanner = matchedHz === f.hz;
            return (
              <div 
                key={f.hz} 
                className={`frequency-card ${selectedHz === f.hz ? 'active' : ''}`}
                onClick={() => setSelectedHz(f.hz)}
                style={{ 
                  borderLeft: selectedHz === f.hz ? `4px solid ${f.color}` : '1px solid rgba(255,255,255,0.05)',
                  boxShadow: isMatchedScanner ? `0 0 12px ${f.color}66` : '',
                  borderColor: isMatchedScanner ? f.color : ''
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="hz-badge" style={{ color: f.color, textShadow: `0 0 8px ${f.color}66` }}>{f.hz} Hz</span>
                  {selectedHz === f.hz && <span style={{ color: f.color, fontSize: '0.8rem' }}>● Active</span>}
                  {isMatchedScanner && <span style={{ color: 'var(--primary-glow)', fontSize: '0.75rem', fontWeight: 'bold' }}>★ Scanner Match</span>}
                </div>
                <h4 style={{ margin: '8px 0 4px 0', fontSize: '0.95rem', color: '#fff' }}>{f.title.split(' - ')[1]}</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', margin: 0, lineStyle: '1.4' }}>{f.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};

export default FrequencyLab;
