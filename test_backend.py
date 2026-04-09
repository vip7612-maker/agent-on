import subprocess
import time
import urllib.request
import json
import os

print("=== Backend (Turso + Express) Integration Test ===")

# 백엔드 서버 백그라운드 실행
server_process = subprocess.Popen(["node", "server.js"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)

print("[1] 서버 시작 중... 3초 대기")
time.sleep(3)

# 1. GET /api/chat 요청 테스트
try:
    print("[2] 채팅 이력 조회 (GET /api/chat) 확인")
    req = urllib.request.Request("http://localhost:3000/api/chat")
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        if response.status == 200 and 'success' in data:
            print(" => PASS: GET 요청 성공 및 응답 파싱 완료.")
        else:
            print(" => FAIL: GET 요청 응답 이상:", data)
except Exception as e:
    print(" => FAIL: GET 요청 예외 발생:", e)

# 2. POST /api/chat 요청 테스트
try:
    print("[3] 채팅 메시지 전송 (POST /api/chat) 확인 (DB 저장 로직)")
    test_payload = json.dumps({"message": "테스트 자동화 메시지입니다."}).encode('utf-8')
    req = urllib.request.Request("http://localhost:3000/api/chat", data=test_payload, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        if response.status == 200 and 'success' in data and data['success'] == True:
            print(" => PASS: POST 요청 성공 및 AI 응답 반환 완료.")
        else:
            print(" => FAIL: POST 요청 실패:", data)
except Exception as e:
    print(" => FAIL: POST 요청 예외 발생:", e)

# 서버 종료
print("[4] 서버 프로세스 종료")
server_process.terminate()
server_process.wait()

print("=== 모든 통합 테스트 완료 ===")
