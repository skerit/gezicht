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

	var i;

	// All the faces we know about
	this.faces = {};

	// All the available instances
	this.instances = [];

	// Processes will check this queue first to see
	// if any new faces are being learned
	this.learn_queue = Fn.createQueue({enabled: true, limit: 1});

	// Set the options
	this.options = Blast.Bound.Object.assign({}, this.default_options, options);

	for (i = 0; i < this.options.min_instance_count; i++) {
		this.createInstance();
	}
});

/**
 * Set default options
 *
 * @author    Jelle De Loecker   <jelle@develry.be>
 * @since     0.1.0
 * @version   0.1.0
 */
GezichtClass.setProperty('default_options', {
	python              : 'python3',
	min_instance_count  : 2,
	max_instance_count  : 4
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

	var instance,
	    i;

	Blast.Bound.Array.sortByPath(
		this.instances,

		// Lowest running ones go first
		1, 'waiting'
	);

	instance = this.instances[0];

	console.log('First:', instance.id, 'with', instance.queue.running, 'running and length', instance.queue._queue.length)

	if (!instance) {
		instance = this.createInstance();
	}

	if (instance.ready) {
		// Make up to 3 instances
		if (instance.queue._queue.length > 2 && this.instances.length < this.options.max_instance_count) {
			instance = this.createInstance();
		}
	}

	console.log('Returning instance', instance.id);

	return instance;
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

	instance = this.getInstance();

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
	    read_done,
	    i;

	this.learn_queue.force(function whenDone(done) {
		read_done = done;
	});

	Fn.series(false, function checkEncodingsType(next) {
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

		Fn.parallel(false, tasks, next);
		read_done();
	}, function done(err) {
		if (callback) callback(err);
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
GezichtClass.setMethod(function detectFaces(file_path, wait_for_learning, callback) {

	var instance,
	    that = this;

	if (typeof wait_for_learning == 'function') {
		callback = wait_for_learning;
		wait_for_learning = true;
	} else if (wait_for_learning == null) {
		wait_for_learning = true;
	}

	if (this.isStream(file_path)) {
		file_path.pause();
	}

	if (wait_for_learning) {
		this.learn_queue.add(function waitForLearning() {
			instance = that.getInstance();
			instance.detectFaces(file_path, callback);
		});
	} else {
		instance = this.getInstance();
		instance.detectFaces(file_path, callback);
	}
});

/**
 * Detect faces using the raspberry pi camera
 *
 * @author    Jelle De Loecker   <jelle@develry.be>
 * @since     0.1.0
 * @version   0.1.0
 */
GezichtClass.setMethod(function detectFacesPi(wait_for_learning, callback) {

	var that = this;

	if (typeof wait_for_learning == 'function') {
		callback = wait_for_learning;
		wait_for_learning = true;
	} else if (wait_for_learning == null) {
		wait_for_learning = true;
	}

	if (wait_for_learning) {
		this.learn_queue.add(function waitForLearning() {
			instance = that.getInstance();
			instance.detectFacesPi(callback);
		});
	} else {
		instance = this.getInstance();
		instance.detectFacesPi(callback);
	}
});

/**
 * Is something a stream?
 *
 * @author    Jelle De Loecker   <jelle@develry.be>
 * @since     0.1.0
 * @version   0.1.0
 */
GezichtClass.setMethod(function isStream(obj) {

	if (!obj) {
		return false;
	}

	if (typeof obj.pipe == 'function') {
		return true;
	}

	return false;
});