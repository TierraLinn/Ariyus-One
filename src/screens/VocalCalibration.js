import React, { useState, useEffect, useRef } from 'react';
import { calculateVocalSignature, getPitchFromAudioData, getFormantsFromSpectrum } from '../utils/vocalDSP';

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

  // Live real-time analysis parameters states
  const [liveFormants, setLiveFormants] = useState([520, 1540, 2480]);
  const [liveJitter, setLiveJitter] = useState(0);
  const [liveShimmer, setLiveShimmer] = useState(0);
  const [liveHnr, setLiveHnr] = useState(0);
  const [sandboxVoiceType, setSandboxVoiceType] = useState('Alto');

  // Voice recording & playback states
  const [vocalSampleUrl, setVocalSampleUrl] = useState('');
  const [isPlayingSample, setIsPlayingSample] = useState(false);
  
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const streamRef = useRef(null);

  const calibRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  const playbackAudioRef = useRef(null);
  const playbackCanvasRef = useRef(null);
  const playbackAudioCtxRef = useRef(null);
  const playbackAnalyserRef = useRef(null);
  const playbackAnimIdRef = useRef(null);

  // Animated canvases references
  const calibrationCanvasRef = useRef(null);
  const biofieldCanvasRef = useRef(null);

  const startCalibration = async (sandbox = false) => {
    setErrorMessage('');
    setPitchHistory([]);
    setAmplitudeHistory([]);
    setCountdown(5.0);
    setProgress(0);
    setCalibratedSignature(null);
    setVocalSampleUrl('');
    setIsPlayingSample(false);
    recordedChunksRef.current = [];

    if (sandbox) {
      setIsSandbox(true);
      const types = ['Baritone', 'Tenor', 'Alto', 'Soprano'];
      const chosen = types[Math.floor(Math.random() * types.length)];
      setSandboxVoiceType(chosen);
      setCalibrating(true);
      return;
    }

    setIsSandbox(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          latency: 0.005
        }, 
        video: false 
      });
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

      // Start capturing audio chunks for signature verification
      const recorder = new MediaRecorder(stream);
      calibRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setVocalSampleUrl(url);
      };
      recorder.start();

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
        // Generate simulated pitch values based on sandboxVoiceType
        let base = 220; // Alto
        let formantsBase = [520, 1540, 2480];
        if (sandboxVoiceType === 'Baritone') {
          base = 110;
          formantsBase = [390, 1200, 2100];
        } else if (sandboxVoiceType === 'Tenor') {
          base = 160;
          formantsBase = [450, 1350, 2280];
        } else if (sandboxVoiceType === 'Soprano') {
          base = 310;
          formantsBase = [680, 1850, 2810];
        }

        const jitterVal = (Math.random() - 0.5) * 4; // ±2Hz
        const simPitch = Math.round(base + jitterVal);
        const simAmp = 0.15 + Math.random() * 0.05;

        setLivePitch(simPitch);
        setPitchHistory(prev => [...prev, simPitch]);
        setAmplitudeHistory(prev => [...prev, simAmp]);

        // Live parameter simulation
        setLiveJitter(parseFloat((0.2 + Math.random() * 0.3).toFixed(2)));
        setLiveShimmer(parseFloat((0.3 + Math.random() * 0.4).toFixed(2)));
        setLiveHnr(Math.round(80 + Math.random() * 10));
        setLiveFormants([
          formantsBase[0] + Math.round((Math.random() - 0.5) * 10),
          formantsBase[1] + Math.round((Math.random() - 0.5) * 20),
          formantsBase[2] + Math.round((Math.random() - 0.5) * 30),
        ]);
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

          // Live formants peak extraction
          const formants = getFormantsFromSpectrum(ampData, audioCtxRef.current.sampleRate);
          setLiveFormants(formants);

          // Live rolling jitter estimation
          let diffSum = 0;
          const currentHistory = [...pitchHistory, pitch];
          for (let i = 1; i < currentHistory.length; i++) {
            diffSum += Math.abs(currentHistory[i] - currentHistory[i - 1]);
          }
          const jitterVal = currentHistory.length > 1 ? (diffSum / (currentHistory.length - 1)) / pitch : 0.05;
          setLiveJitter(parseFloat(Math.max(0.1, Math.min(2.0, jitterVal * 12)).toFixed(2)));

          // Live rolling shimmer estimation
          let ampDiffSum = 0;
          const currentAmps = [...amplitudeHistory, avgAmp];
          for (let i = 1; i < currentAmps.length; i++) {
            ampDiffSum += Math.abs(currentAmps[i] - currentAmps[i - 1]);
          }
          const shimmerVal = currentAmps.length > 1 ? (ampDiffSum / (currentAmps.length - 1)) / (avgAmp || 1) : 0.08;
          setLiveShimmer(parseFloat(Math.max(0.2, Math.min(3.0, shimmerVal * 10)).toFixed(2)));

          // Live HNR estimation
          const peakMag = Math.max(...ampData);
          const avgNoise = ampData.reduce((s, x) => s + x, 0) / ampData.length;
          const hnrVal = avgNoise > 0 ? 20 * Math.log10(peakMag / Math.max(1.0, avgNoise)) : 50;
          setLiveHnr(Math.round(Math.max(40, Math.min(95, hnrVal))));
        } else {
          setLivePitch(0);
        }
      }

      if (elapsed >= duration) {
        // End Calibration
        setCalibrating(false);
        clearInterval(trackingTimer);
        if (calibRecorderRef.current && calibRecorderRef.current.state !== 'inactive') {
          calibRecorderRef.current.stop();
        }
        stopAudioStream();
      }
    }, interval);

    return () => {
      clearInterval(trackingTimer);
    };
  }, [calibrating, isSandbox]);

  // Live calibration wave sphere visualizer loop
  useEffect(() => {
    if (!calibrating || !calibrationCanvasRef.current) return;
    const canvas = calibrationCanvasRef.current;
    const ctx = canvas.getContext('2d');
    let width = canvas.width = canvas.offsetWidth;
    let height = canvas.height = canvas.offsetHeight;

    const resizeObserver = new ResizeObserver(() => {
      if (canvas) {
        width = canvas.width = canvas.offsetWidth;
        height = canvas.height = canvas.offsetHeight;
      }
    });
    resizeObserver.observe(canvas);

    let animId;
    const drawLiveSphere = () => {
      animId = requestAnimationFrame(drawLiveSphere);
      ctx.fillStyle = 'rgba(6, 4, 30, 0.2)';
      ctx.fillRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      const t = Date.now() * 0.004;

      const activeSound = livePitch > 50;
      const baseRadius = 55 + (activeSound ? 15 : 0);
      const ampMod = activeSound ? 10 + Math.sin(t * 3) * 6 : 2;

      ctx.strokeStyle = '#00f2ff';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#00f2ff';
      ctx.lineWidth = 2.2;

      ctx.beginPath();
      const segments = 120;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        // Ripple spikes representing live frequency vibrations
        const offset = Math.sin(theta * (activeSound ? 8 : 4) + t) * ampMod + Math.cos(theta * 12 - t * 2) * (activeSound ? 4 : 1);
        const r = baseRadius + offset;
        const x = cx + Math.cos(theta) * r;
        const y = cy + Math.sin(theta) * r;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();

      // Secondary nested harmonics layer
      ctx.strokeStyle = 'rgba(255, 0, 193, 0.4)';
      ctx.shadowColor = 'rgba(255, 0, 193, 0.4)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const offset = Math.cos(theta * 5 - t * 1.5) * (ampMod * 0.6);
        const r = (baseRadius * 0.72) + offset;
        const x = cx + Math.cos(theta) * r;
        const y = cy + Math.sin(theta) * r;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.shadowBlur = 0;
    };

    drawLiveSphere();

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
    };
  }, [calibrating, livePitch]);

  // Voice Signature Biofield Mandala Canvas Animation
  useEffect(() => {
    if (!calibratedSignature || !biofieldCanvasRef.current) return;
    const canvas = biofieldCanvasRef.current;
    const ctx = canvas.getContext('2d');
    let width = canvas.width = canvas.offsetWidth;
    let height = canvas.height = canvas.offsetHeight;

    const resizeObserver = new ResizeObserver(() => {
      if (canvas) {
        width = canvas.width = canvas.offsetWidth;
        height = canvas.height = canvas.offsetHeight;
      }
    });
    resizeObserver.observe(canvas);

    let animId;
    const drawBiofieldGeometry = () => {
      animId = requestAnimationFrame(drawBiofieldGeometry);
      ctx.fillStyle = 'rgba(6, 4, 30, 0.2)';
      ctx.fillRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      const t = Date.now() * 0.0008;

      const { averagePitch, stability, hnr } = calibratedSignature;

      // Determine glow chakra color based on vocal type
      let color = '#00f2ff'; // Tenor (Cyan)
      if (averagePitch < 130) color = '#ff3b30'; // Baritone (Red)
      else if (averagePitch < 180) color = '#00ff87'; // Tenor (Green)
      else if (averagePitch < 250) color = '#00f2ff'; // Alto (Blue)
      else color = '#b200ff'; // Soprano (Violet)

      ctx.strokeStyle = color;
      ctx.shadowBlur = 8;
      ctx.shadowColor = color;
      ctx.lineWidth = 1.8;

      const segments = 180;
      const complexity = 2 + Math.floor(stability / 22); // stability dictates geometric lobes
      const radiusAmplifier = 12 + (hnr / 8);

      // Render glowing Lissajous voice mandala
      ctx.beginPath();
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const r = 50 + Math.sin(theta * complexity + t * 4) * radiusAmplifier + Math.cos(theta * 3.5 - t * 2) * 6;
        const x = cx + Math.cos(theta) * r;
        const y = cy + Math.sin(theta) * r;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();

      // Outer bounding alignment circle
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.shadowBlur = 0;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, 75, 0, Math.PI * 2);
      ctx.stroke();

      // Inner sacred geometry core
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy, 3 + Math.sin(t * 12) * 1.5, 0, Math.PI * 2);
      ctx.fill();
    };

    drawBiofieldGeometry();

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
    };
  }, [calibratedSignature]);

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

  const downloadCardAsSVG = () => {
    if (!calibratedSignature) return;
    
    const { vocalType, averagePitch, stability, jitter, hnr } = calibratedSignature;
    const chakraName = averagePitch < 130 ? 'Root (Muladhara)' : 
                       (averagePitch < 180 ? 'Heart (Anahata)' : 
                        (averagePitch < 250 ? 'Throat (Vishuddha)' : 'Crown (Sahasrara)'));
    const color = averagePitch < 130 ? '#ff3b30' : (averagePitch < 180 ? '#00ff87' : (averagePitch < 250 ? '#00f2ff' : '#b200ff'));

    const svgContent = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 300" width="500" height="300">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#02001a" />
      <stop offset="100%" stop-color="#070630" />
    </linearGradient>
  </defs>
  
  <rect x="10" y="10" width="480" height="280" rx="15" fill="url(#bgGrad)" stroke="${color}" stroke-width="2" />
  
  <circle cx="95" cy="150" r="60" fill="none" stroke="rgba(255,255,255,0.03)" stroke-width="1" />
  <circle cx="95" cy="150" r="45" fill="none" stroke="${color}" stroke-width="1.5" stroke-opacity="0.35" />
  <circle cx="95" cy="150" r="30" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="1" />
  <circle cx="95" cy="150" r="15" fill="none" stroke="${color}" stroke-width="1" stroke-opacity="0.5" />
  
  <line x1="95" y1="70" x2="95" y2="230" stroke="${color}" stroke-width="0.8" stroke-dasharray="2,2" stroke-opacity="0.3" />
  <line x1="15" y1="150" x2="175" y2="150" stroke="${color}" stroke-width="0.8" stroke-dasharray="2,2" stroke-opacity="0.3" />
  
  <text x="210" y="45" font-family="'Orbitron', sans-serif" font-size="14" fill="#00f2ff" font-weight="bold" letter-spacing="1.5">🧬 ARIYUS-ONE VOCAL ID</text>
  <line x1="210" y1="55" x2="460" y2="55" stroke="rgba(0,242,255,0.2)" stroke-width="1" />
  
  <text x="95" y="156" font-family="sans-serif" font-size="28" text-anchor="middle" fill="#fff">🎙️</text>
  
  <text x="210" y="85" font-family="'Rajdhani', sans-serif" font-size="11" fill="#a0a5cf" font-weight="500">VOCAL RANGE</text>
  <text x="210" y="105" font-family="'Orbitron', sans-serif" font-size="16" fill="#fff" font-weight="700">${vocalType}</text>
  
  <text x="350" y="85" font-family="'Rajdhani', sans-serif" font-size="11" fill="#a0a5cf" font-weight="500">DOMINANT HERTZ</text>
  <text x="350" y="105" font-family="'Orbitron', sans-serif" font-size="16" fill="${color}" font-weight="700">${averagePitch} Hz</text>
  
  <text x="210" y="145" font-family="'Rajdhani', sans-serif" font-size="11" fill="#a0a5cf" font-weight="500">PITCH STABILITY</text>
  <text x="210" y="165" font-family="'Rajdhani', sans-serif" font-size="13" fill="#fff" font-weight="bold">${stability}% (${jitter} ms)</text>
  
  <text x="350" y="145" font-family="'Rajdhani', sans-serif" font-size="11" fill="#a0a5cf" font-weight="500">HNR CLARITY</text>
  <text x="350" y="165" font-family="'Rajdhani', sans-serif" font-size="13" fill="#fff" font-weight="bold">${hnr} dB</text>
  
  <line x1="210" y1="190" x2="460" y2="190" stroke="rgba(255,255,255,0.06)" stroke-width="1" />
  
  <text x="210" y="215" font-family="'Rajdhani', sans-serif" font-size="11" fill="#a0a5cf" font-weight="500">CHAKRA ALIGNMENT</text>
  <text x="210" y="235" font-family="'Orbitron', sans-serif" font-size="13" fill="${color}" font-weight="700">${chakraName}</text>
  
  <text x="470" y="275" font-family="'Orbitron', sans-serif" font-size="8" fill="rgba(255,255,255,0.25)" text-anchor="end" letter-spacing="1">BIO-RESONANCE ALIGNMENT SECURED</text>
</svg>
    `.trim();

    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ariyus_vocal_id_${vocalType.toLowerCase()}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

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
    navigate('SongLibrary');
  };

  // Playback sample logic with canvas animation
  const togglePlaySample = () => {
    if (isPlayingSample) {
      if (playbackAudioRef.current) {
        playbackAudioRef.current.pause();
      }
      setIsPlayingSample(false);
      if (playbackAnimIdRef.current) {
        cancelAnimationFrame(playbackAnimIdRef.current);
      }
    } else {
      setIsPlayingSample(true);
      
      if (isSandbox || !vocalSampleUrl) {
        // Sandbox simulator - synthesise Solfeggio frequency hum on the fly
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioContext();
        playbackAudioCtxRef.current = ctx;

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        playbackAnalyserRef.current = analyser;

        const osc = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.frequency.setValueAtTime(220, ctx.currentTime);
        osc2.frequency.setValueAtTime(440, ctx.currentTime);
        gainNode.gain.setValueAtTime(0.12, ctx.currentTime);

        osc.connect(analyser);
        osc2.connect(analyser);
        analyser.connect(ctx.destination);

        osc.start();
        osc2.start();

        setTimeout(() => {
          osc.stop();
          osc2.stop();
          ctx.close();
          setIsPlayingSample(false);
          if (playbackAnimIdRef.current) {
            cancelAnimationFrame(playbackAnimIdRef.current);
          }
        }, 5000);

        startPlaybackVisualizer();
      } else {
        // Play real recorded voice sample
        const audio = new Audio(vocalSampleUrl);
        playbackAudioRef.current = audio;

        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioContext();
        playbackAudioCtxRef.current = ctx;

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        playbackAnalyserRef.current = analyser;

        const source = ctx.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(ctx.destination);

        audio.play().catch(err => {
          console.error("Calibration playback failed:", err);
          setIsPlayingSample(false);
        });

        audio.onended = () => {
          setIsPlayingSample(false);
          ctx.close();
          if (playbackAnimIdRef.current) {
            cancelAnimationFrame(playbackAnimIdRef.current);
          }
        };

        startPlaybackVisualizer();
      }
    }
  };

  const startPlaybackVisualizer = () => {
    setTimeout(() => {
      const canvas = playbackCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const width = canvas.width = canvas.offsetWidth;
      const height = canvas.height = canvas.offsetHeight;

      const draw = () => {
        playbackAnimIdRef.current = requestAnimationFrame(draw);

        ctx.fillStyle = 'rgba(6, 4, 30, 0.4)';
        ctx.fillRect(0, 0, width, height);

        const analyser = playbackAnalyserRef.current;
        if (analyser) {
          const bufferLength = analyser.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);
          analyser.getByteFrequencyData(dataArray);

          ctx.lineWidth = 2.5;
          ctx.strokeStyle = '#00f2ff';
          ctx.shadowBlur = 6;
          ctx.shadowColor = '#00f2ff';

          const barWidth = (width / bufferLength) * 1.5;
          let x = 0;

          ctx.beginPath();
          for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 255.0;
            const y = height - (v * height * 0.95);

            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
            x += barWidth;
          }
          ctx.stroke();
          ctx.shadowBlur = 0;
        } else {
          // Fallback sinewave loop
          ctx.lineWidth = 1.8;
          ctx.strokeStyle = '#00f2ff';
          ctx.beginPath();
          const t = Date.now() * 0.005;
          for (let x = 0; x < width; x++) {
            const y = height / 2 + Math.sin(x * 0.08 + t) * 8;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      };

      draw();
    }, 50);
  };

  // Clean up all running loops/audio on unmount
  useEffect(() => {
    return () => {
      if (playbackAudioRef.current) {
        playbackAudioRef.current.pause();
      }
      if (playbackAnimIdRef.current) {
        cancelAnimationFrame(playbackAnimIdRef.current);
      }
      if (playbackAudioCtxRef.current && playbackAudioCtxRef.current.state !== 'closed') {
        playbackAudioCtxRef.current.close();
      }
    };
  }, []);

  return (
    <div className="screen-wrapper">
      <div className="floating-notes">🧬</div>
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

            {/* Glowing Live Calibration Resonator Sphere Canvas */}
            <div style={{ position: 'relative', width: '220px', height: '220px', margin: '20px auto', borderRadius: '50%', overflow: 'hidden', border: '1px solid rgba(0,242,255,0.12)' }}>
              <canvas ref={calibrationCanvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '1.45rem', fontFamily: 'monospace', color: 'var(--primary-glow)', textShadow: '0 0 8px var(--primary-glow)', fontWeight: 'bold' }}>
                {livePitch > 0 ? `${livePitch} Hz` : 'Scanning...'}
              </div>
            </div>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '12px',
              maxWidth: '480px',
              margin: '20px auto 0',
              padding: '15px',
              background: 'rgba(0,0,0,0.22)',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.06)',
              textAlign: 'left'
            }}>
              <div>
                <span style={{ color: 'var(--text-dim)', fontSize: '0.68rem', textTransform: 'uppercase', display: 'block' }}>Vocal Tract Formants</span>
                <strong style={{ color: '#00f2ff', fontSize: '0.88rem' }}>
                  F1: {liveFormants[0]}Hz | F2: {liveFormants[1]}Hz | F3: {liveFormants[2]}Hz
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-dim)', fontSize: '0.68rem', textTransform: 'uppercase', display: 'block' }}>Vocal Stability (Jitter)</span>
                <strong style={{ color: '#00ff87', fontSize: '0.88rem' }}>
                  {liveJitter > 0 ? `${liveJitter}%` : 'Analyzing...'}
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-dim)', fontSize: '0.68rem', textTransform: 'uppercase', display: 'block' }}>Vibrato Depth (Shimmer)</span>
                <strong style={{ color: 'var(--secondary-glow)', fontSize: '0.88rem' }}>
                  {liveShimmer > 0 ? `${liveShimmer}%` : 'Analyzing...'}
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-dim)', fontSize: '0.68rem', textTransform: 'uppercase', display: 'block' }}>Overtone Clarity (HNR)</span>
                <strong style={{ color: '#fff', fontSize: '0.88rem' }}>
                  {liveHnr > 0 ? `${liveHnr} dB` : 'Analyzing...'}
                </strong>
              </div>
            </div>
            
            <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginTop: '15px' }}>
              Keep your vocal tone as steady and constant as possible.
            </p>
          </div>
        )}

        {calibratedSignature && (
          <div style={{ marginTop: '25px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Holographic Voice ID Signature Card */}
            <div className="voice-card glass-panel" style={{
              width: '100%',
              maxWidth: '520px',
              margin: '0 auto 20px',
              borderColor: calibratedSignature.averagePitch < 130 ? '#ff3b30' : (calibratedSignature.averagePitch < 180 ? '#00ff87' : (calibratedSignature.averagePitch < 250 ? '#00f2ff' : '#b200ff')),
              boxShadow: `0 0 25px ${calibratedSignature.averagePitch < 130 ? 'rgba(255,59,48,0.25)' : (calibratedSignature.averagePitch < 180 ? 'rgba(0,255,135,0.25)' : (calibratedSignature.averagePitch < 250 ? 'rgba(0,242,255,0.25)' : 'rgba(178,0,255,0.25)'))}`,
              position: 'relative',
              padding: '20px'
            }}>
              <h3 style={{ margin: 0, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px', color: 'var(--primary-glow)', textTransform: 'uppercase', fontSize: '0.9rem', letterSpacing: '1px' }}>
                🧬 Voice ID Signature Card
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1.7fr', gap: '20px', marginTop: '20px', alignItems: 'center' }}>
                {/* Left Side: Dynamic Biofield Mandala Visualizer */}
                <div style={{ width: '100%', height: '170px', background: 'rgba(0,0,0,0.3)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)', position: 'relative', overflow: 'hidden' }}>
                  <canvas ref={biofieldCanvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
                  <span style={{ position: 'absolute', bottom: '6px', left: '50%', transform: 'translateX(-50%)', fontSize: '0.58rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Resonance Biofield
                  </span>
                </div>

                {/* Right Side: Biomarker Details Dashboard */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 15px', fontSize: '0.85rem', textAlign: 'left' }}>
                  <div>
                    <span style={{ color: 'var(--text-dim)', display: 'block', fontSize: '0.72rem', textTransform: 'uppercase' }}>Vocal Range</span>
                    <strong style={{ color: '#fff', fontSize: '1.08rem' }}>{calibratedSignature.vocalType}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-dim)', display: 'block', fontSize: '0.72rem', textTransform: 'uppercase' }}>Dominant Hz</span>
                    <strong style={{ color: 'var(--primary-glow)', fontSize: '1.08rem' }}>{calibratedSignature.averagePitch} Hz</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-dim)', display: 'block', fontSize: '0.72rem', textTransform: 'uppercase' }}>Stability (Jitter)</span>
                    <strong style={{ color: '#fff' }}>{calibratedSignature.stability}% ({calibratedSignature.jitter} ms)</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-dim)', display: 'block', fontSize: '0.72rem', textTransform: 'uppercase' }}>HNR Clarity</span>
                    <strong style={{ color: '#fff' }}>{calibratedSignature.hnr} dB</strong>
                  </div>
                  <div style={{ gridColumn: 'span 2', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '8px', marginTop: '4px' }}>
                    <span style={{ color: 'var(--text-dim)', display: 'block', fontSize: '0.72rem', textTransform: 'uppercase' }}>Chakra Alignment</span>
                    <strong style={{ 
                      color: calibratedSignature.averagePitch < 130 ? '#ff3b30' : (calibratedSignature.averagePitch < 180 ? '#00ff87' : (calibratedSignature.averagePitch < 250 ? '#00f2ff' : '#b200ff')), 
                      fontSize: '0.88rem' 
                    }}>
                      {calibratedSignature.averagePitch < 130 ? '🔴 Root (Muladhara) Grounding' : 
                       (calibratedSignature.averagePitch < 180 ? '🟢 Heart (Anahata) Coherence' : 
                        (calibratedSignature.averagePitch < 250 ? '🔵 Throat (Vishuddha) Expression' : '🟣 Crown (Sahasrara) Intuition'))}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Playback verification sample card */}
              <div style={{ marginTop: '20px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '12px' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block', marginBottom: '8px', textAlign: 'left' }}>
                  🔊 Playback Verification Track
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <button 
                    onClick={togglePlaySample} 
                    className="glowing-button" 
                    style={{ margin: 0, padding: '8px 16px', fontSize: '0.72rem', flexShrink: 0 }}
                  >
                    {isPlayingSample ? '⏸ Pause Vocal' : '⏵ Listen Vocal'}
                  </button>
                  <canvas 
                    ref={playbackCanvasRef} 
                    style={{ width: '100%', height: '32px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)', display: 'block' }} 
                  />
                </div>
              </div>

              <div style={{ marginTop: '20px', padding: '10px', background: 'rgba(0, 242, 255, 0.03)', borderRadius: '8px', border: '1px solid rgba(0, 242, 255, 0.1)', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                Vocal signature calibration computed and locked to local database node.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '15px', width: '100%', maxWidth: '520px', justifyContent: 'center', marginTop: '10px' }}>
              <button className="glowing-button secondary" onClick={downloadCardAsSVG} style={{ margin: 0, flex: 1 }}>
                💾 Download Voice Card (SVG)
              </button>
              <button className="glowing-button" onClick={saveSignature} style={{ margin: 0, flex: 1 }}>
                ✓ Save & Enter Studio
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VocalCalibration;
