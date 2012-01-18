(function() {

var L = window.L = {};

L.wgs84 = new OpenLayers.Projection("EPSG:4326");
L.map_proj = new OpenLayers.Projection("EPSG:900913");

L.project_to_map = function(value) {
    return value.transform(L.wgs84, L.map_proj);
};

L.project_from_map = function(value) {
    return value.transform(L.map_proj, L.wgs84);
};

L.download = function(bbox) {
    return $.get('/download', {bbox: bbox});
};

L.message = function() {
    var div = $('#message').empty().addClass('visible')
    div.append.apply(div, arguments);
};

L.hide_message = function() {
    $('#message').removeClass('visible');
};


$(document).ready(function() {
    L.map = new OpenLayers.Map('map');
    L.map.addLayer(new OpenLayers.Layer.OSM("OpenStreetMap"));
    L.map.setCenter(L.project_to_map(new OpenLayers.LonLat(26.082, 44.475)), 16);

    var menu_div = $('#menu');
    var edit_button = $('<a href="#" class="button">').text('edit');
    edit_button.appendTo(menu_div).click(function(evt) {
        evt.preventDefault();
        L.EC = L.EditingContext(L.map);
    });
});


})();
