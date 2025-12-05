import re

source = r'd:\kerala\index.html'
dest = r'd:\kerala\india_map_high_res.svg'

with open(source, 'r', encoding='utf-8') as f:
    content = f.read()

# Regex to capturing the SVG block
match = re.search(r'(<svg[^>]*id="india-map"[^>]*>.*?</svg>)', content, re.DOTALL)

if match:
    svg_content = match.group(1)
    with open(dest, 'w', encoding='utf-8') as f:
        f.write(svg_content)
    print(f"Successfully extracted SVG to {dest}")
else:
    print("Could not find SVG with id='india-map'")
