var Gezicht = require('../index'),
    fs = require('fs');

console.log('Creating a new Gezicht instance');

let gezicht = new Gezicht.Gezicht();

console.log('Adding face "jelle"');

gezicht.addFace('jelle', 'jelle-01.jpg');
gezicht.addFace('roel', 'roel-01.jpg');

console.log('Creating gezicht python process');

var proc = gezicht.createInstance();

proc.detectFaces('jelle-02.jpg', function gotFaces(err, result) {
	console.log(err, result)
});

var start = Date.now()

proc.detectFaces('splendida-01.jpg', function gotFaces(err, result) {
	console.log(err, result)
	console.log('Duration:', Date.now() - start)
})