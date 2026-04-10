import re
with open("script.js", "r") as f:
    text = f.read()

# Strip strings and comments securely using a simple state machine to avoid regex nesting issues
clean_text = []
i = 0
while i < len(text):
    if text[i:i+2] == '//':
        while i < len(text) and text[i] != '\n': i += 1
    elif text[i:i+2] == '/*':
        while i < len(text) and text[i:i+2] != '*/': i += 1
        i += 2
    elif text[i] in '"\'`':
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
        if not brackets: print("EXTRA:", c); break
        last = brackets.pop()
        map = {'{':'}', '[':']', '(':')'}
        if map[last] != c: print(f"MISMATCH: got {c} expected {map[last]}"); break

print("Remaining open brackets:", len(brackets))
