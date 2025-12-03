const fs = require('fs');
const { JSDOM } = require('jsdom');

const svgContent = fs.readFileSync('d:/kerala/Kerala-map-en.svg', 'utf8');
const mapping = JSON.parse(fs.readFileSync('d:/kerala/final_mapping.json', 'utf8'));

const dom = new JSDOM(svgContent);
const document = dom.window.document;

// Check missing districts
const districts = Object.keys(mapping).sort();
const expectedDistricts = [
    "Alappuzha", "Ernakulam", "Idukki", "Kannur", "Kasaragod", "Kollam",
    "Kottayam", "Kozhikode", "Malappuram", "Palakkad", "Pathanamthitta",
    "Thiruvananthapuram", "Thrissur", "Wayanad"
];
const missingDistricts = expectedDistricts.filter(d => !districts.includes(d));
console.log('Missing Districts:', missingDistricts);

// Analyze path2988
const path2988 = document.getElementById('path2988');
const d2988 = path2988 ? path2988.getAttribute('d') : 'NOT FOUND';
console.log('path2988 length:', d2988.length);

// Analyze path4286
const path4286 = document.getElementById('path4286');
const d4286 = path4286 ? path4286.getAttribute('d') : 'NOT FOUND';
console.log('path4286 length:', d4286.length);

// Check for similarity
let bestMatch = { id: null, diff: Infinity };
Object.entries(mapping).forEach(([name, paths]) => {
    paths.forEach(p => {
        if (p.d === d2988) {
            console.log(`path2988 is EXACT match for ${name} (id: ${p.id})`);
        }
    });
});

console.log('Done.');
