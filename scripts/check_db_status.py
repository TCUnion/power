import os
import sys
from dotenv import load_dotenv
from supabase import create_client, Client
from datetime import datetime, timedelta

# 加入 backend 目錄到 sys.path 以便 import config (如果需要)
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

def get_supabase_config():
    """取得並清理 Supabase 設定"""
    # 嘗試從 backend/.env 載入
    env_path = os.path.join(os.path.dirname(__file__), '..', 'backend', '.env')
    if os.path.exists(env_path):
        load_dotenv(env_path)
        print(f"Loaded .env from {env_path}")
    else:
        # 嘗試從 web/.env 載入
        env_path = os.path.join(os.path.dirname(__file__), '..', 'web', '.env')
        if os.path.exists(env_path):
             load_dotenv(env_path)
             print(f"Loaded .env from {env_path}")

    url = (os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL", "")).strip().strip('"').strip("'").rstrip('/')
    
    key = ""
    for k in ["SUPABASE_SERVICE_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_KEY", "VITE_SUPABASE_SERVICE_ROLE_KEY", "VITE_SUPABASE_ANON_KEY"]:
        val = (os.environ.get(k) or "").strip().strip('"').strip("'")
        if val:
            key = val
            break
            
    return url, key

def check_db_status():
    url, key = get_supabase_config()
    if not url or not key:
        print("Error: Missing Supabase URL or Key")
        return

    print(f"Connecting to Supabase: {url}")
    supabase: Client = create_client(url, key)

    # 1. Check Binding
    print("\n--- Checking Strava Bindings ---")
    try:
        bindings = supabase.table("strava_member_bindings").select("*").execute()
        print(f"Total bindings found: {len(bindings.data)}")
        
        if not bindings.data:
            print("No bindings found. Cannot proceed with tests.")
            return

        found_valid_user = False
        ninety_days_ago = (datetime.now() - timedelta(days=90)).isoformat()

        for binding in bindings.data:
            athlete_id = binding.get('strava_id')
            user_id = binding.get('user_id')
            member_name = binding.get('member_name')
            
            if not user_id:
                print(f" (Skipping: No user_id bound)")
                continue

            print(f"Checking updates for {member_name} ({athlete_id})...", end="", flush=True)

            try:
                activities = supabase.table("strava_activities") \
                    .select("id") \
                    .eq("athlete_id", athlete_id) \
                    .gte("start_date_local", ninety_days_ago) \
                    .limit(1) \
                    .execute()
                
                if activities.data and len(activities.data) > 0:
                    print(f" FOUND {len(activities.data)} recent activities.")
                    print(f"\nSUCCESS: Data available for testing.")
                    print(f"Recommended Test User ID: {user_id}")
                    found_valid_user = True
                    break
                else:
                    print(" No recent activities.")
            except Exception as e:
                print(f" Error: {e}")

        if not found_valid_user:
            print("\nWarning: No recent activities found for any bound user.")

    except Exception as e:
        print(f"Error checking bindings: {e}")
        return

if __name__ == "__main__":
    check_db_status()
