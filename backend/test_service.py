import asyncio
import os
from supabase import create_client, Client
from config import get_supabase_config
from services.ai_coach import AICoachService

# Mock environment if needed
# os.environ["OPENAI_API_KEY"] = "..." 

async def test_service():
    url, key = get_supabase_config()
    print(f"Connecting to {url}...")
    supabase: Client = create_client(url, key)
    
    # 1. Find a valid user
    print("Finding a valid user...")
    res = supabase.table("strava_member_bindings").select("strava_id, user_id").limit(1).execute()
    if not res.data:
        print("No bound users found. Cannot test.")
        return

    user = res.data[0]
    strava_id = user['strava_id']
    user_id = user['user_id']
    print(f"Testing with Strava ID: {strava_id}")
    
    service = AICoachService(supabase)
    
    print("Calling chat_with_coach...")
    try:
        # Use a dummy message
        result = await service.chat_with_coach(strava_id, "Test message from CLI")
        print("Result:", result)
    except Exception as e:
        print(f"Service call failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_service())
