import os
import sys
import uuid
from dotenv import load_dotenv
from supabase import create_client, Client

# Add user_id to a specific athlete binding for testing purposes

def get_supabase_config():
    env_path = os.path.join(os.path.dirname(__file__), '..', 'backend', '.env')
    if os.path.exists(env_path):
        load_dotenv(env_path)
    else:
        env_path = os.path.join(os.path.dirname(__file__), '..', 'web', '.env')
        if os.path.exists(env_path):
             load_dotenv(env_path)

    url = (os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL", "")).strip().strip('"').strip("'").rstrip('/')
    
    key = ""
    for k in ["SUPABASE_SERVICE_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_KEY", "VITE_SUPABASE_SERVICE_ROLE_KEY", "VITE_SUPABASE_ANON_KEY"]:
        val = (os.environ.get(k) or "").strip().strip('"').strip("'")
        if val:
            key = val
            break
            
    return url, key

def setup_test_user():
    url, key = get_supabase_config()
    if not url or not key:
        print("Error: Missing Supabase URL or Key")
        return

    print(f"Connecting to Supabase: {url}")
    supabase: Client = create_client(url, key)

    target_strava_id = "16062142" # The user we found with activities
    test_user_id = str(uuid.uuid4())

    print(f"Attempting to update binding for Strava ID {target_strava_id} with Test User ID: {test_user_id}")

    try:
        # Check if binding exists
        res = supabase.table("strava_member_bindings").select("*").eq("strava_id", target_strava_id).execute()
        if not res.data:
            print(f"Error: Binding for {target_strava_id} not found.")
            return

        print(f"Current Binding: {res.data[0]}")

        # Update
        update_res = supabase.table("strava_member_bindings") \
            .update({"user_id": test_user_id}) \
            .eq("strava_id", target_strava_id) \
            .execute()

        print(f"Update Result: {update_res.data}")
        
        if update_res.data and update_res.data[0].get('user_id') == test_user_id:
            print("\nSUCCESS: Test user setup complete.")
            print(f"Use this User ID for testing: {test_user_id}")
        else:
             print("Error: Update failed or returned unexpected data.")

    except Exception as e:
        print(f"Error setting up test user: {e}")

if __name__ == "__main__":
    setup_test_user()
