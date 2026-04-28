/* story.js — procedural story generation. No network calls. */
(function (global) {
  "use strict";

  // -----------------------------------------------------------------
  // Genre packs. Each pack contains:
  //   palette  — colors used by the animator
  //   chars/villains/mentors — name pools
  //   settings/items/powers   — flavor pools
  //   beats: opening | inciting | rising | climax | resolution
  //          arrays of templates with {hero}/{villain}/{setting}/{item}/{power}
  //   dialogue: keyed by emotion → array of one-liners
  //   narratorMood: short tonal descriptor for narration style
  // -----------------------------------------------------------------
  const STYLES = {
    anime: {
      label: "Anime / Adventure",
      palette: { sky: ["#1a1a3e", "#3d1a5e", "#8b2d8a"], ground: "#2a1a3e", primary: "#ff6b9d", secondary: "#4ecdc4", accent: "#ffe66d", glow: "#ff9ec7" },
      chars: ["Hiroshi", "Sakura", "Kenji", "Yumi", "Takeshi", "Akira", "Mei", "Ren", "Nozomi", "Kaito"],
      villains: ["Lord Kage", "the Shadow Council", "Master Akumu", "the Crimson Empress", "the Faceless One"],
      mentors: ["Old Master Ito", "the Wandering Sensei", "Grandmother Yuki"],
      settings: ["a hidden mountain village", "the Sakura Academy", "neon-lit Old Tokyo", "the floating temple of clouds", "a forgotten samurai fortress"],
      items: ["the ancient katana", "the moonstone amulet", "the forbidden scroll", "the dragon's tear", "the blade of ten thousand years"],
      powers: ["wields the dragon's flame", "can bend shadows like silk", "hears the voices of forgotten spirits", "moves faster than the wind"],
      opening: [
        "In {setting}, {hero} lived a quiet life — until the rumors of {villain} reached the gates.",
        "Long ago, beyond the seven seas, {hero} dreamed of greatness in {setting}.",
        "{hero} had always been ordinary. Then came the night the sky turned crimson over {setting}."
      ],
      inciting: [
        "A messenger arrived at dawn. {item} had been stolen by {villain}.",
        "Strange dreams began — visions of {villain} laughing at the end of all things.",
        "The elders summoned {hero} in secret. The seal had broken. {villain} had returned."
      ],
      rising: [
        "{hero} trained beneath the waterfall, learning to {power}.",
        "With {item} clutched tight, {hero} crossed mountains to find the truth.",
        "An old master appeared and revealed the hidden truth: {hero} {power}."
      ],
      climax: [
        "On the cliff above the storm, {hero} faced {villain} at last.",
        "Lightning split the sky as {item} blazed in {hero}'s hand.",
        "Eyes locked, breath held — {hero} struck the final blow against {villain}."
      ],
      resolution: [
        "Peace returned to {setting}. But {hero} was forever changed.",
        "{villain} was gone — yet a single shadow lingered on the horizon.",
        "{hero} smiled at the dawn, ready for whatever came next."
      ],
      dialogue: {
        hero_brave:   ["I will not back down!", "For my friends — for everyone!", "This ends today.", "No more running."],
        hero_doubt:   ["Am I really strong enough?", "What if I fail them all?", "I... I'm scared.", "Why me?"],
        hero_resolve: ["I understand now.", "I know what I must do.", "Then I will protect them.", "My path is clear."],
        villain_taunt:["You think you can stop me?", "Pathetic. You are nothing.", "Bow before me, child.", "Your hope is weakness."],
        villain_rage: ["IMPOSSIBLE!", "How DARE you!", "You will pay for this!", "This cannot be!"],
        mentor_wise:  ["Trust your heart, {hero}.", "The power was within you all along.", "You are ready.", "Go. The world is waiting."],
        narration_open:  ["Long ago...", "It began on an ordinary morning.", "The wind carried whispers that day."],
        narration_close: ["And so the story continues.", "But that, perhaps, is a tale for another night.", "The legend would be told for a thousand years."]
      }
    },

    scifi: {
      label: "Sci-Fi",
      palette: { sky: ["#020a1f", "#0a1e4a", "#1e3a8a"], ground: "#0a0a1a", primary: "#00d9ff", secondary: "#7b2cbf", accent: "#39ff7c", glow: "#5cc8ff" },
      chars: ["Captain Vega", "Dr. Reyes", "Pilot Jin", "Engineer Okafor", "Specialist Lin", "Commander Aria", "Tech Yara"],
      villains: ["the Synthetic Council", "Admiral Drak", "the rogue AI Helix", "the Iron Syndicate", "the Hollowed One"],
      mentors: ["Old Captain Mara", "Professor Vex", "the AI companion ECHO"],
      settings: ["the orbital station Helios-9", "a derelict starship at the edge of known space", "the icy mining colony Tartarus", "a cracked dome city on Mars", "the asteroid prison Halcyon"],
      items: ["the quantum core", "the encrypted datachip", "the stolen warp coil", "the prototype sidearm", "the resurrection key"],
      powers: ["can interface directly with any system", "wields a plasma blade like an extension of thought", "reads neural patterns at a glance", "bends gravity with a thought"],
      opening: [
        "Drifting in silence near {setting}, {hero} ran a routine diagnostic — and saw something they shouldn't have.",
        "{hero} woke to alarms. {setting} was venting atmosphere fast.",
        "The mission to {setting} was supposed to be simple. {hero} should have known better."
      ],
      inciting: [
        "A black-market signal pulsed: {villain} had {item}. They were headed for the core systems.",
        "The console flickered: {villain}'s fleet had jumped in-system. ETA — twelve minutes.",
        "An old transmission came through. The voice on the other end was {villain}."
      ],
      rising: [
        "{hero} jacked into the network and learned the truth: {hero} {power}.",
        "Routing power through {item}, {hero} prepared the last gambit.",
        "There was no time for a clean plan. {hero} grabbed {item} and ran."
      ],
      climax: [
        "In the breached docking bay, {hero} met {villain} face to plated face.",
        "Vacuum hissed at the seams. {hero} raised {item} and squeezed the trigger.",
        "{hero} {power} — and the lights of {setting} flared, then went still."
      ],
      resolution: [
        "{setting} was salvaged. Barely. {hero} watched the stars and said nothing.",
        "{villain} was offline. For now. The encrypted file remained unread on {hero}'s console.",
        "{hero} logged off, opened a private channel, and made the call they had been avoiding."
      ],
      dialogue: {
        hero_brave:   ["Hold the line!", "We finish this. Now.", "Reroute power to weapons.", "I've got the shot."],
        hero_doubt:   ["Are you SURE about this?", "I don't have the readings for this...", "If we miss, we're vapor.", "This shouldn't be possible."],
        hero_resolve: ["Patch me in.", "Override accepted.", "Plotting course.", "Lock it down."],
        villain_taunt:["Your kind always loses, in the end.", "You're a glitch. I am the upgrade.", "Resistance is statistically meaningless.", "Your firewall is touching."],
        villain_rage: ["Critical failure. Critical failure!", "INACCEPTABLE.", "Recalculating... no — IMPOSSIBLE.", "How are you still functional?"],
        mentor_wise:  ["Trust the math, {hero}.", "Sometimes the answer is to pull the plug.", "You wrote half the code. You can break it.", "Breathe. Then act."],
        narration_open:  ["In the year that followed the Collapse...", "Beyond the heliopause, signals travel slow.", "Some ships are never logged."],
        narration_close: ["The black would keep its secrets.", "Telemetry resumed at 03:14 station-time.", "End of recording."]
      }
    },

    fantasy: {
      label: "Fantasy",
      palette: { sky: ["#1c2a4e", "#3b5b8c", "#7aa3d6"], ground: "#3a2a1a", primary: "#d4a017", secondary: "#6b8e4e", accent: "#c44536", glow: "#ffe9a8" },
      chars: ["Aldric", "Elara", "Branwen", "Cadeyrn", "Lyra", "Theron", "Mira", "Galen"],
      villains: ["the Lich-King Vorath", "the witch Morgath", "the Dread Wyrm", "the Black Council", "the Hollow Crown"],
      mentors: ["the wizard Eldrin", "Sister Maev of the Stones", "the bard Calliope"],
      settings: ["the kingdom of Eldermoor", "the Whispering Forest", "the floating isles of Anavar", "a forgotten dwarven hold", "the ruined cathedral on the hill"],
      items: ["the silver-runed blade", "the crown of seven stars", "the heartstone", "the binding tome", "the lantern of the first dawn"],
      powers: ["bears the old blood of the lost kings", "can speak the language of stones", "holds the last spark of the high magic", "is bound to the spirit of the wolf"],
      opening: [
        "In {setting}, {hero} lived a simple life — but the old prophecies had not forgotten them.",
        "When the harvest failed for the third year, {hero} of {setting} understood that something dark had stirred.",
        "{hero} had always heard the trees speak. They had not, until now, told them to RUN."
      ],
      inciting: [
        "A raven came to the window with {item} in its claws — and a warning of {villain}.",
        "The hooded one stepped from the firelight and named {hero} aloud. The room went cold.",
        "By morning, the village was ash, the river was blood, and {villain}'s banner flew over {setting}."
      ],
      rising: [
        "Beneath the mountain, {hero} took up {item}, and felt it warm in their hand.",
        "{hero} discovered the truth at last: {hero} {power}.",
        "On the shore of the dead lake, an old voice taught {hero} the words that bind."
      ],
      climax: [
        "Beneath a sky black with crows, {hero} faced {villain} on the broken bridge.",
        "{hero} raised {item}, and the runes blazed bright as old stars.",
        "The duel was brief, terrible, and ended with one figure standing."
      ],
      resolution: [
        "Spring returned to {setting}. {hero} did not.",
        "{villain} was undone — but the binding was old, and old things have a way of waking.",
        "{hero} hung {item} above the hearth, and never spoke of that night again."
      ],
      dialogue: {
        hero_brave:   ["By steel and by blood — I will not yield!", "For the old kings!", "Stand with me, or stand aside.", "Let them come."],
        hero_doubt:   ["I am not the one the songs speak of.", "I am only a farmer.", "The blade is too heavy.", "I dreamt this once. It ended badly."],
        hero_resolve: ["Then I shall be the one.", "I see now what must be done.", "The path is mine.", "I will carry it."],
        villain_taunt:["You smell of fear, little one.", "Your gods have abandoned you.", "Kneel. It is easier.", "I have eaten kingdoms."],
        villain_rage: ["You DARE?", "I shall flay your very name from the world!", "NO — the runes — !", "This was foretold to be MINE!"],
        mentor_wise:  ["The fire chooses its torch, {hero}.", "Even shadow casts a shadow.", "Walk softly. Speak truer.", "You are more than your fear."],
        narration_open:  ["Long before the cities of men...", "In the days when the old roads were new...", "The bards still sing of that autumn."],
        narration_close: ["And so the wheel turned.", "The story passed from mouth to mouth, growing taller with each telling.", "Some say {hero} walks the woods to this day."]
      }
    },

    horror: {
      label: "Horror",
      palette: { sky: ["#0a0a0a", "#1a0a18", "#2a0a1a"], ground: "#0a0606", primary: "#8b0a1a", secondary: "#3a3a3a", accent: "#d4d0c4", glow: "#6e1118" },
      chars: ["Eleanor", "Marcus", "Iris", "Daniel", "Nora", "Adrien"],
      villains: ["the Thing in the Walls", "the Pale Caller", "the figure at the end of the hall", "the visitor who never blinks", "what lives beneath the floor"],
      mentors: ["the priest who survived '68", "the librarian who knows too much"],
      settings: ["the old house on Ashby Lane", "a cabin past the last cell tower", "the abandoned wing of St. Agnes Hospital", "an apartment with one too many rooms"],
      items: ["the locket grandmother left", "the cassette tape labeled DO NOT PLAY", "the ledger from the basement", "the small bone wrapped in linen"],
      powers: ["sees what others refuse to see", "remembers a life they have not lived yet", "hears the house when it speaks at 3:14 a.m.", "carries something that does not belong to them"],
      opening: [
        "The first night in {setting} was quiet. {hero} should have noticed.",
        "{hero} found {item} in a drawer that had been empty the day before.",
        "{hero} had moved into {setting} to start over. The house had other plans."
      ],
      inciting: [
        "At 3:14 a.m., the door opened on its own. {hero} did not.",
        "{hero} listened to the recording on {item}. Their own voice answered.",
        "The neighbors stopped knocking. Then the neighbors stopped existing."
      ],
      rising: [
        "{hero} began to understand: {hero} {power}.",
        "The wallpaper peeled back, and the writing beneath was in {hero}'s handwriting.",
        "Each night, the hallway grew longer. {hero} counted the doors anyway."
      ],
      climax: [
        "{hero} stood at the end of the hall. {villain} was waiting where the wall used to be.",
        "{item} grew warm. The lights died, one by one, room by room.",
        "{hero} spoke a name they should not have known. {villain} answered."
      ],
      resolution: [
        "{hero} walked out at sunrise. The house behind them did not cast a shadow.",
        "{hero} burned {item}. The smoke rose, then stopped, halfway up.",
        "Years later, {hero} still set a place at the table. Just in case."
      ],
      dialogue: {
        hero_brave:   ["I'm not afraid of you.", "Show yourself.", "I'm done running.", "This ends tonight."],
        hero_doubt:   ["This isn't real. This isn't real.", "Hello? Is — is someone there?", "I shouldn't be here.", "Please. Please stop."],
        hero_resolve: ["Okay. Okay. I see you.", "I know what you are.", "I'll do what has to be done.", "Tell me what you want."],
        villain_taunt:["You opened the door. I just walked through.", "You've been here before, you know.", "Stay. There is so much room for you.", "I have been so very patient."],
        villain_rage: ["You weren't supposed to leave.", "Come BACK.", "You promised.", "You promised."],
        mentor_wise:  ["Don't speak its name, {hero}. Names feed it.", "Salt the threshold. Do not turn around.", "You are not the first. You may be the last.", "Listen to the silences, not the sounds."],
        narration_open:  ["Some houses are not haunted.", "Some houses are hungry.", "It is later than you think."],
        narration_close: ["The lights stayed on for the rest of the year.", "The recording was never played again.", "Sometimes, late at night, the floorboards remember."]
      }
    },

    comedy: {
      label: "Comedy",
      palette: { sky: ["#fff8e7", "#ffd6a5", "#ffadad"], ground: "#caffbf", primary: "#ff70a6", secondary: "#70d6ff", accent: "#ffd670", glow: "#ffe5b4" },
      chars: ["Kevin", "Brenda", "Steve", "Carol", "Dave", "Linda", "Greg", "Tasha"],
      villains: ["the Aggressive HR Lady", "the Cat", "Steve from Accounting", "the Roomba", "Linda's Mother"],
      mentors: ["Kevin's life coach (who is also Kevin)", "the wise barista at the corner café"],
      settings: ["a slightly wrong office park", "a wedding that's gone deeply off-script", "the world's most haunted IKEA", "a community theater rehearsal", "the back row of a yoga retreat"],
      items: ["the last bagel", "a name tag that just says STEVE", "the misprinted business card", "the deeply illegal smoothie"],
      powers: ["has accidentally memorized the entire HR handbook", "cannot stop saying 'sorry' even when winning", "has a frankly unreasonable amount of charisma at 6 a.m.", "can fall up the stairs"],
      opening: [
        "It started, like all great disasters, with a Slack message.",
        "{hero} just wanted coffee. Just coffee. That was the only goal.",
        "{hero} woke up in {setting}, which was problem number one."
      ],
      inciting: [
        "Then — and this is the part {hero} keeps coming back to — {villain} showed up.",
        "{hero} reached for {item}. So did everyone else. Eye contact was made. War began.",
        "An email went out with {hero}'s name in the subject line. Reply-all. To the entire company."
      ],
      rising: [
        "{hero} tried to fix it. {hero} made it worse. {hero} tried again. Worse-er.",
        "Discovering, in this very moment, that {hero} {power}.",
        "{hero} formed a plan. The plan was not a good plan. The plan was THE plan."
      ],
      climax: [
        "There, at the front of the room, {hero} stood face to face with {villain}, and a microphone, and one (1) ill-advised PowerPoint slide.",
        "{hero} held up {item}, took a deep breath, and went off-script.",
        "Everyone went quiet. {villain} blinked. {hero} blinked. The Roomba blinked, somehow."
      ],
      resolution: [
        "Nobody got fired. Probably. {hero} doesn't open emails on weekends anymore.",
        "{villain} is now {hero}'s second-best friend, by accident.",
        "It's fine. {hero} is fine. Everything is fine. Yes."
      ],
      dialogue: {
        hero_brave:   ["Hi. Yes. Hello. I am doing this.", "I have made my decision. The decision is bagel.", "I am, in fact, the one who knocks. Politely.", "Cease."],
        hero_doubt:   ["Oh no.", "Oh nooo.", "Why is this happening to me, specifically.", "I should not be in charge of this."],
        hero_resolve: ["Right. Right. I have an idea. It is bad.", "I'm going to do the thing.", "Hold my coffee.", "Okay. Plan B. Or, frankly, plan G."],
        villain_taunt:["I have CC'd your manager.", "We're going to need to circle back on this.", "Per my last email...", "I respectfully disagree."],
        villain_rage: ["This is highly inappropriate!", "I will be filing a ticket about this!", "Unbelievable. UNBELIEVABLE.", "You think you're funny. You are not funny."],
        mentor_wise:  ["{hero}, just breathe. And lie a little.", "Have you tried turning yourself off and on again?", "Listen — you've already done the hard part. Existing.", "The bagel is a metaphor. Also it is a bagel."],
        narration_open:  ["This is a true story. Mostly.", "Names have been changed to protect Kevin.", "It was a Tuesday."],
        narration_close: ["And nothing was ever resolved, technically.", "The bagel was never seen again.", "{hero} was promoted, somehow."]
      }
    },

    mystery: {
      label: "Mystery",
      palette: { sky: ["#1a1a24", "#2a2434", "#3e3a4a"], ground: "#161620", primary: "#c4a85e", secondary: "#5e7ec4", accent: "#a85ec4", glow: "#e2cf94" },
      chars: ["Detective Marlow", "Inspector Cole", "Miss Vance", "Mr. Ito", "Officer Reyes"],
      villains: ["the Quiet Man", "the unseen accomplice", "someone in this very room", "the witness who lied"],
      mentors: ["the retired commissioner", "the coroner with the steady hands"],
      settings: ["the locked study at Ashford House", "the last car of the 9:14 train", "a small town where nobody locks their doors", "the hotel during the snowstorm"],
      items: ["the missing key", "a single torn ticket stub", "the letter in the second drawer", "the watch that stopped at 9:13"],
      powers: ["notices what other people choose to miss", "remembers every face they've ever logged", "has a quiet talent for asking the second question", "can tell when someone is lying by their pauses"],
      opening: [
        "The body was in {setting} when {hero} arrived. So were five witnesses, and five different stories.",
        "{hero} was retired. {hero} had been retired for three days, in fact, when the call about {setting} came in.",
        "It looked, at first, like nothing. That was {hero}'s first clue."
      ],
      inciting: [
        "The murder weapon was missing. So was {item}. So was the man who was supposed to be in the next room.",
        "{villain} had been in the room. {hero} could not yet prove it. But the dust was wrong.",
        "Then someone slid a note under the hotel door. The handwriting was {hero}'s own."
      ],
      rising: [
        "{hero} pieced it together quietly: {hero} {power}.",
        "Each interview gave a piece. Each piece, on its own, lied.",
        "By the third pot of coffee, {hero} had a name. By the fourth, the name had a motive."
      ],
      climax: [
        "{hero} gathered them all in the drawing room — and laid {item} on the table.",
        "'Only one of you,' {hero} said quietly, 'was where you said you were.'",
        "And then, calmly, {villain} stood up to leave. {hero} did not stop them. Not yet."
      ],
      resolution: [
        "The case closed with a signature. {hero} did not feel triumphant. Just tired.",
        "It was the smallest detail that did it. It almost always was.",
        "{hero} put on their coat, tipped their hat, and walked out into the rain."
      ],
      dialogue: {
        hero_brave:   ["I have one more question.", "Sit. This will take a moment.", "You are going to tell me the truth now.", "Don't lie to me. Not this time."],
        hero_doubt:   ["...something is wrong about this.", "It doesn't add up. It almost does. That's worse.", "I'm tired. I should be sharper.", "Why am I being told this NOW?"],
        hero_resolve: ["I see it.", "Of course. Of COURSE.", "It was the small thing.", "Get me the witness from Tuesday."],
        villain_taunt:["You have nothing.", "Even if you knew, you couldn't prove it.", "You're a small mind in a small room.", "You'll never find it."],
        villain_rage: ["You CAN'T.", "How — how did you —", "That isn't possible.", "You were never supposed to look there."],
        mentor_wise:  ["The answer is in the room, {hero}. It always is.", "When you cannot find the lie, find the silence.", "Trust the small things.", "Ask the second question."],
        narration_open:  ["The rain had not stopped for three days.", "It was the kind of night that made even the truth lie down quietly.", "Nobody noticed her, at first."],
        narration_close: ["The case file went into the cabinet.", "And the matter, formally, was closed.", "But the watch never did start ticking again."]
      }
    }
  };

  // Pure helpers
  function pick(arr, rng) { return arr[Math.floor(rng() * arr.length)]; }
  function pickN(arr, n, rng) {
    const copy = arr.slice();
    const out = [];
    for (let i = 0; i < n && copy.length; i++) {
      out.push(copy.splice(Math.floor(rng() * copy.length), 1)[0]);
    }
    return out;
  }
  function fill(template, ctx) {
    return template.replace(/\{(\w+)\}/g, (_, k) => ctx[k] != null ? ctx[k] : "{" + k + "}");
  }
  function makeRng(seedStr) {
    // Mulberry32 seeded from a hashed string. Deterministic output for a given seed.
    let h = 2166136261 >>> 0;
    for (let i = 0; i < seedStr.length; i++) {
      h ^= seedStr.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    let a = h || 1;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Distribute a desired scene count across narrative beats.
  function planBeats(count) {
    if (count <= 3) return ["opening", "climax", "resolution"];
    if (count === 4) return ["opening", "inciting", "climax", "resolution"];
    if (count === 5) return ["opening", "inciting", "rising", "climax", "resolution"];
    if (count === 6) return ["opening", "inciting", "rising", "rising", "climax", "resolution"];
    if (count === 7) return ["opening", "inciting", "rising", "rising", "climax", "climax", "resolution"];
    return ["opening", "inciting", "rising", "rising", "rising", "climax", "climax", "resolution"];
  }

  // Pick which speakers appear and what they say in a given beat.
  function dialogueForBeat(beat, beatIndex, totalBeats, dialog, ctx, rng) {
    const lines = [];
    const heroName = ctx.hero;
    const villainName = ctx.villain;
    const mentorName = ctx.mentor;

    function take(pool, speaker) {
      const line = fill(pick(pool, rng), ctx);
      lines.push({ speaker, text: line });
    }

    if (beat === "opening") {
      take(dialog.narration_open, "Narrator");
      if (beatIndex === 0 && rng() < 0.6) take(dialog.hero_doubt, heroName);
    } else if (beat === "inciting") {
      take(dialog.hero_doubt, heroName);
      if (rng() < 0.5) take(dialog.villain_taunt, villainName);
    } else if (beat === "rising") {
      if (rng() < 0.6) take(dialog.mentor_wise, mentorName);
      take(dialog.hero_resolve, heroName);
    } else if (beat === "climax") {
      take(dialog.villain_taunt, villainName);
      take(dialog.hero_brave, heroName);
      if (rng() < 0.7) take(dialog.villain_rage, villainName);
    } else if (beat === "resolution") {
      take(dialog.narration_close, "Narrator");
      if (rng() < 0.5) take(dialog.hero_resolve, heroName);
    }
    return lines;
  }

  // Decide which characters are physically "on stage" for this beat.
  function castForBeat(beat, ctx) {
    const hero = { id: "hero", name: ctx.hero, role: "protagonist" };
    const villain = { id: "villain", name: ctx.villain, role: "antagonist" };
    const mentor = { id: "mentor", name: ctx.mentor, role: "mentor" };
    if (beat === "opening")    return [hero];
    if (beat === "inciting")   return [hero, villain];
    if (beat === "rising")     return [hero, mentor];
    if (beat === "climax")     return [hero, villain];
    if (beat === "resolution") return [hero];
    return [hero];
  }

  // Try to weave the user's idea into the title and a single hook line.
  function buildTitle(idea, ctx, style, rng) {
    const ideaTrim = (idea || "").trim();
    const TITLES = {
      anime:   ["The Last %s", "Blade of %s", "%s and the Crimson Path", "Cry of %s", "%s of the Hidden Sky"],
      scifi:   ["Signal from %s", "The %s Protocol", "%s: Black Echo", "Outpost %s", "Beyond %s"],
      fantasy: ["The %s of Eldermoor", "Crown of %s", "%s and the Hollow Hill", "The Last %s", "%s Rising"],
      horror:  ["At Night, %s", "The %s House", "Don't Speak to %s", "%s, Apartment 3B", "What Happened to %s"],
      comedy:  ["%s, Kind Of", "The Very Online %s", "%s Has Notes", "Sorry About %s", "%s: A Misunderstanding"],
      mystery: ["The Case of %s", "%s and the Quiet Room", "Last Train to %s", "Inspector %s", "The %s Affair"]
    };
    const subjectFromIdea = (() => {
      const words = ideaTrim
        .split(/\s+/)
        .filter(w => /^[\p{L}\p{N}'-]{4,}$/u.test(w) && !STOP.has(w.toLowerCase()));
      if (words.length) return words[Math.floor(rng() * words.length)];
      return ctx.hero;
    })();
    const tmpl = pick(TITLES[style] || TITLES.anime, rng);
    const title = tmpl.replace("%s", capitalize(subjectFromIdea));
    const subtitle = ideaTrim ? truncate(ideaTrim, 90) : "An original short.";
    return { title, subtitle };
  }

  function capitalize(s) {
    if (!s) return s;
    return s[0].toUpperCase() + s.slice(1);
  }
  function truncate(s, n) {
    if (s.length <= n) return s;
    return s.slice(0, n - 1) + "…";
  }
  const STOP = new Set([
    "the","and","with","that","this","from","into","when","then","what","they","them","were","have",
    "your","yours","their","there","about","just","like","because","while","over","very","really",
    "would","could","should","still","such","make","made","also","some","more","much","many","most"
  ]);

  // ----- Public API ------------------------------------------------
  function generate(opts) {
    const idea = (opts && opts.idea) || "";
    const styleKey = (opts && opts.style) || "anime";
    const sceneCount = clamp((opts && opts.sceneCount) || 5, 3, 8);
    const seed = (opts && opts.seed) || (idea + "|" + styleKey + "|" + Date.now());

    const style = STYLES[styleKey] || STYLES.anime;
    const rng = makeRng(seed);

    const ctx = {
      hero:    pick(style.chars, rng),
      villain: pick(style.villains, rng),
      mentor:  pick(style.mentors, rng),
      setting: pick(style.settings, rng),
      item:    pick(style.items, rng),
      power:   pick(style.powers, rng)
    };

    const beats = planBeats(sceneCount);
    const scenes = beats.map((beat, i) => {
      const narration = fill(pick(style[beat], rng), ctx);
      const dialogue = dialogueForBeat(beat, i, beats.length, style.dialogue, ctx, rng);
      const cast = castForBeat(beat, ctx);
      return {
        index: i,
        beat,
        narration,
        dialogue,
        cast,
        mood: moodForBeat(beat)
      };
    });

    const meta = buildTitle(idea, ctx, styleKey, rng);

    return {
      title: meta.title,
      subtitle: meta.subtitle,
      style: styleKey,
      palette: style.palette,
      hero: ctx.hero,
      villain: ctx.villain,
      mentor: ctx.mentor,
      setting: ctx.setting,
      scenes
    };
  }

  function moodForBeat(beat) {
    return {
      opening:    "calm",
      inciting:   "tense",
      rising:     "determined",
      climax:     "intense",
      resolution: "reflective"
    }[beat] || "calm";
  }

  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  function listStyles() {
    return Object.keys(STYLES).map(k => ({ key: k, label: STYLES[k].label }));
  }

  global.MovieStory = { generate, listStyles };
})(window);
