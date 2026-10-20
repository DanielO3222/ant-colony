"""Surface-map tests for Ant Haven (phone size). Run: venv/bin/python tests/yard.py [url]"""
import sys
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8811/"
SS = "/workspace/ant-colony/screenshots/"
ok, bad = [], []
def check(c, m): (ok if c else bad).append(m); print(("PASS " if c else "FAIL ") + m, flush=True)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append("pageerror: " + str(e)))
    pg.on("console", lambda m: m.type == "error" and errs.append("console: " + m.text))
    cdp = ctx.new_cdp_session(pg)
    def touch(t, pts): cdp.send("Input.dispatchTouchEvent", {"type": t, "touchPoints": [{"x": x, "y": y, "id": i} for i, (x, y) in enumerate(pts)]})
    def tap(x, y): touch("touchStart", [(x, y)]); pg.wait_for_timeout(40); touch("touchEnd", []); pg.wait_for_timeout(80)
    def run(sec): pg.evaluate(f"() => {{ for (let i = 0; i < 30 * {sec}; i++) AH.step(1/30); }}")
    def ev(js, arg=None): return pg.evaluate(js, arg) if arg is not None else pg.evaluate(js)
    def ys(x, y): return ev("([x, y]) => AH.yw2s(x, y)", [x, y])
    pg.goto(URL); pg.wait_for_selector("[data-o=new]"); pg.wait_for_timeout(800)
    ev("() => { localStorage.clear(); localStorage.setItem('anthaven-tut-done', '1'); }")
    pg.click("[data-o=new]"); pg.wait_for_timeout(200)
    ev("() => AH.startGame(AH.newState('backyard', 'easy', 777))"); pg.wait_for_timeout(600)
    ev("() => { AH.UI.paused = true; }")
    # --- hatching still always possible
    check(ev("() => AH.canLay().ok") and ev("() => AH.layEgg('worker').ok !== false"), "hatching: queen can lay a worker egg at start")
    # --- view toggle
    check(pg.is_visible("#vt-yard") and pg.is_visible("#vt-nest"), "big Nest / Surface toggle is visible")
    pg.click("#vt-yard"); pg.wait_for_timeout(400)
    check(ev("() => AH.UI.view") == "yard" and pg.is_visible("#ytabs") and not pg.is_visible("#tabs") and pg.is_visible("#mini"), "toggle → Surface: yard tabs + minimap shown, nest tabs hidden")
    bb = pg.locator("#vt-yard").bounding_box(); check(bb["height"] >= 44 and bb["width"] >= 90, f"toggle buttons are big ({int(bb['width'])}×{int(bb['height'])})")
    yd = ev("() => ({ rivals: AH.S.yard.cols.length, food: AH.S.yard.food.length, leaves: AH.S.yard.deco.leaf.length, pud: AH.S.yard.deco.pud.length, peb: AH.S.yard.deco.peb.length, twig: AH.S.yard.deco.twig.length })"); print(yd)
    check(yd["rivals"] == 2 and yd["food"] >= 10 and yd["leaves"] > 10 and yd["pud"] > 2 and yd["peb"] > 20 and yd["twig"] > 10, "yard has 2 rival colonies (easy), food, leaves, puddles, pebbles, twigs")
    fogged = ev("() => AH.S.yard.fog.filter(v => !v).length / AH.S.yard.fog.length"); check(fogged > .8, f"fog of war covers most of the map at start ({fogged:.0%})")
    pg.screenshot(path=SS + "20-surface-start.png")
    # --- send harvesters and scavenge a tapped food
    pg.click("#yb-harv"); pg.wait_for_timeout(150)
    nh = ev("() => AH.yAnts('harvester').length"); check(nh >= 2, f"🌾 Send puts harvesters onto the Surface ({nh})")
    f = ev("() => { const H = AH.HOME; return AH.S.yard.food.filter(f => AH.yExplored(f.x, f.y)).sort((a, b) => Math.hypot(a.x - H.x, a.y - H.y) - Math.hypot(b.x - H.x, b.y - H.y))[0]; }")
    check(f is not None, "explored food near the home hill")
    ev("([x, y]) => { AH.ycam.x = x; AH.ycam.y = y; AH.ycam.z = 1.1; }", [(f["x"] + 1000) / 2, (f["y"] + 1250) / 2]); pg.wait_for_timeout(100)
    sp = ys(f["x"], f["y"]); tap(sp["x"], sp["y"]); pg.wait_for_timeout(100)
    tgt = ev(f"() => AH.yAnts('harvester').filter(u => u.o && u.o.k === 'gather' && u.o.id === {f['id']}).length")
    check(tgt >= 2, f"tapping food sends Surface harvesters to scavenge it ({tgt})")
    g0 = ev("() => AH.S.st.gathered"); run(40); g1 = ev("() => AH.S.st.gathered")
    check(g1 > g0 + 4, f"harvesters carry Surface food home (+{g1 - g0:.0f})")
    # --- select: tap a group, box-select
    u = ev("() => { const u = AH.yAnts('harvester')[0]; return { x: u.x, y: u.y }; }")
    ev("([x, y]) => { AH.ycam.x = x; AH.ycam.y = y; }", [u["x"], u["y"]]); ev("() => AH.step(0)"); pg.wait_for_timeout(80)
    run(0); sp = ys(u["x"], u["y"])
    ev("() => { AH.UI.ysel = []; }"); tap(sp["x"], sp["y"]); check(ev("() => AH.UI.ysel.length") >= 1, "tapping an ant selects it (and its group)")
    ev("() => { AH.UI.ysel = []; }")
    touch("touchStart", [(sp["x"] - 60, sp["y"] - 60)]); pg.wait_for_timeout(ev("() => AH.HOLD_MS") + 120)
    for i in range(1, 9): touch("touchMove", [(sp["x"] - 60 + 15 * i, sp["y"] - 60 + 15 * i)]); pg.wait_for_timeout(16)
    pg.screenshot(path=SS + "21-surface-boxselect.png"); touch("touchEnd", []); pg.wait_for_timeout(80)
    check(ev("() => AH.UI.ysel.length") >= 1, f"hold + drag box-selects Surface ants ({ev('() => AH.UI.ysel.length')})")
    # rally point
    pg.click("#yb-rally"); check(ev("() => AH.UI.ymode") == "rally" and pg.is_visible("#mode"), "🚩 Rally enters rally mode with an explanation")
    tap(200, 450); check(ev("() => !!AH.S.yard.rally"), "tap sets the rally point")
    ev("() => { AH.UI.ysel = []; AH.updateMode && 0; }")
    # --- rivals forage and fight
    run(60)
    rv = ev("() => AH.S.yard.cols.map(c => ({ food: c.food, ants: AH.S.yard.foes.filter(f => f.c === c.i).length, carry: AH.S.yard.foes.filter(f => f.c === c.i && f.carry).length }))"); print(rv)
    check(all(r["ants"] >= 3 for r in rv), "each rival colony has its own ants")
    check(any(r["food"] > 20 or r["carry"] > 0 for r in rv), "rival foragers gather food for their hill")
    # --- capture a rival hill with soldiers
    pop0 = ev("() => AH.popCap()")
    ev("""() => { const S = AH.S; for (let i = 0; i < 12; i++) AH.addU('soldier', AH.ENTX, -4); const got = AH.sendOut('soldier', 12); const c = S.yard.cols[0];
      for (const u of got) { u.x = c.x + 160 + Math.random() * 30; u.y = c.y + 120 + Math.random() * 30; } AH.yOrder(got.map(u => u.id), { k: 'hill', id: 0 }); S.res.food = 200; }""")
    ev("() => { const c = AH.S.yard.cols[0]; AH.ycam.x = c.x + 60; AH.ycam.y = c.y + 60; AH.ycam.z = 1.2; }")
    run(8); pg.wait_for_timeout(100); pg.screenshot(path=SS + "22-surface-battle.png")
    cap = ev("""() => { const S = AH.S, c = S.yard.cols[0]; for (let i = 0; i < 30 * 150 && c.own !== 'me'; i++) { AH.step(1/30); if (!AH.yAnts('soldier').length) break; } return { own: c.own, hp: c.hp, sold: AH.yAnts('soldier').length, out: S.yard.out }; }"""); print(cap)
    check(cap["own"] == "me", "soldiers beat the defenders and capture the rival hill")
    check(ev("() => AH.popCap()") == pop0 + 6, "captured outpost adds +6 ant space")
    fa = ev("() => { const S = AH.S; S.res.food = 20; const g = S.st.gathered; for (let i = 0; i < 30 * 10.5; i++) AH.step(1/30); return S.st.gathered - g; }")
    check(fa >= 2, f"outpost adds food income (+{fa:.0f} in 10s incl. foraging)")
    check("goals" and ev("() => !!AH.S.goals.outpost"), "goal 'Capture a rival ant hill' completes")
    pg.wait_for_timeout(100); pg.screenshot(path=SS + "23-surface-outpost.png")
    # --- hazards: foot
    res = ev("""() => { const S = AH.S, H = AH.HOME; S.yard.foes = S.yard.foes.filter(f => f.c >= 0); S.yard.hz = [];
      const free = (x, y) => !S.yard.deco.pud.some(p => Math.hypot(p.x - x, p.y - y) < p.r + 30) && !S.yard.deco.peb.some(p => Math.hypot(p.x - x, p.y - y) < p.r + 20) && !AH.inShade({x, y});
      let fx = 600, fy = 1000; for (let k = 0; k < 200 && !free(fx, fy); k++) { fx = 300 + Math.random() * 1400; fy = 300 + Math.random() * 1400; }
      const v = []; for (let i = 0; i < 6; i++) { const u = AH.addU('soldier', 0, 0); u.yd = 1; u.x = fx + (i % 3) * 6; u.y = fy + (i >> 1) * 6; u.o = { k: 'move', x: u.x, y: u.y }; v.push(u.id); }
      const z = AH.spawnHazard('foot', fx + 6, fy + 3); z.notice = 0; return { ids: v, r: z.r, grow: z.grow, x: fx, y: fy }; }""")
    ev("([x, y]) => { AH.ycam.x = x; AH.ycam.y = y; AH.ycam.z = 1.6; }", [res["x"], res["y"]]); run(1.2); pg.wait_for_timeout(100); pg.screenshot(path=SS + "24-foot-shadow.png")
    run(1.3)
    dead = ev("(ids) => ids.filter(id => !AH.S.units.some(u => u.id === id)).length", res["ids"])
    check(dead >= 5, f"giant foot: 2s shadow telegraph, then stomp kills unaware ants under it ({dead}/6)")
    al = ev("""() => { const S = AH.S, v = []; for (let i = 0; i < 6; i++) { const u = AH.addU('soldier', 0, 0); u.yd = 1; u.x = 1000 + (i % 3) * 6; u.y = 1500 + (i >> 1) * 6; v.push(u); }
      const z = AH.spawnHazard('foot', 1006, 1503); z.notice = 1; for (let i = 0; i < 30 * 2.6; i++) AH.step(1/30); return v.filter(u => S.units.includes(u)).length; }""")
    check(al == 6, f"ants that notice the shadow run out in time ({al}/6)")
    check(ev("() => AH.S.yard.hz.some(z => z.k === 'foot' && z.done)"), "stomp leaves a footprint decal")
    # foot: ant moved away by the player survives
    sv = ev("""() => { const S = AH.S; const u = AH.addU('harvester', 0, 0); u.yd = 1; u.x = 700; u.y = 900; u.o = null; const z = AH.spawnHazard('foot', 700, 900);
      AH.yOrder([u.id], { k: 'move', x: 820, y: 900 }); for (let i = 0; i < 30 * 2.6; i++) AH.step(1/30); return S.units.some(x => x.id === u.id); }""")
    check(sv, "an ant ordered out of the shadow survives the stomp (fair telegraph)")
    # --- magnifying glass
    gl = ev("""() => { const S = AH.S; S.yard.hz = []; const L = S.yard.deco.leaf[0]; const v = [];
      for (let i = 0; i < 4; i++) { const u = AH.addU('harvester', 0, 0); u.yd = 1; u.x = 1300 + i * 4; u.y = 800; u.o = { k: 'move', x: u.x, y: u.y }; v.push(u); }
      const sh = AH.addU('harvester', 0, 0); sh.yd = 1; sh.x = L.x; sh.y = L.y; sh.o = { k: 'move', x: L.x, y: L.y };
      const z = AH.spawnHazard('glass', 1306, 800); z.t = 0.01; const z2 = AH.spawnHazard('glass', L.x, L.y); z2.t = 0.01;
      const h0 = v.map(u => u.hp); for (let i = 0; i < 12; i++) AH.step(1/30);
      return { hurt: v.filter((u, i) => u.hp < h0[i]).length, shadeHp: sh.hp, shadeMax: sh.max, inShade: AH.inShade(sh), gx: z.x, gy: z.y }; }"""); print(gl)
    check(gl["hurt"] >= 3, "magnifying glass burns ants under the light spot")
    check(gl["inShade"] and gl["shadeHp"] == gl["shadeMax"], "an ant in leaf shade is safe from the glass")
    ev("([x, y]) => { AH.ycam.x = x; AH.ycam.y = y; AH.ycam.z = 1.5; }", [gl["gx"], gl["gy"]]); run(.5); pg.wait_for_timeout(100); pg.screenshot(path=SS + "25-magnifying-glass.png")
    chase = ev("""() => { const S = AH.S; S.yard.hz = []; const v = []; for (let i = 0; i < 5; i++) { const u = AH.addU('harvester', 0, 0); u.yd = 1; u.x = 1500 + i * 5; u.y = 1500; u.o = { k: 'move', x: u.x, y: u.y }; v.push(u); }
      const z = AH.spawnHazard('glass', 1350, 1500); const d0 = Math.hypot(z.x - 1510, z.y - 1500); for (let i = 0; i < 30 * 4; i++) AH.step(1/30); return { d0, d1: Math.hypot(z.x - 1510, z.y - 1500) }; }""")
    check(chase["d1"] < chase["d0"] - 40, f"the glass drifts toward ant clusters ({chase['d0']:.0f}→{chase['d1']:.0f}px)")
    # --- big bugs
    bug = ev("""() => { const S = AH.S; S.yard.hz = []; const h = AH.addU('harvester', 0, 0); h.yd = 1; h.x = 400; h.y = 1500; h.o = { k: 'move', x: 400, y: 1500 };
      const f = AH.spawnHazard('spider', 430, 1500); const h0 = h.hp; for (let i = 0; i < 30 * 1.5; i++) AH.step(1/30); return { id: f.id, hurt: h.hp < h0 || !S.units.includes(h), hp: f.hp }; }""")
    check(bug["hurt"], "a wolf spider spawns and attacks ants")
    kill = ev(f"""() => {{ const S = AH.S; const got = []; for (let i = 0; i < 6; i++) {{ const u = AH.addU('soldier', 0, 0); u.yd = 1; u.x = 380 + i * 6; u.y = 1460; got.push(u.id); }}
      AH.yOrder(got, {{ k: 'attack', id: {bug['id']} }}); const n0 = S.yard.food.length; let t = 0; for (; t < 30 * 40 && S.yard.foes.some(f => f.id === {bug['id']}); t++) AH.step(1/30);
      const meat = S.yard.food.find(f => f.k === 'meat'); return {{ dead: !S.yard.foes.some(f => f.id === {bug['id']}), meat: meat ? meat.amt : 0, secs: t / 30, lost: got.filter(id => !S.units.some(u => u.id === id)).length, bugs: S.st.bugs }}; }}"""); print(kill)
    check(kill["dead"] and kill["meat"] >= 60, f"a group of 6 soldiers kills it in {kill['secs']:.0f}s and it drops {kill['meat']} food")
    check(kill["lost"] <= 2, f"easy balance: the soldier group loses ≤2 ants ({kill['lost']})")
    for k in ["beetle", "centipede", "ladybug"]:
        r = ev(f"() => {{ const f = AH.spawnHazard('{k}', 900, 600); for (let i = 0; i < 30; i++) AH.step(1/30); return !!f && f.hp > 0; }}")
        check(r, f"{k} spawns and roams")
    ev("() => { const S = AH.S; AH.ycam.x = 900; AH.ycam.y = 620; AH.ycam.z = 1.4; for (const f of S.yard.foes) if (f.c < 0) { f.x = 860 + Math.random() * 90; f.y = 580 + Math.random() * 90; } for (let i = 0; i < 5; i++) { const u = AH.addU('soldier', 0, 0); u.yd = 1; u.x = 880 + i * 14; u.y = 700; u.o = { k: 'move', x: u.x, y: u.y }; } }")
    run(.6); pg.wait_for_timeout(500); pg.screenshot(path=SS + "26-big-bugs.png")
    # --- rival raid reaches the nest
    rd = ev("""() => { const S = AH.S; for (const u of AH.yAnts()) u.hp = 0; AH.step(1/30); const c = AH.startRaid(); const n = S.yard.foes.filter(f => f.raid).length; let t = 0;
      for (; t < 30 * 90 && !AH.count('raider'); t++) AH.step(1/30); return { col: c && c.i, n, raiders: AH.count('raider'), active: S.raid.active, secs: t / 30 }; }"""); print(rd)
    check(rd["n"] >= 3 and rd["raiders"] >= 1 and rd["active"], f"rival raid marches across the yard ({rd['secs']:.0f}s) and breaks into the nest")
    # --- hazard setting
    ev("() => { AH.UI.paused = false; }"); pg.click("#btn-menu"); pg.wait_for_timeout(100)
    check("Surface hazards" in pg.inner_text("#ov-card"), "pause menu shows the Surface hazards setting")
    pg.click("[data-o=hz]"); pg.wait_for_timeout(80); l1 = ev("() => AH.S.yard.hzLevel")
    pg.click("[data-o=hz]"); pg.wait_for_timeout(80); l2 = ev("() => AH.S.yard.hzLevel")
    check(l1 == "hard" and l2 == "off" and not ev("() => AH.S.yard.foes.some(f => f.c < 0)"), "setting cycles Easy → Hard → Off (Off clears bugs)")
    sched = ev("() => { const n = AH.S.yard.nx; return [n.foot, n.glass, n.bug].every(v => v > 1e9); }"); check(sched, "Off stops foot / glass / bug spawns")
    pg.click("[data-o=hz]"); pg.click("[data-o=resume]"); pg.wait_for_timeout(80); check(ev("() => AH.S.yard.hzLevel") == "easy", "back to Easy")
    hard = ev("() => { const e = AH.YHAZ.easy, h = AH.YHAZ.hard; return h.footR > e.footR && h.foot[0] < e.foot[0] && h.glassDps > e.glassDps && h.bugMax > e.bugMax && h.notice < e.notice; }")
    check(hard, "Hard hazards are bigger, more frequent and deadlier than Easy")
    hs = ev("() => { const s = AH.newState('backyard', 'hard', 5); return { r: s.yard.cols.length, lvl: s.yard.hzLevel }; }"); check(hs["r"] == 3 and hs["lvl"] == "hard", "Hard mode: 3 rival colonies, hard hazards")
    # --- natural spawning happens on its own (easy)
    nat = ev("""() => { const s = AH.newState('backyard', 'easy', 31); AH.S = s; s.tut = 99; AH.step(1/30); AH.sendOut('harvester', 2); const seen = new Set(); let raids = 0, died = 0;
      for (let i = 0; i < 30 * 600; i++) { AH.step(1/30); if (i === 30 * 300) for (let j = 0; j < 3; j++) AH.addU('soldier', AH.ENTX, -4); for (const z of s.yard.hz) seen.add(z.k); for (const f of s.yard.foes) if (f.c < 0) seen.add('bug'); if (s.yard.foes.some(f => f.raid)) raids = 1; if (AH.yAnts().length < 2) { if (AH.count('harvester') < 4) { AH.addU('harvester', AH.ENTX, -4); died++; } AH.sendOut('harvester', 2); } if (s.over) break; }
      return { seen: [...seen], raids, over: s.over, ants: AH.adults(), refills: died, lost: s.st.lost }; }"""); print(nat)
    check(all(k in nat["seen"] for k in ["foot", "glass", "bug"]) and nat["raids"] and not nat["over"], "over 10 min on Easy: foot, glass, bug and a rival raid all happen on their own, colony survives")
    # --- save / restore keeps the yard
    rs = ev("""() => { const S = AH.S; const s = AH.serialize(); const o = JSON.parse(s); AH.restore(o); return { cols: AH.S.yard.cols.length, yd: AH.yAnts().length, food: AH.S.yard.food.length, size: s.length }; }"""); print(rs)
    check(rs["cols"] == 2 and rs["food"] > 0, f"save/restore keeps the Surface ({rs['size'] // 1024} KB save)")
    old = ev("() => { const o = JSON.parse(AH.serialize()); delete o.yard; return AH.restore(o) && !!AH.S.yard; }"); check(old, "old v1.0 saves load and get a new Surface map")
    # --- perf + back to nest
    ev("() => { AH.startGame(AH.newState('backyard', 'easy', 777)); AH.setView('yard'); const S = AH.S; for (let i = 0; i < 30; i++) AH.addU('harvester', AH.ENTX, -4); AH.sendOut('harvester', 30); AH.step(1/30); }")
    run(20); pg.wait_for_timeout(300)
    perf = ev("() => new Promise(r => { let n = 0, t0 = performance.now(), worst = 0, last = t0; function f(t) { worst = Math.max(worst, t - last); last = t; if (++n < 90) requestAnimationFrame(f); else r({ avg: (t - t0) / n, worst }); } requestAnimationFrame(f); })")
    print(perf); check(perf["avg"] < 20, f"Surface view frame time {perf['avg']:.1f} ms avg (headless)")
    rt = ev("() => { AH.ycam.z = .6; const t0 = performance.now(); for (let i = 0; i < 30; i++) AH.renderYard(performance.now() / 1000, 1 / 60); return (performance.now() - t0) / 30; }"); check(rt < 8, f"renderYard cost {rt:.2f} ms")
    pg.screenshot(path=SS + "27-surface-busy.png")
    pg.click("#vt-nest"); pg.wait_for_timeout(200); check(ev("() => AH.UI.view") == "nest" and pg.is_visible("#tabs") and not pg.is_visible("#mini"), "toggle back → Nest view")
    nest_ok = ev("() => AH.units('harvester').filter(u => u.yd).length") == 30; check(nest_ok, "Surface ants stay on the Surface while you view the nest")
    # landscape
    pg.set_viewport_size({"width": 844, "height": 390}); pg.wait_for_timeout(300); pg.click("#vt-yard"); pg.wait_for_timeout(300); pg.screenshot(path=SS + "28-surface-landscape.png")
    check(pg.is_visible("#ytabs") and pg.is_visible("#vtog"), "landscape Surface view works")
    check(not errs, "no JS errors: " + "; ".join(errs[:3]))
    b.close()
print(f"\n{len(ok)} passed, {len(bad)} failed"); sys.exit(1 if bad else 0)
