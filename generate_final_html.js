const fs = require('fs');

const mapping = JSON.parse(fs.readFileSync('final_mapping.json', 'utf8'));
const template = fs.readFileSync('index.html', 'utf8');

let pathsHtml = '';
const districts = [
    "Kasaragod", "Kannur", "Wayanad", "Kozhikode", "Malappuram",
    "Palakkad", "Thrissur", "Ernakulam", "Idukki", "Kottayam",
    "Alappuzha", "Pathanamthitta", "Kollam", "Thiruvananthapuram"
];

for (const district of districts) {
    const paths = mapping[district];
    if (paths && paths.length > 0) {
        const id = district.toLowerCase();
        // Use a group for the district
        pathsHtml += `                <!-- ${district} -->\n`;
        pathsHtml += `                <g id="${id}" class="district">\n`;
        for (const path of paths) {
            pathsHtml += `                    <path d="${path.d}" />\n`;
        }
        pathsHtml += `                </g>\n\n`;
    }
}

// Replace the SVG content
// We need to match the existing SVG tag and replace its content
const svgRegex = /<svg id="kerala-map"[\s\S]*?>([\s\S]*?)<\/svg>/;
const newSvgContent = `<svg id="kerala-map" viewBox="0 0 1429 2500" xmlns="http://www.w3.org/2000/svg">\n${pathsHtml}            </svg>`;

const newHtml = template.replace(svgRegex, newSvgContent);

fs.writeFileSync('index.html', newHtml);
console.log('index.html updated with groups');
