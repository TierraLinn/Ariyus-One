import React, { useState, useEffect } from 'react';
import { db, storage } from '../firebase';
import { collection, addDoc, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const defaultCatalog = [
  { id: 'ds1', title: 'Blinding Lights', artist: 'The Weeknd', genre: 'Synthwave', mood: 'Energetic', bpm: 171, key: 'F minor', difficulty: 'Medium', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Happy%20Life.mp3', lyrics: 'I been tryna call\nI been on my own for long enough\nMaybe you can show me how to love, maybe\nI going through withdrawals\nYou don\'t even have to do too much\nYou can turn me on with just a touch, baby' },
  { id: 'ds2', title: 'Imagine', artist: 'John Lennon', genre: 'Classic Rock', mood: 'Calm', bpm: 75, key: 'C major', difficulty: 'Easy', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Planning.mp3', lyrics: 'Imagine there\'s no heaven\nIt\'s easy if you try\nNo hell below us\nAbove us, only sky\nImagine all the people\nLiving for today' },
  { id: 'ds3', title: 'Cosmic Resonance', artist: 'Solfeggio Choir', genre: 'Ambient', mood: 'Mystical', bpm: 60, key: '528Hz', difficulty: 'Easy', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Illusionist.mp3', lyrics: 'Oooohhhhhh\nAhaaaaahhhhh\nResonate with the light\nDNA healing tonight\nOooohhhhhh' },
  { id: 'ds4', title: 'Rolling in the Deep', artist: 'Adele', genre: 'Soul', mood: 'Emotional', bpm: 105, key: 'C minor', difficulty: 'Hard', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Newness.mp3', lyrics: 'There\'s a fire starting in my heart\nReaching a fever pitch and it\'s bringing me out the dark\nFinally, I can see you crystal clear\nGo ahead and sell me out and I\'ll lay your ship bare' },
  { id: 'ds5', title: 'Flowers', artist: 'Miley Cyrus', genre: 'Pop', mood: 'Independent', bpm: 118, key: 'A minor', difficulty: 'Medium', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Happy%20Life.mp3', lyrics: 'I can buy myself flowers\nWrite my name in the sand\nTalk to myself for hours\nSay things you don\'t understand\nI can take myself dancing\nAnd I can hold my own hand' },
  { id: 'ds6', title: 'As It Was', artist: 'Harry Styles', genre: 'Indie Pop', mood: 'Nostalgic', bpm: 174, key: 'A major', difficulty: 'Easy', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Cinemato.mp3', lyrics: 'Holdin\' me back\nGravity\'s holdin\' me back\nI want you to hold out the palm of your hand\nWhy don\'t we leave it at that?\nNothin\' to say\nWhen everything gets in the way' },
  { id: 'ds7', title: 'DNA Healing Vibrations', artist: 'Resonance Project', genre: 'Meditation', mood: 'Mystical', bpm: 63, key: '444Hz', difficulty: 'Easy', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/My%20Inventions.mp3', lyrics: 'Breathe in the key of David\nFeel the physical renewal\nCellular grounding harmonics\nDNA repairing focus\nDeep breath...' },
  { id: 'ds8', title: 'Crown Awakening', artist: 'Pineal Soundscapes', genre: 'Spiritual', mood: 'Ethereal', bpm: 55, key: '963Hz', difficulty: 'Easy', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Science%20Fiction.mp3', lyrics: 'Connect to the cosmic source\nCrown chakra opening\nPineal gland activation\nPure frequency synchronization\nUniverse as one...' },
  { id: 'ds9', title: 'Stay', artist: 'The Kid LAROI & Justin Bieber', genre: 'Pop', mood: 'Energetic', bpm: 170, key: 'C# minor', difficulty: 'Medium', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Dubstepper.mp3', lyrics: 'I do the same thing I told you that I never would\nI told you I\'d change, even when I knew I never could\nI know that I can\'t find nobody else as good as you\nNeed you to stay, need you to stay, yeah' },
  { id: 'ds10', title: 'Bad Guy', artist: 'Billie Eilish', genre: 'Alt Pop', mood: 'Moody', bpm: 135, key: 'G minor', difficulty: 'Medium', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Fury.mp3', lyrics: 'White shirt now red, my bloody nose\nSleepin\', you\'re on your tippy toes\nCreepin\' around like no one knows\nThink you\'re so criminal\nBruises on both my knees for you' },
  { id: 'ds11', title: 'Levitating', artist: 'Dua Lipa', genre: 'Disco Pop', mood: 'Energetic', bpm: 103, key: 'B minor', difficulty: 'Medium', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Gamer%20Guy.mp3', lyrics: 'If you wanna run away with me, I know a galaxy\nAnd I can take you for a ride\nI had a premonition that we fell into a rhythm\nWhere the music don\'t stop for life\nGlitter in the sky, glitter in my eyes' },
  { id: 'ds12', title: 'Perfect', artist: 'Ed Sheeran', genre: 'Acoustic', mood: 'Romantic', bpm: 95, key: 'Ab major', difficulty: 'Easy', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Mysterious.mp3', lyrics: 'I found a love for me\nDarling, just dive right in and follow my lead\nWell, I found a girl, beautiful and sweet\nOh, I never knew you were the someone waiting for me' },
  { id: 'ds13', title: 'Liberation Vibrations', artist: 'Root Solfeggio', genre: 'Meditation', mood: 'Calm', bpm: 70, key: '396Hz', difficulty: 'Easy', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Outsider.mp3', lyrics: 'Grounding into the earth\nReleasing deep sub-conscious fear\nRoot chakra activation\nAbsolute safety and peace...' },
  { id: 'ds14', title: 'Change Activation', artist: 'Sacral Soundscapes', genre: 'Meditation', mood: 'Calm', bpm: 65, key: '417Hz', difficulty: 'Easy', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Party%20Time.mp3', lyrics: 'Undoing negative situations\nClearing past traumatic cells\nSacral energy flow\nWelcoming alignment and change...' },
  { id: 'ds15', title: 'Golden Solitude', artist: 'Throat Purifier', genre: 'Acoustic', mood: 'Harmonic', bpm: 80, key: '741Hz', difficulty: 'Medium', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Sports%20Spirit.mp3', lyrics: 'Cleansing intuitive expressions\nPurifying throat chakra blockages\nSpeaking the natural truth\nInner golden clarity...' }
];

const SongLibrary = ({ navigate, userData }) => {
  const [songs, setSongs] = useState(() => {
    const localSongsStr = localStorage.getItem('ariyus_custom_songs');
    const localSongs = localSongsStr ? JSON.parse(localSongsStr) : [];
    return [...defaultCatalog, ...localSongs];
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMood, setSelectedMood] = useState('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  
  // Custom Song Uploader Form State
  const [showUploader, setShowUploader] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newArtist, setNewArtist] = useState('');
  const [newGenre, setNewGenre] = useState('Pop');
  const [newMood, setNewMood] = useState('Energetic');
  const [newBpm, setNewBpm] = useState(120);
  const [newKey, setNewKey] = useState('528Hz');
  const [newDifficulty, setNewDifficulty] = useState('Medium');
  const [newLyrics, setNewLyrics] = useState('');
  
  // Audio upload files state
  const [audioFile, setAudioFile] = useState(null);
  const [selectedFileName, setSelectedFileName] = useState('');

  // Load merged list from Firebase and default catalog
  const loadCatalog = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "songs"));
      const firebaseSongs = [];
      querySnapshot.forEach((docSnap) => {
        firebaseSongs.push({ id: docSnap.id, ...docSnap.data(), isCustom: true });
      });
      setSongs([...defaultCatalog, ...firebaseSongs]);
    } catch (e) {
      console.warn("Failed to load catalog from Firestore:", e);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, []);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!newTitle || !newArtist) return;

    setIsUploading(true);
    let finalAudioUrl = 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Happy%20Life.mp3';
    const songId = 'song_' + Date.now();

    try {
      // 1. Upload backing track to Storage if selected
      if (audioFile) {
        const storageRef = ref(storage, `songs/${songId}_${audioFile.name}`);
        const snapshot = await uploadBytes(storageRef, audioFile);
        finalAudioUrl = await getDownloadURL(snapshot.ref);
      }

      // 2. Save song metadata document to Firestore songs collection
      const newSong = {
        title: newTitle,
        artist: newArtist,
        genre: newGenre,
        mood: newMood,
        bpm: parseInt(newBpm),
        key: newKey,
        difficulty: newDifficulty,
        lyrics: newLyrics || 'Vibrate with target resonance...',
        audioUrl: finalAudioUrl,
        userId: userData?.uid || 'guest_user'
      };

      await addDoc(collection(db, "songs"), newSong);

      setIsUploading(false);
      alert(`Song "${newTitle}" uploaded to Storage and registered in Firebase catalog successfully!`);

      // Reset & Reload
      setNewTitle('');
      setNewArtist('');
      setNewLyrics('');
      setAudioFile(null);
      setSelectedFileName('');
      setShowUploader(false);
      loadCatalog();

    } catch (err) {
      console.warn("Firestore/Storage catalog save failed, falling back locally:", err);
      setIsUploading(false);

      const localNewSong = {
        id: songId,
        title: newTitle,
        artist: newArtist,
        genre: newGenre,
        mood: newMood,
        bpm: parseInt(newBpm),
        key: newKey,
        difficulty: newDifficulty,
        lyrics: newLyrics || 'Vibrate with target resonance...',
        audioUrl: finalAudioUrl,
        isCustom: true,
        userId: userData?.uid || 'guest_user'
      };

      const updatedLocal = [...songs, localNewSong];
      setSongs(updatedLocal);
      
      const customOnly = updatedLocal.filter(s => s.isCustom);
      localStorage.setItem('ariyus_custom_songs', JSON.stringify(customOnly));

      // Reset
      setNewTitle('');
      setNewArtist('');
      setNewLyrics('');
      setAudioFile(null);
      setSelectedFileName('');
      setShowUploader(false);
    }
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
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h2 style={{ textShadow: '0 0 10px var(--primary-glow)', margin: 0 }}>Vocal Catalog</h2>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', margin: '4px 0 0' }}>Search vocal patterns and Solfeggio guides</p>
        </div>
        <button 
          className="glowing-button secondary" 
          onClick={() => {
            if (userData?.tier !== 'Creator') {
              alert("Creator Membership Required!\n\nYou must upgrade your plan to the Creator tier to register and upload custom backing tracks to the Ariyus Sound Catalog.");
              navigate('Upgrade');
            } else {
              setShowUploader(!showUploader);
            }
          }} 
          disabled={isUploading}
        >
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
                <input type="text" placeholder="e.g. Starboy" value={newTitle} onChange={e => setNewTitle(e.target.value)} className="glass-input" required disabled={isUploading} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Artist</label>
                <input type="text" placeholder="e.g. The Weeknd" value={newArtist} onChange={e => setNewArtist(e.target.value)} className="glass-input" required disabled={isUploading} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Genre</label>
                <select value={newGenre} onChange={e => setNewGenre(e.target.value)} className="glass-input" disabled={isUploading}>
                  <option>Pop</option><option>Ambient</option><option>Classic Rock</option><option>Indie</option><option>Electronic</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Mood</label>
                <select value={newMood} onChange={e => setNewMood(e.target.value)} className="glass-input" disabled={isUploading}>
                  <option>Energetic</option><option>Calm</option><option>Mystical</option><option>Emotional</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>BPM</label>
                <input type="number" value={newBpm} onChange={e => setNewBpm(e.target.value)} className="glass-input" min="30" max="300" disabled={isUploading} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Alignment Key / Hz</label>
                <select value={newKey} onChange={e => setNewKey(e.target.value)} className="glass-input" disabled={isUploading}>
                  <option value="396Hz">396 Hz (Liberation)</option>
                  <option value="417Hz">417 Hz (Change)</option>
                  <option value="432Hz">432 Hz (Cosmic Sync)</option>
                  <option value="528Hz">528 Hz (DNA Miracle)</option>
                  <option value="639Hz">639 Hz (Harmonize)</option>
                  <option value="741Hz">741 Hz (Cleansing)</option>
                  <option value="852Hz">852 Hz (Cosmic Order)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Difficulty</label>
                <select value={newDifficulty} onChange={e => setNewDifficulty(e.target.value)} className="glass-input" disabled={isUploading}>
                  <option>Easy</option><option>Medium</option><option>Hard</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Karaoke Lyrics</label>
              <textarea placeholder="Paste lyrics line by line..." value={newLyrics} onChange={e => setNewLyrics(e.target.value)} className="glass-input" style={{ minHeight: '100px', resize: 'vertical' }} disabled={isUploading} />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', display: 'block', marginBottom: '6px' }}>Instrumental / Audio Track File (Upload to Cloud)</label>
              <input 
                type="file" 
                accept="audio/*" 
                onChange={e => {
                  const file = e.target.files[0];
                  if (file) {
                    setAudioFile(file);
                    setSelectedFileName(file.name);
                  }
                }} 
                style={{ color: 'var(--text-dim)' }} 
                disabled={isUploading}
              />
              {selectedFileName && <p style={{ fontSize: '0.8rem', color: 'var(--primary-glow)', marginTop: '4px' }}>Loaded: {selectedFileName}</p>}
            </div>

            <button type="submit" className="glowing-button" style={{ alignSelf: 'flex-start', marginTop: '10px' }} disabled={isUploading}>
              {isUploading ? 'Registering Sound Matrix...' : 'Register Song Track'}
            </button>
          </form>
        </div>
      )}

      {/* Filters Toolbar */}
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

      {/* Songs Grid */}
      <div className="song-grid">
        {filteredSongs.length > 0 ? (
          filteredSongs.map((song) => (
            <div key={song.id} className="song-catalog-card">
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3 style={{ fontSize: '1.15rem', color: '#fff', margin: 0 }}>{song.title}</h3>
                  {song.isCustom && <span className="level-badge" style={{ fontSize: '0.65rem', padding: '2px 6px', background: 'var(--tertiary-glow)' }}>Cloud</span>}
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
                  <span>Scale: {song.key}</span>
                  <span>Diff: {song.difficulty}</span>
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
