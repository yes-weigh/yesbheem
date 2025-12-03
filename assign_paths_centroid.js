const fs = require('fs');
const { JSDOM } = require('jsdom');

const svgContent = fs.readFileSync('d:/kerala/Kerala-map-en.svg', 'utf8');
const mapping = JSON.parse(fs.readFileSync('d:/kerala/final_mapping.json', 'utf8'));

const dom = new JSDOM(svgContent);
const document = dom.window.document;

function getFirstPoint(d) {
    const match = d.match(/^[mM]\s*(-?[\d.]+)[,\s](-?[\d.]+)/);
    if (match) {
        return { x: parseFloat(match[1]), y: parseFloat(match[2]) };
    }
    return { x: 0, y: 0 };
}

const districtCenters = {};
let output = '';

Object.entries(mapping).forEach(([name, paths]) => {
    let sumX = 0, sumY = 0, count = 0;
    paths.forEach(p => {
        const pt = getFirstPoint(p.d);
        sumX += pt.x;
        sumY += pt.y;
        count++;
    });
    districtCenters[name] = { x: sumX / count, y: sumY / count };
    output += `${name}: ${districtCenters[name].x.toFixed(2)}, ${districtCenters[name].y.toFixed(2)}\n`;
});

const unmapped = ['path2988', 'path4286'];

unmapped.forEach(id => {
    const el = document.getElementById(id);
    if (!el) {
        output += `${id} not found\n`;
        return;
    }
    const d = el.getAttribute('d');
    const pt = getFirstPoint(d);

    let closest = null;
    let minDist = Infinity;

    Object.entries(districtCenters).forEach(([name, distCenter]) => {
        const dist = Math.sqrt(Math.pow(pt.x - distCenter.x, 2) + Math.pow(pt.y - distCenter.y, 2));
        if (dist < minDist) {
            minDist = dist;
            closest = name;
        }
    });

    output += `${id} (${pt.x}, ${pt.y}) closest to ${closest} (${minDist.toFixed(2)})\n`;
});

fs.writeFileSync('d:/kerala/assignment_results.txt', output);
console.log('Results written to assignment_results.txt');
