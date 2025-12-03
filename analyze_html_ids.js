const fs = require('fs');
const { JSDOM } = require('jsdom');

const htmlContent = fs.readFileSync('d:/kerala/index.html', 'utf8');
const dom = new JSDOM(htmlContent);
const document = dom.window.document;

function getCentroid(d) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const matches = d.match(/-?[\d.]+/g);
    if (!matches) return { x: 0, y: 0 };

    for (let i = 0; i < matches.length; i += 2) {
        const x = parseFloat(matches[i]);
        const y = parseFloat(matches[i + 1]);
        if (!isNaN(x)) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
        }
        if (!isNaN(y)) {
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }
    }
    return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}

const districts = document.querySelectorAll('g.district');
const results = [];

districts.forEach(g => {
    const id = g.id;
    const path = g.querySelector('path');
    if (path) {
        const d = path.getAttribute('d');
        const center = getCentroid(d);
        results.push({ id, x: center.x.toFixed(2), y: center.y.toFixed(2), dLength: d.length });
    }
});

results.sort((a, b) => parseFloat(a.y) - parseFloat(b.y));

let output = 'District Centroids (North to South):\n';
results.forEach(r => {
    output += `ID: ${r.id.padEnd(20)} X: ${r.x.padEnd(8)} Y: ${r.y.padEnd(8)} Length: ${r.dLength}\n`;
});

fs.writeFileSync('d:/kerala/html_ids_analysis.txt', output);
console.log('Done.');
