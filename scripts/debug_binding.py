import os
import asyncio
import json
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv(dotenv_path='../web/.env')

async def main():
    url: str = os.environ.get("SUPABASE_URL")
    # Use ANON key to simulate frontend
    key: str = os.environ.get("VITE_SUPABASE_ANON_KEY") or os.environ.get("SUPABASE_ANON_KEY")
    
    if not url or not key:
        print("Error: Supabase ANON credentials not found.")
        return

    print(f"Using Key (start): {key[:5]}...")
    supabase: Client = create_client(url, key)

    print("\n--- Testing Select from tcu_members with ANON Key ---")
    tcu_id_to_check = "O101167295" # Example from previous output
    try:
        res = supabase.table("tcu_members").select("*").or_(f"account.eq.{tcu_id_to_check},tcu_id.eq.{tcu_id_to_check}").execute()
        
        if res.data:
            print(f"Success! Found member: {res.data[0].get('real_name')}")
        else:
            print("Failed: No data returned (RLS likely blocking)")
            
    except Exception as e:
        print(f"Error querying tcu_members: {e}")

if __name__ == "__main__":
    asyncio.run(main())
