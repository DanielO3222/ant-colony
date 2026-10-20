"""Balance / kid-friendliness regression tests. Run: venv/bin/python tests/balance.py [url]"""
import sys
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8811/"
ok, bad = [], []
def check(c, m): (ok if c else bad).append(m); print(("PASS " if c else "FAIL ") + m, flush=True)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    pg = b.new_page(viewport={"width": 390, "height": 844}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    def ev(js, arg=None): return pg.evaluate(js, arg) if arg is not None else pg.evaluate(js)
    def run(sec): ev(f"() => {{ for (let i = 0; i < 30 * {sec}; i++) {{ AH.step(1/30); if (AH.S.over) break; }} }}")
    def new(diff, seed): ev(f"() => {{ AH.startGame(AH.newState('backyard', '{diff}', {seed})); AH.S.tut = 99; AH.UI.paused = true; }}")
    pg.goto(URL); pg.wait_for_selector("[data-o=new]"); pg.wait_for_timeout(600)
    ev("() => { localStorage.clear(); localStorage.setItem('anthaven-tut-done', '1'); }")
    # tutorial teaches the Surface
    t = ev("() => AH.TUT.map(s => s.hi || '')"); check(len(t) <= 8 and 'vt-yard' in t, f"tutorial is short ({len(t)} steps) and includes the Surface step")
    # stale toasts cleared on new game
    ev("() => { const d = document.createElement('div'); d.className = 'toast'; d.textContent = 'old'; document.getElementById('toasts').appendChild(d); }")
    new('easy', 5); check(ev("() => document.getElementById('toasts').children.length") == 0, "new game clears old toasts")
    # starvation is slow and gatherers keep working
    new('easy', 5); ev("() => { AH.sendOut('harvester', 2); }"); run(2)
    ev("() => { AH.S.res.food = 0; }")
    n0 = ev("() => AH.adults()"); yh0 = ev("() => AH.S.units.filter(u => u.yd).map(u => u.hp).join()")
    ev("() => { for (let i = 0; i < 30 * 60; i++) { AH.S.res.food = 0; AH.step(1/30); } }")
    check(ev("() => AH.adults()") >= n0 - 1 and not ev("() => AH.S.over"), f"easy: 60s with no food doesn't wipe the colony ({n0}→{ev('() => AH.adults()')})")
    check(ev("() => AH.S.units.filter(u => u.yd && u.hp < u.max && !u.lastHit).length") == 0, "starving doesn't hurt ants out on the Surface")
    # idle workers help gather
    new('easy', 6); ev("() => { for (let i = 0; i < 3; i++) AH.addU('worker', AH.ENTX * 1 + i, 3); AH.S.res.food = 10; AH.S.digp.fill(0); }")
    h = ev("() => { let m = 0; for (let i = 0; i < 30 * 40; i++) { AH.S.digp.fill(0); AH.step(1/30); m = Math.max(m, AH.units('worker').filter(u => u.help).length); } return m; }")
    check(h >= 1, f"idle workers switch to helping gather food (max {h} helping)")
    h2 = ev("() => { for (let i = 0; i < 30 * 15; i++) { AH.S.res.food = AH.foodCap(); AH.step(1/30); } return AH.units('worker').filter(u => u.help && !u.carry).length; }")
    check(h2 == 0, f"helpers go back to nest work when storage is full ({h2} still helping)")
    # easy raid: queen safe, workers survive, no soldiers needed
    new('easy', 7); ev("() => { for (let i = 0; i < 3; i++) AH.addU('worker', AH.ENTX + i, 3); AH.S.raid.next = AH.S.t + 1; AH.S.raid.warned = true; }"); run(150)
    r = ev("() => { const q = AH.units('queen')[0]; return { q: q && q.hp / q.max, w: AH.units('worker').length, over: AH.S.over, raids: AH.S.st.raids }; }")
    check(not r["over"] and r["q"] and r["q"] > .9 and r["w"] >= 3, f"easy raid with no soldiers: queen safe ({r['q']}), workers alive ({r['w']})")
    # hard raid still bites
    new('hard', 7); ev("() => { AH.S.raid.next = AH.S.t + 1; AH.S.raid.warned = true; }"); run(60)
    check(ev("() => AH.S.st.lost") > 0 or ev("() => AH.S.raid.lost") > 0, "hard raid still causes losses (challenge kept)")
    # raids don't stack
    new('easy', 8); run(5); ev("() => { AH.startRaid(); AH.S.raid.next = AH.S.t + 1; AH.S.raid.warned = true; }"); run(8)
    check(not ev("() => AH.S.raid.active"), "nest raid waits while a Surface raid is marching")
    # trained soldiers can leave for the Surface (train timer used to end slightly negative)
    new('easy', 4); n = ev("() => { const u = AH.addU('soldier', AH.ENTX, 3); u.train = 1; for (let i = 0; i < 60; i++) AH.step(1/30); return [u.train, AH.sendOut('soldier', 9).length]; }")
    check(n[0] == 0 and n[1] >= 1, f"a freshly trained soldier can be sent to the Surface {n}")
    # save/load mid-game
    new('easy', 9); run(300)
    a = ev("() => ({ n: AH.S.units.length, f: Math.round(AH.S.res.food), t: Math.round(AH.S.t) })")
    ev("() => { AH.restore(JSON.parse(AH.serialize())); }")
    c = ev("() => ({ n: AH.S.units.length, f: Math.round(AH.S.res.food), t: Math.round(AH.S.t) })")
    run(30); check(a == c and not errs, f"save/load mid-game round-trips and keeps running {a}")
    for vw, vh in ((390, 844), (820, 1180), (1180, 820)):
        pg.set_viewport_size({"width": vw, "height": vh}); new('easy', 3); ev("() => { AH.S.tut = 5; AH.UI.paused = true; }"); pg.wait_for_timeout(300)
        for view in ("nest", "yard"):
            ev(f"() => AH.setView('{view}')"); pg.wait_for_timeout(400)
            o = ev("""() => { const a = document.getElementById('coach').getBoundingClientRect(), r = [document.getElementById('vtog'), document.getElementById('mini')].filter(e => e && e.offsetHeight && getComputedStyle(e).display !== 'none').map(e => e.getBoundingClientRect());
              return !document.getElementById('coach').classList.contains('hidden') && a.height > 0 && r.every(b => b.bottom <= a.top || b.top >= a.bottom || b.right <= a.left || b.left >= a.right); }""")
            check(o, f"{vw}x{vh} {view}: tutorial card doesn't cover the Nest/Surface toggle or minimap")
    pg.set_viewport_size({"width": 390, "height": 844})
    check(not errs, "no JS errors" + (": " + "; ".join(errs[:3]) if errs else ""))
    b.close()
print(f"\n{len(ok)} passed, {len(bad)} failed"); sys.exit(1 if bad else 0)
