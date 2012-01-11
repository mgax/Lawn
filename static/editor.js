(function(L) {


L.editing_context = function(map) {
    var EC = {map: map};
    EC.download_layer = new OpenLayers.Layer.Vector('Edit', {});
    EC.map.addLayer(EC.download_layer);

    EC.edit_control = new OpenLayers.Control.ModifyFeature(EC.download_layer, {
        vertexRenderIntent: 'temporary',
        mode: OpenLayers.Control.ModifyFeature.RESIZE |
              OpenLayers.Control.ModifyFeature.RESHAPE |
              OpenLayers.Control.ModifyFeature.DRAG
    });
    EC.map.addControl(EC.edit_control);
    EC.edit_control.activate();

    var bounds = EC.map.calculateBounds().scale(0.5);
    var box = new OpenLayers.Feature.Vector(bounds.toGeometry());
    EC.download_layer.addFeatures([box]);

    var download_button = $('<a href="#" class="button">').text('download');
    EC.node_layer = new OpenLayers.Layer.Vector('Nodes', {});
    EC.way_layer = new OpenLayers.Layer.Vector('Ways', {});
    download_button.click(function(evt) {
        evt.preventDefault();
        L.hide_message();
        EC.edit_control.deactivate();
        EC.map.removeControl(EC.edit_control);
        EC.download_layer.removeFeatures([box]);
        EC.map.removeLayer(EC.download_layer);
        var b = L.project_from_map(box.geometry.bounds);
        var bbox = b.left + ',' + b.bottom + ',' + b.right + ',' + b.top;
        console.log('downloading...', bbox);
        L.download(bbox).done(function(data) {
            console.log('nodes: ' + $('osm > node', data).length);
            console.log('ways: ' + $('osm > way', data).length);
            console.log('relations: ' + $('osm > relation', data).length);
            EC.map.addLayers([EC.node_layer, EC.way_layer]);
            display_osm(data, EC.node_layer, EC.way_layer);
            EC.edit_control = new OpenLayers.Control.ModifyFeature(EC.node_layer);
            EC.map.addControl(EC.edit_control);
            EC.edit_control.activate();
        });
    });
    L.message("Select area then click ", download_button);
    return EC;
};

function display_osm(osm_doc, node_layer, way_layer) {
    var node_map = {};
    $('osm > node', osm_doc).each(function() {
        var node = $(this);
        var lon = node.attr('lon'),
            lat = node.attr('lat');
        var point = new OpenLayers.Geometry.Point(lon, lat);
        var feature = new OpenLayers.Feature.Vector(L.project_to_map(point));
        node_layer.addFeatures([feature]);
        node_map[node.attr('id')] = feature;
    });

    $('osm > way', osm_doc).each(function() {
        var way = $(this);
        var line_string = new OpenLayers.Geometry.LineString();
        $('> nd', way).each(function() {
            var node_feature = node_map[$(this).attr('ref')];
            line_string.addComponent(node_feature.geometry);
        });
        var feature = new OpenLayers.Feature.Vector(line_string);
        way_layer.addFeatures([feature]);
    });
}

})(window.L);
