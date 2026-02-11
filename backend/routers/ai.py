
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
