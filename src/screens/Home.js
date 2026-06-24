import React from 'react';
import VoiceSignatureCard from '../components/VoiceSignatureCard';

const HomeNexus = ({ userData, communityFeed, navigate }) => {
  if (!userData) return null;

  const {
    displayName = 'Aura Singer',
    tier = 'Free',
    xp = 120,
    voiceSignature = null
  } = userData;

  // Ariyus Journey Levels
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

  const activeChallenges = [
    { id: 'ch1', title: 'Cosmic Breath', desc: 'Sustain any vowel at 432 Hz for 6 seconds', reward: '100 XP' },
    { id: 'ch2', title: 'Harmonic Alignment', desc: 'Score A+ on any Solfeggio guided track', reward: '150 XP' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Welcome Hero Panel */}
      <div className="glass-panel" style={{ background: 'linear-gradient(135deg, rgba(6, 4, 30, 0.7), rgba(112, 0, 255, 0.08))', borderColor: 'var(--glass-border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <h2 style={{ fontSize: '2rem', margin: 0, textShadow: '0 0 10px rgba(255, 255, 255, 0.3)' }}>
              Greetings, {displayName}
            </h2>
            <p style={{ marginTop: '8px', color: 'var(--text-dim)' }}>
              Vocal frequencies are stable. Resonance matrix ready.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span className="level-badge" style={{ background: 'var(--secondary-glow)', boxShadow: '0 0 10px var(--secondary-glow)' }}>
              {tier} MEMBER
            </span>
          </div>
        </div>

        {/* Ad Placeholder for Free Tier */}
        {tier === 'Free' && (
          <div className="glass-panel ad-placeholder" style={{ margin: '20px 0 0 0', cursor: 'pointer' }} onClick={() => navigate('Upgrade')}>
            <p style={{ color: 'var(--secondary-glow)', margin: 0, fontSize: '0.9rem', fontWeight: 'bold' }}>
              [ COSMIC SPONSOR AD ] - Upgrade to Ariyus Plus to silence all commercial interruptions.
            </p>
          </div>
        )}
      </div>

      {/* Ariyus Journey Level tracking */}
      <div className="glass-panel" style={{ borderColor: 'var(--primary-glow)', boxShadow: '0 0 15px rgba(0, 242, 255, 0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div>
            <h3 style={{ margin: 0, color: 'var(--primary-glow)', textShadow: '0 0 8px var(--primary-glow)' }}>Ariyus Journey</h3>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>Level Progression Node</span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff' }}>{currentLevelInfo.rank}</span>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{xp} / {currentLevelInfo.maxXp} XP</div>
          </div>
        </div>

        <div className="progress-track" style={{ height: '14px', marginBottom: '8px' }}>
          <div className="progress-fill" style={{ width: `${rankProgress}%` }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
          <span>Rank Min: {currentLevelInfo.minXp} XP</span>
          <span>Next Rank: {currentLevelInfo.nextRank}</span>
        </div>
      </div>

      {/* Voice Signature Card */}
      <VoiceSignatureCard signature={voiceSignature} />

      {/* Vocal Challenges Grid */}
      <div className="glass-panel">
        <h3 style={{ textShadow: '0 0 10px rgba(255,255,255,0.2)', marginBottom: '15px' }}>Alignment Challenges</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px' }}>
          {activeChallenges.map((ch) => (
            <div key={ch.id} className="glass-panel" style={{ margin: 0, background: 'rgba(0,0,0,0.15)', borderColor: 'rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <b style={{ color: '#fff' }}>{ch.title}</b>
                <span style={{ color: 'var(--primary-glow)', fontSize: '0.85rem' }}>+{ch.reward}</span>
              </div>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-dim)', marginBottom: '12px' }}>{ch.desc}</p>
              <button 
                className="glowing-button" 
                style={{ padding: '6px 16px', fontSize: '0.8rem', margin: 0 }}
                onClick={() => navigate('SongLibrary')}
              >
                Accept Challenge
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Access Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
        <button className="glowing-button" onClick={() => navigate('SongLibrary')} style={{ margin: 0, padding: '16px' }}>
          Open Recording Studio
        </button>
        <button className="glowing-button secondary" onClick={() => navigate('CollaborationLobby')} style={{ margin: 0, padding: '16px' }}>
          Open Resonance Lab
        </button>
      </div>

    </div>
  );
};

export default HomeNexus;
