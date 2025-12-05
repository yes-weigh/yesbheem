import xml.etree.ElementTree as ET
import re

def process_svg(input_path, output_path):
    ET.register_namespace('', "http://www.w3.org/2000/svg")
    tree = ET.parse(input_path)
    root = tree.getroot()

    # Set root attributes
    root.set('id', 'india-map')
    if 'width' in root.attrib and 'height' in root.attrib:
        width = root.attrib['width'].replace('px', '')
        height = root.attrib['height'].replace('px', '')
        root.set('viewBox', f"0 0 {width} {height}")
    
    # Remove unwanted attributes from root
    for attr in ['width', 'height', 'style']:
        if attr in root.attrib:
            del root.attrib[attr]

    # Process paths
    for path in root.findall('.//{http://www.w3.org/2000/svg}path'):
        # Add class="state"
        classes = path.get('class', '').split()
        if 'state' not in classes:
            classes.append('state')
        path.set('class', ' '.join(classes))

        # Remove fill to allow CSS styling
        if 'fill' in path.attrib:
            del path.attrib['fill']
            
        # Check if it is Kerala and add class
        if path.get('id') == 'IN-KL':
             classes.append('kerala')
             path.set('class', ' '.join(classes))

    # Save
    tree.write(output_path, encoding='unicode', method='xml')

    # Read back and remove ns0: prefix if present (ElementTree sometimes adds it)
    with open(output_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    content = content.replace('ns0:', '').replace(':ns0', '')
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == "__main__":
    process_svg('assets/india.svg', 'processed_india.svg')
