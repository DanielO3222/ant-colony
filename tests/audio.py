"""Audio settings test: menu toggles exist, persist in localStorage, music + synthesized sounds start only after a tap.
Run: python tests/audio.py [url]"""
import sys
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8811/"
ok, bad = [], []
def check(c, m): (ok if c else bad).append(m); print(("PASS " if c else "FAIL ") + m, flush=True)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox", "--autoplay-policy=user-gesture-required"])
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append("pageerror: " + str(e)))
    pg.on("console", lambda m: m.type == "error" and errs.append("console: " + m.text))
    pg.goto(URL); pg.wait_for_selector("[data-o=new]"); pg.wait_for_timeout(500)
    pg.evaluate("() => localStorage.clear()")
    check(pg.evaluate("() => !!window.AHAudio && AHAudio.AU.music && AHAudio.AU.sfx && AHAudio.AU.vol > 0"), "audio defaults: music on, sounds on, volume > 0")
    check(pg.evaluate("() => AHAudio.ctx === null && AHAudio.music === null"), "no audio context or music before the first tap")
    pg.click("[data-o=new]"); pg.wait_for_timeout(1500)
    check(pg.evaluate("() => !!AHAudio.ctx && !!AHAudio.music"), "first tap creates the audio context and music element")
    check(pg.evaluate("() => AHAudio.music.loop && AHAudio.music.src.endsWith('assets/music.mp3')"), "music loops from assets/music.mp3")
    check(pg.evaluate("() => !AHAudio.music.paused"), "music is playing after the tap")
    st = pg.evaluate("() => AHAudio.ctx.state"); check(st == "running", f"audio context running ({st})")
    n0 = pg.evaluate("() => AHAudio.count")
    pg.evaluate("() => { for (let i = 0; i < 50; i++) AHAudio.sfx('pop'); AHAudio.sfx('stomp'); AHAudio.sfx('dig'); }")
    n1 = pg.evaluate("() => AHAudio.count")
    check(n1 - n0 == 3, f"rapid repeats are throttled (50 pops + stomp + dig -> {n1 - n0} sounds)")
    pg.evaluate("() => { for (let i = 0; i < 30 * 40; i++) AH.step(1/30); }"); pg.wait_for_timeout(300)
    check(pg.evaluate("() => AHAudio.count") > n1, "game events trigger sounds while playing")
    # menu toggles
    pg.click("#btn-menu"); pg.wait_for_timeout(200)
    check(pg.is_visible("#snd-music") and pg.is_visible("#snd-sfx") and pg.is_visible("#snd-vol"), "☰ menu shows Music, Sounds and a volume slider")
    check("On" in pg.inner_text("#snd-music") and "On" in pg.inner_text("#snd-sfx"), "both toggles start On")
    pg.click("#snd-music"); pg.wait_for_timeout(200)
    check("Off" in pg.inner_text("#snd-music") and pg.evaluate("() => AHAudio.music.paused"), "Music Off pauses the song")
    pg.click("#snd-sfx"); pg.wait_for_timeout(100)
    c0 = pg.evaluate("() => AHAudio.count"); pg.evaluate("() => { AHAudio.sfx('win'); }")
    check("Off" in pg.inner_text("#snd-sfx") and pg.evaluate("() => AHAudio.count") == c0, "Sounds Off silences effects")
    pg.fill("#snd-vol", "40"); pg.wait_for_timeout(100)
    saved = pg.evaluate("() => JSON.parse(localStorage.getItem(AHAudio.KEY))")
    check(saved == {"music": False, "sfx": False, "vol": 0.4}, f"settings saved in localStorage {saved}")
    pg.reload(); pg.wait_for_selector("[data-o=new]"); pg.wait_for_timeout(300)
    check(pg.evaluate("() => !AHAudio.AU.music && !AHAudio.AU.sfx && AHAudio.AU.vol === 0.4"), "settings survive a reload")
    pg.click("[data-o=new]"); pg.wait_for_timeout(500)
    check(pg.evaluate("() => !AHAudio.music || AHAudio.music.paused"), "music stays off after reload when turned off")
    pg.click("#btn-menu"); pg.wait_for_timeout(150); pg.click("#snd-music"); pg.click("#snd-sfx"); pg.wait_for_timeout(800)
    check(pg.evaluate("() => AHAudio.AU.music && AHAudio.AU.sfx && !AHAudio.music.paused"), "turning Music back on resumes the song")
    # tab hidden -> pause, visible -> resume
    pg.evaluate("() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); }"); pg.wait_for_timeout(200)
    check(pg.evaluate("() => AHAudio.music.paused"), "music pauses when the tab is hidden")
    pg.evaluate("() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); }"); pg.wait_for_timeout(600)
    check(pg.evaluate("() => !AHAudio.music.paused"), "music resumes when the tab comes back")
    check(not errs, "no console errors: " + "; ".join(errs[:5]))
    b.close()
print(f"\n{len(ok)} passed, {len(bad)} failed"); sys.exit(1 if bad else 0)
