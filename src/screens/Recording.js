import React, { useState, useEffect, useRef } from 'react';
import VoiceReactiveVisualizer from '../components/VoiceReactiveVisualizer';
import { getPitchFromAudioData } from '../utils/vocalDSP';

const RecordingStudio = ({ currentRecording, setCurrentRecording, navigate }) => {
  const song = currentRecording?.selectedSong;
  
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [livePitch, setLivePitch] = useState(0);
  const [playHum, setPlayHum] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('none');
  const [isVideoMode, setIsVideoMode] = useState(true);
  
  // Audio references
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const backingAudioRef = useRef(null);
  const humOscRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const streamRef = useRef(null);

  // Video references
  const videoRef = useRef(null);

  const [pitchHistory, setPitchHistory] = useState([]);
  const [lyricsLines, setLyricsLines] = useState([]);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);

  const [isMuted, setIsMuted] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const monitorGainRef = useRef(null);

  const [liveVowel, setLiveVowel] = useState('---');
  const [liveBiorhythm, setLiveBiorhythm] = useState('Delta (Rest)');
  
  const [autotuneStrength, setAutotuneStrength] = useState(50);
  const pitchCanvasRef = useRef(null);
  const livePitchRef = useRef(0);
  
  const [cameraFilter, setCameraFilter] = useState('aura');
  const cameraFilterCanvasRef = useRef(null);
  const partnerAudioRef = useRef(null);

  const getDuetLineText = (lineText, index) => {
    if (!currentRecording?.isDuet) return lineText;
    const partnerName = currentRecording?.partnerName || 'Partner';
    if (index % 4 === 0) {
      return `[Together] ${lineText}`;
    } else if (index % 2 === 0) {
      return `[${partnerName}] ${lineText}`;
    } else {
      return `[Me] ${lineText}`;
    }
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !nextMuted;
      });
    }
  };

  const toggleMonitoring = () => {
    const nextMonitoring = !isMonitoring;
    setIsMonitoring(nextMonitoring);
    if (nextMonitoring) {
      alert("Please connect headphones to prevent feedback howl!");
    }
    if (monitorGainRef.current && audioContextRef.current) {
      monitorGainRef.current.gain.setValueAtTime(nextMonitoring ? 1.0 : 0.0, audioContextRef.current.currentTime);
    }
  };

  useEffect(() => {
    if (!isRecording) return;
    const canvas = pitchCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationId;
    let width = canvas.width = canvas.offsetWidth;
    let height = canvas.height = canvas.offsetHeight;

    const resizeObserver = new ResizeObserver(() => {
      if (canvas) {
        width = canvas.width = canvas.offsetWidth;
        height = canvas.height = canvas.offsetHeight;
      }
    });
    resizeObserver.observe(canvas);

    const singerHistory = [];
    const maxPoints = 85;

    const drawGrid = () => {
      animationId = requestAnimationFrame(drawGrid);
      
      // Slate background
      ctx.fillStyle = 'rgba(6, 4, 30, 0.55)';
      ctx.fillRect(0, 0, width, height);

      // Draw grid octaves lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      for (let i = 1; i <= 4; i++) {
        const y = (height / 5) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.font = '8px monospace';
        ctx.fillText(`Octave ${5 - i}`, 6, y - 4);
      }

      const time = Date.now();
      
      // Draw target melody line (scrolling blue dashed wave)
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(0, 242, 255, 0.45)';
      ctx.lineWidth = 2.0;
      ctx.setLineDash([6, 5]);

      for (let x = 0; x < width; x += 4) {
        const tOffset = (x - width) * 2.2;
        const targetY = height / 2 - (Math.sin((time + tOffset) * 0.001) * 32 + Math.cos((time + tOffset) * 0.0006) * 18) * (height / 140);
        if (x === 0) ctx.moveTo(x, targetY);
        else ctx.lineTo(x, targetY);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Read current singer pitch
      const currentPitch = livePitchRef.current || 0;
      if (currentPitch > 50) {
        singerHistory.push(currentPitch);
      } else {
        singerHistory.push(null);
      }
      if (singerHistory.length > maxPoints) singerHistory.shift();

      // Plot singer pitch trajectory (glowing yellow)
      ctx.beginPath();
      ctx.strokeStyle = '#ffb700';
      ctx.lineWidth = 3.0;
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#ffb700';

      let drawing = false;
      singerHistory.forEach((p, idx) => {
        if (p === null) {
          drawing = false;
          return;
        }
        const x = (width / maxPoints) * idx;
        const y = height / 2 - (p - 220) * (height / 140);

        if (!drawing) {
          ctx.moveTo(x, y);
          drawing = true;
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Snapping evaluation
      if (currentPitch > 50) {
        const targetVal = 220 + Math.sin(time * 0.001) * 32 + Math.cos(time * 0.0006) * 18;
        const diff = Math.abs(currentPitch - targetVal);
        if (diff < 15) {
          ctx.fillStyle = '#00ff87';
          ctx.font = 'bold 10px Orbitron';
          ctx.fillText('🌟 PERFECT!', width - 90, 18);
        } else if (diff < 32) {
          ctx.fillStyle = 'var(--primary-glow)';
          ctx.font = 'bold 10px Orbitron';
          ctx.fillText('👍 GOOD', width - 80, 18);
        }
      }
    };

    drawGrid();

    return () => {
      cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
    };
  }, [isRecording]);

  useEffect(() => {
    if (!isRecording || cameraFilter === 'none') return;
    const canvas = cameraFilterCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationId;
    let width = canvas.width = canvas.offsetWidth;
    let height = canvas.height = canvas.offsetHeight;

    const resizeObserver = new ResizeObserver(() => {
      if (canvas) {
        width = canvas.width = canvas.offsetWidth;
        height = canvas.height = canvas.offsetHeight;
      }
    });
    resizeObserver.observe(canvas);

    const particles = [];
    const maxParticles = 40;

    const drawFilter = () => {
      animationId = requestAnimationFrame(drawFilter);
      ctx.clearRect(0, 0, width, height);

      // 1. Compute vocal volume from the live analyser node
      let vol = 20; 
      if (analyserRef.current) {
        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
        vol = sum / bufferLength; // 0 to 255
      }

      // Map vowel phonemes to specific Chakra colors:
      let chakraColor = 'rgba(0, 242, 255, 0.4)'; // throat default
      let glowColor = '#00f2ff';
      const vowel = liveVowel.toLowerCase();
      if (vowel.includes('/u/')) {
        chakraColor = 'rgba(255, 0, 59, 0.4)'; // Root (Red)
        glowColor = '#ff003b';
      } else if (vowel.includes('/o/')) {
        chakraColor = 'rgba(255, 112, 0, 0.4)'; // Sacral (Orange)
        glowColor = '#ff7000';
      } else if (vowel.includes('/a/')) {
        chakraColor = 'rgba(0, 255, 135, 0.4)'; // Heart (Green)
        glowColor = '#00ff87';
      } else if (vowel.includes('/e/')) {
        chakraColor = 'rgba(0, 242, 255, 0.4)'; // Throat (Blue)
        glowColor = '#00f2ff';
      } else if (vowel.includes('/i/')) {
        chakraColor = 'rgba(178, 0, 255, 0.4)'; // Crown (Violet)
        glowColor = '#b200ff';
      }

      const pulse = 10 + (vol / 255) * 45;

      // 2. Render selected visualizer filter mode
      if (cameraFilter === 'aura') {
        const time = Date.now() * 0.001;
        const cx = width / 2 + Math.sin(time) * 15;
        const cy = height / 2 + Math.cos(time * 0.8) * 15;

        const grad = ctx.createRadialGradient(cx, cy, width * 0.1, cx, cy, width * 0.7 + pulse * 2);
        grad.addColorStop(0, 'rgba(4, 3, 24, 0)');
        grad.addColorStop(0.65, `${chakraColor.replace('0.4', '0.08')}`);
        grad.addColorStop(0.9, `${chakraColor.replace('0.4', '0.28')}`);
        grad.addColorStop(1, `${chakraColor.replace('0.4', '0.62')}`);
        
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = glowColor;
        ctx.lineWidth = 2 + (vol / 80);
        ctx.shadowBlur = 10 + (vol / 30);
        ctx.shadowColor = glowColor;
        ctx.strokeRect(5, 5, width - 10, height - 10);
        ctx.shadowBlur = 0;

      } else if (cameraFilter === 'geometry') {
        ctx.strokeStyle = `rgba(255, 0, 193, ${0.25 + (vol / 255) * 0.4})`;
        ctx.lineWidth = 1.2;
        ctx.strokeRect(10, 10, width - 20, height - 20);

        const cornerSize = 40 + pulse * 0.5;
        ctx.strokeStyle = `rgba(0, 242, 255, ${0.35 + (vol / 255) * 0.45})`;
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 8;
        ctx.shadowColor = 'var(--primary-glow)';

        ctx.beginPath();
        ctx.moveTo(15, 15 + cornerSize);
        ctx.lineTo(15, 15);
        ctx.lineTo(15 + cornerSize, 15);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(width - 15 - cornerSize, 15);
        ctx.lineTo(width - 15, 15);
        ctx.lineTo(width - 15, 15 + cornerSize);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(15, height - 15 - cornerSize);
        ctx.lineTo(15, height - 15);
        ctx.lineTo(15 + cornerSize, height - 15);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(width - 15 - cornerSize, height - 15);
        ctx.lineTo(width - 15, height - 15);
        ctx.lineTo(width - 15, height - 15 - cornerSize);
        ctx.stroke();
        ctx.shadowBlur = 0;

        if (particles.length < maxParticles && vol > 60 && Math.random() < 0.35) {
          particles.push({
            x: Math.random() * width,
            y: height - 15,
            vx: (Math.random() - 0.5) * 1.5,
            vy: -1.2 - Math.random() * 2.0,
            alpha: 1.0,
            color: glowColor
          });
        }

        ctx.lineWidth = 1;
        particles.forEach((p, pIdx) => {
          p.x += p.vx;
          p.y += p.vy;
          p.alpha -= 0.015;

          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.alpha;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1.8 + (vol / 120), 0, Math.PI * 2);
          ctx.fill();

          if (p.alpha <= 0) particles.splice(pIdx, 1);
        });
        ctx.globalAlpha = 1.0; 

      } else if (cameraFilter === 'spectrum') {
        ctx.lineWidth = 1.8;
        ctx.strokeStyle = `hsla(${(Date.now() / 35) % 360}, 100%, 70%, 0.65)`;
        ctx.shadowBlur = 8;
        ctx.shadowColor = ctx.strokeStyle;

        ctx.beginPath();
        for (let y = 10; y < height - 10; y += 4) {
          const ratio = y / height;
          const index = Math.floor(ratio * 32);
          let amp = 0;
          if (analyserRef.current) {
            const tempBuffer = new Uint8Array(64);
            analyserRef.current.getByteFrequencyData(tempBuffer);
            amp = tempBuffer[index] || 0;
          } else {
            amp = 20 + Math.sin(y * 0.05 + Date.now() * 0.005) * 12;
          }
          const wHeight = (amp / 255) * 45;

          ctx.moveTo(10, y);
          ctx.lineTo(10 + wHeight, y);

          ctx.moveTo(width - 10, y);
          ctx.lineTo(width - 10 - wHeight, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    };

    drawFilter();

    return () => {
      cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
    };
  }, [isRecording, cameraFilter, liveVowel]);

  useEffect(() => {
    if (song && song.lyrics) {
      setLyricsLines(song.lyrics.split('\n').filter(line => line.trim() !== ''));
    }
  }, [song]);

  // Backing and partner audio loading
  useEffect(() => {
    if (song) {
      const audio = new Audio(song.audioUrl);
      audio.crossOrigin = "anonymous";
      backingAudioRef.current = audio;

      if (currentRecording?.isDuet && currentRecording?.partnerVocalUrl) {
        const partnerAudio = new Audio(currentRecording.partnerVocalUrl);
        partnerAudio.crossOrigin = "anonymous";
        partnerAudioRef.current = partnerAudio;
      }
    }
    return () => {
      if (backingAudioRef.current) {
        backingAudioRef.current.pause();
      }
      if (partnerAudioRef.current) {
        partnerAudioRef.current.pause();
      }
      cleanupAudio();
    };
  }, [song, currentRecording]);

  // Backing track update loop
  useEffect(() => {
    if (!isRecording) return;
    const interval = setInterval(() => {
      if (backingAudioRef.current) {
        const time = backingAudioRef.current.currentTime;
        setRecordTime(time);
        
        // Progress lyrics lines based on duration of backing track
        const duration = backingAudioRef.current.duration || 60;
        const lineCount = lyricsLines.length;
        if (lineCount > 0) {
          const index = Math.min(lineCount - 1, Math.floor((time / duration) * lineCount));
          setCurrentLineIndex(index);
        }
      } else {
        // Fallback simulation timer
        setRecordTime(prev => {
          const next = prev + 0.1;
          const lineCount = lyricsLines.length;
          if (lineCount > 0) {
            const index = Math.min(lineCount - 1, Math.floor((next / 30) * lineCount));
            setCurrentLineIndex(index);
          }
          return next;
        });
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isRecording, lyricsLines]);

  const cleanupAudio = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
  };

  const startRecording = async () => {
    setPitchHistory([]);
    setRecordTime(0);
    setCurrentLineIndex(0);
    recordedChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: isVideoMode });
      streamRef.current = stream;

      if (isVideoMode && videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Initialize Web Audio graph
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;

      const micSource = audioCtx.createMediaStreamSource(stream);
      
      // Setup live filters
      if (selectedFilter === 'studio') {
        const waveshaper = audioCtx.createWaveShaper();
        waveshaper.curve = makeDistortionCurve(40);
        micSource.connect(waveshaper);
        waveshaper.connect(analyser);
      } else if (selectedFilter === 'reverb') {
        const delayNode = audioCtx.createDelay(1.0);
        const feedbackNode = audioCtx.createGain();
        delayNode.delayTime.setValueAtTime(0.35, audioCtx.currentTime);
        feedbackNode.gain.setValueAtTime(0.4, audioCtx.currentTime);

        micSource.connect(delayNode);
        delayNode.connect(feedbackNode);
        feedbackNode.connect(delayNode);
        
        micSource.connect(analyser);
        delayNode.connect(analyser);
      } else if (selectedFilter === 'echo') {
        const feedback = audioCtx.createGain();
        const delay = audioCtx.createDelay();
        delay.delayTime.value = 0.5;
        feedback.gain.value = 0.6;
        
        micSource.connect(delay);
        delay.connect(feedback);
        feedback.connect(delay);
        
        micSource.connect(analyser);
        delay.connect(analyser);
      } else if (selectedFilter === 'denoise') {
        const hp = audioCtx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.setValueAtTime(80, audioCtx.currentTime);

        const lp = audioCtx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(1200, audioCtx.currentTime);

        micSource.connect(hp);
        hp.connect(lp);
        lp.connect(analyser);
      } else {
        micSource.connect(analyser);
      }

      // Setup monitor node
      const monitorGain = audioCtx.createGain();
      monitorGain.gain.setValueAtTime(isMonitoring ? 1.0 : 0.0, audioCtx.currentTime);
      analyser.connect(monitorGain);
      monitorGain.connect(audioCtx.destination);
      monitorGainRef.current = monitorGain;

      // Connect pitch detection analyzer loop
      const detectPitchLoop = () => {
        if (!audioCtx || audioCtx.state === 'closed') return;
        const bufferLength = analyser.fftSize;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteTimeDomainData(dataArray);

        const pitch = getPitchFromAudioData(dataArray, audioCtx.sampleRate);
        if (pitch > 50 && pitch < 1000) {
          const roundedPitch = Math.round(pitch);
          setLivePitch(roundedPitch);
          livePitchRef.current = roundedPitch;
          setPitchHistory(prev => {
            const nextHistory = [...prev, pitch];
            // Compute live biorhythms
            if (nextHistory.length > 5) {
              const slice = nextHistory.slice(-5);
              const dev = Math.max(...slice) - Math.min(...slice);
              if (dev < 5) setLiveBiorhythm('Alpha (Focused Flow State)');
              else if (dev > 25) setLiveBiorhythm('Beta (High Intensity Energy)');
              else if (Math.abs(pitch - 528) < 10 || Math.abs(pitch - 432) < 10) setLiveBiorhythm('Gamma (Insight / Healing)');
              else setLiveBiorhythm('Theta (Relaxation Wavelength)');
            }
            return nextHistory;
          });

          // Compute vowel phonemes
          if (roundedPitch < 130) setLiveVowel('/u/ (Oo - Root stabilizer)');
          else if (roundedPitch < 220) setLiveVowel('/o/ (Oh - Sacral creator)');
          else if (roundedPitch < 330) setLiveVowel('/a/ (Ah - Heart awakening)');
          else if (roundedPitch < 440) setLiveVowel('/e/ (Eh - Throat expression)');
          else setLiveVowel('/i/ (Ee - Crown connector)');

        } else {
          setLivePitch(0);
          livePitchRef.current = 0;
          setLiveVowel('---');
          setLiveBiorhythm('Delta (Resting Wavelength)');
        }

        if (isRecording) {
          requestAnimationFrame(detectPitchLoop);
        }
      };

      // Play carrier hum if enabled
      if (playHum) {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.frequency.setValueAtTime(528, audioCtx.currentTime); // 528Hz hum
        gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.start();
        humOscRef.current = osc;
      }

      // Start Backing audio
      if (backingAudioRef.current) {
        backingAudioRef.current.currentTime = 0;
        backingAudioRef.current.volume = 0.7;
        await backingAudioRef.current.play();
      }

      if (partnerAudioRef.current) {
        partnerAudioRef.current.currentTime = 0;
        partnerAudioRef.current.volume = 0.6;
        await partnerAudioRef.current.play();
      }

      // MediaRecorder initialization
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const localPlaybackUrl = URL.createObjectURL(blob);

        // Compute performance alignment score
        const score = calculateScore();
        
        setCurrentRecording({
          selectedSong: song,
          playbackUrl: localPlaybackUrl,
          score,
          pitchHistory,
          vocalFilter: selectedFilter,
          autotuneStrength,
          isDuet: currentRecording?.isDuet || false,
          partnerName: currentRecording?.partnerName || '',
          partnerVocalUrl: currentRecording?.partnerVocalUrl || ''
        });
        
        navigate('Results');
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      
      setIsRecording(true);
      requestAnimationFrame(detectPitchLoop);
    } catch (err) {
      console.warn("Media Capture failed, launching sandbox simulation:", err);
      // Run Sandbox simulator recording
      setIsRecording(true);
      if (backingAudioRef.current) {
        backingAudioRef.current.currentTime = 0;
        backingAudioRef.current.play().catch(() => {});
      }
      if (partnerAudioRef.current) {
        partnerAudioRef.current.currentTime = 0;
        partnerAudioRef.current.play().catch(() => {});
      }
    }
  };

  const makeDistortionCurve = (amount) => {
    const k = typeof amount === 'number' ? amount : 50;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  };

  const stopRecording = () => {
    setIsRecording(false);
    if (backingAudioRef.current) {
      backingAudioRef.current.pause();
    }
    if (partnerAudioRef.current) {
      partnerAudioRef.current.pause();
    }
    if (humOscRef.current) {
      humOscRef.current.stop();
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    } else {
      // Mock Sandbox Stop
      const score = calculateScore();
      setCurrentRecording({
        selectedSong: song,
        playbackUrl: "https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Happy%20Life.mp3",
        score,
        pitchHistory: [220, 222, 218, 220, 221],
        vocalFilter: selectedFilter,
        autotuneStrength,
        isDuet: currentRecording?.isDuet || false,
        partnerName: currentRecording?.partnerName || '',
        partnerVocalUrl: currentRecording?.partnerVocalUrl || ''
      });
      navigate('Results');
    }
    cleanupAudio();
  };

  const calculateScore = () => {
    if (pitchHistory.length === 0) return 75; // baseline fallback
    
    // Pitch stability variance score calculation
    let varianceSum = 0;
    let avg = pitchHistory.reduce((a, b) => a + b, 0) / pitchHistory.length;
    pitchHistory.forEach(pitch => {
      varianceSum += Math.abs(pitch - avg);
    });
    const varianceAvg = varianceSum / pitchHistory.length;
    const stabilityPct = Math.max(45, Math.min(99, 100 - varianceAvg * 1.5));
    return Math.round(stabilityPct);
  };

  return (
    <div className="screen-wrapper">
      <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '20px' }}>
        <button 
          className="glowing-button secondary" 
          style={{ padding: '6px 12px', fontSize: '0.8rem', margin: 0 }}
          onClick={() => navigate('SongLibrary')}
          disabled={isRecording}
        >
          ← Quit Studio
        </button>
        <h1 className="suspended-title" style={{ margin: 0 }}>Recording Studio</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', alignItems: 'start' }}>
        {/* Visualizer & Video Capture Panel */}
        <div className="glass-panel" style={{ margin: 0, padding: 0, position: 'relative', height: '350px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
          {isVideoMode && isRecording && (
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              style={{ 
                position: 'absolute', 
                width: '100%', 
                height: '100%', 
                objectFit: 'cover',
                zIndex: 1,
                opacity: 0.55
              }} 
            />
          )}

          {isVideoMode && isRecording && cameraFilter !== 'none' && (
            <canvas 
              ref={cameraFilterCanvasRef} 
              style={{ 
                position: 'absolute', 
                width: '100%', 
                height: '100%', 
                top: 0, left: 0,
                pointerEvents: 'none',
                zIndex: 2
              }} 
            />
          )}

          <div style={{ position: 'absolute', width: '100%', height: '100%', zIndex: 1 }}>
            <VoiceReactiveVisualizer analyser={analyserRef.current} />
          </div>

          {/* Floating camera filter mode selector */}
          {isVideoMode && isRecording && (
            <div style={{
              position: 'absolute',
              top: '12px', left: '12px',
              display: 'flex', gap: '5px',
              zIndex: 10,
              background: 'rgba(6, 4, 30, 0.65)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '8px',
              padding: '3px',
              backdropFilter: 'blur(8px)'
            }}>
              {[
                { filter: 'none', label: 'None' },
                { filter: 'aura', label: '✨ Aura' },
                { filter: 'geometry', label: '🔷 Geometry' },
                { filter: 'spectrum', label: '📊 Waves' }
              ].map(btn => (
                <button
                  key={btn.filter}
                  onClick={() => setCameraFilter(btn.filter)}
                  style={{
                    background: cameraFilter === btn.filter ? 'var(--secondary-glow)' : 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    color: cameraFilter === btn.filter ? '#02001a' : '#fff',
                    fontSize: '0.62rem',
                    fontWeight: 'bold',
                    fontFamily: '"Orbitron", sans-serif',
                    padding: '3px 8px',
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    transition: 'all 0.25s ease'
                  }}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          )}

          {/* Pitch Guide Trajectory Grid */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', padding: '8px 12px', background: 'rgba(6, 4, 30, 0.75)', borderTop: '1px solid rgba(255,255,255,0.06)', zIndex: 3 }}>
            <span style={{ fontSize: '0.62rem', color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
              🎯 Pitch Trajectory Guide
            </span>
            {isRecording ? (
              <canvas ref={pitchCanvasRef} style={{ width: '100%', height: '55px', borderRadius: '4px', display: 'block' }} />
            ) : (
              <div style={{ width: '100%', height: '55px', borderRadius: '4px', background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: '0.68rem' }}>
                Resonance pitch guide active during recording
              </div>
            )}
          </div>
        </div>

        {/* Info & Prompter Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Song Metadata Card */}
          <div className="glass-panel" style={{ margin: 0, padding: '15px' }}>
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{song?.title}</h2>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>{song?.artist}</p>
            
            <div style={{ display: 'flex', gap: '15px', marginTop: '12px', alignItems: 'center' }}>
              <div style={{ fontSize: '1.1rem', fontFamily: 'monospace', textShadow: '0 0 8px var(--primary-glow)' }}>
                Time: {Math.floor(recordTime / 60)}:{(recordTime % 60).toFixed(1).padStart(4, '0')}
              </div>
              <div style={{ fontSize: '1.1rem', fontFamily: 'monospace', color: 'var(--primary-glow)' }}>
                Pitch: {livePitch > 0 ? `${livePitch} Hz` : '---'}
              </div>
            </div>

            {/* Real-time Bio-Resonance HUD */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '12px' }}>
              <div style={{ background: 'rgba(0,0,0,0.18)', padding: '6px 10px', borderRadius: '6px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.62rem', color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block' }}>Vowel Vibe</span>
                <strong style={{ fontSize: '0.88rem', color: 'var(--primary-glow)', display: 'block', marginTop: '2px' }}>{liveVowel}</strong>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.18)', padding: '6px 10px', borderRadius: '6px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.62rem', color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block' }}>Biorhythm Mindset</span>
                <strong style={{ fontSize: '0.88rem', color: 'var(--secondary-glow)', display: 'block', marginTop: '2px' }}>{liveBiorhythm}</strong>
              </div>
            </div>

            {/* Live Filter Config */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '15px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Vocal Effect:</span>
              {['none', 'studio', 'reverb', 'echo', 'denoise'].map(filter => (
                <button
                  key={filter}
                  className={`daw-track-btn ${selectedFilter === filter ? 'active' : ''}`}
                  onClick={() => setSelectedFilter(filter)}
                  style={{ fontSize: '0.65rem', padding: '3px 8px', textTransform: 'capitalize', margin: 0 }}
                  disabled={isRecording}
                >
                  {filter}
                </button>
              ))}
            </div>

            {/* Autotune Strength Config */}
            <div style={{ background: 'rgba(0,242,255,0.03)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(0,242,255,0.08)', marginTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--primary-glow)', marginBottom: '4px' }}>
                <span>✨ Autotune Snap Strength</span>
                <span>{autotuneStrength}%</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={autotuneStrength} 
                onChange={e => setAutotuneStrength(Number(e.target.value))} 
                style={{ width: '100%' }} 
              />
              <span style={{ fontSize: '0.62rem', color: 'var(--text-dim)', display: 'block', marginTop: '2px', textAlign: 'left' }}>
                Locks vocal pitches snap-matching closest target notes.
              </span>
            </div>
          </div>

          {/* Scrolling Prompter HUD */}
          <div className="glass-panel" style={{ margin: 0, height: '180px', display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center' }}>
            <div style={{ overflowY: 'hidden', height: '100px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '12px' }}>
              {lyricsLines.length > 0 ? (
                <>
                  <p style={{ color: 'var(--text-dim)', fontSize: '0.82rem', opacity: 0.45 }}>
                    {lyricsLines[currentLineIndex - 1] ? getDuetLineText(lyricsLines[currentLineIndex - 1], currentLineIndex - 1) : ''}
                  </p>
                  <p style={{ color: (currentLineIndex % 4 === 0) ? '#ffcc00' : ((currentLineIndex % 2 === 0) ? 'var(--secondary-glow)' : 'var(--primary-glow)'), fontSize: '1.25rem', fontWeight: 'bold', textShadow: '0 0 10px currentColor' }}>
                    {lyricsLines[currentLineIndex] ? getDuetLineText(lyricsLines[currentLineIndex], currentLineIndex) : '---'}
                  </p>
                  <p style={{ color: 'var(--text-dim)', fontSize: '0.82rem', opacity: 0.45 }}>
                    {lyricsLines[currentLineIndex + 1] ? getDuetLineText(lyricsLines[currentLineIndex + 1], currentLineIndex + 1) : ''}
                  </p>
                </>
              ) : (
                <p style={{ color: 'var(--text-dim)' }}>Instrumental Section...</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recording Control Actions */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '25px', flexWrap: 'wrap' }}>
        {!isRecording ? (
          <button className="glowing-button" onClick={startRecording} style={{ margin: 0, padding: '14px 35px' }}>
            🎙️ Start Recording Session
          </button>
        ) : (
          <button className="glowing-button secondary" onClick={stopRecording} style={{ margin: 0, padding: '14px 35px', borderColor: 'var(--secondary-glow)' }}>
            ⏹️ Stop & Compile Performance
          </button>
        )}

        <button 
          className={`glowing-button secondary ${isMuted ? 'active' : ''}`}
          onClick={toggleMute}
          style={{ margin: 0, padding: '14px 20px', borderColor: isMuted ? 'var(--secondary-glow)' : '' }}
          disabled={!isRecording}
        >
          {isMuted ? '🔇 Muted' : '🎙️ Mute Mic'}
        </button>

        <button 
          className={`glowing-button secondary ${isMonitoring ? 'active' : ''}`}
          onClick={toggleMonitoring}
          style={{ margin: 0, padding: '14px 20px', borderColor: isMonitoring ? 'var(--primary-glow)' : '' }}
          disabled={!isRecording}
        >
          {isMonitoring ? '🎧 Monitor ON' : '🎧 Monitor OFF'}
        </button>

        <button 
          className={`glowing-button secondary ${isVideoMode ? 'active' : ''}`}
          onClick={() => setIsVideoMode(!isVideoMode)}
          style={{ margin: 0, padding: '14px 20px' }}
          disabled={isRecording}
        >
          {isVideoMode ? '📹 Camera ON' : '📷 Audio Only'}
        </button>

        <button 
          className={`glowing-button secondary ${playHum ? 'active' : ''}`}
          onClick={() => setPlayHum(!playHum)}
          style={{ margin: 0, padding: '14px 20px' }}
          disabled={isRecording}
        >
          {playHum ? '✓ Hum Node ON' : '⏵ Hum Node OFF'}
        </button>
      </div>
    </div>
  );
};

export default RecordingStudio;
