import face_recognition
import importlib
import numpy as np
import socket
import json
import sys
import cv2
import os

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

	# Resize frame of video to 1/2 size for faster face recognition processing
	#frame = cv2.resize(frame, (0, 0), fx=0.5, fy=0.5)

	face_locations = face_recognition.face_locations(frame)
	face_encodings = face_recognition.face_encodings(frame, face_locations)
	face_names = []
	result = []

	# Loop over each face found in the frame to see if it's someone we know.
	for face_encoding in face_encodings:
		name = ''

		for key, value in encodings.items():
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

		result.append(entry)

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
		count = 0

		if not name in encodings:
			encodings[name] = []

		for path in paths:
			image = face_recognition.load_image_file(path)
			encoding = face_recognition.face_encodings(image)[0]
			encodings[name].append(encoding)
			count += 1

		result['count'] = count
	elif cmd == 'detect-face':
		path = req.get('file_path')
		result['faces'] = detectFaceFromPath(path)
	elif cmd == 'detect-picam':
		if not found_picam:
			output['error'] = 'Did not find picamera module'
		else:

			if not picam:
				import picamera
				picam = picamera.PiCamera()
				picam.resolution = (320, 240)

			output = np.empty((240, 320, 3), dtype=np.uint8)
			picam.capture(output, format="rgb")

			result['faces'] = detectFaces(output)

	elif cmd == 'detect-stream':
		path = req.get('stream_path');

		try:
			sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
			sock.connect(path)
			#f = sock.makefile()
			#movie = cv2.VideoCapture(sock.fileno())
			#ret, frame = movie.read()

			ret = face_recognition.load_image_file(sock)

			if not ret:
				output['error'] = 'Ret is empty: ' + path

		except Exception as e:
			output['error'] = str(e)


	print(json.dumps(output))
	sys.stdout.flush()
