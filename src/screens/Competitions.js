import React, { useState } from 'react';

const Competitions = ({ navigate }) => {
  const [standings, setStandings] = useState([
    { id: 'c1', name: 'Celeste Vocalist', score: 98, votes: 412, icon: '🥇' },
    { id: 'c2', name: 'Solar Tenor', score: 94, votes: 389, icon: '🥈' },
    { id: 'c3', name: 'Aura Singer', score: 91, votes: 201, icon: '🥉' }
  ]);

  const handleVote = (name) => {
    alert(`Thank you! Your vote for ${name} has been synced to the active competition block.`);
    setStandings(prev => prev.map(c => c.name === name ? { ...c, votes: c.votes + 1 } : c));
  };

  return (
    <div className="screen-wrapper">
      <h1 className="suspended-title">Competitions</h1>

      {/* Active contest details */}
      <div className="glass-panel" style={{ margin: '0 0 20px 0', borderColor: 'var(--secondary-glow)', background: 'rgba(255, 0, 193, 0.03)' }}>
        <span style={{ fontSize: '0.75rem', background: 'var(--secondary-glow)', color: '#000', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold', textTransform: 'uppercase' }}>
          🏆 Active Weekly Contest
        </span>
        <h2 style={{ marginTop: '12px', color: '#fff', fontSize: '1.4rem' }}>Solfeggio Ascension: 528Hz Hearts</h2>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', lineHeight: '1.5', margin: '8px 0 15px 0' }}>
          Sing any track in 528Hz Solfeggio alignment. The performer with the highest convergence score at the end of the week wins a **$500 Cash prize & Luminary Badge**.
        </p>
        <button 
          className="glowing-button" 
          style={{ margin: 0, padding: '10px 22px' }}
          onClick={() => navigate('SongLibrary')}
        >
          🎙️ Submit Performance Entry
        </button>
      </div>

      {/* Leaderboard panel */}
      <div className="glass-panel" style={{ margin: 0 }}>
        <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px', color: '#fff' }}>
          Leaderboard Standings
        </h3>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: '15px' }}>
          Current ranking standings for the active Solfeggio Ascension block.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {standings.map(c => (
            <div key={c.id} style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              background: 'rgba(255,255,255,0.02)', 
              padding: '12px 15px', 
              borderRadius: '8px', 
              border: '1px solid rgba(255,255,255,0.03)' 
            }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span style={{ fontSize: '1.5rem' }}>{c.icon}</span>
                <div>
                  <strong style={{ color: '#fff', fontSize: '0.95rem' }}>{c.name}</strong>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--primary-glow)' }}>Score: {c.score}%</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>|</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{c.votes} Votes</span>
                  </div>
                </div>
              </div>

              <button 
                className="glowing-button secondary" 
                style={{ margin: 0, padding: '6px 12px', fontSize: '0.72rem' }}
                onClick={() => handleVote(c.name)}
              >
                👍 Vote
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Competitions;
