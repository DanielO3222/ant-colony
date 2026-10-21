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
    tr = pg.evaluate("() => [AHAudio.TRACKS, AHAudio.track, AHAudio.music.src, AHAudio.music.loop]")
    check(len(tr[0]) == 3 and tr[2].endswith(tr[0][tr[1]]) and not tr[3], f"playlist of 3 tracks, playing track {tr[1] + 1} ({tr[2].split('/')[-1]}), no single-track loop")
    # simulate each song ending: should move to the next track and keep playing, wrapping around
    seen = [tr[1]]
    for k in range(3):
        pg.evaluate("() => AHAudio.music.dispatchEvent(new Event('ended'))"); pg.wait_for_timeout(700)
        st2 = pg.evaluate("() => [AHAudio.track, AHAudio.music.src.split('/').pop(), AHAudio.music.paused, AHAudio.music.currentTime]")
        check(st2[0] == (seen[-1] + 1) % 3 and st2[1] == tr[0][st2[0]].split('/')[-1] and not st2[2], f"song ended -> next track {st2[0] + 1} ({st2[1]}) plays")
        seen.append(st2[0])
    check(seen[-1] == seen[0] and len(set(seen)) == 3, f"playlist wraps around through all 3 tracks {seen}")
    pg.wait_for_timeout(800)
    check(pg.evaluate("() => AHAudio.music.currentTime > 0.2 && AHAudio.music.readyState >= 2"), "the new track actually loads and plays")
    starts = set()
    for k in range(8):
        pg2 = ctx.new_page(); pg2.goto(URL); pg2.wait_for_selector("[data-o=new]"); starts.add(pg2.evaluate("() => AHAudio.track")); pg2.close()
    check(len(starts) >= 2, f"sessions start on a random track {sorted(starts)}")
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
    t0 = pg.evaluate("() => AHAudio.track"); pg.click("#snd-next"); pg.wait_for_timeout(600)
    t1 = pg.evaluate("() => [AHAudio.track, AHAudio.music.paused]")
    check(t1[0] == (t0 + 1) % 3 and not t1[1] and f"Song {t1[0] + 1} of 3" in pg.inner_text("#snd-next"), f"⏭ Next song skips to track {t1[0] + 1} and shows it")
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
