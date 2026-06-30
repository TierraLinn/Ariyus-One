import React, { useState } from 'react';

const DraftsList = ({ navigate, handleSaveAndShare }) => {
  const [drafts, setDrafts] = useState(() => {
    const saved = localStorage.getItem('ariyus_drafts');
    return saved ? JSON.parse(saved) : [];
  });
  const [playingId, setPlayingId] = useState(null);
  const audioRef = React.useRef(null);

  const handlePlayToggle = (draft) => {
    if (playingId === draft.id) {
      if (audioRef.current) audioRef.current.pause();
      setPlayingId(null);
    } else {
      if (audioRef.current) audioRef.current.pause();
      const audio = new Audio(draft.playbackUrl);
      audio.loop = true;
      audio.play().catch(e => console.warn(e));
      audioRef.current = audio;
      setPlayingId(draft.id);
    }
  };

  const handleDelete = (id) => {
    const updated = drafts.filter(d => d.id !== id);
    setDrafts(updated);
    localStorage.setItem('ariyus_drafts', JSON.stringify(updated));
  };

  const handlePublish = (draft) => {
    // Publish draft to the collective feed
    handleSaveAndShare({
      song: draft.song,
      score: draft.score,
      grade: draft.grade,
      playbackUrl: draft.playbackUrl,
      vocalFilter: draft.vocalFilter,
      caption: "Published from offline drafts."
    });

    // Remove from drafts list
    handleDelete(draft.id);
  };

  return (
    <div className="screen-wrapper">
      <div className="floating-notes">🎵</div>
      <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '20px' }}>
        <button 
          className="glowing-button secondary" 
          style={{ padding: '6px 12px', fontSize: '0.8rem', margin: 0 }}
          onClick={() => navigate('Profile')}
        >
          ← Profile
        </button>
        <h1 className="suspended-title" style={{ margin: 0 }}>My Drafts</h1>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {drafts.length > 0 ? (
          drafts.map(draft => (
            <div key={draft.id} className="glass-panel" style={{ 
              margin: 0, 
              padding: '20px', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              borderColor: 'rgba(0, 242, 255, 0.15)' 
            }}>
              <div>
                <h3 style={{ margin: 0, color: '#fff', fontSize: '1.2rem' }}>{draft.song?.title}</h3>
                <p style={{ color: 'var(--text-dim)', margin: '4px 0 8px 0', fontSize: '0.85rem' }}>
                  Recorded on: {draft.createdAt} | Filter: {draft.vocalFilter || 'none'}
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <span style={{ fontSize: '0.72rem', background: draft.grade?.color ? `${draft.grade.color}15` : 'rgba(0,0,0,0.2)', border: `1px solid ${draft.grade?.color || 'rgba(255,255,255,0.1)'}`, color: draft.grade?.color || '#fff', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                    Grade: {draft.grade?.letter || 'B'} ({draft.score}%)
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="glowing-button" style={{ margin: 0, padding: '8px 16px', fontSize: '0.75rem' }} onClick={() => handlePlayToggle(draft)}>
                  {playingId === draft.id ? '⏸ Pause' : '▶ Play'}
                </button>
                <button className="glowing-button secondary" style={{ margin: 0, padding: '8px 16px', fontSize: '0.75rem' }} onClick={() => handlePublish(draft)}>
                  🚀 Publish
                </button>
                <button className="glowing-button secondary" style={{ margin: 0, padding: '8px 16px', fontSize: '0.75rem', borderColor: 'var(--secondary-glow)', color: 'var(--secondary-glow)' }} onClick={() => handleDelete(draft.id)}>
                  🗑️ Delete
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="glass-panel" style={{ textAlign: 'center', color: 'var(--text-dim)' }}>
            No drafts currently saved. Record a cover and save it to drafts to preview here!
          </div>
        )}
      </div>
    </div>
  );
};

export default DraftsList;
