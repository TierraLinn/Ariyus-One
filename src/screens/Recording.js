import React, { useState, useEffect, useRef } from 'react';
import VoiceReactiveVisualizer from '../components/VoiceReactiveVisualizer';

const RecordingStudio = ({ selectedSong, setCurrentRecording, navigate, setError }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [activeLineIdx, setActiveLineIdx] = useState(0);
  const [lyricsLines, setLyricsLines] = useState([]);
  
  // Solfeggio Hum toggle
  const [playHum, setPlayHum] = useState(false);
  const [isSynthPlaying, setIsSynthPlaying] = useState(false);

  // Web Audio & Media Recorder Refs
  const audioContextRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const [analyser, setAnalyser] = useState(null);

  // Synthesizer / Oscillator Refs
  const humOscRef = useRef(null);
  const humGainRef = useRef(null);
  const synthIntervalRef = useRef(null);

  // Sync Editor Mode state
  const [isSyncMode, setIsSyncMode] = useState(false);
  const [syncedTimestamps, setSyncedTimestamps] = useState([]);
  const [syncPlaybackTime, setSyncPlaybackTime] = useState(0);
  
  const timerRef = useRef(null);
  const syncPlaybackTimerRef = useRef(null);
  const lyricsContainerRef = useRef(null);
  const backingAudioElementRef = useRef(null);

  // Intention presets mapping to target Hertz
  const getHzFromSongKey = (key = '') => {
    const numeric = parseInt(key.replace(/[^0-9]/g, ''));
    if (numeric && [396, 417, 432, 528, 639, 741, 852].includes(numeric)) {
      return numeric;
    }
    return 528; // Default transform frequency
  };

  const targetHz = getHzFromSongKey(selectedSong?.key);

  useEffect(() => {
    const currentAudio = backingAudioElementRef.current;
    return () => {
      if (currentAudio) {
        currentAudio.pause();
      }
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
      
      // Request mic stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioContextRef.current = audioCtx;

      const sourceNode = audioCtx.createMediaStreamSource(stream);
      const analyserNode = audioCtx.createAnalyser();
      analyserNode.fftSize = 128;
      sourceNode.connect(analyserNode);
      setAnalyser(analyserNode);

      // Start Hum
      startHumOscillator(audioCtx);

      // Media recorder
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
        
        setCurrentRecording({
          playbackUrl,
          selectedSong: selectedSong || { title: 'Freestyle Resonance', artist: 'Self', audioUrl: '' },
          signature: generateVoiceSignature(),
          tones: generateToneProfile(),
          recordTime,
          analyser: analyserNode
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

      if (!playBackingSuccess) {
        startSynthBeat(audioCtx);
      }

      mediaRecorder.start();
      setIsRecording(true);
      setRecordTime(0);

      timerRef.current = setInterval(() => {
        if (backingAudioElementRef.current && playBackingSuccess) {
          setRecordTime(backingAudioElementRef.current.currentTime);
        } else {
          setRecordTime(prev => prev + 0.1);
        }
      }, 100);

    } catch (err) {
      console.warn("Microphone access failed. Starting in simulated sandbox mode.", err);
      
      // Sandbox: Web Audio guide tones only
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioContextRef.current = audioCtx;

      startHumOscillator(audioCtx);
      startSynthBeat(audioCtx);

      setIsRecording(true);
      setRecordTime(0);
      setAnalyser(null);
      
      timerRef.current = setInterval(() => {
        setRecordTime(prev => prev + 0.1);
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

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    } else {
      // Sandbox Mock Finalize
      const mockBlob = new Blob(['wav placeholder waveforms'], { type: 'audio/mp3' });
      const playbackUrl = URL.createObjectURL(mockBlob);

      setCurrentRecording({
        playbackUrl,
        selectedSong: selectedSong || { title: 'Freestyle Resonance', artist: 'Self', audioUrl: '' },
        signature: generateVoiceSignature(),
        tones: generateToneProfile(),
        recordTime
      });
      navigate('Results');
    }
  };

  const generateVoiceSignature = () => {
    const isHigh = selectedSong?.difficulty === 'Hard';
    const vocalTypes = isHigh ? ['Soprano', 'Tenor'] : ['Alto', 'Baritone'];
    const type = vocalTypes[Math.floor(Math.random() * vocalTypes.length)];
    const resonances = ['Mixed Voice', 'Chest Resonance', 'Vocal Mask Tuning', 'Head Frequency'];

    return {
      vocalType: type,
      resonanceType: resonances[Math.floor(Math.random() * resonances.length)],
      dominantFreq: isHigh ? `${340 + Math.floor(Math.random() * 90)} Hz` : `${120 + Math.floor(Math.random() * 50)} Hz`,
      energy: 72 + Math.floor(Math.random() * 20),
      flow: 68 + Math.floor(Math.random() * 26),
      expression: 75 + Math.floor(Math.random() * 20),
      breath: 70 + Math.floor(Math.random() * 25),
      stability: 78 + Math.floor(Math.random() * 18)
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
        src={selectedSong?.audioUrl || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'} 
        style={{ display: 'none' }} 
      />
      
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

      {/* Main Studio Console */}
      <div className="glass-panel" style={{ textAlign: 'center', borderColor: isRecording ? 'var(--secondary-glow)' : 'var(--glass-border)' }}>
        
        {/* Dynamic visualizer */}
        <VoiceReactiveVisualizer analyser={analyser} />

        {/* Dynamic Hertz & Playback parameters */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', margin: '10px 0', alignItems: 'center' }}>
          <div style={{ fontSize: '1.25rem', fontFamily: 'monospace', textShadow: '0 0 8px var(--primary-glow)' }}>
            Duration: {Math.floor(recordTime / 60)}:{(recordTime % 60).toFixed(1).padStart(4, '0')}
          </div>
          <div className="level-badge" style={{ fontSize: '0.78rem', background: 'rgba(0, 242, 255, 0.15)', border: '1px solid var(--primary-glow)' }}>
            Alignment Target: {targetHz} Hz
          </div>
        </div>

        {/* Record, Stop, and Hum options */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
          {!isRecording ? (
            <button className="glowing-button" onClick={startAudioCapture}>
              ⚡ Initiate Alignment (Start Recording)
            </button>
          ) : (
            <button className="glowing-button secondary" onClick={stopAudioCapture}>
              ⏹️ Harmonize & Finalize
            </button>
          )}

          {/* Alignment Carrier Hum Option */}
          <button 
            className={`glowing-button secondary ${playHum ? 'active' : ''}`}
            onClick={() => setPlayHum(!playHum)}
            style={{ margin: 0 }}
          >
            {playHum ? '✓ Alignment Hum ON' : '⏵ Alignment Hum OFF'}
          </button>
        </div>
        {isSynthPlaying && (
          <p style={{ color: 'var(--primary-glow)', fontSize: '0.8rem', margin: '8px 0 0 0', fontStyle: 'italic' }}>
            Backing track stream offline. Generating synthesized Solfeggio guide beat.
          </p>
        )}
      </div>

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
          <div className="karaoke-container" ref={lyricsContainerRef}>
            {lyricsLines.map((line, idx) => (
              <div 
                key={idx} 
                className={`karaoke-line ${idx === activeLineIdx ? 'active' : idx < activeLineIdx ? 'passed' : ''}`}
              >
                {line}
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default RecordingStudio;
