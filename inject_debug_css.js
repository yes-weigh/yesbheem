const fs = require('fs');
let html = fs.readFileSync('d:/kerala/debug.html', 'utf8');
const style = `
<style>
    #ernakulam path { fill: red !important; opacity: 0.7; }
    #idukki path { fill: green !important; opacity: 0.7; }
    #kottayam path { fill: blue !important; opacity: 0.7; }
    .district path { stroke: white; stroke-width: 2px; }
</style>
`;
html = html.replace('</head>', style + '</head>');
fs.writeFileSync('d:/kerala/debug.html', html);
