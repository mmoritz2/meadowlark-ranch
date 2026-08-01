"""
Serve Star Ranch Fable over HTTPS so the Quest browser will allow VR.

WebXR refuses to start on a plain http:// page. Anything other than localhost has
to be https://, so this makes a self-signed certificate the first time it runs and
then serves this folder with it.

    python serve-vr.py

Then open the printed https:// address in the Quest browser.
"""

import http.server
import os
import pathlib
import socket
import ssl
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent
PORT = 8443
CERT = ROOT / "vr-cert.pem"
KEY = ROOT / "vr-key.pem"

OPENSSL_CANDIDATES = [
    r"C:\Program Files\Git\mingw64\bin\openssl.exe",
    r"C:\Program Files\Git\usr\bin\openssl.exe",
    "openssl",
]


def lan_ip():
    """The address the Quest needs, not 127.0.0.1."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


def find_openssl():
    for c in OPENSSL_CANDIDATES:
        if c == "openssl" or os.path.exists(c):
            return c
    return None


def make_cert(ip):
    openssl = find_openssl()
    if not openssl:
        sys.exit("Could not find openssl. Install Git for Windows, or create "
                 "vr-cert.pem and vr-key.pem yourself.")
    print(f"Creating a self-signed certificate for {ip} ...")
    subprocess.run(
        [
            openssl, "req", "-x509", "-newkey", "rsa:2048", "-nodes",
            "-keyout", str(KEY), "-out", str(CERT), "-days", "825",
            "-subj", f"/CN={ip}",
            "-addext", f"subjectAltName=IP:{ip},IP:127.0.0.1,DNS:localhost",
        ],
        check=True,
    )
    print("Certificate created.\n")


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Always serve fresh files, so an edit shows up on the next headset reload.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        if "GET" in (fmt % args) and ".html" in (fmt % args):
            super().log_message(fmt, *args)


def main():
    ip = lan_ip()
    if not (CERT.exists() and KEY.exists()):
        make_cert(ip)

    os.chdir(ROOT)
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(str(CERT), str(KEY))

    httpd = http.server.ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)

    print("=" * 58)
    print("  Open this in the Meta Quest browser:")
    print()
    print(f"      https://{ip}:{PORT}/ranch3d.html")
    print()
    print("  The browser will warn that the certificate is not trusted.")
    print("  That is expected - it is your own PC. Tap Advanced, then")
    print("  Proceed. Then tap the 'Ride in VR' button in the game.")
    print()
    print("  Stop the server with Ctrl+C.")
    print("=" * 58)

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")


if __name__ == "__main__":
    main()
