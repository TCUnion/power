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
        print("Error: Supabase credentials not found.")
        return

    supabase: Client = create_client(url, key)
    
    target_id = "O101167295"
    print(f"Inspecting member data for: {target_id}")

    # Inspect the member table directly
    res = supabase.table("tcu_members") \
        .select("*") \
        .or_(f"account.eq.{target_id},tcu_id.eq.{target_id}") \
        .execute()
    
    if res.data:
        for idx, row in enumerate(res.data):
            print(f"Row {idx}:")
            print(f"  account: '{row.get('account')}'")
            print(f"  tcu_id: '{row.get('tcu_id')}'")
            print(f"  real_name: '{row.get('real_name')}'")
    else:
        print("No member data found!")

if __name__ == "__main__":
    asyncio.run(main())
