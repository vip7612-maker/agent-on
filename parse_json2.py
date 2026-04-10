import re

with open("script.js", "r") as f:
    text = f.read()

# Remove string literals and comments
text = re.sub(r"//.*", "", text)
text = re.sub(r"/\*.*?\*/", "", text, flags=re.DOTALL)
text = re.sub(r'\'[^\']*\'', "", text)
text = re.sub(r'"[^"]*"', "", text)
text = re.sub(r'`[^`]*`', "", text)

brackets = 0
for char in text:
    if char == '{': brackets += 1
    elif char == '}': brackets -= 1

print(f"Unbalanced braces: {brackets}")
