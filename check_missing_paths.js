const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const svgContent = fs.readFileSync('d:/kerala/Kerala-map-en.svg', 'utf8');
const mappingContent = fs.readFileSync('d:/kerala/final_mapping.json', 'utf8');

const dom = new JSDOM(svgContent);
const document = dom.window.document;
const allPaths = Array.from(document.querySelectorAll('path'));

const mapping = JSON.parse(mappingContent);
const mappedIds = new Set();

Object.values(mapping).forEach(districtPaths => {
    districtPaths.forEach(p => {
        if (p.id) mappedIds.add(p.id);
    });
});

const missingPaths = allPaths.filter(p => {
    const id = p.id;
    return !mappedIds.has(id);
});

console.log(`Total paths in SVG: ${allPaths.length}`);
console.log(`Total mapped paths: ${mappedIds.size}`);
console.log(`Missing paths: ${missingPaths.length}`);

if (missingPaths.length > 0) {
    console.log('Missing Path IDs:');
    missingPaths.forEach(p => console.log(p.id));
}
