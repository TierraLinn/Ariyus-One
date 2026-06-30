import React, { useState, useEffect } from 'react';

const Profile = ({ userData, handleSignOut, navigate }) => {
  const {
    displayName = 'Aura Singer',
    email = 'demo@ariyus.one',
    tier = 'Free',
    xp = 120
  } = userData || {};

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('ariyus_cosmic_theme') || 'Andromeda Teal';
  });

  const [recordings] = useState(() => {
    const saved = localStorage.getItem('ariyus_shared_recordings');
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.filter(item => item.userDisplayName === displayName);
    }
    return [];
  });

  const [coins] = useState(() => {
    const saved = localStorage.getItem('ariyus_local_user');
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.coins !== undefined ? parsed.coins : 500;
    }
    return 500;
  });

  const [giftsReceived] = useState(() => {
    const saved = localStorage.getItem('ariyus_shared_recordings');
    if (saved) {
      const parsed = JSON.parse(saved);
      const myPosts = parsed.filter(item => item.userDisplayName === displayName);
      return myPosts.reduce((acc, item) => acc + (item.gifts?.length || 0), 0);
    }
    return 0;
  });

  const [draftsCount] = useState(() => {
    const saved = localStorage.getItem('ariyus_drafts');
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.length;
    }
    return 0;
  });

  useEffect(() => {
    const root = document.documentElement;
    localStorage.setItem('ariyus_cosmic_theme', theme);
    if (theme === 'Supernova Amber') {
      root.style.setProperty('--primary-glow', '#ffb700');
      root.style.setProperty('--secondary-glow', '#ff3b30');
      root.style.setProperty('--tertiary-glow', '#9e00ff');
      root.style.setProperty('--glass-border', 'rgba(255, 183, 0, 0.25)');
    } else if (theme === 'Hypergiant Emerald') {
      root.style.setProperty('--primary-glow', '#00ff87');
      root.style.setProperty('--secondary-glow', '#7000ff');
      root.style.setProperty('--tertiary-glow', '#00f2ff');
      root.style.setProperty('--glass-border', 'rgba(0, 255, 135, 0.25)');
    } else {
      root.style.setProperty('--primary-glow', '#00f2ff');
      root.style.setProperty('--secondary-glow', '#ff00c1');
      root.style.setProperty('--tertiary-glow', '#7000ff');
      root.style.setProperty('--glass-border', 'rgba(0, 242, 255, 0.25)');
    }
  }, [theme]);

  // Level computation
  const getLevelInfo = (currentXp) => {
    if (currentXp < 100) return { title: 'Seeker', level: 1 };
    if (currentXp < 250) return { title: 'Resonator', level: 2 };
    if (currentXp < 500) return { title: 'Harmonizer', level: 3 };
    if (currentXp < 1000) return { title: 'Alchemist', level: 4 };
    return { title: 'Luminary', level: 5 };
  };

  const levelInfo = getLevelInfo(xp);

  return (
    <div className="screen-wrapper">
      <div className="floating-notes">🌌</div>
      <h1 className="suspended-title">Profile Hub</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', alignItems: 'start' }}>
        {/* Profile Card details */}
        <div className="glass-panel" style={{ margin: 0 }}>
          <h2 style={{ margin: 0, color: '#fff', fontSize: '1.4rem' }}>{displayName}</h2>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.88rem', margin: '4px 0 15px 0' }}>{email}</p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.9rem', marginBottom: '20px' }}>
            <div>
              <span style={{ color: 'var(--text-dim)' }}>Membership Tier: </span>
              <strong style={{ color: 'var(--secondary-glow)' }}>{tier}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-dim)' }}>Cosmic Level: </span>
              <strong style={{ color: 'var(--primary-glow)' }}>Lvl {levelInfo.level} ({levelInfo.title})</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-dim)' }}>Experience: </span>
              <strong style={{ color: '#fff' }}>{xp} XP</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-dim)' }}>Wallet Balance: </span>
              <strong style={{ color: 'var(--primary-glow)' }}>💰 {coins} Coins</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-dim)' }}>Gifts Received: </span>
              <strong style={{ color: 'var(--secondary-glow)' }}>🎁 {giftsReceived} Gifts</strong>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button className="glowing-button" onClick={() => navigate('Drafts')} style={{ width: '100%', margin: 0 }}>
              📁 Open Drafts Folder ({draftsCount})
            </button>
            <button className="glowing-button secondary" onClick={handleSignOut} style={{ width: '100%', borderColor: 'var(--secondary-glow)', color: 'var(--secondary-glow)', margin: 0 }}>
              🔒 Sign Out Profile
            </button>
          </div>
        </div>

        {/* Setting options */}
        <div className="glass-panel" style={{ margin: 0 }}>
          <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '8px', color: '#fff' }}>Cosmic Themes Settings</h3>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: '15px' }}>
            Re-theme your UI variables across different coordinate wavelengths.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {['Andromeda Teal', 'Supernova Amber', 'Hypergiant Emerald'].map(t => (
              <button
                key={t}
                className={`glowing-button secondary ${theme === t ? 'active' : ''}`}
                onClick={() => setTheme(t)}
                style={{ fontSize: '0.85rem', width: '100%', margin: 0 }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Unlocked Badges */}
      <div className="glass-panel" style={{ marginTop: '20px' }}>
        <h3>Unlocked Resonance Badges</h3>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: '15px' }}>
          Your acoustic accomplishments earned during your vocal journey.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
          {[
            { id: 'calibrated', title: 'Acoustic Calibration Initiate', icon: '🧬', desc: 'Lock in your initial Vocal Signature Profile.', earned: userData?.isCalibrated },
            { id: 'first_sing', title: 'First Karaoke Alignment', icon: '🎙️', desc: 'Complete and record your first track from the song library.', earned: recordings.length > 0 },
            { id: 'quantum_singer', title: 'Quantum Vocalist', icon: '💎', desc: 'Achieved an A+ or A++ pitch precision score on any performance.', earned: recordings.some(r => r.score >= 90) },
            { id: 'solfeggio', title: 'Solfeggio Adept', icon: '🔱', desc: 'Shared any performance retuned into organic frequencies.', earned: recordings.some(r => r.selectedFreq) },
            { id: 'tuning_coach', title: 'Tuning Adept', icon: '🛡️', desc: 'Completed a structured scale training warmup.', earned: localStorage.getItem('ariyus_coach_completed') === 'true' },
            { id: 'sound_bath', title: 'Zen Resonator', icon: '🧘', desc: 'Activated a spatial 3D Sound Bath frequency bed.', earned: localStorage.getItem('ariyus_used_sound_bath') === 'true' },
            { id: 'battle_gladiator', title: 'Arena Gladiator', icon: '⚔️', desc: 'Defeated a rival singer in the Singing Battle Arena.', earned: localStorage.getItem('ariyus_battle_won') === 'true' },
            { id: 'duet_legend', title: 'Duet Legend', icon: '👥', desc: 'Collaborated and mixed vocals with a Billboard performer.', earned: recordings.some(r => r.isDuet) },
            { id: 'luminary_king', title: 'Ascendant Luminary', icon: '👑', desc: 'Achieve Cosmic journey Level 5 (1000+ XP).', earned: levelInfo.level >= 5 }
          ].map(badge => (
            <div 
              key={badge.id}
              style={{
                background: badge.earned ? 'rgba(0, 242, 255, 0.05)' : 'rgba(0,0,0,0.2)',
                border: badge.earned ? '1px solid var(--primary-glow)' : '1px dashed rgba(255,255,255,0.08)',
                borderRadius: '8px',
                padding: '12px',
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
                opacity: badge.earned ? 1 : 0.4,
                boxShadow: badge.earned ? '0 0 10px rgba(0, 242, 255, 0.1)' : 'none',
                transition: 'all 0.3s ease'
              }}
            >
              <span style={{ fontSize: '1.7rem' }}>{badge.icon}</span>
              <div style={{ textAlign: 'left' }}>
                <strong style={{ fontSize: '0.82rem', color: '#fff', display: 'block' }}>{badge.title}</strong>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', display: 'block', lineHeight: '1.2', marginTop: '3px' }}>{badge.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Profile;
