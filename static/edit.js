(function(L) {


L.EditingContext = function(map) {
    var self = {map: map};

    self.dispatch = L.Dispatch(self);

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
    self.edit_control.selectControl.select(box);

    self._last_generated_id = 0;
    self.generate_id = function() {
        self._last_generated_id -= 1;
        return self._last_generated_id;
    };

    var download_button = $('<a href="#" class="button">').text('download');
    self.node_layer = new OpenLayers.Layer.Vector('Nodes', {});
    self.node_layer.styleMap =  new OpenLayers.StyleMap({
        "default": new OpenLayers.Style({
            pointRadius: "15",
            fillColor: "#ffcc66",
            fillOpacity: 0.5,
            strokeColor: "#ff9933",
            strokeWidth: 2,
            graphicZIndex: 1
        }),
        "select": new OpenLayers.Style({
            fillColor: "#66ccff",
            strokeColor: "#3399ff",
            graphicZIndex: 2
        })
    });

    self.way_layer = new OpenLayers.Layer.Vector('Ways', {});
    download_button.click(function(evt) {
        evt.preventDefault();
        L.hide_message();
        self.edit_control.deactivate();
        self.map.removeControl(self.edit_control);
        self.download_layer.removeFeatures([box]);
        self.map.removeLayer(self.download_layer);
        var b = L.invproj(box.geometry.bounds);
        var bbox = b.left + ',' + b.bottom + ',' + b.right + ',' + b.top;
        L.download(bbox).done(function(data) {
            self.original_data = $('osm', data)[0];
            self.current_data = $(self.original_data).clone()[0];
            $(self.current_data).attr('generator', L.xml_signature);
            self.node_map = {};
            self.diff = function() {
                return L.xml_diff(self.original_data, self.current_data);
            };
            self.dispatch({type: 'osm_loaded'});
            self.map.addLayers([self.node_layer, self.way_layer]);
            self.display_osm(self.current_data);

            self.draw_node_control = new OpenLayers.Control.DrawFeature(
                self.node_layer, OpenLayers.Handler.Point);
            self.map.addControl(self.draw_node_control);
            self.draw_node_control.events.register('featureadded', null, function(evt) {
                var feature = evt.feature;
                var coords = L.invproj(feature.geometry.clone());
                var node = L.xml_node('node');
                $(node).attr({
                    lon: coords.x,
                    lat: coords.y,
                    id: self.generate_id(),
                    version: 1
                });
                $(self.current_data).append(node);
                self.display_osm_node(node, feature);
                self.draw_node_control.deactivate();
                self.select_control.activate();
                self.modify_control.activate();
                self.select_control.select(feature);
            });

            self.node_create = L.NodeCreate();
            self.node_create.on('create_node', function() {
                self.select_control.deactivate();
                self.modify_control.deactivate();
                self.draw_node_control.activate();
            });

            self.modify_control = new OpenLayers.Control.ModifyFeature(
                self.node_layer,
                {standalone: true});
            self.map.addControl(self.modify_control);
            self.modify_control.activate();

            self.node_layer.events.on({
                'featuremodified': function(evt) {
                    var feature = evt.feature;
                    var new_position = L.invproj(feature.geometry.clone());
                    self.node_editor.update_position(new_position);
                    var way_features = $(feature.osm_node).data('view-ways');
                    self.way_layer.eraseFeatures(way_features);
                    $.each(way_features, function(i, feature) {
                        self.way_layer.drawFeature(feature);
                    });
                }
            });

            self.select_control = new OpenLayers.Control.SelectFeature(
                self.node_layer,
                {
                    onSelect: self.modify_control.selectFeature,
                    onUnselect: self.modify_control.unselectFeature,
                    scope: self.modify_control
                });
            self.select_control.events.on({
                'featurehighlighted': function(e) {
                    self.node_create.hide();
                    var feature = e.feature;
                    self.node_editor = L.NodeEditor(feature.osm_node);
                    self.node_editor.on('close', function() {
                        self.node_editor = null;
                        self.select_control.unselect(feature);
                    });
                    self.node_editor.on('remove', function() {
                        var node = feature.osm_node
                        self.node_layer.eraseFeatures([feature]);
                        var way_features = $(node).data('view-ways');
                        self.way_layer.eraseFeatures(way_features);
                        $.each(way_features, function(i, way_feature) {
                            way_feature.geometry.removeComponent(feature.geometry);
                            self.way_layer.drawFeature(way_feature);
                        });
                    });
                },
                'featureunhighlighted': function(e) {
                    if(self.node_editor) self.node_editor.close();
                    self.node_create.show();
                }
            });
            self.map.addControl(self.select_control);
            self.select_control.activate();
        });
    });
    L.message("Select area then click ", download_button);

    self.display_osm_node = function(node, feature) {
        var $node = $(node);
        if(! feature) {
            var lon = $node.attr('lon'),
                lat = $node.attr('lat');
            var point = new OpenLayers.Geometry.Point(lon, lat);
            feature = new OpenLayers.Feature.Vector(L.proj(point));
            self.node_layer.addFeatures([feature]);
        }
        feature.osm_node = node;
        $node.data('view-feature', feature);
        $node.data('view-ways', []);
        self.node_map[$node.attr('id')] = node;
    };

    self.display_osm_way = function(way, feature) {
        if(! feature) {
            var line_string = new OpenLayers.Geometry.LineString();
            $('> nd', way).each(function(i, nd) {
                var node = self.node_map[$(nd).attr('ref')];
                var node_feature = $(node).data('view-feature');
                line_string.addComponent(node_feature.geometry);
            });
            feature = new OpenLayers.Feature.Vector(line_string);
            self.way_layer.addFeatures([feature]);
        }
        feature.osm_way = way;
        $('> nd', way).each(function(i, nd) {
            var node = self.node_map[$(nd).attr('ref')];
            $(node).data('view-ways').push(feature);
        });
    };

    self.display_osm = function(osm_doc) {
        $('> node', osm_doc).each(function() {
            self.display_osm_node(this);
        });

        $('> way', osm_doc).each(function() {
            self.display_osm_way(this);
        });
    };

    return self;
};

L.xml_node = function(tag_name) {
    return $.parseXML('<' + tag_name + '/>').firstChild;
};


L.NodeEditor = function(node) {
    var self = {node: $(node)};

    self.dispatch = L.Dispatch(self);

    self.box = $('<div class="node-properties">').insertAfter($('#menu'));

    self.box.append($('<div class="button-box">').append(
        '[',
        $('<a href="#" class="close button">').click(function(evt) {
            evt.preventDefault();
            self.close();
        }).text('x'),
        ']'
    ));
    $('<div>').append('node ' + self.node.attr('id')).appendTo(self.box);
    $('<div>').append('lat: <span class="node-lat">').appendTo(self.box);
    $('<div>').append('lat: <span class="node-lon">').appendTo(self.box);

    function display_position() {
        $('span.node-lat', self.box).text(self.node.attr('lat'));
        $('span.node-lon', self.box).text(self.node.attr('lon'));
    }
    display_position();

    var tag_table = $('<table class="node-tags">').appendTo(self.box);
    tag_table.html('<thead><tr><th>Key</th><th>Value</th></tr></thead>');

    function new_tag_row(key, value) {
        var key_input = $('<td>').append($('<input name="key">').val(key));
        var val_input = $('<td>').append($('<input name="value">').val(value));
        $('<tr class="tag">').appendTo(tag_table).append(key_input, val_input);
    }

    $('> tag', self.node).each(function() {
        var tag = $(this);
        new_tag_row(tag.attr('k'), tag.attr('v'));
    });

    self.box.append($('<div>').append(
        '[',
        $('<a href="#" class="new button">').click(function(evt) {
            evt.preventDefault();
            new_tag_row('', '');
        }).text('new tag'),
        '] [',
        $('<a href="#" class="delete button">').click(function(evt) {
            evt.preventDefault();
            self.delete();
        }).text('delete node'),
        ']'
    ));

    self.save = function() {
        $('> tag', self.node).remove();
        $('tr.tag', self.box).each(function() {
            var key = $('input[name=key]', this).val();
            var value = $('input[name=value]', this).val();
            if(key && value) {
                var tag = $(L.xml_node('tag')).attr({k: key, v: value});
                self.node.append(tag);
            }
        });
    };

    self.close = function() {
        self.save();
        self.box.remove();
        self.dispatch({type: 'close'});
    };

    self.update_position = function(new_position) {
        self.node.attr('lon', new_position.x);
        self.node.attr('lat', new_position.y);
        display_position();
    };

    self.delete = function() {
        self.close()
        self.dispatch({type: 'remove'});
        self.node.remove();
    };

    return self;
};


L.NodeCreate = function() {
    var self = {};

    self.dispatch = L.Dispatch(self);

    self.box = $('<div class="node-properties">').insertAfter($('#menu'));

    self.button_box = $('<div>').append(
        '[',
        $('<a href="#" class="new button">').click(function(evt) {
            evt.preventDefault();
            self.button_box.hide();
            self.message_box.show();
            self.dispatch({type: 'create_node'});
        }).text('create node'),
        ']'
    ).appendTo(self.box);

    self.message_box = $('<div>').text("Click on map").appendTo(self.box).hide();

    self.show = function() {
        self.message_box.hide();
        self.button_box.show();
        self.box.show();
    };

    self.hide = function() {
        self.box.hide();
    };

    return self;
};


})(window.L);
