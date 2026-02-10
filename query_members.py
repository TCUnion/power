
import os
import json
import urllib.request

# 手動解析 .env 檔案內容
env_path = '/Volumes/OWC 2T/Github/STRAVAPower/web/.env'
env_vars = {}
with open(env_path, 'r') as f:
    for line in f:
        line = line.strip()
        if '=' in line and not line.startswith('#'):
            key, value = line.split('=', 1)
            env_vars[key.strip()] = value.strip().strip('"').strip("'")

url = env_vars.get('SUPABASE_URL') or env_vars.get('VITE_SUPABASE_URL')
# 優先使用 SERVICE_ROLE_KEY 以獲得繞過 RLS 的權取權限
key = env_vars.get('SUPABASE_SERVICE_ROLE_KEY') or env_vars.get('VITE_SUPABASE_SERVICE_ROLE_KEY')

def query_supabase(endpoint):
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json"
    }
    req = urllib.request.Request(f"{url}{endpoint}", headers=headers)
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read().decode())

def run():
    email = "michaelbourn4@gmail.com"
    print(f"URL: {url}")
    # 列印 Key 的前 10 碼以驗證 (不可完全洩漏但需確認是否抓到 Service Role)
    print(f"Key Prefix: {key[:10]}...") 
    
    print("\n--- Members ---")
    try:
        members = query_supabase(f"/rest/v1/tcu_members?email=eq.{email}&select=*")
        print(json.dumps(members, indent=2, ensure_ascii=False))
    except Exception as e:
        print(f"Error querying members: {e}")

    print("\n--- Bindings ---")
    try:
        bindings = query_supabase(f"/rest/v1/strava_bindings?tcu_member_email=eq.{email}&select=*")
        print(json.dumps(bindings, indent=2, ensure_ascii=False))
    except Exception as e:
        print(f"Error querying bindings: {e}")

if __name__ == "__main__":
    run()
