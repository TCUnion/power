# n8n 工作流修改指引

## 一、每日摘要工作流 (TCU-Strava-AI教練-每日摘要)

### 新增節點 A：「查詢可用廣告」(Postgres)
**位置**：「計算當日指標」→ **這裡** → 「AI 日誌摘要」

```sql
SELECT id, brand_name, product_name, product_url, description, placement_text
FROM ad_placements
WHERE is_active = true
  AND (start_date IS NULL OR start_date <= CURRENT_DATE)
  AND (end_date IS NULL OR end_date >= CURRENT_DATE)
  AND (max_impressions IS NULL OR current_impressions < max_impressions)
ORDER BY priority ASC
LIMIT 3;
```

### 修改節點：「AI 日誌摘要」Prompt
在 User Message 末尾加上：
```
可用的推薦商品（僅在高度相關時才推薦 1 個）：
{{ $('查詢可用廣告').first().json ? JSON.stringify($('查詢可用廣告').all().map(i => i.json)) : '無' }}
```

### 修改節點：「AI 日誌摘要」System Message
末尾加上：
```
## 廣告置入指引
如果提供的推薦商品與訓練建議高度相關，可在回覆末尾用以下格式自然推薦 1 個商品：
💡 推薦好物：[商品名稱]
[一句話推薦理由]
👉 [商品連結]

規則：只在直接相關時推薦，不可強行置入。沒有相關商品就不推薦。
```

### 新增節點 B：「儲存日誌到 Supabase」(Postgres)
**位置**：「格式化摘要回應」→ **這裡** → 「回傳摘要結果」

```sql
INSERT INTO ai_coach_logs (athlete_id, type, ai_response, context_data)
VALUES (
  {{ $('接收摘要請求').first().json.body.athlete_id }}::bigint,
  'summary',
  '{{ $json.summary.replace(/'/g, "''") }}',
  '{{ JSON.stringify($('計算當日指標').first().json.metrics).replace(/'/g, "''") }}'::jsonb
);
```

---

## 二、功率教練工作流 (TCU-Strava-AI教練-端對端測試)

### 新增節點 A：「查詢歷史對話」(Postgres)
**位置**：「彙整活動摘要」→ **這裡** → 「查詢可用廣告」

```sql
SELECT type, user_message, ai_response, created_at
FROM ai_coach_logs
WHERE athlete_id = {{ $('接收測試請求').first().json.body.athlete_id }}::bigint
ORDER BY created_at DESC
LIMIT 5;
```

### 新增節點 B：「查詢可用廣告」(Postgres)
**位置**：「查詢歷史對話」→ **這裡** → 「AI Agent」

（SQL 同上）

### 修改節點：「AI Agent」Prompt
末尾加上：
```
📝 過去對話紀錄（最近 5 筆）：
{{ $('查詢歷史對話').first().json ? JSON.stringify($('查詢歷史對話').all().map(i => i.json), null, 2) : '無歷史紀錄' }}

可用的推薦商品（僅在高度相關時才推薦 1 個）：
{{ $('查詢可用廣告').first().json ? JSON.stringify($('查詢可用廣告').all().map(i => i.json)) : '無' }}
```

### 修改節點：「AI Agent」System Message
末尾加上（同每日摘要的廣告置入指引）

### 新增節點 C：「儲存對話到 Supabase」(Postgres)
**位置**：「格式化回應」→ **這裡** → 「回傳分析結果」

```sql
INSERT INTO ai_coach_logs (athlete_id, type, user_message, ai_response)
VALUES (
  {{ $('接收測試請求').first().json.body.athlete_id }}::bigint,
  'chat',
  '{{ $('接收測試請求').first().json.body.message.replace(/'/g, "''") }}',
  '{{ $json.answer.replace(/'/g, "''") }}'
);
```

---

## 三、節點連線總覽

### 每日摘要（修改後）
```
接收摘要請求 → 查詢當日活動 → 計算當日指標 → 查詢可用廣告 → AI 日誌摘要 → 格式化摘要回應 → 儲存日誌到 Supabase → 回傳摘要結果
```

### 功率教練（修改後）
```
接收測試請求 → 查詢全部歷史活動 → 彙整活動摘要 → 查詢歷史對話 → 查詢可用廣告 → AI Agent → 格式化回應 → 儲存對話到 Supabase → 回傳分析結果
```
