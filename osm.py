import urllib, urlparse
import logging
import flask
import oauth2
import requests
import lxml.etree


log = logging.getLogger(__name__)
log.setLevel(logging.INFO)


def _fix_changeset_ids(changeset_xml, changeset_id):
    doc = lxml.etree.fromstring(changeset_xml)
    for element in doc.iter(tag=lxml.etree.Element):
        if 'changeset' in element.attrib:
            element.attrib['changeset'] = str(changeset_id)
    return lxml.etree.tostring(doc, pretty_print=True)


class OsmApiError(Exception):
    """ Error we received from the OSM API """


class OsmApi(object):

    def __init__(self, api_url):
        self.api_url = api_url.rstrip('/')

    def get_data(self, bbox):
        url = self.api_url + '/api/0.6/map'
        rq = requests.get(url, params={'bbox': bbox})
        return rq.text

    def oauth_request(self, relative_url, method='GET', data='', headers={}):
        client = oauth_client()
        url = self.api_url + relative_url
        log.debug('sending %s %s: %r', method, url, data)
        resp, content = client.request(url, method, data, headers)
        if resp['status'] != '200':
            log.error('oauth request error! resp: %r\ncontent: %r',
                      resp, content)
            raise OsmApiError(content)
        return content

    def upload_changeset(self, changeset_xml):
        app = flask.current_app
        changeset_create_data = (
            '<osm>\n'
            '  <changeset>\n'
            '    <tag k="created_by" v="%(xml_signature)s"/>\n'
            '    <tag k="comment" v="Test edit"/>\n'
            '  </changeset>\n'
            '</osm>\n'
        ) % {'xml_signature': app.config['OSM_XML_SIGNATURE']}
        changeset_id = int(self.oauth_request('/api/0.6/changeset/create',
                                              'PUT', changeset_create_data))
        log.info("Created new changeset %r", changeset_id)

        patched_changeset_xml = _fix_changeset_ids(changeset_xml, changeset_id)
        log.debug("Uploading changeset XML: %s", patched_changeset_xml)
        self.oauth_request('/api/0.6/changeset/%s/upload' % changeset_id,
                           'POST', patched_changeset_xml,
                           {'Content-Type': 'text/xml'})
        # TODO check the response body
        log.info("Uploaded osmchange xml")

        self.oauth_request('/api/0.6/changeset/%s/close' % changeset_id, 'PUT')
        log.info("Closed changeset %r", changeset_id)

        return changeset_id


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
