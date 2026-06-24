import React, { useState, useEffect } from 'react';

const defaultCatalog = [
  { id: 'ds1', title: 'Blinding Lights', artist: 'The Weeknd', genre: 'Synthwave', mood: 'Energetic', bpm: 171, key: 'F minor', difficulty: 'Medium', audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', lyrics: 'I been tryna call\nI been on my own for long enough\nMaybe you can show me how to love, maybe\nI going through withdrawals\nYou don\'t even have to do too much\nYou can turn me on with just a touch, baby' },
  { id: 'ds2', title: 'Imagine', artist: 'John Lennon', genre: 'Classic Rock', mood: 'Calm', bpm: 75, key: 'C major', difficulty: 'Easy', audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', lyrics: 'Imagine there\'s no heaven\nIt\'s easy if you try\nNo hell below us\nAbove us, only sky\nImagine all the people\nLiving for today' },
  { id: 'ds3', title: 'Cosmic Resonance', artist: 'Solfeggio Choir', genre: 'Ambient', mood: 'Mystical', bpm: 60, key: '528Hz', difficulty: 'Easy', audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', lyrics: 'Oooohhhhhh\nAhaaaaahhhhh\nResonate with the light\nDNA healing tonight\nOooohhhhhh' },
  { id: 'ds4', title: 'Rolling in the Deep', artist: 'Adele', genre: 'Soul', mood: 'Emotional', bpm: 105, key: 'C minor', difficulty: 'Hard', audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3', lyrics: 'There\'s a fire starting in my heart\nReaching a fever pitch and it\'s bringing me out the dark\nFinally, I can see you crystal clear\nGo ahead and sell me out and I\'ll lay your ship bare' }
];

const SongLibrary = ({ navigate }) => {
  const [songs, setSongs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMood, setSelectedMood] = useState('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  
  // Custom Song Uploader Form State
  const [showUploader, setShowUploader] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newArtist, setNewArtist] = useState('');
  const [newGenre, setNewGenre] = useState('Pop');
  const [newMood, setNewMood] = useState('Energetic');
  const [newBpm, setNewBpm] = useState(120);
  const [newKey, setNewKey] = useState('C major');
  const [newDifficulty, setNewDifficulty] = useState('Medium');
  const [newLyrics, setNewLyrics] = useState('');
  const [selectedFile, setSelectedFile] = useState('');
  const [newAudioUrl, setNewAudioUrl] = useState('');

  useEffect(() => {
    // Load local storage custom songs and merge with default catalog
    const localSongsStr = localStorage.getItem('ariyus_custom_songs');
    const localSongs = localSongsStr ? JSON.parse(localSongsStr) : [];
    setSongs([...defaultCatalog, ...localSongs]);
  }, []);

  const handleUpload = (e) => {
    e.preventDefault();
    if (!newTitle || !newArtist) return;

    const newSong = {
      id: 'custom_' + Date.now(),
      title: newTitle,
      artist: newArtist,
      genre: newGenre,
      mood: newMood,
      bpm: parseInt(newBpm),
      key: newKey,
      difficulty: newDifficulty,
      lyrics: newLyrics || 'No lyrics provided.',
      audioUrl: newAudioUrl || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
      isCustom: true
    };

    const updatedSongs = [...songs, newSong];
    setSongs(updatedSongs);

    // Save custom list only
    const customList = updatedSongs.filter(s => s.isCustom);
    localStorage.setItem('ariyus_custom_songs', JSON.stringify(customList));

    // Reset Form
    setNewTitle('');
    setNewArtist('');
    setNewLyrics('');
    setSelectedFile('');
    setNewAudioUrl('');
    setShowUploader(false);
  };

  const filteredSongs = songs.filter(song => {
    const matchesSearch = song.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          song.artist.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesMood = selectedMood === 'All' || song.mood === selectedMood;
    const matchesDifficulty = selectedDifficulty === 'All' || song.difficulty === selectedDifficulty;
    return matchesSearch && matchesMood && matchesDifficulty;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Header and Add Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h2 style={{ textShadow: '0 0 10px var(--primary-glow)', margin: 0 }}>Vocal Catalog</h2>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', margin: '4px 0 0' }}>Search vocal patterns and Solfeggio guides</p>
        </div>
        <button className="glowing-button secondary" onClick={() => setShowUploader(!showUploader)}>
          {showUploader ? 'Close Uploader' : 'Upload Custom Song'}
        </button>
      </div>

      {/* Upload Custom Song Form Panel */}
      {showUploader && (
        <div className="glass-panel uploader-panel" style={{ animation: 'fadeIn 0.4s ease' }}>
          <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '8px' }}>Register Sound Matrix</h3>
          <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Song Title</label>
                <input type="text" placeholder="e.g. Starboy" value={newTitle} onChange={e => setNewTitle(e.target.value)} className="glass-input" required />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Artist</label>
                <input type="text" placeholder="e.g. The Weeknd" value={newArtist} onChange={e => setNewArtist(e.target.value)} className="glass-input" required />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Genre</label>
                <select value={newGenre} onChange={e => setNewGenre(e.target.value)} className="glass-input">
                  <option>Pop</option><option>Ambient</option><option>Classic Rock</option><option>Indie</option><option>Electronic</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Mood</label>
                <select value={newMood} onChange={e => setNewMood(e.target.value)} className="glass-input">
                  <option>Energetic</option><option>Calm</option><option>Mystical</option><option>Emotional</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>BPM</label>
                <input type="number" value={newBpm} onChange={e => setNewBpm(e.target.value)} className="glass-input" min="30" max="300" />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Key / Hz</label>
                <input type="text" placeholder="e.g. A minor" value={newKey} onChange={e => setNewKey(e.target.value)} className="glass-input" />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Difficulty</label>
                <select value={newDifficulty} onChange={e => setNewDifficulty(e.target.value)} className="glass-input">
                  <option>Easy</option><option>Medium</option><option>Hard</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Karaoke Lyrics</label>
              <textarea placeholder="Paste lyrics line by line..." value={newLyrics} onChange={e => setNewLyrics(e.target.value)} className="glass-input" style={{ minHeight: '100px', resize: 'vertical' }} />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', display: 'block', marginBottom: '6px' }}>Instrumental / Audio Track (optional)</label>
              <input 
                type="file" 
                accept="audio/*" 
                onChange={e => {
                  const file = e.target.files[0];
                  if (file) {
                    setSelectedFile(file.name);
                    setNewAudioUrl(URL.createObjectURL(file));
                  }
                }} 
                style={{ color: 'var(--text-dim)' }} 
              />
              {selectedFile && <p style={{ fontSize: '0.8rem', color: 'var(--primary-glow)', marginTop: '4px' }}>Loaded: {selectedFile}</p>}
            </div>

            <button type="submit" className="glowing-button" style={{ alignSelf: 'flex-start', marginTop: '10px' }}>
              Register Song Track
            </button>
          </form>
        </div>
      )}

      {/* Filters & Search Toolbar */}
      <div className="glass-panel" style={{ margin: 0, padding: '15px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'center' }}>
          <input 
            type="text" 
            placeholder="Search catalog by title or artist..." 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
            className="glass-input" 
            style={{ flexGrow: 1, margin: 0 }} 
          />
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <select value={selectedMood} onChange={e => setSelectedMood(e.target.value)} className="glass-input" style={{ width: '130px', margin: 0 }}>
              <option value="All">All Moods</option>
              <option value="Energetic">Energetic</option>
              <option value="Calm">Calm</option>
              <option value="Mystical">Mystical</option>
              <option value="Emotional">Emotional</option>
            </select>
            <select value={selectedDifficulty} onChange={e => setSelectedDifficulty(e.target.value)} className="glass-input" style={{ width: '150px', margin: 0 }}>
              <option value="All">All Difficulties</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>
        </div>
      </div>

      {/* Songs Display list */}
      <div className="song-grid">
        {filteredSongs.length > 0 ? (
          filteredSongs.map((song) => (
            <div key={song.id} className="song-catalog-card">
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3 style={{ fontSize: '1.15rem', color: '#fff', margin: 0 }}>{song.title}</h3>
                  {song.isCustom && <span className="level-badge" style={{ fontSize: '0.65rem', padding: '2px 6px', background: 'var(--tertiary-glow)' }}>Custom</span>}
                </div>
                <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', margin: '4px 0 8px' }}>{song.artist}</p>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', margin: '8px 0' }}>
                  <span className="level-badge" style={{ fontSize: '0.7rem', padding: '2px 8px', textShadow: 'none', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    {song.genre}
                  </span>
                  <span className="level-badge" style={{ fontSize: '0.7rem', padding: '2px 8px', textShadow: 'none', background: 'rgba(0, 242, 255, 0.08)', border: '1px solid rgba(0, 242, 255, 0.2)', color: 'var(--primary-glow)' }}>
                    {song.mood}
                  </span>
                </div>
              </div>
              <div>
                <div className="song-meta-grid">
                  <span>BPM: {song.bpm}</span>
                  <span>Key: {song.key}</span>
                  <span>Difficulty: {song.difficulty}</span>
                </div>
                <button 
                  className="glowing-button" 
                  style={{ width: '100%', margin: '12px 0 0 0', padding: '8px' }}
                  onClick={() => navigate('Recording', { selectedSong: song })}
                >
                  Sing guide Track
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="glass-panel" style={{ gridColumn: '1 / -1', textAlign: 'center' }}>
            <p style={{ margin: 0 }}>No matching frequencies found in database.</p>
          </div>
        )}
      </div>

    </div>
  );
};

export default SongLibrary;
