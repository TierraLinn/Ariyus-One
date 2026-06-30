import React, { useState, useEffect, useRef } from 'react';
import { getGrading, getPlaybackRateForFrequency } from '../utils/vocalDSP';

const ResultsChamber = ({ currentRecording, handleSaveAndShare, navigate }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [voiceVol, setVoiceVol] = useState(80);
  const [trackVol, setTrackVol] = useState(60);
  const [voicePan, setVoicePan] = useState(0); // -1 (Left) to 1 (Right)
  const [trackPan, setTrackPan] = useState(0);
  const [selectedFreq, setSelectedFreq] = useState(440); // Standard tuning
  const [caption, setCaption] = useState('');

  // Audio elements
  const voiceAudioRef = useRef(null);
  const trackAudioRef = useRef(null);

  // Web Audio Context for Panning & Pitch Shift
  const audioCtxRef = useRef(null);
  const voicePanNodeRef = useRef(null);
  const trackPanNodeRef = useRef(null);

  const { selectedSong, score = 75, playbackUrl } = currentRecording || {};
  const grade = getGrading(score);

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
    voiceSource.connect(voicePanNode);
    voicePanNode.connect(ctx.destination);

    const trackSource = ctx.createMediaElementSource(trackAudio);
    const trackPanNode = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
    trackPanNodeRef.current = trackPanNode;
    trackSource.connect(trackPanNode);
    trackPanNode.connect(ctx.destination);

    return () => {
      voiceAudio.pause();
      trackAudio.pause();
      if (ctx.state !== 'closed') {
        ctx.close();
      }
    };
  }, [playbackUrl, selectedSong, currentRecording]);

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
      caption: caption || "Aligned my frequencies to cosmic heights!"
    });
  };

  return (
    <div className="screen-wrapper">
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
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
            {/* Voice Faders */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--primary-glow)', marginBottom: '5px' }}>
                <span>Vocal Volume</span>
                <span>{voiceVol}%</span>
              </div>
              <input type="range" min="0" max="100" value={voiceVol} onChange={e => setVoiceVol(Number(e.target.value))} style={{ width: '100%' }} />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--primary-glow)', marginBottom: '5px' }}>
                <span>Vocal Stereo Panning</span>
                <span>{voicePan === 0 ? 'Center' : (voicePan < 0 ? `Left ${Math.abs(Math.round(voicePan * 100))}%` : `Right ${Math.round(voicePan * 100)}%`)}</span>
              </div>
              <input type="range" min="-1" max="1" step="0.1" value={voicePan} onChange={e => setVoicePan(parseFloat(e.target.value))} style={{ width: '100%' }} />
            </div>

            {/* Backing Track Faders */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--secondary-glow)', marginBottom: '5px' }}>
                <span>Backing Instrumental Volume</span>
                <span>{trackVol}%</span>
              </div>
              <input type="range" min="0" max="100" value={trackVol} onChange={e => setTrackVol(Number(e.target.value))} style={{ width: '100%' }} />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--secondary-glow)', marginBottom: '5px' }}>
                <span>Backing Panning</span>
                <span>{trackPan === 0 ? 'Center' : (trackPan < 0 ? `Left ${Math.abs(Math.round(trackPan * 100))}%` : `Right ${Math.round(trackPan * 100)}%`)}</span>
              </div>
              <input type="range" min="-1" max="1" step="0.1" value={trackPan} onChange={e => setTrackPan(parseFloat(e.target.value))} style={{ width: '100%' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Retuning & Sharing Portal */}
      <div className="glass-panel" style={{ marginTop: '20px' }}>
        <h3>Solfeggio Retuning Calibration</h3>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: '15px' }}>
          Shift the playback rate to align vocal files with organic cosmic tuning hertz properties.
        </p>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
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

        <h3>Publish to Collective Feed</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
          <input 
            type="text" 
            placeholder="Add caption (e.g. Aligned at 528Hz!)" 
            value={caption} 
            onChange={e => setCaption(e.target.value)} 
            className="comment-input"
            style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', color: '#fff', borderRadius: '8px' }}
          />

          <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
            <button className="glowing-button" onClick={publishToFeed} style={{ flexGrow: 1, margin: 0 }}>
              🚀 Sync Performance to Feed
            </button>
            <button className="glowing-button secondary" onClick={() => navigate('Home')} style={{ borderColor: 'var(--secondary-glow)', color: 'var(--secondary-glow)', margin: 0 }}>
              ❌ Scrap Recording
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResultsChamber;
