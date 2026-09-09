"""Local preview: python tools/serve-preview.py (http://127.0.0.1:8431)."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class PreviewHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


if __name__ == '__main__':
    server = ThreadingHTTPServer(('127.0.0.1', 8431), partial(PreviewHandler, directory=str(ROOT)))
    print('Preview ready at http://127.0.0.1:8431/breeds.html', flush=True)
    server.serve_forever()
