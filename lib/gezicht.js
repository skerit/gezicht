const Blast   = __Protoblast;
const Fn      = Blast.Bound.Function;
const fs      = require('fs');
const Gezicht = Fn.getNamespace('Develry.Gezicht');

/**
 * The main Gezicht class
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
let GezichtClass = Fn.inherits('Informer', 'Develry.Gezicht', function Gezicht(options) {

	// All the faces we know about
	this.faces = {};

	// All the available instances
	this.instances = [];

	// Processes will check this queue first to see
	// if any new faces are being learned
	this.learn_queue = Fn.createQueue({enabled: true, limit: 1});

	// Set the options
	this.options = Blast.Bound.Object.assign({}, this.default_options, options);
});

/**
 * Set default options
 *
 * @author    Jelle De Loecker   <jelle@develry.be>
 * @since     0.1.0
 * @version   0.1.0
 */
GezichtClass.setProperty('default_options', {
	python : 'python3'
});

/**
 * Create an instance
 *
 * @author    Jelle De Loecker   <jelle@develry.be>
 * @since     0.1.0
 * @version   0.1.0
 */
GezichtClass.setMethod(function createInstance() {

	var proc = new Gezicht.PythonProcess(this);

	this.instances.push(proc);

	return proc;
});

/**
 * Get an available instance
 *
 * @author    Jelle De Loecker   <jelle@develry.be>
 * @since     0.1.0
 * @version   0.1.0
 */
GezichtClass.setMethod(function getInstance() {

	if (this.instances[0]) {
		return this.instances[0];
	}

	return this.createInstance();
});

/**
 * Learn the given face
 *
 * @author    Jelle De Loecker   <jelle@develry.be>
 * @since     0.1.0
 * @version   0.1.0
 *
 * @param     {String}   name
 * @param     {String}   file_path
 */
GezichtClass.setMethod(function learnFace(name, file_path, callback) {

	var that = this,
	    tasks = [],
	    instance,
	    i;

	if (!callback) {
		callback = Fn.thrower;
	}

	if (!this.faces[name]) {
		this.faces[name] = [];
	}

	// Get the first instance
	instance = this.instances[0];

	if (!instance) {
		instance = this.createInstance();
	}

	instance.learnFace(name, file_path, function learnedFace(err, encodings) {

		var i;

		if (err) {
			return callback(err);
		}

		for (i = 0; i < encodings.length; i++) {
			that.faces[name].push(encodings[i]);
		}

		// If there are more instances, let them know about this face
		if (that.instances.length > 1) {
			let tasks = [];

			for (i = 1; i < that.instances.length; i++) {
				let instance = that.instances[i];

				tasks.push(function addEncoding(next) {
					instance.addFaceEncoding(name, encodings, next);
				});
			}

			Fn.parallel(tasks, function done(err) {

				if (err) {
					return callback(err);
				}

				callback(null, encodings);
			});
		} else {
			callback(null, encodings);
		}
	});
});

/**
 * Add a previously learned face encoding
 *
 * @author    Jelle De Loecker   <jelle@develry.be>
 * @since     0.1.0
 * @version   0.1.0
 *
 * @param     {String}          name
 * @param     {String|Array}    encodings
 */
GezichtClass.setMethod(function addFaceEncoding(name, encodings, callback) {

	var that = this,
	    tasks = [],
	    i;

	Fn.series(function checkEncodingsType(next) {
		if (typeof encodings == 'string') {
			let original_path = encodings;

			fs.readFile(encodings, {encoding: 'utf8'}, function gotFile(err, data) {
				encodings = JSON.parse(data);

				if (!encodings) {
					return next(new Error('Could not parse "' + original_path + '" encodings file'));
				}

				next();
			});
		} else {
			next();
		}
	}, function addAllEncodings(next) {

		// The encodings variable should be an array of arrays
		if (!Array.isArray(encodings[0])) {
			encodings = [encodings];
		}

		if (!that.faces[name]) {
			that.faces[name] = [];
		}

		for (i = 0; i < encodings.length; i++) {
			that.faces[name].push(encodings[i]);
		}

		if (!that.instances.length) {
			that.createInstance();
		}

		for (i = 0; i < that.instances.length; i++) {
			let instance = that.instances[i];

			tasks.push(function addEncoding(next) {
				instance.addFaceEncoding(name, encodings, next);
			});
		}

		Fn.parallel(tasks, callback);
	}, function done(err) {
		callback(err);
	});
});

/**
 * Detect faces in the given image
 *
 * @author    Jelle De Loecker   <jelle@develry.be>
 * @since     0.1.0
 * @version   0.1.0
 *
 * @param     {String}   file_path
 */
GezichtClass.setMethod(function detectFaces(file_path, callback) {

	var instance = this.getInstance();

	instance.detectFaces(file_path, callback);
});

/**
 * Detect faces using the raspberry pi camera
 *
 * @author    Jelle De Loecker   <jelle@develry.be>
 * @since     0.1.0
 * @version   0.1.0
 */
GezichtClass.setMethod(function detectFacesPi(callback) {
	this.getInstance().detectFacesPi(callback);
});