/* audio.js — procedural soundtrack via Web Audio + speech via SpeechSynthesis.
   Both are built into modern browsers. No external libraries, no API calls. */
(function (global) {
  "use strict";

  let ctx = null;
  let masterGain = null;
  let currentLoop = null; // { stop: () => void }
  let enabled = false;

  // Per-genre soundtrack settings. Each defines a chord progression and tempo.
  const TRACKS = {
    anime:   { bpm: 92,  scale: "minor",  root: 220.00, prog: [0, 5, 3, 4],  pad: "triangle", lead: "sine"   },
    scifi:   { bpm: 80,  scale: "minor",  root: 174.61, prog: [0, 6, 3, 4],  pad: "sawtooth", lead: "square" },
    fantasy: { bpm: 76,  scale: "major",  root: 196.00, prog: [0, 4, 5, 3],  pad: "triangle", lead: "sine"   },
    horror:  { bpm: 56,  scale: "minor",  root: 110.00, prog: [0, 1, 0, 6],  pad: "sawtooth", lead: "square" },
    comedy:  { bpm: 120, scale: "major",  root: 261.63, prog: [0, 3, 4, 0],  pad: "triangle", lead: "square" },
    mystery: { bpm: 70,  scale: "minor",  root: 164.81, prog: [0, 5, 4, 6],  pad: "sine",     lead: "triangle"}
  };

  // Scale degree → semitone offset.
  const SCALE_OFFSETS = {
    minor: [0, 2, 3, 5, 7, 8, 10, 12],
    major: [0, 2, 4, 5, 7, 9, 11, 12]
  };

  function ensureCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.18;
      masterGain.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function semitoneToHz(rootHz, semitones) {
    return rootHz * Math.pow(2, semitones / 12);
  }

  // Trigger a single tone with envelope.
  function playNote({ freq, type, start, dur, gain }) {
    const c = ctx;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(gain, start + 0.02);
    g.gain.linearRampToValueAtTime(gain * 0.6, start + dur * 0.6);
    g.gain.linearRampToValueAtTime(0, start + dur);
    osc.connect(g);
    g.connect(masterGain);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  // Build a chord (3 notes) at a scale degree.
  function chordFreqs(rootHz, scale, degree) {
    const offsets = SCALE_OFFSETS[scale];
    const base = offsets[degree % 7];
    return [
      semitoneToHz(rootHz, base),
      semitoneToHz(rootHz, base + (scale === "minor" ? 3 : 4)),
      semitoneToHz(rootHz, base + 7)
    ];
  }

  // Start an indefinite procedural loop for a given genre/mood.
  function startLoop(styleKey, mood) {
    if (!ensureCtx() || !enabled) return;
    if (currentLoop) currentLoop.stop();

    const cfg = TRACKS[styleKey] || TRACKS.anime;
    const moodMod = {
      calm:       { gain: 0.55, leadProb: 0.20 },
      tense:      { gain: 0.75, leadProb: 0.40 },
      determined: { gain: 0.85, leadProb: 0.55 },
      intense:    { gain: 1.00, leadProb: 0.75 },
      reflective: { gain: 0.50, leadProb: 0.25 }
    }[mood] || { gain: 0.7, leadProb: 0.4 };

    const beat = 60 / cfg.bpm;
    const barLen = beat * 4;
    let stopped = false;
    let bar = 0;

    function scheduleBar(when) {
      if (stopped) return;
      const degree = cfg.prog[bar % cfg.prog.length];
      const freqs = chordFreqs(cfg.root, cfg.scale, degree);

      // Pad: hold the chord through the bar.
      freqs.forEach((f, i) => {
        playNote({
          freq: f, type: cfg.pad,
          start: when, dur: barLen,
          gain: 0.06 * moodMod.gain * (i === 0 ? 1 : 0.7)
        });
      });

      // Bass on beats 1 and 3
      playNote({
        freq: freqs[0] / 2,
        type: "sine",
        start: when, dur: beat * 0.9,
        gain: 0.10 * moodMod.gain
      });
      playNote({
        freq: freqs[0] / 2,
        type: "sine",
        start: when + beat * 2, dur: beat * 0.9,
        gain: 0.09 * moodMod.gain
      });

      // Lead — only sometimes, walks up the chord tones.
      if (Math.random() < moodMod.leadProb) {
        const order = [0, 2, 1, 2];
        for (let i = 0; i < 4; i++) {
          if (Math.random() < 0.7) {
            playNote({
              freq: freqs[order[i]] * 2,
              type: cfg.lead,
              start: when + beat * i + beat * 0.05,
              dur: beat * 0.45,
              gain: 0.07 * moodMod.gain
            });
          }
        }
      }

      bar++;
      // Schedule the next bar slightly before this one ends.
      const next = when + barLen;
      const lookahead = Math.max(0, (next - ctx.currentTime - 0.1) * 1000);
      setTimeout(() => scheduleBar(next), lookahead);
    }

    const startAt = ctx.currentTime + 0.1;
    scheduleBar(startAt);

    currentLoop = {
      stop: () => {
        stopped = true;
        // Fade master gently to avoid clicks
        if (masterGain) {
          const now = ctx.currentTime;
          masterGain.gain.cancelScheduledValues(now);
          masterGain.gain.setValueAtTime(masterGain.gain.value, now);
          masterGain.gain.linearRampToValueAtTime(0.0, now + 0.4);
          setTimeout(() => {
            if (masterGain) masterGain.gain.value = 0.18;
          }, 500);
        }
      }
    };
  }

  function stopLoop() {
    if (currentLoop) {
      currentLoop.stop();
      currentLoop = null;
    }
  }

  // One-shot UI/scene transition sound.
  function playWhoosh() {
    if (!ensureCtx() || !enabled) return;
    const c = ctx;
    const t = c.currentTime;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.4);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.18, t + 0.05);
    g.gain.linearRampToValueAtTime(0, t + 0.4);

    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1200;

    osc.connect(filter);
    filter.connect(g);
    g.connect(masterGain);
    osc.start(t);
    osc.stop(t + 0.45);
  }

  // -------- Speech synthesis ---------------------------------------
  const synth = window.speechSynthesis || null;
  let cachedVoices = [];

  function loadVoices() {
    if (!synth) return;
    cachedVoices = synth.getVoices() || [];
  }
  if (synth) {
    loadVoices();
    synth.onvoiceschanged = loadVoices;
  }

  // Pick a stable voice + pitch/rate per character.
  function pickVoiceFor(speaker) {
    if (!cachedVoices.length) loadVoices();
    if (!cachedVoices.length) return null;

    let h = 0;
    for (let i = 0; i < speaker.length; i++) h = (h * 31 + speaker.charCodeAt(i)) | 0;
    h = Math.abs(h);

    const englishVoices = cachedVoices.filter(v => v.lang && v.lang.toLowerCase().startsWith("en"));
    const pool = englishVoices.length ? englishVoices : cachedVoices;
    const voice = pool[h % pool.length];
    const pitch = 0.7 + ((h >> 3) % 80) / 100; // 0.70 – 1.50
    const rate  = 0.85 + ((h >> 6) % 35) / 100; // 0.85 – 1.20
    return { voice, pitch, rate };
  }

  function speak(speaker, text, opts) {
    if (!synth || !enabled) return null;
    if (!text) return null;
    try {
      const u = new SpeechSynthesisUtterance(text);
      const choice = pickVoiceFor(speaker || "narrator");
      if (choice && choice.voice) u.voice = choice.voice;
      if (choice) {
        u.pitch = choice.pitch;
        u.rate = choice.rate;
      }
      // Narrator gets a slower, lower delivery
      if ((speaker || "").toLowerCase() === "narrator") {
        u.rate = 0.92;
        u.pitch = 0.85;
      }
      u.volume = (opts && opts.volume != null) ? opts.volume : 0.95;
      synth.speak(u);
      return u;
    } catch (_) {
      return null;
    }
  }

  function cancelSpeech() {
    if (synth) {
      try { synth.cancel(); } catch (_) {}
    }
  }

  function setEnabled(v) {
    enabled = !!v;
    if (!enabled) {
      stopLoop();
      cancelSpeech();
    }
  }
  function isEnabled() { return enabled; }

  global.MovieAudio = {
    setEnabled, isEnabled,
    startLoop, stopLoop,
    playWhoosh,
    speak, cancelSpeech
  };
})(window);
