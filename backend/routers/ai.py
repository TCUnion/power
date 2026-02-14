
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

from services.ai_coach import AICoachService
from config import get_supabase_config
from supabase import create_client

router = APIRouter(prefix="/api/ai", tags=["ai"])

class DailySummaryRequest(BaseModel):
    user_id: str
    date: str # YYYY-MM-DD

def get_ai_service():
    url, key = get_supabase_config()
    if not url or not key:
        raise HTTPException(status_code=500, detail="Supabase config missing")
    supabase = create_client(url, key)
    return AICoachService(supabase)

@router.post("/summary")
async def generate_summary(req: DailySummaryRequest, service: AICoachService = Depends(get_ai_service)):
    result = await service.generate_daily_summary(req.user_id, req.date)

    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result

class ChatRequest(BaseModel):
    user_id: str
    message: str

@router.post("/chat")
def chat_with_data(req: ChatRequest, service: AICoachService = Depends(get_ai_service)):
    # 使用新的 chat_with_coach 方法 (含用量檢查與 N8N 整合)
    result = service.chat_with_coach(req.user_id, req.message)
    
    if "error" in result and "answer" not in result: 
        # 只有在完全無法回答時才拋出 500
        # 如果是 "Usage limit exceeded"，會在 result 中包含 answer (提示訊息)，不拋錯
        raise HTTPException(status_code=500, detail=result["error"])
        
    return result

@router.get("/usage/{user_id}")
def get_usage(user_id: str, service: AICoachService = Depends(get_ai_service)):
    result = service.get_daily_usage(user_id)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result

@router.get("/history/{user_id}")
async def get_chat_history(user_id: str, limit: int = 5, service: AICoachService = Depends(get_ai_service)):
    return await service.get_chat_history(user_id, limit)
