import { pdf } from 'pdf-to-img';
import fs from 'fs';

async function test() {
    console.log('Testing pdf-to-img...');
    try {
        const document = await pdf('THIRD SCHEDULE.pdf');
        for await (const image of document) {
            fs.writeFileSync('test-thumb.png', image);
            console.log('Success: PDF converted to PNG');
            break;
        }
    } catch (e) {
        console.error('Error:', e);
    }
}

test();
