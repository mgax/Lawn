import os
import datetime
import flask
import flaskext.script
import dbsession
import osm


DEFAULT_CONFIG = {
    'OSM_API_URL': "http://api06.dev.openstreetmap.org/",
    'OAUTH_ENABLE_CALLBACK': False,
    'PERMANENT_SESSION_LIFETIME': datetime.timedelta(days=365),
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
    print flask.request.data
    return 'wip'


@webpages.route('/test_delta')
def test_delta():
    return flask.render_template('test_delta.html')


def create_app():
    app = flask.Flask(__name__, instance_relative_config=True)
    app.register_blueprint(webpages)
    app.config.update(DEFAULT_CONFIG)
    app.config.from_pyfile('settings.py', silent=True)
    dbsession.initialize_app(app)
    if 'OPENLAYERS_SRC' in app.config:
        from werkzeug.wsgi import SharedDataMiddleware
        app.wsgi_app = SharedDataMiddleware(app.wsgi_app, {
            '/openlayers-src': app.config['OPENLAYERS_SRC'],
        })
        app.config['OPENLAYERS_JS'] = '/openlayers-src/lib/OpenLayers.js'
    else:
        with app.test_request_context():
            app.config['OPENLAYERS_JS'] = flask.url_for('static',
                filename='lib/openlayers/OpenLayers.js')
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
