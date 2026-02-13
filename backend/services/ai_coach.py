
import os
import json
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import os
import json
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from supabase import Client

class AICoachService:
    def __init__(self, supabase: Client):
        self.supabase = supabase
        # OpenAI Client removed in favor of N8N
        self.client = None

    async def generate_daily_summary(self, user_id: str, date_str: str) -> Dict[str, Any]:
        """
        生成指定日期的訓練日誌摘要
        1. 聚合該日期的騎乘數據 (TSS, IF, 時間, 距離)
        2. 呼叫 LLM 生成摘要
        3. 寫入 ai_training_logs
        """
        if not self.client:
            return {"error": "OpenAI API Key not configured"}

        # 1. 獲取當日騎乘數據 (從 strava_activities?)
        # 假設 strava_activities 有 user_id 關聯 (透過 strava_member_bindings)
        # 先找到 strava_id
        binding = self.supabase.table("strava_member_bindings").select("strava_id").eq("user_id", user_id).execute()
        if not binding.data:
            return {"error": "User not bound to Strava"}
        
        strava_id = binding.data[0]['strava_id']
        
        # 查詢當日活動
        # TODO: 資料庫欄位名稱需確認，這裡假設是 start_date_local
        start_date = datetime.strptime(date_str, "%Y-%m-%d")
        end_date = start_date + timedelta(days=1)
        
        activities = self.supabase.table("strava_activities").select("*") \
            .eq("athlete_id", strava_id) \
            .gte("start_date_local", start_date.isoformat()) \
            .lt("start_date_local", end_date.isoformat()) \
            .execute()

        if not activities.data:
            return {"message": "No activities found for this date", "summary": "今日無騎乘紀錄，休息是為了走更長遠的路。"}

        # 聚合數據
        total_time = 0
        total_dist = 0
        total_tss = 0
        max_if = 0
        activity_summaries = []

        for act in activities.data:
            # 假設欄位存在，需根據實際 schema 調整
            moving_time = act.get('moving_time', 0)
            distance = act.get('distance', 0)
            # TSS/IF 可能在詳細欄位或其他表，這裡先假設
            # 如果沒有這些欄位，需要計算或忽略
            name = act.get('name', 'Unknown Ride')
            
            total_time += moving_time
            total_dist += distance
            
            activity_summaries.append(f"- {name}: {moving_time/60:.0f}min, {(distance/1000):.1f}km")

        metrics = {
            "total_time_min": total_time // 60,
            "total_distance_km": round(total_dist / 1000, 1),
            "activities_count": len(activities.data),
            "details": activity_summaries
        }

        # 2. 呼叫 LLM (Deprecated in backend, use N8N Webhook)
        summary = "請使用 N8N Webhook 生成摘要"
        # The following code is disabled as we no longer use OpenAI client directly
        """
        prompt = f'''...'''
        try:
            response = self.client.chat.completions.create(...)
            summary = response.choices[0].message.content
        except Exception as e:
            return {"error": f"LLM generation failed: {str(e)}"}
        """

        # 3. 寫入資料庫
        log_entry = {
            "user_id": user_id,
            "date": date_str,
            "summary": summary,
            "metrics": metrics,
            "created_at": datetime.now().isoformat()
        }
        
        # Upsert
        try:
            self.supabase.table("ai_training_logs").upsert(log_entry).execute()
        except Exception as e:
            # Log error but return summary
            print(f"Failed to save log: {e}")


        return {"summary": summary, "metrics": metrics}

    async def chat_with_coach(self, user_id: str, message: str) -> Dict[str, Any]:
        """
        AI 教練對話介面 (取代舊的 query_data)
        1. 檢查會員等級與今日用量
        2. 呼叫 N8N Webhook 進行處理 (或直接使用 LangChain)
        3. 記錄對話 Log
        """
        
        # 1. 獲取 strava_id 與會員資料
        # 前端傳入的 user_id 在這裡是 Strava ID (字串)
        strava_id = user_id 
        
        binding = self.supabase.table("strava_member_bindings").select("strava_id, tcu_account").eq("strava_id", strava_id).execute()
        
        if not binding.data:
            return {"error": "User not bound to Strava (No binding found for Strava ID)"}
        
        tcu_account = binding.data[0].get('tcu_account')
        athlete_id = int(strava_id)

        # 2. 檢查會員等級
        member_type = "guest"
        if tcu_account:
            try:
                member_res = self.supabase.table("tcu_members").select("member_type").eq("account", tcu_account).execute()
                if member_res.data:
                    raw_type = member_res.data[0].get("member_type")
                    member_type = raw_type.lower() if raw_type else "guest"
            except Exception as e:
                print(f"Error checking member type: {e}")

        # 定義預設限制
        default_limits = {
            "guest": 5, 
            "basic": 10,
            "premium": 50
        }
        
        # 從資料庫讀取設定
        try:
            settings_res = self.supabase.table("system_settings").select("*").execute()
            db_settings = {item['key']: int(item['value']) for item in settings_res.data if item['value'].isdigit()}
        except Exception as e:
            print(f"Error fetching system settings: {e}")
            db_settings = {}
            
        # 合併設定 (DB 優先)
        limits = {
            "guest": db_settings.get("ai_limit_guest", default_limits["guest"]),
            "basic": db_settings.get("ai_limit_basic", default_limits["basic"]),
            "premium": db_settings.get("ai_limit_premium", default_limits["premium"]),
            "admin": 9999
        }
        
        # Admin 特權
        daily_limit = limits.get(member_type, 5)
        if "admin" in member_type.lower():
            daily_limit = 9999

        # 3. 檢查今日用量
        today = datetime.now().strftime("%Y-%m-%d")
        start_of_day = f"{today}T00:00:00"
        end_of_day = f"{today}T23:59:59"

        try:
            logs = self.supabase.table("ai_coach_logs") \
                .select("id", count="exact") \
                .eq("athlete_id", athlete_id) \
                .eq("type", "chat") \
                .gte("created_at", start_of_day) \
                .lte("created_at", end_of_day) \
                .execute()
            
            usage_count = logs.count if logs.count is not None else 0
            
            if usage_count >= daily_limit:
                return {
                    "error": "Usage limit exceeded", 
                    "answer": f"今日額度已達上限 ({usage_count}/{daily_limit})。請明天再來，或升級會員以獲取更多額度。",
                    "limit_reached": True
                }
                
        except Exception as e:
            print(f"Error checking usage logs: {e}")
            # 若檢查失敗，暫時允許通過，避免服務中斷
            pass

        # 4. 呼叫 N8N Webhook 進行 AI 處理
        # 這裡將請求轉發給 N8N，保持原有的 AI 邏輯
        import httpx
        N8N_WEBHOOK_URL = "https://service.criterium.tw/webhook/ai-coach-test"
        
        ai_reply = "系統忙碌中，請稍後再試。"
        context_data = {}
        
        try:
            async with httpx.AsyncClient() as client:
                n8n_response = await client.post(
                    N8N_WEBHOOK_URL,
                    json={"athlete_id": athlete_id, "message": message},
                    timeout=60.0 # AI 處理可能需要較長時間
                )
                
                if n8n_response.status_code == 200:
                    n8n_data = n8n_response.json()
                    ai_reply = n8n_data.get("answer", ai_reply)
                    context_data = n8n_data.get("context", {})
                else:
                    print(f"N8N Error: {n8n_response.text}")
                    ai_reply = "AI 教練目前休息中 (N8N Error)"
                    
        except Exception as e:
            print(f"N8N Request Failed: {e}")
            ai_reply = "連線逾時，請檢查網路狀況。"

        # 5. 記錄對話 (無論成功失敗都記錄，除非系統錯誤)
        try:
            log_entry = {
                "athlete_id": athlete_id,
                "type": "chat",
                "user_message": message,
                "ai_response": ai_reply,
                "context_data": context_data,
                "created_at": datetime.now().isoformat()
            }
            self.supabase.table("ai_coach_logs").insert(log_entry).execute()
        except Exception as e:
            print(f"Failed to save chat log: {e}")

        return {
            "answer": ai_reply,
            "usage": {
                "current": usage_count + 1,
                "limit": daily_limit
            }
        }
