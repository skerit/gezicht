const Blast   = __Protoblast;
const Fn      = Blast.Bound.Function;
const fs      = require('fs');
const net     = require('net');
const Gezicht = Fn.getNamespace('Develry.Gezicht');
const child_process = require('child_process');


/**
 * The main Gezicht class
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
let Proc = Fn.inherits('Informer', 'Develry.Gezicht', function PythonProcess(parent) {

	// Store link to the parent Gezicht instance
	this.parent = parent;

	// Create callback listeners
	this.callbacks = {};

	// Create a queue (to prevent from detecting while adding encodings)
	this.queue = Fn.createQueue({enabled: true, limit: 1});

	// Start the python process
	this.initProcess();
});

/**
 * Init the process
 *
 * @author    Jelle De Loecker   <jelle@develry.be>
 * @since     0.1.0
 * @version   0.1.0
 */
Proc.setMethod(function initProcess() {

	var that = this;

	if (this._inited) {
		return;
	}

	this._inited = true;

	// Create the actual instance
	this.proc = child_process.spawn(this.parent.options.python, ['../python/main.py']);

	// Make the outputs return text
	this.proc.stderr.setEncoding('utf8');
	this.proc.stdout.setEncoding('utf8');

	// Listen for JSON responses
	this.proc.stdout.on('data', function onOut(chunk) {

		var callback,
		    data;

		chunk = chunk.trim();

		if (!chunk) {
			return;
		}

		try {
			data = JSON.parse(chunk);
		} catch (err) {
			// Ignore faulty json
			console.error('Gezicht PythonProcess Received fauly JSON: ' + JSON.stringify(''+chunk));
			return;
		}

		if (data.id && that.callbacks[data.id]) {

			if (data.error) {
				that.callbacks[data.id](data.error);
			} else {
				that.callbacks[data.id](null, data.result);
			}

			delete that.callbacks[data.id];
		}
	});

	// Listen for errors
	this.proc.stderr.on('data', function onErr(chunk) {
		that.emit('error', String(chunk));
	});

	let tasks = [];

	// Load the faces
	for (let name in this.parent.faces) {
		let encodings = this.parent.faces[name];

		if (!encodings.length) {
			continue;
		}

		tasks.push(function learnFaces(next) {
			that.addFaceEncoding(name, encodings, next);
		});
	}

	Fn.parallel(tasks, function done(err) {

		if (err) {
			return that.emit('error', err);
		}

		that.ready = true;
		that.emit('ready');
	});
});

/**
 * Send message to the process
 *
 * @author    Jelle De Loecker   <jelle@develry.be>
 * @since     0.1.0
 * @version   0.1.0
 *
 * @param     {String}   cmd
 * @param     {Object}   payload
 * @param     {Function} callback
 */
Proc.setMethod(function send(cmd, payload, callback) {

	var that = this,
	    data,
	    id = Blast.Classes.Crypto.uid();

	if (typeof callback == 'function') {
		this.callbacks[id] = callback;
	}

	data = Blast.Bound.Object.assign({}, payload, {
		command : cmd,
		id      : id
	});

	// Send it to the python process
	this.proc.stdin.write(JSON.stringify(data) + '\n');
});

/**
 * Let the instance learn a (new) face:
 * It'll recognize the face on the image(s)
 * and call back with the encoded result
 *
 * @author    Jelle De Loecker   <jelle@develry.be>
 * @since     0.1.0
 * @version   0.1.0
 *
 * @param     {String}        name
 * @param     {String|Array}  paths
 * @param     {Function}      callback
 */
Proc.setMethod(function learnFace(name, paths, callback) {

	var that = this,
	    payload;

	if (!callback) {
		callback = Fn.thrower;
	}

	if (!Array.isArray(paths)) {
		paths = [paths];
	}

	payload = {
		name  : name,
		paths : paths
	};

	this.parent.learn_queue.force(function forceLearnFace(done) {
		that.send('learn-face', payload, function learnedFace(err, result) {

			done();

			if (err) {
				return callback(err);
			}

			return callback(null, result.encodings);
		});
	});
});

/**
 * Add a previously learned face encoding
 *
 * @author    Jelle De Loecker   <jelle@develry.be>
 * @since     0.1.0
 * @version   0.1.0
 *
 * @param     {String}        name
 * @param     {Array}         encodings
 * @param     {Function}      callback
 */
Proc.setMethod(function addFaceEncoding(name, encodings, callback) {

	var that = this,
	    payload;

	// The encodings variable should be an array of arrays
	if (!Array.isArray(encodings[0])) {
		encodings = [encodings];
	}

	payload = {
		name      : name,
		encodings : encodings
	};

	this.queue.force(function forceAddEncoding(done) {
		that.send('add-face-encoding', payload, function addedEncoding(err) {
			done();
			callback(err);
		});
	});
});

/**
 * Detect faces
 *
 * @author    Jelle De Loecker   <jelle@develry.be>
 * @since     0.1.0
 * @version   0.1.0
 *
 * @param     {String}   file_path
 */
Proc.setMethod(function detectFaces(file_path, callback) {

	var that = this,
	    payload,
	    start;

	if (!this.ready) {
		this.afterOnce('ready', function whenReady() {
			that.detectFaces(file_path, callback);
		});
		return;
	}

	payload = {
		file_path : file_path
	};

	start = Date.now();

	this.parent.learn_queue.add(function nothingIsLearning() {
		that.queue.add(function sendDetectCommand(done) {
			that.send('detect-face', payload, function detectedFaces(err, result) {

				done();

				if (err) {
					return callback(err);
				}

				// Add the time it took to process this image
				result.duration = Date.now() - start;

				callback(null, result);
			});
		});
	});
});

/**
 * Get faces from the pi camera
 *
 * @author    Jelle De Loecker   <jelle@develry.be>
 * @since     0.1.0
 * @version   0.1.0
 *
 * @param     {Function}   callback
 */
Proc.setMethod(function detectFacesPi(callback) {

	var that = this;

	if (!this.ready) {
		this.afterOnce('ready', function whenReady() {
			that.detectFacesPi(callback);
		});
		return;
	}

	this.parent.learn_queue.add(function nothingIsLearning() {
		that.queue.add(function sendPiCommand(done) {
			that.send('detect-picam', {}, function detectedFaces(err, result) {

				done();
				callback(err, result);
			});
		});
	});
});

/**
 * Send stream
 *
 * @author    Jelle De Loecker   <jelle@develry.be>
 * @since     0.1.0
 * @version   0.1.0
 *
 * @param     {String}   file_path
 */
Proc.setMethod(function sendStream(stream, callback) {

	var that = this,
	    server,
	    id;

	if (typeof stream == 'string') {
		stream = fs.createReadStream(stream);
	}

	stream.pause();

	// Create the id
	id = '/tmp/gezicht_stream_' + Blast.Classes.Crypto.uid();

	console.log('id:', id);

	server = net.createServer(function onConnection(client) {
		stream.pipe(client);
	});

	server.listen(id, function listening() {

		var payload = {
			stream_path : id
		};

		that.send('detect-stream', payload, function done(err, result) {
			console.log('Detect stream result:', err, result);
		});
	});
});