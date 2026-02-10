
import json
import urllib.request

# 使用從 .env 取得的正確資訊
URL = "https://db.criterium.tw"
SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UtZGVtbyIsImlhdCI6MTc2OTY2NDAzNSwiZXhwIjoyMDg1MDI0MDM1fQ.3hvPiCwA4m3okxVm7_6YVhNolMNeeMk7uoVoudKixfs"

def query_supabase(table, email_col="email", email_val="michaelbourn4@gmail.com"):
    # Supabase REST API query: table?email=eq.email_val
    query_url = f"{URL}/rest/v1/{table}?{email_col}=eq.{email_val}"
    
    headers = {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
        "Content-Type": "application/json"
    }
    
    try:
        req = urllib.request.Request(query_url, headers=headers)
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode())
    except Exception as e:
        return f"Error: {str(e)}"

print("--- Querying tcu_members ---")
members = query_supabase("tcu_members")
print(json.dumps(members, indent=2, ensure_ascii=False))

print("\n--- Querying strava_bindings (by email) ---")
bindings_by_email = query_supabase("strava_bindings", "tcu_member_email")
print(json.dumps(bindings_by_email, indent=2, ensure_ascii=False))

# 如果在 members 中找到了，試著找對應的 athlete_id 或 account
if isinstance(members, list) and len(members) > 0:
    for m in members:
        account = m.get("account")
        if account:
            print(f"\n--- Querying strava_bindings (by account: {account}) ---")
            bindings_by_account = query_supabase("strava_bindings", "tcu_account", account)
            print(json.dumps(bindings_by_account, indent=2, ensure_ascii=False))
