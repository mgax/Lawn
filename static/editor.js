$(document).ready(function() {

var wgs84 = new OpenLayers.Projection("EPSG:4326");
var map_proj = new OpenLayers.Projection("EPSG:900913");
function project_to_map(value) {
    return value.transform(wgs84, map_proj);
}

function project_from_map(value) {
    return value.transform(map_proj, wgs84);
}

var map = new OpenLayers.Map('map');
map.addLayer(new OpenLayers.Layer.OSM("OpenStreetMap"));
map.setCenter(project_to_map(new OpenLayers.LonLat(26.082, 44.475)), 16);


var menu_div = $('#menu');

var edit_button = $('<a href="#" class="button">').text('edit');
edit_button.appendTo(menu_div).click(function(evt) {
    evt.preventDefault();
    window.EC = editing_context(map);
});

function editing_context(map) {
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
        hide_message();
        EC.edit_control.deactivate();
        EC.download_layer.removeFeatures([box]);
        EC.map.removeLayer(EC.download_layer);
        var b = project_from_map(box.geometry.bounds);
        var bbox = b.left + ',' + b.bottom + ',' + b.right + ',' + b.top;
        console.log('downloading...', bbox);
        download(bbox).done(function(data) {
            console.log('nodes: ' + $('osm > node', data).length);
            console.log('ways: ' + $('osm > way', data).length);
            console.log('relations: ' + $('osm > relation', data).length);
            EC.map.addLayers([EC.node_layer, EC.way_layer]);
            display_osm(data, EC.node_layer, EC.way_layer);
        });
    });
    message("Select area then click ", download_button);
    return EC;
}

function display_osm(osm_doc, node_layer, way_layer) {
    var node_map = {};
    $('osm > node', osm_doc).each(function() {
        var node = $(this);
        var lon = node.attr('lon'),
            lat = node.attr('lat');
        var point = new OpenLayers.Geometry.Point(lon, lat);
        var feature = new OpenLayers.Feature.Vector(project_to_map(point));
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

function download(bbox) {
    return $.get('/download', {bbox: bbox});
}

function message() {
    var div = $('#message').empty().addClass('visible')
    div.append.apply(div, arguments);
}

function hide_message() {
    $('#message').removeClass('visible');
}

});
