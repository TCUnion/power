
import os
import asyncio
from supabase import create_client, Client

async def check_binding():
    url = "https://db.criterium.tw"
    service_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UtZGVtbyIsImlhdCI6MTc2OTY2NDAzNSwiZXhwIjoyMDg1MDI0MDM1fQ.3hvPiCwA4m3okxVm7_6YVhNolMNeeMk7uoVoudKixfs"
    
    supabase = create_client(url, service_key)
    target_id = "2838277"
    
    print(f"--- 查詢 Strava ID: {target_id} ---")
    
    # Check binding
    res = supabase.table("strava_member_bindings").select("*").eq("strava_id", target_id).execute()
    print(f"Binding 筆數: {len(res.data)}")
    if res.data:
        print(f"Binding 資料: {res.data[0]}")
        
    # Check tcu_members if bound
    if res.data:
        tcu_account = res.data[0].get('tcu_account')
        print(f"查詢 TCU Account: {tcu_account}")
        member_res = supabase.table("tcu_members").select("*").eq("account", tcu_account).execute()
        if member_res.data:
            print(f"Member 資料找到: {member_res.data[0]['real_name']}")
        else:
            print("Member 資料未找到")

if __name__ == "__main__":
    asyncio.run(check_binding())
