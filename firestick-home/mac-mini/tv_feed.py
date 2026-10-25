#!/usr/bin/env python3
"""Serve the Fire Stick home screen's metrics feed from the Mac mini.

    python3 tv_feed.py [--port 8787] [--file metrics.json]

The Fire Stick fetches http://<mac-mini-ip>:8787/tv/metrics.json. Until this is wired to
Cortana's real data, it serves the JSON file you point it at (format: metrics.sample.json).
"""
import argparse
import http.server
import json
import pathlib

HERE = pathlib.Path(__file__).resolve().parent


def build_feed(path: pathlib.Path) -> dict:
    # Replace this read with Cortana's data (PocketBase) once we wire it up.
    return json.loads(path.read_text())


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8787)
    parser.add_argument("--file", type=pathlib.Path, default=HERE / "metrics.sample.json")
    args = parser.parse_args()
    routes = {"/tv/metrics.json": args.file}

    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            path = routes.get(self.path.split("?")[0])
            if path is None:
                self.send_error(404)
                return
            try:
                body = json.dumps(build_feed(path)).encode()
            except (OSError, ValueError) as e:
                self.send_error(500, str(e))
                return
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

    for route, path in routes.items():
        print(f"Serving {path} at http://0.0.0.0:{args.port}{route}")
    http.server.ThreadingHTTPServer(("0.0.0.0", args.port), Handler).serve_forever()


if __name__ == "__main__":
    main()
