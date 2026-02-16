const sharp = require('sharp');

async function checkColor(file) {
    try {
        const { data, info } = await sharp(file)
            .raw()
            .toBuffer({ resolveWithObject: true });

        // Get top-left pixel
        const r = data[0];
        const g = data[1];
        const b = data[2];
        const a = info.channels === 4 ? data[3] : 'N/A';

        console.log(`${file}: R=${r}, G=${g}, B=${b}, A=${a}`);
    } catch (e) {
        console.error(`${file}: Error - ${e.message}`);
    }
}

async function run() {
    await checkColor('debug_thumb_raw.png');
    await checkColor('debug_thumb_flatten_white.jpg');
    await checkColor('debug_thumb_ensure_alpha_flatten.jpg');
    await checkColor('debug_thumb_remove_alpha.jpg');
}

run();
