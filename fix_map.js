const fs = require('fs');
const { JSDOM } = require('jsdom');

const htmlContent = fs.readFileSync('d:/kerala/index.html', 'utf8');
const dom = new JSDOM(htmlContent);
const document = dom.window.document;

const ernakulam = document.getElementById('ernakulam');
const idukki = document.getElementById('idukki');
const kottayam = document.getElementById('kottayam');

if (!ernakulam || !idukki || !kottayam) {
    console.error('Could not find all district elements');
    process.exit(1);
}

// Helper to move paths
function movePaths(source, target, indices) {
    const paths = Array.from(source.querySelectorAll('path'));
    indices.sort((a, b) => b - a); // Sort descending to remove/move without shifting issues if we were splicing, but here we just pick elements

    indices.forEach(index => {
        if (paths[index]) {
            console.log(`Moving path ${index} from ${source.id} to ${target.id}`);
            target.appendChild(paths[index]);
        } else {
            console.error(`Path index ${index} not found in ${source.id}`);
        }
    });
}

// Plan:
// kottayam Path 1 (Index 0) -> idukki (This is the Idukki shape)
// idukki Path 1 (Index 0) -> ernakulam (This is the Ernakulam Mainland shape)
// idukki Path 2 (Index 1) -> ernakulam (This is likely part of Ernakulam Mainland)

// Note: When we move paths, the indices change if we query again.
// But I grabbed `paths` array first, so the references are stable.

// Step 1: Move Ernakulam paths from Idukki to Ernakulam
const idukkiPaths = Array.from(idukki.querySelectorAll('path'));
// Move both paths (0 and 1) to Ernakulam
ernakulam.appendChild(idukkiPaths[0]);
ernakulam.appendChild(idukkiPaths[1]);

// Step 2: Move Idukki path from Kottayam to Idukki
const kottayamPaths = Array.from(kottayam.querySelectorAll('path'));
// Path 1 (Index 0) is Idukki.
idukki.appendChild(kottayamPaths[0]);

// Save result
fs.writeFileSync('d:/kerala/index.html', dom.serialize());
console.log('Map fixed.');
