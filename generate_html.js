const fs = require('fs');

const mapping = JSON.parse(fs.readFileSync('mapping_full.json', 'utf8'));
const template = fs.readFileSync('index.html', 'utf8');

let pathsHtml = '';
const districts = [
    "Kasaragod", "Kannur", "Wayanad", "Kozhikode", "Malappuram",
    "Palakkad", "Thrissur", "Ernakulam", "Idukki", "Kottayam",
    "Alappuzha", "Pathanamthitta", "Kollam", "Thiruvananthapuram"
];

for (const district of districts) {
    const data = mapping[district];
    if (data) {
        const id = district.toLowerCase();
        pathsHtml += `                <!-- ${district} -->\n`;
        pathsHtml += `                <path id="${id}" class="district" d="${data.d}" />\n\n`;
    }
}

// Replace the SVG content
const newHtml = template.replace(
    /<svg id="kerala-map"[\s\S]*?<\/svg>/,
    `<svg id="kerala-map" viewBox="0 0 1429 2500" xmlns="http://www.w3.org/2000/svg">\n${pathsHtml}            </svg>`
);

fs.writeFileSync('index.html', newHtml);
console.log('index.html updated');
