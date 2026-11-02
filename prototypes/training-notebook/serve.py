"""Serve this local design study without mixing cached module revisions."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
import argparse
import re
import time

ROOT = Path(__file__).resolve().parent
REVISION = str(time.time_ns())


class MockupHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        self.send_header("Pragma", "no-cache")
        super().end_headers()

    def send_head(self):
        path = Path(self.translate_path(urlsplit(self.path).path))
        if path.is_dir():
            path = path / "index.html"
        if path.is_file() and path.suffix in {".html", ".mjs"}:
            text = path.read_text(encoding="utf-8")
            # All local module imports receive the same revision, including
            # dependencies already cached before this server was started.
            text = re.sub(
                r"(['\"])(\./[^'\"?]+\.(?:mjs|css))\1",
                lambda match: f"{match[1]}{match[2]}?rev={REVISION}{match[1]}",
                text,
            )
            data = text.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/javascript; charset=utf-8" if path.suffix == ".mjs" else "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            from io import BytesIO
            return BytesIO(data)
        return super().send_head()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=4317)
    args = parser.parse_args()
    print(f"Mockup: http://127.0.0.1:{args.port}/index.html", flush=True)
    ThreadingHTTPServer(("127.0.0.1", args.port), MockupHandler).serve_forever()
