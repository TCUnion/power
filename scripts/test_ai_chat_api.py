import requests
import json
import sys
import os
from dotenv import load_dotenv

def get_base_url():
    # 預設為 localhost:8000，或從環境變數讀取
    return os.environ.get("API_BASE_URL", "http://localhost:8000")

def test_ai_chat(user_id):
    base_url = get_base_url()
    endpoint = f"{base_url}/api/ai/chat"
    
    print(f"Testing API endpoint: {endpoint}")
    print(f"User ID: {user_id}")
    
    payload = {
        "user_id": user_id,
        "message": "請分析我上週的騎乘表現，並給我一些改進建議。"
    }
    
    try:
        response = requests.post(endpoint, json=payload)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if "answer" in data:
                print("\n--- AI Response ---")
                print(data["answer"])
                print("\n--- Test PASSED ---")
                return True
            else:
                print("Error: Response missing 'answer' field")
                print(data)
                return False
        else:
            print(f"Error: API returned status {response.status_code}")
            print(response.text)
            return False
            
    except requests.exceptions.ConnectionError:
        print("Error: Could not connect to API server. Is it running?")
        return False
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scripts/test_ai_chat_api.py <user_id>")
        # 如果沒有提供 user_id，嘗試從 check_db_status 的輸出中獲取 (這裡簡化，直接提示)
        print("Please provide a valid user_id found from check_db_status.py")
        sys.exit(1)
        
    user_id = sys.argv[1]
    
    # 載入 .env 以確保有正確的 API URL (如果需要)
    load_dotenv("backend/.env")
    
    test_ai_chat(user_id)
