(function() {

L.wgs84 = new OpenLayers.Projection("EPSG:4326");
L.map_proj = new OpenLayers.Projection("EPSG:900913");

L.proj = function(value) {
    return value.transform(L.wgs84, L.map_proj);
};

L.invproj = function(value) {
    return value.transform(L.map_proj, L.wgs84);
};

L.download = function(bbox) {
    return $.get('/download', {bbox: bbox});
};

L.message = function() {
    var div = $('#message').empty().addClass('visible');
    div.append.apply(div, arguments);
    $('<a class="button close">[x]</a>').appendTo(div).click(function(evt) {
        evt.preventDefault();
        L.hide_message();
    });
};

L.hide_message = function() {
    $('#message').removeClass('visible');
};

L.parse_xml = function(xml_src) {
    var root_node = $.parseXML(xml_src.replace(/>\s+</g, '><')).firstChild;
    $('*', root_node).each(function(i, node) {
        node.namespaceURI = "";
    });
    return root_node;
};

L.serialize_xml = function(xml_root) {
    xml_str = new XMLSerializer().serializeToString(xml_root);
    return ('<?xml version="1.0" encoding="UTF-8" ?>\n' +
            vkbeautify(xml_str, 'xml'));
};

L.xml_base64_data_url = function(xml_root) {
    var unicode_data = L.serialize_xml(xml_root);
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

L.api_upload = function(osm_diff) {
    $.ajax('/upload_changeset', {
        type: 'POST',
        contentType: 'text/xml',
        data: L.serialize_xml(osm_diff),
        success: function(data) {
            L.message(data);
        },
        error: function(data) {
            L.message(data.responseText);
        }
    });
};


L.initialize_map = function() {
    L.map = new OpenLayers.Map('map');
    L.map.addLayer(new OpenLayers.Layer.OSM("OpenStreetMap"));
    L.map.setCenter(L.proj(new OpenLayers.LonLat(13.4055, 52.5219)), 13);
};


L.main = function() {
    L.initialize_map();
    var menu_div = $('#menu');
    var edit_button = $('<a href="#" class="button">').text('edit');
    edit_button.appendTo(menu_div).click(function(evt) {
        evt.preventDefault();
        L.EC = L.EditingContext(L.map);
        edit_button.hide();
        L.EC.on('osm_loaded', function() {
            $('<div>').append(
                'upload to [',
                $('<a href="#" class="download button">').click(function(evt) {
                    evt.preventDefault();
                    L.api_upload(L.EC.diff());
                }).text('osm api'),
                ']; download [',
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
};


L.load_templates = function() {
    L.template = {};
    $('script[type^="text/template"]').each(function() {
        var name = $(this).attr('name');
        var tmpl = _.template($(this).text());
        function render(context) {
            var full_context = _({template: L.template}).extend(context);
            return tmpl(full_context);
        }
        L.template[name] = render;
        $(this).remove();
    });
};


})();
