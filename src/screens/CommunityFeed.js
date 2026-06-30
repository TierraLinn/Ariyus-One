import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';

const FeedMiniVisualizer = ({ analyser }) => {
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyser) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width = canvas.offsetWidth;
    const height = canvas.height = canvas.offsetHeight;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      analyser.getByteTimeDomainData(dataArray);
      ctx.fillStyle = 'rgba(7, 6, 48, 0.4)';
      ctx.fillRect(0, 0, width, height);

      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(0, 242, 255, 0.8)';
      ctx.shadowBlur = 4;
      ctx.shadowColor = 'rgba(0, 242, 255, 0.4)';
      ctx.beginPath();

      const sliceWidth = width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(width, height / 2);
      ctx.stroke();
      ctx.shadowBlur = 0;

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [analyser]);

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />;
};

const defaultCommunityFeed = [
  {
    id: 'rec_default_1',
    userDisplayName: 'Celeste Vocalist',
    userId: 'celeste',
    timestamp: '2 hours ago',
    song: { title: 'Cosmic Resonance', artist: 'Solfeggio Choir' },
    playbackUrl: 'https://upload.wikimedia.org/wikipedia/commons/5/52/Mozart_-_Clarinet_Quintet_in_A_major%2C_K._581_-_II._Larghetto.mp3',
    ariyusRating: 'A+',
    selectedFreq: 528,
    effects: ['Galactic Reverb', 'Vocal Clarity'],
    likes: ['user1', 'user2'],
    comments: [
      { id: 'c1', user: 'Sound Weaver', text: 'Beautiful harmonics on the third overtone!' },
      { id: 'c2', user: 'Vibe Master', text: 'The 528 Hz oscillator mix feels so warm.' }
    ]
  },
  {
    id: 'rec_default_2',
    userDisplayName: 'Solar Tenor',
    userId: 'solar',
    timestamp: '5 hours ago',
    song: { title: 'Imagine', artist: 'John Lennon' },
    playbackUrl: 'https://upload.wikimedia.org/wikipedia/commons/1/1a/Suite_1_-_Prelude_in_G_major.mp3',
    ariyusRating: 'A',
    selectedFreq: 432,
    effects: ['Analog Warmth'],
    likes: ['celeste'],
    comments: [
      { id: 'c3', user: 'Aura Singer', text: 'Super stable pitch, amazing cover!' }
    ]
  }
];

const CommunityFeed = ({ navigate, userData }) => {
  const [feed, setFeed] = useState(() => {
    const saved = localStorage.getItem('ariyus_shared_recordings');
    const parsed = saved ? JSON.parse(saved) : [];
    const filteredDefaults = defaultCommunityFeed.filter(def => !parsed.some(p => p.id === def.id));
    return [...parsed, ...filteredDefaults];
  });
  const [activeAudioId, setActiveAudioId] = useState(null);
  const [commentInputs, setCommentInputs] = useState({});
  const audioRef = React.useRef(null);
  const duetAudioRef = useRef(null);
  
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);

  // States & Refs for Voice comments
  const [recordingCommentId, setRecordingCommentId] = useState(null);
  const [isRecordingComment, setIsRecordingComment] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [playingCommentVoiceId, setPlayingCommentVoiceId] = useState(null);
  const commentAudioRef = useRef(null);

  const handleToggleRecordComment = async (itemId) => {
    if (recordingCommentId === itemId) {
      if (mediaRecorderRef.current && isRecordingComment) {
        mediaRecorderRef.current.stop();
        setIsRecordingComment(false);
        setRecordingCommentId(null);
      }
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        chunksRef.current = [];
        const recorder = new MediaRecorder(stream);
        
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            chunksRef.current.push(e.data);
          }
        };
        
        recorder.onstop = async () => {
          const audioBlob = new Blob(chunksRef.current, { type: 'audio/mp3' });
          const voiceUrl = URL.createObjectURL(audioBlob);
          
          const newComment = {
            id: 'comment_' + Date.now(),
            user: currentUser,
            text: '🎙 Voice Resonance Capture',
            voiceUrl: voiceUrl
          };
          
          const item = feed.find(i => i.id === itemId);
          if (!item) return;

          if (item.isFirebase) {
            try {
              const docRef = doc(db, "recordings", item.id);
              await updateDoc(docRef, {
                comments: arrayUnion(newComment)
              });
            } catch (err) {
              console.warn("Firebase voice comment upload failed:", err);
            }
          } else {
            const updated = feed.map(feedItem => {
              if (feedItem.id === item.id) {
                return { ...feedItem, comments: [...(feedItem.comments || []), newComment] };
              }
              return feedItem;
            });
            setFeed(updated);
            localStorage.setItem('ariyus_shared_recordings', JSON.stringify(updated.filter(i => !i.isFirebase)));
          }
          
          stream.getTracks().forEach(track => track.stop());
        };
        
        mediaRecorderRef.current = recorder;
        recorder.start();
        setIsRecordingComment(true);
        setRecordingCommentId(itemId);
      } catch (err) {
        console.warn("Voice comment recording failed:", err);
        alert("Microphone permission required for voice comment captures.");
      }
    }
  };

  const handleCommentVoicePlay = (commentId, voiceUrl) => {
    if (playingCommentVoiceId === commentId) {
      if (commentAudioRef.current) commentAudioRef.current.pause();
      setPlayingCommentVoiceId(null);
    } else {
      if (commentAudioRef.current) commentAudioRef.current.pause();
      const audio = new Audio(voiceUrl);
      commentAudioRef.current = audio;
      setPlayingCommentVoiceId(commentId);
      audio.play().catch(err => {
        console.warn("Voice comment audio playback failed:", err);
        setPlayingCommentVoiceId(null);
      });
      audio.onended = () => setPlayingCommentVoiceId(null);
    }
  };

  const currentUser = userData?.displayName || 'Guest User';
  const currentUserId = userData?.uid || 'guest';

  useEffect(() => {
    // Setup real-time listener to Firestore recordings
    const unsubscribe = onSnapshot(collection(db, "recordings"), (querySnapshot) => {
      const firebaseRecordings = [];
      querySnapshot.forEach((docSnap) => {
        firebaseRecordings.push({ id: docSnap.id, ...docSnap.data(), isFirebase: true });
      });

      // Filter default songs that have matches in Firebase
      const filteredDefaults = defaultCommunityFeed.filter(def => !firebaseRecordings.some(p => p.id === def.id));
      setFeed([...firebaseRecordings, ...filteredDefaults]);
    }, (err) => {
      console.warn("Firestore recordings listener failed:", err);
    });

    return () => unsubscribe();
  }, []);

  const handleLike = async (item) => {
    const isLiked = item.likes?.includes(currentUserId);

    if (item.isFirebase) {
      try {
        const docRef = doc(db, "recordings", item.id);
        await updateDoc(docRef, {
          likes: isLiked ? arrayRemove(currentUserId) : arrayUnion(currentUserId)
        });
      } catch (err) {
        console.warn("Firebase like failed, editing locally:", err);
      }
    } else {
      // Local fallback logic
      const updated = feed.map(feedItem => {
        if (feedItem.id === item.id) {
          const likes = feedItem.likes || [];
          const updatedLikes = isLiked 
            ? likes.filter(uid => uid !== currentUserId) 
            : [...likes, currentUserId];
          return { ...feedItem, likes: updatedLikes };
        }
        return feedItem;
      });
      setFeed(updated);
      localStorage.setItem('ariyus_shared_recordings', JSON.stringify(updated.filter(i => !i.isFirebase)));
    }
  };

  const handleAddComment = async (e, item) => {
    e.preventDefault();
    const commentText = commentInputs[item.id];
    if (!commentText || !commentText.trim()) return;

    const newComment = {
      id: 'comment_' + Date.now(),
      user: currentUser,
      text: commentText
    };

    if (item.isFirebase) {
      try {
        const docRef = doc(db, "recordings", item.id);
        await updateDoc(docRef, {
          comments: arrayUnion(newComment)
        });
        setCommentInputs(prev => ({ ...prev, [item.id]: '' }));
      } catch (err) {
        console.warn("Firebase comment write failed:", err);
      }
    } else {
      // Local fallback
      const updated = feed.map(feedItem => {
        if (feedItem.id === item.id) {
          return { 
            ...feedItem, 
            comments: [...(feedItem.comments || []), newComment] 
          };
        }
        return feedItem;
      });
      setFeed(updated);
      localStorage.setItem('ariyus_shared_recordings', JSON.stringify(updated.filter(i => !i.isFirebase)));
      setCommentInputs(prev => ({ ...prev, [item.id]: '' }));
    }
  };

  const handleCommentInputChange = (id, text) => {
    setCommentInputs(prev => ({ ...prev, [id]: text }));
  };

  const handlePlayToggle = (item) => {
    if (activeAudioId === item.id) {
      if (audioRef.current) audioRef.current.pause();
      if (duetAudioRef.current) duetAudioRef.current.pause();
      setActiveAudioId(null);
    } else {
      if (audioRef.current) audioRef.current.pause();
      if (duetAudioRef.current) duetAudioRef.current.pause();
      setActiveAudioId(item.id);
      
      const audio = new Audio(item.playbackUrl);
      audio.crossOrigin = "anonymous";
      audioRef.current = audio;

      let duetAudio = null;
      if (item.duetPartner) {
        duetAudio = new Audio(item.duetPartner.playbackUrl);
        duetAudio.crossOrigin = "anonymous";
        duetAudioRef.current = duetAudio;
      }
      
      if (!audioCtxRef.current) {
        const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
        audioCtxRef.current = new AudioCtxClass();
        analyserRef.current = audioCtxRef.current.createAnalyser();
        analyserRef.current.fftSize = 128;
      }

      if (sourceRef.current) {
        try { sourceRef.current.disconnect(); } catch(e){}
      }

      try {
        sourceRef.current = audioCtxRef.current.createMediaElementSource(audio);
        sourceRef.current.connect(analyserRef.current);
        analyserRef.current.connect(audioCtxRef.current.destination);
      } catch (err) {
        console.warn("createMediaElementSource failed (likely already connected):", err);
      }

      audio.play().catch(err => {
        console.warn("Audio playback failed:", err);
        setActiveAudioId(null);
      });
      if (duetAudio) {
        duetAudio.play().catch(err => console.warn("Duet partner audio failed to play:", err));
      }
      audio.onended = () => {
        setActiveAudioId(null);
        if (duetAudio) duetAudio.pause();
      };
    }
  };

  useEffect(() => {
    return () => {
      if (audioRef.current) audioRef.current.pause();
      if (duetAudioRef.current) duetAudioRef.current.pause();
      if (commentAudioRef.current) commentAudioRef.current.pause();
    };
  }, []);

  const handleShare = (title) => {
    navigator.clipboard.writeText(window.location.href);
    alert(`Link for "${title}" copied to clipboard! Share the acoustic matrix.`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Header */}
      <div>
        <h2 style={{ textShadow: '0 0 10px var(--primary-glow)', margin: 0 }}>Acoustic Feed</h2>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', margin: '4px 0 0' }}>Explore harmonic creations shared by the network</p>
      </div>

      {/* Contests & Vocal Clashes Showcase */}
      <div className="glass-panel" style={{ 
        background: 'linear-gradient(135deg, rgba(6, 4, 30, 0.85), rgba(0, 242, 255, 0.08))', 
        borderColor: 'var(--primary-glow)',
        padding: '20px',
        margin: 0
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <span style={{ fontSize: '0.75rem', background: 'var(--secondary-glow)', color: '#000', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold', textTransform: 'uppercase' }}>🏆 Live Weekly Contest</span>
            <h3 style={{ margin: '8px 0 4px 0', textShadow: '0 0 8px var(--primary-glow)' }}>Solfeggio Ascension: 528Hz Hearts</h3>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', margin: 0 }}>
              Sing any track in 528Hz alignment. Highest convergence score wins <strong>$500 Cash prize & Luminary Badge</strong>.
            </p>
          </div>
          <button 
            className="glowing-button" 
            style={{ margin: 0, padding: '8px 18px', fontSize: '0.8rem' }}
            onClick={() => navigate('Sing')}
          >
            🎙 Submit Performance
          </button>
        </div>
        
        {/* Leaderboard/Contestants snippet */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '15px', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
          <strong style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>LEADERBOARD STANDINGS:</strong>
          
          {[
            { rank: 1, name: 'Celeste Vocalist', score: 98, votes: 412, icon: '🥇' },
            { rank: 2, name: 'Solar Tenor', score: 94, votes: 389, icon: '🥈' },
            { rank: 3, name: 'Aura Singer', score: 91, votes: 201, icon: '🥉' }
          ].map(contestant => (
            <div key={contestant.rank} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span>{contestant.icon}</span>
                <span style={{ fontWeight: 'bold', color: '#fff' }}>{contestant.name}</span>
                <span style={{ fontSize: '0.72rem', background: 'rgba(255,255,255,0.06)', padding: '1px 6px', borderRadius: '4px', color: 'var(--text-dim)' }}>Score: {contestant.score}%</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{contestant.votes} Votes</span>
                <button 
                  className="glowing-button secondary" 
                  style={{ margin: 0, padding: '2px 8px', fontSize: '0.7rem' }}
                  onClick={() => alert(`You voted for ${contestant.name} in the Solfeggio Ascension Contest!`)}
                >
                  👍 Vote
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Social Feed List */}
      <div className="social-feed">
        {feed.map((item) => {
          const isLiked = item.likes?.includes(currentUserId);
          return (
            <div key={item.id} className="feed-item">
              
              {/* Header Info */}
              <div className="feed-header">
                <div>
                  <b>{item.userDisplayName}</b>
                  {item.isFirebase && <span style={{ display: 'inline-block', marginLeft: '6px', fontSize: '0.65rem', padding: '1px 6px', background: 'var(--primary-glow)', color: '#000', borderRadius: '4px', fontWeight: 'bold' }}>Cloud</span>}
                  <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                    sang <b>{item.song.title}</b>
                  </span>
                </div>
                <span>{item.timestamp || 'Just now'}</span>
              </div>

              {/* Badges / Rating */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', margin: '10px 0' }}>
                <span className="level-badge" style={{ background: 'var(--secondary-glow)', fontSize: '0.7rem', padding: '2px 8px' }}>
                  Ariyus: {item.ariyusRating}
                </span>
                <span className="level-badge" style={{ background: 'rgba(0, 242, 255, 0.08)', border: '1px solid rgba(0, 242, 255, 0.2)', color: 'var(--primary-glow)', fontSize: '0.7rem', padding: '2px 8px', textShadow: 'none' }}>
                  Solfeggio: {item.selectedFreq} Hz
                </span>
                {item.effects && item.effects.map((fx, i) => (
                  <span key={i} className="level-badge" style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-dim)', fontSize: '0.7rem', padding: '2px 8px', textShadow: 'none', border: '1px solid rgba(255,255,255,0.06)' }}>
                    {fx}
                  </span>
                ))}
              </div>

              {/* Actions & Playbar */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', margin: '15px 0' }}>
                <button 
                  className="glowing-button" 
                  style={{ margin: 0, padding: '8px 20px', fontSize: '0.85rem', width: 'fit-content' }}
                  onClick={() => handlePlayToggle(item)}
                >
                  {activeAudioId === item.id ? '⏸ Pause Matrix' : '▶ Listen Capture'}
                </button>
                {activeAudioId === item.id && (
                  <div style={{ height: '40px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <FeedMiniVisualizer analyser={analyserRef.current} />
                  </div>
                )}
              </div>

              {/* Feed Actions */}
              <div className="feed-actions">
                <button className={isLiked ? 'active' : ''} onClick={() => handleLike(item)}>
                  ❤️ Like ({item.likes?.length || 0})
                </button>
                <button onClick={() => navigate('Recording', { selectedSong: item.song, duetPartner: item })}>
                  🎙 Duet
                </button>
                <button onClick={() => navigate('Results', { remixPayload: item })}>
                  🎛 Remix
                </button>
                <button onClick={() => handleShare(item.song.title)}>
                  🔗 Share
                </button>
              </div>

              {/* Comments Tray */}
              <div className="comments-section">
                <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 'bold' }}>Comments</span>
                
                {item.comments && item.comments.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '5px 0' }}>
                    {item.comments.map((c, index) => (
                      <div key={c.id || index} className="comment-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <b style={{ color: 'var(--primary-glow)' }}>{c.user}:</b> <span style={{ color: 'var(--text-dim)' }}>{c.text}</span>
                        </div>
                        {c.voiceUrl && (
                          <button
                            type="button"
                            onClick={() => handleCommentVoicePlay(c.id, c.voiceUrl)}
                            className="comment-voice-play-btn"
                            style={{
                              background: playingCommentVoiceId === c.id ? 'var(--secondary-glow)' : 'rgba(0, 242, 255, 0.1)',
                              border: '1px solid var(--primary-glow)',
                              color: playingCommentVoiceId === c.id ? '#000' : 'var(--primary-glow)',
                              borderRadius: '50%',
                              width: '24px', height: '24px',
                              display: 'grid', placeItems: 'center',
                              fontSize: '0.62rem', cursor: 'pointer',
                              margin: 0, padding: 0
                            }}
                          >
                            {playingCommentVoiceId === c.id ? '⏸' : '▶'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Comment Input */}
                <form onSubmit={(e) => handleAddComment(e, item)} className="comment-input-bar" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input 
                    type="text" 
                    placeholder={recordingCommentId === item.id ? "🎙 Recording voice comment..." : "Enter resonance message..."} 
                    value={commentInputs[item.id] || ''} 
                    onChange={e => handleCommentInputChange(item.id, e.target.value)} 
                    className="comment-input" 
                    disabled={recordingCommentId === item.id}
                  />
                  <button 
                    type="button" 
                    onClick={() => handleToggleRecordComment(item.id)}
                    className="comment-voice-rec-btn"
                    style={{
                      background: recordingCommentId === item.id ? 'rgba(255,0,193,0.15)' : 'rgba(255,255,255,0.05)',
                      border: recordingCommentId === item.id ? '1px solid var(--secondary-glow)' : '1px solid rgba(255,255,255,0.15)',
                      color: recordingCommentId === item.id ? 'var(--secondary-glow)' : '#fff',
                      borderRadius: '50%',
                      width: '32px', height: '32px',
                      display: 'grid', placeItems: 'center',
                      cursor: 'pointer', fontSize: '0.9rem',
                      transition: 'all 0.3s ease',
                      flexShrink: 0, margin: 0, padding: 0
                    }}
                  >
                    {recordingCommentId === item.id ? '🔴' : '🎙'}
                  </button>
                  <button type="submit" className="comment-send-btn">Post</button>
                </form>
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
};

export default CommunityFeed;
