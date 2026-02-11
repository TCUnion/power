import os
import httpx
from dotenv import load_dotenv

def test_credentials():
    load_dotenv("web/.env")
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    
    print(f"Testing URL: {url}")
    print(f"Key Length: {len(key) if key else 0}")
    
    if not url or not key:
        print("Error: Missing credentials in web/.env")
        return

    # 嘗試讀取一個資料表來驗證
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}"
    }
    
    try:
        # 測試讀取 strava_member_bindings
        test_url = f"{url}/rest/v1/strava_member_bindings?select=count"
        response = httpx.get(test_url, headers=headers)
        
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            print("✅ 憑證有效！")
        else:
            print(f"❌ 憑證無效 (401/403): {response.text}")
            
    except Exception as e:
        print(f"❌ 發生錯誤: {str(e)}")

if __name__ == "__main__":
    test_credentials()
