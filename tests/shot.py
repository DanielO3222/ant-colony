import sys, time
from playwright.sync_api import sync_playwright
URL = "http://127.0.0.1:8811/"
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    ctx = b.new_context(viewport={"width":390,"height":844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append("pageerror: " + str(e)))
    pg.on("console", lambda m: m.type == "error" and errs.append("console: " + m.text))
    pg.goto(URL); pg.wait_for_timeout(1500); pg.screenshot(path="/tmp/s1.png")
    pg.click("[data-o=new]"); pg.wait_for_timeout(1500); pg.screenshot(path="/tmp/s2.png")
    pg.evaluate("() => { for (let i=0;i<30*60;i++) AH.step(1/30); AH.cam.y = 120; }"); pg.wait_for_timeout(500); pg.screenshot(path="/tmp/s3.png")
    print(errs)
    b.close()
