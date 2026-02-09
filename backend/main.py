import os
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import time

app = FastAPI(title="TCU Power API")

# 明確列出允許的來源以提高穩定性
origins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "https://power.criterium.tw",
    "https://power-bai.pages.dev"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
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
    return {"status": "online", "message": "TCU Power API is running"}

@app.get("/health")
def health_check():
    return {"status": "ok"}

# 兼容舊版可能呼叫的 check-binding 端點
@app.get("/check-binding")
@app.get("/api/auth/binding-status/{athlete_id}")
async def get_binding_status(athlete_id: int):
    # TODO: 查詢資料庫確認是否綁定 TCU 會員
    # 這裡先回傳模擬資料，讓前端可以正常工作
    return {
        "isBound": False,  # 先回傳 False 讓使用者可以測試綁定流程
        "member_data": None,
        "strava_name": "Test User"
    }

@app.post("/api/auth/strava-token")
async def sync_strava_token(token: StravaToken):
    # TODO: 到資料庫更新 Token
    print(f"Syncing token for athlete {token.athlete_id}")
    return {"status": "success", "message": "Token synced"}

@app.post("/api/auth/member-binding")
async def member_binding(req: BindingRequest):
    if req.action == "generate_otp":
        # TODO: 真正實作時發送郵件並寫入資料庫
        print(f"Generating OTP for {req.email}")
        return {"success": True, "message": "已發送驗證碼（模擬）"}
    return {"success": False, "message": "無效的動作"}

@app.post("/api/auth/confirm-binding")
async def confirm_binding(req: ConfirmBindingRequest):
    # TODO: 驗證並寫入綁定表
    print(f"Confirming binding for athlete {req.stravaId} and member {req.email}")
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
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
