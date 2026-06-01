from flask import Flask, send_from_directory
from flask_cors import CORS
from database import init_db
import os

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

BUILD_DIR = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'build')

def create_app():
    app = Flask(__name__, static_folder=BUILD_DIR, static_url_path='')
    app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
    app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024 * 1024

    CORS(app)
    init_db()

    from routes.files import files_bp
    app.register_blueprint(files_bp, url_prefix='/api')

    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve(path):
        if path.startswith('api/'):
            return {'error': 'Not found'}, 404
        full = os.path.join(BUILD_DIR, path)
        if path and os.path.exists(full):
            return send_from_directory(BUILD_DIR, path)
        return send_from_directory(BUILD_DIR, 'index.html')

    return app

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5002))
    app = create_app()
    app.run(debug=False, host='0.0.0.0', port=port)
