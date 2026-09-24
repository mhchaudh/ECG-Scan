from flask import Flask
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate


db = SQLAlchemy()

def create_app():
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///ecgdata.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    db.init_app(app)
    migrate = Migrate(app, db)

    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # Import and register blueprints
    from ECGenius.api.image_routes import image_bp
    from ECGenius.api.ecg_routes import ecg_bp
    from ECGenius.api.feedback_routes import feedback_bp
    from ECGenius.api.map_routes import map_bp
    from ECGenius.api.diagnoses_routes import diagnoses_bp
    from ECGenius.api.ecgresults_routes import ecgresults_bp

    app.register_blueprint(image_bp, url_prefix='/api')
    app.register_blueprint(ecg_bp, url_prefix='/api')
    app.register_blueprint(feedback_bp, url_prefix='/api')
    app.register_blueprint(map_bp, url_prefix='/api')
    app.register_blueprint(diagnoses_bp, url_prefix='/api')
    app.register_blueprint(ecgresults_bp, url_prefix='/api')
    return app
