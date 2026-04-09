import os

files_to_check = ['index.html', 'style.css', 'script.js']
expected_elements = [
    ('index.html', 'class="sidebar"'),
    ('index.html', 'id="chatInput"'),
    ('index.html', 'class="welcome-screen"'),
    ('style.css', '--bg-primary'),
    ('style.css', '--bg-sidebar'),
    ('script.js', 'handleSend')
]

def run_tests():
    all_passed = True
    print("=== Test-Driven Harness Check ===")
    
    # 1. 파일 존재 여부 검사
    for f in files_to_check:
        if not os.path.exists(f):
            print(f"FAIL: {f} 가 없습니다.")
            all_passed = False
        else:
            print(f"PASS: {f} 존재 확인.")
            
    # 2. 핵심 UI 속성 및 키워드 검사
    for f, elem in expected_elements:
        if os.path.exists(f):
            with open(f, 'r', encoding='utf-8') as file:
                content = file.read()
                if elem in content:
                    print(f"PASS: {f} 내부에 '{elem}' 이(가) 확인됨.")
                else:
                    print(f"FAIL: {f} 내부에 '{elem}' 이(가) 누락됨.")
                    all_passed = False
                    
    if all_passed:
        print("\n=> [SUCCESS] 모든 테스트를 통과했습니다.")
    else:
        print("\n=> [ERROR] 일부 테스트가 실패했습니다.")

if __name__ == '__main__':
    run_tests()
