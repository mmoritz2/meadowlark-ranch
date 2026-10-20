from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
from pathlib import Path
class Server(SimpleHTTPRequestHandler):
 def end_headers(self):
  self.send_header('Cache-Control','no-store');super().end_headers()
 def do_GET(self):
  if self.path=='/api/me':
   self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(b'null');return
  super().do_GET()
root=Path(__file__).resolve().parents[2]
print('Ordinary riding review http://127.0.0.1:18830/review/riding-foundation/',flush=True)
ThreadingHTTPServer(('127.0.0.1',18830),partial(Server,directory=str(root))).serve_forever()
