from flask import Blueprint, request, jsonify, send_file, current_app
from database import get_db
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
import os, uuid, mimetypes

load_dotenv()

files_bp = Blueprint('files', __name__)

DAILY_TOKEN_LIMIT = 10
EXPIRY_HOURS = {'24h': 24, '2d': 48, '7d': 168}

USE_SUPABASE = (
    bool(os.getenv('SUPABASE_ACCESS_KEY')) and
    os.getenv('SUPABASE_ACCESS_KEY') != 'paste_your_project_url_here'
)

if USE_SUPABASE:
    from supabase_client import upload_file as sb_upload, stream_file as sb_stream, delete_file as sb_delete


def _now():
    return datetime.now(timezone.utc)

def _fmt_size(b):
    for unit in ['B', 'KB', 'MB', 'GB']:
        if b < 1024: return f'{b:.1f} {unit}'
        b /= 1024
    return f'{b:.1f} TB'

def _token_cost(size_bytes):
    mb = size_bytes / (1024 * 1024)
    if mb < 50:  return 1
    if mb < 500: return 2
    return 3

def _get_device_id():
    # Prefer browser device token (localStorage-based, per-browser not per-IP)
    device = request.headers.get('X-Device-Token', '').strip()
    if device:
        return f'd:{device[:64]}'
    # Fallback to IP
    ip = request.headers.get('X-Forwarded-For', request.remote_addr or '').split(',')[0].strip()
    return f'ip:{ip}'

def _tokens_used_today(device_id):
    today = _now().strftime('%Y-%m-%d')
    db  = get_db()
    row = db.execute('SELECT tokens_used FROM daily_usage WHERE device_id=? AND date=?', [device_id, today]).fetchone()
    db.close()
    return row['tokens_used'] if row else 0

def _deduct_tokens(device_id, cost):
    today = _now().strftime('%Y-%m-%d')
    db = get_db()
    db.execute(
        'INSERT INTO daily_usage (device_id, date, tokens_used) VALUES (?,?,?) '
        'ON CONFLICT(device_id,date) DO UPDATE SET tokens_used=tokens_used+?',
        [device_id, today, cost, cost]
    )
    db.commit()
    db.close()


@files_bp.route('/upload', methods=['POST'])
def upload():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    f = request.files['file']
    if not f.filename:
        return jsonify({'error': 'Empty filename'}), 400

    expires_in  = request.form.get('expires_in', '24h')
    owner_token = request.form.get('owner_token') or uuid.uuid4().hex
    if expires_in not in EXPIRY_HOURS:
        expires_in = '24h'

    device_id  = _get_device_id()
    rough_cost = _token_cost(request.content_length or 0)
    used       = _tokens_used_today(device_id)
    if used + rough_cost > DAILY_TOKEN_LIMIT:
        return jsonify({
            'error': f'Daily limit reached. {DAILY_TOKEN_LIMIT - used} token(s) left.',
            'tokens_left': DAILY_TOKEN_LIMIT - used,
            'tokens_limit': DAILY_TOKEN_LIMIT,
        }), 429

    token    = uuid.uuid4().hex[:10]
    ext      = os.path.splitext(f.filename)[1]
    stored   = f'{token}{ext}'
    mimetype = mimetypes.guess_type(f.filename)[0] or 'application/octet-stream'

    if USE_SUPABASE:
        f.stream.seek(0, 2)
        size = f.stream.tell()
        sb_upload(stored, f.stream, mimetype)
    else:
        save_path = os.path.join(current_app.config['UPLOAD_FOLDER'], stored)
        f.save(save_path)
        size = os.path.getsize(save_path)

    cost = _token_cost(size)
    used = _tokens_used_today(device_id)
    if used + cost > DAILY_TOKEN_LIMIT:
        if USE_SUPABASE:
            sb_delete(stored)
        else:
            os.remove(save_path)
        return jsonify({
            'error': f'Daily limit reached. {DAILY_TOKEN_LIMIT - used} token(s) left.',
            'tokens_left': DAILY_TOKEN_LIMIT - used,
            'tokens_limit': DAILY_TOKEN_LIMIT,
        }), 429

    expires_at = (_now() + timedelta(hours=EXPIRY_HOURS[expires_in])).isoformat()

    db = get_db()
    db.execute(
        'INSERT INTO files (token,owner_token,original_name,stored_name,size,mimetype,expires_in,expires_at) '
        'VALUES (?,?,?,?,?,?,?,?)',
        [token, owner_token, f.filename, stored, size, mimetype, expires_in, expires_at]
    )
    db.commit()
    db.close()

    _deduct_tokens(device_id, cost)
    tokens_left = DAILY_TOKEN_LIMIT - _tokens_used_today(device_id)

    return jsonify({
        'token':        token,
        'owner_token':  owner_token,
        'name':         f.filename,
        'size':         _fmt_size(size),
        'expires_in':   expires_in,
        'expires_at':   expires_at,
        'tokens_used':  cost,
        'tokens_left':  tokens_left,
        'tokens_limit': DAILY_TOKEN_LIMIT,
    }), 201


@files_bp.route('/file/<token>', methods=['GET'])
def file_info(token):
    db  = get_db()
    row = db.execute('SELECT * FROM files WHERE token=?', [token]).fetchone()
    db.close()
    if not row:
        return jsonify({'error': 'File not found or link expired'}), 404

    expires = datetime.fromisoformat(row['expires_at'])
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if _now() > expires:
        if not USE_SUPABASE:
            path = os.path.join(current_app.config['UPLOAD_FOLDER'], row['stored_name'])
            if os.path.exists(path): os.remove(path)
        db2 = get_db(); db2.execute('DELETE FROM files WHERE token=?', [token]); db2.commit(); db2.close()
        return jsonify({'error': 'This link has expired'}), 410

    return jsonify({
        'token':      row['token'],
        'name':       row['original_name'],
        'size':       _fmt_size(row['size']),
        'size_bytes': row['size'],
        'mimetype':   row['mimetype'],
        'expires_at': row['expires_at'],
        'created_at': row['created_at'],
    })


@files_bp.route('/preview/<token>', methods=['GET'])
def preview(token):
    db  = get_db()
    row = db.execute('SELECT * FROM files WHERE token=?', [token]).fetchone()
    db.close()
    if not row:
        return jsonify({'error': 'Not found'}), 404

    mimetype = row['mimetype'] or ''
    if not mimetype.startswith('image/'):
        return jsonify({'error': 'Not previewable'}), 400

    expires = datetime.fromisoformat(row['expires_at'])
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if _now() > expires:
        return jsonify({'error': 'Expired'}), 410

    if USE_SUPABASE:
        stream, _ = sb_stream(row['stored_name'])
        return send_file(stream, mimetype=mimetype)

    path = os.path.join(current_app.config['UPLOAD_FOLDER'], row['stored_name'])
    if not os.path.exists(path):
        return jsonify({'error': 'File missing'}), 404
    return send_file(path, mimetype=mimetype)


@files_bp.route('/download/<token>', methods=['GET'])
def download(token):
    db  = get_db()
    row = db.execute('SELECT * FROM files WHERE token=?', [token]).fetchone()
    if not row:
        db.close()
        return jsonify({'error': 'File not found'}), 404

    expires = datetime.fromisoformat(row['expires_at'])
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if _now() > expires:
        stored = row['stored_name']; db.close()
        if not USE_SUPABASE:
            path = os.path.join(current_app.config['UPLOAD_FOLDER'], stored)
            if os.path.exists(path): os.remove(path)
        db2 = get_db(); db2.execute('DELETE FROM files WHERE token=?', [token]); db2.commit(); db2.close()
        return jsonify({'error': 'Link expired'}), 410

    db.execute('UPDATE files SET downloads=downloads+1 WHERE token=?', [token])
    db.commit()
    db.close()

    if USE_SUPABASE:
        stream, ct = sb_stream(row['stored_name'])
        return send_file(
            stream,
            as_attachment=True,
            download_name=row['original_name'],
            mimetype=row['mimetype'] or ct,
        )

    path = os.path.join(current_app.config['UPLOAD_FOLDER'], row['stored_name'])
    if not os.path.exists(path):
        return jsonify({'error': 'File missing from server'}), 404
    return send_file(path, as_attachment=True, download_name=row['original_name'],
                     mimetype=row['mimetype'])


@files_bp.route('/delete/<token>', methods=['DELETE'])
def delete_file(token):
    db  = get_db()
    row = db.execute('SELECT * FROM files WHERE token=?', [token]).fetchone()
    if not row:
        db.close()
        return jsonify({'error': 'Not found'}), 404
    if USE_SUPABASE:
        sb_delete(row['stored_name'])
    else:
        path = os.path.join(current_app.config['UPLOAD_FOLDER'], row['stored_name'])
        if os.path.exists(path): os.remove(path)
    db.execute('DELETE FROM files WHERE token=?', [token])
    db.commit()
    db.close()
    return jsonify({'message': 'Deleted'})


@files_bp.route('/my/<owner_token>', methods=['GET'])
def my_files(owner_token):
    db   = get_db()
    rows = db.execute('SELECT * FROM files WHERE owner_token=? ORDER BY created_at DESC', [owner_token]).fetchall()
    db.close()
    now = _now()
    result = []
    for row in rows:
        expires = datetime.fromisoformat(row['expires_at'])
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        result.append({
            'token':      row['token'],
            'name':       row['original_name'],
            'size':       _fmt_size(row['size']),
            'mimetype':   row['mimetype'],
            'downloads':  row['downloads'],
            'expires_in': row['expires_in'],
            'expires_at': row['expires_at'],
            'created_at': row['created_at'],
            'expired':    now > expires,
        })
    return jsonify({'files': result})


@files_bp.route('/my/<owner_token>/<token>', methods=['DELETE'])
def delete_my_file(owner_token, token):
    db  = get_db()
    row = db.execute('SELECT * FROM files WHERE token=? AND owner_token=?', [token, owner_token]).fetchone()
    if not row:
        db.close()
        return jsonify({'error': 'Not found or not authorized'}), 404
    if USE_SUPABASE:
        sb_delete(row['stored_name'])
    else:
        path = os.path.join(current_app.config['UPLOAD_FOLDER'], row['stored_name'])
        if os.path.exists(path): os.remove(path)
    db.execute('DELETE FROM files WHERE token=?', [token])
    db.commit()
    db.close()
    return jsonify({'message': 'Deleted'})


@files_bp.route('/tokens', methods=['GET'])
def token_balance():
    device_id = _get_device_id()
    used      = _tokens_used_today(device_id)
    return jsonify({'limit': DAILY_TOKEN_LIMIT, 'used': used, 'left': DAILY_TOKEN_LIMIT - used})
