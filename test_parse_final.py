import urllib.request
import re

url = "https://agent-on.vercel.app/script.js?v=" + str(0)  # append random string to bypass cache
req = urllib.request.Request(url, headers={'Cache-Control': 'no-cache'})
with urllib.request.urlopen(req) as response:
    text = response.read().decode('utf-8')

clean_text = []
i = 0
positions = []
while i < len(text):
    if text[i:i+2] == '//':
        while i < len(text) and text[i] != '\n': i += 1
    elif text[i:i+2] == '/*':
        while i < len(text) and text[i:i+2] != '*/': i += 1
        i += 2
    elif text[i] == '`':
        # very naive template literal parsing
        i += 1
        while i < len(text):
            if text[i] == '\\': i += 2
            elif text[i] == '`':
                i += 1
                break
            else: i += 1
    elif text[i] in '"\'':
        quote = text[i]
        i += 1
        while i < len(text):
            if text[i] == '\\': i += 2
            elif text[i] == quote:
                i += 1
                break
            else: i += 1
    else:
        clean_text.append(text[i])
        i += 1

clean_str = "".join(clean_text)

brackets = []
for c in clean_str:
    if c in '{[(': brackets.append(c)
    elif c in '}])':
        if not brackets:
            print("EXTRA:", c)
            break
        last = brackets.pop()
        map = {'{':'}', '[':']', '(':')'}
        if map[last] != c:
            print(f"MISMATCH: got {c} expected {map[last]}")
            break

print("Remaining open brackets:", len(brackets))
