const fs = require('fs');
const { JSDOM } = require('jsdom');

const htmlContent = fs.readFileSync('d:/kerala/index.html', 'utf8');
const dom = new JSDOM(htmlContent);
const document = dom.window.document;

const ids = ['ernakulam', 'idukki', 'kottayam'];
let output = '';

ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        const path = el.querySelector('path');
        if (path) {
            output += `${id}:\n${path.getAttribute('d')}\n\n`;
        } else {
            output += `${id}: No path found\n\n`;
        }
    } else {
        output += `${id}: Not found\n\n`;
    }
});

fs.writeFileSync('d:/kerala/path_dump.txt', output);
console.log('Done.');
