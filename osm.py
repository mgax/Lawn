import urllib, urlparse
import flask
import oauth2
import requests


class OsmApi(object):

    def __init__(self, api_url):
        self.api_url = api_url.rstrip('/')

    def get_data(self, bbox):
        url = self.api_url + '/api/0.6/map'
        rq = requests.get(url, params={'bbox': bbox})
        return rq.text


def oauth_client():
    app = flask.current_app
    if 'osm_oauth_token_secret' in flask.session:
        access_token = oauth2.Token(flask.session['osm_oauth_token'],
                                    flask.session['osm_oauth_token_secret'])
    else:
        access_token = None
    consumer = oauth2.Consumer(key=app.config['OAUTH_CONSUMER_KEY'],
                               secret=app.config['OAUTH_CONSUMER_SECRET'])
    return oauth2.Client(consumer, access_token)


def initialize_app(app):
    def _fetch_tokens(step_slug):
        app = flask.current_app
        request_token_url = app.config['OSM_API_URL'] + "/oauth/" + step_slug
        resp, content = oauth_client().request(request_token_url, "POST")
        resp = dict(urlparse.parse_qsl(content))
        flask.session['osm_oauth_token'] = resp['oauth_token']
        flask.session['osm_oauth_token_secret'] = resp['oauth_token_secret']
        flask.session.permanent = True

    @app.route('/authorize')
    def authorize():
        app = flask.current_app
        _fetch_tokens('request_token')
        args = [ ('oauth_token', flask.session['osm_oauth_token']) ]
        if app.config['OAUTH_ENABLE_CALLBACK']:
            callback_url = flask.url_for('authorize_callback', _external=True)
            args.append( ('oauth_callback', callback_url) )
        return flask.redirect(app.config['OSM_API_URL'] +
                              '/oauth/authorize?' + urllib.urlencode(args))

    @app.route('/authorize_callback')
    def authorize_callback():
        if app.config['OAUTH_ENABLE_CALLBACK']:
            assert (flask.request.args['oauth_token'] ==
                    flask.session['osm_oauth_token'])
        _fetch_tokens('access_token')
        return 'auth done!'
