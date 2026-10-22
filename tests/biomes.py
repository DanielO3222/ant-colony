"""Every biome starts and plays a minute (nest + Surface) without errors; saves round-trip; an old v1.3.1-style save still loads.
Run: python tests/biomes.py [url]"""
import sys
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8811/"
ok, bad = [], []
def check(c, m): (ok if c else bad).append(m); print(("PASS " if c else "FAIL ") + m, flush=True)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append("pageerror: " + str(e)))
    pg.on("console", lambda m: m.type == "error" and errs.append("console: " + m.text))
    pg.goto(URL); pg.wait_for_selector("[data-o=new]"); pg.wait_for_timeout(600)
    pg.evaluate("() => localStorage.setItem('anthaven-tut-done', '1')")
    bios = pg.evaluate("() => Object.keys(AH.S ? {} : {}).length || null") or None
    keys = pg.evaluate("() => [...document.querySelectorAll('.bio')].map(e => e.dataset.bio)")
    check(len(keys) == 10, f"10 biome cards: {keys}")
    for k in keys:
        n = len(errs)
        pg.click(f"[data-bio={k}]"); pg.wait_for_timeout(120)
        pg.click("[data-o=new]"); pg.wait_for_timeout(400)
        r = pg.evaluate("""(k) => { const S = AH.S; if (S.biome !== k) return 'wrong biome ' + S.biome; S.tut = 99; S.haz.next = 20; S.rain.next = 35;
          AH.sendOut('harvester', 2);
          for (let i = 0; i < 30 * 60; i++) AH.step(1/30);
          return { t: Math.round(S.t), ants: AH.adults(), food: Math.round(S.res.food), over: S.over, haz: S.haz.n, rain: S.rain.n, yfood: S.yard.food.length }; }""", k)
        pg.wait_for_timeout(250); pg.evaluate("() => AH.setView('yard', true)"); pg.wait_for_timeout(350); pg.evaluate("() => AH.setView('nest', true)"); pg.wait_for_timeout(150)
        check(isinstance(r, dict) and r["t"] >= 59 and not r["over"] and r["ants"] >= 4 and len(errs) == n, f"{k}: 60s sim + both views OK {r} {errs[n:]}")
        rt = pg.evaluate("() => { const s = AH.serialize(), o = JSON.parse(s); return AH.restore(o) && AH.S.biome === o.biome; }")
        check(rt, f"{k}: save round-trips")
        pg.evaluate("() => { AH.clearSave(); AH.showTitle(); }"); pg.wait_for_timeout(200)
    # old v1.3.1 save (no new fields, ver tag old) must still load
    old = pg.evaluate("""() => { const S0 = AH.newState('ice', 'easy', 5); AH.S = S0; const o = JSON.parse(AH.serialize()); o.ver = 'ah-v1.3.1'; return JSON.stringify(o); }""")
    pg.evaluate("(s) => localStorage.setItem('anthaven-save-v1', s)", old)
    pg.reload(); pg.wait_for_selector("[data-o=continue]", timeout=5000); pg.click("[data-o=continue]"); pg.wait_for_timeout(500)
    st = pg.evaluate("() => { for (let i = 0; i < 30 * 10; i++) AH.step(1/30); return AH.S && AH.S.biome; }")
    check(st == "ice" and not errs, f"old v1.3.1 save continues fine ({st})")
    print("errors:", errs); print(f"\n{len(ok)} passed, {len(bad)} failed"); b.close()
    sys.exit(1 if bad else 0)
