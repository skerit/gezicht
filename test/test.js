var Gezicht = require('../index'),
    fs = require('fs');

console.log('Creating the main Gezicht class instance');

let gezicht = new Gezicht.Gezicht();

console.log('Learning faces');

// Learn the face of Jelle & Roel
// gezicht will create a new python instance on its own
gezicht.learnFace('jelle', 'jelle-01.jpg');
gezicht.learnFace('roel', 'roel-01.jpg');

// Add the previously created face encoding of lisenka
gezicht.addFaceEncoding('lisenka', 'lisenka-01.json');

console.log('Creating another python process');

// This creates another instance
let proc = gezicht.createInstance();

// Even though you call this function now,
// it'll only start detecting these faces once it has
// also learned about the 'jelle' and 'roel' faces
proc.detectFaces('jelle-02.jpg', function gotFaces(err, result) {
	console.log('Scanned jelle-02.jpg:', err, result);
});

var start = Date.now()

proc.detectFaces('splendida-01.jpg', function gotFaces(err, result) {
	console.log('Scanned splendida-01.jpg', err, result);
});

return
proc.detectFacesPi(function gotFaces(err, result) {
	console.log('PI:', err, result);
});