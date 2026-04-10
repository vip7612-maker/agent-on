import re
import sys

def check_brackets(code):
    lines = code.split('\n')
    stack = []
    
    # Simple regex-based tokenization to strip strings, comments, and regex literals
    # This is a basic approximation but works for simple syntax error checking
    code_no_comments = re.sub(r'//.*', '', code)
    code_no_comments = re.sub(r'/\*.*?\*/', '', code_no_comments, flags=re.DOTALL)
    
    # Strip strings (single, double, template)
    # Handling escaped quotes is tricky but simple regex:
    code_no_strings = re.sub(r'"(?:\\.|[^"\\])*"', '""', code_no_comments)
    code_no_strings = re.sub(r"'(?:\\.|[^'\\])*'", "''", code_no_strings)
    code_no_strings = re.sub(r'`(?:\\.|[^`\\])*`', '``', code_no_strings)
    
    for count, line in enumerate(code_no_strings.split('\n')):
        for char in line:
            if char in '{[(':
                stack.append((char, count+1))
            elif char in '}])':
                if not stack:
                    return f"Error: Unexpected closing bracket '{char}' at line {count+1}"
                last_open, last_line = stack.pop()
                pairs = {'{': '}', '[': ']', '(': ')'}
                if pairs[last_open] != char:
                    return f"Error: Mismatched bracket at line {count+1}. Expected {pairs[last_open]} to match {last_open} from line {last_line}, got {char}"
                    
    if stack:
        return f"Error: Unclosed brackets remaining: {[(c, l) for c, l in stack]}"
    
    return "OK"

with open("script.js", "r") as f:
    print(check_brackets(f.read()))
