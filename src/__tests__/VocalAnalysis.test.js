import { 
  getPitchFromAudioData, 
  calculateBiomarkers, 
  mapChakras, 
  getPlaybackRateForFrequency 
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

    // The estimated pitch should be approximately 440 Hz (autocorrelation margin of ±5 Hz due to discretization)
    expect(estimatedPitch).toBeGreaterThanOrEqual(435);
    expect(estimatedPitch).toBeLessThanOrEqual(445);
  });

  test('Autocorrelation Pitch Tracker returns 0 for silence', () => {
    const sampleRate = 44100;
    const dataArray = new Uint8Array(512).fill(128); // silent center

    const estimatedPitch = getPitchFromAudioData(dataArray, sampleRate);
    expect(estimatedPitch).toBe(0);
  });

  test('Speech Biomarkers derive logical indicators from vocal signatures', () => {
    const highStabilitySig = { stability: 95, energy: 80, breath: 90, vocalType: 'Alto' };
    const lowStabilitySig = { stability: 50, energy: 80, breath: 90, vocalType: 'Alto' };

    const biomarkersHigh = calculateBiomarkers(highStabilitySig);
    const biomarkersLow = calculateBiomarkers(lowStabilitySig);

    // Lower stability should translate to higher jitter score
    expect(biomarkersHigh.jitter).toBeLessThan(biomarkersLow.jitter);
    expect(biomarkersHigh.hnr).toBe(Math.round(55 + (90 / 100) * 35));
    expect(biomarkersHigh.centroid).toBe(410); // 380 + 30
  });

  test('Chakra mapper maps biomarker scores accurately', () => {
    const biomarkers = { jitter: 0.5, shimmer: 1.0, hnr: 80, centroid: 380 };
    const chakras = mapChakras(biomarkers);

    const throat = chakras.find(c => c.name.includes('Throat'));
    const heart = chakras.find(c => c.name.includes('Heart'));
    const thirdEye = chakras.find(c => c.name.includes('Third Eye'));
    const root = chakras.find(c => c.name.includes('Root'));

    expect(throat.score).toBe(80);
    expect(heart.score).toBe(80); // 100 - 1.0 * 20
    expect(thirdEye.score).toBe(85); // 100 - 0.5 * 30
    expect(root.score).toBe(Math.round(110 - (380 / 5)));
  });

  test('getPlaybackRateForFrequency returns correct transposition multipliers', () => {
    expect(getPlaybackRateForFrequency(432)).toBe(432 / 440.00);
    expect(getPlaybackRateForFrequency(444)).toBe(444 / 440.00);
    expect(getPlaybackRateForFrequency(528)).toBe(528 / 523.25);
    expect(getPlaybackRateForFrequency(963)).toBe(963 / 987.77);
    expect(getPlaybackRateForFrequency(9999)).toBe(1.0); // default
  });
});
