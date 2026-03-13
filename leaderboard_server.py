#!/usr/bin/env python3
"""
SamOwl Leaderboard Server
Receives scores from players and commits to GitHub repo
"""

import json
import time
import subprocess
from datetime import datetime
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler

# Configuration
REPO_DIR = Path('/root/rudedudetrainings.github.io')
LEADERBOARD_FILE = REPO_DIR / 'leaderboard.json'
SERVER_PORT = 8080

def load_leaderboard():
    """Load leaderboard from file"""
    if LEADERBOARD_FILE.exists():
        try:
            with open(LEADERBOARD_FILE, 'r') as f:
                return json.load(f)
        except:
            pass
    return {'entries': [], 'last_update': datetime.now().isoformat()}

def save_leaderboard(data):
    """Save leaderboard to file"""
    data['last_update'] = datetime.now().isoformat()
    with open(LEADERBOARD_FILE, 'w') as f:
        json.dump(data, f, indent=2)

def add_score(name, portfolio_value, cash):
    """Add a new score to leaderboard"""
    leaderboard = load_leaderboard()
    
    # Check if player already exists
    existing = None
    for entry in leaderboard['entries']:
        if entry['name'] == name:
            existing = entry
            break
    
    if existing:
        # Update if new score is higher
        if portfolio_value > existing['portfolio_value']:
            existing['portfolio_value'] = portfolio_value
            existing['cash'] = cash
            existing['updated'] = datetime.now().isoformat()
    else:
        # Add new entry
        leaderboard['entries'].append({
            'name': name,
            'portfolio_value': portfolio_value,
            'cash': cash,
            'updated': datetime.now().isoformat()
        })
    
    # Sort by portfolio value (descending) and keep top 100
    leaderboard['entries'].sort(key=lambda x: x['portfolio_value'], reverse=True)
    leaderboard['entries'] = leaderboard['entries'][:100]
    
    save_leaderboard(leaderboard)
    return leaderboard

def commit_to_github():
    """Commit leaderboard changes to GitHub"""
    try:
        subprocess.run(['git', 'add', 'leaderboard.json'], cwd=REPO_DIR, check=True)
        subprocess.run(['git', 'commit', '-m', f'Update leaderboard - {datetime.now().strftime("%Y-%m-%d %H:%M")}'], 
                      cwd=REPO_DIR, check=True, capture_output=True)
        subprocess.run(['git', 'push', 'origin', 'main'], cwd=REPO_DIR, check=True, capture_output=True)
        print(f"[{datetime.now()}] Committed leaderboard to GitHub")
        return True
    except subprocess.CalledProcessError as e:
        print(f"[{datetime.now()}] Git error: {e}")
        return False

class RequestHandler(BaseHTTPRequestHandler):
    """HTTP request handler for leaderboard API"""
    
    def log_message(self, format, *args):
        """Suppress default logging"""
        pass
    
    def do_OPTIONS(self):
        """Handle CORS preflight"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def do_GET(self):
        """Handle GET requests"""
        if self.path == '/leaderboard':
            leaderboard = load_leaderboard()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(leaderboard).encode())
        else:
            self.send_response(404)
            self.end_headers()
    
    def do_POST(self):
        """Handle POST requests"""
        if self.path == '/leaderboard':
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                self.send_response(400)
                self.end_headers()
                return
                
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data)
                name = data.get('name', 'Anonymous')
                portfolio_value = data.get('portfolio_value', 0)
                cash = data.get('cash', 0)
                
                print(f"[{datetime.now()}] New score: {name} - ${portfolio_value:,.2f}")
                
                # Add score to leaderboard
                leaderboard = add_score(name, portfolio_value, cash)
                
                # Commit to GitHub (async - don't block response)
                import threading
                threading.Thread(target=commit_to_github, daemon=True).start()
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'status': 'ok', 
                    'message': 'Score submitted! Will appear in ~30 seconds.',
                    'rank': next((i+1 for i, e in enumerate(leaderboard['entries']) if e['name'] == name), None)
                }).encode())
            except Exception as e:
                print(f"[{datetime.now()}] Error: {e}")
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode())
        else:
            self.send_response(404)
            self.end_headers()

def run_server():
    """Run HTTP server"""
    server = HTTPServer(('0.0.0.0', SERVER_PORT), RequestHandler)
    print(f"[{datetime.now()}] Leaderboard server running on port {SERVER_PORT}")
    print(f"[{datetime.now()}] API: http://localhost:{SERVER_PORT}/leaderboard")
    server.serve_forever()

def main():
    """Main function"""
    print("=" * 60)
    print("🦉 SamOwl Leaderboard Server")
    print(f"Port: {SERVER_PORT}")
    print(f"Repo: {REPO_DIR}")
    print("=" * 60)
    
    # Initialize leaderboard file
    if not LEADERBOARD_FILE.exists():
        save_leaderboard({'entries': []})
    
    run_server()

if __name__ == '__main__':
    main()
