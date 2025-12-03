const fs = require('fs');
const { JSDOM } = require('jsdom');

const htmlContent = fs.readFileSync('d:/kerala/index.html', 'utf8');
const dom = new JSDOM(htmlContent);
const document = dom.window.document;

const ids = ['ernakulam', 'idukki', 'kottayam', 'alappuzha'];
let output = '';

ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        const paths = el.querySelectorAll('path');
        output += `${id} has ${paths.length} paths:\n`;
        paths.forEach((p, index) => {
            output += `  Path ${index + 1} (length ${p.getAttribute('d').length}): ${p.getAttribute('d').substring(0, 50)}...\n`;
        });
        output += '\n';
    } else {
        output += `${id}: Not found\n\n`;
    }
});

fs.writeFileSync('d:/kerala/path_count.txt', output);
console.log('Done.');
