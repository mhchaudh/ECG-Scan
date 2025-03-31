from flask import Blueprint, request, jsonify
from ..services.ecg_service import process_ecg_for_diagnosis

ecg_bp = Blueprint('ecg_bp', __name__)


# expects an ECG signal + patient details and calls process_ecg_for_diagnosis
@ecg_bp.route('ecg/classify', methods=['POST'])
def classify_ecg():
    data = request.get_json()
    ecg = data.get('ecg')
    sex = data.get('sex')
    age = data.get('age')

    if not ecg or not sex or not age:
        return jsonify({'error': 'Missing required parameters'}), 400

    result = process_ecg_for_diagnosis(ecg, sex, age)

    return jsonify(result), 200
