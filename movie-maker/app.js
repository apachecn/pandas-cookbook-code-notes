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
  const btnSave = $("btn-save");
  const btnDownload = $("btn-download");
  const btnEdit = $("btn-edit");
  const fadeOverlay = $("fade-overlay");
  const savedMoviesPanel = $("saved-movies");
  const savedListEl = $("saved-list");

  const STORAGE_KEY = "movie-maker:saved";
  const SAVED_LIMIT = 12;

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
    refreshSavedPanel();
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

  btnSave.addEventListener("click", () => {
    if (!movie) return;
    saveMovie(movie);
    flashMeta("Saved");
  });

  btnDownload.addEventListener("click", () => {
    if (!movie) return;
    downloadScript(movie);
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
    fadeTransition(() => {
      window.MovieAnimator.renderScene(scene, movie.palette, { speakerId: null });
      sceneMeta.textContent = `Scene ${sceneIndex + 1} of ${movie.scenes.length} · ${scene.beat}`;
      if (window.MovieAudio.isEnabled()) {
        window.MovieAudio.playWhoosh();
        window.MovieAudio.startLoop(movie.style, scene.mood);
      }
      if (scene.dialogue && scene.dialogue.length) {
        dialogueIndex = -1;
      }
      showNarrationOverlay(scene.narration);
    });
  }

  // Fade out, run a callback at the dark moment, then fade back in.
  function fadeTransition(midpointCb) {
    if (!fadeOverlay) {
      midpointCb();
      return;
    }
    fadeOverlay.classList.add("active");
    setTimeout(() => {
      midpointCb();
      // a frame to let the DOM update, then fade back in
      requestAnimationFrame(() => {
        fadeOverlay.classList.remove("active");
      });
    }, 460);
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

  // ---------- Save / load via localStorage -------------------------
  function readSaved() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }
  function writeSaved(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      return true;
    } catch (_) {
      return false;
    }
  }
  function saveMovie(m) {
    const list = readSaved();
    const entry = { id: "m_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7), savedAt: Date.now(), movie: m };
    list.unshift(entry);
    while (list.length > SAVED_LIMIT) list.pop();
    writeSaved(list);
    refreshSavedPanel();
  }
  function deleteSaved(id) {
    const list = readSaved().filter(e => e.id !== id);
    writeSaved(list);
    refreshSavedPanel();
  }
  function loadSaved(id) {
    const entry = readSaved().find(e => e.id === id);
    if (!entry) return;
    movie = entry.movie;
    setupPanel.hidden = true;
    theaterPanel.hidden = false;
    renderScript(movie);
    window.MovieAudio.setEnabled(!!enableAudioEl.checked);
    startMovie();
  }
  function refreshSavedPanel() {
    const list = readSaved();
    if (!list.length) {
      savedMoviesPanel.hidden = true;
      return;
    }
    savedMoviesPanel.hidden = false;
    savedListEl.innerHTML = "";
    list.forEach(entry => {
      const wrap = document.createElement("span");
      wrap.className = "saved-item";
      const label = document.createElement("span");
      label.textContent = entry.movie.title || "(untitled)";
      const loadBtn = document.createElement("button");
      loadBtn.type = "button";
      loadBtn.className = "load-btn";
      loadBtn.textContent = "Open";
      loadBtn.addEventListener("click", () => loadSaved(entry.id));
      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "delete-btn";
      delBtn.textContent = "×";
      delBtn.title = "Delete";
      delBtn.addEventListener("click", () => deleteSaved(entry.id));
      wrap.appendChild(label);
      wrap.appendChild(loadBtn);
      wrap.appendChild(delBtn);
      savedListEl.appendChild(wrap);
    });
  }

  // ---------- Download script as plain text ------------------------
  function downloadScript(m) {
    const lines = [];
    lines.push(m.title);
    if (m.subtitle) lines.push(m.subtitle);
    lines.push("");
    lines.push("Cast: " + [m.hero, m.villain, m.mentor].join(", "));
    lines.push("Setting: " + m.setting);
    lines.push("");
    lines.push("=".repeat(60));
    m.scenes.forEach((s, i) => {
      lines.push("");
      lines.push(`SCENE ${i + 1} — ${s.beat.toUpperCase()} (${s.mood})`);
      lines.push("-".repeat(60));
      lines.push(s.narration);
      (s.dialogue || []).forEach(d => {
        lines.push(`  ${d.speaker}: ${d.text}`);
      });
    });
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = sanitizeFilename(m.title) + ".txt";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 200);
  }
  function sanitizeFilename(s) {
    return String(s || "movie")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "movie";
  }

  // Brief status message in the scene-meta corner.
  function flashMeta(text) {
    const prev = sceneMeta.textContent;
    sceneMeta.textContent = text;
    setTimeout(() => {
      if (sceneMeta.textContent === text) sceneMeta.textContent = prev;
    }, 1400);
  }

  // Refresh saved list on initial load and whenever returning to setup.
  refreshSavedPanel();

  // ---------- Pause when tab hidden --------------------------------
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && isPlaying) {
      pause();
    }
  });
})();
