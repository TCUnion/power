import os
from dotenv import load_dotenv
import json
import urllib.request

# 嘗試載入環境變數（支援多種路徑）
load_dotenv()
env_paths = [
    "web/.env",
    "../web/.env",
    os.path.join(os.path.dirname(__file__), "..", "web", ".env"),
    os.path.join(os.path.dirname(__file__), ".env")
]
for p in env_paths:
    if os.path.exists(p):
        load_dotenv(p)
        print(f"Loaded environment variables from {p}")

def get_env_var(keys):
    for key in keys:
        val = os.environ.get(key)
        if val:
            return val
    return None

URL = get_env_var(["SUPABASE_URL", "VITE_SUPABASE_URL"])
SERVICE_ROLE_KEY = get_env_var(["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY", "SUPABASE_KEY", "VITE_SUPABASE_SERVICE_ROLE_KEY"])

if not URL or not SERVICE_ROLE_KEY:
    print("Error: Missing SUPABASE_URL or SERVICE_ROLE_KEY in environment variables.")
    exit(1)

import requests

def query_supabase(table, email_col="email", email_val="michaelbourn4@gmail.com"):
    # Supabase REST API query: table?email=eq.email_val
    query_url = f"{URL}/rest/v1/{table}"
    params = {
        email_col: f"eq.{email_val}",
        "select": "*"
    }
    
    headers = {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.get(query_url, headers=headers, params=params)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        return f"Error: {str(e)}"

print("--- Querying tcu_members ---")
members = query_supabase("tcu_members")
print(json.dumps(members, indent=2, ensure_ascii=False))

print("\n--- Querying strava_bindings (by email) ---")
bindings_by_email = query_supabase("strava_member_bindings", "tcu_member_email")
print(json.dumps(bindings_by_email, indent=2, ensure_ascii=False))

# 如果在 members 中找到了，試著找對應的 athlete_id 或 account
if isinstance(members, list) and len(members) > 0:
    for m in members:
        account = m.get("account")
        if account:
            print(f"\n--- Querying strava_bindings (by account: {account}) ---")
            bindings_by_account = query_supabase("strava_member_bindings", "tcu_account", account)
            print(json.dumps(bindings_by_account, indent=2, ensure_ascii=False))
