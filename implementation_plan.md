# Implementation Plan: Voice Diagnostics Engine, Earth's Heartbeat Sync & DAW Promotion

We will build a high-fidelity, real-time voice parameter analysis engine, integrate the Earth's Resonance Heartbeat Syncing System, restore active Solfeggio tuning, promote the Multitrack DAW to the main navigation bar, and ensure the DAW button is always visible on the Profile page ("ME" tab) regardless of tier.

---

## User Review Required

> [!IMPORTANT]
> **Key Technical Integrations:**
> 1. **DAW Visibility Fix:** We will make the "Launch Multi-Track DAW Workstation" button on the Profile screen ("ME" tab) visible to **all user tiers** by moving it outside of the `tier === 'Creator'` conditional check in `Profile.js`.
> 2. **Real-time Vocal Diagnostics Engine:** We will code a mathematical engine in `vocalDSP.js` to extract fundamental pitch ($F_0$), Formants ($F_1, F_2, F_3$), Jitter, Shimmer, and Harmonics-to-Noise Ratio (HNR). We will display these on a diagnostic dashboard on the Calibration screen.
> 3. **Earth's Resonance Heartbeat Syncing System:** In `Recording.js`, we will inject a subtle 7.83Hz Schumann resonance binaural wave (e.g. Left = $f$, Right = $f + 7.83$ Hz) and pan-modulate vocal delay lines using a 7.83Hz LFO to align the singer's biorhythms.
> 4. **Pristine Backing Track & Solfeggio Retuning:** 
>    - Remove the SoundHelix mapping override in `Sing.js` to restore original, clean pop instrumentals.
>    - Tune backing and partner tracks to target frequencies (432Hz, 528Hz, etc.) using native browser audio resampling (`preservesPitch = false` with custom `playbackRate`), preventing any JavaScript buffer crackle or latency.
> 5. **Multitrack DAW Navigation:** Add a primary **Studio DAW** button to the bottom navigation bar in `App.js` for instant access.

---

## Proposed Changes

### 1. DSP & Analysis Layer
#### [MODIFY] [vocalDSP.js](file:///C:/Users/tierr/Ariyus-One/src/utils/vocalDSP.js)
- Build a real-time analysis engine that extracts:
  - Jitter (frequency perturbation percentage).
  - Shimmer (amplitude perturbation percentage).
  - HNR (Harmonics-to-Noise Ratio in dB).
  - Formant frequency peaks ($F_1$ and $F_2$) using spectral peak clustering.
  - Authentic vocal classification range based on actual pitch bounds.

---

### 2. Vocal Onboarding Layer
#### [MODIFY] [VocalCalibration.js](file:///C:/Users/tierr/Ariyus-One/src/screens/VocalCalibration.js)
- Code a diagnostic dashboard displaying real-time meters for:
  - Pitch (Hz) & Vocal Type (Soprano, Tenor, Baritone, etc.)
  - Formant Peaks $F_1, F_2, F_3$ (Hz)
  - Jitter (%), Shimmer (%), and HNR (dB).
- Enhance the Sandbox Mode to simulate realistic vocal waves, formants, and jitter trends.

---

### 3. Song Catalog Layer
#### [MODIFY] [Sing.js](file:///C:/Users/tierr/Ariyus-One/src/screens/Sing.js)
- Remove the SoundHelix URL override to restore high-fidelity, clean royalty-free backing tracks.

---

### 4. Recording Studio Layer
#### [MODIFY] [Recording.js](file:///C:/Users/tierr/Ariyus-One/src/screens/Recording.js)
- Integrate the **Earth's Resonance Heartbeat Syncing System**:
  - Connect a binaural oscillator node matching the Earth's Schumann Resonance frequency of 7.83Hz.
  - Connect a 7.83Hz LFO to pan-modulate vocal delays.
- Re-enable the active Solfeggio pitch transposer for backing/partner audio elements using native resampling properties:
  ```javascript
  backingAudio.preservesPitch = false;
  backingAudio.playbackRate = selectedFreq / 440;
  ```

---

### 5. Results & DAW/Profile Layers
#### [MODIFY] [Results.js](file:///C:/Users/tierr/Ariyus-One/src/screens/Results.js)
- Restore the DAW `pitch` tab containing the Solfeggio sliders.
- Restore the bottom Solfeggio Retuning panel and the High Vibration Conversion Engine toggles.
- Apply native `preservesPitch = false` pitch transposition during preview mix playback.

#### [MODIFY] [Profile.js](file:///C:/Users/tierr/Ariyus-One/src/screens/Profile.js)
- Move the "Launch Multi-Track DAW Workstation" button outside of the `tier === 'Creator'` check so that it is always visible on the Profile tab (the "ME" icon) for every user.

#### [MODIFY] [Workstation.js](file:///C:/Users/tierr/Ariyus-One/src/screens/Workstation.js)
- Restore the Solfeggio Scale Selector dropdown.
- Enable active Solfeggio hertz transposition ratio during multitrack playback.

---

### 6. App Navigation Layer
#### [MODIFY] [App.js](file:///C:/Users/tierr/Ariyus-One/src/App.js)
- Add a primary **Studio DAW** tab button to the bottom navigation bar for instant access.

---

## Verification Plan

### Automated Tests
- Run integration and unit tests:
  ```powershell
  npm run test -- --watchAll=false
  ```

### Manual Verification
1. Launch the server, enter Demo Bypass Mode.
2. Verify that clicking the "ME" tab now displays the "Launch Multi-Track DAW Workstation" button directly under your profile.
3. Verify that the bottom navigation bar has a "Studio DAW" tab.
