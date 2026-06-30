import React from 'react';

const VoiceSignatureCard = ({ signature }) => {
  if (!signature) {
    return (
      <div className="glass-panel" style={{ textAlign: 'center', borderColor: 'var(--secondary-glow)' }}>
        <h3>Voice Digital Signature</h3>
        <p>No voice signature generated yet. Calibrate your voice profile to view metrics!</p>
      </div>
    );
  }

  const vocalType = signature.vocalType || 'Alto';
  const averagePitch = signature.averagePitch || 220;
  const resonanceType = signature.resonanceType || (averagePitch < 180 ? 'Chest Voice' : 'Head Voice');
  const dominantFreq = signature.dominantFreq || `${averagePitch} Hz`;
  
  const energy = signature.energy || 75;
  const flow = signature.flow || Math.round(100 - (signature.jitter || 0.5) * 45);
  const expression = signature.expression || Math.round((signature.stability || 80) * 0.9);
  const breath = signature.breath || 85;
  const stability = signature.stability || 90;

  const stats = [
    { label: 'Vocal Energy (Amp)', value: energy, color: 'var(--primary-glow)' },
    { label: 'Flow & Stability', value: flow, color: '#00ff87' },
    { label: 'Expression & Control', value: expression, color: 'var(--secondary-glow)' },
    { label: 'Breath Cohere (HNR)', value: breath, color: '#ffb700' },
    { label: 'Pitch Precision', value: stability, color: '#b600ff' }
  ];

  return (
    <div className="glass-panel signature-card voice-reactive-pulse" style={{ background: 'rgba(10, 0, 50, 0.45)', margin: '20px auto 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '20px' }}>
        <div>
          <h3 style={{ textShadow: '0 0 10px var(--primary-glow)', color: '#fff', margin: 0 }}>Vocal ID Signature</h3>
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
        "Your vocal resonant structure indicates a high density of harmonic overtones in the frequency spectra, aligning with the {resonanceType === 'Head Voice' ? 'Air/Aether element' : 'Earth/Root element'}."
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

      <div className="signature-card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '20px', textAlign: 'center' }}>
        <div className="sig-stat-box" style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '6px' }}>
          <div className="title" style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Frequency Key</div>
          <div className="val" style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--primary-glow)', marginTop: '4px' }}>{dominantFreq}</div>
        </div>
        <div className="sig-stat-box" style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '6px' }}>
          <div className="title" style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Harmonic Ratio</div>
          <div className="val" style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#00ff87', marginTop: '4px' }}>1.618 (Phi)</div>
        </div>
        <div className="sig-stat-box" style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '6px' }}>
          <div className="title" style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Resonant Node</div>
          <div className="val" style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--secondary-glow)', marginTop: '4px' }}>{resonanceType.split(' ')[0]}</div>
        </div>
      </div>
    </div>
  );
};

export default VoiceSignatureCard;
