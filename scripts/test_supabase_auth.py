
import os
import asyncio
from supabase import create_client, Client

async def test_connection():
    # 手動填入環境變數以便測試 (從 .env 取得)
    url = "https://db.criterium.tw"
    # 從 .env 中讀取的 ANON KEY
    anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlLWRlbW8iLCJpYXQiOjE3Njk2NjQwMzUsImV4cCI6MjA4NTAyNDAzNX0.S44xQwnUxsfj-dA38njUyabmEfbDERcWdLV76dzp0Uc"
    # 從 .env 中讀取的 SERVICE ROLE KEY
    service_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UtZGVtbyIsImlhdCI6MTc2OTY2NDAzNSwiZXhwIjoyMDg1MDI0MDM1fQ.3hvPiCwA4m3okxVm7_6YVhNolMNeeMk7uoVoudKixfs"
    
    print("--- 測試 ANON KEY ---")
    try:
        supabase_anon = create_client(url, anon_key)
        res = supabase_anon.table("strava_member_bindings").select("*").limit(1).execute()
        print(f"ANON 讀取 strava_member_bindings 成功: {len(res.data)} 筆資料")
    except Exception as e:
        print(f"ANON 讀取 strava_member_bindings 失敗: {e}")

    print("\n--- 測試 SERVICE ROLE KEY ---")
    try:
        supabase_service = create_client(url, service_key)
        res = supabase_service.table("strava_member_bindings").select("*").limit(1).execute()
        print(f"SERVICE 讀取 strava_member_bindings 成功: {len(res.data)} 筆資料")
        if res.data:
            print(f"範例資料: {res.data[0]}")
    except Exception as e:
        print(f"SERVICE 讀取 strava_member_bindings 失敗: {e}")

if __name__ == "__main__":
    asyncio.run(test_connection())
