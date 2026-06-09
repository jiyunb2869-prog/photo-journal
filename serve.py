"""Dev server for Photo Journal: serves the current directory with caching
disabled so ES-module edits are always picked up on reload."""
import os
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8753
ROOT = os.path.dirname(os.path.abspath(__file__))


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, *args):
        pass  # quiet


if __name__ == "__main__":
    handler = partial(NoCacheHandler, directory=ROOT)
    httpd = ThreadingHTTPServer(("127.0.0.1", PORT), handler)
    print(f"Photo Journal dev server on http://127.0.0.1:{PORT}")
    httpd.serve_forever()
