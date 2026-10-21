# Ant Haven 🐜

A mobile-first ant-colony game: dig tunnels in a cutaway nest, raise a queen's brood, farm fungus, survive floods and raids, and conquer the enemy hill.

**Play:** https://danielo3222.github.io/ant-colony/ (add to the home screen; works offline after the first load)

## How to play
- Tap food on the surface to send harvesters. Ants eat all the time, so keep 🍯 above zero.
- ⛏ **Dig**: drag from a tunnel into the dirt (1 🍯 per cell). Workers dig it out.
- 🏠 **Rooms**: pick one, tap beside a tunnel. Storage, Egg Room, Sleeping Den, Queen Chamber, Nursery, Barracks, Fungus Garden, Pantry, Lookout, Sump.
- 🐜 **Colony**: ＋/− to turn workers into harvesters, leaf-cutters or soldiers.
- Rain floods the deepest tunnels first; a deep Sump drains it. Raids come from the enemy hill; a Lookout warns early.
- 🥚 **Colony → Lay egg** always shows the cost and the exact reason it's blocked, with a one-tap fix. Pick whether new ants hatch as workers or harvesters.
- 🗺️ **Surface map** (toggle 🕳️ Nest / 🗺️ Surface): a big top-down yard with fog of war and a minimap. 🌾/⚔️ Send ants out, tap or box-select them, then tap food, a bug, a rival hill or the ground. 🚩 sets a rally point, 🏠 recalls.
- 🏴 2 rival colonies (3 on Hard) forage, fight and raid you. Capture a hill for an outpost: +6 ant space and steady food.
- ⚠️ Surface dangers, all telegraphed: a growing foot shadow (then STOMP), a magnifying-glass light that chases clusters (hide under leaves or in a hill), and big bugs (spider, beetle, centipede, ladybug) that drop lots of food. Set Off / Easy / Hard in ☰.
- Hold, then drag a box to select soldiers; tap to move, tap the enemy hill to attack. Destroy it to win, then keep going in endless mode.

🎵 Music and sound effects start after your first tap. Turn Music or Sounds on/off and set the volume in ☰.

Biomes: Backyard, Sand Dunes (sandstorms, fast digging, scarce food), Ice World (cold snaps, slow digging). Seven more are coming soon.

## Tech
Plain HTML/Canvas 2D, no build step: `sim.js` (simulation), `draw.js` (code-drawn art), `ui.js` (HUD, input, loop), `audio.js` (looping `assets/music.mp3` plus sound effects synthesized in Web Audio, no sound files). PWA with a network-first service worker that reloads itself on update. Saves to localStorage.

Tests: `python tests/smoke.py http://127.0.0.1:8811/` and `tests/audio.py` (Playwright + headless Chrome at 390×844).
