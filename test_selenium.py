try:
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options
    options = Options()
    options.add_argument('--headless')
    driver = webdriver.Chrome(options=options)
    driver.get("https://agent-on.vercel.app/")
    import time
    time.sleep(2)
    # Check if oauthSignIn is defined
    result = driver.execute_script("return typeof window.oauthSignIn;")
    print("typeof oauthSignIn:", result)
    driver.quit()
except Exception as e:
    print("Selenium not available:", e)
