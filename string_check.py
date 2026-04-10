import re

text = open("script.js", "r", encoding="utf-8").read()

in_string = False
quote_char = ''
i = 0
while i < len(text):
    if not in_string:
        if text[i:i+2] == '//':
            while i < len(text) and text[i] != '\n': i += 1
        elif text[i:i+2] == '/*':
            while i < len(text) and text[i:i+2] != '*/': i += 1
            i += 2
        elif text[i] in '"\'`':
            in_string = True
            quote_char = text[i]
            string_start_line = text[:i].count('\n') + 1
            string_start_idx = i
            i += 1
        else:
            i += 1
    else:
        if text[i] == '\\':
            i += 2
        elif text[i] == quote_char:
            # We found the matching quote!
            in_string = False
            i += 1
        else:
            i += 1

if in_string:
    print(f"Unclosed string starting at line {string_start_line} with quote {quote_char}")
else:
    print("All strings are properly closed.")
