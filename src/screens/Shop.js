import React from 'react';

const UpgradeScreen = ({ navigate }) => {
  const membershipTiers = [
    {
      tier: 'Free',
      price: '$0',
      description: 'Begin exploring the vocal matrices',
      features: ['Limited recordings', 'Basic scoring metrics', 'Ad-supported prompter'],
      featured: false
    },
    {
      tier: 'Ariyus Plus',
      price: '$4.99/mo',
      description: 'Expand your harmonic alignment capabilities',
      features: ['Unlimited local recordings', 'Full HD audio processing', 'Cosmic interface skins', 'No commercial ads'],
      featured: false
    },
    {
      tier: 'Ariyus Pro',
      price: '$9.99/mo',
      description: 'The ultimate AI sound processing system',
      features: ['AI Voice Coach feedback', 'Detailed frequency scoring grid', 'Solfeggio mix layer sliders', 'Unlock all premium DSP effects'],
      featured: true
    },
    {
      tier: 'Creator',
      price: '$19.99/mo',
      description: 'Distribute and monetize your vocal signatures',
      features: ['Sell custom song catalogs', 'Collect fan subscriptions', 'Interactive Creator Dashboard', 'Ariyus master licensing'],
      featured: false
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <h2 style={{ textShadow: '0 0 10px var(--primary-glow)', margin: 0 }}>Membership Matrix</h2>
        <p style={{ color: 'var(--text-dim)', fontSize: '1rem', marginTop: '8px' }}>
          Select the frequency tier matching your alignment goals
        </p>
      </div>

      {/* Upgrades grid */}
      <div className="upgrade-options-grid">
        {membershipTiers.map((item, idx) => (
          <div 
            key={idx} 
            className={`glass-panel tier-detail-card ${item.featured ? 'featured glow-card' : ''}`}
            style={{ margin: 0, animation: `fadeIn ${0.3 + idx * 0.15}s ease` }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ textShadow: item.featured ? '0 0 10px var(--secondary-glow)' : 'none' }}>{item.tier}</h3>
                {item.featured && <span className="level-badge" style={{ background: 'var(--secondary-glow)', fontSize: '0.65rem' }}>POPULAR</span>}
              </div>
              <div className="price">{item.price}</div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: '15px' }}>{item.description}</p>
              
              <ul style={{ textAlign: 'left' }}>
                {item.features.map((feat, i) => (
                  <li key={i}>{feat}</li>
                ))}
              </ul>
            </div>

            <button 
              className={`glowing-button ${item.featured ? 'secondary' : ''}`}
              style={{ width: '100%', margin: '15px 0 0 0', padding: '10px' }}
              onClick={() => navigate('Checkout', { selectedTier: item.tier, price: item.price })}
            >
              Choose {item.tier}
            </button>
          </div>
        ))}
      </div>

    </div>
  );
};

export default UpgradeScreen;
