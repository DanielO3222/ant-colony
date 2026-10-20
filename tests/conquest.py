"""Conquest playthrough: bot builds soldiers, storms rival hills one by one. Run: venv/bin/python tests/conquest.py [url] [minutes]"""
import sys, json
sys.argv += [] ; URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8811/"
MIN = float(sys.argv[2]) if len(sys.argv) > 2 else 25
sys.argv = sys.argv[:1] + [URL]
MIN0 = MIN
exec(open('/workspace/ant-colony/tests/playthrough.py').read().split('if __name__')[0])
CONQ = """() => { const A = AH, S = A.S, Y = S.yard, home = A.HOME;
  const sol = A.units('soldier').filter(u => !u.yd && !u.train), ys = A.yAnts('soldier'), riv = Y.cols.filter(c => c.own === 'rival');
  if (!riv.length) return 'done';
  if (S.res.food > 50 && A.count('soldier') < 12 && A.count('worker') > 6) A.assign('soldier', 2);
  const busy = ys.filter(u => u.o && u.o.k === 'hill');
  if (sol.length + ys.length >= 6 && !busy.length) { A.sendOut('soldier', 99); const c = riv.sort((a, b) => Math.hypot(a.x - home.x, a.y - home.y) - Math.hypot(b.x - home.x, b.y - home.y))[0];
    A.yOrder(A.yAnts('soldier').map(u => u.id), { k: 'hill', id: c.i }); return 'storm' + c.i; }
  if (busy.length) { A.sendOut('soldier', 99); A.yOrder(A.yAnts('soldier').filter(u => !u.o || u.o.k !== 'hill').map(u => u.id), busy[0].o); }
  return ''; }"""
MIN = MIN0
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    pg = b.new_page(viewport={"width": 390, "height": 844}); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(URL); pg.wait_for_selector("[data-o=new]"); pg.evaluate("() => localStorage.setItem('anthaven-tut-done','1')")
    for diff in ("easy", "hard"):
        pg.evaluate(f"() => {{ AH.startGame(AH.newState('backyard', '{diff}', 11)); AH.S.tut = 99; AH.UI.paused = true; window.__pos = {{}}; }}")
        caps = []; prev = 0
        for k in range(int(MIN * 6)):
            pg.evaluate(f"([F]) => {{ const bot = eval('(' + {json.dumps(BOT)} + ')'); return bot(F); }}", [FIND])
            pg.evaluate(f"(s) => {{ const f = eval('(' + {json.dumps(YARDBOT)} + ')'); return f(s); }}", 'passive')
            act = pg.evaluate(CONQ)
            pg.evaluate("() => { for (let i = 0; i < 300; i++) { AH.step(1/30); if (AH.S.over) break; } }")
            m = pg.evaluate(METRICS); c = pg.evaluate("() => AH.S.st.captured || 0")
            if c > prev: caps.append(m['t']); prev = c
            if k % 12 == 0 or act.startswith('storm'): print(diff, act, json.dumps({x: m[x] for x in ('t', 'food', 'ants', 'pop', 's', 'yard', 'stuck', 'rivals', 'lost', 'q')}), flush=True)
            if m['over'] or act == 'done': break
        print(f"=== {diff}: captures {prev} at {caps}, won={pg.evaluate('() => AH.S.won')}, over={m['over']} {m['why']}, pop {m['pop']}", flush=True)
        if diff == 'easy':
            s1 = pg.evaluate("() => { const o = JSON.parse(AH.serialize()); AH.restore(o); return [AH.popCap(), AH.S.yard.cols.map(c => c.own).join()]; }"); print("save/load:", s1)
    print("errors:", errs[:3]); b.close()
