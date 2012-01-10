$(document).ready(function() {

var wgs84 = new OpenLayers.Projection("EPSG:4326");
function project_to_map(lonlat) {
    var map_proj = map.getProjectionObject();
    return lonlat.transform(wgs84, map_proj);
}

var map = new OpenLayers.Map('map');
map.addLayer(new OpenLayers.Layer.OSM("OpenStreetMap"));
map.setCenter(project_to_map(new OpenLayers.LonLat(26.082, 44.475)), 16);


var menu_div = $('#menu');

var edit_button = $('<a href="#" class="button">').text('edit');
edit_button.appendTo(menu_div).click(function(evt) {
    evt.preventDefault();
    editing_context();
});

function editing_context() {
    var layer = new OpenLayers.Layer.Vector('Edit', {});
    map.addLayer(layer);

    var edit_control = new OpenLayers.Control.ModifyFeature(layer, {
        vertexRenderIntent: 'temporary',
        mode: OpenLayers.Control.ModifyFeature.RESIZE |
              OpenLayers.Control.ModifyFeature.RESHAPE |
              OpenLayers.Control.ModifyFeature.DRAG
    });
    map.addControl(edit_control);
    edit_control.activate();

    var bounds = map.calculateBounds().scale(0.5);
    var box = new OpenLayers.Feature.Vector(bounds.toGeometry());
    layer.addFeatures([box]);

    var download_button = $('<a href="#" class="button">').text('download');
    download_button.click(function(evt) {
        evt.preventDefault();
        hide_message();
        edit_control.deactivate();
        layer.removeFeatures([box]);
        console.log('downloading...');
    });
    message("Select area then click ", download_button);
}

function message() {
    var div = $('#message').empty().addClass('visible')
    div.append.apply(div, arguments);
}

function hide_message() {
    $('#message').removeClass('visible');
}

});
