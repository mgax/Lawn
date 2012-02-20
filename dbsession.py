# inspired by http://flask.pocoo.org/snippets/75/
# and http://flask.pocoo.org/snippets/86/

import os.path
import pickle
from datetime import datetime
import sqlite3
from uuid import uuid4
from werkzeug.datastructures import CallbackDict
from flask.sessions import SessionInterface, SessionMixin


class DbSession(CallbackDict, SessionMixin):

    def __init__(self, initial=None, sid=None, new=False):
        def on_update(self):
            self.modified = True
        CallbackDict.__init__(self, initial, on_update)
        self.sid = sid
        self.new = new
        self.modified = False


class DbSessionInterface(SessionInterface):
    serializer = pickle
    session_class = DbSession

    _create_sql = ('CREATE TABLE IF NOT EXISTS session '
                   '(sid TEXT PRIMARY KEY, data BLOB, time TIMESTAMP)')
    _get_sql = 'SELECT data FROM session WHERE sid = ?'
    _set_sql = 'REPLACE INTO session (sid, data, time) VALUES (?, ?, ?)'
    _del_sql = 'DELETE FROM session WHERE sid = ?'

    def __init__(self, db_path):
        self.db_path = db_path
        self.conn = None
        with self._get_conn() as conn:
            conn.execute(self._create_sql)

    def _get_conn(self):
        return sqlite3.Connection(self.db_path) # TODO use connection pool

    def generate_sid(self):
        return str(uuid4())

    def open_session(self, app, request):
        sid = request.cookies.get(app.session_cookie_name)
        if not sid:
            sid = self.generate_sid()
            return self.session_class(sid=sid)

        with self._get_conn() as conn:
            for row in conn.execute(self._get_sql, (sid,)):
                data = self.serializer.loads(str(row[0]))
                return self.session_class(data, sid=sid)

        return self.session_class(sid=sid, new=True)

    def save_session(self, app, session, response):
        domain = self.get_cookie_domain(app)

        if not session:
            with self._get_conn() as conn:
                conn.execute(self._del_sql, (session.sid,))

            if session.modified:
                response.delete_cookie(app.session_cookie_name, domain=domain)

            return

        val = self.serializer.dumps(dict(session))
        now = datetime.utcnow()

        with self._get_conn() as conn:
            conn.execute(self._set_sql, (session.sid, val, now))

        response.set_cookie(app.session_cookie_name,
                            session.sid,
                            expires=self.get_expiration_time(app, session),
                            httponly=True,
                            domain=domain)


def initialize_app(app):
    path = os.path.join(app.instance_path, 'sessions.sqlite')
    app.session_interface = DbSessionInterface(path)
