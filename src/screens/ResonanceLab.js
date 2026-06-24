import React, { useState, useEffect, useRef } from 'react';

const FrequencyLab = ({ navigate }) => {
  const [selectedHz, setSelectedHz] = useState(528);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(25);

  const audioCtxRef = useRef(null);
  const oscRef = useRef(null);
  const gainNodeRef = useRef(null);

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
    // Dynamic frequency adjustment
    if (isPlaying && oscRef.current && audioCtxRef.current) {
      oscRef.current.frequency.setValueAtTime(selectedHz, audioCtxRef.current.currentTime);
    }
  }, [selectedHz, isPlaying]);

  useEffect(() => {
    // Dynamic volume adjustment
    if (isPlaying && gainNodeRef.current && audioCtxRef.current) {
      const gainVal = (volume / 100) * 0.4;
      gainNodeRef.current.gain.setValueAtTime(gainVal, audioCtxRef.current.currentTime);
    }
  }, [volume, isPlaying]);

  useEffect(() => {
    // Stop tone when navigating away
    return () => {
      stopTone();
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Header */}
      <div>
        <h2 style={{ textShadow: '0 0 10px var(--primary-glow)', margin: 0 }}>Frequency Resonance Lab</h2>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', margin: '4px 0 0' }}>Explore Solfeggio soundscapes and align your inner frequencies</p>
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
          <div>
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
      <div className="glass-panel" style={{ borderLeft: `4px solid ${activeIntention.color}` }}>
        <h3 style={{ margin: 0, color: '#fff' }}>{activeIntention.title}</h3>
        <p style={{ marginTop: '8px', fontSize: '1rem', color: 'var(--text-dim)' }}>
          {activeIntention.desc}
        </p>
      </div>

      {/* Solfeggio Presets Grid */}
      <div className="glass-panel">
        <h3 style={{ marginBottom: '15px' }}>Solfeggio Resonance Scales</h3>
        <div className="frequency-grid">
          {solfeggioFrequencies.map((f) => (
            <div 
              key={f.hz} 
              className={`frequency-card ${selectedHz === f.hz ? 'active' : ''}`}
              onClick={() => setSelectedHz(f.hz)}
              style={{ 
                borderLeft: selectedHz === f.hz ? `4px solid ${f.color}` : '1px solid rgba(255,255,255,0.05)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="hz-badge" style={{ color: f.color, textShadow: `0 0 8px ${f.color}66` }}>{f.hz} Hz</span>
                {selectedHz === f.hz && <span style={{ color: f.color, fontSize: '0.8rem' }}>● Active</span>}
              </div>
              <h4 style={{ margin: '8px 0 4px 0', fontSize: '0.95rem', color: '#fff' }}>{f.title.split(' - ')[1]}</h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', margin: 0, lineStyle: '1.4' }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

export default FrequencyLab;
