import json

with open("script.js", "r") as f:
    text = f.read()

brackets = 0
for char in text:
    if char == '{': brackets += 1
    elif char == '}': brackets -= 1

print(f"Unbalanced braces: {brackets}")
