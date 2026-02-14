import os
import asyncio
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv(dotenv_path='../web/.env')

async def main():
    url: str = os.environ.get("SUPABASE_URL")
    key: str = os.environ.get("VITE_SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        print("Error: Supabase credentials not found in environment variables.")
        return

    supabase: Client = create_client(url, key)

    print("--- Checking System Settings ---")
    try:
        settings_res = supabase.table("system_settings").select("*").execute()
        print(f"Raw settings: {settings_res.data}")
        db_settings = {item['key']: int(item['value']) for item in settings_res.data if item['value'].isdigit()}
        print(f"Parsed settings: {db_settings}")
    except Exception as e:
        print(f"Error fetching settings: {e}")

    print("\n--- Checking Usage Logic Simulation ---")
    # Simulate logic from ai_coach.py
    default_limits = {"guest": 1, "basic": 2, "premium": 4}
    limits = {
        "guest": db_settings.get("ai_limit_guest", default_limits["guest"]),
        "basic": db_settings.get("ai_limit_basic", default_limits["basic"]),
        "premium": db_settings.get("ai_limit_premium", default_limits["premium"]),
        "admin": 9999
    }
    print(f"Calculated Limits: {limits}")

if __name__ == "__main__":
    asyncio.run(main())
