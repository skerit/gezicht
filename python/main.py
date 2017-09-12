import face_recognition
import importlib
import numpy as np
import socket
import time
import json
import sys
import cv2
import os

from PIL import Image
from io import BytesIO

pi_spec = importlib.util.find_spec("picamera")
found_picam = pi_spec is not None
picam = False

# Make stdout flush by default
#sys.stdout = os.fdopen(sys.stdout.fileno(), 'wb', 0)

# Create the face encodings
encodings = {}

def detectFaceFromPath(path):
	image = face_recognition.load_image_file(path)
	return detectFaces(image)

def detectFaces(frame):

	# Get the shape of the frame
	shape = frame.shape
	width = shape[0]
	height = shape[1]

	# Create the result dictionary
	result = {}
	result['original_size'] = {
		'width'  : width,
		'height' : height
	}

	# Max size is 450x450
	max_size = 450

	if width > max_size or height > max_size:
		if width > height:
			coef = max_size / width
		else:
			coef = max_size / height

		# Resize frame of video for faster face recognition processing
		frame = cv2.resize(frame, (0, 0), fx=coef, fy=coef)

		result['resized'] = {
			'width'  : frame.shape[0],
			'height' : frame.shape[1]
		}

	face_locations = face_recognition.face_locations(frame)
	face_encodings = face_recognition.face_encodings(frame, face_locations)
	face_names = []
	faces = []

	# Get an array of the known faces
	known_faces = list(encodings.items())
	left_overs = []
	remove_seen_faces = True

	# Loop over each face found in the frame to see if it's someone we know.
	for face_encoding in face_encodings:
		name = ''

		if remove_seen_faces:
			# Iterate over the known faces,
			# we'll pop one each time
			while known_faces:
				# Shift the first face from the list
				face = known_faces.pop(0)
				key = face[0]
				value = face[1]

				match = face_recognition.compare_faces(value, face_encoding)

				if (match[0]):
					name = key
					break
				else:
					# It doesn't match, add it to the leftovers list
					left_overs.append(face)

			# Add all the left overs back to the face_names
			while left_overs:
				known_faces.append(left_overs.pop(0))
		else:
			for key, value in known_faces:
				match = face_recognition.compare_faces(value, face_encoding)

				if match[0]:
					name = key
					break

		face_names.append(name)

	for (top, right, bottom, left), name in zip(face_locations, face_names):
		entry = {
			'top'    : top,
			'right'  : right,
			'bottom' : bottom,
			'left'   : left,
			'name'   : name
		}

		faces.append(entry)

	result['faces'] = faces

	return result

# Start listening to input commands
while 1:
	line = sys.stdin.readline()
	req = json.loads(line)
	cmd = req.get('command')
	output = {}
	result = {}
	output['id'] = req.get('id')
	output['result'] = result;

	if cmd == 'learn-face':
		name = req.get('name')
		paths = req.get('paths')
		path_results = []
		count = 0

		if not name in encodings:
			encodings[name] = []

		for path in paths:
			image = face_recognition.load_image_file(path)
			encoding = face_recognition.face_encodings(image)[0]
			encodings[name].append(encoding)

			count += 1

			# Turn the numpy array into a regular list,
			# otherwise it'll fail json encoding later
			path_results.append(encoding.tolist())

		# Just a check on how many paths we did
		result['count'] = count

		# Give the encodings back to the other side,
		# they might cache them
		result['encodings'] = path_results
	elif cmd == 'add-face-encoding':
		new_encodings = req.get('encodings')
		name = req.get('name')
		count = 0

		if not name in encodings:
			encodings[name] = []

		for encoding in new_encodings:
			encodings[name].append(encoding)
			count += 1

		result['count'] = count

	elif cmd == 'detect-face':
		path = req.get('file_path')
		face_result = detectFaceFromPath(path)
		result.update(face_result)
	elif cmd == 'detect-picam':
		if not found_picam:
			output['error'] = 'Did not find picamera module'
		else:

			if not picam:
				import picamera
				picam = picamera.PiCamera()
				picam.resolution = (320, 240)

			frame = np.empty((240, 320, 3), dtype=np.uint8)
			picam.capture(frame, format="rgb")

			face_result = detectFaces(frame)

			result.update(face_result)

	elif cmd == 'detect-stream':
		path = req.get('stream_path');

		try:
			sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
			sock.connect(path)
			data = False

			while True:
				buf = sock.recv(4096)

				if not buf:
					break

				if not data:
					data = buf
				else:
					data = data + buf

			face_result = detectFaceFromPath(BytesIO(data))
			result.update(face_result)

		except Exception as e:
			output['error'] = str(e)


	print(json.dumps(output), flush=True)
	sys.stdout.flush()

	# We need to sleep for the buffer to flush
	time.sleep(0.05)
