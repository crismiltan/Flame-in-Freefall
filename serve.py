"""Local server for VESTA. Like `python3 -m http.server`, but any unknown address
redirects to the home page (the same behavior as 404.html on GitHub Pages).

Usage: python3 serve.py [port]   (default 8000)
"""
import http.server
import os
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def send_error(self, code, message=None, explain=None):
        if code == 404:
            self.send_response(302)
            self.send_header("Location", "/")
            self.end_headers()
            return
        super().send_error(code, message, explain)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    print(f"VESTA running at http://localhost:{port}")
    http.server.ThreadingHTTPServer(("", port), Handler).serve_forever()
