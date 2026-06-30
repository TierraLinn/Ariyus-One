import React, { useState, useEffect, useRef } from 'react';
import { calculateVocalSignature, getPitchFromAudioData } from '../utils/vocalDSP';

const VocalCalibration = ({ navigate, userData, setUserData, isFirebaseConfigured, auth, db }) => {
  const [calibrating, setCalibrating] = useState(false);
  const [countdown, setCountdown] = useState(5.0);
  const [livePitch, setLivePitch] = useState(0);
  const [progress, setProgress] = useState(0);
  const [pitchHistory, setPitchHistory] = useState([]);
  const [amplitudeHistory, setAmplitudeHistory] = useState([]);
  const [calibratedSignature, setCalibratedSignature] = useState(null);
  const [isSandbox, setIsSandbox] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const streamRef = useRef(null);

  const startCalibration = async (sandbox = false) => {
    setErrorMessage('');
    setPitchHistory([]);
    setAmplitudeHistory([]);
    setCountdown(5.0);
    setProgress(0);
    setCalibratedSignature(null);

    if (sandbox) {
      setIsSandbox(true);
      setCalibrating(true);
      return;
    }

    setIsSandbox(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;

      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      sourceRef.current = source;

      setCalibrating(true);
    } catch (err) {
      console.warn("Microphone access denied or unavailable, auto-falling back to Sandbox Simulator:", err);
      setErrorMessage("Microphone access blocked. Running in sandbox simulation mode.");
      setIsSandbox(true);
      setCalibrating(true);
    }
  };

  // Calibration loop
  useEffect(() => {
    if (!calibrating) return;

    let startTime = Date.now();
    const duration = 5000; // 5 seconds
    const interval = 100; // 100ms updates

    const trackingTimer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const percent = Math.min(100, (elapsed / duration) * 100);
      const remaining = Math.max(0, 5.0 - elapsed / 1000);

      setProgress(percent);
      setCountdown(remaining);

      if (isSandbox) {
        // Generate simulated pitch values around A3/A4 with micro-jitter
        const base = 220; // 220Hz (Alto baseline)
        const jitterVal = (Math.random() - 0.5) * 6; // ±3Hz
        const simPitch = Math.round(base + jitterVal);
        const simAmp = 0.15 + Math.random() * 0.1;

        setLivePitch(simPitch);
        setPitchHistory(prev => [...prev, simPitch]);
        setAmplitudeHistory(prev => [...prev, simAmp]);
      } else if (analyserRef.current && audioCtxRef.current) {
        const bufferLength = analyserRef.current.fftSize;
        const dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteTimeDomainData(dataArray);

        const pitch = getPitchFromAudioData(dataArray, audioCtxRef.current.sampleRate);
        const ampData = new Uint8Array(bufferLength);
        analyserRef.current.getByteFrequencyData(ampData);
        const avgAmp = ampData.reduce((acc, v) => acc + v, 0) / (bufferLength * 255);

        if (pitch > 50 && pitch < 1200) {
          setLivePitch(Math.round(pitch));
          setPitchHistory(prev => [...prev, pitch]);
          setAmplitudeHistory(prev => [...prev, avgAmp]);
        } else {
          setLivePitch(0);
        }
      }

      if (elapsed >= duration) {
        // End Calibration
        setCalibrating(false);
        clearInterval(trackingTimer);
        stopAudioStream();
      }
    }, interval);

    return () => {
      clearInterval(trackingTimer);
    };
  }, [calibrating, isSandbox]);

  const stopAudioStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close();
    }
  };

  // Compile signature once calibration completes
  useEffect(() => {
    if (!calibrating && progress >= 100 && pitchHistory.length > 0) {
      const sig = calculateVocalSignature(pitchHistory, amplitudeHistory);
      setCalibratedSignature(sig);
    }
  }, [calibrating, progress, pitchHistory, amplitudeHistory]);

  const saveSignature = () => {
    if (!calibratedSignature) return;

    const updatedProfile = {
      ...userData,
      isCalibrated: true,
      voiceSignature: calibratedSignature,
      tier: userData?.tier || 'Free',
      xp: userData?.xp || 120,
      displayName: userData?.displayName || 'Resonant Singer'
    };

    setUserData(updatedProfile);
    localStorage.setItem('ariyus_local_user', JSON.stringify(updatedProfile));
    
    alert("Vocal Signature saved successfully! Proceeding to Home Nexus.");
    navigate('Home');
  };

  return (
    <div className="screen-wrapper">
      <h1 className="suspended-title">Vocal Calibration</h1>
      
      <div className="glass-panel" style={{ textAlign: 'center' }}>
        <h2>Welcome to Ariyus-One</h2>
        <p style={{ color: 'var(--text-dim)', marginBottom: '20px', lineHeight: '1.5' }}>
          To establish your custom identity inside the network, we need to calibrate your voice. 
          This creates your initial **Vocal Signature Card** mapping your range, stability, and HNR overtones.
        </p>

        {errorMessage && (
          <div style={{ color: 'var(--secondary-glow)', fontSize: '0.85rem', margin: '10px 0', fontStyle: 'italic' }}>
            ⚠️ {errorMessage}
          </div>
        )}

        {!calibrating && !calibratedSignature && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
            <button className="glowing-button" onClick={() => startCalibration(false)}>
              🎙️ Start Live Mic Calibration
            </button>
            <button className="glowing-button secondary" onClick={() => startCalibration(true)}>
              🤖 Sandbox Calibration Simulator
            </button>
          </div>
        )}

        {calibrating && (
          <div style={{ padding: '20px 0' }}>
            <h3 style={{ textShadow: '0 0 10px var(--primary-glow)', fontSize: '1.5rem', marginBottom: '10px' }}>
              {countdown > 0 ? `Sustain an "Ah" vowel: ${countdown.toFixed(1)}s` : 'Analyzing Overtones...'}
            </h3>
            
            <div className="progress-track" style={{ height: '14px', maxWidth: '400px', margin: '15px auto' }}>
              <div className="progress-fill" style={{ width: `${progress}%`, background: 'var(--primary-glow)' }} />
            </div>

            <div style={{ fontSize: '1.8rem', fontFamily: 'monospace', color: 'var(--primary-glow)', textShadow: '0 0 8px var(--primary-glow)' }}>
              {livePitch > 0 ? `${livePitch} Hz` : 'Scanning Input...'}
            </div>
            
            <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginTop: '10px' }}>
              Keep your vocal tone as steady and constant as possible.
            </p>
          </div>
        )}

        {calibratedSignature && (
          <div style={{ marginTop: '25px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="voice-card glass-panel" style={{
              width: '100%',
              maxWidth: '480px',
              margin: '0 auto 20px',
              borderColor: 'var(--primary-glow)',
              boxShadow: '0 0 20px rgba(0, 242, 255, 0.2)',
              position: 'relative'
            }}>
              <h3 style={{ margin: 0, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px', color: 'var(--primary-glow)' }}>
                🧬 Voice ID Signature Card
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '15px', fontSize: '0.9rem' }}>
                <div>
                  <span style={{ color: 'var(--text-dim)', display: 'block', fontSize: '0.75rem' }}>Vocal Type Range</span>
                  <strong style={{ color: '#fff', fontSize: '1.1rem' }}>{calibratedSignature.vocalType}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-dim)', display: 'block', fontSize: '0.75rem' }}>Average Frequency</span>
                  <strong style={{ color: 'var(--primary-glow)', fontSize: '1.1rem' }}>{calibratedSignature.averagePitch} Hz</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-dim)', display: 'block', fontSize: '0.75rem' }}>Stability (Jitter)</span>
                  <strong style={{ color: '#fff' }}>{calibratedSignature.stability}% ({calibratedSignature.jitter} ms)</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-dim)', display: 'block', fontSize: '0.75rem' }}>Resonance Clarity (HNR)</span>
                  <strong style={{ color: '#fff' }}>{calibratedSignature.hnr} dB</strong>
                </div>
              </div>

              <div style={{ marginTop: '20px', padding: '10px', background: 'rgba(0, 242, 255, 0.05)', borderRadius: '8px', border: '1px solid rgba(0, 242, 255, 0.15)', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                Vocal signature calibration computed and locked to local database node.
              </div>
            </div>

            <button className="glowing-button" onClick={saveSignature} style={{ width: '100%', maxWidth: '320px' }}>
              ✓ Save Signature & Enter Studio
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default VocalCalibration;
