import os
import logging
from dotenv import load_dotenv

# 設定日誌
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("tcu-power-api")

# 嘗試載入環境變數（支援多種路徑）
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

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from supabase import create_client, Client



app = FastAPI(title="TCU Power API")

# 設定 CORS
origins = [
    "http://localhost:5173",
    "https://stravapower.zeabur.app",
    "https://www.criterium.tw",
    "https://strava.criterium.tw",
    "https://power.criterium.tw"
]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_origin_regex=r"https://.*\.criterium\.tw", allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

class StravaToken(BaseModel):
    athlete_id: int
    access_token: str
    refresh_token: str
    expires_at: int
    name: Optional[str] = None
    user_id: Optional[str] = None

class BindingRequest(BaseModel):
    email: str
    memberName: str
    stravaId: int
    input_id: str
    action: str

class ConfirmBindingRequest(BaseModel):
    email: str
    stravaId: int
    tcu_account: str
    member_name: str
    user_id: Optional[str] = None

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

@app.get("/")
def read_root():
    logger.info("Root endpoint called v1.6")
    return {"status": "online", "message": "TCU Power API is running v1.6"}

@app.get("/health")
def health_check():
    url, key = get_supabase_config()
    return {
        "status": "ok", 
        "version": "1.6",
        "config_check": {
            "has_url": bool(url),
            "url_clean": url,
            "has_key": bool(key),
            "key_length": len(key) if key else 0,
            "key_masked": f"{key[:4]}...{key[-4:]}" if key and len(key) > 8 else "N/A"
        }
    }

from datetime import datetime

@app.get("/check-binding")
@app.get("/api/auth/binding-status/{athlete_id}")
async def get_binding_status(athlete_id: int):
    logger.info(f"Checking binding status for athlete: {athlete_id}")
    
    try:
        url, key = get_supabase_config()
        
        if not url or not key:
            raise HTTPException(status_code=500, detail="Configuration error: Missing SUPABASE_URL or KEY (v1.5.2)")
            
        supabase: Client = create_client(url, key)
        
        binding_res = supabase.table("strava_member_bindings") \
            .select("*") \
            .eq("strava_id", str(athlete_id)) \
            .execute()
            
        if not binding_res.data or len(binding_res.data) == 0:
            return {
                "isBound": False,
                "member_data": None,
                "strava_name": ""
            }
        
        binding = binding_res.data[0]
        tcu_account = binding.get("tcu_account")
        tcu_member_email = binding.get("tcu_member_email")
        
        member_res = None
        if tcu_account:
            member_res = supabase.table("tcu_members") \
                .select("*") \
                .eq("account", tcu_account) \
                .execute()
        
        if (not member_res or not member_res.data) and tcu_member_email:
            member_res = supabase.table("tcu_members") \
                .select("*") \
                .eq("email", tcu_member_email) \
                .execute()
                
        if member_res and member_res.data and len(member_res.data) > 0:
            member = member_res.data[0]
            return {
                "isBound": True,
                "member_data": member,
                "strava_name": binding.get("member_name", "")
            }
        
        return {
            "isBound": True,
            "member_data": None,
            "strava_name": binding.get("member_name", "")
        }
            
    except Exception as e:
        logger.error(f"Error checking binding status: {str(e)}")
        return {
            "isBound": False,
            "member_data": None,
            "strava_name": "",
            "error": str(e)
        }

@app.post("/api/auth/strava-token")
async def sync_strava_token(token: StravaToken):
    return {"status": "success", "message": "Token synced"}

@app.post("/api/auth/member-binding")
async def member_binding(req: BindingRequest):
    if req.action == "generate_otp":
        return {"success": True, "message": "已發送驗證碼（模擬）"}
    return {"success": False, "message": "無效的動作"}

@app.post("/api/auth/confirm-binding")
async def confirm_binding(req: ConfirmBindingRequest):
    logger.info(f"Confirming binding for athlete {req.stravaId} v1.4")
    
    try:
        url, key = get_supabase_config()
        
        if not url or not key:
            raise HTTPException(status_code=500, detail="Missing Supabase credentials (v1.4)")
            
        supabase: Client = create_client(url, key)
        
        binding_data = {
            "strava_id": str(req.stravaId),
            "member_name": req.member_name,
            "tcu_member_email": req.email,
            "tcu_account": req.tcu_account,
            "updated_at": datetime.now().isoformat(),
            "bound_at": datetime.now().isoformat(),
            "user_id": req.user_id
        }
        
        res = supabase.table("strava_member_bindings").upsert(binding_data).execute()
        
        if len(res.data) > 0:
            return {
                "success": True, 
                "message": "綁定成功",
                "member_data": {
                    "real_name": req.member_name,
                    "email": req.email,
                    "tcu_id": req.tcu_account,
                    "account": req.tcu_account
                }
            }
        else:
            return {"success": False, "message": "資料庫寫入失敗"}
            
    except Exception as e:
        logger.error(f"Error in confirm_binding: {str(e)}")
        return {"success": False, "message": f"綁定過程發生錯誤: {str(e)}"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT") or 8000)
    uvicorn.run(app, host="0.0.0.0", port=port)
