import React from 'react';

const CreatorDashboard = () => {
  const stats = [
    { label: 'Acoustic Plays', value: '14,820', icon: '🔊' },
    { label: 'Followers', value: '2,430', icon: '👥' },
    { label: 'Shared Captures', value: '18', icon: '💾' },
    { label: 'Estimated Earnings', value: '$42.50', icon: '💎' }
  ];

  const tracks = [
    { title: 'Cosmic Resonance', plays: 8420, rating: 'A+', earnings: '$24.15' },
    { title: 'Imagine (Deep Mix)', plays: 4210, rating: 'A', earnings: '$12.05' },
    { title: 'Blinding Lights', plays: 2190, rating: 'B+', earnings: '$6.30' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Header */}
      <div>
        <h2 style={{ textShadow: '0 0 10px var(--primary-glow)', margin: 0 }}>Creator Dashboard</h2>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', margin: '4px 0 0' }}>Monitor your vocal resonance analytics and earnings</p>
      </div>

      {/* Grid Stats */}
      <div className="dashboard-grid">
        {stats.map((st, i) => (
          <div key={i} className="dashboard-stat-card">
            <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>{st.icon}</div>
            <h4>{st.label}</h4>
            <div className="value">{st.value}</div>
          </div>
        ))}
      </div>

      {/* Simulated Analytics SVG Chart */}
      <div className="glass-panel">
        <h3>Vocal Resonance Growth</h3>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', marginBottom: '20px' }}>Monthly listener expansion matrix</p>
        
        <div style={{ position: 'relative', width: '100%', height: '160px', background: 'rgba(0, 0, 0, 0.2)', borderRadius: '8px', padding: '10px 0' }}>
          {/* Simple SVG Chart */}
          <svg style={{ width: '100%', height: '100%' }} viewBox="0 0 500 100" preserveAspectRatio="none">
            <defs>
              <linearGradient id="chartGlow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary-glow)" stopOpacity="0.4" />
                <stop offset="100%" stopColor="var(--primary-glow)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Grid Lines */}
            <line x1="0" y1="20" x2="500" y2="20" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
            <line x1="0" y1="50" x2="500" y2="50" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
            <line x1="0" y1="80" x2="500" y2="80" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />

            {/* Filled Area */}
            <path d="M 0 90 Q 100 80 150 65 T 300 45 T 400 30 T 500 10 L 500 100 L 0 100 Z" fill="url(#chartGlow)" />
            
            {/* Glow Path Line */}
            <path d="M 0 90 Q 100 80 150 65 T 300 45 T 400 30 T 500 10" fill="none" stroke="var(--primary-glow)" strokeWidth="2.5" style={{ filter: 'drop-shadow(0 0 5px var(--primary-glow))' }} />
          </svg>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 12px 0 12px', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
            <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span>
          </div>
        </div>
      </div>

      {/* Top Performing Tracks */}
      <div className="glass-panel">
        <h3>Top Performing Resonance Tracks</h3>
        <div style={{ overflowX: 'auto', marginTop: '15px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '400px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                <th style={{ padding: '10px 6px' }}>TRACK TITLE</th>
                <th style={{ padding: '10px 6px' }}>PLAYS</th>
                <th style={{ padding: '10px 6px' }}>RATING</th>
                <th style={{ padding: '10px 6px' }}>REVENUE</th>
              </tr>
            </thead>
            <tbody>
              {tracks.map((t, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.95rem' }}>
                  <td style={{ padding: '12px 6px', color: '#fff' }}>{t.title}</td>
                  <td style={{ padding: '12px 6px' }}>{t.plays}</td>
                  <td style={{ padding: '12px 6px', color: 'var(--primary-glow)' }}>{t.rating}</td>
                  <td style={{ padding: '12px 6px', color: 'var(--secondary-glow)' }}>{t.earnings}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Control panel buttons */}
      <div className="glass-panel" style={{ textAlign: 'center' }}>
        <h3>Creator Actions</h3>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', flexWrap: 'wrap' }}>
          <button className="glowing-button" onClick={() => alert('Withdrawal initiated! Funds will align to your account within 24 hours.')}>
            💎 Withdraw Earnings
          </button>
          <button className="glowing-button secondary" onClick={() => alert('Vocal rights matrix is up to date.')}>
            ⚙ Matrix Licensing Setup
          </button>
        </div>
      </div>

    </div>
  );
};

export default CreatorDashboard;
