const fs = require('fs');
const data = JSON.parse(fs.readFileSync('node_modules/@tombatossals/chords-db/lib/guitar.json', 'utf8'));
console.log(Object.keys(data.chords));
