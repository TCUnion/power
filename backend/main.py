import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

app = FastAPI(title="TCU Power API")

# 設定 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 開發先允許所有
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

@app.get("/")
def read_root():
    return {"status": "online", "message": "TCU Power API is running"}

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.post("/api/auth/strava-token")
async def sync_strava_token(token: StravaToken):
    # TODO: 到資料庫更新 Token
    print(f"Syncing token for athlete {token.athlete_id}")
    return {"status": "success", "message": "Token synced"}

@app.get("/api/auth/binding-status/{athlete_id}")
async def get_binding_status(athlete_id: int):
    # TODO: 查詢資料庫確認是否綁定 TCU 會員
    # 這裡先回傳模擬資料，讓前端可以正常工作
    return {
        "isBound": True,
        "member_data": {
            "name": "測試會員",
            "tcu_id": "TCU-TEST-001"
        },
        "strava_name": "Test Athlete"
    }

if __name__ == "__main__":
    import uvicorn
    # 讓程式碼能讀取 Zeabur 指定的 PORT，否則預設使用 8080
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
