"""Phone-size (390x844) nest + Surface screenshots for given biomes. Run: python tests/biomeshots.py [outdir] [biome ...]"""
import sys
from playwright.sync_api import sync_playwright
URL = "http://127.0.0.1:8811/"
OUT = sys.argv[1] if len(sys.argv) > 1 else "/workspace/ant-colony/screenshots/"
BIOS = sys.argv[2:] or ["ice"]
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append("pageerror: " + str(e)))
    pg.on("console", lambda m: m.type == "error" and errs.append("console: " + m.text))
    pg.goto(URL); pg.wait_for_selector("[data-o=new]"); pg.wait_for_timeout(800)
    pg.evaluate("() => localStorage.setItem('anthaven-tut-done', '1')")
    for bk in BIOS:
        pg.evaluate(f"() => {{ AH.startGame(AH.newState('{bk}', 'easy', 4242)); AH.S.tut = 99; }}"); pg.wait_for_timeout(300)
        pg.evaluate("() => { for (let i = 0; i < 30 * 90; i++) AH.step(1/30); AH.cam.x = AH.ENTX; AH.cam.y = 40; AH.cam.z = 1.25; document.querySelectorAll('#coach,#toasts > *').forEach(e => e.remove && e.classList.add('hidden')); }")
        pg.wait_for_timeout(900); pg.screenshot(path=f"{OUT}/{bk}-nest.png")
        pg.evaluate("() => { AH.setView('yard', true); AH.ycam.x = AH.HOME.x; AH.ycam.y = AH.HOME.y - 80; AH.ycam.z = 1; }")
        pg.wait_for_timeout(900); pg.screenshot(path=f"{OUT}/{bk}-surface.png")
        pg.evaluate("() => AH.setView('nest', true)")
    print("errors:", errs)
    b.close()
