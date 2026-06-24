import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';

const defaultCommunityFeed = [
  {
    id: 'rec_default_1',
    userDisplayName: 'Celeste Vocalist',
    userId: 'celeste',
    timestamp: '2 hours ago',
    song: { title: 'Cosmic Resonance', artist: 'Solfeggio Choir' },
    playbackUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
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
    playbackUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
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
  const [feed, setFeed] = useState([]);
  const [activeAudioId, setActiveAudioId] = useState(null);
  const [commentInputs, setCommentInputs] = useState({});
  const audioRef = React.useRef(null);

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
      console.warn("Firestore recordings listener failed, loading from local catalog:", err);
      // Fallback local storage
      const saved = localStorage.getItem('ariyus_shared_recordings');
      if (saved) {
        const parsed = JSON.parse(saved);
        const filteredDefaults = defaultCommunityFeed.filter(def => !parsed.some(p => p.id === def.id));
        setFeed([...parsed, ...filteredDefaults]);
      } else {
        setFeed(defaultCommunityFeed);
      }
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

  const handlePlayToggle = (id, url) => {
    if (activeAudioId === id) {
      audioRef.current.pause();
      setActiveAudioId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setActiveAudioId(id);
      audioRef.current = new Audio(url);
      audioRef.current.play().catch(err => {
        console.warn("Audio playback failed:", err);
        alert("Audio file could not be played in local preview.");
        setActiveAudioId(null);
      });
      audioRef.current.onended = () => setActiveAudioId(null);
    }
  };

  useEffect(() => {
    return () => {
      if (audioRef.current) audioRef.current.pause();
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
              <div style={{ display: 'flex', gap: '15px', alignItems: 'center', margin: '15px 0' }}>
                <button 
                  className="glowing-button" 
                  style={{ margin: 0, padding: '8px 20px', fontSize: '0.85rem' }}
                  onClick={() => handlePlayToggle(item.id, item.playbackUrl)}
                >
                  {activeAudioId === item.id ? '⏸ Pause Matrix' : '▶ Listen Capture'}
                </button>
              </div>

              {/* Feed Actions */}
              <div className="feed-actions">
                <button className={isLiked ? 'active' : ''} onClick={() => handleLike(item)}>
                  ❤️ Like ({item.likes?.length || 0})
                </button>
                <button onClick={() => navigate('Recording', { selectedSong: item.song })}>
                  🎙 Duet
                </button>
                <button onClick={() => navigate('Results', { selectedSong: item.song })}>
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
                      <div key={c.id || index} className="comment-item">
                        <b style={{ color: 'var(--primary-glow)' }}>{c.user}:</b> <span style={{ color: 'var(--text-dim)' }}>{c.text}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Comment Input */}
                <form onSubmit={(e) => handleAddComment(e, item)} className="comment-input-bar">
                  <input 
                    type="text" 
                    placeholder="Enter resonance message..." 
                    value={commentInputs[item.id] || ''} 
                    onChange={e => handleCommentInputChange(item.id, e.target.value)} 
                    className="comment-input" 
                  />
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
