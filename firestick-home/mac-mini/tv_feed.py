#!/usr/bin/env python3
"""Serve the Fire Stick home screen's metrics feed from the Mac mini.

    python3 tv_feed.py [--port 8787] [--file metrics.json]

The Fire Stick fetches http://<mac-mini-ip>:8787/tv/metrics.json. Until this is wired to
the real data, it serves whatever JSON file you point it at (format: metrics.sample.json).
"""
import argparse
import http.server
import json
import pathlib

HERE = pathlib.Path(__file__).resolve().parent


def build_feed(path: pathlib.Path) -> dict:
    # Replace this with a read from Cortana's data (PocketBase etc.) once we wire it up.
    return json.loads(path.read_text())


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8787)
    parser.add_argument("--file", type=pathlib.Path, default=HERE / "metrics.sample.json")
    args = parser.parse_args()

    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path.split("?")[0] != "/tv/metrics.json":
                self.send_error(404)
                return
            try:
                body = json.dumps(build_feed(args.file)).encode()
            except (OSError, ValueError) as e:
                self.send_error(500, str(e))
                return
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

    print(f"Serving {args.file} at http://0.0.0.0:{args.port}/tv/metrics.json")
    http.server.ThreadingHTTPServer(("0.0.0.0", args.port), Handler).serve_forever()


if __name__ == "__main__":
    main()
