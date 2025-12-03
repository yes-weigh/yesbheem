const fs = require('fs');

const content = fs.readFileSync('d:/kerala/Kerala-map-en.svg', 'utf8');
const lines = content.split('\n');

const targetIds = ['path2988', 'path4286'];

targetIds.forEach(id => {
    console.log(`Searching for ${id}...`);
    lines.forEach((line, index) => {
        if (line.includes(id)) {
            console.log(`Found ${id} at line ${index + 1}:`);
            // Print context
            for (let i = Math.max(0, index - 5); i < Math.min(lines.length, index + 5); i++) {
                console.log(`${i + 1}: ${lines[i]}`);
            }
            console.log('---');
        }
    });
});
