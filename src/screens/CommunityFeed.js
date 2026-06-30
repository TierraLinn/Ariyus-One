import React, { useState, useEffect, useRef } from 'react';

const defaultShared = [
  {
    id: 's_rec1',
    userDisplayName: 'Celeste Vocalist',
    song: { title: 'Imagine', artist: 'John Lennon' },
    playbackUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Planning.mp3',
    score: 93,
    grade: { letter: 'A+', color: '#00f2ff', desc: 'Celestial Coherence' },
    likes: ['user1', 'user2'],
    comments: [
      { user: 'Solar Tenor', text: 'Beautiful breath support here!' },
      { user: 'Gravity Alchemist', text: 'Pure alignment!', voiceUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Illusionist.mp3' }
    ]
  },
  {
    id: 's_rec2',
    userDisplayName: 'Solfeggio Adept',
    song: { title: 'Cosmic Resonance', artist: 'Solfeggio Choir' },
    playbackUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Illusionist.mp3',
    score: 96,
    grade: { letter: 'A++', color: '#ff00c1', desc: 'Absolute Alignment' },
    likes: ['user3'],
    comments: []
  }
];

const CommunityFeed = ({ navigate, userData, setCurrentRecording }) => {
  const [feed, setFeed] = useState(() => {
    const saved = localStorage.getItem('ariyus_shared_recordings');
    const parsed = saved ? JSON.parse(saved) : [];
    return [...parsed, ...defaultShared];
  });

  const [activeAudioId, setActiveAudioId] = useState(null);
  const [playingCommentVoiceId, setPlayingCommentVoiceId] = useState(null);
  const [commentInputs, setCommentInputs] = useState({});
  const [recordingCommentId, setRecordingCommentId] = useState(null);

  const globalAudioRef = useRef(null);
  const commentAudioRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const commentChunksRef = useRef([]);

  useEffect(() => {
    return () => {
      if (globalAudioRef.current) globalAudioRef.current.pause();
      if (commentAudioRef.current) commentAudioRef.current.pause();
    };
  }, []);

  const handlePlayToggle = (item) => {
    if (activeAudioId === item.id) {
      if (globalAudioRef.current) {
        globalAudioRef.current.pause();
      }
      setActiveAudioId(null);
    } else {
      if (globalAudioRef.current) {
        globalAudioRef.current.pause();
      }
      const audio = new Audio(item.playbackUrl);
      audio.loop = true;
      audio.play().catch(e => console.warn(e));
      globalAudioRef.current = audio;
      setActiveAudioId(item.id);
    }
  };

  const handleLike = (item) => {
    const updated = feed.map(post => {
      if (post.id === item.id) {
        const hasLiked = post.likes.includes(userData?.uid || 'guest');
        const likes = hasLiked 
          ? post.likes.filter(id => id !== (userData?.uid || 'guest'))
          : [...post.likes, (userData?.uid || 'guest')];
        return { ...post, likes };
      }
      return post;
    });
    setFeed(updated);
    localStorage.setItem('ariyus_shared_recordings', JSON.stringify(updated));
  };

  const handleAddComment = (e, item) => {
    e.preventDefault();
    const txt = commentInputs[item.id] || '';
    if (!txt.trim()) return;

    const newComment = {
      user: userData?.displayName || 'Resonant Singer',
      text: txt
    };

    const updated = feed.map(post => {
      if (post.id === item.id) {
        return { ...post, comments: [...post.comments, newComment] };
      }
      return post;
    });

    setFeed(updated);
    localStorage.setItem('ariyus_shared_recordings', JSON.stringify(updated));
    setCommentInputs({ ...commentInputs, [item.id]: '' });
  };

  // --- Voice Comment Recording Utilities ---
  const handleToggleRecordComment = async (postId) => {
    if (recordingCommentId === postId) {
      // Stop recording and compile voice comment
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setRecordingCommentId(null);
    } else {
      // Start recording voice comment
      setRecordingCommentId(postId);
      commentChunksRef.current = [];
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            commentChunksRef.current.push(e.data);
          }
        };
        mediaRecorder.onstop = () => {
          const blob = new Blob(commentChunksRef.current, { type: 'audio/webm' });
          const voiceUrl = URL.createObjectURL(blob);
          
          // Append voice URL comment to feed state
          const newComment = {
            user: userData?.displayName || 'Resonant Singer',
            text: '🎙️ Voice Comment',
            voiceUrl
          };

          const updated = feed.map(post => {
            if (post.id === postId) {
              return { ...post, comments: [...post.comments, newComment] };
            }
            return post;
          });
          setFeed(updated);
          localStorage.setItem('ariyus_shared_recordings', JSON.stringify(updated));
          stream.getTracks().forEach(track => track.stop());
        };
        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.start();
      } catch (err) {
        console.warn("Could not start microphone for voice comment, running fallback mock comment:", err);
        // Fallback simulated voice comment
        setTimeout(() => {
          const mockComment = {
            user: userData?.displayName || 'Resonant Singer',
            text: '🎙️ Voice Comment (Sandbox)',
            voiceUrl: 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Planning.mp3'
          };
          const updated = feed.map(post => {
            if (post.id === postId) {
              return { ...post, comments: [...post.comments, mockComment] };
            }
            return post;
          });
          setFeed(updated);
          localStorage.setItem('ariyus_shared_recordings', JSON.stringify(updated));
          setRecordingCommentId(null);
        }, 1200);
      }
    }
  };

  const handlePlayCommentVoice = (commentIdx, voiceUrl) => {
    if (playingCommentVoiceId === commentIdx) {
      if (commentAudioRef.current) commentAudioRef.current.pause();
      setPlayingCommentVoiceId(null);
    } else {
      if (commentAudioRef.current) commentAudioRef.current.pause();
      const audio = new Audio(voiceUrl);
      audio.play().catch(e => console.warn(e));
      audio.onended = () => setPlayingCommentVoiceId(null);
      commentAudioRef.current = audio;
      setPlayingCommentVoiceId(commentIdx);
    }
  };

  const handleDuet = (item) => {
    setCurrentRecording({
      selectedSong: item.song,
      playbackUrl: null,
      duetPartner: item
    });
    navigate('Recording');
  };

  const handleRemix = (item) => {
    setCurrentRecording({
      selectedSong: item.song,
      playbackUrl: item.playbackUrl,
      score: item.score,
      isRemix: true
    });
    navigate('Results');
  };

  return (
    <div className="screen-wrapper">
      <h1 className="suspended-title">Community Feed</h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {feed.map((item, idx) => (
          <div key={item.id || idx} className="glass-panel" style={{ margin: 0, borderColor: item.grade?.color || 'var(--glass-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
              <div>
                <strong style={{ fontSize: '1.15rem', color: '#fff' }}>{item.userDisplayName}</strong>
                <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', margin: '2px 0 0 0' }}>
                  Singing: <strong style={{ color: '#fff' }}>{item.song?.title}</strong> by {item.song?.artist}
                </p>
              </div>
              {item.grade && (
                <div style={{ 
                  color: item.grade.color, 
                  fontWeight: 'bold', 
                  fontSize: '1.6rem', 
                  textShadow: `0 0 10px ${item.grade.color}`,
                  fontFamily: 'Orbitron, sans-serif'
                }}>
                  {item.grade.letter}
                </div>
              )}
            </div>

            <p style={{ margin: '15px 0', fontSize: '0.92rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
              "{item.caption || 'Synthesized frequency parameters aligned to grid.'}"
            </p>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '15px' }}>
              <button className="glowing-button" style={{ margin: 0, padding: '8px 18px', fontSize: '0.78rem' }} onClick={() => handlePlayToggle(item)}>
                {activeAudioId === item.id ? '⏸ Pause Playback' : '▶ Play Track'}
              </button>

              <button className="glowing-button secondary" style={{ margin: 0, padding: '8px 18px', fontSize: '0.78rem' }} onClick={() => handleLike(item)}>
                ❤️ Like ({item.likes?.length || 0})
              </button>

              <button className="glowing-button secondary" style={{ margin: 0, padding: '8px 18px', fontSize: '0.78rem' }} onClick={() => handleDuet(item)}>
                🎙️ Duet Partner
              </button>

              <button className="glowing-button secondary" style={{ margin: 0, padding: '8px 18px', fontSize: '0.78rem' }} onClick={() => handleRemix(item)}>
                🎛️ Remix Console
              </button>
            </div>

            {/* Comments Section */}
            <div style={{ marginTop: '15px' }}>
              <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '8px' }}>Comments & Feedback</h4>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '15px' }}>
                {item.comments && item.comments.length > 0 ? (
                  item.comments.map((comment, cIdx) => (
                    <div key={cIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.18)', padding: '8px 12px', borderRadius: '6px', fontSize: '0.85rem' }}>
                      <div>
                        <strong style={{ color: 'var(--primary-glow)' }}>{comment.user}: </strong>
                        <span style={{ color: '#fff' }}>{comment.text}</span>
                      </div>
                      
                      {comment.voiceUrl && (
                        <button
                          onClick={() => handlePlayCommentVoice(`${idx}_${cIdx}`, comment.voiceUrl)}
                          style={{
                            background: playingCommentVoiceId === `${idx}_${cIdx}` ? 'var(--secondary-glow)' : 'rgba(0, 242, 255, 0.1)',
                            border: '1px solid var(--primary-glow)',
                            color: playingCommentVoiceId === `${idx}_${cIdx}` ? '#000' : 'var(--primary-glow)',
                            borderRadius: '50%', width: '22px', height: '22px',
                            display: 'grid', placeItems: 'center', fontSize: '0.6rem', cursor: 'pointer', margin: 0
                          }}
                        >
                          {playingCommentVoiceId === `${idx}_${cIdx}` ? '⏸' : '▶'}
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>No comments yet. Sync feedback comment below.</span>
                )}
              </div>

              {/* Comment input form with voice comment option */}
              <form onSubmit={(e) => handleAddComment(e, item)} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input 
                  type="text" 
                  placeholder={recordingCommentId === item.id ? "🎙️ Recording Voice Comment..." : "Type comment..."} 
                  value={commentInputs[item.id] || ''}
                  onChange={e => setCommentInputs({ ...commentInputs, [item.id]: e.target.value })}
                  style={{ flexGrow: 1, padding: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', color: '#fff', borderRadius: '8px' }}
                  disabled={recordingCommentId === item.id}
                />
                
                <button
                  type="button"
                  onClick={() => handleToggleRecordComment(item.id)}
                  style={{
                    background: recordingCommentId === item.id ? 'rgba(255,0,193,0.15)' : 'rgba(255,255,255,0.05)',
                    border: recordingCommentId === item.id ? '1px solid var(--secondary-glow)' : '1px solid rgba(255,255,255,0.15)',
                    color: recordingCommentId === item.id ? 'var(--secondary-glow)' : '#fff',
                    borderRadius: '50%', width: '34px', height: '34px',
                    display: 'grid', placeItems: 'center', cursor: 'pointer', margin: 0, padding: 0
                  }}
                  title="Record Voice Comment"
                >
                  {recordingCommentId === item.id ? '🔴' : '🎙️'}
                </button>

                <button type="submit" className="comment-send-btn" style={{ padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', height: '34px', display: 'flex', alignItems: 'center' }}>
                  Post
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CommunityFeed;
