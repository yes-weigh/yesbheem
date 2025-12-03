const fs = require('fs');
const mapping = JSON.parse(fs.readFileSync('d:/kerala/final_mapping.json', 'utf8'));
const districts = Object.keys(mapping).sort();
console.log('Mapped Districts:', districts);
console.log('Count:', districts.length);

const expectedDistricts = [
    "Alappuzha", "Ernakulam", "Idukki", "Kannur", "Kasaragod", "Kollam",
    "Kottayam", "Kozhikode", "Malappuram", "Palakkad", "Pathanamthitta",
    "Thiruvananthapuram", "Thrissur", "Wayanad"
];

const missing = expectedDistricts.filter(d => !districts.includes(d));
console.log('Missing Districts:', missing);
