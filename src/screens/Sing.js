import React, { useState } from 'react';

const defaultCatalog = [
  { id: 's1', title: 'Blinding Lights', artist: 'The Weeknd', genre: 'Pop', difficulty: 'Medium', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Happy%20Life.mp3', lyrics: "I been tryna call\nI been on my own for long enough\nMaybe you can show me how to love, maybe\nI going through withdrawals\nYou don't even have to do too much\nYou can turn me on with just a touch, baby" },
  { id: 's2', title: 'Imagine', artist: 'John Lennon', genre: 'Rock', difficulty: 'Easy', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Planning.mp3', lyrics: "Imagine there's no heaven\nIt's easy if you try\nNo hell below us\nAbove us, only sky\nImagine all the people\nLiving for today" },
  { id: 's3', title: 'Rolling in the Deep', artist: 'Adele', genre: 'R&B', difficulty: 'Hard', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Newness.mp3', lyrics: "There's a fire starting in my heart\nReaching a fever pitch and it's bringing me out the dark\nFinally, I can see you crystal clear\nGo ahead and sell me out and I'll lay your ship bare" },
  { id: 's4', title: 'Cosmic Resonance', artist: 'Solfeggio Choir', genre: 'Meditation', difficulty: 'Easy', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Illusionist.mp3', lyrics: "Oooohhhhhh\nAhaaaaahhhhh\nResonate with the light\nDNA healing tonight\nOooohhhhhh" },
  { id: 's5', title: 'Flowers', artist: 'Miley Cyrus', genre: 'Pop', difficulty: 'Medium', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Happy%20Life.mp3', lyrics: "I can buy myself flowers\nWrite my name in the sand\nTalk to myself for hours\nSay things you don't understand\nI can take myself dancing\nAnd I can hold my own hand" }
];

const SongLibrary = ({ navigate, setCurrentRecording }) => {
  const [songs] = useState(() => {
    const custom = localStorage.getItem('ariyus_custom_songs');
    const parsedCustom = custom ? JSON.parse(custom) : [];
    return [...defaultCatalog, ...parsedCustom];
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');

  const filteredSongs = songs.filter(song => {
    const matchesSearch = song.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          song.artist.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGenre = selectedGenre === 'All' || song.genre === selectedGenre;
    const matchesDifficulty = selectedDifficulty === 'All' || song.difficulty === selectedDifficulty;
    return matchesSearch && matchesGenre && matchesDifficulty;
  });

  const handleSelectSong = (song) => {
    setCurrentRecording({
      selectedSong: song,
      playbackUrl: null,
      grade: null,
      score: 0,
      recordingData: null
    });
    navigate('Recording');
  };

  return (
    <div className="screen-wrapper">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 className="suspended-title" style={{ margin: 0 }}>Song Library</h1>
        <button 
          className="glowing-button" 
          style={{ padding: '8px 16px', fontSize: '0.8rem', margin: 0 }}
          onClick={() => navigate('Upload')}
        >
          ➕ Upload Custom Track
        </button>
      </div>

      <div className="glass-panel" style={{ padding: '20px', marginBottom: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
          {/* Search Input */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '5px', textTransform: 'uppercase' }}>Search</label>
            <input 
              type="text" 
              placeholder="Search title/artist..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
              className="comment-input"
              style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', color: '#fff', borderRadius: '8px' }}
            />
          </div>
          
          {/* Genre Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '5px', textTransform: 'uppercase' }}>Genre</label>
            <select 
              value={selectedGenre} 
              onChange={e => setSelectedGenre(e.target.value)} 
              className="comment-input"
              style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', color: '#fff', borderRadius: '8px' }}
            >
              <option value="All">All Genres</option>
              <option value="Pop">Pop</option>
              <option value="Rock">Rock</option>
              <option value="R&B">R&B</option>
              <option value="Meditation">Meditation</option>
            </select>
          </div>

          {/* Difficulty Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '5px', textTransform: 'uppercase' }}>Difficulty</label>
            <select 
              value={selectedDifficulty} 
              onChange={e => setSelectedDifficulty(e.target.value)} 
              className="comment-input"
              style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', color: '#fff', borderRadius: '8px' }}
            >
              <option value="All">All Difficulties</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {filteredSongs.length > 0 ? (
          filteredSongs.map(song => (
            <div key={song.id} className="glass-panel" style={{ 
              margin: 0, 
              padding: '20px', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              borderColor: 'rgba(255,255,255,0.06)' 
            }}>
              <div>
                <h3 style={{ margin: 0, color: '#fff', fontSize: '1.25rem' }}>{song.title}</h3>
                <p style={{ color: 'var(--text-dim)', margin: '4px 0 8px 0', fontSize: '0.9rem' }}>{song.artist}</p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <span style={{ fontSize: '0.72rem', background: 'rgba(0, 242, 255, 0.1)', border: '1px solid rgba(0, 242, 255, 0.25)', color: 'var(--primary-glow)', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 'bold' }}>
                    {song.genre}
                  </span>
                  <span style={{ 
                    fontSize: '0.72rem', 
                    background: song.difficulty === 'Hard' ? 'rgba(255, 0, 193, 0.1)' : (song.difficulty === 'Medium' ? 'rgba(255, 183, 0, 0.1)' : 'rgba(0, 255, 135, 0.1)'), 
                    border: song.difficulty === 'Hard' ? '1px solid rgba(255, 0, 193, 0.25)' : (song.difficulty === 'Medium' ? '1px solid rgba(255, 183, 0, 0.25)' : '1px solid rgba(0, 255, 135, 0.25)'), 
                    color: song.difficulty === 'Hard' ? 'var(--secondary-glow)' : (song.difficulty === 'Medium' ? '#ffb700' : '#00ff87'), 
                    padding: '2px 8px', 
                    borderRadius: '4px', 
                    textTransform: 'uppercase', 
                    fontWeight: 'bold' 
                  }}>
                    {song.difficulty}
                  </span>
                </div>
              </div>

              <button className="glowing-button" style={{ margin: 0, padding: '10px 22px' }} onClick={() => handleSelectSong(song)}>
                🎙️ Sing Track
              </button>
            </div>
          ))
        ) : (
          <div className="glass-panel" style={{ textAlign: 'center', color: 'var(--text-dim)' }}>
            No tracks found matching criteria. Upload a custom track to get started!
          </div>
        )}
      </div>
    </div>
  );
};

export default SongLibrary;
