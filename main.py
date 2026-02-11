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

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

@app.get("/")
def read_root():
    logger.info("Root endpoint called")
    return {"status": "online", "message": "TCU Power API is running v1.3"}

@app.get("/health")
def health_check():
    return {"status": "ok"}

from datetime import datetime

@app.get("/check-binding")
@app.get("/api/auth/binding-status/{athlete_id}")
async def get_binding_status(athlete_id: int):
    logger.info(f"Checking binding status for athlete: {athlete_id}")
    
    try:
        url: str = os.environ.get("SUPABASE_URL")
        key: str = os.environ.get("SUPABASE_SERVICE_KEY") or \
                   os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or \
                   os.environ.get("SUPABASE_KEY")
        
        if not url or not key:
            url = url or os.environ.get("VITE_SUPABASE_URL")
            key = key or os.environ.get("VITE_SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("VITE_SUPABASE_ANON_KEY")

        if not url or not key:
            available_keys = [k for k in os.environ.keys() if "SUPABASE" in k]
            logger.error(f"Missing Supabase credentials (v1.3). Available keys: {available_keys}")
            
            return {
                "isBound": False,
                "member_data": None,
                "strava_name": "",
                "error": "Configuration error: Missing SUPABASE_URL or KEY"
            }
            
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
    logger.info(f"Confirming binding for athlete {req.stravaId}")
    
    try:
        url: str = os.environ.get("SUPABASE_URL")
        key: str = os.environ.get("SUPABASE_SERVICE_KEY") or \
                   os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or \
                   os.environ.get("SUPABASE_KEY")
        
        if not url or not key:
            # 嘗試讀取 VITE_ 開頭的變數（前端環境變數）
            url = url or os.environ.get("VITE_SUPABASE_URL")
            key = key or os.environ.get("VITE_SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("VITE_SUPABASE_ANON_KEY")
            
            available_keys = [k for k in os.environ.keys() if "SUPABASE" in k]
            logger.error(f"Missing Supabase credentials in confirm_binding. Available: {available_keys}")
            raise HTTPException(status_code=500, detail="Missing Supabase credentials")
            
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
