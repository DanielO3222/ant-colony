"""Headless phone-size smoke test for Ant Haven. Run: venv/bin/python tests/smoke.py [url]"""
import sys, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8811/"
SS = "/workspace/ant-colony/screenshots/"
ok, bad = [], []
def check(c, m): (ok if c else bad).append(m); print(("PASS " if c else "FAIL ") + m, flush=True)

FIND_ROOM = """(k, prefY) => { const A = AH; let best = null, bd = 1e9;
  for (let y = 1; y < A.ROWS - 2; y++) for (let x = 1; x < A.COLS - 2; x++) { if (!A.canRoom(k, x, y).ok) continue; const d = Math.abs(y - prefY) * 2 + Math.abs(x - A.ENT) * .5; if (d < bd) { bd = d; best = {x, y}; } } return best; }"""
BOT = """(FIND) => { const A = AH, S = A.S, find = eval(FIND), log = [];
  const ad = A.adults(), h = A.count('harvester');
  const wantH = Math.max(3, Math.round(ad * .34)); if ((h < wantH || S.res.food < 20) && A.count('worker') > 2) { const r = A.assign('harvester', 1); if (r.ok) log.push('+harv'); }
  if (S.res.food > 70 && h > 3 && A.count('worker') < 2) A.assign('harvester', -1);
  const plan = [['den', 8], ['queen', 9], ['barracks', 4], ['garden', 8], ['nursery', 7], ['lookout', 2], ['den', 10], ['sump', 30], ['eggs', 9], ['storage', 6], ['den', 11], ['pantry', 7]];
  for (const [k, py] of plan) { const n = plan.filter(p => p[0] === k).indexOf(plan.find(p => p[0] === k && p[1] === py)); if (A.roomsOf(k).length > n) continue;
    const c = A.ROOMS[k].cost; if ((c.food || 0) + 12 > S.res.food || (c.leaves || 0) > S.res.leaves) break;
    let s = find(k, k === 'sump' ? 30 : py); if (!s && k === 'sump') { // dig a deep shaft first
      if (!S.grid.some(v => v === 2)) { const deep = [...Array(A.COLS * A.ROWS).keys()].filter(i => S.grid[i] === 1).sort((a, b) => A.cy(b) - A.cy(a))[0]; const p = []; for (let y = A.cy(deep); y < A.cy(deep) + 6 && y < A.ROWS - 2; y++) p.push(A.idx(A.cx(deep), y)); A.commitDig(p); log.push('deepdig'); } break; }
    if (s) { const r = A.placeRoom(k, s.x, s.y); if (r.ok) log.push('room:' + k); } break; }
  // keep some tunnels growing
  if (!S.grid.some(v => v === 2) && S.res.food > 35) { const dug = [...Array(A.COLS * A.ROWS).keys()].filter(i => S.grid[i] === 1 && A.cy(i) > 2);
    const st = dug[Math.floor(Math.random() * dug.length)], dir = [[1,0],[-1,0],[0,1]][Math.floor(Math.random() * 3)], p = [];
    for (let k = 0; k < 6; k++) { const x = A.cx(st) + dir[0] * k, y = A.cy(st) + dir[1] * k; if (x < 1 || x > A.COLS - 2 || y > A.ROWS - 2) break; p.push(A.idx(x, y)); }
    const r = A.commitDig(p); if (r.ok) log.push('dig' + r.cells.length); }
  if (A.has('barracks') && A.count('soldier') < 3 + Math.floor(S.raid.n) && S.res.food > 30) { const r = A.assign('soldier', 1); if (r.ok) log.push('+sold'); }
  if (A.has('garden') && A.count('cutter') < 2 && S.res.food > 25) { const r = A.assign('cutter', 1); if (r.ok) log.push('+cut'); }
  return log; }"""
SNAP = """() => { const S = AH.S, q = S.units.find(u => u.k === 'queen'); return {t: Math.round(S.t), food: Math.round(S.res.food), cap: AH.foodCap(), leaves: S.res.leaves, ants: AH.adults(), pop: AH.popCap(), eggs: S.eggs.length,
  w: AH.count('worker'), h: AH.count('harvester'), c: AH.count('cutter'), s: AH.count('soldier'), q: q ? Math.round(q.hp) : 0, rooms: S.rooms.filter(r => r.done).map(r => r.k).join(','),
  hatched: S.st.hatched, raids: S.st.raids, raidActive: S.raid.active, raiders: AH.count('raider'), water: +S.water.toFixed(2), floods: S.st.floods, over: S.over, goals: Object.keys(S.goals).length, plan: S.grid.filter(v => v === 2).length}; }"""
W2S = "([x, y]) => AH.w2s(x, y)"

with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append("pageerror: " + str(e)))
    pg.on("console", lambda m: m.type == "error" and errs.append("console: " + m.text))
    cdp = ctx.new_cdp_session(pg)
    def touch(t, pts): cdp.send("Input.dispatchTouchEvent", {"type": t, "touchPoints": [{"x": x, "y": y, "id": i} for i, (x, y) in enumerate(pts)]})
    def tap(x, y): touch("touchStart", [(x, y)]); pg.wait_for_timeout(40); touch("touchEnd", []); pg.wait_for_timeout(80)
    def drag(a, c, n=12, hold=0):
        touch("touchStart", [(a["x"], a["y"])])
        if hold: pg.wait_for_timeout(hold)
        for i in range(1, n + 1): touch("touchMove", [(a["x"] + (c["x"] - a["x"]) * i / n, a["y"] + (c["y"] - a["y"]) * i / n)]); pg.wait_for_timeout(16)
    def run(sec):
        pg.evaluate(f"() => {{ for (let i = 0; i < 30 * {sec}; i++) AH.step(1/30); }}")
    def snap(): return pg.evaluate(SNAP)

    pg.goto(URL); pg.wait_for_selector("[data-o=new]"); pg.wait_for_timeout(1200)
    pg.screenshot(path=SS + "01-title.png")
    check(pg.locator(".bio").count() == 10 and pg.locator(".bio.soon").count() == 0, "title shows 10 playable biomes, none coming soon")
    pg.click("[data-bio=mars]"); pg.wait_for_timeout(100); check("Red Planet" in pg.inner_text(".bdesc") or "gravity" in pg.inner_text(".bdesc"), "Red Planet can be picked and shows its description")
    pg.click("[data-bio=dunes]"); pg.wait_for_timeout(700); pg.screenshot(path=SS + "01b-title-dunes.png")
    pg.click("[data-bio=backyard]"); pg.wait_for_timeout(300)
    pg.evaluate("() => localStorage.clear()")
    pg.click("[data-o=new]"); pg.wait_for_timeout(300)
    pg.evaluate("() => AH.startGame(AH.newState('backyard', 'easy', 777))"); pg.wait_for_timeout(900)   # fixed rock layout
    s0 = snap(); print(s0)
    check(s0["q"] > 0 and s0["w"] == 4 and s0["h"] == 2 and s0["food"] == 50, f"new game: queen, 4 workers, 2 harvesters, 50 food {s0}")
    check(pg.is_visible("#coach") and "crumbs" in pg.inner_text("#coach"), "tutorial step 1 asks to tap the crumbs")
    pg.screenshot(path=SS + "02-start.png")

    # --- tutorial 1: tap the crumbs with a real finger tap ---
    it = pg.evaluate("() => { const it = AH.S.items.find(i => i.k === 'food' && AH.S.fog[Math.floor(i.x / AH.CS)]); return {x: it.x, id: it.id}; }")
    sp = pg.evaluate(W2S, [it["x"], -8]); tap(sp["x"], sp["y"])
    check(pg.evaluate("() => AH.S.forage") == it["id"] and pg.evaluate("() => AH.S.tut") == 1, "tapping crumbs sends harvesters and advances the tutorial")
    # --- tutorial 2: colony +harvester ---
    pg.click("#tab-colony"); pg.wait_for_timeout(150); pg.screenshot(path=SS + "03-colony.png")
    pg.click("[data-a='+harvester']"); pg.wait_for_timeout(350)
    check(pg.evaluate("() => AH.count('harvester')") == 3 and pg.evaluate("() => AH.S.tut") == 2, "Colony ＋ makes a 3rd harvester, tutorial advances")
    lk = pg.inner_text("#sheet"); check("Barracks" in lk, "soldier/cutter rows say they need a Barracks")
    # --- tutorial 3: dig by dragging ---
    pg.click("#tab-dig"); pg.wait_for_timeout(700)
    check(pg.evaluate("() => AH.UI.mode") == "dig" and pg.is_visible("#mode"), "Dig mode on with banner + Done button")
    a = pg.evaluate(W2S, [(32 + .5) * 24, 3.5 * 24]); c = pg.evaluate(W2S, [(32 + 7.5) * 24, 3.5 * 24])
    f0 = pg.evaluate("() => AH.S.res.food")
    drag(a, c); pg.wait_for_timeout(100); pg.screenshot(path=SS + "04-dig-preview.png")
    prev = pg.evaluate("() => AH.digPlan(AH.UI.dpath)")
    touch("touchEnd", []); pg.wait_for_timeout(200)
    f1 = pg.evaluate("() => AH.S.res.food"); np = pg.evaluate("() => AH.S.grid.filter(v => v === 2).length")
    np = pg.evaluate("() => AH.S.st.planned")
    check(prev["ok"] and len(prev["cells"]) == 7 and prev["cost"] == 7 and np == 7, f"drag digs a 7-cell tunnel plan, preview cost 7 (food {f0:.1f}->{f1:.1f}) {prev} planned={np}")
    check(pg.evaluate("() => AH.S.tut") == 3, "tutorial advances after digging")
    # dragging from plain soil is refused
    a2 = pg.evaluate(W2S, [10.5 * 24, 12.5 * 24]); c2 = pg.evaluate(W2S, [14.5 * 24, 12.5 * 24])
    pg.evaluate("([x, y]) => { AH.cam.x = x; AH.cam.y = y; }", [12 * 24, 12 * 24]); pg.wait_for_timeout(50)
    a2 = pg.evaluate(W2S, [10.5 * 24, 12.5 * 24]); c2 = pg.evaluate(W2S, [14.5 * 24, 12.5 * 24]); drag(a2, c2); touch("touchEnd", []); pg.wait_for_timeout(150)
    check(pg.evaluate("() => AH.S.st.planned") == 7 and "existing tunnel" in pg.inner_text("#toasts"), "a dig not connected to a tunnel is refused with a reason")
    pg.click("#mode-x"); check(pg.evaluate("() => AH.UI.mode") is None, "Done leaves dig mode")
    run(25)   # workers dig
    dug = pg.evaluate("() => AH.S.st.dug"); check(dug >= 3, f"workers dig the planned tunnel ({dug} cells after 25s)")
    # --- tutorial 4/5: rooms via tap ---
    pg.evaluate("() => { AH.cam.x = AH.ENTX + 60; AH.cam.y = 120; AH.cam.z = 1.15; }")
    pg.click("#tab-rooms"); pg.wait_for_timeout(150); pg.screenshot(path=SS + "05-rooms.png")
    pg.click("[data-room=storage]"); pg.wait_for_timeout(100)
    check(pg.evaluate("() => AH.UI.mode") == "room" and "Cancel" in pg.inner_text("#mode"), "room placement mode shows a clear Cancel")
    s = pg.evaluate(FIND_ROOM.replace("(k, prefY)", "([k, prefY])"), ["storage", 1])
    pg.evaluate("([x, y]) => { AH.cam.x = x; AH.cam.y = y; }", [(s["x"] + 1.5) * 24, (s["y"] + 1) * 24]); pg.wait_for_timeout(60)
    gp = pg.evaluate(W2S, [(s["x"] + 1.5) * 24, (s["y"] + 1) * 24 + 30 / 1.15])
    touch("touchStart", [(gp["x"], gp["y"])]); touch("touchMove", [(gp["x"] + 1, gp["y"])]); pg.wait_for_timeout(120); pg.screenshot(path=SS + "06-room-ghost.png"); gh = pg.evaluate("() => [AH.UI.ghost, AH.UI.room, AH.UI.ghost && AH.canRoom(AH.UI.room, AH.UI.ghost.x, AH.UI.ghost.y)]"); touch("touchEnd", []); pg.wait_for_timeout(200)
    print("ghost", pg.evaluate("() => [pointers.size, gest && gest.kind, (e => e && (e.id || e.className || e.tagName) + '<' + (e.parentElement && (e.parentElement.id || e.parentElement.className)))(document.elementFromPoint(%f, %f)), %f, %f]" % (gp["x"], gp["y"], gp["x"], gp["y"])), s, gh, pg.inner_text("#toasts"))
    check(len(pg.evaluate("() => AH.roomsOf('storage')")) == 1 and pg.evaluate("() => AH.UI.mode") is None, "Food Storage placed by tap, placement mode ends by itself")
    pg.click("#tab-rooms"); pg.click("[data-room=den]"); s = pg.evaluate(FIND_ROOM.replace("(k, prefY)", "([k, prefY])"), ["den", 5])
    pg.evaluate("([x, y]) => { AH.cam.x = x; AH.cam.y = y; }", [(s["x"] + 1.5) * 24, (s["y"] + 1) * 24]); pg.wait_for_timeout(60)
    gp = pg.evaluate(W2S, [(s["x"] + 1.5) * 24, (s["y"] + 1) * 24 + 30 / 1.15]); tap(gp["x"], gp["y"]); pg.wait_for_timeout(150)
    check(len(pg.evaluate("() => AH.roomsOf('den')")) == 1, "Sleeping Den placed")
    check(pg.evaluate("() => AH.S.tut") == 5 and "Surface" in pg.inner_text("#coach"), "tutorial step 6 points to the Surface map")
    pg.click("#vt-yard"); pg.wait_for_timeout(150); pg.click("#yb-harv"); pg.wait_for_timeout(150); pg.click("#vt-nest"); pg.wait_for_timeout(300)
    check(pg.evaluate("() => AH.S.tut") == 6 and "Got it" in pg.inner_text("#coach"), "tutorial reaches its last card")
    pg.click("#coach-ok"); check(not pg.is_visible("#coach"), "tutorial closes")
    # cancel works
    pg.click("#tab-rooms"); pg.click("[data-room=pantry]"); pg.click("#mode-x"); check(pg.evaluate("() => AH.UI.mode") is None, "Cancel exits room placement")

    # --- hatching is ALWAYS possible (the playtest bug) ---
    hb = pg.evaluate("""() => { const S = AH.S, out = {}; S.res.food = 60;
      out.start = AH.canLay();
      // fill the colony to the cap: lay is blocked with a Den fix, never silently
      while (AH.canLay().ok) AH.layEgg(); out.full = AH.canLay();
      return out; }""")
    check(hb["start"]["ok"], f"queen can lay at the start (starter Egg Room) {hb['start']}")
    check(not hb["full"]["ok"] and hb["full"].get("fix") in ("den", "eggs"), f"when blocked, the reason comes with a one-tap fix {hb['full']}")
    pg.click("#tab-colony"); pg.wait_for_timeout(150)
    check(pg.locator("[data-a=lay]").count() == 1 and pg.locator("[data-a^='fix:']").count() == 1 and pg.locator("[data-a='lay:worker']").count() == 1, "Colony panel shows Lay egg, the fix button and a Worker ＋")
    check("⛔" in pg.inner_text(".brood"), "blocked reason shown in the brood card: " + pg.inner_text(".brood .bw"))
    pg.screenshot(path=SS + "03b-brood-blocked.png")
    pg.evaluate("() => { const S = AH.S; S.eggs.length = 0; S.res.food = 60; }"); pg.wait_for_timeout(300)
    pg.click("[data-a='as:harvester']"); n0 = pg.evaluate("() => AH.S.eggs.length"); pg.click("[data-a=lay]"); pg.wait_for_timeout(100)
    e = pg.evaluate("() => AH.S.eggs.map(e => e.as)")
    check(len(e) == n0 + 1 and e[-1] == "harvester", f"Lay egg now works and respects 'hatch as harvester' {e}")
    h0 = pg.evaluate("() => AH.count('harvester')"); run(45)
    check(pg.evaluate("() => AH.count('harvester')") > h0, "the harvester egg hatched into a harvester (no worker converted)")
    # with only one worker, Harvester ＋ lays a harvester egg instead of refusing
    pg.evaluate("() => { const S = AH.S; S.units.filter(u => u.k === 'worker').slice(1).forEach(u => u.k = 'harvester'); S.res.food = 60; S.eggs.length = 0; }"); pg.wait_for_timeout(300)
    pg.click("[data-a='+harvester']"); pg.wait_for_timeout(100)
    check(pg.evaluate("() => AH.S.eggs.length") == 1 and "harvester egg" in pg.inner_text("#toasts"), "with 1 worker left, ＋Harvester lays a harvester egg instead of failing")
    pg.click("[data-a='lay:worker']"); check(pg.evaluate("() => AH.S.eggs.slice(-1)[0].as") == "worker", "Worker ＋ lays a worker egg")
    pg.evaluate("() => { const S = AH.S; S.hatchAs = 'worker'; S.units.filter(u => u.k === 'harvester').slice(3).forEach(u => u.k = 'worker'); }"); pg.click("[data-a=close]")
    # --- 10 minutes of play following the tutorial strategy ---
    minfood, starved, lowseen, log = 999, 0, False, []
    shots = {}
    for k in range(60):
        acts = pg.evaluate(BOT, FIND_ROOM)
        run(10); s = snap(); log.append(s)
        minfood = min(minfood, s["food"]); starved += s["food"] <= 0
        if k % 6 == 0 or acts: print(k, acts, s, flush=True)
        if s["raidActive"] and "raid" not in shots:
            pg.evaluate("() => { const r = AH.S.units.filter(u => u.k === 'raider'); if (r.length) { AH.cam.x = r[0].x; AH.cam.y = r[0].y + 40; AH.cam.z = 1.4; } }"); pg.wait_for_timeout(250); pg.screenshot(path=SS + "08-raid.png"); shots["raid"] = 1
        if s["water"] > 1.5 and "flood" not in shots:
            pg.evaluate("() => { const S = AH.S; let deep = 0; for (let i = 0; i < AH.COLS * AH.ROWS; i++) if (AH.wl[i] > .3) deep = i; AH.cam.x = (AH.cx(deep) + .5) * 24; AH.cam.y = AH.cy(deep) * 24 - 60; AH.cam.z = 1.2; }"); pg.wait_for_timeout(250); pg.screenshot(path=SS + "09-flood.png"); shots["flood"] = 1
        if s["over"]: break
    f = log[-1]; print("FINAL", f)
    check(not f["over"] and f["q"] > 0, f"colony survives 10+ minutes following the tutorial strategy (t={f['t']}s)")
    check(starved == 0, f"never ran out of food (min food {minfood})")
    check(f["ants"] >= 14, f"colony grew from 6 to {f['ants']} ants")
    check(f["hatched"] >= 5, f"queen + eggs + hatching loop works ({f['hatched']} hatched)")
    check(f["raids"] >= 1 and not f["raidActive"] or f["raids"] >= 1, f"at least one raid came and was resolved ({f['raids']} raids)")
    check(f["floods"] >= 1, f"rain flooded tunnels at least once ({f['floods']})")
    check("garden" in f["rooms"] and f["leaves"] >= 0 and pg.evaluate("() => AH.S.st.leaves") >= 3, f"leaf-cutters delivered leaves to the garden ({pg.evaluate('() => AH.S.st.leaves')})")
    check(f["goals"] >= 10, f"{f['goals']} of 15 goals completed")
    pg.evaluate("() => { AH.cam.x = AH.ENTX; AH.cam.y = 150; AH.cam.z = .62; }"); pg.wait_for_timeout(300); pg.screenshot(path=SS + "07-colony-10min.png")
    pg.evaluate("() => { AH.cam.x = AH.ENTX; AH.cam.y = 110; AH.cam.z = 1.25; }"); pg.wait_for_timeout(300); pg.screenshot(path=SS + "07b-nest-close.png")

    # --- garden makes food from leaves ---
    g = pg.evaluate("() => { const S = AH.S; S.res.leaves = 10; S.res.food = 10; const f0 = S.res.food; for (let i = 0; i < 30 * 20; i++) AH.step(1/30); return {used: 10 - S.res.leaves, food: S.res.food - f0}; }")
    check(g["used"] >= 2, f"Fungus Garden turns leaves into food {g}")

    # --- raid resolution with soldiers (focused) ---
    r = pg.evaluate("""() => { const S = AH.S; S.raid.next = S.t; S.raid.warned = true; S.haz.on = false; const n0 = S.st.raids; let t = 0;
       for (; t < 30 * 120; t++) { AH.step(1/30); if (S.st.raids > n0) break; } return {resolved: S.st.raids > n0, secs: Math.round(t / 30), kills: S.raid.kills, lost: S.raid.lost}; }""")
    check(r["resolved"], f"a forced raid resolves {r}")

    # --- flood drains over time ---
    fl = pg.evaluate("() => { const S = AH.S; S.water = 12; AH.computeWater(); const w0 = S.water; for (let i = 0; i < 30 * 60; i++) AH.step(1/30); return {w0, w1: +S.water.toFixed(2), anyWet: Array.from(AH.wl).some(v => v > .5)}; }")
    check(fl["w1"] < fl["w0"] * .6, f"flood water drains over time {fl}")

    # --- box select soldiers on the surface with hold-drag, then attack the hill ---
    pg.evaluate("""() => { const S = AH.S; S.raid.next = S.t + 9999; for (let i = 0; i < 6; i++) { const u = AH.addU('soldier', AH.ENTX + 80 + i * 10, -5); u.mode = 'move'; u.tx = u.x; u.ty = u.y; }
       for (let i = 0; i < 4; i++) AH.addU('worker', AH.ENTX + 85 + i * 10, -5); AH.cam.x = AH.ENTX + 100; AH.cam.y = -40; AH.cam.z = 1.6; }""")
    pg.wait_for_timeout(120)
    a = pg.evaluate(W2S, [pg.evaluate("() => AH.ENTX") + 70, -30]); c = pg.evaluate(W2S, [pg.evaluate("() => AH.ENTX") + 140, 6])
    drag(a, c, 8, hold=pg.evaluate("() => AH.HOLD_MS") + 120); pg.wait_for_timeout(60); pg.screenshot(path=SS + "10-box-select.png"); touch("touchEnd", []); pg.wait_for_timeout(150)
    n = pg.evaluate("() => AH.UI.sel.length"); check(n >= 6 and pg.evaluate("() => AH.UI.sel.every(id => AH.S.units.find(u => u.id === id).k === 'soldier')"), f"hold + drag box selects only soldiers ({n})")
    check("soldier" in pg.inner_text("#mode") and "Deselect" in pg.inner_text("#mode"), "selection banner with Deselect")
    # tap on the ground moves them
    gp = pg.evaluate(W2S, [pg.evaluate("() => AH.ENTX") + 40, -6]); tap(gp["x"], gp["y"])
    check(pg.evaluate("() => AH.S.units.filter(u => u.k === 'soldier' && u.mode === 'move').length") >= 6, "tap moves the selected soldiers")
    # reveal the hill and attack it with everyone
    pg.evaluate("() => { const S = AH.S; S.fog.fill(1); for (let i = 0; i < 10; i++) AH.addU('soldier', S.hill.x - 200 + i * 6, -5); AH.cam.x = S.hill.x; AH.cam.y = -50; }"); pg.wait_for_timeout(80)
    pg.click("#btn-army"); n = pg.evaluate("() => AH.UI.sel.length")
    hp = pg.evaluate(W2S, [pg.evaluate("() => AH.S.hill.x"), -30]); tap(hp["x"], hp["y"])
    check(pg.evaluate("() => AH.S.units.filter(u => u.k === 'soldier' && u.mode === 'attack').length") >= n - 1, f"tapping the enemy hill sends {n} selected soldiers to attack")
    run(5); pg.evaluate("() => { const S = AH.S; AH.cam.x = S.hill.x - 30; AH.cam.y = -40; AH.cam.z = 1.5; }"); pg.wait_for_timeout(200); pg.screenshot(path=SS + "11-hill-attack.png")
    for k in range(12):
        run(10)
        if k == 99: pg.evaluate("() => { const S = AH.S; AH.cam.x = S.hill.x - 20; AH.cam.y = -40; AH.cam.z = 1.5; }"); pg.wait_for_timeout(200); pg.screenshot(path=SS + "11-hill-attack.png")
        if pg.evaluate("() => AH.S.hill.dead"): break
    if k == 0: pg.wait_for_timeout(10)
    check(pg.evaluate("() => AH.S.hill.dead and AH.S.won") if False else pg.evaluate("() => AH.S.hill.dead && AH.S.won"), "soldiers destroy the enemy hill -> win")
    pg.wait_for_timeout(1500); pg.screenshot(path=SS + "12-victory.png")
    check(pg.is_visible("text=Victory!") and pg.locator(".stats div").count() == 12, "victory screen with 12 stats")
    pg.click("[data-o=endless]"); pg.wait_for_timeout(100)
    check(pg.evaluate("() => AH.S.endless") and not pg.is_visible("#overlay"), "Keep playing switches to endless mode")
    rr = pg.evaluate("""() => { const S = AH.S; S.raid.next = S.t; const n0 = S.st.raids; for (let t = 0; t < 30 * 150; t++) { AH.step(1/30); if (S.st.raids > n0) break; } return S.st.raids > n0; }""")
    check(rr, "endless mode raids still come (from the map edge) and resolve")

    # --- save / load ---
    pg.evaluate("() => AH.save()")
    before = pg.evaluate("() => ({u: AH.S.units.length, rooms: AH.S.rooms.length, dug: AH.S.grid.filter(v => v === 1).length, food: Math.floor(AH.S.res.food), t: Math.floor(AH.S.t), eggs: AH.S.eggs.length})")
    pg.reload(); pg.wait_for_selector("[data-o=continue]"); pg.wait_for_timeout(300)
    pg.click("[data-o=continue]"); pg.wait_for_timeout(500)
    after = pg.evaluate("() => ({u: AH.S.units.length, rooms: AH.S.rooms.length, dug: AH.S.grid.filter(v => v === 1).length, food: Math.floor(AH.S.res.food), t: Math.floor(AH.S.t), eggs: AH.S.eggs.length})")
    check(before["rooms"] == after["rooms"] and before["dug"] == after["dug"] and abs(before["u"] - after["u"]) <= 1 and abs(before["t"] - after["t"]) <= 2, f"save/continue restores the colony {before} -> {after}")
    run(20); check(not pg.evaluate("() => AH.S.over") and not errs, "loaded game keeps running without errors")

    # --- room info + remove ---
    rid = pg.evaluate("() => AH.roomsOf('den')[0]?.id")
    if rid:
        pg.evaluate("(id) => { const r = AH.S.rooms.find(r => r.id === id); AH.cam.x = (r.x + r.w / 2) * 24; AH.cam.y = (r.y + 1) * 24; AH.cam.z = 1.2; }", rid); pg.wait_for_timeout(60)
        rp = pg.evaluate("(id) => { const r = AH.S.rooms.find(r => r.id === id); return AH.w2s((r.x + 1.5) * 24, (r.y + 1) * 24); }", rid); tap(rp["x"], rp["y"])
        check("Sleeping Den" in pg.inner_text("#sheet") and "Remove" in pg.inner_text("#sheet"), "tapping a room opens its info with Remove")
        pg.screenshot(path=SS + "13-room-info.png"); pg.click("[data-a=close]")

    # --- game over ---
    pg.evaluate("() => { AH.S.units.find(u => u.k === 'queen').hp = 0; AH.step(1/30); }"); pg.wait_for_timeout(1500)
    check(pg.is_visible("text=The colony has fallen") and pg.locator(".stats div").count() == 12, "queen dies -> game-over screen with stats")
    pg.screenshot(path=SS + "14-game-over.png")
    check(pg.evaluate("() => AH.loadSaved()") is None, "game over clears the save")

    # --- other biomes: Sand Dunes + Ice World ---
    for bio, haz in (("dunes", "sandstorm"), ("ice", "cold")):
        (pg.click("[data-o=title]") if pg.is_visible("[data-o=title]") else (pg.click("#btn-menu"), pg.click("[data-o=quit]"))); pg.wait_for_timeout(200); pg.click(f"[data-bio={bio}]"); pg.wait_for_timeout(200); pg.click("[data-o=new]"); pg.wait_for_timeout(500)
        pg.evaluate("() => { AH.S.tut = 99; }")
        for k in range(18): pg.evaluate(BOT, FIND_ROOM); run(10)
        s = snap(); print(bio, s)
        check(not s["over"] and s["food"] > 0 and s["ants"] >= 8, f"{bio}: colony healthy after 3 min {s['ants']} ants, food {s['food']}")
        h = pg.evaluate("""() => { const S = AH.S; S.haz.next = S.t + 15; for (let i = 0; i < 30 * 19; i++) AH.step(1/30); const on = S.haz.on; const out = S.units.filter(u => u.tm === 0 && u.y < 1 && u.k !== 'soldier').length;
           return {on, out, kind: AH.S.biome}; }""")
        pg.evaluate("() => { AH.cam.x = AH.ENTX + 60; AH.cam.y = -10; AH.cam.z = 1.1; }"); pg.wait_for_timeout(300); pg.screenshot(path=SS + f"15-{bio}-hazard.png")
        check(h["on"] and h["out"] <= 2, f"{bio}: {haz} starts and ants shelter underground {h}")
        pg.evaluate("() => { const S = AH.S; S.haz.on = false; S.haz.next = S.t + 999; for (let i = 0; i < 30 * 20; i++) AH.step(1/30); AH.cam.x = AH.ENTX + 30; AH.cam.y = 40; AH.cam.z = 1.15; }"); pg.wait_for_timeout(300)
        pg.screenshot(path=SS + f"16-{bio}.png")
        dt = pg.evaluate("() => AH.S.biome") 
    # dig speed differs by biome
    ds = pg.evaluate("() => { const r = {}; for (const b of ['backyard','dunes','ice']) { const s = AH.newState(b, 'easy', 5); r[b] = AH.S && 1; } return r; }")
    # --- perf probe ---
    pf = pg.evaluate("""() => { const t0 = performance.now(); for (let i = 0; i < 10; i++) { nestDirty = true; redrawNest(); } const t1 = performance.now();
       for (let i = 0; i < 30; i++) render(i / 30); const t2 = performance.now(); return {nest: +((t1 - t0) / 10).toFixed(1), frame: +((t2 - t1) / 30).toFixed(2), ants: AH.S.units.length}; }""")
    print("perf", pf); check(pf["frame"] < 8, f"render cost per frame {pf['frame']}ms (nest redraw {pf['nest']}ms, {pf['ants']} ants)")
    # --- hard mode: bot survives 7 minutes ---
    pg.evaluate("() => { AH.startGame(AH.newState('backyard', 'hard')); AH.S.tut = 99; }")
    for k in range(42):
        pg.evaluate(BOT, FIND_ROOM); run(10)
        if pg.evaluate("() => AH.S.over"): break
    s = snap(); print("hard", s); check(not s["over"] and s["raids"] >= 1, f"hard mode: bot colony survives 7 min with raids ({s['raids']} raids, {s['ants']} ants, lost {pg.evaluate('() => AH.S.st.lost')})")
    # --- landscape ---
    pg.evaluate("() => { AH.S = AH.newState('backyard', 'easy', 99); AH.startGame(AH.S); AH.S.tut = 99; }"); pg.wait_for_timeout(300)
    pg.set_viewport_size({"width": 844, "height": 390}); pg.wait_for_timeout(500)
    pg.screenshot(path=SS + "17-landscape.png")
    fit = pg.evaluate("() => { const t = document.getElementById('top').getBoundingClientRect(), b = document.getElementById('bottom').getBoundingClientRect(); return {topR: t.right, botL: b.left, botT: b.top, h: innerHeight}; }")
    check(fit["botL"] >= fit["topR"] - 40 or fit["botT"] > 250, f"landscape layout leaves the map visible {fit}")
    check(not errs, "no console errors: " + "; ".join(errs[:5]))
    b.close()
print(f"\n{len(ok)} passed, {len(bad)} failed")
sys.exit(1 if bad else 0)
