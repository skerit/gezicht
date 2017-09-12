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

// Even though you call this function now,
// it'll only start detecting these faces once it has
// also learned about the 'jelle' and 'roel' faces
gezicht.detectFaces('jelle-02.jpg', function gotFaces(err, result) {
	console.log('Scanned jelle-02.jpg:', err, result);
});

var start = Date.now()

gezicht.detectFaces('splendida-01.jpg', function gotFaces(err, result) {
	console.log('Scanned splendida-01.jpg', err, result);
});

gezicht.detectFaces('roel-01.jpg', function gotFaces(err, result) {
	console.log('Scanned roel-01.jpg', err, result);
});

gezicht.detectFaces('lisenka-01.jpg', function gotFaces(err, result) {
	console.log('Scanned lisenka-01.jpg', err, result);
});

gezicht.detectFaces(fs.createReadStream('splendida-01.jpg'), function gotResult(err, result) {
	console.log('Scanned splendida-01.jpg stream:', err, result);
});

gezicht.detectFaces(fs.createReadStream('jelle-01.jpg'), function gotResult(err, result) {
	console.log('Scanned jelle-01.jpg stream:', err, result);
});

return
proc.detectFacesPi(function gotFaces(err, result) {
	console.log('PI:', err, result);
});