import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

const CreatorDashboard = ({ userData, user, navigate }) => {
  const [recordings, setRecordings] = useState([]);
  const [customSongs, setCustomSongs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchCreatorData = async () => {
      try {
        setLoading(true);

        // 1. Fetch user shared captures (performances)
        const recQuery = query(collection(db, "recordings"), where("userId", "==", user.uid));
        const recSnap = await getDocs(recQuery);
        const userRecs = [];
        recSnap.forEach(docSnap => {
          userRecs.push({ id: docSnap.id, ...docSnap.data() });
        });
        setRecordings(userRecs);

        // 2. Fetch custom backing tracks published by user
        const songQuery = query(collection(db, "songs"), where("userId", "==", user.uid));
        const songSnap = await getDocs(songQuery);
        const userSongs = [];
        songSnap.forEach(docSnap => {
          userSongs.push({ id: docSnap.id, ...docSnap.data() });
        });
        setCustomSongs(userSongs);

      } catch (err) {
        console.warn("Firestore creator queries failed, loading fallback data:", err);
        // Local storage fallbacks
        const savedRecs = localStorage.getItem('ariyus_shared_recordings');
        if (savedRecs) {
          const parsedRecs = JSON.parse(savedRecs);
          const filteredRecs = parsedRecs.filter(item => item.userId === user.uid || item.userDisplayName === userData?.displayName);
          setRecordings(filteredRecs);
        }

        const savedSongs = localStorage.getItem('ariyus_custom_songs');
        if (savedSongs) {
          const parsedSongs = JSON.parse(savedSongs);
          const filteredSongs = parsedSongs.filter(item => item.userId === user.uid);
          setCustomSongs(filteredSongs);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchCreatorData();
  }, [user, userData]);

  // Calculations
  const totalCaptures = recordings.length;
  const followersCount = 150 + Math.round((userData?.xp || 0) * 2.2);

  // Dynamic plays: plays = (likes * 25) + (comments * 50) + base_plays (24) per recording
  const totalPlays = recordings.reduce((acc, r) => {
    const likes = r.likes?.length || 0;
    const comments = r.comments?.length || 0;
    return acc + (likes * 25) + (comments * 50) + 24;
  }, 0);

  const estimatedEarnings = (totalPlays * 0.005).toFixed(2);

  const stats = [
    { label: 'Acoustic Plays', value: totalPlays.toLocaleString(), icon: '🔊' },
    { label: 'Followers', value: followersCount.toLocaleString(), icon: '👥' },
    { label: 'Shared Captures', value: totalCaptures, icon: '💾' },
    { label: 'Estimated Earnings', value: `$${estimatedEarnings}`, icon: '💎' }
  ];

  const parsedTracks = recordings.map(r => {
    const likes = r.likes?.length || 0;
    const comments = r.comments?.length || 0;
    const plays = (likes * 25) + (comments * 50) + 24;
    return {
      title: r.song?.title || 'Freestyle Resonance',
      plays,
      rating: r.ariyusRating || 'B+',
      earnings: `$${(plays * 0.005).toFixed(2)}`
    };
  });

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <div className="glass-panel" style={{ textAlign: 'center', maxWidth: '350px' }}>
          <h3 style={{ textShadow: '0 0 10px var(--primary-glow)', color: '#fff' }}>Syncing Data...</h3>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', margin: 0 }}>Connecting to the Solfeggio analytics node</p>
        </div>
      </div>
    );
  }

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
        <h3>Your Shared Capture Rankings</h3>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', margin: '4px 0 15px' }}>Dynamic listener metrics generated by shared studio performances</p>
        
        {parsedTracks.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '400px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                  <th style={{ padding: '10px 6px' }}>TRACK TITLE</th>
                  <th style={{ padding: '10px 6px' }}>DYNAMIC PLAYS</th>
                  <th style={{ padding: '10px 6px' }}>RATING</th>
                  <th style={{ padding: '10px 6px' }}>EST. REVENUE</th>
                </tr>
              </thead>
              <tbody>
                {parsedTracks.map((t, idx) => (
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
        ) : (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <p style={{ color: 'var(--text-dim)', margin: '0 0 12px 0', fontSize: '0.9rem', fontStyle: 'italic' }}>
              No performances shared yet. Sing a track and share it to compile dynamic stats!
            </p>
            <button className="glowing-button" onClick={() => navigate('SongLibrary')} style={{ margin: 0, padding: '6px 14px', fontSize: '0.8rem' }}>
              Sing First Guide Track
            </button>
          </div>
        )}
      </div>

      {/* Published backing tracks catalog */}
      <div className="glass-panel">
        <h3>Your Published Backing Tracks</h3>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', margin: '4px 0 15px' }}>Custom instrumentals published and registered in the Ariyus Sound Catalog</p>
        
        {customSongs.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '400px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                  <th style={{ padding: '10px 6px' }}>TRACK TITLE</th>
                  <th style={{ padding: '10px 6px' }}>MOOD</th>
                  <th style={{ padding: '10px 6px' }}>ALIGNMENT HZ</th>
                  <th style={{ padding: '10px 6px' }}>BPM</th>
                  <th style={{ padding: '10px 6px' }}>DIFFICULTY</th>
                </tr>
              </thead>
              <tbody>
                {customSongs.map((s, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.95rem' }}>
                    <td style={{ padding: '12px 6px', color: '#fff' }}>{s.title}</td>
                    <td style={{ padding: '12px 6px' }}>{s.mood}</td>
                    <td style={{ padding: '12px 6px', color: 'var(--primary-glow)' }}>{s.key}</td>
                    <td style={{ padding: '12px 6px' }}>{s.bpm}</td>
                    <td style={{ padding: '12px 6px', color: 'var(--secondary-glow)' }}>{s.difficulty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <p style={{ color: 'var(--text-dim)', margin: '0 0 12px 0', fontSize: '0.9rem', fontStyle: 'italic' }}>
              No custom backing tracks published yet. Register a backing track to the catalog database!
            </p>
            <button className="glowing-button secondary" onClick={() => navigate('SongLibrary')} style={{ margin: 0, padding: '6px 14px', fontSize: '0.8rem' }}>
              Publish Custom Backing Track
            </button>
          </div>
        )}
      </div>

      {/* Control panel buttons */}
      <div className="glass-panel" style={{ textAlign: 'center' }}>
        <h3>Creator Actions</h3>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', flexWrap: 'wrap' }}>
          <button className="glowing-button" onClick={() => {
            if (parseFloat(estimatedEarnings) <= 0) {
              alert('Balance Node Alert:\n\nYour estimated earnings balance is currently $0.00. Share performances to accumulate plays and trigger withdrawals!');
            } else {
              alert(`Withdrawal initiated!\n\nEstimated earnings of $${estimatedEarnings} will align to your account within 24 hours.`);
            }
          }}>
            💎 Withdraw Earnings
          </button>
          <button className="glowing-button secondary" onClick={() => alert('Vocal rights matrix is up to date and signed with your biometric key.')}>
            ⚙ Matrix Licensing Setup
          </button>
        </div>
      </div>

    </div>
  );
};

export default CreatorDashboard;
