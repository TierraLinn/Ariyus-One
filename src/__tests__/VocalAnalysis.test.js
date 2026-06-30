import { 
  getPitchFromAudioData, 
  calculateVocalSignature,
  calculateBiomarkers, 
  mapChakras, 
  getPlaybackRateForFrequency,
  getGrading
} from '../utils/vocalDSP';

describe('Ariyus-One Vocal Analysis & DSP Suite', () => {

  test('Autocorrelation Pitch Tracker locates correct frequency (440Hz Sine Wave)', () => {
    const sampleRate = 44100;
    const frequency = 440;
    const bufferLength = 512;
    const dataArray = new Uint8Array(bufferLength);

    // Generate a perfect synthetic time-domain sine wave of 440 Hz centered at 128 (8-bit)
    for (let i = 0; i < bufferLength; i++) {
      const angle = (2 * Math.PI * frequency * i) / sampleRate;
      const normalizedValue = Math.sin(angle);
      dataArray[i] = Math.round(128 + 127 * normalizedValue);
    }

    const estimatedPitch = getPitchFromAudioData(dataArray, sampleRate);

    // Margin of ±5 Hz due to buffer length discretization
    expect(estimatedPitch).toBeGreaterThanOrEqual(435);
    expect(estimatedPitch).toBeLessThanOrEqual(445);
  });

  test('Autocorrelation Pitch Tracker returns 0 for silence', () => {
    const sampleRate = 44100;
    const dataArray = new Uint8Array(512).fill(128); // silent center

    const estimatedPitch = getPitchFromAudioData(dataArray, sampleRate);
    expect(estimatedPitch).toBe(0);
  });

  test('Vocal Signature Calibration calculates ranges correctly', () => {
    const pitchHistory = [220, 222, 218, 220, 221]; // Alto baseline range
    const amplitudeHistory = [0.15, 0.16, 0.14, 0.15, 0.15];

    const signature = calculateVocalSignature(pitchHistory, amplitudeHistory);
    expect(signature.averagePitch).toBe(220);
    expect(signature.vocalType).toBe('Alto');
    expect(signature.stability).toBeGreaterThanOrEqual(80);
    expect(signature.hnr).toBeGreaterThanOrEqual(60);
  });

  test('Speech Biomarkers derive logical indicators from vocal signatures', () => {
    const highStabilitySig = { stability: 95, energy: 80, breath: 90, vocalType: 'Alto' };
    const lowStabilitySig = { stability: 50, energy: 80, breath: 90, vocalType: 'Alto' };

    const biomarkersHigh = calculateBiomarkers(highStabilitySig);
    const biomarkersLow = calculateBiomarkers(lowStabilitySig);

    // Lower stability translates to higher jitter score
    expect(biomarkersHigh.jitter).toBeLessThan(biomarkersLow.jitter);
    expect(biomarkersHigh.hnr).toBe(Math.round(55 + (90 / 100) * 35));
    expect(biomarkersHigh.centroid).toBe(410);
  });

  test('Chakra mapper maps biomarker scores accurately', () => {
    const biomarkers = { jitter: 0.5, shimmer: 1.0, hnr: 80, centroid: 380 };
    const chakras = mapChakras(biomarkers);

    const throat = chakras.find(c => c.name.includes('Throat'));
    const heart = chakras.find(c => c.name.includes('Heart'));
    const thirdEye = chakras.find(c => c.name.includes('Third Eye'));

    expect(throat.score).toBe(80);
    expect(heart.score).toBe(80); // 100 - 1.0 * 20
    expect(thirdEye.score).toBe(85); // 100 - 0.5 * 30
  });

  test('getPlaybackRateForFrequency returns correct transposition multipliers', () => {
    expect(getPlaybackRateForFrequency(432)).toBe(432 / 440.00);
    expect(getPlaybackRateForFrequency(444)).toBe(444 / 440.00);
    expect(getPlaybackRateForFrequency(528)).toBe(528 / 523.25);
    expect(getPlaybackRateForFrequency(963)).toBe(963 / 987.77);
    expect(getPlaybackRateForFrequency(9999)).toBe(1.0); // default
  });

  test('Grading system converts accuracy scores correctly', () => {
    expect(getGrading(96).letter).toBe('A++');
    expect(getGrading(91).letter).toBe('A+');
    expect(getGrading(85).letter).toBe('A');
    expect(getGrading(75).letter).toBe('B');
    expect(getGrading(65).letter).toBe('C');
    expect(getGrading(55).letter).toBe('D');
    expect(getGrading(35).letter).toBe('F');
  });
});
