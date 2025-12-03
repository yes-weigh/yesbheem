const fs = require('fs');

try {
    const svgContent = fs.readFileSync('Kerala-map-en.svg', 'utf8');
    const mapping = JSON.parse(fs.readFileSync('mapping_full.json', 'utf8'));

    // Extract all paths
    const allPaths = [];
    const pathRegex = /<path([\s\S]*?)\/>/g;
    let match;
    while ((match = pathRegex.exec(svgContent)) !== null) {
        const attrs = match[1];
        const dMatch = attrs.match(/d="([^"]+)"/);
        const idMatch = attrs.match(/id="([^"]+)"/);
        if (dMatch && idMatch) {
            allPaths.push({ d: dMatch[1], id: idMatch[1] });
        }
    }

    function getCentroid(d) {
        const commands = d.match(/[a-zA-Z][^a-zA-Z]*/g);
        let x = 0, y = 0;
        let points = [];

        if (!commands) return null;

        for (const cmd of commands) {
            const type = cmd[0];
            const args = cmd.slice(1).trim().split(/[\s,]+/).map(parseFloat);

            if (type === 'M' || type === 'L') {
                for (let i = 0; i < args.length; i += 2) {
                    x = args[i];
                    y = args[i + 1];
                    points.push({ x, y });
                }
            } else if (type === 'm' || type === 'l') {
                for (let i = 0; i < args.length; i += 2) {
                    x += args[i];
                    y += args[i + 1];
                    points.push({ x, y });
                }
            } else if (type === 'C') {
                for (let i = 0; i < args.length; i += 6) {
                    x = args[i + 4];
                    y = args[i + 5];
                    points.push({ x, y });
                }
            } else if (type === 'c') {
                for (let i = 0; i < args.length; i += 6) {
                    x += args[i + 4];
                    y += args[i + 5];
                    points.push({ x, y });
                }
            } else if (type === 'H') {
                x = args[0];
                points.push({ x, y });
            } else if (type === 'h') {
                x += args[0];
                points.push({ x, y });
            } else if (type === 'V') {
                y = args[0];
                points.push({ x, y });
            } else if (type === 'v') {
                y += args[0];
                points.push({ x, y });
            }
        }

        if (points.length === 0) return null;

        let sumX = 0, sumY = 0;
        for (const p of points) {
            sumX += p.x;
            sumY += p.y;
        }
        return { x: sumX / points.length, y: sumY / points.length };
    }

    // Prepare district centroids
    const districtCentroids = {};
    const districtPaths = {}; // { DistrictName: [pathObj, ...] }

    for (const [name, data] of Object.entries(mapping)) {
        if (name === 'Kerala') continue; // Skip the outline
        const centroid = getCentroid(data.d);
        if (centroid) {
            districtCentroids[name] = centroid;
            districtPaths[name] = [];
        }
    }

    // Assign each path to closest district
    for (const path of allPaths) {
        // Skip the main Kerala outline if it exists in allPaths (it's path4286)
        if (path.id === 'path4286') continue;
        // Skip the text path if it exists (path3897 is Thiruvananthapuram, but check for others)

        const centroid = getCentroid(path.d);
        if (!centroid) continue;

        let bestDistrict = null;
        let minDistance = Infinity;

        for (const [name, distCentroid] of Object.entries(districtCentroids)) {
            const dist = Math.sqrt(Math.pow(centroid.x - distCentroid.x, 2) + Math.pow(centroid.y - distCentroid.y, 2));
            if (dist < minDistance) {
                minDistance = dist;
                bestDistrict = name;
            }
        }

        if (bestDistrict) {
            districtPaths[bestDistrict].push(path);
        }
    }

    fs.writeFileSync('final_mapping.json', JSON.stringify(districtPaths, null, 2));

} catch (err) {
    console.error(err);
}
