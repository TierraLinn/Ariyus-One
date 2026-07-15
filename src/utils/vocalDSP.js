/**
 * Ariyus-One DSP & Vocal Analysis Utility Library
 * Core mathematical kernels for pitch tracking, speech biomarkers, and biofield resonance.
 */

/**
 * Autocorrelation Pitch Detection Algorithm
 * Estimates fundamental frequency (F0) from a time-domain audio buffer.
 * @param {Uint8Array} dataArray - Raw time-domain signal (0 to 255, centered at 128)
 * @param {number} sampleRate - Audio context sampling rate (typically 44100 or 48000)
 * @returns {number} Estimated pitch in Hz, or 0 if silent/untracked
 */
export const getPitchFromAudioData = (dataArray, sampleRate) => {
  const bufferLength = dataArray.length;
  const signal = new Float32Array(bufferLength);
  let isSilent = true;

  // Normalize signal to [-1.0, 1.0] range
  for (let i = 0; i < bufferLength; i++) {
    const val = (dataArray[i] - 128) / 128;
    signal[i] = val;
    if (Math.abs(val) > 0.02) {
      isSilent = false;
    }
  }

  if (isSilent) return 0;

  // Calculate Autocorrelation (R) for the first half of the buffer
  const r = new Float32Array(bufferLength / 2);
  for (let lag = 0; lag < bufferLength / 2; lag++) {
    let sum = 0;
    for (let i = 0; i < bufferLength / 2; i++) {
      sum += signal[i] * signal[i + lag];
    }
    r[lag] = sum;
  }

  // Find the first zero crossing to avoid tracking the peak at lag 0
  let firstZeroCrossing = -1;
  for (let i = 0; i < bufferLength / 2; i++) {
    if (r[i] < 0) {
      firstZeroCrossing = i;
      break;
    }
  }

  if (firstZeroCrossing === -1) return 0;

  // Detect peak frequency beyond the zero crossing
  let peak = -1;
  let maxVal = -1;
  const threshold = 0.15 * r[0];

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

/**
 * Calculates a user's Vocal Signature baseline from calibration recording history.
 * @param {Array<number>} pitchHistory - Array of raw pitch values in Hz
 * @param {Array<number>} amplitudeHistory - Array of volume indicators
 * @returns {object} Derived Vocal Signature stats
 */
export const calculateVocalSignature = (pitchHistory, amplitudeHistory) => {
  const activePitches = pitchHistory.filter(p => p > 50 && p < 1200);
  const activeAmps = amplitudeHistory.filter(a => a > 0.01);

  if (activePitches.length === 0) {
    return {
      averagePitch: 220,
      vocalType: 'Alto',
      stability: 75,
      energy: 70,
      breath: 75,
      jitter: 0.8,
      shimmer: 0.9,
      hnr: 65,
      centroid: 260
    };
  }

  // Compute average pitch
  const sumPitch = activePitches.reduce((acc, p) => acc + p, 0);
  const averagePitch = Math.round(sumPitch / activePitches.length);

  // Classify vocal type
  let vocalType = 'Alto';
  if (averagePitch < 130) vocalType = 'Baritone';
  else if (averagePitch < 180) vocalType = 'Tenor';
  else if (averagePitch < 250) vocalType = 'Alto';
  else vocalType = 'Soprano';

  // Compute stability / Jitter (pitch variance)
  let diffSum = 0;
  for (let i = 1; i < activePitches.length; i++) {
    diffSum += Math.abs(activePitches[i] - activePitches[i - 1]);
  }
  const jitter = activePitches.length > 1 ? (diffSum / (activePitches.length - 1)) / averagePitch : 0.5;
  const stability = Math.round(Math.max(50, Math.min(99, 100 - (jitter * 400))));

  // Compute shimmer (volume variance)
  let ampDiffSum = 0;
  const avgAmp = activeAmps.length > 0 ? activeAmps.reduce((acc, a) => acc + a, 0) / activeAmps.length : 0.1;
  for (let i = 1; i < activeAmps.length; i++) {
    ampDiffSum += Math.abs(activeAmps[i] - activeAmps[i - 1]);
  }
  const shimmer = activeAmps.length > 1 ? (ampDiffSum / (activeAmps.length - 1)) / (avgAmp || 1) : 0.6;
  const energy = Math.round(Math.max(50, Math.min(99, avgAmp * 350 + 40)));

  // HNR calculation baseline
  const breath = Math.round(Math.max(50, Math.min(99, 100 - (shimmer * 150))));
  const hnr = Math.round(55 + (breath / 100) * 35);
  const centroid = vocalType === 'Baritone' ? 240 : (vocalType === 'Tenor' ? 300 : 410);
  // Formant estimation baselines matching standard physiological vocal tract sizes
  let formants = [520, 1540, 2480];
  if (vocalType === 'Baritone') {
    formants = [390, 1200, 2100];
  } else if (vocalType === 'Tenor') {
    formants = [450, 1350, 2280];
  } else if (vocalType === 'Soprano') {
    formants = [680, 1850, 2810];
  }

  return {
    averagePitch,
    vocalType,
    stability,
    energy,
    breath,
    jitter: parseFloat(Math.max(0.1, Math.min(2.0, jitter * 10)).toFixed(2)),
    shimmer: parseFloat(Math.max(0.2, Math.min(3.0, shimmer * 8)).toFixed(2)),
    hnr,
    centroid,
    formants
  };
};

/**
 * Speech Biomarkers Estimator
 * Derives vocal stability, shimmer, jitter, and HNR features.
 * @param {object} signature - User vocal signature object
 * @returns {object} Calculated biomarker stats
 */
export const calculateBiomarkers = (signature) => {
  const stability = signature?.stability ?? 84;
  const energy = signature?.energy ?? 78;
  const breath = signature?.breath ?? 88;
  const vocalType = signature?.vocalType ?? 'Alto';

  const baseJitter = 1.2 - (stability / 100) * 0.8;
  const baseShimmer = 1.6 - (energy / 100) * 1.0;
  const baseHnr = 55 + (breath / 100) * 35;
  const baseCentroid = vocalType === 'Baritone' ? 210 : 380;

  return {
    jitter: parseFloat(Math.max(0.2, Math.min(2.0, baseJitter)).toFixed(2)),
    shimmer: parseFloat(Math.max(0.4, Math.min(3.0, baseShimmer)).toFixed(2)),
    hnr: Math.round(Math.max(40, Math.min(95, baseHnr))),
    centroid: Math.round(baseCentroid + 30)
  };
};

/**
 * Chakra Resonance Biofield Mapper
 * Maps biomarkers to corresponding biological energy nodes.
 * @param {object} biomarkers - Derived biomarkers containing jitter, shimmer, hnr, and centroid
 * @returns {Array} List of chakra nodes with scores and descriptions
 */
export const mapChakras = (biomarkers) => {
  const { jitter, shimmer, hnr, centroid } = biomarkers;

  return [
    { 
      name: 'Throat (Vishuddha) Clarity', 
      score: hnr, 
      color: '#00f2ff', 
      desc: 'Resonates communication and truthful expression. Boosted by clear, harmonic tones.' 
    },
    { 
      name: 'Heart (Anahata) Coherence', 
      score: Math.round(100 - shimmer * 20), 
      color: '#00ff87', 
      desc: 'Balances respiratory harmonics and emotional peace. Linked to amplitude stability.' 
    },
    { 
      name: 'Third Eye (Ajna) Focus', 
      score: Math.round(100 - jitter * 30), 
      color: '#ff00c1', 
      desc: 'Reflects mental focus and frequency stability. Linked to pitch stability.' 
    },
    { 
      name: 'Root (Muladhara) Grounding', 
      score: Math.round(110 - (centroid / 5)), 
      color: '#ff3b30', 
      desc: 'Anchors lower body overtones and sub-bass resonance. Boosted by warm, deep overtones.' 
    }
  ];
};

/**
 * Maps performance accuracy (0 - 100%) to a standard StarMaker/Smule scale grading (A++ to F).
 * @param {number} score - Alignment/accuracy score
 * @returns {object} Letter grade, description, and color code
 */
export const getGrading = (score) => {
  if (score >= 95) return { letter: 'A++', desc: 'Absolute Alignment', color: '#ff00c1' };
  if (score >= 90) return { letter: 'A+', desc: 'Celestial Coherence', color: '#00f2ff' };
  if (score >= 80) return { letter: 'A', desc: 'Resonant Resonance', color: '#00ff87' };
  if (score >= 70) return { letter: 'B', desc: 'Balanced Harmonics', color: '#ffb700' };
  if (score >= 60) return { letter: 'C', desc: 'Partial Synchronization', color: '#ff7b00' };
  if (score >= 50) return { letter: 'D', desc: 'Unstable Alignment', color: '#ff3b30' };
  return { letter: 'F', desc: 'Out of Tune', color: '#888888' };
};

/**
 * Calculates transposition multiplier for selected Solfeggio target frequencies.
 */
export const getPlaybackRateForFrequency = (hz) => {
  switch (hz) {
    case 396: return 396 / 392.00; // Relative to G3
    case 417: return 417 / 415.30; // Relative to G#3
    case 432: return 432 / 440.00; // Relative to A4 (Cosmic cosmic sync)
    case 444: return 444 / 440.00; // Relative to A4 (Key of David)
    case 528: return 528 / 523.25; // Relative to C5
    case 639: return 639 / 659.25; // Relative to E5
    case 741: return 741 / 739.99; // Relative to F#5
    case 852: return 852 / 880.00; // Relative to A5
    case 963: return 963 / 987.77; // Relative to B5
    default: return 1.0;
  }
};

/**
 * Calculates the exact pitch shift ratio to convert a standard 440Hz song scale to target Hertz.
 */
export const getPitchShiftRatioForFrequency = (hz) => {
  switch (hz) {
    case 396: return 396 / 392.00; // Shift relative to G3
    case 417: return 417 / 415.30; // Shift relative to G#3
    case 432: return 432 / 440.00; // Shift standard A4 to Cosmic 432Hz
    case 444: return 444 / 440.00; // Shift standard A4 to Davidic 444Hz
    case 528: return 528 / 523.25; // Shift relative to C5
    case 639: return 639 / 659.25; // Shift relative to E5
    case 741: return 741 / 739.99; // Shift relative to F#5
    case 852: return 852 / 880.00; // Shift relative to A5
    case 963: return 963 / 987.77; // Shift relative to B5
    default: return 1.0;
  }
};

/**
 * Creates a real-time time-domain circular-buffer pitch shifter node.
 * This shifts pitch without modifying the timing/tempo of backing track playback.
 */
export const createPitchShifterNode = (audioContext, pitchRatio) => {
  if (typeof audioContext.createScriptProcessor !== 'function') {
    // Return a mock gain node if running in testing environment (e.g. jsdom)
    return audioContext.createGain ? audioContext.createGain() : { connect: () => {}, disconnect: () => {} };
  }
  const bufferSize = 512;
  const processor = audioContext.createScriptProcessor(bufferSize, 2, 2);
  
  const circularBufferLength = 8192;
  const cBuffers = [new Float32Array(circularBufferLength), new Float32Array(circularBufferLength)];
  let writeIdx = 0;
  
  processor.onaudioprocess = (e) => {
    const inputL = e.inputBuffer.getChannelData(0);
    const inputR = e.inputBuffer.getChannelData(1);
    const outputL = e.outputBuffer.getChannelData(0);
    const outputR = e.outputBuffer.getChannelData(1);
    
    const size = inputL.length;
    
    for (let i = 0; i < size; i++) {
      // Write incoming samples to circular buffer
      cBuffers[0][writeIdx] = inputL[i];
      cBuffers[1][writeIdx] = inputR[i];
      
      // Calculate output using pitchRatio resampled delay time offsets
      for (let ch = 0; ch < 2; ch++) {
        const buf = cBuffers[ch];
        
        // Modulated read pointer to pitch shift without changing playback speed
        const delayOffset = (i * (pitchRatio - 1)) % 1024;
        const readPos = (writeIdx - 512 + delayOffset + buf.length) % buf.length;
        
        const idx = Math.floor(readPos);
        const frac = readPos - idx;
        const nextIdx = (idx + 1) % buf.length;
        
        // Linear interpolation
        const sample = (1 - frac) * buf[idx] + frac * buf[nextIdx];
        
        if (ch === 0) outputL[i] = sample;
        else outputR[i] = sample;
      }
      
      writeIdx = (writeIdx + 1) % circularBufferLength;
    }
  };
  
  return processor;
};

/**
 * Formant Peaks Tracker
 * Extracts F1, F2, and F3 formants from frequency magnitude spectrum.
 * @param {Uint8Array} freqDataArray - Frequency magnitude bins
 * @param {number} sampleRate - sampling rate
 * @returns {Array<number>} [F1, F2, F3] formant peaks in Hz
 */
export const getFormantsFromSpectrum = (freqDataArray, sampleRate) => {
  const fftSize = freqDataArray.length * 2;
  const binResolution = sampleRate / fftSize;

  let f1 = 520;
  let f2 = 1540;
  let f3 = 2480;

  let maxMagF1 = -1;
  let maxMagF2 = -1;
  let maxMagF3 = -1;

  for (let i = 2; i < freqDataArray.length; i++) {
    const freq = i * binResolution;
    const mag = freqDataArray[i];

    // Local peak detection
    if (mag > freqDataArray[i - 1] && mag > freqDataArray[i + 1] && mag > 25) {
      if (freq >= 300 && freq < 1000) {
        if (mag > maxMagF1) {
          maxMagF1 = mag;
          f1 = freq;
        }
      } else if (freq >= 1000 && freq < 2400) {
        if (mag > maxMagF2) {
          maxMagF2 = mag;
          f2 = freq;
        }
      } else if (freq >= 2400 && freq < 3800) {
        if (mag > maxMagF3) {
          maxMagF3 = mag;
          f3 = freq;
        }
      }
    }
  }

  // Round values for clean UI
  return [Math.round(f1), Math.round(f2), Math.round(f3)];
};

