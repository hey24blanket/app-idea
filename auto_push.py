import os
import random
import csv
import json
import requests
import urllib.parse

# GitHub Secrets 또는 환경변수에서 로드
GEMINI_KEY = os.environ.get("GEMINI_API_KEY")
TG_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN")
TG_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID")
NTFY_TOPIC = os.environ.get("NTFY_TOPIC", "the-forest-camp-alert")
BASE_URL = os.environ.get("BASE_URL", "https://app-idea-cyan-chi.vercel.app")

def load_eligible_apis():
    eligible = []
    if os.path.exists("final_api_catalog_285.csv"):
        with open("final_api_catalog_285.csv", "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                if str(row.get("idea_engine_eligible", "")).lower() == "true":
                    eligible.append({
                        "name": row.get("name"),
                        "category": row.get("category"),
                        "description": row.get("description")
                    })
    return eligible

def generate_idea():
    apis = load_eligible_apis()
    sample_apis = random.sample(apis, 3) if len(apis) >= 3 else [
        {"name": "Radio Browser API", "category": "미디어"},
        {"name": "Open-Meteo", "category": "날씨"}
    ]

    prompt = f"""
전 세계 실시간 오픈 API를 조합해 극도로 독창적인 소프트웨어를 기획하는 프로덕트 아키텍트입니다.
아래 API 후보군을 2개 이상 조합해 기획하세요.

후보군:
{json.dumps(sample_apis, ensure_ascii=False, indent=2)}

JSON Schema:
{{
  "title": "EnglishNameOnly",
  "hook": "호기심을 자극하는 한 줄 콘셉트",
  "apis": ["사용한 API 이름1", "사용한 API 이름2"]
}}
"""
    model = "gemini-3.6-flash"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_KEY}"
    
    res = requests.post(url, json={"contents": [{"parts": [{"text": prompt}]}]})
    data = res.json()
    
    raw_text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
    raw_text = raw_text.replace("```json", "").replace("```", "").strip()
    return json.loads(raw_text)

def send_push(idea):
    hook = idea.get("hook", "")
    api_names = " + ".join([a.split()[0] for a in idea.get("apis", [])])
    
    # 1. Telegram
    if TG_TOKEN and TG_CHAT_ID:
        tg_text = f"🎯 <b>\"{hook}\"</b>\n🔌 결합: {api_names}\n🔗 {BASE_URL}"
        tg_url = f"https://api.telegram.org/bot{TG_TOKEN}/sendMessage"
        requests.post(tg_url, json={"chat_id": TG_CHAT_ID, "text": tg_text, "parse_mode": "HTML"})

    # 2. ntfy
    if NTFY_TOPIC:
        ntfy_url = f"https://ntfy.sh/{NTFY_TOPIC}"
        requests.post(ntfy_url, json={
            "message": f"🎯 \"{hook}\"\n🔌 결합: {api_names}",
            "click": BASE_URL,
            "tags": ["dart", "rocket"],
            "priority": 4
        })

if __name__ == "__main__":
    if GEMINI_KEY:
        idea_data = generate_idea()
        send_push(idea_data)
        print("✅ 2시간 정기 푸시 전송 완료:", idea_data.get("title"))
