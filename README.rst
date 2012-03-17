OpenStreetMap editor
====================

This is an OpenStreetMap JavaScript editor. It makes heavy use of
OpenLayers_ for displaying the map and interacting with vector features,
with a lightweight Python server for talking to the OpenStreetMap HTTP
API. The aim is to provide a simple, non-Flash alternative to Potlatch_.

.. _OpenLayers: http://openlayers.org/
.. _Potlatch: http://wiki.openstreetmap.org/wiki/Potlatch_2


Usage
-----

The editor is deployed at http://lawn.grep.ro/ and configured to talk to
the `test API`_.

1. Perform OAuth: http://lawn.grep.ro/authorize. You should see the
   message `auth done!` if OAuth is successful.

2. Go to the map (http://lawn.grep.ro/) and download some data by
   clicking `edit` (top-right). Adjust the box from the center and
   bottom-right cursors then click the "download" link.

3. Make some changes: move nodes, select them and change properties, or
   create new nodes.

4. Click on "upload to osm api" (top right). It should say `Changeset
   NNN uploaded` if successful.

.. _`test API`: http://api06.dev.openstreetmap.org/


Status
------

The editor is in an early development stage. Currently you can download
data for a bounding box, add/remove nodes, edit their properties, and
upload the changeset to OSM or download it as an XML file. There is no
editing of ways or relations yet (apart from moving or deleting nodes).
Authentication to the API is done via OAuth.


Roadmap
-------

* Reorganize the JavaScript code using Backbone
* Edit ways and relations
* Styling (e.g. make the vector layer more visible, de-emphasize the
  background)
* Choose different background layers
* If possible, talk directly to the API using AJAX, without any
  intermediate web server
