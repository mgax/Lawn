import os
import flask
import flaskext.script
from osm import OsmApi


DEFAULT_CONFIG = {
    'OSM_API_URL': "http://api06.dev.openstreetmap.org/",
}


webpages = flask.Blueprint('webpages', __name__)


@webpages.route('/')
def home():
    return flask.render_template('home.html')


@webpages.route('/download')
def download():
    app = flask.current_app
    bbox = flask.request.args['bbox']
    osm_data = OsmApi(app.config['OSM_API_URL']).get_data(bbox)
    return flask.Response(osm_data, mimetype='text/xml')


@webpages.route('/test_delta')
def test_delta():
    return flask.render_template('test_delta.html')


def create_app():
    app = flask.Flask(__name__, instance_relative_config=True)
    app.register_blueprint(webpages)
    app.config.update(DEFAULT_CONFIG)
    app.config.from_pyfile('settings.py', silent=True)
    if 'OPENLAYERS_SRC' in app.config:
        from werkzeug.wsgi import SharedDataMiddleware
        app.wsgi_app = SharedDataMiddleware(app.wsgi_app, {
            '/static/openlayers': app.config['OPENLAYERS_SRC'],
        })
    return app


manager = flaskext.script.Manager(create_app)


if __name__ == '__main__':
    manager.run()
