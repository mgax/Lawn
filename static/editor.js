(function(L) {


L.EditingContext = function(map) {
    var self = {map: map};
    self.download_layer = new OpenLayers.Layer.Vector('Edit', {});
    self.map.addLayer(self.download_layer);

    self.edit_control = new OpenLayers.Control.ModifyFeature(self.download_layer, {
        vertexRenderIntent: 'temporary',
        mode: OpenLayers.Control.ModifyFeature.RESIZE |
              OpenLayers.Control.ModifyFeature.RESHAPE |
              OpenLayers.Control.ModifyFeature.DRAG
    });
    self.map.addControl(self.edit_control);
    self.edit_control.activate();

    var bounds = self.map.calculateBounds().scale(0.5);
    var box = new OpenLayers.Feature.Vector(bounds.toGeometry());
    self.download_layer.addFeatures([box]);

    var download_button = $('<a href="#" class="button">').text('download');
    self.node_layer = new OpenLayers.Layer.Vector('Nodes', {});
    self.way_layer = new OpenLayers.Layer.Vector('Ways', {});
    download_button.click(function(evt) {
        evt.preventDefault();
        L.hide_message();
        self.edit_control.deactivate();
        self.map.removeControl(self.edit_control);
        self.download_layer.removeFeatures([box]);
        self.map.removeLayer(self.download_layer);
        var b = L.project_from_map(box.geometry.bounds);
        var bbox = b.left + ',' + b.bottom + ',' + b.right + ',' + b.top;
        console.log('downloading...', bbox);
        L.download(bbox).done(function(data) {
            console.log('nodes: ' + $('osm > node', data).length);
            console.log('ways: ' + $('osm > way', data).length);
            console.log('relations: ' + $('osm > relation', data).length);
            self.map.addLayers([self.node_layer, self.way_layer]);
            self.display_osm(data);
            self.edit_control = new OpenLayers.Control.ModifyFeature(self.node_layer);
            self.node_layer.events.on({
                'beforefeaturemodified': function(e) {
                    self.node_editor($(e.feature.osm_node));
                },
                'afterfeaturemodified': function(e) {
                    if(self.NE) self.NE.close();
                }
            });
            self.map.addControl(self.edit_control);
            self.edit_control.activate();
        });
    });
    L.message("Select area then click ", download_button);

    self.display_osm = function(osm_doc) {
        self.node_map = {};
        $('osm > node', osm_doc).each(function() {
            var node = $(this);
            var lon = node.attr('lon'),
                lat = node.attr('lat');
            var point = new OpenLayers.Geometry.Point(lon, lat);
            var feature = new OpenLayers.Feature.Vector(L.project_to_map(point));
            feature.osm_node = this;
            self.node_layer.addFeatures([feature]);
            self.node_map[node.attr('id')] = feature;
        });

        $('osm > way', osm_doc).each(function() {
            var way = $(this);
            var line_string = new OpenLayers.Geometry.LineString();
            $('> nd', way).each(function() {
                var node_feature = self.node_map[$(this).attr('ref')];
                line_string.addComponent(node_feature.geometry);
            });
            var feature = new OpenLayers.Feature.Vector(line_string);
            feature.osm_way = this;
            self.way_layer.addFeatures([feature]);
        });
    };

    self.node_editor = function(node) {
        var NE = self.NE = {};
        NE.form = $('<div class="node-tags">').insertAfter($('#menu'));
        NE.form.append('node ' + node.attr('id'));
        NE.close = function() {
            self.NE = null;
            NE.form.remove();
        };
    };

    return self;
};


})(window.L);
