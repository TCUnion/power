
from fastapi import APIRouter, HTTPException, Depends, Body
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from supabase import create_client, Client
from config import get_supabase_config

router = APIRouter(prefix="/api/settings", tags=["settings"])

class SystemSetting(BaseModel):
    key: str
    value: str
    description: Optional[str] = None

class BatchUpdateSettingsRequest(BaseModel):
    settings: List[SystemSetting]

def get_supabase() -> Client:
    url, key = get_supabase_config()
    if not url or not key:
        raise HTTPException(status_code=500, detail="Supabase config missing")
    return create_client(url, key)

@router.get("", response_model=List[SystemSetting])
async def get_settings(supabase: Client = Depends(get_supabase)):
    try:
        # 允許 authenticated 用戶讀取
        res = supabase.table("system_settings").select("*").execute()
        return res.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch settings: {str(e)}")

@router.post("", response_model=List[SystemSetting])
async def update_settings(req: BatchUpdateSettingsRequest, supabase: Client = Depends(get_supabase)):
    """
    批次更新設定 (需 Admin 權限，由 RLS 或 Middleware 控制)
    這裡簡單實作，RLS 會擋下非 Admin 的寫入
    """
    try:
        results = []
        for setting in req.settings:
            # Upsert
            data = {
                "key": setting.key,
                "value": setting.value,
                "updated_at": "now()"
            }
            if setting.description:
                data["description"] = setting.description
                
            res = supabase.table("system_settings").upsert(data).execute()
            if res.data:
                results.append(res.data[0])
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update settings: {str(e)}")
