import os
import logging
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List

# 設定日誌
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("tcu-power-api")

app = FastAPI(title="TCU Power API")

# 設定更寬容的 CORS 以解決目前的攔截問題
# 注意：如果要使用 allow_credentials=True，則 allow_origins 不能為 ["*"]
# 暫時先改為最寬鬆模式以驗證通訊是否正常
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
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
    return {"status": "online", "message": "TCU Power API is running v1.1"}

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/check-binding")
@app.get("/api/auth/binding-status/{athlete_id}")
async def get_binding_status(athlete_id: int):
    logger.info(f"Checking binding status for athlete: {athlete_id}")
    # 這裡先回傳模擬資料，讓前端可以正常工作
    return {
        "isBound": False,
        "member_data": None,
        "strava_name": ""
    }

@app.post("/api/auth/strava-token")
async def sync_strava_token(token: StravaToken):
    logger.info(f"Syncing token for athlete {token.athlete_id}")
    return {"status": "success", "message": "Token synced"}

@app.post("/api/auth/member-binding")
async def member_binding(req: BindingRequest):
    logger.info(f"Member binding request: {req.email} action: {req.action}")
    if req.action == "generate_otp":
        return {"success": True, "message": "已發送驗證碼（模擬）"}
    return {"success": False, "message": "無效的動作"}

@app.post("/api/auth/confirm-binding")
async def confirm_binding(req: ConfirmBindingRequest):
    logger.info(f"Confirming binding for athlete {req.stravaId}")
    return {
        "success": True, 
        "message": "綁定成功",
        "member_data": {
            "real_name": req.member_name,
            "email": req.email,
            "tcu_id": req.tcu_account
        }
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
