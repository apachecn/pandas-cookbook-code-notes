/* animator.js — renders scenes into the on-page SVG stage. */
(function (global) {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const W = 1280;
  const H = 720;

  // Character archetype → distinguishing visual cues.
  const ROLE_STYLE = {
    protagonist: { skin: "#f5d6b3", hair: "#3a2820", outfit: null, eyeColor: "#222" },
    antagonist:  { skin: "#cdb8a0", hair: "#0a0a0a", outfit: null, eyeColor: "#7a0a14" },
    mentor:      { skin: "#e9d2b3", hair: "#cccccc", outfit: null, eyeColor: "#33344a" }
  };

  function el(tag, attrs, children) {
    const node = document.createElementNS(SVG_NS, tag);
    if (attrs) for (const k in attrs) node.setAttribute(k, attrs[k]);
    if (children) for (const c of children) node.appendChild(c);
    return node;
  }
  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function buildBackground(palette, mood) {
    const bg = document.createDocumentFragment();
    const skyGradId = "skyGrad";

    const defs = document.getElementById("stage-defs");
    clear(defs);

    // Sky gradient
    const sky = el("linearGradient", { id: skyGradId, x1: "0", y1: "0", x2: "0", y2: "1" });
    palette.sky.forEach((color, i) => {
      sky.appendChild(el("stop", {
        offset: (i / Math.max(1, palette.sky.length - 1)) * 100 + "%",
        "stop-color": color
      }));
    });
    defs.appendChild(sky);

    // Soft glow filter
    const glow = el("filter", { id: "softGlow", x: "-30%", y: "-30%", width: "160%", height: "160%" });
    glow.appendChild(el("feGaussianBlur", { stdDeviation: "12", result: "blur" }));
    const merge = el("feMerge");
    merge.appendChild(el("feMergeNode", { in: "blur" }));
    merge.appendChild(el("feMergeNode", { in: "SourceGraphic" }));
    glow.appendChild(merge);
    defs.appendChild(glow);

    // Sky rect
    bg.appendChild(el("rect", { x: 0, y: 0, width: W, height: H, fill: `url(#${skyGradId})` }));

    // Ambient circle (sun / moon / fixed glow)
    const orb = el("circle", {
      cx: 320, cy: 180, r: 90,
      fill: palette.glow,
      opacity: mood === "intense" ? 0.7 : 0.45,
      filter: "url(#softGlow)"
    });
    bg.appendChild(orb);

    // Distant horizon shapes (mountains/cityscape silhouettes)
    const horizon = el("g", { opacity: 0.7 });
    const ridgePath = mountainPath(220, 540, 11);
    horizon.appendChild(el("path", { d: ridgePath, fill: palette.ground, opacity: 0.55 }));
    const ridge2 = mountainPath(160, 600, 9);
    horizon.appendChild(el("path", { d: ridge2, fill: palette.ground, opacity: 0.85 }));
    bg.appendChild(horizon);

    // Ground plane
    bg.appendChild(el("rect", { x: 0, y: 600, width: W, height: 120, fill: palette.ground }));

    // Particles (tiny circles drifting up — animated via CSS)
    const particles = el("g", { class: "particles" });
    for (let i = 0; i < 24; i++) {
      const cx = (i * 53) % W;
      const cy = 200 + ((i * 71) % 400);
      const r = 1 + (i % 3);
      const dur = (3 + (i % 5)) + "s";
      const delay = (i * 0.21).toFixed(2) + "s";
      const c = el("circle", { cx, cy, r, fill: palette.accent, opacity: 0.55 });
      const anim = el("animate", {
        attributeName: "cy",
        from: cy,
        to: cy - 80,
        dur,
        begin: delay,
        repeatCount: "indefinite"
      });
      const fadeAnim = el("animate", {
        attributeName: "opacity",
        values: "0;0.65;0",
        dur,
        begin: delay,
        repeatCount: "indefinite"
      });
      c.appendChild(anim);
      c.appendChild(fadeAnim);
      particles.appendChild(c);
    }
    bg.appendChild(particles);

    return bg;
  }

  // Generate a jagged silhouette of mountains/skyline.
  function mountainPath(amplitude, baseY, segments) {
    const step = W / segments;
    let d = `M0,${H} L0,${baseY} `;
    for (let i = 0; i <= segments; i++) {
      const x = i * step;
      const y = baseY - (Math.sin(i * 1.7) * 0.5 + 0.5) * amplitude;
      d += `L${x.toFixed(0)},${y.toFixed(0)} `;
    }
    d += `L${W},${H} Z`;
    return d;
  }

  // Stable color from a string — used so the same name keeps the same outfit.
  function hashColor(str, sat, light) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
    const hue = Math.abs(h) % 360;
    return `hsl(${hue}, ${sat}%, ${light}%)`;
  }

  // Render a face matching the speaker's mood. Eyes, brows, mouth all change.
  // Brows alone do most of the emotional lifting.
  function drawFace(g, role, mood, isSpeaking, characterRole) {
    const eyeY = 0;
    const eyeR = 5;
    const mouthY = 22;
    const browY = -14;

    // ---- Eyes ----
    // Squint for rage / brave / taunt; wide for doubt / wise; default neutral.
    let eyeOpenY = 7;     // half-height of the white eye
    if (mood === "rage" || mood === "brave") eyeOpenY = 4;
    else if (mood === "doubt" || mood === "wise") eyeOpenY = 8;

    g.appendChild(el("ellipse", { cx: -16, cy: eyeY, rx: eyeR + 2, ry: eyeOpenY, fill: "#fff" }));
    g.appendChild(el("ellipse", { cx:  16, cy: eyeY, rx: eyeR + 2, ry: eyeOpenY, fill: "#fff" }));

    // Pupils — slightly off-center for taunt (looking away/down) and doubt (looking up).
    let pupilDx = 0, pupilDy = 0;
    if (mood === "taunt")  { pupilDx = -2; pupilDy = 1; }
    if (mood === "doubt")  { pupilDx = 0;  pupilDy = -2; }
    if (mood === "rage")   { pupilDx = 0;  pupilDy = 1; }
    g.appendChild(el("circle", { cx: -16 + pupilDx, cy: eyeY + pupilDy, r: eyeR, fill: role.eyeColor }));
    g.appendChild(el("circle", { cx:  16 + pupilDx, cy: eyeY + pupilDy, r: eyeR, fill: role.eyeColor }));

    // ---- Eyebrows ----
    // Brows take 5 forms: angry-down (rage/brave), worried-up (doubt), flat
    // (calm/wise), arched (taunt), determined-flat-strong (resolve).
    const browStroke = "#3a1818";
    const browW = 3.5;

    function brow(d) {
      g.appendChild(el("path", {
        d, stroke: browStroke, "stroke-width": browW, fill: "none", "stroke-linecap": "round"
      }));
    }

    if (mood === "rage" || mood === "brave" || (characterRole === "antagonist" && mood !== "doubt")) {
      // Angry — inner ends down, outer up.
      brow("M -26,-20 L -8,-13");
      brow("M  8,-13 L  26,-20");
    } else if (mood === "doubt") {
      // Worried — inner ends up, like ramps.
      brow("M -26,-12 L -8,-18");
      brow("M  8,-18 L  26,-12");
    } else if (mood === "taunt") {
      // Smug — one brow raised.
      brow("M -26,-13 L -8,-13");
      brow("M  8,-19 L  26,-13");
    } else if (mood === "resolve") {
      // Set, level brows, slightly thicker stroke implied by length.
      brow("M -27,-15 L -7,-15");
      brow("M  7,-15 L  27,-15");
    } else {
      // Calm / wise — soft arched brows.
      brow("M -26,-14 Q -17,-17 -8,-14");
      brow("M  8,-14 Q 17,-17 26,-14");
    }

    // ---- Mouth ----
    // Speaking overrides shape with an animated open ellipse.
    if (isSpeaking) {
      const mouth = el("ellipse", { cx: 0, cy: mouthY, rx: 10, ry: 6, fill: "#3a1818" });
      mouth.appendChild(el("animate", {
        attributeName: "ry", values: "6;2;6", dur: "0.5s", repeatCount: "indefinite"
      }));
      g.appendChild(mouth);
    } else if (mood === "rage") {
      // Bared-teeth open mouth.
      g.appendChild(el("rect", { x: -14, y: 18, width: 28, height: 12, rx: 3, fill: "#3a1818" }));
      g.appendChild(el("path", { d: "M -10,18 L -10,30 M -2,18 L -2,30 M 6,18 L 6,30", stroke: "#fff", "stroke-width": 2 }));
    } else if (mood === "brave" || mood === "resolve") {
      // Firm flat line.
      g.appendChild(el("path", { d: "M -12,23 L 12,23", stroke: "#3a1818", "stroke-width": 3, "stroke-linecap": "round" }));
    } else if (mood === "doubt") {
      // Frown (curve down).
      g.appendChild(el("path", { d: "M -12,26 Q 0,20 12,26", stroke: "#3a1818", "stroke-width": 3, fill: "none", "stroke-linecap": "round" }));
    } else if (mood === "taunt") {
      // Smirk — diagonal curve.
      g.appendChild(el("path", { d: "M -12,24 Q 0,18 14,22", stroke: "#3a1818", "stroke-width": 3, fill: "none", "stroke-linecap": "round" }));
    } else if (mood === "wise") {
      // Soft Mona-Lisa half-smile.
      g.appendChild(el("path", { d: "M -10,22 Q 0,26 10,22", stroke: "#3a1818", "stroke-width": 3, fill: "none", "stroke-linecap": "round" }));
    } else if (characterRole === "antagonist") {
      g.appendChild(el("path", { d: "M -14,24 Q 0,18 14,24", stroke: "#3a1818", "stroke-width": 3, fill: "none", "stroke-linecap": "round" }));
    } else {
      g.appendChild(el("path", { d: "M -12,22 Q 0,30 12,22", stroke: "#3a1818", "stroke-width": 3, fill: "none", "stroke-linecap": "round" }));
    }
  }

  function buildCharacter(member, x, y, scale, isSpeaking, mood) {
    mood = mood || "calm";
    const g = el("g", {
      class: "character",
      transform: `translate(${x},${y}) scale(${scale})`,
      "data-id": member.id
    });

    const role = ROLE_STYLE[member.role] || ROLE_STYLE.protagonist;
    const outfit = hashColor(member.name + "|" + member.role, 60, 45);
    const outfitTrim = hashColor(member.name + "|trim", 70, 65);

    // Shadow under feet
    g.appendChild(el("ellipse", { cx: 0, cy: 230, rx: 80, ry: 14, fill: "#000", opacity: 0.35 }));

    // Body
    g.appendChild(el("rect", {
      x: -55, y: 60, width: 110, height: 170,
      rx: 24, ry: 24,
      fill: outfit
    }));
    // Body trim
    g.appendChild(el("rect", { x: -55, y: 150, width: 110, height: 12, fill: outfitTrim }));

    // Arms
    g.appendChild(el("rect", { x: -75, y: 70, width: 22, height: 110, rx: 10, fill: outfit }));
    g.appendChild(el("rect", { x:  53, y: 70, width: 22, height: 110, rx: 10, fill: outfit }));

    // Neck
    g.appendChild(el("rect", { x: -14, y: 38, width: 28, height: 28, fill: role.skin }));

    // Head
    g.appendChild(el("circle", { cx: 0, cy: 0, r: 50, fill: role.skin }));

    // Hair
    if (member.role === "mentor") {
      g.appendChild(el("path", {
        d: "M -55,-5 Q -55,-65 0,-65 Q 55,-65 55,-5 L 55,15 L -55,15 Z",
        fill: role.hair
      }));
    } else if (member.role === "antagonist") {
      g.appendChild(el("path", {
        d: "M -52,-15 Q -52,-60 0,-60 Q 52,-60 52,-15 L 50,5 L 30,-10 L 10,5 L -10,-10 L -30,5 L -50,5 Z",
        fill: role.hair
      }));
    } else {
      g.appendChild(el("path", {
        d: "M -50,-10 Q -50,-58 0,-58 Q 50,-58 50,-10 L 50,8 L 25,-5 L 0,8 L -25,-5 L -50,8 Z",
        fill: role.hair
      }));
    }

    // Mood-driven facial expression (eyes, brows, mouth)
    drawFace(g, role, mood, isSpeaking, member.role);

    // Idle bob animation via SMIL
    const bob = el("animateTransform", {
      attributeName: "transform",
      type: "translate",
      values: `0,0; 0,-6; 0,0`,
      dur: "2.5s",
      additive: "sum",
      repeatCount: "indefinite"
    });
    g.appendChild(bob);

    // Name label
    const label = el("text", {
      x: 0, y: 280, "text-anchor": "middle",
      fill: "rgba(255,255,255,0.85)",
      "font-size": 22,
      "font-family": "system-ui, -apple-system, sans-serif",
      "font-weight": 600,
      "paint-order": "stroke",
      stroke: "rgba(0,0,0,0.7)",
      "stroke-width": 4
    });
    label.textContent = member.name;
    g.appendChild(label);

    return g;
  }

  // Lay characters out across the stage.
  function placeCast(cast) {
    const positions = [];
    const groundY = 480;
    if (cast.length === 1) {
      positions.push({ x: W / 2, y: groundY, scale: 1.0 });
    } else if (cast.length === 2) {
      positions.push({ x: W * 0.32, y: groundY, scale: 1.0 });
      positions.push({ x: W * 0.68, y: groundY, scale: 1.0 });
    } else {
      cast.forEach((_, i) => {
        positions.push({ x: W * (0.22 + 0.28 * i), y: groundY, scale: 0.95 });
      });
    }
    return positions;
  }

  // ---- Main render entry point ------------------------------------
  function renderScene(scene, palette, options) {
    options = options || {};
    const speakerId = options.speakerId || null;
    const speakerMood = options.speakerMood || "calm";

    const stage = document.getElementById("stage");
    const bgLayer = document.getElementById("bg-layer");
    const charLayer = document.getElementById("char-layer");
    const fxLayer = document.getElementById("fx-layer");

    clear(bgLayer);
    clear(charLayer);
    clear(fxLayer);

    bgLayer.appendChild(buildBackground(palette, scene.mood));

    const positions = placeCast(scene.cast);
    let speakerPos = null;

    scene.cast.forEach((member, i) => {
      const pos = positions[i];
      const isSpeaking = member.id === speakerId;
      const moodForChar = isSpeaking ? speakerMood : passiveMood(member.role, scene.mood);
      const node = buildCharacter(member, pos.x, pos.y, pos.scale, isSpeaking, moodForChar);
      if (isSpeaking) {
        speakerPos = pos;
        const ring = el("ellipse", {
          cx: pos.x, cy: pos.y + 230, rx: 110, ry: 22,
          fill: "none",
          stroke: palette.primary,
          "stroke-width": 3,
          opacity: 0.65
        });
        ring.appendChild(el("animate", {
          attributeName: "opacity",
          values: "0.25;0.85;0.25",
          dur: "1.6s",
          repeatCount: "indefinite"
        }));
        fxLayer.appendChild(ring);
      }
      charLayer.appendChild(node);
    });

    // Mood-based overlay
    if (scene.mood === "intense" || scene.mood === "tense") {
      const vignette = el("radialGradient", { id: "vignette", cx: "50%", cy: "50%", r: "75%" });
      vignette.appendChild(el("stop", { offset: "60%", "stop-color": "#000", "stop-opacity": "0" }));
      vignette.appendChild(el("stop", { offset: "100%", "stop-color": "#000", "stop-opacity": "0.6" }));
      document.getElementById("stage-defs").appendChild(vignette);
      fxLayer.appendChild(el("rect", { x: 0, y: 0, width: W, height: H, fill: "url(#vignette)", "pointer-events": "none" }));
    }

    // Camera framing — slight zoom-in on the speaker via viewBox.
    applyCamera(stage, speakerPos);
  }

  // Pick a "passive" mood for non-speaking characters so the villain doesn't
  // suddenly look calm during a tense scene.
  function passiveMood(charRole, sceneMood) {
    if (charRole === "antagonist") return sceneMood === "calm" ? "calm" : "taunt";
    if (charRole === "mentor") return "wise";
    if (sceneMood === "intense" || sceneMood === "tense") return "doubt";
    return "calm";
  }

  // Smoothly tweak the SVG viewBox so the speaker is centered + a little larger.
  // Done in JS rather than CSS because viewBox isn't an animatable CSS property.
  let cameraTimer = null;
  let currentVB = { x: 0, y: 0, w: W, h: H };
  function applyCamera(stage, speakerPos) {
    let target;
    if (speakerPos) {
      const zoom = 0.78;            // 22% closer
      const w = W * zoom;
      const h = H * zoom;
      const x = clamp(speakerPos.x - w / 2, 0, W - w);
      const y = clamp(speakerPos.y - h / 2 - 30, 0, H - h);
      target = { x, y, w, h };
    } else {
      target = { x: 0, y: 0, w: W, h: H };
    }
    animateViewBox(stage, currentVB, target, 600);
    currentVB = target;
  }
  function animateViewBox(stage, from, to, durationMs) {
    if (cameraTimer) { cancelAnimationFrame(cameraTimer); cameraTimer = null; }
    const start = performance.now();
    function step(now) {
      const t = Math.min(1, (now - start) / durationMs);
      const e = easeOutCubic(t);
      const x = from.x + (to.x - from.x) * e;
      const y = from.y + (to.y - from.y) * e;
      const w = from.w + (to.w - from.w) * e;
      const h = from.h + (to.h - from.h) * e;
      stage.setAttribute("viewBox", `${x} ${y} ${w} ${h}`);
      if (t < 1) cameraTimer = requestAnimationFrame(step);
      else cameraTimer = null;
    }
    cameraTimer = requestAnimationFrame(step);
  }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // Update only the speaker highlight + face mood without re-rendering the whole scene.
  function updateSpeaker(scene, palette, speakerId, speakerMood) {
    renderScene(scene, palette, { speakerId, speakerMood });
  }

  // Title-card entry / exit.
  function showTitleCard(title, subtitle) {
    const tc = document.getElementById("title-card");
    document.getElementById("title-text").textContent = title;
    document.getElementById("title-sub").textContent = subtitle || "";
    tc.hidden = false;
  }
  function hideTitleCard() {
    document.getElementById("title-card").hidden = true;
  }

  global.MovieAnimator = { renderScene, updateSpeaker, showTitleCard, hideTitleCard };
})(window);
