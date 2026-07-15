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

  const [fbConfigText, setFbConfigText] = useState(() => {
    return localStorage.getItem('ariyus_firebase_config') || '';
  });

  // VST Integration states
  const [showVstModal, setShowVstModal] = useState(false);
  const [vstKey, setVstKey] = useState('');
  const [vstStatus, setVstStatus] = useState('Offline');
  const [profileTab, setProfileTab] = useState('drafts');

  const handleGenerateVstKey = () => {
    const part1 = Math.random().toString(36).substr(2, 4).toUpperCase().padEnd(4, 'X');
    const part2 = Math.random().toString(36).substr(2, 4).toUpperCase().padEnd(4, 'X');
    setVstKey(`AR-VST-${part1}-${part2}`);
    alert("VST authentication handshake token generated successfully!");
  };

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

        {/* Tabbed settings container */}
        <div className="glass-panel" style={{ margin: 0, display: 'flex', flexDirection: 'column' }}>
          {/* Tab headers */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: '15px' }}>
            <button 
              className={`tab-button ${profileTab === 'drafts' ? 'active' : ''}`} 
              onClick={() => setProfileTab('drafts')}
              style={{ background: 'none', border: 'none', color: profileTab === 'drafts' ? 'var(--primary-glow)' : 'var(--text-dim)', padding: '10px 15px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}
            >
              Local Drafts
            </button>
            <button 
              className={`tab-button ${profileTab === 'settings' ? 'active' : ''}`} 
              onClick={() => setProfileTab('settings')}
              style={{ background: 'none', border: 'none', color: profileTab === 'settings' ? 'var(--primary-glow)' : 'var(--text-dim)', padding: '10px 15px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}
            >
              Settings
            </button>
            <button 
              className={`tab-button ${profileTab === 'firebase' ? 'active' : ''}`} 
              onClick={() => setProfileTab('firebase')}
              style={{ background: 'none', border: 'none', color: profileTab === 'firebase' ? 'var(--primary-glow)' : 'var(--text-dim)', padding: '10px 15px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}
            >
              Firebase Sync
            </button>
          </div>

          {/* Panels */}
          {profileTab === 'drafts' && (
            <div>
              <span style={{ fontSize: '0.75rem', color: '#fff', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Your Saved Drafts</span>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', margin: '4px 0 12px 0', lineHeight: '1.4' }}>
                Manage and retrieve your offline vocal drafts.
              </p>
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {recordings.length > 0 ? (
                  recordings.map((rec, idx) => (
                    <div key={idx} style={{ padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: '#fff' }}>{rec.songTitle || 'Draft Recording'}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{rec.score}% match</span>
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                    No drafts saved locally in your sandbox browser storage.
                  </div>
                )}
              </div>
            </div>
          )}

          {profileTab === 'settings' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#fff', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Select UI Cosmic Theme</span>
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                  {['Andromeda Teal', 'Supernova Amber', 'Hypergiant Emerald'].map(t => (
                    <button
                      key={t}
                      className={`glowing-button secondary ${theme === t ? 'active' : ''}`}
                      onClick={() => setTheme(t)}
                      style={{ fontSize: '0.68rem', padding: '6px 10px', margin: 0, flex: 1 }}
                    >
                      {t.replace(' Andromeda ', '').replace(' Supernova ', '').replace(' Hypergiant ', '')}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '15px' }}>
                <span style={{ fontSize: '0.75rem', color: '#fff', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Membership & Billing</span>
                <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', margin: '4px 0 12px 0', lineHeight: '1.4' }}>
                  Active plan: <strong style={{ color: 'var(--primary-glow)' }}>{tier} Tier</strong>. Upgrade plans or manage Solfeggio subscriptions.
                </p>
                <button
                  className="glowing-button"
                  onClick={() => navigate('Subscription')}
                  style={{ width: '100%', margin: 0, padding: '10px 0', fontSize: '0.8rem' }}
                >
                  💎 Manage Subscription & Billing
                </button>
              </div>

              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '15px' }}>
                <span style={{ fontSize: '0.75rem', color: '#fff', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Mobile Native Wrapper Settings</span>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-color)', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      defaultChecked={localStorage.getItem('ariyus_mobile_alerts') === 'true'} 
                      onChange={(e) => localStorage.setItem('ariyus_mobile_alerts', e.target.checked.toString())} 
                    />
                    Enable Daily Solfeggio Reminders & Battle Invites
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-color)', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      defaultChecked={localStorage.getItem('ariyus_mobile_mic_hd') === 'true'} 
                      onChange={(e) => localStorage.setItem('ariyus_mobile_mic_hd', e.target.checked.toString())} 
                    />
                    Hardware Low-Latency Audio Acceleration
                  </label>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                    <span style={{ flexShrink: 0 }}>Buffer Size:</span>
                    <input 
                      type="range" 
                      min="64" max="512" step="64" 
                      defaultValue={localStorage.getItem('ariyus_mobile_buffer') || '256'} 
                      onChange={(e) => localStorage.setItem('ariyus_mobile_buffer', e.target.value)} 
                      style={{ flexGrow: 1, height: '4px' }}
                    />
                    <span style={{ width: '45px', textTransform: 'none', color: '#fff', textAlign: 'right' }}>256 smpl</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {profileTab === 'firebase' && (
            <div>
              <span style={{ fontSize: '0.75rem', color: '#fff', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Google Cloud Firebase Sync</span>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: '10px' }}>
                Paste your Firebase configuration JSON here to sync logins and shared files to your own live production cloud databases.
              </p>

              <textarea
                role="presentation"
                placeholder={`{\n  "apiKey": "AIza...",\n  "authDomain": "...",\n  "projectId": "..."\n}`}
                value={fbConfigText}
                onChange={(e) => setFbConfigText(e.target.value)}
                style={{
                  width: '100%',
                  height: '110px',
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--glass-border)',
                  color: '#fff',
                  borderRadius: '6px',
                  padding: '8px',
                  marginBottom: '12px',
                  resize: 'none'
                }}
              />

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="glowing-button"
                  onClick={() => {
                    try {
                      if (!fbConfigText.trim()) {
                        alert("Please paste your Firebase configuration JSON.");
                        return;
                      }
                      const parsed = JSON.parse(fbConfigText);
                      if (!parsed.apiKey || !parsed.projectId) {
                        alert("Invalid config. The JSON must contain at least 'apiKey' and 'projectId'.");
                        return;
                      }
                      localStorage.setItem('ariyus_firebase_config', JSON.stringify(parsed));
                      alert("Configuration saved successfully!\n\nReloading application to connect with your live Firestore cloud...");
                      window.location.reload();
                    } catch (err) {
                      alert(`JSON Parsing Error:\n\n${err.message}\n\nPlease check that your JSON syntax is valid (e.g. quote keys and string values).`);
                    }
                  }}
                  style={{ fontSize: '0.78rem', padding: '8px 12px', margin: 0, flex: 1 }}
                >
                  💾 Connect Cloud
                </button>
                <button
                  className="glowing-button secondary"
                  onClick={() => {
                    localStorage.removeItem('ariyus_firebase_config');
                    setFbConfigText('');
                    alert("Reset complete. Reconnecting sandbox local databases...");
                    window.location.reload();
                  }}
                  style={{ fontSize: '0.78rem', padding: '8px 12px', margin: 0 }}
                >
                  Reset
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Studio DAW Controls (Always visible to all tiers) */}
      <div className="glass-panel" style={{ marginTop: '20px', borderColor: 'var(--secondary-glow)' }}>
        <h3 style={{ marginBottom: '8px', color: '#fff' }}>🎙️ Vocal Recording & Multitrack DAW</h3>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: '15px' }}>
          Manage your audio assets, launch the multi-track studio, and configure external digital audio workstation routing.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button className="glowing-button" onClick={() => navigate('Workstation')} style={{ margin: 0, padding: '12px 24px', flex: '1 1 200px' }}>
            🎚️ Launch Multi-Track DAW Workstation
          </button>
          <button className="glowing-button secondary" onClick={() => setShowVstModal(true)} style={{ margin: 0, padding: '12px 24px', borderColor: 'var(--secondary-glow)', color: 'var(--secondary-glow)', flex: '1 1 200px' }}>
            🔌 External VST DAW Integration
          </button>
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
            { id: 'cymatic_collector', title: 'Cymatic Collector', icon: '🎨', desc: 'Minted a performance-reactive animated SVG mandala on the blockchain.', earned: localStorage.getItem('ariyus_nft_minted') === 'true' },
            { id: 'harmonizer_choir', title: 'Choir Conductor', icon: '🎼', desc: 'Activate the AI Vocal Harmonizer to expand vocal layers.', earned: localStorage.getItem('ariyus_used_harmonizer') === 'true' },
            { id: 'vocal_pilot', title: 'Vocal Pilot', icon: '🚀', desc: 'Guide the starship through Solfeggio Gates in the Vocal Arcade.', earned: localStorage.getItem('ariyus_arcade_completed') === 'true' },
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
      {/* VST Integration Modal */}
      {showVstModal && (
        <div className="custom-alert-overlay" onClick={() => setShowVstModal(false)}>
          <div className="custom-alert-box glass-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px', textAlign: 'left', padding: '25px' }}>
            <h3 style={{ textShadow: '0 0 10px var(--secondary-glow)', marginBottom: '5px' }}>🔌 External DAW VST Plugin Link</h3>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.78rem', marginBottom: '15px', marginTop: 0 }}>
              Route your local browser vocal baselines, calibrations, and Solfeggio filters directly into external DAWs (Ableton Live, FL Studio, Logic Pro).
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              
              {/* Key generator */}
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>External VST Handshake Token</span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input 
                    type="text" 
                    readOnly 
                    value={vstKey || 'NO KEY GENERATED'} 
                    style={{ flexGrow: 1, padding: '8px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--glass-border)', color: vstKey ? '#fff' : 'var(--text-dim)', borderRadius: '6px', fontFamily: 'monospace', fontSize: '0.85rem' }}
                  />
                  <button className="glowing-button" onClick={handleGenerateVstKey} style={{ margin: 0, padding: '8px 12px', fontSize: '0.72rem' }}>
                    Generate Key
                  </button>
                </div>
              </div>

              {/* Status indicators */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ 
                    width: '10px', height: '10px', borderRadius: '50%', 
                    background: vstStatus === 'Streaming' ? '#00ff87' : (vstStatus === 'Connecting' ? '#ffb700' : '#888'), 
                    boxShadow: vstStatus === 'Streaming' ? '0 0 8px #00ff87' : '',
                    animation: vstStatus === 'Connecting' ? 'pulse-red 1.5s infinite' : 'none'
                  }} />
                  <span style={{ fontSize: '0.8rem', color: '#fff' }}>Status: <strong>{vstStatus}</strong></span>
                </div>
                <button 
                  className="glowing-button secondary" 
                  disabled={!vstKey}
                  onClick={() => {
                    if (vstStatus === 'Offline') {
                      setVstStatus('Connecting');
                      setTimeout(() => setVstStatus('Streaming'), 1200);
                    } else {
                      setVstStatus('Offline');
                    }
                  }}
                  style={{ margin: 0, padding: '5px 12px', fontSize: '0.72rem', opacity: vstKey ? 1 : 0.5 }}
                >
                  {vstStatus === 'Offline' ? 'Connect VST' : 'Disconnect'}
                </button>
              </div>

              {/* Telemetry output */}
              {vstStatus === 'Streaming' && (
                <div style={{ background: 'rgba(0, 242, 255, 0.03)', border: '1px solid var(--primary-glow)', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-dim)' }}>Carrier:</span> <span style={{ color: 'var(--primary-glow)' }}>528Hz Solfeggio</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-dim)' }}>Output Jitter:</span> <span style={{ color: '#fff' }}>0.55%</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-dim)' }}>Output Shimmer:</span> <span style={{ color: '#fff' }}>0.48%</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-dim)' }}>Streaming Buffer:</span> <span style={{ color: 'var(--secondary-glow)' }}>Active 44.1kHz</span></div>
                </div>
              )}

              {/* Simulated download */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Download VST Plugin package:</span>
                <button 
                  className="glowing-button secondary" 
                  onClick={() => {
                    alert("Initiating secure download of AriyusVST_x64.zip package. Locate installation DLL/VST3 inside your DAW plugins folder.");
                  }}
                  style={{ margin: 0, padding: '6px 12px', fontSize: '0.72rem' }}
                >
                  💾 Download VST
                </button>
              </div>

            </div>

            <button className="glowing-button" onClick={() => setShowVstModal(false)} style={{ marginTop: '20px', width: '100%', margin: '20px 0 0 0' }}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
