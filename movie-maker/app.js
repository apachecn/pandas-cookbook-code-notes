/* app.js — UI controller. Wires the form, the player, and the modules together. */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const setupPanel = $("setup-panel");
  const theaterPanel = $("theater-panel");
  const form = $("setup-form");
  const ideaEl = $("idea");
  const styleEl = $("style");
  const sceneCountEl = $("scene-count");
  const sceneCountOut = $("scene-count-out");
  const enableAudioEl = $("enable-audio");
  const surpriseBtn = $("surprise-me");

  const dialogueBox = $("dialogue-box");
  const dialogueSpeaker = $("dialogue-speaker");
  const dialogueText = $("dialogue-text");
  const sceneMeta = $("scene-meta");
  const scriptOutput = $("script-output");

  const btnPrev = $("btn-prev");
  const btnPlay = $("btn-play");
  const btnNext = $("btn-next");
  const btnRestart = $("btn-restart");
  const btnEdit = $("btn-edit");

  // Player state
  let movie = null;
  let sceneIndex = 0;
  let dialogueIndex = -1; // -1 means "title card pending"
  let isPlaying = false;
  let advanceTimer = null;
  let typewriterTimer = null;
  let speakingUtterance = null;

  // Surprise prompts to seed the form.
  const SURPRISE_PROMPTS = [
    "A lonely robot finds a single flower growing in the desert.",
    "Two rival chefs are trapped in a haunted kitchen overnight.",
    "A cartographer discovers a city that does not appear on any map.",
    "A retired spy is asked to babysit, and the babysitting goes badly.",
    "A small dragon believes itself to be a house cat.",
    "A space miner intercepts a distress signal in their own voice.",
    "A librarian notices a book that returns itself, every night.",
    "A boy in a quiet town starts dreaming someone else's life."
  ];

  // ---------- Setup panel wiring -----------------------------------
  sceneCountEl.addEventListener("input", () => {
    sceneCountOut.textContent = sceneCountEl.value;
  });

  surpriseBtn.addEventListener("click", () => {
    const idx = Math.floor(Math.random() * SURPRISE_PROMPTS.length);
    ideaEl.value = SURPRISE_PROMPTS[idx];
    const styles = window.MovieStory.listStyles();
    styleEl.value = styles[Math.floor(Math.random() * styles.length)].key;
    sceneCountEl.value = 4 + Math.floor(Math.random() * 4);
    sceneCountOut.textContent = sceneCountEl.value;
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const idea = ideaEl.value.trim();
    const style = styleEl.value;
    const sceneCount = parseInt(sceneCountEl.value, 10);

    movie = window.MovieStory.generate({ idea, style, sceneCount });

    setupPanel.hidden = true;
    theaterPanel.hidden = false;
    renderScript(movie);
    window.MovieAudio.setEnabled(!!enableAudioEl.checked);
    startMovie();
  });

  btnEdit.addEventListener("click", () => {
    pause();
    window.MovieAudio.stopLoop();
    window.MovieAudio.cancelSpeech();
    setupPanel.hidden = false;
    theaterPanel.hidden = true;
  });

  btnPlay.addEventListener("click", () => {
    if (isPlaying) pause();
    else play();
  });

  btnPrev.addEventListener("click", () => {
    sceneIndex = Math.max(0, sceneIndex - 1);
    dialogueIndex = -1;
    cancelTimers();
    showScene();
    if (isPlaying) advanceAfter(800);
  });

  btnNext.addEventListener("click", () => {
    nextStep(true);
  });

  btnRestart.addEventListener("click", () => {
    sceneIndex = 0;
    dialogueIndex = -1;
    cancelTimers();
    startMovie();
  });

  // ---------- Movie playback ---------------------------------------
  function startMovie() {
    if (!movie) return;
    sceneIndex = 0;
    dialogueIndex = -1;
    isPlaying = true;
    btnPlay.textContent = "❚❚";
    showTitleThenScene();
  }

  function showTitleThenScene() {
    window.MovieAnimator.showTitleCard(movie.title, movie.subtitle);
    hideDialogue();
    sceneMeta.textContent = `${capitalize(movie.style)} · ${movie.scenes.length} scenes`;

    // Render scene 0 visually behind the title card (so it's ready when card hides)
    const scene = movie.scenes[0];
    window.MovieAnimator.renderScene(scene, movie.palette, { speakerId: null });

    if (window.MovieAudio.isEnabled()) {
      window.MovieAudio.playWhoosh();
      window.MovieAudio.startLoop(movie.style, scene.mood);
    }

    advanceTimer = setTimeout(() => {
      window.MovieAnimator.hideTitleCard();
      sceneIndex = 0;
      dialogueIndex = -1;
      showScene();
      if (isPlaying) advanceAfter(600);
    }, 2600);
  }

  function showScene() {
    if (!movie) return;
    const scene = movie.scenes[sceneIndex];
    if (!scene) return;
    window.MovieAnimator.renderScene(scene, movie.palette, { speakerId: null });
    sceneMeta.textContent = `Scene ${sceneIndex + 1} of ${movie.scenes.length} · ${scene.beat}`;
    if (window.MovieAudio.isEnabled()) {
      window.MovieAudio.playWhoosh();
      window.MovieAudio.startLoop(movie.style, scene.mood);
    }
    // Show the narration as the first dialogue line
    if (scene.dialogue && scene.dialogue.length) {
      dialogueIndex = -1; // will move to 0 when nextStep fires
    }
    showNarrationOverlay(scene.narration);
  }

  function showNarrationOverlay(text) {
    // Treat narration as a "Narrator" line at index -1 in our dialogue stream.
    dialogueSpeaker.textContent = "Narration";
    typeText(text, () => {});
    dialogueBox.classList.add("visible");
    if (window.MovieAudio.isEnabled()) {
      window.MovieAudio.cancelSpeech();
      speakingUtterance = window.MovieAudio.speak("Narrator", text);
    }
  }

  function showDialogueLine(line) {
    dialogueSpeaker.textContent = line.speaker;
    typeText(line.text, () => {});
    dialogueBox.classList.add("visible");
    // Highlight the speaker on stage
    const scene = movie.scenes[sceneIndex];
    const speakerMember = (scene.cast || []).find(c => c.name === line.speaker);
    const speakerId = speakerMember ? speakerMember.id : null;
    window.MovieAnimator.updateSpeaker(scene, movie.palette, speakerId);

    if (window.MovieAudio.isEnabled()) {
      window.MovieAudio.cancelSpeech();
      speakingUtterance = window.MovieAudio.speak(line.speaker, line.text);
    }
  }

  function hideDialogue() {
    dialogueBox.classList.remove("visible");
  }

  function nextStep(userTriggered) {
    if (!movie) return;
    cancelTimers();
    const scene = movie.scenes[sceneIndex];

    // -1 means "narration showing"; first call advances to dialogue line 0.
    if (dialogueIndex === -1 && scene.dialogue && scene.dialogue.length > 0) {
      dialogueIndex = 0;
      showDialogueLine(scene.dialogue[0]);
      if (isPlaying) advanceAfter(durationFor(scene.dialogue[0].text));
      return;
    }

    // Advance within current scene's dialogue
    if (dialogueIndex + 1 < (scene.dialogue ? scene.dialogue.length : 0)) {
      dialogueIndex++;
      showDialogueLine(scene.dialogue[dialogueIndex]);
      if (isPlaying) advanceAfter(durationFor(scene.dialogue[dialogueIndex].text));
      return;
    }

    // Move to next scene
    if (sceneIndex + 1 < movie.scenes.length) {
      sceneIndex++;
      dialogueIndex = -1;
      showScene();
      if (isPlaying) advanceAfter(durationFor(movie.scenes[sceneIndex].narration));
      return;
    }

    // End of movie
    isPlaying = false;
    btnPlay.textContent = "▶";
    sceneMeta.textContent = "End · click ⟳ to replay";
    window.MovieAudio.stopLoop();
  }

  function play() {
    isPlaying = true;
    btnPlay.textContent = "❚❚";
    if (!movie) return;
    if (window.MovieAudio.isEnabled() && movie.scenes[sceneIndex]) {
      window.MovieAudio.startLoop(movie.style, movie.scenes[sceneIndex].mood);
    }
    advanceAfter(400);
  }

  function pause() {
    isPlaying = false;
    btnPlay.textContent = "▶";
    cancelTimers();
    window.MovieAudio.stopLoop();
    window.MovieAudio.cancelSpeech();
  }

  function advanceAfter(ms) {
    cancelTimers();
    advanceTimer = setTimeout(() => nextStep(false), ms);
  }

  function cancelTimers() {
    if (advanceTimer) { clearTimeout(advanceTimer); advanceTimer = null; }
    if (typewriterTimer) { clearTimeout(typewriterTimer); typewriterTimer = null; }
  }

  // Estimate how long a line should stay on screen.
  function durationFor(text) {
    if (!text) return 1500;
    const minMs = 2400;
    const perChar = 38;  // gives ~3.8s for a 100-char line
    return Math.min(9000, Math.max(minMs, text.length * perChar));
  }

  // Typewriter effect on the dialogue text element.
  function typeText(text, onDone) {
    if (typewriterTimer) { clearTimeout(typewriterTimer); typewriterTimer = null; }
    dialogueText.textContent = "";
    let i = 0;
    const step = () => {
      if (i >= text.length) {
        if (onDone) onDone();
        return;
      }
      dialogueText.textContent += text.charAt(i++);
      typewriterTimer = setTimeout(step, 22);
    };
    step();
  }

  // ---------- Script panel -----------------------------------------
  function renderScript(m) {
    scriptOutput.innerHTML = "";
    const titleHead = document.createElement("div");
    titleHead.className = "scene-block";
    titleHead.innerHTML =
      `<div class="scene-head">${escapeHtml(m.title)}</div>` +
      `<div class="narration">${escapeHtml(m.subtitle || "")}</div>` +
      `<div class="dialogue-line"><span class="speaker-name">Cast:</span> ` +
      `${escapeHtml(m.hero)}, ${escapeHtml(m.villain)}, ${escapeHtml(m.mentor)}</div>` +
      `<div class="dialogue-line"><span class="speaker-name">Setting:</span> ${escapeHtml(m.setting)}</div>`;
    scriptOutput.appendChild(titleHead);

    m.scenes.forEach((s, i) => {
      const block = document.createElement("div");
      block.className = "scene-block";
      let html = `<div class="scene-head">Scene ${i + 1} — ${s.beat} (${s.mood})</div>`;
      html += `<div class="narration">${escapeHtml(s.narration)}</div>`;
      (s.dialogue || []).forEach(line => {
        html += `<div class="dialogue-line"><span class="speaker-name">${escapeHtml(line.speaker)}:</span> ${escapeHtml(line.text)}</div>`;
      });
      block.innerHTML = html;
      scriptOutput.appendChild(block);
    });
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function capitalize(s) {
    if (!s) return s;
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // ---------- Pause when tab hidden --------------------------------
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && isPlaying) {
      pause();
    }
  });
})();
