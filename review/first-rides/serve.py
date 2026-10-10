#!/usr/bin/env python3
"""Dedicated offline first-rides origin; serves this checkout without modifying saves."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
from functools import partial

class OfflineReview(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Content-Security-Policy', "connect-src 'self' https: data: blob:")
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-First-Rides-Offline', '1')
        super().end_headers()
    def do_GET(self):
        if urlsplit(self.path).path == '/assets/vendor/mqtt/mqtt.min.js':
            self.send_error(403, 'Multiplayer is disabled on this disposable review origin')
            return
        super().do_GET()

if __name__ == '__main__':
    root = Path(__file__).resolve().parents[2]
    print('Offline first-rides review: http://127.0.0.1:18800/review/first-rides/', flush=True)
    ThreadingHTTPServer(('127.0.0.1',18800),partial(OfflineReview,directory=str(root))).serve_forever()
