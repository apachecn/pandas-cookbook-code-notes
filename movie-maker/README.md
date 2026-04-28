# Procedural Movie Maker

A tiny, self-contained animated story generator that runs entirely in your
browser. No API keys, no internet connection, no `npm install` — just open the
HTML file and use it.

## How to run

1. Download or clone this folder (`movie-maker/`).
2. Open `index.html` in any modern browser (Chrome, Firefox, Safari, Edge).
3. Type a story idea, pick a genre, choose a number of scenes, and click
   **Generate movie**.

That's it. There is no build step.

## What it does

- Takes a free-text story idea + a genre + a desired number of scenes (3–8).
- Generates a short script using a procedural template engine (genre-specific
  word banks + narrative beats: opening, inciting, rising, climax, resolution).
- Plays the result back in a small SVG "stage" with simple animated characters,
  a typewriter dialogue box, and a procedural soundtrack generated on the fly
  using the Web Audio API.
- Uses your browser's built-in speech synthesis (`window.speechSynthesis`) to
  voice each character with a different pitch / rate.

The full text of the generated script is shown below the player and can be
copied out.

## Genres

`anime`, `scifi`, `fantasy`, `horror`, `comedy`, `mystery`. Each one has its own
color palette, character pool, soundtrack settings (key, tempo, instrument
shape), and dialogue style.

## Files

- `index.html` — page structure and load order
- `style.css` — styles for the panels, stage, and dialogue box
- `story.js` — the procedural story engine (word banks + templates + RNG)
- `animator.js` — SVG scene rendering, character drawing, transitions
- `audio.js` — Web Audio soundtrack + SpeechSynthesis narration
- `app.js` — UI controller that ties the form, the player, and the modules
  together

All modules are plain old browser JavaScript; nothing is bundled, transpiled,
or fetched at runtime.

## Privacy

Everything happens in the page. No network requests are made. You can
disconnect from the internet entirely and it still works.

## Limits

This is a procedural toy, not a generative AI. It is good at producing fun,
slightly absurd short scripts in the style of a chosen genre — and it is bad
at:

- producing stories that are deeply about the specific words in your idea
  (the idea seeds the title and randomness, but the rest comes from the
  templates),
- speaking languages other than English well (the template text is English),
- making genuinely "novel" stories — by design, every output is a remix of
  the genre pack.

If you want richer output, the word banks and templates in `story.js` are
all data — add to them, change them, remove them. They're the only thing
the engine knows.
