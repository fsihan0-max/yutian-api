from flask import Flask
from flask_cors import CORS

from .api.routes import api_bp
from .algorithms import legacy_engine


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app)
    legacy_engine.ensure_data_files()
    app.register_blueprint(api_bp)
    return app
