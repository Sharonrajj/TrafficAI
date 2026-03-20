import os
from http.server import HTTPServer, SimpleHTTPRequestHandler

# This serves as a lightweight fallback entrypoint for App Engine.
# Note: Most traffic is caught and routed securely by the static handlers in app.yaml.
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    print(f"Starting lightweight static server on port {port}")
    HTTPServer(('', port), SimpleHTTPRequestHandler).serve_forever()
