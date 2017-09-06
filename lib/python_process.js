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
			console.error('Gezicht PythonProcess Received fauly JSON: ' + chunk);
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
		console.log('ERR? ' + chunk);
	});

	let tasks = [];

	// Load the faces
	for (let name in this.parent.faces) {
		let paths = this.parent.faces[name];

		tasks.push(function learnFaces(next) {
			that.learnFace(name, paths, next);
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
 * Learn a face
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

	var payload;

	if (!Array.isArray(paths)) {
		paths = [paths];
	}

	payload = {
		name  : name,
		paths : paths
	};

	this.send('learn-face', payload, callback);
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
	    payload;

	if (!this.ready) {
		this.afterOnce('ready', function whenReady() {
			that.detectFaces(file_path, callback);
		});
		return;
	}

	payload = {
		file_path : file_path
	};

	this.send('detect-face', payload, function detectedFaces(err, result) {

		if (err) {
			return callback(err);
		}

		callback(null, result);
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

	this.send('detect-picam', {}, function detectedFaces(err, result) {

		callback(err, result);

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