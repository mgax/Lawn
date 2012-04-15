(function() {

_.mixin({
    pop: function(obj, key) {
        if(_.isArray(obj)) {
            return obj.splice(key, 1)[0];
        }
        if(_.has(obj, key)) {
            var value = obj[key];
            delete obj[key];
            return value;
        }
    }
});


L.Base = function(options) {
    this.initialize.apply(this, arguments);
};
_.extend(L.Base.prototype, Backbone.Events, {
    initialize: function() {}
});
L.Base.extend = Backbone.Model.extend;


L.wgs84 = new OpenLayers.Projection("EPSG:4326");
L.map_proj = new OpenLayers.Projection("EPSG:900913");

L.proj = function(value) {
    return value.transform(L.wgs84, L.map_proj);
};

L.invproj = function(value) {
    return value.transform(L.map_proj, L.wgs84);
};

L.precision = Math.pow(10, 7);
L.quantize = function(value) {
    return parseInt(value * L.precision) / L.precision;
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

L.xml_node = function(tag_name, attributes) {
    var xml = $.parseXML('<' + tag_name + '/>').firstChild;
    if(attributes) {
        $(xml).attr(attributes);
    }
    return xml;
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


L.initialize_map = function(options) {
    options = _({
        lon: 13.4055,
        lat: 52.5219,
        zoom: 13
    }).extend(options);
    L.map = new OpenLayers.Map('map');
    var osm_layer = new OpenLayers.Layer.OSM("OpenStreetMap");
    L.map.addLayer(osm_layer);
    L.grayscale(osm_layer);
    var center = new OpenLayers.LonLat(options['lon'], options['lat']);
    L.map.setCenter(L.proj(center), options['zoom']);
};


L.main = function() {
    L.initialize_map();
    var buttons_div = $('<div class="editing_context-actions">');
    buttons_div.appendTo($('#menu'));
    var edit_button = $('<a href="#" class="button">').text('edit');

    L.EC = new L.EditingContext({map: L.map});

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
        ).appendTo(buttons_div);
    });

    edit_button.appendTo(buttons_div).click(function(evt) {
        evt.preventDefault();
        edit_button.hide();
        L.EC.begin_selection();
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


L.grayscale = function(layer) {
    if (!OpenLayers.CANVAS_SUPPORTED) { return; }

    layer.events.register('tileloaded', null, function(evt) {
        var ctx = evt.tile.getCanvasContext();
        if (ctx) {
            var imgd = ctx.getImageData(0, 0, evt.tile.size.w, evt.tile.size.h);
            var pix = imgd.data;
            for (var i = 0, n = pix.length; i < n; i += 4) {
                var v = (3 * pix[i] + 4 * pix[i + 1] + pix[i + 2]) / 8;
                pix[i] = pix[i + 1] = pix[i + 2] = v;
            }
            ctx.putImageData(imgd, 0, 0);
            evt.tile.imgDiv.removeAttribute("crossorigin");
            evt.tile.imgDiv.src = ctx.canvas.toDataURL();
        }
    });
};


})();
