import React, { useState } from 'react';

const UploadTrack = ({ navigate }) => {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [genre, setGenre] = useState('Pop');
  const [difficulty, setDifficulty] = useState('Medium');
  const [audioUrl, setAudioUrl] = useState('https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Happy%20Life.mp3');
  const [lyrics, setLyrics] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title || !artist || !lyrics) {
      alert("Please fill in the title, artist, and lyrics fields.");
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      const newSong = {
        id: 'song_custom_' + Date.now(),
        title,
        artist,
        genre,
        difficulty,
        audioUrl,
        lyrics
      };

      const custom = localStorage.getItem('ariyus_custom_songs');
      const list = custom ? JSON.parse(custom) : [];
      list.push(newSong);
      localStorage.setItem('ariyus_custom_songs', JSON.stringify(list));

      setIsSubmitting(false);
      alert(`Backing track "${title}" published to catalog successfully!`);
      navigate('SongLibrary');
    }, 1000);
  };

  return (
    <div className="screen-wrapper">
      <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '20px' }}>
        <button 
          className="glowing-button secondary" 
          style={{ padding: '6px 12px', fontSize: '0.8rem', margin: 0 }}
          onClick={() => navigate('SongLibrary')}
        >
          ← Catalog
        </button>
        <h1 className="suspended-title" style={{ margin: 0 }}>Upload Backing Track</h1>
      </div>

      <div className="glass-panel" style={{ maxWidth: '650px', margin: '0 auto' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '5px', textTransform: 'uppercase' }}>Song Title</label>
            <input 
              type="text" 
              placeholder="e.g. Blinding Lights" 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              className="comment-input"
              style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', color: '#fff', borderRadius: '8px' }}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '5px', textTransform: 'uppercase' }}>Artist Name</label>
            <input 
              type="text" 
              placeholder="e.g. The Weeknd" 
              value={artist} 
              onChange={e => setArtist(e.target.value)} 
              className="comment-input"
              style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', color: '#fff', borderRadius: '8px' }}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '5px', textTransform: 'uppercase' }}>Genre</label>
              <select 
                value={genre} 
                onChange={e => setGenre(e.target.value)} 
                className="comment-input"
                style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', color: '#fff', borderRadius: '8px' }}
              >
                <option value="Pop">Pop</option>
                <option value="Rock">Rock</option>
                <option value="R&B">R&B</option>
                <option value="Meditation">Meditation</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '5px', textTransform: 'uppercase' }}>Vocal Difficulty</label>
              <select 
                value={difficulty} 
                onChange={e => setDifficulty(e.target.value)} 
                className="comment-input"
                style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', color: '#fff', borderRadius: '8px' }}
              >
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '5px', textTransform: 'uppercase' }}>Backing Instrumental URL</label>
            <input 
              type="url" 
              value={audioUrl} 
              onChange={e => setAudioUrl(e.target.value)} 
              className="comment-input"
              style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', color: '#fff', borderRadius: '8px' }}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '5px', textTransform: 'uppercase' }}>Lyrics (Line-by-line)</label>
            <textarea 
              rows="6"
              placeholder="Paste scrolling lyrics sheet here..." 
              value={lyrics} 
              onChange={e => setLyrics(e.target.value)} 
              className="comment-input"
              style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', color: '#fff', borderRadius: '8px', fontFamily: 'monospace' }}
              required
            />
          </div>

          <button 
            type="submit" 
            className="glowing-button" 
            style={{ width: '100%', marginTop: '10px' }}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Publishing backing track...' : '🚀 Publish Backing Track'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default UploadTrack;
