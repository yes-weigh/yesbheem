const fs = require('fs');

try {
    const svgContent = fs.readFileSync('Kerala-map-en.svg', 'utf8');

    const paths = [];
    const pathRegex = /<path([\s\S]*?)\/>/g;
    let match;
    while ((match = pathRegex.exec(svgContent)) !== null) {
        const attrs = match[1];
        const dMatch = attrs.match(/d="([^"]+)"/);
        const idMatch = attrs.match(/id="([^"]+)"/);
        if (dMatch && idMatch) {
            paths.push({ d: dMatch[1], id: idMatch[1] });
        }
    }

    const texts = [];
    const textRegex = /<text([\s\S]*?)>[\s\S]*?<tspan([\s\S]*?)>([^<]+)<\/tspan>[\s\S]*?<\/text>/g;
    while ((match = textRegex.exec(svgContent)) !== null) {
        const textAttrs = match[1];
        const tspanAttrs = match[2];
        const content = match[3].trim();

        let xMatch = textAttrs.match(/x="([^"]+)"/);
        let yMatch = textAttrs.match(/y="([^"]+)"/);

        if (!xMatch) xMatch = tspanAttrs.match(/x="([^"]+)"/);
        if (!yMatch) yMatch = tspanAttrs.match(/y="([^"]+)"/);

        if (xMatch && yMatch) {
            texts.push({
                x: parseFloat(xMatch[1]),
                y: parseFloat(yMatch[1]),
                name: content
            });
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

    const mapping = {};
    for (const text of texts) {
        let bestPath = null;
        let minDist = Infinity;

        for (const path of paths) {
            const centroid = getCentroid(path.d);
            if (!centroid) continue;

            const dist = Math.sqrt(Math.pow(text.x - centroid.x, 2) + Math.pow(text.y - centroid.y, 2));
            if (dist < minDist) {
                minDist = dist;
                bestPath = path;
            }
        }

        if (bestPath) {
            mapping[text.name] = { id: bestPath.id, d: bestPath.d, dist: minDist };
        }
    }

    fs.writeFileSync('mapping_full.json', JSON.stringify(mapping, null, 2));

} catch (err) {
    console.error(err);
}
