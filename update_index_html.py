import re

def update_index_html():
    # Read the processed SVG
    with open('processed_india.svg', 'r', encoding='utf-8') as f:
        svg_content = f.read()

    # Read index.html
    with open('index.html', 'r', encoding='utf-8') as f:
        html_content = f.read()

    # Define the regex to find the existing SVG block
    # We look for <svg id="india-map" ... </svg>
    # Using dotall to match across newlines
    pattern = re.compile(r'<svg id="india-map".*?</svg>', re.DOTALL)

    # Check if we find a match
    if pattern.search(html_content):
        new_html_content = pattern.sub(svg_content, html_content)
        
        with open('index.html', 'w', encoding='utf-8') as f:
            f.write(new_html_content)
        print("Successfully updated index.html with the new SVG map.")
    else:
        print("Error: Could not find the <svg id='india-map'> block in index.html.")

if __name__ == "__main__":
    update_index_html()
