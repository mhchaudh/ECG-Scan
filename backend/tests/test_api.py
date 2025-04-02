import json
import os
import sys
import base64
import pytest
import numpy as np
from PIL import Image
from ECGenius.api.ecg_routes import ecg_bp, classify_ecg
from ECGenius.api.feedback_routes import feedback_bp, add_feedback
from ECGenius.api.image_routes import image_bp, create_image_and_digitize, highlight_random_ecg_sections, get_single_box_image, keep_only_one_box
from ECGenius.api.ecgresults_routes import ecgresults_bp, get_highlighted_image
from ECGenius.api.diagnoses_routes import diagnoses_bp, get_diagnoses_details
from ECGenius.api.map_routes import map_bp, add_map_details, get_map_details
from ECGenius.services.ecg_service import process_ecg_for_diagnosis
from ECGenius.api import db
from ECGenius.api.models import Diagnoses, Map
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate

import io
from io import BytesIO

@pytest.fixture
def client():
    app = Flask(__name__)

    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['TESTING'] = True
    db.init_app(app)

    app.register_blueprint(ecg_bp, url_prefix="/api/ecg")
    app.register_blueprint(feedback_bp, url_prefix="/api")
    app.register_blueprint(image_bp, url_prefix="/api")
    app.register_blueprint(ecgresults_bp, url_prefix="/api")
    app.register_blueprint(diagnoses_bp, url_prefix="/api")
    app.register_blueprint(map_bp, url_prefix="/api")
    client = app.test_client()

    with app.app_context():
        db.create_all()

        test_data1 = Diagnoses(location="canada", diagnoses="Diagnosis1", identifier="T", age=45, filename="tests/test_input/file1", gender="M")
        test_data2 = Diagnoses(location="canada", diagnoses="Diagnosis2", identifier="T", age=45, filename="tests/test_input/file2", gender="M")
        test_data3 = Diagnoses(location="us", diagnoses="Diagnosis1", identifier="T", age=30, filename="tests/test_input/file3", gender="F")
        db.session.add(test_data1)
        db.session.add(test_data2)
        db.session.add(test_data3)

        map1 = Map(identifier="TESTMAP1", filename="tests/test_input/file1", display_name="Canada", long=45.0, lat=33.0)
        map2 = Map(identifier="TESTMAP2", filename="tests/test_input/file2", display_name="USA", long=-95.0, lat=37.0)
        map3 = Map(identifier="TESTMAP3", filename="tests/test_input/file3", display_name="Germany", long=10.0, lat=51.0)
        db.session.add(map1)
        db.session.add(map2)
        db.session.add(map3)

        db.session.commit()

    return client

# classify_ecg.py Tests
class TestEcgRoutes():
    def test_classify_ecg(self, client):
        payload = {
            "ecg": [0.1, 0.2, 0.3, 0.4],
            "sex": 'M',
            "age": 45
        }
        response = client.post('/api/ecg/ecg/classify', data=json.dumps(payload), content_type="application/json")
        assert response.status_code == 200

        diagnosis_dict = response.json["diagnoses"]
        leads = response.json["lead_highlights"]

        # Testing diagnosis output
        assert len(diagnosis_dict) >= 5
        assert len(diagnosis_dict) == len(set(diagnosis_dict))

        for diagnosis in diagnosis_dict:
            assert diagnosis_dict[diagnosis] <= 1 and diagnosis_dict[diagnosis] >= 0

        # Testing leads output
        assert len(leads) == 12

        lead_names = ["I", "II", "III", "aVR", "aVL", "aVF", "V1", "V2", "V3", "V4", "V5", "V6"]
        for i, lead in enumerate(leads):
            #print("leads: ", leads[i], lead_names[i], i, lead, len(leads[i]))
            assert str(leads[i][0]) == lead_names[i]
            assert len(leads[i]) == 3
            assert leads[i][1] >= 0 and leads[i][2] >= 0

        #print("Response JSON:", response.json)

#    def test_classify_invalid_age(self, client):
#        payload = {
#            "ecg": [0.1, 0.2, 0.3, 0.4],
#            "sex": 'M',
#            "age": 100000
#        }
#        response = client.post('/api/ecg/ecg/classify', data=json.dumps(payload), content_type="application/json")
#        assert response.status_code == 500

#        payload = {
#            "ecg": [0.1, 0.2, 0.3, 0.4],
#            "sex": 'M',
#            "age": -1
#        }
#        response = client.post('/api/ecg/ecg/classify', data=json.dumps(payload), content_type="application/json")
#        assert response.status_code == 500

    def test_classify_ecg_bad_path(self, client):
        payload = {
            "ecg": [0.1, 0.2, 0.3, 0.4],
            "sex": 'M',
            "age": 45
        }
        response = client.post('/api/ecg/classify', data=json.dumps(payload), content_type="application/json")
        assert response.status_code == 404

    def test_classify_ecg_missing_age(self, client):
        payload = {
            "ecg": [0.1, 0.2, 0.3, 0.4],
            "sex": 'M'
        }
        response = client.post('/api/ecg/ecg/classify', data=json.dumps(payload), content_type="application/json")
        assert response.status_code == 400

    def test_classify_ecg_missing_sex(self, client):
        payload = {
            "ecg": [0.1, 0.2, 0.3, 0.4],
            "age": 100
        }
        response = client.post('/api/ecg/ecg/classify', data=json.dumps(payload), content_type="application/json")
        assert response.status_code == 400

    def test_classify_ecg_missing_ecg(self, client):
        payload = {
            "sex": 'M',
            "age": 1
        }
        response = client.post('/api/ecg/ecg/classify', data=json.dumps(payload), content_type="application/json")
        assert response.status_code == 400

class TestEcgServices():
    def test_process_ecg_for_diagnosis(self):
        ecg = [0.1, 0.2, 0.3, 0.4]
        age = 55
        sex = 'M'

        output = process_ecg_for_diagnosis(ecg, sex, age)

        diagnosis_dict = output["diagnoses"]
        leads = output["lead_highlights"]

        # Testing diagnosis output
        assert len(diagnosis_dict) >= 5
        assert len(diagnosis_dict) == len(set(diagnosis_dict))

        for diagnosis in diagnosis_dict:
            assert diagnosis_dict[diagnosis] <= 1 and diagnosis_dict[diagnosis] >= 0

        # Testing leads output
        assert len(leads) == 12

        lead_names = ["I", "II", "III", "aVR", "aVL", "aVF", "V1", "V2", "V3", "V4", "V5", "V6"]
        for i, lead in enumerate(leads):
            #print("leads: ", leads[i], lead_names[i], i, lead, len(leads[i]))
            assert str(leads[i][0]) == lead_names[i]
            assert len(leads[i]) == 3
            assert leads[i][1] >= 0 and leads[i][2] >= 0

#    def test_process_ecg_for_diagnosis_missing_data(self):
#        age = 100
#        sex = 'M'

#        try:
#            output = process_ecg_for_diagnosis(None, sex, age)
#            pytest.fail("This should cause an Exception for missing data")
#        except Exception as e:
#            pass

#    def test_process_ecg_for_diagnosis_invalid_data(self):
#        age = None
#        ecg = "Invalid"
#        sex = None

#        try:
#            output = process_ecg_for_diagnosis(ecg, sex, age)
#            pytest.fail("This should cause an Exception for invalid data")
#        except Exception as e:
#            pass

#feedback_routes.py Tests
class TestFeedbackRoutes():
    def test_feedback_routes(self, client):
        payload = {
            "identifier": 'JD',  
            "filename": 'test_input/valid_image.txt', 
            "feedback": 'test feedback message',
            "age": 55,
            "gender": 'M'
        }
        response = client.post('/api/feedback', data=json.dumps(payload), content_type="application/json")
        assert response.status_code == 200

    def test_feedback_routes_missing_data(self, client):
        payload = {}

        response = client.post('/api/feedback', data=json.dumps(payload), content_type="application/json")
        assert response.status_code == 400

    def test_feedback_routes_bad_path(self, client):
        payload = {
            "feedback": 'Test',
            "ID": 'JD',
            "file": 'test_input/valid_image.txt',
            "age": 55,
            "gender": 'M'
        }
        response = client.post('/feedback', data=json.dumps(payload), content_type="application/json")
        assert response.status_code == 404

    def test_feedback_routes_missing_feedback(self, client):
        payload = {
            "feedback": None,
            "ID": 'JD',
            "file": 'test_input/valid_image.txt',
            "age": 55,
            "gender": 'M'
        }
        response = client.post('/api/feedback', data=json.dumps(payload), content_type="application/json")
        assert response.status_code == 500

# image_routes.py Tests
class TestImageRoutes():
    def test_create_image_and_digitize(self, client):
        try:
            # Asked Chatgtp "how can I run a command in the parent directory", Mar. 23, 2025.
            # This is needed for the filepaths to work.
            parent_dir = os.path.abspath(os.path.join(os.getcwd(), ".."))
            os.chdir(parent_dir)

            test_image_path = "tests/test_input/valid_image.png"
            test_image_file = open(test_image_path, "rb")

            encoded_test_image = base64.b64encode(test_image_file.read()).decode('utf-8')

            payload = {
                "image": f"data:test;base64,{encoded_test_image}",
                "age": 60,
                "gender": 'M',
                "identifier": '12345abcd'
            }
            response = client.post('/api/image', data=json.dumps(payload), content_type="application/json")
            assert response.status_code == 200 

            assert len(response.json["filename"]) == 32
            assert response.json["image"] != None
            assert response.json["boundedboximage"] != None
            assert response.json["boxes"] != None
            assert response.json["original_boundedbox"] != None
        finally:
            os.chdir(os.path.join(os.getcwd(), "tests"))

    def test_create_image_and_digitize_bad_path(self, client):
        try:
            # Asked Chatgtp "how can I run a command in the parent directory", Mar. 23, 2025.
            # This is needed for the filepaths to work.
            parent_dir = os.path.abspath(os.path.join(os.getcwd(), ".."))
            os.chdir(parent_dir)

            test_image_path = "tests/test_input/valid_image.png"
            test_image_file = open(test_image_path, "rb")

            encoded_test_image = base64.b64encode(test_image_file.read()).decode('utf-8')

            payload = {
                "image": f"data:test;base64,{encoded_test_image}",
                "age": 60,
                "gender": 'M',
                "identifier": '12345abcd'
            }
            response = client.post('/api/api/image', data=json.dumps(payload), content_type="application/json")
            assert response.status_code == 404 
        finally:
            os.chdir(os.path.join(os.getcwd(), "tests"))

    def test_create_image_and_digitize_missing_data(self, client):
        try:
            # Asked Chatgtp "how can I run a command in the parent directory", Mar. 23, 2025.
            # This is needed for the filepaths to work.
            parent_dir = os.path.abspath(os.path.join(os.getcwd(), ".."))
            os.chdir(parent_dir)

            test_image_path = "tests/test_input/valid_image.png"
            test_image_file = open(test_image_path, "rb")

            encoded_test_image = base64.b64encode(test_image_file.read()).decode('utf-8')

            payload = {
                "image": f"data:test;base64,{encoded_test_image}",
                "age": 60,
                "gender": 'M',
                "identifier": '12345abcd'
            }

            copy = payload.copy()
            del copy["image"]
            response = client.post('/api/image', data=json.dumps(copy), content_type="application/json")
            assert response.status_code == 400

            copy = payload.copy()
            del copy["age"]
            response = client.post('/api/image', data=json.dumps(copy), content_type="application/json")
            assert response.status_code == 400

            copy = payload.copy()
            del copy["gender"]
            response = client.post('/api/image', data=json.dumps(copy), content_type="application/json")
            assert response.status_code == 400

            copy = payload.copy()
            del copy["identifier"]
            response = client.post('/api/image', data=json.dumps(copy), content_type="application/json")
            assert response.status_code == 400
        finally:
            os.chdir(os.path.join(os.getcwd(), "tests"))

    def test_create_image_and_digitize_invalid_image(self, client):
        try:
            # Asked Chatgtp "how can I run a command in the parent directory", Mar. 23, 2025.
            # This is needed for the filepaths to work.
            parent_dir = os.path.abspath(os.path.join(os.getcwd(), ".."))
            os.chdir(parent_dir)

            encoded_test_image = "Invalid"

            payload = {
                "image": f"data:test;base64,{encoded_test_image}",
                "age": 60,
                "gender": 'M',
                "identifier": '12345abcd'
            }
            response = client.post('/api/image', data=json.dumps(payload), content_type="application/json")
            assert response.status_code == 400
        finally:
            os.chdir(os.path.join(os.getcwd(), "tests"))

    def test_highlight_random_ecg_sections(self, client):
        test_image_path = "test_input/valid_bounded_image.png"
        test_boxes_path = "test_input/valid_image.txt"

        try:
            output = highlight_random_ecg_sections(test_image_path, test_boxes_path)
        except Exception as e:
            pytest.fail("highlight_random_ecg_sections Error: {e}")

    def test_highlight_random_ecg_section_invalid(self, client):
        test_image_path = "invalid"
        test_boxes_path = "invalid"

        try:
            output = highlight_random_ecg_section(test_image_path, test_boxes_path)
            pytest.fail(f"This should cause an exception")
        except Exception as e:
            pass

    def test_highlight_random_ecg_sections(self):
        try:
            test_image_path = "tests/test_input/valid_image.png"
            test_yolo_txt_path = "tests/test_input/valid_image.txt"

            # Asked Chatgtp "how can I run a command in the parent directory", Mar. 23, 2025.
            # This is needed for the filepaths to work.
            parent_dir = os.path.abspath(os.path.join(os.getcwd(), ".."))
            os.chdir(parent_dir)

            test_image = Image.open(test_image_path).convert("RGB")

            image, boxes = highlight_random_ecg_sections(test_image_path, test_yolo_txt_path)
            assert test_image.size == image.size
            assert len(boxes) >= 5

            for i, lead in enumerate(boxes):
                assert len(boxes[lead]) == 4
                assert boxes[lead]

        finally:
            os.chdir(os.path.join(os.getcwd(), "tests"))

    def test_highlight_random_ecg_sections_invalid_data(self):
        try:
            test_image_path = "tests/test_input/valid_image.png"
            test_yolo_txt_path = "tests/test_input/valid_image.txt"

            # Asked Chatgtp "how can I run a command in the parent directory", Mar. 23, 2025.
            # This is needed for the filepaths to work.
            parent_dir = os.path.abspath(os.path.join(os.getcwd(), ".."))
            os.chdir(parent_dir)

            test_image = Image.open(test_image_path).convert("RGB")

            try:
                image, boxes = highlight_random_ecg_sections("Invalid/path", test_yolo_txt_path)
                pytest.fail("Invalid path should cause an exception")
            except:
                pass

        finally:
            os.chdir(os.path.join(os.getcwd(), "tests"))

    def test_highlight_random_ecg_sections_missing_data(self):
        try:
            test_image_path = "tests/test_input/valid_image.png"
            test_yolo_txt_path = "tests/test_input/valid_image.txt"

            # Asked Chatgtp "how can I run a command in the parent directory", Mar. 23, 2025.
            # This is needed for the filepaths to work.
            parent_dir = os.path.abspath(os.path.join(os.getcwd(), ".."))
            os.chdir(parent_dir)

            test_image = Image.open(test_image_path).convert("RGB")

            try:
                image, boxes = highlight_random_ecg_sections(None, test_yolo_txt_path)
                pytest.fail("Missing image_path should cause an exception")
            except:
                pass

            try:
                image, boxes = highlight_random_ecg_sections(test_image_path, None)
                pytest.fail("Missing yolo_txt_path should cause an exception")
            except:
                pass

            try:
                image, boxes = highlight_random_ecg_sections(None, None)
                pytest.fail("Missing data should cause an exception")
            except:
                pass

        finally:
            os.chdir(os.path.join(os.getcwd(), "tests"))

    def test_get_single_box_image(self, client):
        try:
            test_image_path = "tests/test_input/valid_image.png"
            test_yolo_txt_path = "tests/test_input/valid_image.txt"

            # Asked Chatgtp "how can I run a command in the parent directory", Mar. 23, 2025.
            # This is needed for the filepaths to work.
            parent_dir = os.path.abspath(os.path.join(os.getcwd(), ".."))
            os.chdir(parent_dir)

            test_image, test_boxes = highlight_random_ecg_sections(test_image_path, test_yolo_txt_path)

            # Asked Chatgtp "how do I read an Image type object for the BytesIO function", Mar. 31, 2025
            img_byte_arr = BytesIO()
            test_image.save(img_byte_arr, format='PNG')
            img_byte_arr.seek(0)

            test_image = BytesIO(img_byte_arr.read())

            payload = {
               "image": (test_image, "tests/test_input/test_image.png"),
                "boxes": json.dumps(test_boxes),
                "color": "FFF342"
            }

            response = client.post('/api/single-box-image', data=payload, content_type="multipart/form-data")

            assert response.status_code == 200
        finally:
            os.chdir(os.path.join(os.getcwd(), "tests"))

    def test_get_single_box_image_invalid_data(self, client):
        try:
            test_image_path = "tests/test_input/valid_image.png"
            test_yolo_txt_path = "tests/test_input/valid_image.txt"

            # Asked Chatgtp "how can I run a command in the parent directory", Mar. 23, 2025.
            # This is needed for the filepaths to work.
            parent_dir = os.path.abspath(os.path.join(os.getcwd(), ".."))
            os.chdir(parent_dir)

            test_image, test_boxes = highlight_random_ecg_sections(test_image_path, test_yolo_txt_path)

            test_image = None

            payload = {
               "image": (test_image, "tests/test_image.png"),
                "boxes": json.dumps(test_boxes),
                "color": "FFF342"
            }

            response = client.post('/api/single-box-image', data=payload, content_type="multipart/form-data")

            assert response.status_code == 500
        finally:
            os.chdir(os.path.join(os.getcwd(), "tests"))

    def test_get_single_box_image_missing_data(self, client):
        try:
            test_image_path = "tests/test_input/valid_image.png"
            test_yolo_txt_path = "tests/test_input/valid_image.txt"

            # Asked Chatgtp "how can I run a command in the parent directory", Mar. 23, 2025.
            # This is needed for the filepaths to work.
            parent_dir = os.path.abspath(os.path.join(os.getcwd(), ".."))
            os.chdir(parent_dir)

            test_image, test_boxes = highlight_random_ecg_sections(test_image_path, test_yolo_txt_path)

            payload = {
                "boxes": json.dumps(test_boxes),
                "color": "FFF342"
            }

            response = client.post('/api/single-box-image', data=payload, content_type="multipart/form-data")

            assert response.status_code == 400
        finally:
            os.chdir(os.path.join(os.getcwd(), "tests"))

    def test_keep_only_one_box(self, client):
        try:
            test_image_path = "tests/test_input/valid_image.png"
            test_yolo_txt_path = "tests/test_input/valid_image.txt"

            # Asked Chatgtp "how can I run a command in the parent directory", Mar. 23, 2025.
            # This is needed for the filepaths to work.
            parent_dir = os.path.abspath(os.path.join(os.getcwd(), ".."))
            os.chdir(parent_dir)

            test_image, test_boxes = highlight_random_ecg_sections(test_image_path, test_yolo_txt_path)

            try:
                output = keep_only_one_box(test_image, test_boxes, "#2196F3")
            except Exception as e:
                pytest.fail(f"keep_only_one_box input error: {e}")

            bad_output = keep_only_one_box(test_image, test_boxes, "#FFFFFF")
            assert bad_output == test_image

        finally:
            os.chdir(os.path.join(os.getcwd(), "tests"))

class TestEcgResultsRoutes():
    def test_get_highlighted_image(self, client):
        try:
            test_file_path = "tests/test_input/valid_image.png"
            payload ={'filename': test_file_path}

            # Asked Chatgtp "how can I run a command in the parent directory", Mar. 23, 2025.
            # This is needed for the filepaths to work.
            parent_dir = os.path.abspath(os.path.join(os.getcwd(), ".."))
            os.chdir(parent_dir)

            response = client.post('/api/ecgresults', data=json.dumps(payload), content_type="application/json")
            assert response.status_code == 404

            payload ={}

            response = client.post('/api/ecgresults', data=json.dumps(payload), content_type="application/json")
            assert response.status_code == 400
        finally:
            os.chdir(os.path.join(os.getcwd(), "tests"))

class TestDiagnosesRoutes():
    def test_add_diagnosis_routes(self, client):
        payload = {
            "location": {"display_name": "canada"},
            "diagnoses": "Diagnosis1",
            "identifier": "T",
            "age": 45,
            "filename": "tests/test_input",
            "gender": "M"
        }
        response = client.post('/api/diagnoses', data=json.dumps(payload), content_type="application/json")
        assert response.status_code == 200

        payload = {
            "location": {"display_name": "canada"},
            "diagnoses": "Diagnosis1"
        }
        response = client.post('/api/diagnoses', data=json.dumps(payload), content_type="application/json")
        assert response.status_code == 200

    def test_add_diagnosis_routes_invalid_data(self, client):
        payload = {
            "location": {"display_name": "canada"},
            "diagnoses": None,
            "identifier": "T",
            "age": 45,
            "filename": "tests/test_input",
            "gender": "M"
        }
        response = client.post('/api/diagnoses', data=json.dumps(payload), content_type="application/json")
        assert response.status_code == 500

    def test_add_diagnosis_routes_missing_data(self, client):
        payload = {
            "diagnoses": "Diagnosis1",
            "identifier": "T",
            "age": 45,
            "filename": "tests/test_input",
            "gender": "M"
        }
        response = client.post('/api/diagnoses', data=json.dumps(payload), content_type="application/json")
        assert response.status_code == 400

        payload = None
        response = client.post('/api/diagnoses', content_type="application/json")
        assert response.status_code == 400

    def test_get_diagnoses_details(self, client):
        response = client.get('/api/getdiagnoses')
        assert response.status_code == 200
        assert "Diagnosis1" in response.json["canada"] 
        assert "Diagnosis2" in response.json["canada"]
        assert response.json["canada"]["Diagnosis1"] == 1
        assert "us" in response.json.keys()

class TestMapRoutes():
    def test_add_map_details(self, client):
        payload = {
            "location": {
                "display_name": "Canada",
                "lon": 45.3,
                "lat": 33.2
            },
            "filename": "tests/test_input/file",
            "identifier": "TEST",
        }

        response = client.post('api/map', data=json.dumps(payload), content_type="application/json")
        assert response.status_code == 200

        payload = {
            "location": {
                "display_name": "Canada",
                "lon": 45.3,
                "lat": 33.2
            }
        }

        response = client.post('api/map', data=json.dumps(payload), content_type="application/json")
        assert response.status_code == 200

    def test_add_map_details_invalid_data(self, client):
        payload = {
            "location": {
                "display_name": "Canada"
            },
            "filename": "tests/test_input/file",
            "identifier": "TEST",
            "lon": 33.445,
            "lat": 32.322
        }

        response = client.post('api/map', data=json.dumps(payload), content_type="application/json")
        assert response.status_code == 500

    def test_add_map_details_missing_data(self, client):
        payload = {
            "filename": "tests/test_input/file",
            "identifier": "TEST",
        }

        response = client.post('api/map', data=json.dumps(payload), content_type="application/json")
        assert response.status_code == 400

        payload = None
        response = client.post('api/map', data=json.dumps(payload), content_type="application/json")
        assert response.status_code == 400

    def test_get_map_details(self, client):
        response = client.get('api/getmap')

        assert response.status_code == 200

        map1 = [i for i in response.json if i['display_name'] == 'Canada'][0]
        map2 = [i for i in response.json if i['display_name'] == 'USA'][0]
        map3 = [i for i in response.json if i['display_name'] == 'Germany'][0]

        assert map1["identifier"] == "TESTMAP1"
        assert map2["identifier"] == "TESTMAP2"
        assert map3["identifier"] == "TESTMAP3"