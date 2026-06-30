import React, { useState, useEffect, useRef } from 'react';
import { getPitchFromAudioData } from '../utils/vocalDSP';

const CHALLENGES = [
  {
    id: 'major_scale',
    title: 'Major Scale Warmup (Do-Re-Mi)',
    desc: 'Hit each step of the C major diatonic scale in sequence.',
    steps: [
      { note: 'C4', freq: 261.6, label: 'Do (Root stabilizer)' },
      { note: 'D4', freq: 293.7, label: 'Re (Sacral flow)' },
      { note: 'E4', freq: 329.6, label: 'Mi (Solar intent)' },
      { note: 'F4', freq: 349.2, label: 'Fa (Heart awakening)' },
      { note: 'G4', freq: 392.0, label: 'Sol (Throat expression)' },
      { note: 'A4', freq: 440.0, label: 'La (Third-eye insight)' },
      { note: 'B4', freq: 493.9, label: 'Ti (Crown connection)' },
      { note: 'C5', freq: 523.3, label: 'Do (Higher octave resonance)' }
    ]
  },
  {
    id: 'solfeggio_miracle',
    title: 'Solfeggio Miracle Bed (528Hz)',
    desc: 'Hold a steady sustained 528Hz tone to align throat chakra cells.',
    steps: [
      { note: '528Hz', freq: 528.0, label: 'Sustained DNA Miracle Resonance (Hold for 5s)' }
    ]
  },
  {
    id: 'chakra_align',
    title: 'Chakra Vowel Sequencing',
    desc: 'Sing key vowel tones linked directly to sacred energy nodes.',
    steps: [
      { note: 'C4', freq: 261.6, label: 'Root Chakra - Vowel: /u/ (Oo)' },
      { note: 'E4', freq: 329.6, label: 'Solar Plexus - Vowel: /o/ (Oh)' },
      { note: 'G4', freq: 392.0, label: 'Heart Center - Vowel: /a/ (Ah)' },
      { note: 'B4', freq: 493.9, label: 'Crown Gateway - Vowel: /i/ (Ee)' }
    ]
  }
];

const VocalCoach = ({ navigate, userData, setUserData }) => {
  const [selectedChallenge, setSelectedChallenge] = useState(CHALLENGES[0]);
  const [active, setActive] = useState(false);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [livePitch, setLivePitch] = useState(0);
  const [holdTime, setHoldTime] = useState(0); // time holding correct note in ms
  const [feedback, setFeedback] = useState('Select warmup and click Begin.');
  const [isSandbox, setIsSandbox] = useState(false);
  const [completed, setCompleted] = useState(false);

  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const lastTimeRef = useRef(null);

  const targetFreq = selectedChallenge.steps[currentStepIdx]?.freq || 261.6;
  const targetNote = selectedChallenge.steps[currentStepIdx]?.note || 'C4';
  const targetLabel = selectedChallenge.steps[currentStepIdx]?.label || '';

  const startCoach = async (sandbox = false) => {
    setActive(true);
    setCompleted(false);
    setCurrentStepIdx(0);
    setHoldTime(0);
    setLivePitch(0);
    setFeedback('Calibrating vocal coach nodes...');
    
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
      
      setFeedback('Sing the target note shown below!');
    } catch (err) {
      console.warn("Microphone access blocked. Running sandbox simulator coach:", err);
      setIsSandbox(true);
      setFeedback('Microphone blocked. Sandbox Coach Simulator active.');
    }
  };

  const stopCoach = () => {
    setActive(false);
    setLivePitch(0);
    setHoldTime(0);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close();
    }
    setFeedback('Coach suspended.');
  };

  // Coaching loop
  useEffect(() => {
    if (!active || completed) return;

    let animId;
    lastTimeRef.current = Date.now();

    const checkPitchLoop = () => {
      const now = Date.now();
      const delta = now - lastTimeRef.current;
      lastTimeRef.current = now;

      let currentPitch = 0;

      if (isSandbox) {
        // Mock Pitch: Slowly converges to target frequency with slight error
        const randomFactor = Math.sin(now * 0.003) * 12;
        currentPitch = Math.round(targetFreq + randomFactor);
      } else if (analyserRef.current && audioCtxRef.current) {
        const bufferLength = analyserRef.current.fftSize;
        const dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteTimeDomainData(dataArray);

        const pitch = getPitchFromAudioData(dataArray, audioCtxRef.current.sampleRate);
        if (pitch > 50 && pitch < 1200) {
          currentPitch = pitch;
        }
      }

      setLivePitch(Math.round(currentPitch));

      // Check alignment
      if (currentPitch > 0) {
        const diff = Math.abs(currentPitch - targetFreq);
        const margin = targetFreq * 0.04; // 4% frequency margin

        if (diff <= margin) {
          setHoldTime(prev => {
            const nextVal = prev + delta;
            // Need to hold for 1.5 seconds (or 5s if sustained solfeggio bed)
            const targetHold = selectedChallenge.id === 'solfeggio_miracle' ? 5000 : 1500;
            
            if (nextVal >= targetHold) {
              // Advance to next step
              if (currentStepIdx < selectedChallenge.steps.length - 1) {
                setCurrentStepIdx(c => c + 1);
                setFeedback(`🌟 Spot on! Moving to next step: ${selectedChallenge.steps[currentStepIdx + 1].note}`);
              } else {
                // Completed!
                setCompleted(true);
                setActive(false);
                setFeedback('🎉 Warmup Challenge Completed! You earned +50 XP!');
                localStorage.setItem('ariyus_coach_completed', 'true');
                // Award XP
                if (userData) {
                  const updatedXp = (userData.xp || 0) + 50;
                  const updatedProfile = { ...userData, xp: updatedXp };
                  setUserData(updatedProfile);
                  localStorage.setItem('ariyus_local_user', JSON.stringify(updatedProfile));
                }
              }
              return 0;
            }
            return nextVal;
          });
          setFeedback('🎯 Target matched! Keep holding standard frequency resonance...');
        } else {
          // Slowly decay hold time if off pitch
          setHoldTime(prev => Math.max(0, prev - delta * 0.5));
          if (currentPitch < targetFreq) {
            setFeedback('⬆️ Pitch too low! Push your vocals slightly higher.');
          } else {
            setFeedback('⬇️ Pitch too high! Drop your register slightly.');
          }
        }
      } else {
        setHoldTime(0);
        setFeedback('🎙️ Waiting for clear vocal vibration...');
      }

      animId = requestAnimationFrame(checkPitchLoop);
    };

    animId = requestAnimationFrame(checkPitchLoop);
    return () => cancelAnimationFrame(animId);
  }, [active, currentStepIdx, targetFreq, isSandbox, selectedChallenge, completed, userData, setUserData]);

  // Drawing Canvas Grid Guide
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width = canvas.parentElement.clientWidth || 400;
    const height = canvas.height = 150;

    let animFrame;

    const drawGrid = () => {
      ctx.fillStyle = '#06041c';
      ctx.fillRect(0, 0, width, height);

      // Draw target note line (centered vertically)
      const centerY = height / 2;
      ctx.strokeStyle = 'rgba(255, 0, 193, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Label target frequency
      ctx.fillStyle = 'var(--secondary-glow)';
      ctx.font = 'bold 9px "Orbitron", sans-serif';
      ctx.fillText(`TARGET NOTE: ${targetNote} (${targetFreq} Hz)`, 15, centerY - 6);

      // Draw live pitch line if active
      if (active && livePitch > 0) {
        // Calculate offset displacement from target frequency
        const maxOffset = 100; // max frequency delta visible on grid
        const deltaFreq = livePitch - targetFreq;
        const normalizedY = centerY - (deltaFreq / maxOffset) * (height / 2);
        const boundedY = Math.max(10, Math.min(height - 10, normalizedY));

        // Draw active user glowing indicator line
        const grad = ctx.createLinearGradient(0, boundedY, width, boundedY);
        grad.addColorStop(0, 'rgba(0, 242, 255, 0.05)');
        grad.addColorStop(0.7, 'rgba(0, 242, 255, 0.25)');
        grad.addColorStop(1, 'rgba(0, 242, 255, 1)');

        ctx.strokeStyle = grad;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, boundedY);
        ctx.lineTo(width - 25, boundedY);
        ctx.stroke();

        // Pulsing spark on target match
        const diff = Math.abs(livePitch - targetFreq);
        const isMatched = diff <= targetFreq * 0.04;
        
        ctx.shadowColor = isMatched ? 'var(--secondary-glow)' : 'var(--primary-glow)';
        ctx.shadowBlur = isMatched ? 15 : 8;
        ctx.fillStyle = isMatched ? '#fff' : 'var(--primary-glow)';
        ctx.beginPath();
        ctx.arc(width - 25, boundedY, isMatched ? 7 : 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0; // reset
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.font = 'normal 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Awaiting live vocal vibration input...', width / 2, height / 2 + 18);
        ctx.textAlign = 'left';
      }

      animFrame = requestAnimationFrame(drawGrid);
    };

    drawGrid();
    return () => cancelAnimationFrame(animFrame);
  }, [active, livePitch, targetFreq, targetNote]);

  const progressPct = active 
    ? Math.min(100, (holdTime / (selectedChallenge.id === 'solfeggio_miracle' ? 5000 : 1500)) * 100) 
    : 0;

  return (
    <div className="screen-wrapper">
      <h1 className="suspended-title">Tuning & Warmups</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', alignItems: 'start' }}>
        {/* Warmups selection */}
        <div className="glass-panel" style={{ margin: 0 }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '10px' }}>Select Coaching Module</h2>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: '15px' }}>
            Choose a warmup challenge below to start tuning your vocal cords to therapeutic frequencies.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {CHALLENGES.map(item => (
              <div 
                key={item.id} 
                className="draft-item"
                style={{ 
                  cursor: 'pointer',
                  borderColor: selectedChallenge.id === item.id ? 'var(--primary-glow)' : 'rgba(255,255,255,0.06)',
                  background: selectedChallenge.id === item.id ? 'rgba(0, 242, 255, 0.02)' : '',
                  padding: '12px',
                  borderRadius: '8px'
                }}
                onClick={() => {
                  if (active) stopCoach();
                  setSelectedChallenge(item);
                  setCurrentStepIdx(0);
                  setHoldTime(0);
                  setCompleted(false);
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '0.92rem', color: selectedChallenge.id === item.id ? 'var(--primary-glow)' : '#fff' }}>
                    {item.title}
                  </strong>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                    {item.steps.length} steps
                  </span>
                </div>
                <p style={{ color: 'var(--text-dim)', fontSize: '0.78rem', margin: '4px 0 0 0' }}>{item.desc}</p>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            {!active ? (
              <>
                <button className="glowing-button" onClick={() => startCoach(false)} style={{ flexGrow: 1, margin: 0, padding: '12px 0' }}>
                  🎙️ Begin Training
                </button>
                <button className="glowing-button secondary" onClick={() => startCoach(true)} style={{ margin: 0, padding: '12px 15px' }}>
                  ⚙️ Sandbox
                </button>
              </>
            ) : (
              <button className="glowing-button secondary" onClick={stopCoach} style={{ width: '100%', margin: 0, padding: '12px 0', borderColor: 'var(--secondary-glow)', color: 'var(--secondary-glow)' }}>
                ⏹️ Suspend Session
              </button>
            )}
          </div>
        </div>

        {/* Live coach feedback */}
        <div className="glass-panel" style={{ margin: 0, textAlign: 'center' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px' }}>Vocal Coach HUD</span>
          
          <div style={{ margin: '15px 0' }}>
            <div style={{ width: '100%', borderRadius: '8px', overflow: 'hidden' }}>
              <canvas ref={canvasRef} style={{ width: '100%', height: '150px', display: 'block' }} />
            </div>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.15)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '8px' }}>
              <span style={{ color: 'var(--primary-glow)', fontWeight: 'bold' }}>Active Target Step:</span>
              <strong style={{ color: '#fff' }}>Step {currentStepIdx + 1} of {selectedChallenge.steps.length}</strong>
            </div>

            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', margin: '4px 0' }}>
              🎯 Sing note: <span style={{ color: 'var(--secondary-glow)' }}>{targetNote} ({targetFreq} Hz)</span>
            </div>

            <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '12px' }}>
              {targetLabel}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '4px' }}>
              <span>Vocal Lock Hold Time</span>
              <span>{(holdTime / 1000).toFixed(1)}s / {(selectedChallenge.id === 'solfeggio_miracle' ? 5 : 1.5).toFixed(1)}s</span>
            </div>
            <div className="progress-track" style={{ height: '8px', marginBottom: '10px' }}>
              <div className="progress-fill" style={{ width: `${progressPct}%`, background: 'var(--secondary-glow)' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
              <div>
                <span style={{ fontSize: '0.62rem', color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block' }}>Live Frequency</span>
                <strong style={{ fontSize: '1rem', color: livePitch > 0 ? 'var(--primary-glow)' : 'var(--text-dim)' }}>
                  {livePitch > 0 ? `${livePitch} Hz` : '---'}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: '0.62rem', color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block' }}>Tuning Offset</span>
                <strong style={{ fontSize: '1rem', color: livePitch > 0 ? (Math.abs(livePitch - targetFreq) < targetFreq * 0.04 ? '#00ff66' : 'var(--secondary-glow)') : 'var(--text-dim)' }}>
                  {livePitch > 0 ? `${(livePitch - targetFreq).toFixed(0)} Hz` : '---'}
                </strong>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '15px', color: 'var(--text-dim)', fontSize: '0.8rem', padding: '8px', border: '1px solid var(--glass-border)', borderRadius: '6px', minHeight: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {feedback}
          </div>
        </div>
      </div>

      {completed && (
        <div className="glass-panel" style={{ marginTop: '20px', borderColor: '#00ff66', background: 'rgba(0, 255, 102, 0.03)', textAlign: 'center' }}>
          <h3 style={{ color: '#00ff66', margin: '0 0 8px 0' }}>🌟 Challenge Succeeded!</h3>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>
            Your frequency resonance matrix successfully matched the tuning targets of <strong>{selectedChallenge.title}</strong>. 
            You gained <strong>+50 XP</strong> towards level ascension!
          </p>
          <button className="glowing-button" onClick={() => navigate('Home')} style={{ marginTop: '15px', padding: '10px 24px' }}>
            Return to Dashboard
          </button>
        </div>
      )}
    </div>
  );
};

export default VocalCoach;
