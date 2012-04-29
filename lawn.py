#!/usr/bin/env python

import os
import datetime
from path import path
import flask
import flaskext.script
import dbsession
import osm


__version__ = '0.1.0'


DEFAULT_CONFIG = {
    'OSM_API_URL': "http://api06.dev.openstreetmap.org/",
    'OAUTH_ENABLE_CALLBACK': False,
    'PERMANENT_SESSION_LIFETIME': datetime.timedelta(days=365),
    'OSM_XML_SIGNATURE': "Lawn %s" % __version__,
    'OPENLAYERS_JS': 'lib/openlayers/OpenLayers.js',
}


webpages = flask.Blueprint('webpages', __name__)


@webpages.route('/')
def home():
    return flask.render_template('home.html')


@webpages.route('/download')
def download():
    app = flask.current_app
    bbox = flask.request.args['bbox']
    osm_data = osm.OsmApi(app.config['OSM_API_URL']).get_data(bbox)
    return flask.Response(osm_data, mimetype='text/xml')


@webpages.route('/upload_changeset', methods=['POST'])
def upload_changeset():
    app = flask.current_app
    changeset_xml_str = flask.request.data
    osm_api = osm.OsmApi(app.config['OSM_API_URL'])
    try:
        changeset_id = osm_api.upload_changeset(changeset_xml_str)
    except osm.OsmApiError, e:
        return "OSM API error: %s" % e.message, 400
    return 'Changeset %d uploaded' % changeset_id


@webpages.route('/test/<string:test_name>')
def test_page(test_name):
    if '..' in test_name:
        flask.abort(404)
    tmpl_name = 'test_%s.html' % test_name
    tmpl_path = path(__file__).parent.abspath()/'templates'/tmpl_name
    if not tmpl_path.exists():
        flask.abort(404)
    return flask.render_template(tmpl_name)


def create_app():
    app = flask.Flask(__name__, instance_relative_config=True)
    app.register_blueprint(webpages)
    app.config.update(DEFAULT_CONFIG)
    app.config.from_pyfile('settings.py', silent=True)
    dbsession.initialize_app(app)

    if 'STATIC_URL_MAP' in app.config:
        from werkzeug.wsgi import SharedDataMiddleware
        app.wsgi_app = SharedDataMiddleware(app.wsgi_app,
                                            app.config['STATIC_URL_MAP'])

    app.config['OSM_API_URL'] = app.config['OSM_API_URL'].rstrip('/')
    osm.initialize_app(app)
    return app


manager = flaskext.script.Manager(create_app)


def _error_log(error_log_path):
    import logging
    error_handler = logging.FileHandler(error_log_path)
    log_fmt = logging.Formatter("[%(asctime)s] %(module)s "
                                "%(levelname)s %(message)s")
    error_handler.setFormatter(log_fmt)
    error_handler.setLevel(logging.ERROR)
    logging.getLogger().addHandler(error_handler)


class FcgiCommand(flaskext.script.Command):

    def handle(self, app):
        _error_log(os.path.join(app.instance_path, 'error.log'))
        from flup.server.fcgi import WSGIServer
        sock_path = os.path.join(app.instance_path, 'fcgi.sock')
        server = WSGIServer(app, bindAddress=sock_path, umask=0)
        server.run()

manager.add_command('fcgi', FcgiCommand())


if __name__ == '__main__':
    manager.run()
