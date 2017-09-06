const Blast   = __Protoblast;
const Fn      = Blast.Bound.Function;
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
 * Add this face
 *
 * @author    Jelle De Loecker   <jelle@develry.be>
 * @since     0.1.0
 * @version   0.1.0
 *
 * @param     {String}   name
 * @param     {String}   file_path
 */
GezichtClass.setMethod(function addFace(name, file_path) {

	var i;

	if (!this.faces[name]) {
		this.faces[name] = [];
	}

	if (Array.isArray(file_path)) {
		for (i = 0; i < file_path.length; i++) {
			this.faces[name].push(file_path[i]);
		}
	} else {
		this.faces[name].push(file_path);
	}

	for (i = 0; i < this.instances.length; i++) {
		this.instances[i].learnFace(name, file_path);
	}
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
GezichtClass.setMethod(function detectFaces(file_path, callback) {

	this.instances[0].detectFaces(file_path, callback);

});