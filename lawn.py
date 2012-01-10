import os
import flask


webpages = flask.Blueprint('webpages', __name__)


@webpages.route('/')
def home():
    return flask.render_template('home.html')


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
    app.run(debug=True)
