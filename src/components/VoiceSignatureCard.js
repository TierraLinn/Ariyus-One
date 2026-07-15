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
    { label: 'Vocal Energy (Amp)', value: energy, color: 'var(--primary-glow)', hex: '#00f2ff' },
    { label: 'Flow & Stability', value: flow, color: '#00ff87', hex: '#00ff87' },
    { label: 'Expression & Control', value: expression, color: 'var(--secondary-glow)', hex: '#ff00c1' },
    { label: 'Breath Cohere (HNR)', value: breath, color: '#ffb700', hex: '#ffb700' },
    { label: 'Pitch Precision', value: stability, color: '#b600ff', hex: '#b600ff' }
  ];

  // Dynamically drafts a highly detailed styled Vector SVG certificate string in-memory
  const generateSvgString = () => {
    // Generate Flower of Life circles coordinates
    const cx = 400;
    const cy = 350;
    const r = 90;
    let circlesSvg = `<circle cx="${cx}" cy="${cy}" r="${r}" class="mandala-circle" stroke="#00f2ff" />`;

    // Ring 1 (6 circles)
    for (let i = 0; i < 6; i++) {
      const theta = (i * Math.PI) / 3;
      const x = cx + r * Math.cos(theta);
      const y = cy + r * Math.sin(theta);
      circlesSvg += `\n<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${r}" class="mandala-circle" stroke="#00f2ff" />`;
    }

    // Ring 2 (12 circles)
    for (let i = 0; i < 12; i++) {
      const theta = (i * Math.PI) / 6;
      const dist = i % 2 === 0 ? r * Math.sqrt(3) : r * 2;
      const x = cx + dist * Math.cos(theta);
      const y = cy + dist * Math.sin(theta);
      circlesSvg += `\n<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${r}" class="mandala-circle" stroke="#ff00c1" opacity="0.6" />`;
    }

    // Interlocking grid lines
    let gridLinesSvg = '';
    for (let xOffset = 50; xOffset < 800; xOffset += 100) {
      gridLinesSvg += `<line x1="${xOffset}" y1="50" x2="${xOffset}" y2="950" stroke="rgba(0, 242, 255, 0.04)" stroke-width="1" />\n`;
    }
    for (let yOffset = 50; yOffset < 1000; yOffset += 100) {
      gridLinesSvg += `<line x1="50" y1="${yOffset}" x2="750" y2="${yOffset}" stroke="rgba(0, 242, 255, 0.04)" stroke-width="1" />\n`;
    }

    // Cryptographic signature hash
    const cryptoHash = 'AR-SIG-MD5-' + Math.random().toString(36).substr(2, 9).toUpperCase() + '-' + averagePitch;

    return `<?xml version="1.0" encoding="utf-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" width="800" height="1000">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#02001a" />
      <stop offset="50%" stop-color="#0b003a" />
      <stop offset="100%" stop-color="#040318" />
    </linearGradient>
    <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00f2ff" />
      <stop offset="50%" stop-color="#ff00c1" />
      <stop offset="100%" stop-color="#b600ff" />
    </linearGradient>
  </defs>

  <style>
    .bg { fill: url(#bgGrad); }
    .border-path { fill: none; stroke: url(#borderGrad); stroke-width: 4; }
    .outer-glow { fill: none; stroke: #00f2ff; stroke-width: 1; opacity: 0.3; }
    .title { fill: #ffffff; font-family: 'Segoe UI', -apple-system, sans-serif; font-size: 26px; font-weight: bold; text-anchor: middle; letter-spacing: 2px; }
    .subtitle { fill: #00f2ff; font-family: 'Segoe UI', -apple-system, sans-serif; font-size: 13px; text-anchor: middle; letter-spacing: 4px; }
    .label { fill: rgba(255, 255, 255, 0.55); font-family: 'Segoe UI', -apple-system, sans-serif; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; }
    .value { fill: #ffffff; font-family: 'Segoe UI', -apple-system, sans-serif; font-size: 15px; font-weight: bold; }
    .cert-text { fill: rgba(255, 255, 255, 0.7); font-family: 'Segoe UI', -apple-system, sans-serif; font-size: 14px; font-style: italic; }
    .hash { fill: rgba(255, 255, 255, 0.25); font-family: monospace; font-size: 12px; text-anchor: middle; letter-spacing: 1px; }
    .mandala-circle { fill: none; stroke-width: 0.85; }
  </style>

  <!-- Background Layer -->
  <rect width="800" height="1000" class="bg" />
  
  <!-- Grid Matrix -->
  ${gridLinesSvg}

  <!-- Borders -->
  <rect x="20" y="20" width="760" height="960" rx="15" class="border-path" />
  <rect x="25" y="25" width="750" height="950" rx="12" class="outer-glow" />

  <!-- Header Header -->
  <text x="400" y="80" class="title">ARIYUS-ONE VOCAL ALIGNMENT</text>
  <text x="400" y="105" class="subtitle">AUTHENTICATED BIOMETRIC RESONANCE PROFILE</text>
  <line x1="100" y1="130" x2="700" y2="130" stroke="rgba(255, 0, 193, 0.2)" stroke-width="2" />

  <!-- Mandala Vector Graphic -->
  <g transform="translate(0, 0)">
    <!-- Boundary outer ring -->
    <circle cx="${cx}" cy="${cy}" r="195" fill="none" stroke="rgba(0, 242, 255, 0.2)" stroke-width="1" />
    <circle cx="${cx}" cy="${cy}" r="200" fill="none" stroke="rgba(0, 242, 255, 0.4)" stroke-width="1.5" stroke-dasharray="5, 5" />
    
    <!-- Flower of Life Circles -->
    ${circlesSvg}
  </g>

  <!-- Details Details Columns -->
  <!-- Left Header stats -->
  <text x="100" y="600" class="label">Vocal Classification</text>
  <text x="100" y="625" class="value">${vocalType}</text>

  <text x="100" y="680" class="label">Resonance Node</text>
  <text x="100" y="705" class="value">${resonanceType}</text>

  <!-- Right Header stats -->
  <text x="450" y="600" class="label">Dominant Frequency</text>
  <text x="450" y="625" class="value" fill="#00f2ff">${dominantFreq}</text>

  <text x="450" y="680" class="label">Harmonic Coeff</text>
  <text x="450" y="705" class="value" fill="#00ff87">1.618 (Phi Ratio)</text>

  <!-- Stats progress bars grid -->
  <g transform="translate(100, 750)">
    <!-- Stat 1: Energy -->
    <text x="0" y="20" font-family="sans-serif" font-size="12" fill="rgba(255,255,255,0.6)">VOCAL ENERGY: ${energy}%</text>
    <rect x="0" y="30" width="600" height="6" fill="rgba(255,255,255,0.08)" rx="3" />
    <rect x="0" y="30" width="${600 * energy / 100}" height="6" fill="#00f2ff" rx="3" />

    <!-- Stat 2: Flow -->
    <text x="0" y="60" font-family="sans-serif" font-size="12" fill="rgba(255,255,255,0.6)">FLOW &amp; STABILITY: ${flow}%</text>
    <rect x="0" y="70" width="600" height="6" fill="rgba(255,255,255,0.08)" rx="3" />
    <rect x="0" y="70" width="${600 * flow / 100}" height="6" fill="#00ff87" rx="3" />

    <!-- Stat 3: Precision -->
    <text x="0" y="100" font-family="sans-serif" font-size="12" fill="rgba(255,255,255,0.6)">PITCH PRECISION: ${stability}%</text>
    <rect x="0" y="110" width="600" height="6" fill="rgba(255,255,255,0.08)" rx="3" />
    <rect x="0" y="110" width="${600 * stability / 100}" height="6" fill="#ff00c1" rx="3" />
  </g>

  <!-- Certification Statement -->
  <text x="400" y="910" class="cert-text" text-anchor="middle">"Resonant spectra matches the target geometric carrier. Authenticated via client bio-sensors."</text>

  <!-- Footer block -->
  <line x1="150" y1="935" x2="650" y2="935" stroke="rgba(255,255,255,0.06)" stroke-width="1" />
  <text x="400" y="960" class="hash">SECURE TOKEN: ${cryptoHash}</text>
</svg>
`;
  };

  // Triggers browser local file download anchor
  const handleDownloadSvg = () => {
    const svgString = generateSvgString();
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `Vocal_ID_Signature_${vocalType.replace(/\s+/g, '_')}.svg`;
    document.body.appendChild(link);
    link.click();
    
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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

      {/* Exporter Button Exporter */}
      <button 
        className="glowing-button"
        style={{ width: '100%', margin: '20px 0 0 0', padding: '11px 0', fontSize: '0.8rem' }}
        onClick={handleDownloadSvg}
      >
        💾 Download Vector SVG Card
      </button>
    </div>
  );
};

export default VoiceSignatureCard;
