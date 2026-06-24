import React from 'react';

const VoiceSignatureCard = ({ signature }) => {
  if (!signature) {
    return (
      <div className="glass-panel" style={{ textAlign: 'center', borderColor: 'var(--secondary-glow)' }}>
        <h3>Voice Digital Signature</h3>
        <p>No voice signature generated yet. Record a track in the Studio to map your vocal frequencies!</p>
      </div>
    );
  }

  const {
    vocalType = 'Soprano',
    resonanceType = 'Head Voice',
    dominantFreq = '256 Hz',
    energy = 75,
    flow = 80,
    expression = 70,
    breath = 85,
    stability = 90
  } = signature;

  const stats = [
    { label: 'Vocal Energy', value: energy, color: 'var(--primary-glow)' },
    { label: 'Flow & Rhythm', value: flow, color: '#00ff87' },
    { label: 'Expression & Emotion', value: expression, color: 'var(--secondary-glow)' },
    { label: 'Breath Control', value: breath, color: '#ffb700' },
    { label: 'Pitch Stability', value: stability, color: '#b600ff' }
  ];

  return (
    <div className="glass-panel signature-card voice-reactive-pulse" style={{ background: 'rgba(10, 0, 50, 0.45)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '20px' }}>
        <div>
          <h3 style={{ textShadow: '0 0 10px var(--primary-glow)', color: '#fff', margin: 0 }}>Vocal Signature</h3>
          <span style={{ fontFamily: 'var(--font-secondary)', color: 'var(--text-dim)', fontSize: '1rem' }}>Digital Authentication Profile</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span className="level-badge" style={{ textShadow: 'none', background: 'linear-gradient(135deg, var(--primary-glow), var(--tertiary-glow))' }}>
            {vocalType} ({resonanceType})
          </span>
          <div style={{ fontSize: '0.9rem', color: 'var(--primary-glow)', marginTop: '4px', textShadow: '0 0 5px var(--primary-glow)' }}>
            Dominant: {dominantFreq}
          </div>
        </div>
      </div>

      <p style={{ fontSize: '0.95rem', color: 'var(--text-dim)', fontStyle: 'italic', marginBottom: '20px', borderLeft: '3px solid var(--secondary-glow)', paddingLeft: '10px' }}>
        "Your vocal resonant structure indicates a high density of harmonic overtones in the frequency spectra, aligning with the {resonanceType === 'Head Voice' ? 'Air element' : resonanceType === 'Chest Voice' ? 'Earth element' : 'Aether element'}."
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {stats.map((stat, idx) => (
          <div key={idx} className="slider-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', textTransform: 'uppercase', fontFamily: 'var(--font-secondary)', letterSpacing: '0.5px' }}>
              <span style={{ color: stat.color }}>{stat.label}</span>
              <span style={{ color: '#fff', fontWeight: 'bold' }}>{stat.value}%</span>
            </div>
            <div className="progress-track" style={{ height: '8px' }}>
              <div 
                className="progress-fill" 
                style={{ 
                  width: `${stat.value}%`, 
                  background: `linear-gradient(90deg, ${stat.color}, #ffffff)`,
                  boxShadow: `0 0 8px ${stat.color}` 
                }} 
              />
            </div>
          </div>
        ))}
      </div>

      <div className="signature-card-grid">
        <div className="sig-stat-box">
          <div className="title">Frequency Key</div>
          <div className="val">{dominantFreq}</div>
        </div>
        <div className="sig-stat-box">
          <div className="title">Harmonic Ratio</div>
          <div className="val">1.618 (Phi)</div>
        </div>
        <div className="sig-stat-box">
          <div className="title">Resonant Node</div>
          <div className="val">{resonanceType}</div>
        </div>
      </div>
    </div>
  );
};

export default VoiceSignatureCard;
