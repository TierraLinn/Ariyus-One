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

  return {
    averagePitch,
    vocalType,
    stability,
    energy,
    breath,
    jitter: parseFloat(Math.max(0.1, Math.min(2.0, jitter * 10)).toFixed(2)),
    shimmer: parseFloat(Math.max(0.2, Math.min(3.0, shimmer * 8)).toFixed(2)),
    hnr,
    centroid
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
