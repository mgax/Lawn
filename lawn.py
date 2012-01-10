import os
import flask


webpages = flask.Blueprint('webpages', __name__)


@webpages.route('/')
def home():
    return flask.render_template('home.html')


@webpages.route('/download')
def download():
    app = flask.current_app
    if 'DEMO_FILE' in app.config:
        osm_data = open(app.config['DEMO_FILE']).read()
        return flask.Response(osm_data, mimetype='text/xml')
    else:
        raise NotImplementedError


def create_app():
    app = flask.Flask(__name__)
    app.register_blueprint(webpages)
    if 'APP_SETTINGS' in os.environ:
        app.config.from_envvar('APP_SETTINGS')
    if 'OPENLAYERS_SRC' in app.config:
        from werkzeug.wsgi import SharedDataMiddleware
        app.wsgi_app = SharedDataMiddleware(app.wsgi_app, {
            '/static/openlayers': app.config['OPENLAYERS_SRC'],
        })
    return app


if __name__ == '__main__':
    app = create_app()
    host = app.config.get('LISTEN_HOST', '127.0.0.1')
    app.run(host, debug=True)
