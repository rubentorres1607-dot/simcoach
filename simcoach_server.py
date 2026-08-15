#!/usr/bin/env python3
"""
SimCoach local server — Groq edition (gratuito)
Uso: python simcoach_server.py gsk_...
"""
import http.server, json, urllib.request, sys, os

API_KEY  = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("GROQ_API_KEY", "")
PORT     = 8080
HTML_FILE = "simcoach_v4.html"

GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL    = "llama-3.1-8b-instant"

class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(fmt % args)

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/" or path == "/index.html":
            path = "/" + HTML_FILE
        filepath = path.lstrip("/")
        if os.path.exists(filepath):
            self.send_response(200)
            ct = "text/html" if filepath.endswith(".html") else "application/octet-stream"
            self.send_header("Content-Type", ct)
            self._cors()
            self.end_headers()
            with open(filepath, "rb") as f:
                self.wfile.write(f.read())
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path == "/api/claude":
            length = int(self.headers.get("Content-Length", 0))
            body   = json.loads(self.rfile.read(length))

            # Converter formato Anthropic → formato OpenAI/Groq
            messages = body.get("messages", [])
            groq_body = json.dumps({
                "model":       GROQ_MODEL,
                "max_tokens":  body.get("max_tokens", 1000),
                "messages":    messages,
                "temperature": 0.7,
            }).encode()

            req = urllib.request.Request(
                GROQ_ENDPOINT,
                data=groq_body,
                headers={
                    "Content-Type":  "application/json",
                    "Authorization": "Bearer " + API_KEY,
                },
                method="POST"
            )
            try:
                with urllib.request.urlopen(req) as r:
                    resp = json.loads(r.read())
                # Converter resposta Groq → formato Anthropic (que o HTML espera)
                text = resp["choices"][0]["message"]["content"]
                out  = json.dumps({"content": [{"type": "text", "text": text}]}).encode()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self._cors()
                self.end_headers()
                self.wfile.write(out)
            except urllib.error.HTTPError as e:
                err = e.read()
                print("Groq erro:", err.decode())
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self._cors()
                self.end_headers()
                self.wfile.write(err)
        else:
            self.send_response(404)
            self.end_headers()

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

if __name__ == "__main__":
    if not API_KEY:
        print("Erro: falta a API key do Groq.")
        print("Uso: python simcoach_server.py gsk_...")
        sys.exit(1)
    server = http.server.HTTPServer(("", PORT), Handler)
    print(f"SimCoach (Groq) a correr em http://localhost:{PORT}")
    print(f"Modelo: {GROQ_MODEL}")
    print(f"A servir: {HTML_FILE}")
    print("Ctrl+C para parar")
    server.serve_forever()
