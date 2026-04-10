import re
with open("script.js", "r") as f:
    text = f.read()

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
        i += 1
        while i < len(text):
            if text[i] == '\\': i += 2
            elif text[i] == '`':
                i += 1
                break
            # Ignore brackets inside template literals unless they are interpolations ${...}
            # Actually interpolations are hard to parse easily without a real JS parser.
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
        clean_text.append((text[i], i))
        i += 1

brackets = []
for c, idx in clean_text:
    if c in '{[(': brackets.append((c, idx))
    elif c in '}])':
        if not brackets: pass
        else: brackets.pop()

print("Remaining open brackets:", len(brackets))
for c, idx in brackets:
    # count newlines before idx to get line number
    line_no = text[:idx].count('\n') + 1
    print(f"Open bracket '{c}' at line {line_no}")
