#!/usr/bin/env python3
"""DBH-WW1 web server: serves the game (like `python3 -m http.server`) plus a tiny mailbox for network play.

The two players exchange WebRTC session descriptions through it (a short room code instead of long
invitation / answer codes); the game itself then runs peer to peer.

    npm run build                     # the game is built by Vite into dist/
    python3 server.py [port]          # default 8000, listens on all interfaces, serves dist/
    open http://<this machine>:8000/index.html on both computers

(`npm run dev` is the Vite dev server; it answers the same mailbox API itself.)

API: GET /api/ping -> "dbh";  POST /api/room/<code>/<slot> (body = text);  GET /api/room/<code>/<slot>
Rooms are forgotten after an hour.
"""
import functools
import os
import re
import sys
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOMS = {}                      # (code, slot) -> (time, text)
LOCK = threading.Lock()
TTL = 3600
MAX_BODY = 64 * 1024
ROUTE = re.compile(r'^/api/room/([A-Za-z0-9]{3,12})/(offer|answer)$')


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        if self.path.startswith('/api/'):
            self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def reply(self, code, text=''):
        body = text.encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'text/plain; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split('?')[0]
        if path == '/api/ping':
            return self.reply(200, 'dbh')
        m = ROUTE.match(path)
        if m:
            key = (m.group(1).upper(), m.group(2))
            with LOCK:
                item = ROOMS.get(key)
            if not item or not item[1]:
                return self.reply(404, '')
            return self.reply(200, item[1])
        return super().do_GET()

    def do_POST(self):
        m = ROUTE.match(self.path.split('?')[0])
        if not m:
            return self.reply(404, '')
        n = int(self.headers.get('Content-Length') or 0)
        if n > MAX_BODY:
            return self.reply(413, '')
        text = self.rfile.read(n).decode('utf-8', 'replace')
        now = time.time()
        with LOCK:
            for k in [k for k, (t, _) in ROOMS.items() if now - t > TTL]:
                del ROOMS[k]
            ROOMS[(m.group(1).upper(), m.group(2))] = (now, text)
        return self.reply(200, 'ok')

    def log_message(self, fmt, *args):
        if not self.path.startswith('/api/'):
            super().log_message(fmt, *args)


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    root = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'dist')
    if not os.path.isfile(os.path.join(root, 'index.html')):
        sys.exit('dist/ not found: build the game first (npm install && npm run build)')
    print(f'DBH-WW1: http://localhost:{port}/index.html  (network play: the same address from the other computer)')
    ThreadingHTTPServer(('', port), functools.partial(Handler, directory=root)).serve_forever()
