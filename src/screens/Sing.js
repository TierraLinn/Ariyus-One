import React, { useState } from 'react';

const defaultCatalog = [
  { id: 's1', title: 'Blinding Lights', artist: 'The Weeknd', genre: 'Pop', difficulty: 'Medium', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Newness.mp3', lyrics: "I been tryna call\nI been on my own for long enough\nMaybe you can show me how to love, maybe\nI going through withdrawals\nYou don't even have to do too much\nYou can turn me on with just a touch, baby" },
  { id: 's2', title: 'Imagine', artist: 'John Lennon', genre: 'Rock', difficulty: 'Easy', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Happy%20Life.mp3', lyrics: "Imagine there's no heaven\nIt's easy if you try\nNo hell below us\nAbove us, only sky\nImagine all the people\nLiving for today" },
  { id: 's3', title: 'Rolling in the Deep', artist: 'Adele', genre: 'R&B', difficulty: 'Hard', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Illusionist.mp3', lyrics: "There's a fire starting in my heart\nReaching a fever pitch and it's bringing me out the dark\nFinally, I can see you crystal clear\nGo ahead and sell me out and I'll lay your ship bare" },
  { id: 's4', title: 'Cosmic Resonance', artist: 'Solfeggio Choir', genre: 'Meditation', difficulty: 'Easy', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Illusionist.mp3', lyrics: "Oooohhhhhh\nAhaaaaahhhhh\nResonate with the light\nDNA healing tonight\nOooohhhhhh" },
  { id: 's5', title: 'Flowers', artist: 'Miley Cyrus', genre: 'Pop', difficulty: 'Medium', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Happy%20Life.mp3', lyrics: "I can buy myself flowers\nWrite my name in the sand\nTalk to myself for hours\nSay things you don't understand\nI can take myself dancing\nAnd I can hold my own hand" },
  { id: 's6', title: 'Bohemian Rhapsody', artist: 'Queen', genre: 'Rock', difficulty: 'Hard', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Newness.mp3', lyrics: "Is this the real life?\nIs this just fantasy?\nCaught in a landslide\nNo escape from reality\nOpen your eyes\nLook up to the skies and see" },
  { id: 's7', title: 'Stay', artist: 'The Kid LAROI & Justin Bieber', genre: 'Pop', difficulty: 'Medium', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Happy%20Life.mp3', lyrics: "I do the same thing I told you that I never would\nI told you I'd change, even when I knew I never could\nI know that I can't find nobody else as good as you\nI need you to stay, need you to stay, yeah" },
  { id: 's8', title: 'Solfeggio 528Hz', artist: 'Healing Frequencies', genre: 'Meditation', difficulty: 'Easy', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Newness.mp3', lyrics: "Breathe in the frequency of transformation\n528 Hertz cellular restoration\nLet the sound vibrate in your core\nUnlock the harmony and open the door" },
  { id: 's9', title: 'Solfeggio 432Hz', artist: 'Ambient Healing', genre: 'Meditation', difficulty: 'Easy', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Happy%20Life.mp3', lyrics: "Acoustic alignment to the natural grid\nRestore the sacred flow of life as we did\nDeep breathing, calm mind, heart release\nAlign to the frequency of peace" },
  { id: 's10', title: 'Perfect', artist: 'Ed Sheeran', genre: 'Pop', difficulty: 'Easy', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Illusionist.mp3', lyrics: "I found a love for me\nDarling, just dive right in and follow my lead\nWell, I found a girl, beautiful and sweet\nI never knew you were the someone waiting for me" },
  { id: 's11', title: 'Bad Guy', artist: 'Billie Eilish', genre: 'Pop', difficulty: 'Easy', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Newness.mp3', lyrics: "White shirt now red, my bloody nose\nSleepin', you're on your tippy toes\nCreepin' around like no one knows\nThink you're so criminal" },
  { id: 's12', title: 'As It Was', artist: 'Harry Styles', genre: 'Pop', difficulty: 'Medium', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Happy%20Life.mp3', lyrics: "Holdin' me back\nGravity's holdin' me back\nI want you to hold out the palm of your hand\nWhy don't we leave it at that?" },
  { id: 's13', title: 'Save Your Tears', artist: 'The Weeknd', genre: 'Pop', difficulty: 'Medium', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Illusionist.mp3', lyrics: "I saw you dancing in a crowded room\nYou look so happy when I'm not with you\nBut then you saw me, caught you by surprise\nA single teardrop falling from your eye" },
  { id: 's14', title: 'Hotel California', artist: 'Eagles', genre: 'Rock', difficulty: 'Medium', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Newness.mp3', lyrics: "On a dark desert highway, cool wind in my hair\nWarm smell of colitas, rising up through the air\nUp ahead in the distance, I saw a shimmering light\nMy head grew heavy and my sight grew dim" },
  { id: 's15', title: 'Don\'t Stop Believin\'', artist: 'Journey', genre: 'Rock', difficulty: 'Medium', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Happy%20Life.mp3', lyrics: "Just a small-town girl\nLivin' in a lonely world\nShe took the midnight train goin' anywhere\nJust a city boy, born and raised in South Detroit" },
  { id: 's16', title: 'Sweet Child O\' Mine', artist: 'Guns N\' Roses', genre: 'Rock', difficulty: 'Hard', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Illusionist.mp3', lyrics: "She's got a smile that it seems to me\nReminds me of childhood memories\nWhere everything was as fresh as the bright blue sky\nNow and then when I see her face" },
  { id: 's17', title: 'Levitating', artist: 'Dua Lipa', genre: 'Pop', difficulty: 'Medium', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Newness.mp3', lyrics: "If you wanna run away with me, I know a galaxy\nAnd I can take you for a ride\nI had a premonition that we fell into a rhythm\nWhere the music don't stop for life" },
  { id: 's18', title: 'Chakra Alignment', artist: 'Solfeggio Sound', genre: 'Meditation', difficulty: 'Easy', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Happy%20Life.mp3', lyrics: "Root, red energy, rise through my base\nSacral, orange flow, creative warm embrace\nSolar, yellow light, power full and clean\nHeart, emerald green, healing grace unseen" },
  { id: 's19', title: 'Someone Like You', artist: 'Adele', genre: 'Pop', difficulty: 'Hard', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Illusionist.mp3', lyrics: "I heard that you're settled down\nThat you found a girl and you're married now\nI heard that your dreams came true\nGuess she gave you things I didn't give to you" },
  { id: 's20', title: 'Solfeggio 639Hz', artist: 'Harmonious Hearts', genre: 'Meditation', difficulty: 'Easy', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Newness.mp3', lyrics: "Connect relationships, mend standard bounds\nHeart center resonance in chakra sounds\nBring mutual understanding, clear all strife\nCelebrate the beautiful frequency of life" },
  { id: 's21', title: 'Drivers License', artist: 'Olivia Rodrigo', genre: 'Pop', difficulty: 'Medium', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Happy%20Life.mp3', lyrics: "I got my driver's license last week\nJust like we always talked about\n'Cause you were so excited for me\nTo finally drive up to your house" },
  { id: 's22', title: 'Halo', artist: 'Beyoncé', genre: 'R&B', difficulty: 'Hard', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Illusionist.mp3', lyrics: "Remember those walls I built?\nWell, baby, they're tumbling down\nAnd they didn't even put up a fight\nThey didn't even make a sound" },
  { id: 's23', title: 'Shallow', artist: 'Lady Gaga & Bradley Cooper', genre: 'Pop', difficulty: 'Medium', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Newness.mp3', lyrics: "Tell me something, girl\nAre you happy in this modern world?\nOr do you need more?\nIs there something else you're searching for?" },
  { id: 's24', title: 'Livin\' on a Prayer', artist: 'Bon Jovi', genre: 'Rock', difficulty: 'Hard', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Happy%20Life.mp3', lyrics: "Once upon a time, not so long ago\nTommy used to work on the docks, union's been on strike\nHe's down on his luck, it's tough, so tough\nGina works the diner all day, working for her man" },
  { id: 's25', title: 'Creep', artist: 'Radiohead', genre: 'Rock', difficulty: 'Medium', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Illusionist.mp3', lyrics: "When you were here before\nCouldn't look you in the eye\nYou're just like an angel\nYour skin makes me cry" },
  { id: 's26', title: 'Attention', artist: 'Charlie Puth', genre: 'Pop', difficulty: 'Hard', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Newness.mp3', lyrics: "You've been runnin' 'round, runnin' 'round, runnin' 'round throwing that dirt on my name\n'Cause you knew that I, knew that I, knew that I'd call you up\nYou've been going round, going round, going round every party in LA" },
  { id: 's27', title: 'Superstition', artist: 'Stevie Wonder', genre: 'R&B', difficulty: 'Hard', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Happy%20Life.mp3', lyrics: "Very superstitious, writing's on the wall\nVery superstitious, ladders 'bout to fall\nThirteen-month-old baby, broke the lookin' glass\nSeven years of bad luck, the good things in your past" },
  { id: 's28', title: 'Solfeggio 741Hz', artist: 'Chakra Cleanse', genre: 'Meditation', difficulty: 'Easy', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Illusionist.mp3', lyrics: "Purify the cells, cleanse toxins deep\nExpression throat node, standard promises we keep\nCleanse the standard voice, wash the air clean\nResonate high in dimensions unseen" },
  { id: 's29', title: 'Solfeggio 852Hz', artist: 'Third Eye Sound', genre: 'Meditation', difficulty: 'Easy', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Newness.mp3', lyrics: "Awaken spiritual intuition, trace standard light\nInner wisdom visualizer shining bright\n852 Hertz indigo sky\nConnect to the cosmic source on high" },
  { id: 's30', title: 'All of Me', artist: 'John Legend', genre: 'R&B', difficulty: 'Easy', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Happy%20Life.mp3', lyrics: "What would I do without your smart mouth?\nDrawing me in, and you kicking me out\nYou've got my head spinning, no kidding, I can't pin you down\nWhat's going on in that beautiful mind?" },
  { id: 's31', title: 'Good 4 U', artist: 'Olivia Rodrigo', genre: 'Pop', difficulty: 'Medium', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Illusionist.mp3', lyrics: "Ah, well, good for you, you look happy and healthy, not me\nIf you care to care, but I guess that you never did\nWell, good for you, I guess you moved on really easily" },
  { id: 's32', title: 'Peaches', artist: 'Justin Bieber', genre: 'R&B', difficulty: 'Medium', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Newness.mp3', lyrics: "I get my peaches out in Georgia (oh, yeah, shit)\nI get my weed from California (that's that shit)\nI took my chick up to the North, yeah (badass chick)\nI get my light right from the source, yeah" },
  { id: 's33', title: 'Hallelujah', artist: 'Jeff Buckley', genre: 'Pop', difficulty: 'Medium', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Happy%20Life.mp3', lyrics: "I heard there was a secret chord\nThat David played, and it pleased the Lord\nBut you don't really care for music, do ya?\nIt goes like this, the fourth, the fifth" },
  { id: 's34', title: 'Believer', artist: 'Imagine Dragons', genre: 'Rock', difficulty: 'Hard', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Illusionist.mp3', lyrics: "First things first, I'mma say all the words inside my head\nI'm fired up and tired of the way that things have been, oh-ooh\nThe way that things have been, oh-ooh\nSecond things second, don't you tell me what you think that I can be" },
  { id: 's35', title: 'Counting Stars', artist: 'OneRepublic', genre: 'Pop', difficulty: 'Medium', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Newness.mp3', lyrics: "Lately, I've been, I've been losing sleep\nDreaming about the things that we could be\nBut baby, I've been, I've been praying hard\nSaid no more counting dollars, we'll be counting stars" },
  { id: 's36', title: 'Solfeggio 963Hz', artist: 'Crown Connection', genre: 'Meditation', difficulty: 'Easy', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Happy%20Life.mp3', lyrics: "Awaken standard crown, pineal flow\nGolden violet cosmic glow\n963 Hertz divine alignment plane\nFree the soul from earthly pain" },
  { id: 's37', title: 'Solfeggio 396Hz', artist: 'Root Foundation', genre: 'Meditation', difficulty: 'Easy', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Illusionist.mp3', lyrics: "Release the guilt, liberate the fear\nStandard safety anchor draw near\n396 Hertz foundation baseline red\nGround the mind and clear your head" },
  { id: 's38', title: 'Solfeggio 417Hz', artist: 'Sacral Flow', genre: 'Meditation', difficulty: 'Easy', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Newness.mp3', lyrics: "Facilitate change, cleanse standard past\nOrange sacral energy flowing fast\n417 Hertz cosmic rhythm line\nAlign the creative spark divine" },
  { id: 's39', title: 'Starboy', artist: 'The Weeknd', genre: 'R&B', difficulty: 'Medium', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Happy%20Life.mp3', lyrics: "I'm tryna put you in the worst mood, ah\nP1 cleaner than your church shoes, ah\nMilli point two just to hurt you, ah\nHouse so empty, need a centerpiece" },
  { id: 's40', title: 'Watermelon Sugar', artist: 'Harry Styles', genre: 'Pop', difficulty: 'Easy', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Illusionist.mp3', lyrics: "Tastes like strawberries on a summer evening\nAnd it sounds just like a song\nI want more berries and that summer feeling\nIt's so wonderful and warm" },
  { id: 's41', title: 'Cold Heart', artist: 'Elton John & Dua Lipa', genre: 'Pop', difficulty: 'Easy', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Newness.mp3', lyrics: "It's a human sign when things go wrong\nWhen the scent of her lingers and temptation's strong\nCold, cold heart, hardened by you\nSome things look better, baby, just passing through" },
  { id: 's42', title: 'Clocks', artist: 'Coldplay', genre: 'Rock', difficulty: 'Medium', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Happy%20Life.mp3', lyrics: "The lights go out and I can't be saved\nTides that I tried to swim against\nHave brought me down upon my knees\nOh, I beg, I beg and plead, singing" },
  { id: 's43', title: 'Stayin\' Alive', artist: 'Bee Gees', genre: 'Pop', difficulty: 'Hard', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Illusionist.mp3', lyrics: "Well, you can tell by the way I use my walk\nI'm a woman's man, no time to talk\nMusic loud and women warm, I've been kicked around\nSince I was born" },
  { id: 's44', title: 'Lovely', artist: 'Billie Eilish & Khalid', genre: 'Pop', difficulty: 'Medium', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Newness.mp3', lyrics: "Thought I found a way\nThought I found a way out (but you never go away)\nSo I guess I gotta stay now\nOh, I hope some day I'll make it out of here" },
  { id: 's45', title: 'No Tears Left to Cry', artist: 'Ariana Grande', genre: 'Pop', difficulty: 'Hard', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Happy%20Life.mp3', lyrics: "Right now, I'm in a state of mind\nI wanna be in, like, all the time\nAin't got no tears left to cry\nSo I'm pickin' it up, pickin' it up" },
  { id: 's46', title: 'Say You Won\'t Let Go', artist: 'James Arthur', genre: 'Pop', difficulty: 'Easy', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Illusionist.mp3', lyrics: "I met you in the dark, you lit me up\nYou made me feel as though I was enough\nWe danced the night away, we drank too much\nI held your hair back when you were throwing up" },
  { id: 's47', title: 'Acoustic Sine Resonance', artist: 'LFO Healing', genre: 'Meditation', difficulty: 'Easy', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Newness.mp3', lyrics: "Pure sinus waves oscillating smooth\nDesigned to align, integrate and soothe\nFocus on the pure, steady vocal tone\nMake the resonance and hertz your own" },
  { id: 's48', title: 'Gravity', artist: 'Sara Bareilles', genre: 'Soul', difficulty: 'Medium', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Happy%20Life.mp3', lyrics: "Something always brings me back to you\nIt never takes too long\nNo matter what I say or do\nI still feel you here until the moment you're gone" },
  { id: 's49', title: 'Killing Me Softly', artist: 'Fugees', genre: 'Soul', difficulty: 'Medium', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Illusionist.mp3', lyrics: "Strumming my pain with his fingers\nSinging my life with his words\nKilling me softly with his song\nKilling me softly with his song" },
  { id: 's50', title: 'Resonance Anthem', artist: 'Ariyus Collective', genre: 'Meditation', difficulty: 'Hard', audioUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Illusionist.mp3', lyrics: "Ariyus One frequency activate\nIntegrate the base, lift and elevate\nOvertone harmonics clean and clear\nSing with power, lose the fear" }
];

const SongLibrary = ({ navigate, setCurrentRecording, user }) => {
  const [songs] = useState(() => {
    const custom = localStorage.getItem('ariyus_custom_songs');
    const parsedCustom = custom ? JSON.parse(custom) : [];
    return [...defaultCatalog, ...parsedCustom];
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  const [selectedSongHub, setSelectedSongHub] = useState(null);

  const filteredSongs = songs.filter(song => {
    const matchesSearch = song.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          song.artist.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGenre = selectedGenre === 'All' || song.genre === selectedGenre;
    const matchesDifficulty = selectedDifficulty === 'All' || song.difficulty === selectedDifficulty;
    return matchesSearch && matchesGenre && matchesDifficulty;
  });

  const handleSelectSong = (song) => {
    if (!user) {
      alert("Please login or create a free profile to record your vocal session!");
      navigate('Auth');
      return;
    }
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
      <div className="floating-notes">🎶</div>

      {/* Futuristic Cosmic Resonance Billboard Hero Banner */}
      <div style={{ 
        position: 'relative', 
        width: '100%', 
        height: '165px', 
        borderRadius: '16px', 
        overflow: 'hidden', 
        marginBottom: '25px', 
        border: '1px solid rgba(0, 242, 255, 0.25)',
        boxShadow: '0 8px 32px rgba(0, 242, 255, 0.15)'
      }}>
        <img 
          src="/images/banner.png" 
          alt="Cosmic Resonance Banner" 
          style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.65) contrast(1.1)' }} 
        />
        <div style={{ 
          position: 'absolute', 
          top: 0, left: 0, 
          width: '100%', height: '100%', 
          background: 'linear-gradient(180deg, transparent 15%, rgba(6, 4, 30, 0.9) 95%)',
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'center', 
          padding: '0 24px',
          textAlign: 'left'
        }}>
          <h2 style={{ fontFamily: 'Orbitron', textShadow: '0 0 15px var(--primary-glow)', color: '#fff', fontSize: '1.85rem', margin: 0, fontWeight: '700' }}>
            Ariyus Resonance Book
          </h2>
          <p style={{ fontFamily: 'Rajdhani', color: 'var(--text-dim)', margin: '4px 0 0 0', fontSize: '1.05rem', fontWeight: '500' }}>
            Calibrate your vocal frequencies and overtones across 50 aligned healing channels.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 className="suspended-title" style={{ margin: 0, fontSize: '1.6rem' }}>Song Library</h1>
        <button 
          className="glowing-button" 
          style={{ padding: '8px 16px', fontSize: '0.8rem', margin: 0 }}
          onClick={() => {
            if (!user) {
              alert("Please login or create a profile to upload custom tracks!");
              navigate('Auth');
              return;
            }
            navigate('Upload');
          }}
        >
          ➕ Upload Custom Track
        </button>
      </div>

      {/* Ariyus Vocal Training Launchers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px', marginBottom: '20px' }}>
        {/* AI Warmups Card */}
        <div className="glass-panel" style={{ margin: 0, padding: '15px', borderColor: 'var(--primary-glow)', background: 'rgba(0, 242, 255, 0.02)' }}>
          <h3 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', color: '#fff' }}>🎙️ AI Vocal Coach Warmups</h3>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', lineHeight: '1.4', margin: '0 0 12px 0', minHeight: '38px' }}>
            Complete structured warmups to calibrate pitch alignment and steady vocal resonators.
          </p>
          <button 
            className="glowing-button" 
            onClick={() => {
              if (!user) {
                alert("Please login or register to launch the AI Vocal Coach!");
                navigate('Auth');
                return;
              }
              navigate('VocalCoach');
            }} 
            style={{ width: '100%', margin: 0, padding: '8px 0', fontSize: '0.75rem' }}
          >
            Launch Warmup Coach
          </button>
        </div>

        {/* Space Flight Arcade Card */}
        <div className="glass-panel" style={{ margin: 0, padding: '15px', borderColor: 'var(--secondary-glow)', background: 'rgba(255, 0, 193, 0.02)' }}>
          <h3 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', color: '#fff' }}>🚀 Space Journey Vocal Arcade</h3>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', lineHeight: '1.4', margin: '0 0 12px 0', minHeight: '38px' }}>
            Pilot a spaceship through Solfeggio Gates by controlling your vocal frequency pitch.
          </p>
          <button 
            className="glowing-button secondary" 
            onClick={() => {
              if (!user) {
                alert("Please login or register to play the Vocal Arcade!");
                navigate('Auth');
                return;
              }
              navigate('VocalArcade');
            }} 
            style={{ width: '100%', margin: 0, padding: '8px 0', fontSize: '0.75rem', borderColor: 'var(--secondary-glow)', color: 'var(--secondary-glow)' }}
          >
            Launch Flight Arcade
          </button>
        </div>
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
              padding: '16px', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              borderColor: 'rgba(255,255,255,0.06)',
              gap: '15px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', textAlign: 'left' }}>
                <img 
                  src={
                    song.genre === 'Meditation' ? '/images/solfeggio.png' :
                    (song.genre === 'Rock' ? '/images/rock.png' : '/images/pop.png')
                  } 
                  alt="cover" 
                  style={{ width: '60px', height: '60px', borderRadius: '8px', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.15)', boxShadow: '0 4px 15px rgba(0,0,0,0.4)', flexShrink: 0 }}
                />
                <div>
                  <h3 style={{ margin: 0, color: '#fff', fontSize: '1.15rem' }}>{song.title}</h3>
                  <p style={{ color: 'var(--text-dim)', margin: '2px 0 6px 0', fontSize: '0.85rem' }}>{song.artist}</p>
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
              </div>

              <button className="glowing-button" style={{ margin: 0, padding: '10px 22px' }} onClick={() => setSelectedSongHub(song)}>
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

      {selectedSongHub && (
        <div className="custom-alert-overlay" onClick={() => setSelectedSongHub(null)}>
          <div className="custom-alert-box glass-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <h2 style={{ color: '#fff', fontSize: '1.4rem', marginBottom: '4px' }}>{selectedSongHub.title} Hub</h2>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginTop: 0 }}>by {selectedSongHub.artist}</p>

            <h4 style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '8px', color: 'var(--primary-glow)', textTransform: 'uppercase', fontSize: '0.78rem', letterSpacing: '1px', marginTop: '15px' }}>
              🏆 Billboard Performance Chart
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '15px 0' }}>
              {(() => {
                const saved = localStorage.getItem('ariyus_shared_recordings');
                const shared = saved ? JSON.parse(saved) : [];
                const matches = shared.filter(item => item.song?.id === selectedSongHub.id)
                                      .sort((a, b) => b.score - a.score);

                if (matches.length > 0) {
                  return matches.map((item, mIdx) => (
                    <div key={mIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '6px', fontSize: '0.85rem' }}>
                      <span>#{mIdx + 1} <strong>{item.userDisplayName}</strong></span>
                      <span style={{ color: item.grade?.color || 'var(--primary-glow)' }}>{item.grade?.letter} ({item.score}%)</span>
                    </div>
                  ));
                }

                // Simulated fallback Billboard chart
                return [
                  { name: 'Solar Tenor', score: 96, grade: 'A++' },
                  { name: 'Celeste Vocalist', score: 92, grade: 'A+' },
                  { name: 'Aura Singer', score: 87, grade: 'A' }
                ].map((item, mIdx) => (
                  <div key={mIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '6px', fontSize: '0.85rem' }}>
                    <span>#{mIdx + 1} <strong>{item.name}</strong></span>
                    <span style={{ color: 'var(--primary-glow)' }}>{item.grade} ({item.score}%)</span>
                  </div>
                ));
              })()}
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button 
                className="glowing-button" 
                style={{ flexGrow: 1, margin: 0 }}
                onClick={() => {
                  handleSelectSong(selectedSongHub);
                  setSelectedSongHub(null);
                }}
              >
                🎙️ Sing Solo
              </button>
              <button 
                className="glowing-button secondary" 
                style={{ flexGrow: 1, margin: 0 }}
                onClick={() => {
                  if (!user) {
                    alert("Please login or create a free profile to record a duet!");
                    navigate('Auth');
                    return;
                  }
                  setCurrentRecording({
                    selectedSong: selectedSongHub,
                    playbackUrl: null,
                    grade: null,
                    score: 0,
                    recordingData: null,
                    isDuet: true,
                    partnerName: 'Celeste Vocalist',
                    partnerVocalUrl: selectedSongHub.id === 's1' ? 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Newness.mp3' : 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Happy%20Life.mp3'
                  });
                  navigate('Recording');
                  setSelectedSongHub(null);
                }}
              >
                👥 Record Duet
              </button>
            </div>

            <button 
              className="glowing-button secondary" 
              style={{ width: '100%', marginTop: '10px', borderColor: 'var(--secondary-glow)', color: 'var(--secondary-glow)', margin: '10px 0 0 0' }}
              onClick={() => setSelectedSongHub(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SongLibrary;
