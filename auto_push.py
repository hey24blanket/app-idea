import os
import sys
import random
import csv
import json
import re
import requests

GEMINI_KEY = os.environ.get("GEMINI_API_KEY")
TG_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN")
TG_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID")
NTFY_TOPIC = os.environ.get("NTFY_TOPIC", "the-forest-camp-alert")
BASE_URL = os.environ.get("BASE_URL", "https://app-idea-cyan-chi.vercel.app")

def load_eligible_apis():
    eligible = []
    csv_path = "final_api_catalog_285.csv"
    if os.path.exists(csv_path):
        try:
            with open(csv_path, "r", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if str(row.get("idea_engine_eligible", "")).lower() == "true":
                        eligible.append({
                            "name": row.get("name"),
                            "category": row.get("category"),
                            "description": row.get("description")
                        })
        except Exception as e:
            print(f"CSV 로드 예외: {e}")
    
    if not eligible:
        eligible = [
            {"name": "Radio Browser API", "category": "미디어", "description": "실시간 라디오 스트림"},
            {"name": "Open-Meteo", "category": "날씨", "description": "글로벌 기상 예보"},
            {"name": "NASA DONKI API", "category": "우주", "description": "태양 플레어 관측"}
        ]
    print(f"📊 [1/4] API 카탈로그 {len(eligible)}개 로드 완료")
    return eligible

def get_best_model(api_key):
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
        res = requests.get(url, timeout=10)
        data = res.json()
        if "models" in data:
            supported = [
                m["name"].replace("models/", "")
                for m in data["models"]
                if "generateContent" in m.get("supportedGenerationMethods", [])
            ]
            for pref in ["gemini-3.6-flash", "gemini-3.0-flash", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]:
                if pref in supported:
                    return pref
            if supported:
                return supported[0]
    except Exception as e:
        print(f"모델 탐색 예외: {e}")
    return "gemini-3.6-flash"

def generate_idea():
    if not GEMINI_KEY or not GEMINI_KEY.strip():
        print("❌ 에러: GEMINI_API_KEY가 Secrets에 설정되지 않았습니다.")
        sys.exit(1)

    apis = load_eligible_apis()
    sample_apis = random.sample(apis, min(3, len(apis)))
    model = get_best_model(GEMINI_KEY)
    print(f"🤖 [2/4] 모델 매칭 완료: {model}")

    prompt = f"""
당신은 전 세계 실시간 오픈 API를 조합해 극도로 독창적인 소프트웨어를 기획하는 프로덕트 아키텍트입니다.
아래 API 후보군 중 2개 이상을 반드시 결합하여 새 아이디어를 기획하세요.

[API 후보군]:
{json.dumps(sample_apis, ensure_ascii=False, indent=2)}

[규칙]:
1. title은 영문 단독 표기
2. 반환은 마크다운(```json) 없이 순수 JSON만 출력하세요.

JSON Schema:
{{
  "title": "EnglishNameOnly",
  "hook": "호기심을 자극하는 한 줄 콘셉트",
  "apis": ["사용한 API 이름1", "사용한 API 이름2"]
}}
"""
    url = f"[https://generativelanguage.googleapis.com/v1beta/models/](https://generativelanguage.googleapis.com/v1beta/models/){model}:generateContent?key={GEMINI_KEY}"

    try:
        res = requests.post(
            url,
            json={"contents": [{"parts": [{"text": prompt}]}]},
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        data = res.json()
    except Exception as e:
        print(f"❌ 구글 통신 에러: {e}")
        sys.exit(1)

    if "error" in data:
        print(f"❌ 구글 API 오류 [{data['error'].get('code')}]: {data['error'].get('message')}")
        sys.exit(1)

    try:
        raw_text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
        raw_text = re.sub(r"```json\s*", "", raw_text)
        raw_text = re.sub(r"```\s*", "", raw_text).strip()
        parsed = json.loads(raw_text)
        print(f"✨ [3/4] 기획안 생성 완료: {parsed.get('title')}")
        return parsed
    except Exception as e:
        print(f"⚠️ JSON 파싱 대체: {e}")
        return {
            "title": "CloudSync",
            "hook": "전 세계 실시간 오픈 데이터를 결합한 자동화 인텔리전스",
            "apis": [sample_apis[0]["name"], sample_apis[1]["name"]]
        }

def send_push(idea):
    hook = idea.get("hook", "")
    api_names = " + ".join([a.split()[0] for a in idea.get("apis", [])])
    print(f"🚀 [4/4] 푸시 발송 진행 (API: {api_names})")

    # 1. 텔레그램 발송
    if TG_TOKEN and TG_CHAT_ID:
        tg_text = f"🎯 <b>\"{hook}\"</b>\n🔌 결합: {api_names}\n🔗 {BASE_URL}"
        tg_url = f"[https://api.telegram.org/bot](https://api.telegram.org/bot){TG_TOKEN}/sendMessage"
        try:
            r = requests.post(
                tg_url,
                json={"chat_id": TG_CHAT_ID, "text": tg_text, "parse_mode": "HTML"},
                timeout=10
            )
            if r.ok:
                print("✈️ 텔레그램 푸시 성공")
            else:
                print(f"⚠️ 텔레그램 응답 실패: {r.text}")
        except Exception as e:
            print(f"⚠️ 텔레그램 에러: {e}")

    # 2. ntfy 발송
    if NTFY_TOPIC:
        ntfy_payload = {
            "topic": NTFY_TOPIC,
            "message": f"🎯 \"{hook}\"\n🔌 결합: {api_names}",
            "click": BASE_URL,
            "tags": ["dart", "rocket"],
            "priority": 4
        }
        try:
            r = requests.post(
                "[https://ntfy.sh](https://ntfy.sh)",
                data=json.dumps(ntfy_payload, ensure_ascii=False).encode("utf-8"),
                headers={"Content-Type": "application/json; charset=utf-8"},
                timeout=10
            )
            if r.ok:
                print("🔔 ntfy 푸시 성공")
            else:
                print(f"⚠️ ntfy 응답 실패: {r.text}")
        except Exception as e:
            print(f"⚠️ ntfy 에러: {e}")

if __name__ == "__main__":
    idea_data = generate_idea()
    send_push(idea_data)
    print("🎉 모든 정기 푸시 정상 완료!")
