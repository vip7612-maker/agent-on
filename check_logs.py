import sys
try:
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options
    import time
    options = Options()
    options.add_argument('--headless')
    driver = webdriver.Chrome(options=options)
    driver.get("https://agent-on.vercel.app/")
    time.sleep(3)
    
    logs = driver.get_log('browser')
    print("BROWSER LOGS:")
    for log in logs:
        print(log)
    driver.quit()
except Exception as e:
    print(e)
