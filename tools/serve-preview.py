"""Local preview: python tools/serve-preview.py [port]  (default http://127.0.0.1:8431).

The port used to be nailed to 8431, which meant two checkouts could not be previewed at the
same time: the second server failed to bind, and every QA script — which also had 8431 baked
in — went on talking to the first one and silently tested the wrong build. Pass a port, or
set QA_PORT, and run the matching script with the same QA_PORT so the pair stay together.
"""
import os
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class PreviewHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


if __name__ == '__main__':
    port = int(sys.argv[1] if len(sys.argv) > 1 else os.environ.get('QA_PORT', 8431))
    server = ThreadingHTTPServer(('127.0.0.1', port), partial(PreviewHandler, directory=str(ROOT)))
    print(f'Preview ready at http://127.0.0.1:{port}/breeds.html', flush=True)
    print(f'  QA_PORT={port} node tools/qa-features.cjs', flush=True)
    server.serve_forever()
