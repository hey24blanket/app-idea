import csv
import json
import os
import random
import sys
import requests

GEMINI_KEY = os.environ.get("GEMINI_API_KEY")
TG_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN")
TG_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID")
NTFY_TOPIC = os.environ.get("NTFY_TOPIC", "the-forest-camp-alert")
BASE_URL = os.environ.get("BASE_URL", "https://app-idea-cyan-chi.vercel.app")


def load_eligible_apis():
  """CSV에서 검증된 API 목록 로드"""
  eligible = []
  csv_path = "final_api_catalog_285.csv"
  if os.path.exists(csv_path):
    with open(csv_path, "r", encoding="utf-8-sig") as f:
      reader = csv.DictReader(f)
      for row in reader:
        if str(row.get("idea_engine_eligible", "")).lower() == "true":
          eligible.append({
              "name": row.get("name"),
              "category": row.get("category"),
              "description": row.get("description"),
          })
  print(f"📊 [1/3] 검증 완료 API {len(eligible)}개 로드 완료")
  return eligible


def get_best_model(api_key):
  """계정에서 현재 즉시 호출 가능한 최적의 Gemini 모델 자동 탐색"""
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

      candidate_preferences = [
          "gemini-3.6-flash",
          "gemini-3.0-flash",
          "gemini-2.5-flash",
          "gemini-2.0-flash",
          "gemini-1.5-flash",
      ]
      for pref in candidate_preferences:
        if pref in supported:
          return pref
      if supported:
        return supported[0]
  except Exception as e:
    print(f"⚠️ 모델 탐색 중 오류 발생 (기본값 사용): {e}")

  return "gemini-3.6-flash"


def generate_idea():
  """Gemini API를 통해 새 기획안 생성"""
  if not GEMINI_KEY:
    print("❌ 에러: GEMINI_API_KEY가 Secrets에 설정되지 않았습니다.")
    sys.exit(1)

  apis = load_eligible_apis()
  sample_apis = (
      random.sample(apis, 3)
      if len(apis) >= 3
      else [
          {"name": "Radio Browser API", "category": "미디어"},
          {"name": "Open-Meteo", "category": "날씨"},
      ]
  )

  model = get_best_model(GEMINI_KEY)
  print(f"🤖 [2/3] Gemini 모델 매칭 성공: {model}")

  prompt = f"""
전 세계 실시간 오픈 API를 조합해 극도로 독창적인 소프트웨어를 기획하는 프로덕트 아키텍트입니다.
아래 API 후보군을 2개 이상 조합해 기획하세요.

후보군:
{json.dumps(sample_apis, ensure_ascii=False, indent=2)}

[규칙]:
1. title은 영문 단독 표기
2. 반환은 마크다운(```json) 없이 순수 JSON 포맷으로만 응답

JSON Schema:
{{
  "title": "EnglishNameOnly",
  "hook": "호기심을 자극하는 한 줄 콘셉트",
  "apis": ["사용한 API 이름1", "사용한 API 이름2"]
}}
"""
  url = f"[https://generativelanguage.googleapis.com/v1beta/models/](https://generativelanguage.googleapis.com/v1beta/models/){model}:generateContent?key={GEMINI_KEY}"

  res = requests.post(
      url,
      json={"contents": [{"parts": [{"text": prompt}]}]},
      headers={"Content-Type": "application/json"},
      timeout=30,
  )
  data = res.json()

  if "error" in data:
    print(
        f"❌ 구글 API 오류 [{data['error'].get('code')}]:"
        f" {data['error'].get('message')}"
    )
    sys.exit(1)

  raw_text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
  raw_text = raw_text.replace("```json", "").replace("```", "").strip()
  return json.loads(raw_text)


def send_push(idea):
  """텔레그램 & ntfy로 3줄 요약 푸시 발송"""
  hook = idea.get("hook", "")
  api_names = " + ".join([a.split()[0] for a in idea.get("apis", [])])

  # 1. 텔레그램 (3줄: 훅 + 결합 + 링크)
  if TG_TOKEN and TG_CHAT_ID:
    tg_text = f'🎯 <b>"{hook}"</b>\n🔌 결합: {api_names}\n🔗 {BASE_URL}'
    tg_url = f"[https://api.telegram.org/bot](https://api.telegram.org/bot){TG_TOKEN}/sendMessage"
    try:
      r = requests.post(
          tg_url,
          json={"chat_id": TG_CHAT_ID, "text": tg_text, "parse_mode": "HTML"},
          timeout=10,
      )
      if r.ok:
        print("✈️ 텔레그램 푸시 발송 완료")
      else:
        print(f"⚠️ 텔레그램 발송 실패: {r.text}")
    except Exception as e:
      print(f"⚠️ 텔레그램 통신 오류: {e}")

  # 2. ntfy (UTF-8 JSON 바디 전송)
  if NTFY_TOPIC:
    ntfy_payload = {
        "topic": NTFY_TOPIC,
        "message": f'🎯 "{hook}"\n🔌 결합: {api_names}',
        "click": BASE_URL,
        "tags": ["dart", "rocket"],
        "priority": 4,
    }
    try:
      r = requests.post(
          "[https://ntfy.sh](https://ntfy.sh)",
          data=json.dumps(ntfy_payload, ensure_ascii=False).encode("utf-8"),
          headers={"Content-Type": "application/json; charset=utf-8"},
          timeout=10,
      )
      if r.ok:
        print("🔔 ntfy 푸시 발송 완료")
      else:
        print(f"⚠️ ntfy 발송 실패: {r.text}")
    except Exception as e:
      print(f"⚠️ ntfy 통신 오류: {e}")


if __name__ == "__main__":
  idea_data = generate_idea()
  print(f"✨ [3/3] 기획 생성 완료: {idea_data.get('title')}")
  send_push(idea_data)
  print("🎉 모든 정기 푸시 파이프라인 정상 완료!")
