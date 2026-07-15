import React, { useState, useEffect, useRef } from 'react';
import { getPitchFromAudioData } from '../utils/vocalDSP';

const OPPONENTS = [
  { id: 'op1', name: 'Celeste Vocalist', difficulty: 'Hard', baseScore: 92, avatar: '🥇' },
  { id: 'op2', name: 'Solar Tenor', difficulty: 'Medium', baseScore: 84, avatar: '🥈' },
  { id: 'op3', name: 'Vocal Alchemist', difficulty: 'Easy', baseScore: 72, avatar: '🥉' }
];

const BATTLE_LYRICS = [
  { index: 0, singer: 'opponent', text: 'Sing out your light, let it shine so bright', targetFreq: 392.0, note: 'G4' },
  { index: 1, singer: 'me', text: 'Resonating frequencies through the night', targetFreq: 329.6, note: 'E4' },
  { index: 2, singer: 'opponent', text: 'Unlock the cellular miracle code', targetFreq: 440.0, note: 'A4' },
  { index: 3, singer: 'me', text: 'Stepping into high-vibrational road', targetFreq: 528.0, note: '528Hz' }
];

const Competitions = ({ navigate, userData, setUserData }) => {
  // Navigation tabs state: 'contests' or 'lobbies'
  const [viewMode, setViewMode] = useState('contests');

  const [standings, setStandings] = useState([
    { id: 'c1', name: 'Celeste Vocalist', score: 98, votes: 412, icon: '🥇' },
    { id: 'c2', name: 'Solar Tenor', score: 94, votes: 389, icon: '🥈' },
    { id: 'c3', name: 'Aura Singer', score: 91, votes: 201, icon: '🥉' }
  ]);

  // Battle Arena states
  const [inBattle, setInBattle] = useState(false);
  const [selectedOpponent, setSelectedOpponent] = useState(OPPONENTS[1]);
  const [battleActive, setBattleActive] = useState(false);
  const [battleLineIdx, setBattleLineIdx] = useState(0);
  const [battleTimer, setBattleTimer] = useState(6.0); // 6s per line
  const [opponentScore, setOpponentScore] = useState(0);
  const [myScore, setMyScore] = useState(0);
  const [livePitch, setLivePitch] = useState(0);
  const [isSandbox, setIsSandbox] = useState(false);
  const [battleEnded, setBattleEnded] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('Select an opponent and enter the arena!');

  // Lobbies & Spatial Voice Room states
  const [lobbies, setLobbies] = useState([
    { id: 'l1', name: '👑 Crown Chakra Resonance (528Hz)', host: 'Solar Tenor', count: 4, limit: 8, freq: 528 },
    { id: 'l2', name: '🧘 Binaural Chill Lounge (432Hz)', host: 'Vocal Alchemist', count: 2, limit: 6, freq: 432 },
    { id: 'l3', name: '⚔️ Battle Arena Warmups (396Hz)', host: 'Celeste Vocalist', count: 1, limit: 10, freq: 396 }
  ]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomFreq, setNewRoomFreq] = useState(528);
  const [newRoomCap, setNewRoomCap] = useState(8);

  const [roomParticipants, setRoomParticipants] = useState([]);
  const [roomQueue, setRoomQueue] = useState([
    { id: 'q1', title: 'Cosmic Resonance (528Hz)', singer: 'Solar Tenor' }
  ]);
  const [isMicOn, setIsMicOn] = useState(false);
  const [emojis, setEmojis] = useState([]);
  const [myCoords, setMyCoords] = useState({ x: 150, y: 150 });
  const [spatialAudioMetrics, setSpatialAudioMetrics] = useState({ pan: 0.0, gain: 1.0 });
  const [singerTimer] = useState(45);
  const [lyricsLine] = useState("Aligning dynamic voice metrics with cosmic carriers...");

  // Audio refs
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const streamRef = useRef(null);
  const oppCanvasRef = useRef(null);
  const myCanvasRef = useRef(null);
  const lastTimeRef = useRef(null);
  const dragContainerRef = useRef(null);
  const spatialPannerRef = useRef(null);
  const spatialGainRef = useRef(null);

  // Sync spatial panner nodes with drag metrics
  useEffect(() => {
    if (!isMicOn || !audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    if (ctx.state === 'closed') return;
    
    try {
      if (spatialPannerRef.current) {
        spatialPannerRef.current.pan.setValueAtTime(spatialAudioMetrics.pan, ctx.currentTime);
      }
      if (spatialGainRef.current) {
        spatialGainRef.current.gain.setValueAtTime(spatialAudioMetrics.gain, ctx.currentTime);
      }
    } catch (e) {
      console.warn("Failed to sync spatial audio coefficients:", e);
    }
  }, [spatialAudioMetrics, isMicOn]);

  // Clean up mic on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        try {
          streamRef.current.getTracks().forEach(t => t.stop());
        } catch (e) {}
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        try {
          audioCtxRef.current.close();
        } catch (e) {}
      }
    };
  }, []);

  const activeLine = BATTLE_LYRICS[battleLineIdx];
  const activeSinger = activeLine?.singer || 'opponent';

  const handleVote = (name) => {
    alert(`Thank you! Your vote for ${name} has been synced to the active competition block.`);
    setStandings(prev => prev.map(c => c.name === name ? { ...c, votes: c.votes + 1 } : c));
  };

  const startBattleStream = async (sandbox = false) => {
    setOpponentScore(0);
    setMyScore(0);
    setBattleLineIdx(0);
    setBattleTimer(6.0);
    setBattleActive(true);
    setBattleEnded(false);
    setFeedbackMsg('Syncing battle frequencies...');

    if (sandbox) {
      setIsSandbox(true);
      return;
    }

    setIsSandbox(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;

      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;

      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      sourceRef.current = source;

      setFeedbackMsg('Mic synced! Opponent takes the first line!');
    } catch (err) {
      console.warn("Microphone blocked. Falling back to Sandbox Battle simulator:", err);
      setIsSandbox(true);
      setFeedbackMsg('Microphone blocked. Sandbox Battle mode active.');
    }
  };

  const stopBattleStream = () => {
    setBattleActive(false);
    setLivePitch(0);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close();
    }
  };

  // Main battle progression timeline loop
  useEffect(() => {
    if (!battleActive || battleEnded) return;

    const interval = setInterval(() => {
      setBattleTimer(prev => {
        if (prev <= 0.1) {
          if (battleLineIdx < BATTLE_LYRICS.length - 1) {
            setBattleLineIdx(idx => idx + 1);
            setFeedbackMsg(
              BATTLE_LYRICS[battleLineIdx + 1].singer === 'me'
                ? '🎙️ YOUR TURN! Sing the note matching target frequency!'
                : `👥 Opponent's turn: ${selectedOpponent.name} is singing...`
            );
            return 6.0;
          } else {
            setBattleEnded(true);
            setBattleActive(false);
            clearInterval(interval);
            stopBattleStream();

            const userWon = myScore >= opponentScore;
            if (userWon) {
              localStorage.setItem('ariyus_battle_won', 'true');
            }
            if (userWon && userData) {
              const updatedCoins = (userData.coins || 500) + 100;
              const updatedXp = (userData.xp || 120) + 100;
              const updatedProfile = { ...userData, coins: updatedCoins, xp: updatedXp };
              setUserData(updatedProfile);
              localStorage.setItem('ariyus_local_user', JSON.stringify(updatedProfile));
            } else if (!userWon && userData) {
              const updatedXp = (userData.xp || 120) + 25;
              const updatedProfile = { ...userData, xp: updatedXp };
              setUserData(updatedProfile);
              localStorage.setItem('ariyus_local_user', JSON.stringify(updatedProfile));
            }
            return 0;
          }
        }
        return prev - 0.1;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [battleActive, battleLineIdx, battleEnded, selectedOpponent, myScore, opponentScore, userData, setUserData]);

  // Real-time audio pitch tracking loop for user turn
  useEffect(() => {
    if (!battleActive || battleEnded) return;

    let animId;
    lastTimeRef.current = Date.now();

    const checkPitch = () => {
      const now = Date.now();
      const delta = now - lastTimeRef.current;
      lastTimeRef.current = now;

      if (activeSinger === 'opponent') {
        const difficultyFactor = selectedOpponent.baseScore / 100;
        const pointGain = (delta / 1000) * 15 * (difficultyFactor + Math.random() * 0.1);
        setOpponentScore(s => Math.min(100, s + pointGain));
        setLivePitch(0);
      } else {
        let pitchVal = 0;
        const targetF = activeLine.targetFreq;

        if (isSandbox) {
          const variance = Math.sin(now * 0.004) * 15;
          pitchVal = Math.round(targetF + variance);
        } else if (analyserRef.current && audioCtxRef.current) {
          const bufferLength = analyserRef.current.fftSize;
          const dataArray = new Uint8Array(bufferLength);
          analyserRef.current.getByteTimeDomainData(dataArray);

          const detected = getPitchFromAudioData(dataArray, audioCtxRef.current.sampleRate);
          if (detected > 50 && detected < 1200) {
            pitchVal = detected;
          }
        }

        setLivePitch(Math.round(pitchVal));

        if (pitchVal > 0) {
          const diff = Math.abs(pitchVal - targetF);
          const margin = targetF * 0.04;
          if (diff <= margin) {
            const scoreGain = (delta / 1000) * 16;
            setMyScore(s => Math.min(100, s + scoreGain));
          } else {
            const scoreGain = (delta / 1000) * 6;
            setMyScore(s => Math.min(100, s + scoreGain));
          }
        }
      }

      animId = requestAnimationFrame(checkPitch);
    };

    animId = requestAnimationFrame(checkPitch);
    return () => cancelAnimationFrame(animId);
  }, [battleActive, battleEnded, activeSinger, isSandbox, activeLine, selectedOpponent]);

  // Drawing split screen visualizer canvas panels
  useEffect(() => {
    if (!inBattle) return;

    let animId;
    const oppCanvas = oppCanvasRef.current;
    const myCanvas = myCanvasRef.current;

    if (!oppCanvas || !myCanvas) return;

    const oppCtx = oppCanvas.getContext('2d');
    const myCtx = myCanvas.getContext('2d');

    const width = oppCanvas.width = myCanvas.width = oppCanvas.parentElement.clientWidth || 300;
    const height = oppCanvas.height = myCanvas.height = 90;

    const drawLoop = () => {
      const t = Date.now();

      oppCtx.fillStyle = '#06041c';
      oppCtx.fillRect(0, 0, width, height);

      myCtx.fillStyle = '#06041c';
      myCtx.fillRect(0, 0, width, height);

      oppCtx.strokeStyle = 'rgba(255,255,255,0.06)';
      oppCtx.lineWidth = 1;
      oppCtx.beginPath();
      oppCtx.moveTo(0, height / 2);
      oppCtx.lineTo(width, height / 2);
      oppCtx.stroke();

      if (battleActive && activeSinger === 'opponent') {
        oppCtx.strokeStyle = 'var(--secondary-glow)';
        oppCtx.lineWidth = 2.5;
        oppCtx.beginPath();
        for (let x = 0; x < width; x++) {
          const y = height / 2 + Math.sin(x * 0.05 + t * 0.015) * 15 * Math.sin(t * 0.002);
          if (x === 0) oppCtx.moveTo(x, y);
          else oppCtx.lineTo(x, y);
        }
        oppCtx.stroke();

        oppCtx.shadowColor = 'var(--secondary-glow)';
        oppCtx.shadowBlur = 10;
        oppCtx.fillStyle = '#fff';
        oppCtx.beginPath();
        oppCtx.arc(width - 40, height / 2, 6, 0, Math.PI * 2);
        oppCtx.fill();
        oppCtx.shadowBlur = 0;
      } else {
        oppCtx.fillStyle = 'rgba(255,255,255,0.2)';
        oppCtx.font = 'normal 10px sans-serif';
        oppCtx.fillText('WAITING TURN / WARMING UP...', 15, height / 2 + 4);
      }

      myCtx.strokeStyle = 'rgba(255,255,255,0.06)';
      myCtx.lineWidth = 1;
      myCtx.beginPath();
      myCtx.moveTo(0, height / 2);
      myCtx.lineTo(width, height / 2);
      myCtx.stroke();

      if (battleActive && activeSinger === 'me') {
        myCtx.strokeStyle = 'rgba(0, 242, 255, 0.3)';
        myCtx.lineWidth = 1;
        myCtx.setLineDash([4, 4]);
        myCtx.beginPath();
        myCtx.moveTo(0, height / 2);
        myCtx.lineTo(width, height / 2);
        myCtx.stroke();
        myCtx.setLineDash([]);

        if (livePitch > 0) {
          const targetF = activeLine.targetFreq;
          const deltaF = livePitch - targetF;
          const normalizedY = height / 2 - (deltaF / 80) * (height / 2);
          const clampedY = Math.max(10, Math.min(height - 10, normalizedY));

          myCtx.strokeStyle = 'var(--primary-glow)';
          myCtx.lineWidth = 3;
          myCtx.beginPath();
          for (let x = 0; x < width - 40; x++) {
            const y = clampedY + Math.sin(x * 0.08 + t * 0.02) * 2;
            if (x === 0) myCtx.moveTo(x, y);
            else myCtx.lineTo(x, y);
          }
          myCtx.stroke();

          myCtx.shadowColor = 'var(--primary-glow)';
          myCtx.shadowBlur = 12;
          myCtx.fillStyle = '#fff';
          myCtx.beginPath();
          myCtx.arc(width - 40, clampedY, 7, 0, Math.PI * 2);
          myCtx.fill();
          myCtx.shadowBlur = 0;
        }
      } else {
        myCtx.fillStyle = 'rgba(255,255,255,0.2)';
        myCtx.font = 'normal 10px sans-serif';
        myCtx.fillText(battleActive ? 'STAND BY - OPPONENT SINGING' : 'CLICK BEGIN TO COMMENCE BATTLE', 15, height / 2 + 4);
      }

      animId = requestAnimationFrame(drawLoop);
    };

    drawLoop();
    return () => cancelAnimationFrame(animId);
  }, [inBattle, battleActive, activeSinger, livePitch, activeLine, selectedOpponent]);

  // Spatial stage drag handler helper
  const handlePointerMove = (e) => {
    if (!dragContainerRef.current) return;
    const rect = dragContainerRef.current.getBoundingClientRect();
    
    // Calculate client coords within 300x300 container bounds
    const x = Math.max(15, Math.min(285, e.clientX - rect.left));
    const y = Math.max(15, Math.min(285, e.clientY - rect.top));

    setMyCoords({ x, y });

    // Spatial logic relative to center (150, 150)
    const dx = x - 150;
    const dy = y - 150;
    
    const pan = parseFloat((dx / 135).toFixed(2)); // panning coeff (-1.0 to 1.0)
    const dist = Math.sqrt(dx * dx + dy * dy);
    const gain = parseFloat(Math.max(0.1, 1.0 - dist / 190).toFixed(2)); // volume multiplier

    setSpatialAudioMetrics({ pan, gain });

    // Update coordinates in participant list
    setRoomParticipants(prev => prev.map(p => 
      p.name.includes('(You)') ? { ...p, coords: { x, y } } : p
    ));
  };

  const toggleRoomMic = async () => {
    const nextState = !isMicOn;
    setIsMicOn(nextState);

    // Update coordinates in participant list
    setRoomParticipants(prev => prev.map(p => 
      p.name.includes('(You)') ? { ...p, isSpeaking: nextState } : p
    ));

    if (nextState) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }, 
          video: false 
        });
        streamRef.current = stream;

        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;

        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        source.connect(analyser);
        analyserRef.current = analyser;

        const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
        const gainNode = ctx.createGain();
        
        if (panner) {
          panner.pan.setValueAtTime(spatialAudioMetrics.pan, ctx.currentTime);
          gainNode.gain.setValueAtTime(spatialAudioMetrics.gain, ctx.currentTime);
          source.connect(panner);
          panner.connect(gainNode);
          gainNode.connect(ctx.destination);
          
          spatialPannerRef.current = panner;
          spatialGainRef.current = gainNode;
        } else {
          source.connect(gainNode);
          gainNode.connect(ctx.destination);
          spatialGainRef.current = gainNode;
        }
      } catch (err) {
        console.warn("Failed to start spatial mic stream:", err);
      }
    } else {
      if (streamRef.current) {
        try { streamRef.current.getTracks().forEach(t => t.stop()); } catch (e) {}
        streamRef.current = null;
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        try { audioCtxRef.current.close(); } catch (e) {}
      }
      spatialPannerRef.current = null;
      spatialGainRef.current = null;
    }
  };

  // Join a Vocal Chat Room
  const handleJoinRoom = (room) => {
    // Clean up active streams first
    if (streamRef.current) {
      try { streamRef.current.getTracks().forEach(t => t.stop()); } catch (e) {}
      streamRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      try { audioCtxRef.current.close(); } catch (e) {}
    }
    spatialPannerRef.current = null;
    spatialGainRef.current = null;

    setActiveRoom(room);
    setMyCoords({ x: 150, y: 150 });
    setSpatialAudioMetrics({ pan: 0.0, gain: 1.0 });
    setEmojis([]);
    setIsMicOn(false);
    
    // Set mock local users
    setRoomParticipants([
      { name: `${userData?.displayName || 'Aura Singer'} (You)`, avatar: '🎙️', role: 'Listener', coords: { x: 150, y: 150 }, isSpeaking: false },
      { name: room.host, avatar: '👤', role: 'Host / Singer', coords: { x: 75, y: 80 }, isSpeaking: true },
      { name: 'Vocal Alchemist', avatar: '🥉', role: 'Listener', coords: { x: 220, y: 90 }, isSpeaking: false },
      { name: 'Celeste Vocalist', avatar: '🥇', role: 'Listener', coords: { x: 110, y: 220 }, isSpeaking: false }
    ]);
  };

  // Create a Custom Lobby Room
  const handleCreateRoom = (e) => {
    e.preventDefault();
    if (!newRoomName.trim()) {
      alert('Lobby room name is required.');
      return;
    }
    const newRoom = {
      id: 'l_' + Date.now(),
      name: `👑 ${newRoomName} (${newRoomFreq}Hz)`,
      host: userData?.displayName || 'Aura Singer',
      count: 1,
      limit: newRoomCap,
      freq: newRoomFreq
    };
    setLobbies(prev => [newRoom, ...prev]);
    setShowCreateModal(false);
    handleJoinRoom(newRoom);
    setNewRoomName('');
  };

  // Add emoji reaction
  const handleEmojiReact = (char) => {
    const id = Date.now() + Math.random();
    const left = Math.floor(Math.random() * 70) + 15; // random horizontal scatter
    const newEmoji = { id, char, left };
    setEmojis(prev => [...prev, newEmoji]);
    
    // Cleanup emoji after animation completes
    setTimeout(() => {
      setEmojis(prev => prev.filter(e => e.id !== id));
    }, 2000);
  };

  // Queue a track inside room
  const handleQueueTrack = (trackName) => {
    const nextQ = {
      id: 'q_' + Date.now(),
      title: `${trackName} (${activeRoom?.freq || 528}Hz Tuning)`,
      singer: `${userData?.displayName || 'Aura Singer'}`
    };
    setRoomQueue(prev => [...prev, nextQ]);
    alert(`"${trackName}" added to the performance queue!`);
  };

  // Simulated live speaking indicators loop
  useEffect(() => {
    if (!activeRoom) return;

    const interval = setInterval(() => {
      setRoomParticipants(prev => prev.map(p => {
        // Mock occasional speaking states
        if (p.name.includes('(You)')) {
          return { ...p, isSpeaking: isMicOn && Math.random() > 0.3 };
        }
        return { ...p, isSpeaking: Math.random() > 0.6 };
      }));
    }, 1500);

    return () => clearInterval(interval);
  }, [activeRoom, isMicOn]);

  return (
    <div className="screen-wrapper">
      <div className="floating-notes">🏆</div>

      {/* Nav Switch Tabs (Only show if not currently inside a room or battle) */}
      {!inBattle && !activeRoom && (
        <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: '5px', borderRadius: '8px', marginBottom: '20px', border: '1px solid var(--glass-border)' }}>
          <button 
            className={`glowing-button ${viewMode === 'contests' ? '' : 'secondary'}`} 
            style={{ flex: 1, margin: 0, padding: '8px 0', fontSize: '0.78rem' }}
            onClick={() => setViewMode('contests')}
          >
            🏆 Contest Arena
          </button>
          <button 
            className={`glowing-button ${viewMode === 'lobbies' ? '' : 'secondary'}`} 
            style={{ flex: 1, margin: 0, padding: '8px 0', fontSize: '0.78rem' }}
            onClick={() => setViewMode('lobbies')}
          >
            👥 Live Parties & Voice Lobbies
          </button>
        </div>
      )}

      {/* VIEW MODE 1: CONTESTS & ARENA */}
      {viewMode === 'contests' && (
        <>
          <h1 className="suspended-title" style={{ display: activeRoom || inBattle ? 'none' : 'block' }}>Contests & Singing Battles</h1>
          {!inBattle ? (
            <>
              {/* Weekly Contest Promo */}
              <div className="glass-panel" style={{ margin: '0 0 20px 0', borderColor: 'var(--secondary-glow)', background: 'rgba(255, 0, 193, 0.03)' }}>
                <span style={{ fontSize: '0.75rem', background: 'var(--secondary-glow)', color: '#000', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                  🏆 Active Weekly Contest
                </span>
                <h2 style={{ marginTop: '12px', color: '#fff', fontSize: '1.4rem' }}>Solfeggio Ascension: 528Hz Hearts</h2>
                <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', lineHeight: '1.5', margin: '8px 0 15px 0' }}>
                  Sing any track in 528Hz Solfeggio alignment. The performer with the highest convergence score at the end of the week wins a **$500 Cash prize & Luminary Badge**.
                </p>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button 
                    className="glowing-button" 
                    style={{ margin: 0, padding: '10px 22px' }}
                    onClick={() => navigate('SongLibrary')}
                  >
                    🎙️ Submit Entry
                  </button>
                  <button 
                    className="glowing-button secondary" 
                    style={{ margin: 0, padding: '10px 22px', borderColor: 'var(--primary-glow)', color: 'var(--primary-glow)' }}
                    onClick={() => setInBattle(true)}
                  >
                    ⚔️ Enter Battle Arena
                  </button>
                </div>
              </div>

              {/* Contest Leaderboard */}
              <div className="glass-panel" style={{ margin: 0 }}>
                <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px', color: '#fff' }}>
                  Leaderboard Standings
                </h3>
                <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: '15px' }}>
                  Current ranking standings for the active Solfeggio Ascension block.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {standings.map(c => (
                    <div key={c.id} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      background: 'rgba(255,255,255,0.02)', 
                      padding: '12px 15px', 
                      borderRadius: '8px', 
                      border: '1px solid rgba(255,255,255,0.03)' 
                    }}>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <span style={{ fontSize: '1.5rem' }}>{c.icon}</span>
                        <div>
                          <strong style={{ color: '#fff', fontSize: '0.95rem' }}>{c.name}</strong>
                          <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                            <span style={{ fontSize: '0.7rem', color: 'var(--primary-glow)' }}>Score: {c.score}%</span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>|</span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{c.votes} Votes</span>
                          </div>
                        </div>
                      </div>
                      <button 
                        className="glowing-button secondary" 
                        style={{ margin: 0, padding: '6px 12px', fontSize: '0.72rem' }}
                        onClick={() => handleVote(c.name)}
                      >
                        👍 Vote
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            // Active Battle Arena
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', alignItems: 'start' }}>
              <div className="glass-panel" style={{ margin: 0 }}>
                <h2 style={{ fontSize: '1.25rem', marginBottom: '10px' }}>Opponent Matching Room</h2>
                <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: '15px' }}>
                  Choose a rival cover singer to challenge to an alternating line-by-line pitch alignment duel!
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {OPPONENTS.map(op => (
                    <div 
                      key={op.id} 
                      className="draft-item"
                      style={{ 
                        cursor: 'pointer',
                        borderColor: selectedOpponent.id === op.id ? 'var(--secondary-glow)' : 'rgba(255,255,255,0.06)',
                        background: selectedOpponent.id === op.id ? 'rgba(255, 0, 193, 0.02)' : '',
                        padding: '12px',
                        borderRadius: '8px'
                      }}
                      onClick={() => {
                        if (battleActive) stopBattleStream();
                        setSelectedOpponent(op);
                        setBattleActive(false);
                        setBattleLineIdx(0);
                        setBattleEnded(false);
                      }}
                    >
                      <div style={{ display: 'flex', justifycontent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: '0.92rem', color: selectedOpponent.id === op.id ? 'var(--secondary-glow)' : '#fff' }}>
                          {op.avatar} {op.name}
                        </strong>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                          Diff: {op.difficulty}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                  {!battleActive ? (
                    <>
                      <button className="glowing-button" onClick={() => startBattleStream(false)} style={{ flexGrow: 1, margin: 0, padding: '12px 0' }}>
                        ⚔️ Start Live Duel
                      </button>
                      <button className="glowing-button secondary" onClick={() => startBattleStream(true)} style={{ margin: 0, padding: '12px 15px' }}>
                        ⚙️ Sandbox
                      </button>
                    </>
                  ) : (
                    <button className="glowing-button secondary" onClick={stopBattleStream} style={{ width: '100%', margin: 0, padding: '12px 0', borderColor: 'var(--secondary-glow)', color: 'var(--secondary-glow)' }}>
                      ⏹️ Abort Battle
                    </button>
                  )}
                </div>

                <button className="glowing-button secondary" onClick={() => { stopBattleStream(); setInBattle(false); }} style={{ width: '100%', marginTop: '10px', margin: '10px 0 0 0' }}>
                  🔙 Back to Leaderboard
                </button>
              </div>

              {/* Arena visuals */}
              <div className="glass-panel" style={{ margin: 0, textAlign: 'center' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px' }}>Split Arena Feed</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '15px 0' }}>
                  <div style={{ background: activeSinger === 'opponent' ? 'rgba(255, 0, 193, 0.04)' : 'rgba(0,0,0,0.15)', border: activeSinger === 'opponent' ? '1px solid var(--secondary-glow)' : '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', overflow: 'hidden', padding: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '5px' }}>
                      <span style={{ color: 'var(--secondary-glow)', fontWeight: 'bold' }}>👤 {selectedOpponent.name} (Rival)</span>
                      <span style={{ color: '#fff', fontWeight: 'bold' }}>Score: {opponentScore.toFixed(0)} pts</span>
                    </div>
                    <canvas ref={oppCanvasRef} style={{ width: '100%', height: '90px', borderRadius: '4px', display: 'block' }} />
                  </div>

                  <div style={{ background: activeSinger === 'me' ? 'rgba(0, 242, 255, 0.04)' : 'rgba(0,0,0,0.15)', border: activeSinger === 'me' ? '1px solid var(--primary-glow)' : '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', overflow: 'hidden', padding: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '5px' }}>
                      <span style={{ color: 'var(--primary-glow)', fontWeight: 'bold' }}>🎙️ {userData?.displayName || 'Me'}</span>
                      <span style={{ color: '#fff', fontWeight: 'bold' }}>Score: {myScore.toFixed(0)} pts</span>
                    </div>
                    <canvas ref={myCanvasRef} style={{ width: '100%', height: '90px', borderRadius: '4px', display: 'block' }} />
                  </div>
                </div>

                {battleActive && (
                  <div style={{ background: 'rgba(0,0,0,0.18)', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)', textAlign: 'left' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Active Battle Line</span>
                      <strong style={{ fontSize: '0.9rem', color: 'var(--secondary-glow)', fontFamily: 'monospace' }}>TIME LEFT: {battleTimer.toFixed(1)}s</strong>
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: activeSinger === 'me' ? 'var(--primary-glow)' : 'var(--secondary-glow)', margin: '8px 0 4px 0' }}>
                      {activeSinger === 'me' ? '👉 [YOUR TURN] ' : '👥 [OPPONENT] '} "{activeLine?.text}"
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                      Target Pitch: <strong>{activeLine?.note} ({activeLine?.targetFreq} Hz)</strong> 
                      {activeSinger === 'me' && livePitch > 0 && ` | Live Register: ${livePitch} Hz`}
                    </div>
                  </div>
                )}

                <div style={{ marginTop: '12px', color: 'var(--text-dim)', fontSize: '0.8rem', padding: '8px', border: '1px solid var(--glass-border)', borderRadius: '6px', minHeight: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {feedbackMsg}
                </div>
              </div>
            </div>
          )}

          {battleEnded && (
            <div className="glass-panel" style={{ marginTop: '20px', borderColor: myScore >= opponentScore ? '#00ff66' : 'var(--secondary-glow)', background: myScore >= opponentScore ? 'rgba(0,255,102,0.03)' : 'rgba(255,0,193,0.03)', textAlign: 'center' }}>
              {myScore >= opponentScore ? (
                <>
                  <h3 style={{ color: '#00ff66', fontSize: '1.6rem', margin: '0 0 8px 0' }}>🏆 VICTORY!</h3>
                  <p style={{ margin: 0, fontSize: '0.95rem' }}>
                    You out-sang <strong>{selectedOpponent.name}</strong>! Your frequency alignment score of <strong>{myScore.toFixed(0)}</strong> beat their score of <strong>{opponentScore.toFixed(0)}</strong>.
                  </p>
                  <strong style={{ color: 'var(--primary-glow)', display: 'block', marginTop: '10px' }}>
                    💰 Gained +100 Coins & +100 XP!
                  </strong>
                </>
              ) : (
                <>
                  <h3 style={{ color: 'var(--secondary-glow)', fontSize: '1.6rem', margin: '0 0 8px 0' }}>💔 DEFEAT</h3>
                  <p style={{ margin: 0, fontSize: '0.95rem' }}>
                    <strong>{selectedOpponent.name}</strong> resonated stronger with a score of <strong>{opponentScore.toFixed(0)}</strong> vs your score of <strong>{myScore.toFixed(0)}</strong>.
                  </p>
                  <strong style={{ color: 'var(--text-dim)', display: 'block', marginTop: '10px' }}>
                    Gained +25 XP reward. Keep practicing in the Calibration Chamber!
                  </strong>
                </>
              )}
              <button className="glowing-button" onClick={() => { setBattleEnded(false); setInBattle(false); }} style={{ marginTop: '20px', padding: '10px 24px' }}>
                Finish Match
              </button>
            </div>
          )}
        </>
      )}

      {/* VIEW MODE 2: LIVE VOICE LOBBIES */}
      {viewMode === 'lobbies' && (
        <>
          {!activeRoom ? (
            // Rooms directory
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h1 className="suspended-title" style={{ margin: 0 }}>Vocal Chat Lobbies</h1>
                  <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
                    Join live spatial voice rooms, warm up with other resonators, or create your own custom biofield channel.
                  </p>
                </div>
                <button 
                  className="glowing-button" 
                  onClick={() => setShowCreateModal(true)}
                  style={{ margin: 0, padding: '10px 20px', fontSize: '0.78rem' }}
                >
                  ➕ Create Lobby Room
                </button>
              </div>

              {/* Lobbies grid */}
              <div className="upgrade-options-grid" style={{ marginTop: '10px' }}>
                {lobbies.map(room => (
                  <div key={room.id} className="glass-panel tier-detail-card" style={{ margin: 0, padding: '20px' }}>
                    <span style={{ fontSize: '0.62rem', background: 'var(--secondary-glow)', color: '#000', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold', textTransform: 'uppercase', display: 'inline-block', marginBottom: '10px' }}>
                      ⚡ Solfeggio {room.freq}Hz Active
                    </span>
                    <h3 style={{ fontSize: '1.15rem', margin: '0 0 8px 0', color: '#fff' }}>{room.name}</h3>
                    
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-dim)', display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '15px' }}>
                      <div>Host: <strong style={{ color: '#fff' }}>{room.host}</strong></div>
                      <div>Occupants: <strong style={{ color: 'var(--primary-glow)' }}>{room.count} / {room.limit} active</strong></div>
                    </div>

                    <button 
                      className="glowing-button"
                      style={{ width: '100%', margin: 0, padding: '8px 0', fontSize: '0.78rem' }}
                      onClick={() => handleJoinRoom(room)}
                    >
                      🚪 Join Lobby Room
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            // Active Voice Room Workspace
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', alignItems: 'start' }}>
              
              {/* Left Column: Interactive 2D Spatial coordinate Soundstage */}
              <div className="glass-panel" style={{ margin: 0, position: 'relative', overflow: 'hidden' }}>
                
                {/* Floating Emojis Reaction layer */}
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }}>
                  {emojis.map(e => (
                    <div 
                      key={e.id}
                      style={{ 
                        position: 'absolute', 
                        bottom: '20px', 
                        left: `${e.left}%`, 
                        fontSize: '1.8rem',
                        animation: 'floatUp 2s forwards linear'
                      }}
                    >
                      {e.char}
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <h3 style={{ margin: 0, color: 'var(--primary-glow)' }}>🎙️ {activeRoom.name}</h3>
                  <button 
                    className="glowing-button secondary" 
                    onClick={() => setActiveRoom(null)}
                    style={{ margin: 0, padding: '5px 12px', fontSize: '0.72rem', borderColor: 'var(--secondary-glow)', color: 'var(--secondary-glow)' }}
                  >
                    🚪 Leave Room
                  </button>
                </div>

                <p style={{ color: 'var(--text-dim)', fontSize: '0.78rem', margin: '0 0 15px 0', lineHeight: '1.4' }}>
                  <strong>Spatial Soundstage Grid:</strong> Drag your bubble `🎙️` around. Your coordinates update pan coefficients and volume speaker gains.
                </p>

                {/* 2D Stage Canvas Boundary */}
                <div 
                  ref={dragContainerRef}
                  onPointerMove={handlePointerMove}
                  style={{ 
                    width: '100%', 
                    height: '290px', 
                    background: 'radial-gradient(circle, rgba(0,242,255,0.04) 0%, rgba(6,4,28,0.7) 100%)', 
                    borderRadius: '8px', 
                    border: '1px solid var(--glass-border)',
                    position: 'relative',
                    cursor: 'crosshair',
                    marginBottom: '15px'
                  }}
                >
                  {/* Center Node (Host Speaker Source marker) */}
                  <div style={{ 
                    position: 'absolute', top: '135px', left: '135px', width: '30px', height: '30px', 
                    background: 'rgba(255, 0, 193, 0.15)', border: '1px dashed var(--secondary-glow)', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem',
                    boxShadow: '0 0 10px rgba(255, 0, 193, 0.4)'
                  }}>
                    🔔
                  </div>

                  {/* Room Participants nodes */}
                  {roomParticipants.map((p, idx) => {
                    const isMe = p.name.includes('(You)');
                    return (
                      <div
                        key={idx}
                        style={{
                          position: 'absolute',
                          left: `${p.coords.x - 18}px`,
                          top: `${p.coords.y - 18}px`,
                          width: '36px', height: '36px',
                          borderRadius: '50%',
                          background: isMe ? 'rgba(0, 242, 255, 0.2)' : 'rgba(255,255,255,0.06)',
                          border: isMe ? '2px solid var(--primary-glow)' : '1px solid var(--glass-border)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '1.1rem',
                          transition: isMe ? 'none' : 'all 0.4s ease',
                          boxShadow: p.isSpeaking ? '0 0 15px var(--primary-glow)' : '',
                          borderColor: p.isSpeaking ? 'var(--primary-glow)' : ''
                        }}
                      >
                        {p.avatar}
                      </div>
                    );
                  })}
                </div>

                {/* Spatial calculations readout */}
                <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '10px', fontSize: '0.78rem', fontFamily: 'monospace', display: 'flex', justifyContent: 'space-between' }}>
                  <div><span style={{ color: 'var(--text-dim)' }}>Pan:</span> <strong style={{ color: 'var(--primary-glow)' }}>{spatialAudioMetrics.pan.toFixed(2)}</strong></div>
                  <div><span style={{ color: 'var(--text-dim)' }}>Gain:</span> <strong style={{ color: 'var(--primary-glow)' }}>{spatialAudioMetrics.gain.toFixed(2)}x</strong></div>
                  <div><span style={{ color: 'var(--text-dim)' }}>X/Y:</span> <span style={{ color: '#fff' }}>{myCoords.x}, {myCoords.y}</span></div>
                </div>

                {/* Mic & Reaction deck */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '15px' }}>
                  <button 
                    className={`glowing-button ${isMicOn ? '' : 'secondary'}`} 
                    onClick={toggleRoomMic}
                    style={{ flex: 1, margin: 0, padding: '10px 0', fontSize: '0.8rem' }}
                  >
                    {isMicOn ? '🎙️ Live Mic Active' : '🔇 Mic Muted'}
                  </button>
                  
                  {/* Reaction panel */}
                  <div style={{ display: 'flex', gap: '5px' }}>
                    {['🔥', '🧬', '💖', '👏'].map(char => (
                      <button 
                        key={char} 
                        className="glowing-button secondary" 
                        onClick={() => handleEmojiReact(char)}
                        style={{ margin: 0, width: '38px', padding: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        {char}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Performance Queue & Scrolling Lyrics Prompt */}
              <div className="glass-panel" style={{ margin: 0 }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#fff' }}>🎙️ Performance Queue</h3>
                
                {/* Active performer metrics */}
                <div style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '8px', marginBottom: '15px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '6px' }}>
                    <span>Now Performing</span>
                    <span style={{ color: 'var(--secondary-glow)', fontFamily: 'monospace' }}>Time: {singerTimer}s</span>
                  </div>

                  <div style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--primary-glow)', marginBottom: '8px' }}>
                    👤 {roomQueue[0] ? roomQueue[0].singer : 'Lobby Empty'} is singing
                  </div>

                  <p style={{ color: '#fff', fontSize: '0.82rem', margin: 0, fontStyle: 'italic', background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '4px', borderLeft: '3px solid var(--primary-glow)' }}>
                    "{lyricsLine}"
                  </p>
                </div>

                {/* Queue list */}
                <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Performer Queue Line</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '120px', background: 'rgba(0,0,0,0.1)', padding: '8px', borderRadius: '6px', border: '1px dashed var(--glass-border)' }}>
                  {roomQueue.map((q, idx) => (
                    <div 
                      key={q.id} 
                      style={{ 
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)',
                        padding: '8px 12px', borderRadius: '6px', fontSize: '0.8rem'
                      }}
                    >
                      <div>
                        <strong style={{ color: '#fff' }}>{q.title}</strong>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginTop: '2px' }}>Singer: {q.singer}</div>
                      </div>
                      <span style={{ fontSize: '0.68rem', background: idx === 0 ? 'var(--primary-glow)' : 'rgba(255,255,255,0.08)', color: idx === 0 ? '#000' : 'var(--text-dim)', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                        {idx === 0 ? 'LIVE' : `#${idx + 1}`}
                      </span>
                    </div>
                  ))}
                  {roomQueue.length === 0 && (
                    <div style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.8rem', padding: '30px' }}>
                      No tracks queued. Add one below to request!
                    </div>
                  )}
                </div>

                {/* Request track buttons */}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: '15px', paddingTop: '12px' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Queue a licensed track</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {['Solfeggio Ascension', 'Cosmic Harmony', 'Anahata Love Beat'].map(track => (
                      <button 
                        key={track}
                        className="glowing-button secondary" 
                        onClick={() => handleQueueTrack(track)}
                        style={{ margin: 0, padding: '8px 12px', fontSize: '0.75rem', textAlign: 'left', display: 'flex', justifyContent: 'space-between' }}
                      >
                        <span>🎙️ {track}</span>
                        <span style={{ color: 'var(--primary-glow)' }}>+ Queue</span>
                      </button>
                    ))}
                  </div>
                </div>

              </div>

            </div>
          )}
        </>
      )}

      {/* CREATE ROOM MODAL OVERLAY */}
      {showCreateModal && (
        <div className="custom-alert-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="custom-alert-box glass-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px', textAlign: 'left', padding: '25px' }}>
            <h3 style={{ textShadow: '0 0 10px var(--secondary-glow)', marginBottom: '5px' }}>➕ Create Live Party Lobby</h3>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.78rem', marginBottom: '15px', marginTop: 0 }}>
              Launch a custom voice alignment channel. Gather other vocalists to sing and tune.
            </p>

            <form onSubmit={handleCreateRoom} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '4px' }}>Lobby Room Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Heart Chakra Alignment"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  className="comment-input"
                  style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.4)', color: '#fff', border: '1px solid var(--glass-border)', borderRadius: '6px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '4px' }}>Tuning Carrier</label>
                  <select 
                    value={newRoomFreq} 
                    onChange={(e) => setNewRoomFreq(parseInt(e.target.value))}
                    className="comment-input"
                    style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.4)', color: '#fff', border: '1px solid var(--glass-border)', borderRadius: '6px' }}
                  >
                    <option value="396">396 Hz (Root)</option>
                    <option value="432">432 Hz (Cosmic)</option>
                    <option value="528">528 Hz (Heart)</option>
                    <option value="852">852 Hz (Third Eye)</option>
                  </select>
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '4px' }}>Max Capacity</label>
                  <input 
                    type="number" 
                    min="2" max="20"
                    value={newRoomCap}
                    onChange={(e) => setNewRoomCap(parseInt(e.target.value))}
                    className="comment-input"
                    style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.4)', color: '#fff', border: '1px solid var(--glass-border)', borderRadius: '6px', fontFamily: 'monospace' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                <button type="submit" className="glowing-button" style={{ flexGrow: 1, margin: 0, padding: '12px 0' }}>
                  🚀 Launch Live Lobby
                </button>
                <button 
                  type="button" 
                  className="glowing-button secondary" 
                  onClick={() => setShowCreateModal(false)}
                  style={{ margin: 0, padding: '0 15px', borderColor: 'var(--secondary-glow)', color: 'var(--secondary-glow)' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating animation keyframes block for reaction emojis */}
      <style>{`
        @keyframes floatUp {
          0% {
            transform: translateY(0) scale(0.6);
            opacity: 0.8;
          }
          100% {
            transform: translateY(-240px) scale(1.4);
            opacity: 0;
          }
        }
      `}</style>

    </div>
  );
};

export default Competitions;
