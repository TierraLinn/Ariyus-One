import React, { useState, useEffect } from 'react';
import VoiceSignatureCard from '../components/VoiceSignatureCard';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

const Profile = ({ userData, handleSignOut, navigate, theme, setTheme }) => {
  const [recordings, setRecordings] = useState([]);
  const [playingId, setPlayingId] = useState(null);
  const audioRef = React.useRef(null);

  const {
    displayName = 'Aura Singer',
    tier = 'Free',
    xp = 120,
    voiceSignature = null
  } = userData || {};

  // Level computation matching HomeNexus
  const getJourneyRank = (currentXp) => {
    if (currentXp < 100) return { rank: 'Seeker', nextRank: 'Resonator', minXp: 0, maxXp: 100 };
    if (currentXp < 300) return { rank: 'Resonator', nextRank: 'Harmonizer', minXp: 100, maxXp: 300 };
    if (currentXp < 600) return { rank: 'Harmonizer', nextRank: 'Alchemist', minXp: 300, maxXp: 600 };
    if (currentXp < 1000) return { rank: 'Alchemist', nextRank: 'Luminary', minXp: 600, maxXp: 1000 };
    return { rank: 'Luminary', nextRank: 'Max LevelReached', minXp: 1000, maxXp: 1000 };
  };

  const currentLevelInfo = getJourneyRank(xp);
  const totalRankRange = currentLevelInfo.maxXp - currentLevelInfo.minXp;
  const rankProgress = totalRankRange > 0 ? ((xp - currentLevelInfo.minXp) / totalRankRange) * 100 : 100;

  useEffect(() => {
    if (!userData) return;

    const loadUserRecordings = async () => {
      try {
        const q = query(collection(db, "recordings"), where("userId", "==", userData.uid));
        const querySnapshot = await getDocs(q);
        const userRecs = [];
        querySnapshot.forEach((docSnap) => {
          userRecs.push({ id: docSnap.id, ...docSnap.data() });
        });
        setRecordings(userRecs);
      } catch (err) {
        console.warn("Firestore user recordings load failed, falling back locally:", err);
        // Fallback local storage
        const saved = localStorage.getItem('ariyus_shared_recordings');
        if (saved) {
          const parsed = JSON.parse(saved);
          const userRecs = parsed.filter(item => item.userDisplayName === displayName || item.userId === userData.uid);
          setRecordings(userRecs);
        }
      }
    };

    loadUserRecordings();
  }, [displayName, userData]);

  const handlePlayToggle = (id, url) => {
    if (playingId === id) {
      audioRef.current.pause();
      setPlayingId(null);
    } else {
      setPlayingId(id);
      if (audioRef.current) {
        audioRef.current.pause();
      }
      audioRef.current = new Audio(url);
      audioRef.current.play();
      audioRef.current.onended = () => setPlayingId(null);
    }
  };

  useEffect(() => {
    return () => {
      if (audioRef.current) audioRef.current.pause();
    };
  }, []);

  // Vocal Tone Profile Breakdown
  const toneBreakdown = [
    { label: 'Warm & Harmonic', value: 45, color: 'var(--secondary-glow)' },
    { label: 'Airy & Breathy', value: 30, color: 'var(--primary-glow)' },
    { label: 'Clear & Defined', value: 25, color: '#00ff87' }
  ];

  if (!userData) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Profile Header Card */}
      <div className="glass-panel" style={{ background: 'linear-gradient(135deg, rgba(6, 4, 30, 0.7), rgba(255, 0, 193, 0.08))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <h2 style={{ fontSize: '1.8rem', margin: 0 }}>
              {displayName} {tier === 'Creator' && <span className="creator-badge">Creator</span>}
            </h2>
            <p style={{ color: 'var(--text-dim)', margin: '4px 0 0', fontSize: '0.95rem' }}>Resonance node: synced</p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="glowing-button" onClick={() => navigate('Upgrade')} style={{ margin: 0, padding: '8px 16px', fontSize: '0.8rem' }}>
              Upgrade Plan
            </button>
            <button className="glowing-button secondary" onClick={handleSignOut} style={{ margin: 0, padding: '8px 16px', fontSize: '0.8rem' }}>
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Level Tracking & Journey */}
      <div className="glass-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h3 style={{ margin: 0, color: 'var(--secondary-glow)' }}>Ariyus Level</h3>
          <span style={{ fontWeight: 'bold' }}>{currentLevelInfo.rank} ({xp} XP)</span>
        </div>
        <div className="progress-track" style={{ height: '10px', marginBottom: '12px' }}>
          <div className="progress-fill" style={{ width: `${rankProgress}%`, background: 'linear-gradient(90deg, var(--secondary-glow), var(--tertiary-glow))' }} />
        </div>
      </div>

      {/* Voice Signature Display */}
      <VoiceSignatureCard signature={voiceSignature} />

      {/* Vocal Tone Profile Breakdown */}
      <div className="glass-panel">
        <h3>Vocal Tone Profile</h3>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', marginBottom: '15px' }}>Overtone classifications detected across historical captures</p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {toneBreakdown.map((t, idx) => (
            <div key={idx}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                <span style={{ color: t.color }}>{t.label}</span>
                <span>{t.value}%</span>
              </div>
              <div className="progress-track" style={{ height: '6px' }}>
                <div className="progress-fill" style={{ width: `${t.value}%`, background: t.color, boxShadow: `0 0 6px ${t.color}` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cosmic Skins Customization Panel */}
      <div className="glass-panel">
        <h3>Cosmic UI Skin Selection</h3>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', marginBottom: '15px' }}>
          Select custom orbital visual colors across the app (Ariyus Plus feature)
        </p>

        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
          {[
            { name: 'Andromeda Teal', primary: '#00f2ff', secondary: '#ff00c1', gated: false },
            { name: 'Supernova Amber', primary: '#ffb700', secondary: '#ff3b30', gated: true },
            { name: 'Hypergiant Emerald', primary: '#00ff87', secondary: '#7000ff', gated: true }
          ].map((skin) => {
            const isGatedAndLocked = skin.gated && tier === 'Free';
            const isActive = theme === skin.name;

            return (
              <div
                key={skin.name}
                onClick={() => {
                  if (isGatedAndLocked) {
                    alert("Ariyus Plus Membership Required!\n\nYou must upgrade your membership to unlock custom premium cosmic theme skins.");
                    navigate('Upgrade');
                  } else {
                    setTheme(skin.name);
                  }
                }}
                style={{
                  background: 'rgba(0,0,0,0.3)',
                  border: isActive 
                    ? '2px solid var(--primary-glow)' 
                    : '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '12px',
                  padding: '15px',
                  flexGrow: 1,
                  minWidth: '180px',
                  cursor: 'pointer',
                  position: 'relative',
                  boxShadow: isActive ? '0 0 10px var(--primary-glow)' : 'none',
                  transition: 'all 0.3s ease'
                }}
              >
                {isGatedAndLocked && (
                  <div style={{ position: 'absolute', top: '10px', right: '10px', fontSize: '0.85rem' }}>
                    🔒
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: skin.primary }} />
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: skin.secondary }} />
                  <strong style={{ fontSize: '0.9rem', color: '#fff' }}>{skin.name}</strong>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                  {skin.gated ? 'Plus/Pro/Creator Plan' : 'Free Default Skin'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* User's saved recordings list */}
      <div className="glass-panel">
        <h3>Your Saved Tracks</h3>
        
        {recordings.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '15px' }}>
            {recordings.map((rec) => (
              <div key={rec.id} className="glass-panel" style={{ margin: 0, background: 'rgba(0,0,0,0.15)', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                <div>
                  <b style={{ color: '#fff' }}>{rec.song.title}</b>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                    Rating: {rec.ariyusRating} | Solfeggio: {rec.selectedFreq} Hz
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    className="glowing-button" 
                    style={{ margin: 0, padding: '6px 14px', fontSize: '0.8rem' }}
                    onClick={() => handlePlayToggle(rec.id, rec.playbackUrl)}
                  >
                    {playingId === rec.id ? '⏸ Pause' : '▶ Play'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ margin: '15px 0 0', color: 'var(--text-dim)', fontStyle: 'italic' }}>
            No tracks saved in your profile. Open the Studio to record your first performance!
          </p>
        )}
      </div>

    </div>
  );
};

export default Profile;
