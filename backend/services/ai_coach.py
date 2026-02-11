
import os
import json
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from openai import OpenAI
from supabase import Client

class AICoachService:
    def __init__(self, supabase: Client):
        self.supabase = supabase
        self.api_key = os.getenv("OPENAI_API_KEY")
        self.client = OpenAI(api_key=self.api_key) if self.api_key else None

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

        # 2. 呼叫 LLM
        prompt = f"""
        你是一位專業的自行車教練。請根據這位運動員今天的數據，用繁體中文寫一段簡短的訓練日誌摘要與建議。
        
        日期: {date_str}
        總時間: {metrics['total_time_min']} 分鐘
        總距離: {metrics['total_distance_km']} 公里
        活動:
        {chr(10).join(activity_summaries)}
        
        請包含：
        1. 訓練量評估
        2. 對明天的建議
        語氣：專業、鼓勵、簡潔。
        """

        try:
            response = self.client.chat.completions.create(
                model="gpt-4o", # 或 gpt-3.5-turbo
                messages=[
                    {"role": "system", "content": "You are a professional cycling coach."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=300
            )
            summary = response.choices[0].message.content
        except Exception as e:
            return {"error": f"LLM generation failed: {str(e)}"}

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
