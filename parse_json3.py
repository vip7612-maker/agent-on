import re

with open("script.js", "r") as f:
    lines = f.readlines()

brackets = 0
for i, line in enumerate(lines):
    # Strip simple comments and strings for accurate counting per line
    line = re.sub(r"//.*", "", line)
    line = re.sub(r'\'[^\']*\'', "", line)
    line = re.sub(r'"[^"]*"', "", line)
    line = re.sub(r'`[^`]*`', "", line)
    
    for char in line:
        if char == '{': brackets += 1
        elif char == '}': brackets -= 1
    
if brackets > 0:
    print(f"Missing {brackets} closing braces!")
elif brackets < 0:
    print(f"Excess {-brackets} closing braces!")
else:
    print("Braces are balanced.")
