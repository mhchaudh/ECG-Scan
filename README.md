# ECG Scan

ECG Scan is a web application for capturing, processing, and analyzing electrocardiogram (ECG) images. It extracts ECG waveform data, sends it to the backend for analysis, and compares patterns against stored medical data to provide diagnostic insights.

## Tech Stack

* React
* JavaScript
* Python
* Flask
* Django
* PostgreSQL

## Run Locally

Set up the backend first:

```bash
cd backend

python3 -m venv venv
source venv/bin/activate

pip install -r requirements.txt

flask --app run.py db init
flask --app run.py db migrate -m "Initial migration"
flask --app run.py db upgrade

python3 run.py
```

On Windows, activate the virtual environment with:

```bash
venv\Scripts\activate
```

Then set up the frontend in a separate terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the local development URL shown in your terminal in your browser.
