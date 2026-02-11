
import os
import logging
from dotenv import load_dotenv

# 設定日誌
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("tcu-power-api")

# 嘗試載入環境變數
load_dotenv()
env_paths = [
    "web/.env",
    "../web/.env",
    os.path.join(os.path.dirname(__file__), "..", "web", ".env"),
    os.path.join(os.path.dirname(__file__), ".env")
]
for p in env_paths:
    if os.path.exists(p):
        load_dotenv(p)
        logger.info(f"Loaded environment variables from {p}")

def get_supabase_config():
    """取得並清理 Supabase 設定，確保沒有多餘空格、引號或結尾斜線"""
    url = (os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL", "")).strip().strip('"').strip("'").rstrip('/')
    
    # 優先順序：SERVICE_KEY > SERVICE_ROLE_KEY > KEY > VITE_ 分身
    key = ""
    key_source = "None"
    for k in ["SUPABASE_SERVICE_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_KEY", "VITE_SUPABASE_SERVICE_ROLE_KEY", "VITE_SUPABASE_ANON_KEY"]:
        val = (os.environ.get(k) or "").strip().strip('"').strip("'")
        if val:
            key = val
            key_source = k
            break
            
    if not url or not key:
        available = [k for k in os.environ.keys() if "SUPABASE" in k]
        logger.error(f"Missing config. URL: {url}, Key source: {key_source}. Available: {available}")
    else:
        # 安全診斷：記錄長度與前後字元以供核對
        masked_key = f"{key[:4]}...{key[-4:]}" if len(key) > 8 else "too_short"
        logger.info(f"Supabase v1.5.1 Loaded. Source: {key_source}, Len: {len(key)}, Masked: {masked_key}")
        
    return url, key
