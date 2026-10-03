#!/usr/bin/env python3
"""Serve Milkywan TV on loopback; relay only the MilkyWan TV origin."""
import argparse
import functools
import http.server
import pathlib
import re
import urllib.error
import urllib.parse
import urllib.request
import webbrowser

ROOT = pathlib.Path(__file__).resolve().parent

def allowed(url):
    try:
        u = urllib.parse.urlsplit(url)
        return u.scheme in ('http', 'https') and u.hostname == 'tv.milkywan.fr' and u.port in (None, 80, 443) and not u.username and not u.password
    except ValueError:
        return False

class Redirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if not allowed(newurl):
            raise urllib.error.URLError('Redirection hors du service MilkyWan refusée')
        return super().redirect_request(req, fp, code, msg, headers, newurl)

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if urllib.parse.urlsplit(self.path).path != '/proxy':
            return super().do_GET()
        origin = self.headers.get('Origin')
        if self.headers.get('Sec-Fetch-Site') == 'cross-site' or (origin and origin != 'http://' + self.headers.get('Host', '')):
            return self.send_error(403, 'Requête extérieure refusée')
        params = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)
        url = params.get('url', [''])[0]
        if not allowed(url):
            return self.send_error(403, 'Seul tv.milkywan.fr peut être relayé')
        headers = {'User-Agent': 'MilkywanTV-PC/1.4', 'Accept-Encoding': 'identity'}
        requested_range = self.headers.get('Range', '')
        if requested_range and re.fullmatch(r'bytes=\d*-\d*', requested_range):
            headers['Range'] = requested_range
        started = False
        try:
            opener = urllib.request.build_opener(Redirects())
            with opener.open(urllib.request.Request(url, headers=headers), timeout=20) as upstream:
                self.send_response(upstream.status)
                for name in ('Content-Type', 'Content-Length', 'Content-Range', 'Accept-Ranges'):
                    if upstream.headers.get(name):
                        self.send_header(name, upstream.headers[name])
                self.send_header('Cache-Control', 'no-store')
                self.send_header('X-Content-Type-Options', 'nosniff')
                self.end_headers()
                started = True
                while True:
                    chunk = upstream.read(64 * 1024)
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            pass
        except urllib.error.HTTPError as exc:
            if not started:
                self.send_error(exc.code, 'Le serveur MilkyWan a refusé la requête')
        except (OSError, urllib.error.URLError):
            if not started:
                self.send_error(502, 'Service MilkyWan inaccessible depuis cette connexion')

    def log_message(self, fmt, *args):
        # Never log URLs or their potentially sensitive query parameters.
        pass

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--no-browser', action='store_true')
    args = parser.parse_args()
    handler = functools.partial(Handler, directory=str(ROOT))
    try:
        server = http.server.ThreadingHTTPServer(('127.0.0.1', args.port), handler)
    except OSError as exc:
        raise SystemExit('Impossible de démarrer le serveur local : ' + str(exc))
    url = 'http://127.0.0.1:%d/' % server.server_port
    print('Milkywan TV : ' + url, flush=True)
    print('Gardez cette fenêtre ouverte. Ctrl+C pour arrêter.', flush=True)
    if not args.no_browser:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()

if __name__ == '__main__':
    main()
