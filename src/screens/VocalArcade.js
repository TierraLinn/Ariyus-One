import React, { useEffect, useRef, useState } from 'react';
import { getPitchFromAudioData } from '../utils/vocalDSP';

// Solfeggio Gate Frequencies
const solfeggioFrequencies = [
  { freq: 150, note: '396Hz (Root Red)', color: '#ff003b' },
  { freq: 220, note: '417Hz (Sacral Orange)', color: '#ff7000' },
  { freq: 300, note: '528Hz (Heart Green)', color: '#00ff87' },
  { freq: 380, note: '639Hz (Throat Blue)', color: '#00f2ff' },
  { freq: 460, note: '741Hz (Third-Eye Violet)', color: '#b200ff' },
  { freq: 540, note: '852Hz (Crown Magenta)', color: '#ff00c1' }
];

const VocalArcade = ({ navigate, userData, setUserData }) => {
  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [useSlider, setUseSlider] = useState(false);
  const [manualPitch, setManualPitch] = useState(250); // Default middle frequency
  const [gameOver, setGameOver] = useState(false);
  const [coinsEarned, setCoinsEarned] = useState(0);
  const [gameTimer, setGameTimer] = useState(30); // 30 seconds game round

  // Mutable game state to avoid state lag in requestAnimationFrame
  const gameState = useRef({
    shipY: 200,
    targetShipY: 200,
    stars: [],
    gates: [],
    score: 0,
    frame: 0,
    activeGateIndex: -1,
    missed: {}
  });

  // Initialize stars
  useEffect(() => {
    const list = [];
    for (let i = 0; i < 80; i++) {
      list.push({
        x: Math.random() * 800,
        y: Math.random() * 400,
        speed: 0.5 + Math.random() * 2,
        size: 0.5 + Math.random() * 1.5
      });
    }
    gameState.current.stars = list;
  }, []);

  // Mic access setup
  const startMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserRef.current = analyser;

      setIsPlaying(true);
      setScore(0);
      setGameOver(false);
      setGameTimer(30);
      gameState.current.score = 0;
      gameState.current.gates = [];
      gameState.current.frame = 0;
      gameState.current.shipY = 200;
      gameState.current.targetShipY = 200;
    } catch (err) {
      console.warn("Microphone access denied. Launching in sandbox simulation mode.");
      setUseSlider(true);
      setIsPlaying(true);
      setScore(0);
      setGameOver(false);
      setGameTimer(30);
      gameState.current.score = 0;
      gameState.current.gates = [];
      gameState.current.frame = 0;
      gameState.current.shipY = 200;
      gameState.current.targetShipY = 200;
    }
  };

  const stopGame = () => {
    setIsPlaying(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
  };

  useEffect(() => {
    return () => stopGame();
  }, []);

  // Keyboard controls for sandbox pitch simulation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isPlaying || gameOver) return;
      if (e.key === 'ArrowUp') {
        setManualPitch(prev => Math.min(600, prev + 25));
        setUseSlider(true);
      } else if (e.key === 'ArrowDown') {
        setManualPitch(prev => Math.max(100, prev - 25));
        setUseSlider(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, gameOver]);

  // Round countdown timer
  useEffect(() => {
    if (!isPlaying || gameOver) return;
    const timer = setInterval(() => {
      setGameTimer(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          // End game
          setGameOver(true);
          setIsPlaying(false);
          const points = gameState.current.score;
          const coins = points * 15;
          setCoinsEarned(coins);

          // Update profile coins and XP, triggering auto-sync to Firestore
          if (userData) {
            const updatedProfile = {
              ...userData,
              coins: (userData.coins || 0) + coins,
              xp: (userData.xp || 0) + (points * 10)
            };
            setUserData(updatedProfile);
            localStorage.setItem('ariyus_local_user', JSON.stringify(updatedProfile));
          }

          localStorage.setItem('ariyus_arcade_completed', 'true');
          stopGame();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isPlaying, gameOver, userData, setUserData]);

  // Main Canvas Rendering & Pitch loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationId;

    const pitchBuffer = new Uint8Array(2048);

    const gameLoop = () => {
      const state = gameState.current;
      state.frame++;

      // 1. Process Pitch
      let detectedHz = 0;
      if (isPlaying && analyserRef.current && !useSlider) {
        analyserRef.current.getByteTimeDomainData(pitchBuffer);
        const sampleRate = audioContextRef.current.sampleRate;
        const pitch = getPitchFromAudioData(pitchBuffer, sampleRate);
        if (pitch !== -1 && pitch > 80 && pitch < 800) {
          detectedHz = pitch;
        }
      } else if (isPlaying && useSlider) {
        detectedHz = manualPitch;
      }

      // Map detected Hz to Y coordinate (frequency limits: 100Hz = 380px (bottom), 600Hz = 20px (top))
      if (detectedHz > 0) {
        const clamped = Math.max(100, Math.min(600, detectedHz));
        // Inverse linear mapping
        const percentage = (clamped - 100) / 500;
        state.targetShipY = 380 - percentage * 360;
      }

      // Smooth ship tracking
      state.shipY += (state.targetShipY - state.shipY) * 0.15;

      // 2. Clear Screen
      ctx.fillStyle = '#06041e';
      ctx.fillRect(0, 0, 800, 400);

      // Draw Grid Background
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      for (let x = 0; x < 800; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 400);
        ctx.stroke();
      }
      for (let y = 0; y < 400; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(800, y);
        ctx.stroke();
      }

      // 3. Move & Draw Stars
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      state.stars.forEach(star => {
        star.x -= star.speed;
        if (star.x < 0) {
          star.x = 800;
          star.y = Math.random() * 400;
        }
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // 4. Generate Gates
      if (isPlaying && state.frame % 140 === 0) {
        const randomSolfeggio = solfeggioFrequencies[Math.floor(Math.random() * solfeggioFrequencies.length)];
        // Map frequency of gate to coordinate Y
        const percent = (randomSolfeggio.freq - 100) / 500;
        const gateY = 380 - percent * 360;

        state.gates.push({
          id: 'gate_' + state.frame,
          x: 800,
          y: gateY,
          freqInfo: randomSolfeggio,
          width: 35,
          gap: 65, // opening size
          passed: false
        });
      }

      // 5. Move & Draw Gates
      state.gates.forEach(gate => {
        gate.x -= 3.5; // gate move speed

        // Draw gate columns
        ctx.shadowBlur = 10;
        ctx.shadowColor = gate.freqInfo.color;
        ctx.fillStyle = gate.freqInfo.color;

        // Top gate half
        ctx.fillRect(gate.x, 0, gate.width, gate.y - gate.gap / 2);
        // Bottom gate half
        ctx.fillRect(gate.x, gate.y + gate.gap / 2, gate.width, 400 - (gate.y + gate.gap / 2));

        // Draw glowing target frequency indicator ring
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(gate.x + gate.width / 2, gate.y, 10, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px "Orbitron", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(gate.freqInfo.note, gate.x + gate.width / 2, gate.y - gate.gap / 2 - 8);

        ctx.shadowBlur = 0;

        // 6. Collision & Alignment check
        const shipX = 100;
        if (!gate.passed && gate.x <= shipX + 15 && gate.x + gate.width >= shipX - 10) {
          // Check if ship is vertically inside the gap opening
          const inOpening = state.shipY > (gate.y - gate.gap / 2) && state.shipY < (gate.y + gate.gap / 2);
          if (inOpening) {
            gate.passed = true;
            state.score += 1;
            setScore(state.score);

            // Trigger beautiful feedback audio chime
            if (audioContextRef.current) {
              const osc = audioContextRef.current.createOscillator();
              const gain = audioContextRef.current.createGain();
              osc.type = 'sine';
              osc.frequency.setValueAtTime(gate.freqInfo.freq * 2, audioContextRef.current.currentTime);
              gain.gain.setValueAtTime(0.06, audioContextRef.current.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.001, audioContextRef.current.currentTime + 0.35);
              osc.connect(gain);
              gain.connect(audioContextRef.current.destination);
              osc.start();
              osc.stop(audioContextRef.current.currentTime + 0.4);
            }
          }
        }
      });

      // Filter passed or offscreen gates
      state.gates = state.gates.filter(gate => gate.x > -50);

      // 7. Draw Ship (Glowing Delta Vector)
      const shipX = 100;
      const shipY = state.shipY;

      ctx.shadowBlur = 15;
      ctx.shadowColor = '#00f2ff';
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(shipX + 18, shipY);
      ctx.lineTo(shipX - 10, shipY - 10);
      ctx.lineTo(shipX - 4, shipY);
      ctx.lineTo(shipX - 10, shipY + 10);
      ctx.closePath();
      ctx.fill();

      // Exhaust flame particles
      ctx.fillStyle = 'rgba(255, 112, 0, 0.75)';
      ctx.beginPath();
      ctx.arc(shipX - 12 - Math.random() * 8, shipY, 3 + Math.random() * 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;

      // 8. Draw HUD parameters
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(10, 10, 240, 65);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.strokeRect(10, 10, 240, 65);

      ctx.font = 'bold 11px "Orbitron", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.fillText(`GALACTIC SCORE: ${state.score}`, 20, 28);
      ctx.fillStyle = 'var(--primary-glow)';
      ctx.fillText(`CURRENT FREQUENCY: ${detectedHz > 0 ? Math.round(detectedHz) + ' Hz' : 'No Input'}`, 20, 46);
      ctx.fillStyle = 'var(--text-dim)';
      ctx.fillText(`NAVIGATION: ${useSlider ? 'SANDBOX SLIDER' : 'LIVE VOICE MIC'}`, 20, 64);

      if (isPlaying && !gameOver) {
        animationId = requestAnimationFrame(gameLoop);
      }
    };

    if (isPlaying) {
      animationId = requestAnimationFrame(gameLoop);
    }

    return () => cancelAnimationFrame(animationId);
  }, [isPlaying, useSlider, manualPitch, gameOver]);

  return (
    <div className="screen-wrapper">
      <div className="floating-notes">🚀</div>
      <h1 className="suspended-title">Space Journey Vocal Arcade</h1>

      <div className="glass-panel" style={{ maxWidth: '820px', margin: '0 auto', textAlign: 'center' }}>
        {!isPlaying && !gameOver ? (
          <div style={{ padding: '30px 10px' }}>
            <h2 style={{ color: '#fff', marginBottom: '10px' }}>🌌 Ready for Vocal Orbit?</h2>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.95rem', maxWidth: '520px', margin: '0 auto 20px auto', lineHeight: '1.5' }}>
              Modulate your voice pitch to steer the spacecraft. Sing higher frequencies to fly UP, lower frequencies to glide DOWN. Align with the glowing Solfeggio Gates!
            </p>
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
              <button className="glowing-button" onClick={startMic}>
                🎙️ Calibrate Mic & Launch
              </button>
              <button className="glowing-button secondary" onClick={() => { setUseSlider(true); startMic(); }}>
                🎮 Use Sandbox Keyboard/Slider
              </button>
            </div>
            <button className="glowing-button secondary" onClick={() => navigate('Home')} style={{ marginTop: '12px' }}>
              ◀ Return to Nexus
            </button>
          </div>
        ) : isPlaying ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', padding: '0 5px' }}>
              <div style={{ textAlign: 'left' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>Cosmic Calibration Wavelength</span>
                <h3 style={{ margin: 0, color: '#fff' }}>Solfeggio Orbit Matcher</h3>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>Remaining Flight Time</span>
                <h3 style={{ margin: 0, color: 'var(--secondary-glow)' }}>⏱️ {gameTimer}s</h3>
              </div>
            </div>

            <canvas
              ref={canvasRef}
              width="800"
              height="400"
              style={{
                width: '100%',
                maxHeight: '400px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 8px 32px 0 rgba(0,0,0,0.37)'
              }}
            />

            <div style={{ marginTop: '15px', background: 'rgba(255,255,255,0.02)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ textAlign: 'left' }}>
                  <strong style={{ fontSize: '0.85rem', color: '#fff', display: 'block' }}>🕹️ Flight Sandbox Controllers</strong>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Use Up/Down Arrow keys or the slider to bypass mic input</span>
                </div>
                <button
                  className={`daw-track-btn ${useSlider ? 'active' : ''}`}
                  onClick={() => setUseSlider(!useSlider)}
                  style={{ fontSize: '0.72rem', margin: 0 }}
                >
                  {useSlider ? 'SANDBOX ACTIVE' : 'ACTIVATE SANDBOX'}
                </button>
              </div>

              {useSlider && (
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginTop: '10px' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>Low (100Hz)</span>
                  <input
                    type="range"
                    min="100"
                    max="600"
                    value={manualPitch}
                    onChange={e => setManualPitch(Number(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <span style={{ fontSize: '0.78rem', color: 'var(--primary-glow)' }}>High (600Hz) - {manualPitch}Hz</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ padding: '30px 10px' }}>
            <span style={{ fontSize: '2.5rem' }}>🚀</span>
            <h2 style={{ color: '#fff', margin: '10px 0 5px 0' }}>Flight Completed!</h2>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>You navigated the starship safely back to coordinates.</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', maxWidth: '360px', margin: '20px auto' }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', display: 'block' }}>GATES CLEARED</span>
                <strong style={{ fontSize: '1.6rem', color: 'var(--primary-glow)' }}>{score}</strong>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', display: 'block' }}>COINS EARNED</span>
                <strong style={{ fontSize: '1.6rem', color: 'var(--secondary-glow)' }}>💰 +{coinsEarned}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button className="glowing-button" onClick={startMic}>
                🔁 Re-Launch Flight
              </button>
              <button className="glowing-button secondary" onClick={() => navigate('Home')}>
                ◀ Return to Nexus
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VocalArcade;
