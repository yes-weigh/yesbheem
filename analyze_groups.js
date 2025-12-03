const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

try {
    const svgContent = fs.readFileSync('Kerala-map-en.svg', 'utf8');
    const dom = new JSDOM(svgContent);
    const doc = dom.window.document;

    const groups = doc.querySelectorAll('g');
    const groupAnalysis = [];

    groups.forEach(g => {
        const groupId = g.id;
        const paths = g.querySelectorAll('path');
        if (paths.length > 0) {
            const pathIds = Array.from(paths).map(p => p.id);
            groupAnalysis.push({
                groupId: groupId,
                pathCount: paths.length,
                pathIds: pathIds
            });
        }
    });

    console.log(JSON.stringify(groupAnalysis, null, 2));

} catch (err) {
    console.error(err);
}
