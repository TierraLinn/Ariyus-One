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

  // Audio refs
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const streamRef = useRef(null);
  const oppCanvasRef = useRef(null);
  const myCanvasRef = useRef(null);
  const lastTimeRef = useRef(null);

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
          // Time is up for this line, advance
          if (battleLineIdx < BATTLE_LYRICS.length - 1) {
            setBattleLineIdx(idx => idx + 1);
            setFeedbackMsg(
              BATTLE_LYRICS[battleLineIdx + 1].singer === 'me'
                ? '🎙️ YOUR TURN! Sing the note matching target frequency!'
                : `👥 Opponent's turn: ${selectedOpponent.name} is singing...`
            );
            return 6.0;
          } else {
            // Battle ended
            setBattleEnded(true);
            setBattleActive(false);
            clearInterval(interval);
            stopBattleStream();

            // Compute awards
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

      // Opponent scoring auto-advances on their turn
      if (activeSinger === 'opponent') {
        const difficultyFactor = selectedOpponent.baseScore / 100;
        // Simulating matching accuracy points addition per frame
        const pointGain = (delta / 1000) * 15 * (difficultyFactor + Math.random() * 0.1);
        setOpponentScore(s => Math.min(100, s + pointGain));
        setLivePitch(0);
      } else {
        // My Turn: track live or mock pitch
        let pitchVal = 0;
        const targetF = activeLine.targetFreq;

        if (isSandbox) {
          // Slow sine convergence with error variance
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
          const margin = targetF * 0.04; // 4% tolerance window
          if (diff <= margin) {
            // Perfect match score increase
            const scoreGain = (delta / 1000) * 16;
            setMyScore(s => Math.min(100, s + scoreGain));
          } else {
            // Good match half-gain increase
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

      // Clear both
      oppCtx.fillStyle = '#06041c';
      oppCtx.fillRect(0, 0, width, height);

      myCtx.fillStyle = '#06041c';
      myCtx.fillRect(0, 0, width, height);

      // --- Draw Opponent Deck ---
      oppCtx.strokeStyle = 'rgba(255,255,255,0.06)';
      oppCtx.lineWidth = 1;
      oppCtx.beginPath();
      oppCtx.moveTo(0, height / 2);
      oppCtx.lineTo(width, height / 2);
      oppCtx.stroke();

      if (battleActive && activeSinger === 'opponent') {
        // Draw scrolling frequency waves
        oppCtx.strokeStyle = 'var(--secondary-glow)';
        oppCtx.lineWidth = 2.5;
        oppCtx.beginPath();
        for (let x = 0; x < width; x++) {
          const y = height / 2 + Math.sin(x * 0.05 + t * 0.015) * 15 * Math.sin(t * 0.002);
          if (x === 0) oppCtx.moveTo(x, y);
          else oppCtx.lineTo(x, y);
        }
        oppCtx.stroke();

        // Pulsing radar glow
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

      // --- Draw My Deck ---
      myCtx.strokeStyle = 'rgba(255,255,255,0.06)';
      myCtx.lineWidth = 1;
      myCtx.beginPath();
      myCtx.moveTo(0, height / 2);
      myCtx.lineTo(width, height / 2);
      myCtx.stroke();

      if (battleActive && activeSinger === 'me') {
        // Draw user pitch guide notes target
        myCtx.strokeStyle = 'rgba(0, 242, 255, 0.3)';
        myCtx.lineWidth = 1;
        myCtx.setLineDash([4, 4]);
        myCtx.beginPath();
        myCtx.moveTo(0, height / 2);
        myCtx.lineTo(width, height / 2);
        myCtx.stroke();
        myCtx.setLineDash([]);

        if (livePitch > 0) {
          // Offset wave response
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

  return (
    <div className="screen-wrapper">
      <div className="floating-notes">🏆</div>
      <h1 className="suspended-title">{inBattle ? 'Singing Battle Arena' : 'Competitions'}</h1>

      {!inBattle ? (
        <>
          {/* Main Contest Promo Card */}
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

          {/* Standings Leaderboard */}
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', alignItems: 'start' }}>
          {/* Opponents & Start controls */}
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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

          {/* Arena split console HUD */}
          <div className="glass-panel" style={{ margin: 0, textAlign: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px' }}>Split Arena Feed</span>
            
            {/* Split Screen HUD */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '15px 0' }}>
              {/* Opponent Panel */}
              <div style={{ background: activeSinger === 'opponent' ? 'rgba(255, 0, 193, 0.04)' : 'rgba(0,0,0,0.15)', border: activeSinger === 'opponent' ? '1px solid var(--secondary-glow)' : '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', overflow: 'hidden', padding: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '5px' }}>
                  <span style={{ color: 'var(--secondary-glow)', fontWeight: 'bold' }}>👤 {selectedOpponent.name} (Rival)</span>
                  <span style={{ color: '#fff', fontWeight: 'bold' }}>Score: {opponentScore.toFixed(0)} pts</span>
                </div>
                <canvas ref={oppCanvasRef} style={{ width: '100%', height: '90px', borderRadius: '4px', display: 'block' }} />
              </div>

              {/* User Panel */}
              <div style={{ background: activeSinger === 'me' ? 'rgba(0, 242, 255, 0.04)' : 'rgba(0,0,0,0.15)', border: activeSinger === 'me' ? '1px solid var(--primary-glow)' : '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', overflow: 'hidden', padding: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '5px' }}>
                  <span style={{ color: 'var(--primary-glow)', fontWeight: 'bold' }}>🎙️ {userData?.displayName || 'Me'}</span>
                  <span style={{ color: '#fff', fontWeight: 'bold' }}>Score: {myScore.toFixed(0)} pts</span>
                </div>
                <canvas ref={myCanvasRef} style={{ width: '100%', height: '90px', borderRadius: '4px', display: 'block' }} />
              </div>
            </div>

            {/* Turn Info & Timer */}
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
                Gained +25 XP consolatory reward. Keep practicing in the Calibration Chamber!
              </strong>
            </>
          )}
          <button className="glowing-button" onClick={() => { setBattleEnded(false); setInBattle(false); }} style={{ marginTop: '20px', padding: '10px 24px' }}>
            Finish Match
          </button>
        </div>
      )}
    </div>
  );
};

export default Competitions;
