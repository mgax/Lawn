import requests


class OsmApi(object):

    def __init__(self, api_url):
        self.api_url = api_url.rstrip('/')

    def get_data(self, bbox):
        url = self.api_url + '/api/0.6/map'
        rq = requests.get(url, params={'bbox': bbox})
        return rq.text
