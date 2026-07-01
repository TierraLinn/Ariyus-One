import React from 'react';
import VoiceSignatureCard from '../components/VoiceSignatureCard';

const HomeNexus = ({ userData, navigate }) => {
  if (!userData) return null;

  const {
    displayName = 'Aura Singer',
    xp = 120,
    tier = 'Free',
    voiceSignature
  } = userData;

  // Level progression
  const getLevelInfo = (currentXp) => {
    if (currentXp < 100) return { title: 'Seeker', level: 1, min: 0, max: 100 };
    if (currentXp < 250) return { title: 'Resonator', level: 2, min: 100, max: 250 };
    if (currentXp < 500) return { title: 'Harmonizer', level: 3, min: 250, max: 500 };
    if (currentXp < 1000) return { title: 'Alchemist', level: 4, min: 500, max: 1000 };
    return { title: 'Luminary', level: 5, min: 1000, max: 2000 };
  };

  const levelInfo = getLevelInfo(xp);
  const progressPercent = Math.min(100, ((xp - levelInfo.min) / (levelInfo.max - levelInfo.min)) * 100);

  return (
    <div className="screen-wrapper">
      <h1 className="suspended-title">Ariyus Home</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', alignItems: 'start' }}>
        {/* User Card & Level Progression */}
        <div className="glass-panel" style={{ margin: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#fff' }}>{displayName}</h2>
              <span style={{ fontSize: '0.75rem', background: 'rgba(255, 0, 193, 0.15)', border: '1px solid var(--secondary-glow)', color: 'var(--secondary-glow)', padding: '2px 8px', borderRadius: '4px', display: 'inline-block', marginTop: '4px', textTransform: 'uppercase', fontWeight: 'bold' }}>
                {tier} Member
              </span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Journey Level</span>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--primary-glow)' }}>Lvl {levelInfo.level} - {levelInfo.title}</div>
            </div>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '5px' }}>
              <span>XP Progression</span>
              <span>{xp} / {levelInfo.max} XP</span>
            </div>
            <div className="progress-track" style={{ height: '10px' }}>
              <div className="progress-fill" style={{ width: `${progressPercent}%`, background: 'var(--primary-glow)' }} />
            </div>
          </div>

          <button 
            className="glowing-button" 
            style={{ width: '100%', padding: '12px' }}
            onClick={() => navigate('SongLibrary')}
          >
            🎙️ Enter Recording Catalog
          </button>
        </div>

        {/* Weekly Contest Promo */}
        <div className="glass-panel" style={{ margin: 0, borderColor: 'var(--secondary-glow)', background: 'rgba(255, 0, 193, 0.03)' }}>
          <span style={{ fontSize: '0.75rem', background: 'var(--secondary-glow)', color: '#000', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold', textTransform: 'uppercase' }}>
            🏆 Active Contest
          </span>
          <h3 style={{ marginTop: '12px', marginBottom: '8px', color: '#fff', fontSize: '1.25rem' }}>Solfeggio Ascension: 528Hz Hearts</h3>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', lineHeight: '1.4', marginBottom: '15px' }}>
            Sing any catalog track and align your vocal overtones with the cell-miracle 528Hz frequency. Top performers get crowned with the **Solfeggio Adept** badge.
          </p>
          <button 
            className="glowing-button secondary" 
            style={{ margin: 0, padding: '8px 16px', fontSize: '0.8rem' }}
            onClick={() => navigate('Competitions')}
          >
            Go to Competitions
          </button>
        </div>

        {/* Interactive Vocal Coach Card */}
        <div className="glass-panel" style={{ margin: 0, borderColor: 'var(--primary-glow)', background: 'rgba(0, 242, 255, 0.03)' }}>
          <span style={{ fontSize: '0.75rem', background: 'var(--primary-glow)', color: '#000', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold', textTransform: 'uppercase' }}>
            🛡️ Warmup Coach
          </span>
          <h3 style={{ marginTop: '12px', marginBottom: '8px', color: '#fff', fontSize: '1.25rem' }}>Acoustic Scale Challenges</h3>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', lineHeight: '1.4', marginBottom: '15px' }}>
            Train your voice with target tuning scale challenges. Practice major scales, sustained tones, and Solfeggio calibration with real-time visual coaching templates.
          </p>
          <button 
            className="glowing-button secondary" 
            style={{ margin: 0, padding: '8px 16px', fontSize: '0.8rem', borderColor: 'var(--primary-glow)', color: 'var(--primary-glow)' }}
            onClick={() => navigate('VocalCoach')}
          >
            Start Scale Challenges
          </button>
        </div>

        {/* Vocal Arcade Game Card */}
        <div className="glass-panel" style={{ margin: 0, borderColor: 'var(--tertiary-glow)', background: 'rgba(112, 0, 255, 0.03)' }}>
          <span style={{ fontSize: '0.75rem', background: 'var(--tertiary-glow)', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold', textTransform: 'uppercase' }}>
            🎮 Arcade Game
          </span>
          <h3 style={{ marginTop: '12px', marginBottom: '8px', color: '#fff', fontSize: '1.25rem' }}>Space Journey Vocal Arcade</h3>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', lineHeight: '1.4', marginBottom: '15px' }}>
            Navigate a space starfighter through glowing Solfeggio frequency gates by modulating your vocal pitch. Grab coins and practice precision intervals.
          </p>
          <button 
            className="glowing-button secondary" 
            style={{ margin: 0, padding: '8px 16px', fontSize: '0.8rem', borderColor: 'var(--tertiary-glow)', color: 'var(--tertiary-glow)' }}
            onClick={() => navigate('VocalArcade')}
          >
            Launch Flight Arcade
          </button>
        </div>
      </div>

      {/* Voice Signature Showcase Card */}
      {voiceSignature && (
        <div style={{ marginTop: '20px' }}>
          <VoiceSignatureCard signature={voiceSignature} />
        </div>
      )}
    </div>
  );
};

export default HomeNexus;
