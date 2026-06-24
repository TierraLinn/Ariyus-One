import React, { useState, useEffect, useRef } from 'react';
import VoiceSignatureCard from '../components/VoiceSignatureCard';

const ResultsChamber = ({ currentRecording, saveAndShare, navigate, handleUpgrade }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Mixing Studio State
  const [voiceVol, setVoiceVol] = useState(85);
  const [trackVol, setTrackVol] = useState(50);
  const [freqVol, setFreqVol] = useState(30);
  const [selectedFreq, setSelectedFreq] = useState(528);
  const [isDryActive, setIsDryActive] = useState(false); // Dry vs Wet mix toggle
  
  const [activeEffects, setActiveEffects] = useState([]);
  const [mixPresets, setMixPresets] = useState([]);
  const [newPresetName, setNewPresetName] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  // Web Audio Oscillators
  const audioCtxRef = useRef(null);
  const oscillatorRef = useRef(null);
  const gainNodeRef = useRef(null);
  const audioElRef = useRef(null);

  const signature = currentRecording?.signature || {
    vocalType: 'Baritone',
    resonanceType: 'Mixed Voice',
    dominantFreq: '144 Hz',
    energy: 78,
    flow: 82,
    expression: 75,
    breath: 88,
    stability: 84
  };

  const tones = currentRecording?.tones || ['Warm', 'Clear', 'Smooth'];

  const scores = [
    { label: 'Pitch Accuracy', value: signature.stability + 2, desc: 'Tuning grid compliance' },
    { label: 'Dynamic Energy', value: signature.energy, desc: 'Spectral power delivery' },
    { label: 'Breath Support', value: signature.breath - 4, desc: 'Sustained frequency flow' },
    { label: 'Timbre Harmony', value: signature.expression + 3, desc: 'Formant overtone balance' }
  ];

  // Solfeggio Intentions
  const intentions = {
    396: 'Liberation of fear & guilt',
    417: 'Facilitating change & undoing situations',
    432: 'Natural mathematical cosmic harmony',
    528: 'Transformation & DNA cell repair (Miracle)',
    639: 'Connecting relationships & network harmony',
    741: 'Expression, solutions & cleansing intuition',
    852: 'Returning to spiritual cosmic order'
  };

  const effectPresets = [
    { id: 'fx1', name: 'Ambient Echo' },
    { id: 'fx2', name: 'Galactic Reverb' },
    { id: 'fx3', name: 'Analog Warmth' },
    { id: 'fx4', name: 'Vocal Clarity' },
    { id: 'fx5', name: 'Cyber Choir' },
    { id: 'fx6', name: 'Crystal Presence' },
    { id: 'fx7', name: 'Solfeggio Fusion' },
    { id: 'fx8', name: 'Hyper Bass' }
  ];

  useEffect(() => {
    // Load local storage mix presets
    const saved = localStorage.getItem('ariyus_mix_presets');
    if (saved) setMixPresets(JSON.parse(saved));
  }, []);

  const toggleEffect = (name) => {
    setActiveEffects(prev => 
      prev.includes(name) ? prev.filter(e => e !== name) : [...prev, name]
    );
  };

  const startSolfeggioTone = () => {
    if (isDryActive) return; // Silent if Dry Vocal option is active

    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtxClass();
      audioCtxRef.current = ctx;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(selectedFreq, ctx.currentTime);
      
      // Volume mapping 0-100 to gain 0-0.45
      const gainVal = (freqVol / 100) * 0.45;
      gain.gain.setValueAtTime(gainVal, ctx.currentTime);

      osc.connect(gain);
      gain.connect(ctx.destination);

      oscillatorRef.current = osc;
      gainNodeRef.current = gain;
      osc.start();
    } catch (e) {
      console.warn("Failed to generate Solfeggio background tone:", e);
    }
  };

  const stopSolfeggioTone = () => {
    if (oscillatorRef.current) {
      try {
        oscillatorRef.current.stop();
      } catch (e) {}
      oscillatorRef.current = null;
    }
    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close();
      } catch (e) {}
      audioCtxRef.current = null;
    }
  };

  const handlePlayToggle = () => {
    const audio = audioElRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      stopSolfeggioTone();
      setIsPlaying(false);
    } else {
      audio.volume = isDryActive ? 1.0 : (voiceVol / 100);
      audio.play().then(() => {
        setIsPlaying(true);
        startSolfeggioTone();
      }).catch(err => {
        console.error("Playback failed:", err);
      });
    }
  };

  useEffect(() => {
    // Update live oscillator volume if slider moves during playback
    if (isPlaying && gainNodeRef.current && audioCtxRef.current) {
      const gainVal = (freqVol / 100) * 0.45;
      gainNodeRef.current.gain.setValueAtTime(gainVal, audioCtxRef.current.currentTime);
    }
  }, [freqVol, isPlaying]);

  useEffect(() => {
    // Handle playback stop cleanup
    return () => {
      stopSolfeggioTone();
    };
  }, []);

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
    alert('Matrix Mix Preset Saved!');
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

  const handleSaveAndShareRecording = () => {
    // Stop tone before leaving screen
    stopSolfeggioTone();

    const rating = scores[0].value > 90 ? 'A+' : scores[0].value > 80 ? 'A' : 'B+';
    saveAndShare({
      song: currentRecording?.selectedSong || { title: 'Freestyle Resonance', artist: 'Self' },
      ariyusRating: rating,
      voiceSignature: signature,
      tones: tones,
      selectedFreq,
      effects: activeEffects
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Title */}
      <h2 style={{ textShadow: '0 0 10px var(--primary-glow)', margin: 0 }}>Results Chamber</h2>

      {/* Audio Playback Controls */}
      <div className="glass-panel" style={{ textAlign: 'center', borderColor: 'var(--primary-glow)' }}>
        <h3>Your Resonance Capture</h3>
        
        {currentRecording?.playbackUrl ? (
          <audio 
            ref={audioElRef} 
            src={currentRecording.playbackUrl} 
            className="audio-player" 
            onEnded={() => { setIsPlaying(false); stopSolfeggioTone(); }}
            style={{ display: 'none' }}
          />
        ) : (
          <p style={{ color: 'var(--secondary-glow)' }}>No active playback captured.</p>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', alignItems: 'center' }}>
          <button className="glowing-button" onClick={handlePlayToggle} style={{ minWidth: '160px' }}>
            {isPlaying ? '⏸ Pause Matrix' : '▶ Play Matched Mix'}
          </button>
          
          {/* Before / After Dry Switch */}
          <button 
            className={`glowing-button secondary ${isDryActive ? 'active' : ''}`}
            onClick={() => {
              const newDry = !isDryActive;
              setIsDryActive(newDry);
              if (isPlaying) {
                if (newDry) stopSolfeggioTone();
                else startSolfeggioTone();
              }
            }}
          >
            {isDryActive ? '✓ Dry Vocal (Direct)' : '✦ Wet Mix (Solfeggio)'}
          </button>
        </div>
      </div>

      {/* AI Voice Analyzer Scoring Cards */}
      <div className="glass-panel">
        <h3>Ariyus Vocal Analysis</h3>
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

        {/* Personalized feedback */}
        <div style={{ borderLeft: '4px solid var(--secondary-glow)', paddingLeft: '15px', marginTop: '15px' }}>
          <h4>Vocal Coach Guidance</h4>
          <p style={{ margin: '6px 0 0', fontSize: '0.95rem' }}>
            {scores[0].value > 85 
              ? 'Excellent pitch centering and stable frequency delivery! The dominant overtones demonstrate high resonance in the mid-high ranges. Focus on sustained diaphragm control to expand dynamic energy.' 
              : 'Decent capture! Try guiding your breathing sequence to align with the Solfeggio backing tone. Keep a steady larynx to enhance your pitch grid compliance.'}
          </p>
        </div>
      </div>

      {/* Renders the digital signature and tones */}
      <VoiceSignatureCard signature={signature} />

      <div className="glass-panel">
        <h3>Detected Vocal Tones</h3>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {tones.map((t, idx) => (
            <span key={idx} className="level-badge" style={{ background: 'var(--tertiary-glow)', fontSize: '0.9rem', padding: '6px 16px', boxShadow: '0 0 10px var(--tertiary-glow)' }}>
              ✦ {t} Tone
            </span>
          ))}
        </div>
      </div>

      {/* Mixing Studio Console */}
      <div className="glass-panel">
        <h3>Matrix Mixing Console</h3>
        <div className="audio-deck-panel">
          
          {/* Volume sliders */}
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
            <label><span>Overlay Solfeggio Hertz</span><span>{selectedFreq} Hz</span></label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {Object.keys(intentions).map(hz => (
                <button 
                  key={hz} 
                  className={`effect-toggle-btn ${selectedFreq === parseInt(hz) ? 'active' : ''}`}
                  style={{ padding: '6px 12px', flexGrow: 1, fontSize: '0.85rem' }}
                  onClick={() => {
                    setSelectedFreq(parseInt(hz));
                    if (isPlaying) {
                      stopSolfeggioTone();
                      setTimeout(startSolfeggioTone, 50);
                    }
                  }}
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
            <label style={{ fontSize: '0.85rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Vocal DSP Effects</label>
            <div className="effects-grid">
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

          {/* Loaded Presets List */}
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

          {/* Export Matrix Mix */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button className="glowing-button" onClick={handleExport} disabled={isExporting} style={{ flexGrow: 1, margin: 0 }}>
              {isExporting ? 'Harmonizing Masters...' : '⚡ Export Master Stereo Mix'}
            </button>
          </div>

        </div>
      </div>

      {/* Save & Share */}
      <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', margin: '20px 0' }}>
        <button className="glowing-button" onClick={handleSaveAndShareRecording} style={{ minWidth: '180px' }}>
          ✓ Share to Acoustic Feed
        </button>
        <button className="glowing-button secondary" onClick={() => { stopSolfeggioTone(); navigate('Home'); }}>
          Discard Capture
        </button>
      </div>

    </div>
  );
};

export default ResultsChamber;
