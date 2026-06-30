import React, { useState, useEffect, useRef } from 'react';
import { getGrading, getPlaybackRateForFrequency } from '../utils/vocalDSP';

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

  // Audio elements
  const voiceAudioRef = useRef(null);
  const trackAudioRef = useRef(null);

  // Web Audio Context nodes
  const audioCtxRef = useRef(null);
  const voicePanNodeRef = useRef(null);
  const trackPanNodeRef = useRef(null);
  const voiceDelayNodeRef = useRef(null);
  const trackDelayNodeRef = useRef(null);

  const { selectedSong, score = 75, playbackUrl } = currentRecording || {};
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

    if (selectedFilter === 'studio') {
      const waveshaper = ctx.createWaveShaper();
      waveshaper.curve = makeDistortionCurve(40);
      vocalDelayNode.connect(waveshaper);
      waveshaper.connect(voicePanNode);
    } else if (selectedFilter === 'reverb') {
      const delay = ctx.createDelay();
      const feedback = ctx.createGain();
      delay.delayTime.setValueAtTime(0.35, ctx.currentTime);
      feedback.gain.setValueAtTime(0.4, ctx.currentTime);

      vocalDelayNode.connect(delay);
      delay.connect(feedback);
      feedback.connect(delay);

      vocalDelayNode.connect(voicePanNode);
      delay.connect(voicePanNode);
    } else if (selectedFilter === 'echo') {
      const delay = ctx.createDelay();
      const feedback = ctx.createGain();
      delay.delayTime.value = 0.5;
      feedback.gain.value = 0.6;

      vocalDelayNode.connect(delay);
      delay.connect(feedback);
      feedback.connect(delay);

      vocalDelayNode.connect(voicePanNode);
      delay.connect(voicePanNode);
    } else if (selectedFilter === 'denoise') {
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(80, ctx.currentTime);

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(1200, ctx.currentTime);

      vocalDelayNode.connect(hp);
      hp.connect(lp);
      lp.connect(voicePanNode);
    } else {
      vocalDelayNode.connect(voicePanNode);
    }

    voicePanNode.connect(ctx.destination);

    // Backing track routing
    trackSource.connect(trackDelayNode);
    trackDelayNode.connect(trackPanNode);
    trackPanNode.connect(ctx.destination);

    return () => {
      voiceAudio.pause();
      trackAudio.pause();
      if (ctx.state !== 'closed') {
        ctx.close();
      }
    };
  }, [playbackUrl, selectedSong, currentRecording, selectedFilter, vocalDelay]);

  // Handle mixing parameter updates
  useEffect(() => {
    if (voiceAudioRef.current) voiceAudioRef.current.volume = voiceVol / 100;
    if (trackAudioRef.current) trackAudioRef.current.volume = trackVol / 100;
  }, [voiceVol, trackVol]);

  useEffect(() => {
    if (voicePanNodeRef.current && voicePanNodeRef.current.pan) {
      voicePanNodeRef.current.pan.setValueAtTime(voicePan, audioCtxRef.current.currentTime);
    }
    if (trackPanNodeRef.current && trackPanNodeRef.current.pan) {
      trackPanNodeRef.current.pan.setValueAtTime(trackPan, audioCtxRef.current.currentTime);
    }
  }, [voicePan, trackPan]);

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

  // Handle Pitch shift adjustments via playback rates
  useEffect(() => {
    if (!voiceAudioRef.current || !trackAudioRef.current) return;
    const rate = getPlaybackRateForFrequency(selectedFreq);
    voiceAudioRef.current.playbackRate = rate;
    trackAudioRef.current.playbackRate = rate;
  }, [selectedFreq]);

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
      setIsPlaying(false);
    } else {
      if (audioCtxRef.current.state === 'suspended') {
        await audioCtxRef.current.resume();
      }
      trackAudioRef.current.currentTime = voiceAudioRef.current.currentTime;
      await Promise.all([
        voiceAudioRef.current.play(),
        trackAudioRef.current.play()
      ]);
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
          </div>
        </div>
      </div>

      {/* Retuning & Sharing Portal */}
      <div className="glass-panel" style={{ marginTop: '20px' }}>
        <h3>Solfeggio Retuning Calibration</h3>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px', marginTop: '10px' }}>
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
    </div>
  );
};

export default ResultsChamber;
