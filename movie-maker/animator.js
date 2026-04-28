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

  function buildCharacter(member, x, y, scale, isSpeaking) {
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
      // hood-like halo
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

    // Eyes
    const eyeY = 0;
    const eyeR = 5;
    g.appendChild(el("circle", { cx: -16, cy: eyeY, r: eyeR + 2, fill: "#fff" }));
    g.appendChild(el("circle", { cx:  16, cy: eyeY, r: eyeR + 2, fill: "#fff" }));
    g.appendChild(el("circle", { cx: -16, cy: eyeY, r: eyeR, fill: role.eyeColor }));
    g.appendChild(el("circle", { cx:  16, cy: eyeY, r: eyeR, fill: role.eyeColor }));

    // Mouth — different shape per role + speaking
    const mouthY = 22;
    if (isSpeaking) {
      const mouth = el("ellipse", { cx: 0, cy: mouthY, rx: 10, ry: 6, fill: "#3a1818" });
      const animR = el("animate", { attributeName: "ry", values: "6;2;6", dur: "0.5s", repeatCount: "indefinite" });
      mouth.appendChild(animR);
      g.appendChild(mouth);
    } else if (member.role === "antagonist") {
      g.appendChild(el("path", { d: "M -14,24 Q 0,18 14,24", stroke: "#3a1818", "stroke-width": 3, fill: "none", "stroke-linecap": "round" }));
    } else {
      g.appendChild(el("path", { d: "M -12,22 Q 0,30 12,22", stroke: "#3a1818", "stroke-width": 3, fill: "none", "stroke-linecap": "round" }));
    }

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

    const bgLayer = document.getElementById("bg-layer");
    const charLayer = document.getElementById("char-layer");
    const fxLayer = document.getElementById("fx-layer");

    clear(bgLayer);
    clear(charLayer);
    clear(fxLayer);

    bgLayer.appendChild(buildBackground(palette, scene.mood));

    const positions = placeCast(scene.cast);
    scene.cast.forEach((member, i) => {
      const pos = positions[i];
      const isSpeaking = member.id === speakerId;
      const node = buildCharacter(member, pos.x, pos.y, pos.scale, isSpeaking);
      if (isSpeaking) {
        // gentle highlight ring under the speaker
        const ring = el("ellipse", {
          cx: pos.x, cy: pos.y + 230, rx: 110, ry: 22,
          fill: "none",
          stroke: palette.primary,
          "stroke-width": 3,
          opacity: 0.65
        });
        const pulse = el("animate", {
          attributeName: "opacity",
          values: "0.25;0.85;0.25",
          dur: "1.6s",
          repeatCount: "indefinite"
        });
        ring.appendChild(pulse);
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
  }

  // Update only the speaker highlight without re-rendering the whole scene.
  function updateSpeaker(scene, palette, speakerId) {
    renderScene(scene, palette, { speakerId });
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
