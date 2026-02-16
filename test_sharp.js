const sharp = require('sharp');
const path = require('path');

async function test() {
    try {
        console.log('Testing sharp PDF support...');
        await sharp('THIRD SCHEDULE.pdf')
            .resize(300)
            .toFormat('jpeg')
            .toFile('test-thumb.jpg');
        console.log('Success: PDF converted to JPG');
    } catch (e) {
        console.error('Error:', e.message);
    }
}

test();
