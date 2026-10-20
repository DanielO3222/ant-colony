"""Automated playthroughs (~18 min game time): active, passive (kid does little), nest-only. Prints a log of colony state.
Run: venv/bin/python tests/playthrough.py [url] [minutes]"""
import sys, json, re
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8811/"
MIN = float(sys.argv[2]) if len(sys.argv) > 2 else 18
src = open('/workspace/ant-colony/tests/smoke.py').read()
BOT = re.search(r'BOT = """(.*?)"""', src, re.S).group(1); FIND = re.search(r'FIND_ROOM = """(.*?)"""', src, re.S).group(1)
YARDBOT = """(style) => { const A = AH, S = A.S, Y = S.yard, log = [];
  if (style === 'nest') return log;
  const out = A.yAnts('harvester').length, all = A.count('harvester'); if (out < Math.floor(all / 2)) { const g = A.sendOut('harvester', 2); if (g.length) log.push('send-h' + g.length); }
  if (style === 'passive') return log;
  const sol = A.units('soldier').filter(u => !u.yd && !u.train), ys = A.yAnts('soldier');
  const bug = Y.foes.find(f => f.c < 0 && A.yExplored(f.x, f.y)); const raid = Y.foes.filter(f => f.raid);
  if ((bug || raid.length) && sol.length + ys.length >= 4) { if (sol.length > 1) A.sendOut('soldier', sol.length - 1); const t = raid[0] || bug; A.yOrder(A.yAnts('soldier').map(u => u.id), { k: 'attack', id: t.id }); log.push('atk'); }
  else if (sol.length + ys.length >= 9) { const c = Y.cols.find(c => c.own === 'rival'); if (c) { if (sol.length > 2) A.sendOut('soldier', sol.length - 2); A.yOrder(A.yAnts('soldier').map(u => u.id), { k: 'hill', id: c.i }); log.push('storm' + c.i); } }
  return log; }"""
METRICS = """() => { const A = AH, S = A.S, Y = S.yard; const yh = A.yAnts();
  const P = (window.__pos = window.__pos || {}); let stuck = 0; for (const u of yh) { const p = P[u.id]; if (!p || Math.hypot(p[0] - u.x, p[1] - u.y) > 3) P[u.id] = [u.x, u.y, S.t]; else if (u.o && !(u.hid > 0) && S.t - p[2] > 25) stuck++; }
  const idleW = A.units('worker').filter(u => u.job < 0).length, plan = S.grid.filter(v => v === 2).length;
  return { t: Math.round(S.t), food: Math.round(S.res.food), cap: A.foodCap(), net: Math.round(A.netPerMin()), ants: A.adults(), pop: A.popCap(), w: A.count('worker'), h: A.count('harvester'), s: A.count('soldier'),
    yard: yh.length, stuck, idleW, plan, eggs: S.eggs.length, lay: A.canLay().why || 'ok', rivals: Y.cols.map(c => c.own === 'me' ? 'MINE' : Math.round(c.hp) + '/' + Y.foes.filter(f => f.c === c.i).length).join(' '),
    bugs: Y.foes.filter(f => f.c < 0).length, lost: S.st.lost, kills: S.st.kills, raids: S.st.raids, goals: Object.keys(S.goals).length, over: S.over, why: S.why, hill: S.hill.dead, q: Math.round((A.units('queen')[0] || {}).hp || 0) }; }"""
def play(pg, diff, style, minutes, seed):
    pg.evaluate(f"() => {{ AH.startGame(AH.newState('backyard', '{diff}', {seed})); AH.S.tut = 99; AH.UI.paused = true; window.__pos = {{}}; }}")
    rows = []
    for k in range(int(minutes * 6)):
        if style in ('active', 'nest'): pg.evaluate(f"([F]) => {{ const bot = eval('(' + {json.dumps(BOT)} + ')'); return bot(F); }}", [FIND])
        else: pg.evaluate("() => { const S = AH.S; if (S.res.food < 15 && AH.count('worker') > 2) AH.assign('harvester', 1); }")
        pg.evaluate(f"(s) => {{ const f = eval('(' + {json.dumps(YARDBOT)} + ')'); return f(s); }}", style)
        pg.evaluate("() => { for (let i = 0; i < 300; i++) AH.step(1/30); }")
        m = pg.evaluate(METRICS); rows.append(m)
        if m["over"]: break
    return rows
if __name__ == "__main__":
  with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    pg = b.new_page(viewport={"width": 390, "height": 844}); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(URL); pg.wait_for_selector("[data-o=new]"); pg.evaluate("() => localStorage.setItem('anthaven-tut-done','1')")
    for diff in ("easy", "hard"):
        for style in ("active", "passive", "nest"):
            for seed in (11, 22):
                rows = play(pg, diff, style, MIN, seed); last = rows[-1]
                print(f"\n=== {diff} {style} seed {seed}: end t={last['t']} over={last['over']} {last['why']}", flush=True)
                for r in rows[::12] + [last]: print(json.dumps(r), flush=True)
    print("errors:", errs[:3]); b.close()
