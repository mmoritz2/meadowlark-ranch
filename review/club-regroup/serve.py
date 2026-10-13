#!/usr/bin/env python3
"""Serve the two dedicated normal-play review origins; never edits game saves."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from functools import partial
from urllib.parse import urlsplit
import argparse

class ReviewServer(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Club-Regroup-Review', '1')
        self.send_header('Content-Security-Policy', "connect-src 'self' https: data: blob: wss://broker.emqx.io:8084")
        super().end_headers()
    def do_GET(self):
        if urlsplit(self.path).path == '/api/me':
            data=b'null'
            self.send_response(200)
            self.send_header('Content-Type','application/json')
            self.send_header('Content-Length',str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        super().do_GET()

if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--role',choices=['host','guest'],required=True)
    args=parser.parse_args()
    port=18822 if args.role=='host' else 18823
    root=Path(__file__).resolve().parents[2]
    print(f'Normal regroup {args.role} review: http://127.0.0.1:{port}/review/club-regroup/',flush=True)
    ThreadingHTTPServer(('127.0.0.1',port),partial(ReviewServer,directory=str(root))).serve_forever()
