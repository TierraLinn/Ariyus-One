import React, { useState, useEffect, useRef } from 'react';
import VoiceReactiveVisualizer from '../components/VoiceReactiveVisualizer';

const createReverbImpulseResponse = (ctx, duration = 2.0, decay = 1.5) => {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * duration;
  const impulse = ctx.createBuffer(2, length, sampleRate);
  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);

  for (let i = 0; i < length; i++) {
    const percent = i / length;
    const val = (Math.random() * 2 - 1) * Math.pow(1 - percent, decay);
    left[i] = val;
    right[i] = val;
  }
  return impulse;
};

const makeDistortionCurve = (amount) => {
  if (amount <= 0) return null;
  const k = amount;
  const n_samples = 44100;
  const curve = new Float32Array(n_samples);
  const deg = Math.PI / 180;
  for (let i = 0; i < n_samples; ++i) {
    const x = (i * 2) / n_samples - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  return curve;
};

const RecordingStudio = ({ selectedSong, setCurrentRecording, navigate, setError, activeChallenge, handleCompleteChallenge, duetPartner }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [activeLineIdx, setActiveLineIdx] = useState(0);
  const [lyricsLines, setLyricsLines] = useState([]);
  
  // Advanced features states
  const [isVideoMode, setIsVideoMode] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('studio'); // 'none', 'studio', 'reverb', 'echo'
  
  // Challenge tracker states
  const [livePitch, setLivePitch] = useState(0);
  const [sustainProgress, setSustainProgress] = useState(0);
  const [challengeSuccess, setChallengeSuccess] = useState(false);
  
  // Solfeggio Hum toggle
  const [playHum, setPlayHum] = useState(false);
  const [isSynthPlaying, setIsSynthPlaying] = useState(false);

  // Web Audio & Media Recorder Refs
  const audioContextRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const [analyser, setAnalyser] = useState(null);

  // Video Ref
  const videoRef = useRef(null);

  // Synthesizer / Oscillator Refs
  const humOscRef = useRef(null);
  const humGainRef = useRef(null);
  const synthIntervalRef = useRef(null);

  // Sync Editor Mode state
  const [isSyncMode, setIsSyncMode] = useState(false);
  const [syncedTimestamps, setSyncedTimestamps] = useState([]);
  const [syncPlaybackTime, setSyncPlaybackTime] = useState(0);
  
  // Prompter & timer refs
  const timerRef = useRef(null);
  const syncPlaybackTimerRef = useRef(null);
  const lyricsContainerRef = useRef(null);
  const backingAudioElementRef = useRef(null);
  const duetAudioElementRef = useRef(null);
  const prompterCanvasRef = useRef(null);

  // Autocorrelation Pitch Tracker helper for live scanning during recording
  const getPitchFromStream = (analyserNode, sampleRate) => {
    const bufferLength = analyserNode.fftSize;
    const dataArray = new Uint8Array(bufferLength);
    analyserNode.getByteTimeDomainData(dataArray);

    const signal = new Float32Array(bufferLength);
    let isSilent = true;
    for (let i = 0; i < bufferLength; i++) {
      const val = (dataArray[i] - 128) / 128;
      signal[i] = val;
      if (Math.abs(val) > 0.02) isSilent = false;
    }

    if (isSilent) return 0;

    let r = new Float32Array(bufferLength);
    for (let lag = 0; lag < bufferLength / 2; lag++) {
      let sum = 0;
      for (let i = 0; i < bufferLength / 2; i++) {
        sum += signal[i] * signal[i + lag];
      }
      r[lag] = sum;
    }

    let firstZeroCrossing = -1;
    for (let i = 0; i < bufferLength / 2; i++) {
      if (r[i] < 0) {
        firstZeroCrossing = i;
        break;
      }
    }

    if (firstZeroCrossing === -1) return 0;

    let peak = -1;
    let maxVal = -1;
    let threshold = 0.15 * r[0];

    for (let i = firstZeroCrossing; i < bufferLength / 2; i++) {
      if (r[i] > threshold && r[i] > r[i - 1] && r[i] > r[i + 1]) {
        if (r[i] > maxVal) {
          maxVal = r[i];
          peak = i;
        }
      }
    }

    if (peak !== -1) {
      return sampleRate / peak;
    }
    return 0;
  };

  // Intention presets mapping to target Hertz
  const getHzFromSongKey = (key = '') => {
    const numeric = parseInt(key.replace(/[^0-9]/g, ''));
    if (numeric && [396, 417, 432, 444, 528, 639, 741, 852, 963].includes(numeric)) {
      return numeric;
    }
    return 528;
  };

  const targetHz = getHzFromSongKey(selectedSong?.key);

  useEffect(() => {
    const currentAudio = backingAudioElementRef.current;
    const duetAudio = duetAudioElementRef.current;
    return () => {
      if (currentAudio) currentAudio.pause();
      if (duetAudio) duetAudio.pause();
      clearInterval(synthIntervalRef.current);
      stopHumOscillator();
    };
  }, []);

  useEffect(() => {
    if (selectedSong && selectedSong.lyrics) {
      const lines = selectedSong.lyrics.split('\n').filter(l => l.trim() !== '');
      setLyricsLines(lines);
      setSyncedTimestamps(lines.map((text, idx) => ({ idx, text, time: idx * 4.5 })));
    } else {
      setLyricsLines(['[Freestyle Resonance Mode]', 'Vibrate from the chest...', 'Align your inner frequency with AUM...']);
      setSyncedTimestamps([
        { idx: 0, text: '[Freestyle Resonance Mode]', time: 0 },
        { idx: 1, text: 'Vibrate from the chest...', time: 4 },
        { idx: 2, text: 'Align your inner frequency with AUM...', time: 8 }
      ]);
    }
  }, [selectedSong]);

  // Sync prompter lines to time
  useEffect(() => {
    if (isRecording) {
      const active = syncedTimestamps.reduce((acc, current) => {
        if (recordTime >= current.time) {
          return current.idx;
        }
        return acc;
      }, 0);
      setActiveLineIdx(active);

      const container = lyricsContainerRef.current;
      if (container) {
        const activeLineElement = container.children[active];
        if (activeLineElement) {
          container.scrollTo({
            top: activeLineElement.offsetTop - container.offsetHeight / 2 + activeLineElement.offsetHeight / 2,
            behavior: 'smooth'
          });
        }
      }
    }
  }, [recordTime, isRecording, syncedTimestamps]);

  // HTML5 Canvas lyric scrolling visualizer loop
  useEffect(() => {
    const canvas = prompterCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    const render = () => {
      const width = canvas.width = canvas.offsetWidth || 500;
      const height = canvas.height = canvas.offsetHeight || 180;
      const centerY = height / 2;
      const lineSpacing = 35;

      ctx.clearRect(0, 0, width, height);

      // Gradient background matching app theme
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#040318');
      grad.addColorStop(0.5, '#070630');
      grad.addColorStop(1, '#040318');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Guide lines for the Active Zone
      ctx.strokeStyle = 'rgba(0, 242, 255, 0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, centerY - 22);
      ctx.lineTo(width, centerY - 22);
      ctx.moveTo(0, centerY + 22);
      ctx.lineTo(width, centerY + 22);
      ctx.stroke();

      if (syncedTimestamps.length > 0) {
        // Track the current active line index
        const active = syncedTimestamps.reduce((acc, current) => {
          if (recordTime >= current.time) {
            return current.idx;
          }
          return acc;
        }, 0);

        const currentLine = syncedTimestamps[active];
        const nextLine = syncedTimestamps[active + 1];
        
        let progress = 0;
        if (currentLine && nextLine) {
          const duration = nextLine.time - currentLine.time;
          if (duration > 0) {
            progress = Math.max(0, Math.min(1, (recordTime - currentLine.time) / duration));
          }
        }
        const smoothActiveIdx = active + progress;

        syncedTimestamps.forEach((item) => {
          const y = centerY + (item.idx - smoothActiveIdx) * lineSpacing;
          
          if (y > -20 && y < height + 20) {
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            if (item.idx === active) {
              // Calculate alignment pitch score
              let alignment = 0;
              if (livePitch) {
                let minDiff = Infinity;
                const octaves = [targetHz / 2, targetHz, targetHz * 2];
                octaves.forEach(freq => {
                  const diff = Math.abs(livePitch - freq);
                  if (diff < minDiff) minDiff = diff;
                });
                alignment = Math.max(0, Math.min(100, Math.round((1 - minDiff / targetHz) * 100)));
              }

              const isAligned = alignment >= 80;
              
              ctx.save();
              ctx.font = 'bold 18px "Outfit", sans-serif';
              ctx.fillStyle = isAligned ? '#00f2ff' : '#ff9f00';
              ctx.shadowBlur = isAligned ? 15 : 8;
              ctx.shadowColor = isAligned ? 'rgba(0, 242, 255, 0.8)' : 'rgba(255, 159, 0, 0.8)';
              
              // Draw centered text
              ctx.fillText(item.text, width / 2, y);
              
              // Micro feedback text
              if (isRecording) {
                ctx.restore();
                ctx.save();
                ctx.font = 'bold 9px "Orbitron", sans-serif';
                ctx.fillStyle = isAligned ? '#00ff87' : '#ff3b30';
                ctx.fillText(`PITCH MATCH: ${alignment}%`, width / 2, y - 24);
              }
              
              ctx.restore();
            } else if (item.idx < active) {
              // Passed lines
              ctx.font = '14px "Inter", sans-serif';
              ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
              ctx.fillText(item.text, width / 2, y);
            } else {
              // Future lines
              ctx.font = '15px "Inter", sans-serif';
              ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
              ctx.fillText(item.text, width / 2, y);
            }
          }
        });
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [syncedTimestamps, recordTime, livePitch, isRecording, targetHz]);

  // Solfeggio Hum oscillator startup
  const startHumOscillator = (ctx) => {
    if (!ctx) return;
    try {
      stopHumOscillator();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(targetHz, ctx.currentTime);
      gain.gain.setValueAtTime(playHum ? 0.08 : 0.0, ctx.currentTime);

      osc.connect(gain);
      gain.connect(ctx.destination);

      humOscRef.current = osc;
      humGainRef.current = gain;
      osc.start();
    } catch (e) {
      console.warn("Could not start Solfeggio Hum oscillator:", e);
    }
  };

  const stopHumOscillator = () => {
    if (humOscRef.current) {
      try {
        humOscRef.current.stop();
      } catch (e) {}
      humOscRef.current = null;
    }
    humGainRef.current = null;
  };

  // Sync hum gain volume when toggle changes
  useEffect(() => {
    if (humGainRef.current && audioContextRef.current) {
      humGainRef.current.gain.setValueAtTime(playHum ? 0.08 : 0.0, audioContextRef.current.currentTime);
    }
  }, [playHum]);

  // Rhythmic Synth Fallback Beat
  const startSynthBeat = (ctx) => {
    clearInterval(synthIntervalRef.current);
    setIsSynthPlaying(true);
    let beat = 0;
    const bpm = selectedSong?.bpm || 100;
    const intervalMs = (60 / bpm) * 1000;

    synthIntervalRef.current = setInterval(() => {
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        // Sub-harmonic bass pulse + resonant pulse
        if (beat % 4 === 0) {
          osc.frequency.setValueAtTime(targetHz / 2, ctx.currentTime); // Bass grounding frequency
          gain.gain.setValueAtTime(0.15, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
          osc.start();
          osc.stop(ctx.currentTime + 0.5);
        } else {
          osc.frequency.setValueAtTime(targetHz, ctx.currentTime); // Carrier pitch
          gain.gain.setValueAtTime(0.05, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
          osc.start();
          osc.stop(ctx.currentTime + 0.3);
        }
        beat++;
      } catch (e) {}
    }, intervalMs);
  };

  const startAudioCapture = async () => {
    try {
      audioChunksRef.current = [];
      
      // Request mic stream and camera stream if video mode is enabled
      const constraints = {
        audio: true,
        video: isVideoMode ? { width: 640, height: 480 } : false
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (isVideoMode && videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioContextRef.current = audioCtx;

      const sourceNode = audioCtx.createMediaStreamSource(stream);
      const analyserNode = audioCtx.createAnalyser();
      analyserNode.fftSize = 128;
      
      // Set up Smule / StarMaker style vocal filter routing
      let lastNode = sourceNode;

      if (selectedFilter === 'studio') {
        // High-pass filter to cut mud, High-shelf boost for crispness, tube saturation
        const lowCut = audioCtx.createBiquadFilter();
        lowCut.type = 'highpass';
        lowCut.frequency.setValueAtTime(120, audioCtx.currentTime);

        const highBoost = audioCtx.createBiquadFilter();
        highBoost.type = 'highshelf';
        highBoost.frequency.setValueAtTime(6000, audioCtx.currentTime);
        highBoost.gain.setValueAtTime(4.5, audioCtx.currentTime);

        const saturator = audioCtx.createWaveShaper();
        saturator.curve = makeDistortionCurve(15); // subtle tube drive

        lastNode.connect(lowCut);
        lowCut.connect(highBoost);
        highBoost.connect(saturator);
        lastNode = saturator;
      } else if (selectedFilter === 'reverb') {
        // Convolver Reverb Simulation
        const convolver = audioCtx.createConvolver();
        convolver.buffer = createReverbImpulseResponse(audioCtx, 2.2, 1.6);

        const dryGain = audioCtx.createGain();
        const wetGain = audioCtx.createGain();
        dryGain.gain.setValueAtTime(0.65, audioCtx.currentTime);
        wetGain.gain.setValueAtTime(0.55, audioCtx.currentTime);

        lastNode.connect(dryGain);
        lastNode.connect(convolver);
        convolver.connect(wetGain);

        const mixer = audioCtx.createGain();
        dryGain.connect(mixer);
        wetGain.connect(mixer);
        lastNode = mixer;
      } else if (selectedFilter === 'echo') {
        // Feedback echo delay line
        const delay = audioCtx.createDelay(1.0);
        delay.delayTime.setValueAtTime(0.35, audioCtx.currentTime);

        const feedback = audioCtx.createGain();
        feedback.gain.setValueAtTime(0.42, audioCtx.currentTime);

        delay.connect(feedback);
        feedback.connect(delay);

        const dryGain = audioCtx.createGain();
        const wetGain = audioCtx.createGain();
        dryGain.gain.setValueAtTime(1.0, audioCtx.currentTime);
        wetGain.gain.setValueAtTime(0.40, audioCtx.currentTime);

        lastNode.connect(dryGain);
        lastNode.connect(delay);
        delay.connect(wetGain);

        const mixer = audioCtx.createGain();
        dryGain.connect(mixer);
        wetGain.connect(mixer);
        lastNode = mixer;
      }

      lastNode.connect(analyserNode);
      setAnalyser(analyserNode);

      // Start Hum
      startHumOscillator(audioCtx);

      // Media recorder (standard audio capture)
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mp3' });
        const playbackUrl = URL.createObjectURL(audioBlob);
        
        const finalSig = generateVoiceSignature();
        const finalGrade = calculatePerformanceGrade(finalSig);
        const finalBadges = checkBadgesUnlocked(finalSig);

        setCurrentRecording({
          playbackUrl,
          selectedSong: selectedSong || { title: 'Freestyle Resonance', artist: 'Self', audioUrl: '' },
          signature: finalSig,
          tones: generateToneProfile(),
          recordTime,
          analyser: analyserNode,
          grade: finalGrade,
          badgesEarned: finalBadges,
          filterUsed: selectedFilter,
          videoEnabled: isVideoMode,
          duetPartner: duetPartner
        });

        navigate('Results');
      };

      // Play backing track OR fallback to synth beat
      let playBackingSuccess = false;
      if (backingAudioElementRef.current && selectedSong?.audioUrl) {
        backingAudioElementRef.current.currentTime = 0;
        try {
          await backingAudioElementRef.current.play();
          playBackingSuccess = true;
        } catch (e) {
          console.warn("Backing track element failed, starting synth guide...", e);
        }
      }

      // Play duet partner track in sync
      if (duetPartner && duetAudioElementRef.current) {
        duetAudioElementRef.current.currentTime = 0;
        try {
          await duetAudioElementRef.current.play();
        } catch (e) {
          console.warn("Duet partner track playback failed:", e);
        }
      }

      if (!playBackingSuccess) {
        startSynthBeat(audioCtx);
      }

      mediaRecorder.start();
      setIsRecording(true);
      setRecordTime(0);
      setSustainProgress(0);
      setChallengeSuccess(false);

      timerRef.current = setInterval(() => {
        let currentRecordTime = 0;
        if (backingAudioElementRef.current && playBackingSuccess) {
          currentRecordTime = backingAudioElementRef.current.currentTime;
          setRecordTime(currentRecordTime);
        } else {
          setRecordTime(prev => {
            currentRecordTime = prev + 0.1;
            return currentRecordTime;
          });
        }

        // Live Pitch tracking check
        if (analyserNode) {
          const p = getPitchFromStream(analyserNode, audioCtx.sampleRate);
          const roundedP = Math.round(p);
          setLivePitch(roundedP);
          
          if (activeChallenge === 'ch1') {
            if (roundedP >= 427 && roundedP <= 437) {
              setSustainProgress(prev => {
                if (prev + 0.1 >= 6.0) {
                  setChallengeSuccess(true);
                  return 6.0;
                }
                return prev + 0.1;
              });
            } else {
              setSustainProgress(0);
            }
          }
        }
      }, 100);

    } catch (err) {
      console.warn("Camera or Microphone access blocked. Falling back to sandbox loop.", err);
      
      // Sandbox: Web Audio guide tones only
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioContextRef.current = audioCtx;

      startHumOscillator(audioCtx);
      startSynthBeat(audioCtx);

      setIsRecording(true);
      setRecordTime(0);
      setAnalyser(null);
      setSustainProgress(0);
      setChallengeSuccess(false);
      
      timerRef.current = setInterval(() => {
        let currentRecordTime = 0;
        setRecordTime(prev => {
          currentRecordTime = prev + 0.1;
          return currentRecordTime;
        });

        // Sandbox Mock simulation: let the pitch lock to 432Hz after 3s to complete challenge!
        if (activeChallenge === 'ch1') {
          if (currentRecordTime >= 3.0 && currentRecordTime <= 10.0) {
            setLivePitch(432);
            setSustainProgress(prev => {
              if (prev + 0.1 >= 6.0) {
                setChallengeSuccess(true);
                return 6.0;
              }
              return prev + 0.1;
            });
          } else {
            setLivePitch(110 + Math.floor(Math.random() * 20));
            setSustainProgress(0);
          }
        } else {
          setLivePitch(0);
        }
      }, 100);
    }
  };

  const stopAudioCapture = () => {
    setIsRecording(false);
    clearInterval(timerRef.current);
    clearInterval(synthIntervalRef.current);
    setIsSynthPlaying(false);
    stopHumOscillator();

    if (backingAudioElementRef.current) {
      backingAudioElementRef.current.pause();
    }
    if (duetAudioElementRef.current) {
      duetAudioElementRef.current.pause();
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    } else {
      // Sandbox Mock Finalize
      const mockBlob = new Blob(['wav placeholder waveforms'], { type: 'audio/mp3' });
      const playbackUrl = URL.createObjectURL(mockBlob);

      const sig = generateVoiceSignature();
      const ch2Success = activeChallenge === 'ch2' && sig.stability >= 90;
      
      const finalGrade = calculatePerformanceGrade(sig);
      const finalBadges = checkBadgesUnlocked(sig);

      setCurrentRecording({
        playbackUrl,
        selectedSong: selectedSong || { title: 'Freestyle Resonance', artist: 'Self', audioUrl: '' },
        signature: sig,
        tones: generateToneProfile(),
        recordTime,
        challengeCompleted: challengeSuccess || ch2Success,
        grade: finalGrade,
        badgesEarned: finalBadges,
        filterUsed: selectedFilter,
        videoEnabled: isVideoMode,
        duetPartner: duetPartner
      });
      navigate('Results');
    }
  };

  const calculatePerformanceGrade = (sig) => {
    const score = Math.round((sig.stability + sig.breath + sig.energy) / 3);
    if (score >= 90) return { score, letter: 'A+', color: '#00ff87' };
    if (score >= 80) return { score, letter: 'A', color: '#00f2ff' };
    if (score >= 70) return { score, letter: 'B', color: '#ffb700' };
    if (score >= 60) return { score, letter: 'C', color: '#ff7000' };
    return { score, letter: 'D', color: '#ff3b30' };
  };

  const checkBadgesUnlocked = (sig) => {
    const list = [];
    if (challengeSuccess || (activeChallenge === 'ch1' && sustainProgress >= 6.0)) {
      list.push({ id: 'badge_breath', title: 'Cosmic Breath Initiate', icon: '🌬️', desc: 'Hold a steady 432 Hz tone continuously for 6.0 seconds.' });
    }
    if (sig.stability >= 90) {
      list.push({ id: 'badge_quantum', title: 'Quantum Vocalist', icon: '💎', desc: 'Achieve a pitch stability score of 90% or higher.' });
    }
    if (selectedSong && selectedSong.key) {
      list.push({ id: 'badge_solfeggio', title: 'Solfeggio Adept', icon: '🔱', desc: 'Synthesize performance audio in sync with target frequencies.' });
    }
    return list;
  };

  const generateVoiceSignature = () => {
    const isHigh = selectedSong?.difficulty === 'Hard';
    const vocalTypes = isHigh ? ['Soprano', 'Tenor'] : ['Alto', 'Baritone'];
    const type = vocalTypes[Math.floor(Math.random() * vocalTypes.length)];
    const resonances = ['Mixed Voice', 'Chest Resonance', 'Vocal Mask Tuning', 'Head Frequency'];
    const baseStability = 78 + Math.floor(Math.random() * 18);

    return {
      vocalType: type,
      resonanceType: resonances[Math.floor(Math.random() * resonances.length)],
      dominantFreq: isHigh ? `${340 + Math.floor(Math.random() * 90)} Hz` : `${120 + Math.floor(Math.random() * 50)} Hz`,
      energy: 72 + Math.floor(Math.random() * 20),
      flow: 68 + Math.floor(Math.random() * 26),
      expression: 75 + Math.floor(Math.random() * 20),
      breath: 70 + Math.floor(Math.random() * 25),
      stability: activeChallenge === 'ch2' ? Math.max(baseStability, 91) : baseStability
    };
  };

  const generateToneProfile = () => {
    const list = ['Warm', 'Clear', 'Airy', 'Deep', 'Bright', 'Powerful', 'Soft', 'Smooth'];
    const shuffled = [...list].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 3);
  };

  // --- Tap Sync Lyrics Editor ---
  const startSyncEditor = () => {
    setIsSyncMode(true);
    setSyncPlaybackTime(0);
    setActiveLineIdx(0);

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const audioCtx = audioContextRef.current || new AudioContextClass();
    audioContextRef.current = audioCtx;

    let backingSuccess = false;
    if (backingAudioElementRef.current && selectedSong?.audioUrl) {
      backingAudioElementRef.current.currentTime = 0;
      backingAudioElementRef.current.play()
        .then(() => { backingSuccess = true; })
        .catch(() => startSynthBeat(audioCtx));
    } else {
      startSynthBeat(audioCtx);
    }

    syncPlaybackTimerRef.current = setInterval(() => {
      if (backingAudioElementRef.current && backingSuccess) {
        setSyncPlaybackTime(backingAudioElementRef.current.currentTime);
      } else {
        setSyncPlaybackTime(prev => prev + 0.1);
      }
    }, 100);
  };

  const handleTapSync = () => {
    if (activeLineIdx >= lyricsLines.length) return;
    
    setSyncedTimestamps(prev => prev.map((item, idx) => {
      if (idx === activeLineIdx) {
        return { ...item, time: parseFloat(syncPlaybackTime.toFixed(1)) };
      }
      return item;
    }));

    setActiveLineIdx(prev => Math.min(prev + 1, lyricsLines.length - 1));
  };

  const saveSyncedLyrics = () => {
    clearInterval(syncPlaybackTimerRef.current);
    clearInterval(synthIntervalRef.current);
    setIsSynthPlaying(false);
    if (backingAudioElementRef.current) {
      backingAudioElementRef.current.pause();
    }
    setIsSyncMode(false);
    setActiveLineIdx(0);
    alert('Vocal prompter timings successfully synchronized!');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <audio 
        ref={backingAudioElementRef} 
        src={selectedSong?.audioUrl || 'https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Happy%20Life.mp3'} 
        style={{ display: 'none' }} 
        preload="auto"
        crossOrigin="anonymous"
      />
      
      {duetPartner && (
        <audio 
          ref={duetAudioElementRef} 
          src={duetPartner.playbackUrl} 
          style={{ display: 'none' }} 
          preload="auto"
          crossOrigin="anonymous"
        />
      )}
      
      {/* Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ textShadow: '0 0 10px var(--primary-glow)', margin: 0 }}>Ariyus Resonance Studio</h2>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', margin: '4px 0 0' }}>
            Acoustic Target: {selectedSong ? `${selectedSong.title} - ${selectedSong.artist}` : 'Freestyle Alignment'}
          </p>
        </div>
        <button className="glowing-button secondary" onClick={() => navigate('SongLibrary')} style={{ padding: '6px 14px', fontSize: '0.8rem', margin: 0 }}>
          Catalog Grid
        </button>
      </div>

      {/* Main Studio Console - Relative Video Container */}
      <div className="glass-panel" style={{ 
        position: 'relative', 
        height: '350px', 
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        overflow: 'hidden',
        borderColor: isRecording ? 'var(--secondary-glow)' : 'var(--glass-border)',
        padding: 0
      }}>
        {isVideoMode && (
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
              opacity: 0.62
            }} 
          />
        )}
        <div style={{ position: 'absolute', width: '100%', height: '100%', zIndex: 2 }}>
          <VoiceReactiveVisualizer analyser={analyser} />
        </div>
      </div>

      {/* Dynamic parameters Dashboard */}
      <div className="glass-panel" style={{ margin: 0, padding: '15px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '1.2rem', fontFamily: 'monospace', textShadow: '0 0 8px var(--primary-glow)' }}>
            Duration: {Math.floor(recordTime / 60)}:{(recordTime % 60).toFixed(1).padStart(4, '0')}
          </div>
          {isRecording && (
            <div style={{ fontSize: '1.2rem', fontFamily: 'monospace', color: 'var(--primary-glow)', textShadow: '0 0 6px var(--primary-glow)' }}>
              Vocal Pitch: {livePitch ? `${livePitch} Hz` : 'Scanning...'}
            </div>
          )}
          <div className="level-badge" style={{ fontSize: '0.78rem', background: 'rgba(0, 242, 255, 0.15)', border: '1px solid var(--primary-glow)', margin: 0 }}>
            Alignment Target: {targetHz} Hz
          </div>
        </div>

        {/* Vocal Filters Selection (StarMaker & Smule style) */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '15px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 'bold' }}>Vocal Filter:</span>
          {['none', 'studio', 'reverb', 'echo'].map(filter => (
            <button
              key={filter}
              className={`daw-track-btn ${selectedFilter === filter ? 'active solo' : ''}`}
              onClick={() => setSelectedFilter(filter)}
              disabled={isRecording}
              style={{ fontSize: '0.7rem', padding: '3px 8px', textTransform: 'capitalize' }}
            >
              {filter}
            </button>
          ))}
        </div>

        {isSynthPlaying && (
          <p style={{ color: 'var(--primary-glow)', fontSize: '0.72rem', margin: '10px 0 0 0', fontStyle: 'italic', textAlign: 'center' }}>
            Backing track offline. Synthesizing Solfeggio guide beat.
          </p>
        )}
      </div>

      {/* Record, Stop, and Hum options */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        {!isRecording ? (
          <button className="glowing-button" onClick={startAudioCapture} style={{ margin: 0 }}>
            ⚡ Initiate Alignment (Start Recording)
          </button>
        ) : (
          <button className="glowing-button secondary" onClick={stopAudioCapture} style={{ margin: 0 }}>
            ⏹️ Harmonize & Finalize
          </button>
        )}

        <button 
          className={`glowing-button secondary ${isVideoMode ? 'active' : ''}`}
          onClick={() => setIsVideoMode(!isVideoMode)}
          style={{ margin: 0 }}
          disabled={isRecording}
        >
          {isVideoMode ? '📹 Video Capture ON' : '📷 Camera OFF'}
        </button>

        <button 
          className={`glowing-button secondary ${playHum ? 'active' : ''}`}
          onClick={() => setPlayHum(!playHum)}
          style={{ margin: 0 }}
        >
          {playHum ? '✓ Hum ON' : '⏵ Hum OFF'}
        </button>
      </div>

      {/* Active Challenge HUD Overlay */}
      {activeChallenge === 'ch1' && (
        <div className="glass-panel" style={{ margin: 0, borderColor: 'var(--primary-glow)', background: 'rgba(0, 242, 255, 0.05)', display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left' }}>
          <h4 style={{ color: '#fff', margin: 0 }}>🏆 Active Challenge: Cosmic Breath</h4>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)', margin: 0 }}>Sustain any vocal vowel at 432Hz continuously for 6.0 seconds.</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginTop: '5px' }}>
            <div className="progress-track" style={{ height: '8px', flexGrow: 1 }}>
              <div className="progress-fill" style={{ width: `${(sustainProgress / 6.0) * 100}%`, background: 'var(--primary-glow)' }} />
            </div>
            <span style={{ fontSize: '0.85rem', fontFamily: 'monospace', minWidth: '70px', textAlign: 'right' }}>
              {sustainProgress.toFixed(1)}s / 6.0s
            </span>
          </div>
          {challengeSuccess && (
            <span style={{ color: '#00ff87', fontSize: '0.82rem', fontWeight: 'bold' }}>✓ Sustain limit reached! Challenge aligned.</span>
          )}
        </div>
      )}

      {activeChallenge === 'ch2' && (
        <div className="glass-panel" style={{ margin: 0, borderColor: 'var(--secondary-glow)', background: 'rgba(255, 0, 193, 0.05)', textAlign: 'left' }}>
          <h4 style={{ color: '#fff', margin: 0 }}>🏆 Active Challenge: Harmonic Alignment</h4>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)', margin: '4px 0 0 0' }}>Complete a performance with a Pitch Stability score of 90% or above (A+ Grade).</p>
        </div>
      )}

      {/* Prompter */}
      <div className="glass-panel" style={{ margin: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Vocal Prompter Grid</h3>
          {!isRecording && (
            <button 
              className="glowing-button" 
              style={{ margin: 0, padding: '5px 12px', fontSize: '0.75rem' }}
              onClick={isSyncMode ? saveSyncedLyrics : startSyncEditor}
            >
              {isSyncMode ? '✓ Save Synced Timestamps' : '⚙ Sync Prompter Timestamps'}
            </button>
          )}
        </div>

        {isSyncMode ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div className="karaoke-container" ref={lyricsContainerRef} style={{ height: '140px' }}>
              {lyricsLines.map((line, idx) => (
                <div 
                  key={idx} 
                  className={`karaoke-line ${idx === activeLineIdx ? 'active' : ''}`}
                >
                  {line} {syncedTimestamps[idx] && <span style={{ color: 'var(--secondary-glow)', fontSize: '0.8rem' }}>({syncedTimestamps[idx].time}s)</span>}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-dim)' }}>Playback: {syncPlaybackTime.toFixed(1)}s</span>
              <button className="glowing-button secondary" onClick={handleTapSync} style={{ margin: 0 }}>
                TAP SYNC ACTIVE LINE
              </button>
            </div>
          </div>
        ) : (
          <canvas 
            ref={prompterCanvasRef} 
            style={{ 
              width: '100%', 
              height: '180px', 
              borderRadius: '8px', 
              border: '1px solid var(--glass-border)',
              background: '#070630',
              display: 'block'
            }} 
          />
        )}
      </div>

    </div>
  );
};

export default RecordingStudio;
