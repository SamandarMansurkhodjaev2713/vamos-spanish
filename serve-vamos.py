"""Local static preview with byte ranges for human-audio seeking. Loopback only."""
from argparse import ArgumentParser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent / "web"


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def media(self, head=False):
        path = Path(self.translate_path(self.path)).resolve()
        if not path.is_relative_to(ROOT.resolve()):
            self.send_error(403)
            return True
        if not path.is_file() or path.suffix not in (".mp3", ".wav"):
            return False
        body = path.read_bytes()
        size = len(body)
        header = self.headers.get("Range")
        start, end = 0, size - 1
        if header:
            match = re.fullmatch(r"bytes=(\d*)-(\d*)", header)
            if not match or not any(match.groups()):
                start = size
            elif match[1]:
                start = int(match[1])
                end = min(int(match[2]) if match[2] else end, end)
            else:
                start = max(0, size - int(match[2]))
        if start >= size or end < start or size == 0:
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{size}")
            self.send_header("Content-Length", "0")
            self.end_headers()
            return True
        self.send_response(206 if header else 200)
        self.send_header("Content-Type", self.guess_type(str(path)))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(end - start + 1))
        if header:
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.end_headers()
        if not head:
            try:
                self.wfile.write(body[start:end + 1])
            except (BrokenPipeError, ConnectionResetError):
                pass  # A seek can cancel the previous media request.
        return True

    def do_GET(self):
        if not self.media():
            super().do_GET()

    def do_HEAD(self):
        if not self.media(head=True):
            super().do_HEAD()


if __name__ == "__main__":
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8768)
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error("Port must be between 1 and 65535")
    ThreadingHTTPServer(("127.0.0.1", args.port), Handler).serve_forever()
