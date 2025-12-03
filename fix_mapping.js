const fs = require('fs');

const mappingPath = 'final_mapping.json';
const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));

// Remove path2988 from Malappuram
if (mapping['Malappuram']) {
    const originalLength = mapping['Malappuram'].length;
    mapping['Malappuram'] = mapping['Malappuram'].filter(p => p.id !== 'path2988');
    const newLength = mapping['Malappuram'].length;

    if (originalLength !== newLength) {
        console.log(`Removed path2988 from Malappuram. Count: ${originalLength} -> ${newLength}`);
        fs.writeFileSync(mappingPath, JSON.stringify(mapping, null, 2));
    } else {
        console.log('path2988 not found in Malappuram paths.');
    }
} else {
    console.log('Malappuram district not found in mapping.');
}
