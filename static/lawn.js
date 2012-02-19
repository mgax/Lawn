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

L.xml_signature = "Lawn 0.0.1";

L.xml_base64_data_url = function(xml_root) {
    var unicode_data = new XMLSerializer().serializeToString(xml_root);
    var utf8_data = unescape(encodeURIComponent(unicode_data));
    var base64_data = 'base64,' + $.base64.encode(utf8_data);
    return 'data:application/x-openstreetmap+xml;' + base64_data;
};

L.download_xml = function(xml_root, filename) {
    var url = L.xml_base64_data_url(xml_root);
    L.message(
        'Right-click, choose "Save Link As...", and type "' + filename + '": ',
        $('<a>').text(filename).attr('href', url)
    );
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
        edit_button.hide();
        L.EC.on('osm_loaded', function() {
            $('<div>').append(
                'download [',
                $('<a href="#" class="download button">').click(function(evt) {
                    evt.preventDefault();
                    L.download_xml(L.EC.current_data, 'layer.osm');
                }).text('layer'),
                '], [',
                $('<a href="#" class="download button">').click(function(evt) {
                    evt.preventDefault();
                    L.download_xml(L.EC.diff(), 'diff.osc');
                }).text('diff'),
                ']'
            ).appendTo(menu_div);
        });
    });
});


})();
