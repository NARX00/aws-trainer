"""Smoke test for dist/trainer.html with a stand-in for the claude.ai database.

    pip install playwright && playwright install chromium
    python3 web/build.py && python3 tools/test_trainer.py

Loads data/ into an in-memory database (tools/mock.js), opens the page, and checks:
questions load, progress is written to data/users/<id>/progress, an edit saves.
"""
import asyncio, functools, http.server, json, os, threading
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def store():
    s = {}
    qd = os.path.join(ROOT, 'data', 'questions')
    for f in os.listdir(qd):
        s['questions/' + f[:-5]] = json.load(open(os.path.join(qd, f), encoding='utf-8'))
    for m in ('bank', 'patterns'):
        s['meta/' + m] = json.load(open(os.path.join(ROOT, 'data', 'meta', m + '.json'), encoding='utf-8'))
    return json.dumps(s)

def serve():
    h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=os.path.join(ROOT, 'dist'))
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), h)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv

async def main():
    srv = serve(); url = 'http://127.0.0.1:%d/trainer.html' % srv.server_port
    mock = open(os.path.join(ROOT, 'tools', 'mock.js'), encoding='utf-8').read()
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context()
        await ctx.add_init_script('window.__MOCKSTORE=' + store() + ';' + mock)
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(url); await pg.wait_for_timeout(2500)
        assert 'synced' in await pg.inner_text('#sync'), 'progress did not sync'
        await pg.click('#impSkip'); await pg.wait_for_timeout(2500)
        assert await pg.evaluate("!!window.__STORE['data/users/u1/progress']"), 'progress not saved'
        await pg.click('#tabEdit'); await pg.fill('#edQ', 'A276'); await pg.wait_for_timeout(600)
        await pg.click('[data-ed]'); await pg.fill('#edY', 'Test edit.'); await pg.click('#edSave')
        await pg.wait_for_timeout(500)
        assert await pg.evaluate("window.__STORE['questions/A276'].w.y") == 'Test edit.', 'edit not saved'
        assert not errs, errs
        print('OK: load, progress save, question edit')
        await b.close()
    srv.shutdown()

asyncio.run(main())
