# Ant Haven 🐜

A mobile-first ant-colony game: dig tunnels in a cutaway nest, raise a queen's brood, farm fungus, survive floods and raids, and conquer the enemy hill.

**Play:** https://danielo3222.github.io/ant-colony/ (add to the home screen; works offline after the first load)

## How to play
- Tap food on the surface to send harvesters. Ants eat all the time, so keep 🍯 above zero.
- ⛏ **Dig**: drag from a tunnel into the dirt (1 🍯 per cell). Workers dig it out.
- 🏠 **Rooms**: pick one, tap beside a tunnel. Storage, Egg Room, Sleeping Den, Queen Chamber, Nursery, Barracks, Fungus Garden, Pantry, Lookout, Sump.
- 🐜 **Colony**: ＋/− to turn workers into harvesters, leaf-cutters or soldiers.
- Rain floods the deepest tunnels first; a deep Sump drains it. Raids come from the enemy hill; a Lookout warns early.
- Hold, then drag a box to select soldiers; tap to move, tap the enemy hill to attack. Destroy it to win, then keep going in endless mode.

Biomes: Backyard, Sand Dunes (sandstorms, fast digging, scarce food), Ice World (cold snaps, slow digging). Seven more are coming soon.

## Tech
Plain HTML/Canvas 2D, no build step: `sim.js` (simulation), `draw.js` (code-drawn art), `ui.js` (HUD, input, loop). PWA with a network-first service worker that reloads itself on update. Saves to localStorage.

Tests: `python tests/smoke.py http://127.0.0.1:8811/` (Playwright + headless Chrome at 390×844).
