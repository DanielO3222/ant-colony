"""iPad layout tests: 4 iPad sizes x portrait/landscape, DPR 2, touch, Mac UA (iPadOS Safari). Run: venv/bin/python tests/ipad.py [url]"""
import sys
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8811/"
SS = "/workspace/ant-colony/screenshots/"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
ok, bad = [], []
def check(c, m): (ok if c else bad).append(m); print(("PASS " if c else "FAIL ") + m, flush=True)
LAYOUT = """() => { const r = e => { const b = document.getElementById(e).getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height, r: b.right, b: b.bottom }; };
  const vis = id => { const e = document.getElementById(id); return e && e.offsetParent !== null && getComputedStyle(e).display !== 'none'; };
  const btns = [...document.querySelectorAll('#hud button')].filter(b => b.offsetParent && b.getBoundingClientRect().width > 0 && !b.closest('#sheet') && b.id !== 'coach-x');
  const small = btns.filter(b => { const q = b.getBoundingClientRect(); return q.height < 44 || q.width < 44; }).map(b => b.id || b.textContent.trim().slice(0, 12));
  const out = btns.filter(b => { const q = b.getBoundingClientRect(); return q.left < -1 || q.top < -1 || q.right > innerWidth + 1 || q.bottom > innerHeight + 1; }).map(b => b.id || b.textContent.trim().slice(0, 12));
  const fs = s => parseFloat(getComputedStyle(document.querySelector(s)).fontSize);
  return { W: innerWidth, H: innerHeight, cv: [cv.width, cv.height], cvCss: [cv.getBoundingClientRect().width, cv.getBoundingClientRect().height], tablet: document.documentElement.classList.contains('tablet'),
    touch: document.documentElement.classList.contains('touch'), mtp: navigator.maxTouchPoints, small, out, statusFs: fs('#status'), tabFs: fs('#tab-dig'), resFs: fs('.r b'), topW: r('top').w, resW: r('res').w,
    overflowX: document.documentElement.scrollWidth > innerWidth + 1, view: [AH.VIEW_TOP(), AH.VIEW_BOT()] }; }"""
SIZES = [("iPad mini", 768, 1024), ("iPad 10th gen", 820, 1180), ("iPad Pro 11", 834, 1194), ("iPad Pro 12.9", 1024, 1366)]
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    for name, w, h in SIZES:
        ctx = b.new_context(viewport={"width": w, "height": h}, device_scale_factor=2, has_touch=True, user_agent=UA)
        pg = ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        cdp = ctx.new_cdp_session(pg)
        def touch(t, pts): cdp.send("Input.dispatchTouchEvent", {"type": t, "touchPoints": [{"x": x, "y": y, "id": i} for i, (x, y) in enumerate(pts)]})
        def tap(x, y): touch("touchStart", [(x, y)]); pg.wait_for_timeout(40); touch("touchEnd", []); pg.wait_for_timeout(80)
        pg.goto(URL); pg.wait_for_selector("[data-o=new]"); pg.wait_for_timeout(500)
        card = pg.locator("#ov-card").bounding_box(); nb = pg.locator("[data-o=new]").bounding_box()
        check(card["width"] <= 640 and nb["height"] >= 56 and card["y"] >= 0 and card["y"] + card["height"] <= h + 1, f"{name}: title card centered/readable, big New Game ({int(nb['height'])}px)")
        pg.evaluate("() => { localStorage.setItem('anthaven-tut-done', '1'); }"); pg.click("[data-o=new]"); pg.wait_for_timeout(200)
        pg.evaluate("() => AH.startGame(AH.newState('backyard', 'easy', 777))"); pg.wait_for_timeout(500)
        for orient in ("portrait", "landscape"):
            if orient == "landscape": pg.set_viewport_size({"width": h, "height": w}); pg.wait_for_timeout(500)
            L = pg.evaluate(LAYOUT); tag = f"{name} {orient} {L['W']}x{L['H']}"
            check(L["cv"] == [L["W"] * 2, L["H"] * 2] and abs(L["cvCss"][0] - L["W"]) < 1 and abs(L["cvCss"][1] - L["H"]) < 1, f"{tag}: canvas fills screen at DPR 2 {L['cv']}")
            check(L["tablet"] and L["touch"] and L["mtp"] > 0, f"{tag}: tablet layout + touch detected via maxTouchPoints (Mac UA)")
            check(not L["small"], f"{tag}: every HUD button ≥44px {L['small']}")
            check(not L["out"] and not L["overflowX"], f"{tag}: nothing off-screen {L['out']}")
            check(L["statusFs"] >= 16 and L["tabFs"] >= 15 and L["resFs"] >= 20, f"{tag}: readable text (status {L['statusFs']}px, tabs {L['tabFs']}px, numbers {L['resFs']}px)")
            check(L["resW"] <= 862, f"{tag}: HUD not stretched (row {int(L['resW'])}px)")
            # colony panel
            pg.click("#tab-colony"); pg.wait_for_timeout(200); sh = pg.locator("#sheet").bounding_box()
            lay = pg.evaluate("() => { const e = document.querySelector('[data-a=lay]'); if (!e) return null; const q = e.getBoundingClientRect(); return { height: q.height }; }") or {"height": 0}
            check(sh["height"] <= L["H"] * .5 + 2 and lay["height"] >= 48, f"{tag}: Colony panel fits, big Lay egg ({int(lay['height'])}px)")
            if name == "iPad 10th gen": pg.screenshot(path=SS + ("30-ipad-portrait.png" if orient == "portrait" else "32-ipad-landscape-colony.png"))
            pg.click("#tab-colony"); pg.wait_for_timeout(150)
            # surface + touch toggle
            vb = pg.locator("#vt-yard").bounding_box(); tap(vb["x"] + vb["width"] / 2, vb["y"] + vb["height"] / 2); pg.wait_for_timeout(250)
            check(pg.evaluate("() => AH.UI.view") == "yard" and vb["height"] >= 56, f"{tag}: tapping 🗺️ Surface (touch) switches view")
            mb = pg.locator("#mini").bounding_box(); check(mb["width"] >= 170, f"{tag}: minimap big enough ({int(mb['width'])}px)")
            pg.click("#yb-harv"); pg.evaluate("() => { AH.spawnHazard('foot', AH.HOME.x + 50, AH.HOME.y + 30); for (let i = 0; i < 30; i++) AH.step(1/30); }"); pg.wait_for_timeout(300)
            tb = pg.locator(".toast").last.bounding_box(); check(tb and tb["y"] > L["view"][0] - 2 and pg.evaluate("() => parseFloat(getComputedStyle(document.querySelector('.toast')).fontSize)") >= 17, f"{tag}: hazard warning toast readable below the HUD")
            if name == "iPad 10th gen" and orient == "landscape": pg.screenshot(path=SS + "31-ipad-landscape.png")
            # pinch + drag on the big screen
            z0 = pg.evaluate("() => { AH.ycam.z = 1.2; return AH.ycam.z; }"); cx, cy = L["W"] / 2, L["H"] / 2
            touch("touchStart", [(cx - 60, cy), (cx + 60, cy)])
            for i in range(1, 9): touch("touchMove", [(cx - 60 - i * 15, cy), (cx + 60 + i * 15, cy)]); pg.wait_for_timeout(16)
            touch("touchEnd", []); pg.wait_for_timeout(80); z1 = pg.evaluate("() => AH.ycam.z")
            x0 = pg.evaluate("() => AH.ycam.x"); touch("touchStart", [(cx, cy)])
            for i in range(1, 9): touch("touchMove", [(cx - i * 20, cy)]); pg.wait_for_timeout(16)
            touch("touchEnd", []); pg.wait_for_timeout(80); x1 = pg.evaluate("() => AH.ycam.x")
            check(z1 > z0 * 1.2 and x1 > x0 + 50, f"{tag}: pinch zooms ({z0:.2f}→{z1:.2f}) and drag pans")
            pg.click("#btn-menu"); pg.wait_for_timeout(150); mb2 = pg.locator("[data-o=hz]").bounding_box()
            check(mb2["height"] >= 56, f"{tag}: ☰ menu buttons big ({int(mb2['height'])}px)")
            if name == "iPad Pro 12.9" and orient == "portrait": pg.screenshot(path=SS + "33-ipad-pro-menu.png")
            pg.click("[data-o=resume]"); pg.wait_for_timeout(100); pg.click("#vt-nest"); pg.wait_for_timeout(150)
        # rotate back → layout recovers
        pg.set_viewport_size({"width": w, "height": h}); pg.wait_for_timeout(500); L2 = pg.evaluate(LAYOUT)
        check(L2["cv"] == [w * 2, h * 2] and not L2["out"], f"{name}: rotating back to portrait re-lays out cleanly")
        check(not errs, f"{name}: no JS errors {errs[:2]}"); ctx.close()
    # phone layout still phone
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True); pg = ctx.new_page(); pg.goto(URL); pg.wait_for_selector("[data-o=new]")
    check(not pg.evaluate("() => document.documentElement.classList.contains('tablet')") and pg.evaluate("() => parseFloat(getComputedStyle(document.querySelector('.r b')).fontSize)") == 16, "phone keeps the compact phone layout")
    b.close()
print(f"\n{len(ok)} passed, {len(bad)} failed"); sys.exit(1 if bad else 0)
