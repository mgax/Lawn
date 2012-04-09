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

    var node_style_map = new OpenLayers.StyleMap({
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

    self.edit_osm = function(data) {
        self.original_data = $('osm', data)[0];
        self.current_data = $(self.original_data).clone()[0];
        $(self.current_data).attr('generator', L.xml_signature);
        self.diff = function() {
            return L.xml_diff(self.original_data, self.current_data);
        };
        self.dispatch({type: 'osm_loaded'});
        self.model = new L.LayerModel({}, {xml: self.current_data});
        self.vector = new L.LayerVector({model: this.model});
        self.vector.node_layer.styleMap = node_style_map;
        self.map.addLayers([self.vector.node_layer, self.vector.way_layer]);

        self.node_create = new L.NodeCreate({
            layer_vector: self.vector,
            generate_id: self.generate_id
        });
        self.map.addControl(self.node_create.draw_node_control);
        self.node_create.$el.insertAfter($('#menu'));

        self.vector_edit = new L.VectorEdit({layer_vector: self.vector});
        self.vector_edit.on('select', function(feature) {
            self.node_create.hide();
            var node_model = feature.L_vector.model;
            self.node_view = new L.NodeView({model: node_model});
            self.node_view.on('close', function() {
                self.node_view.$el.remove();
                self.node_view = null;
                self.vector_edit.select_control.unselect(feature);
            });
            self.node_view.$el.insertAfter($('#menu'));
        }, this);
        self.vector_edit.on('deselect', function() {
            if(self.node_view) self.node_view.close();
            self.node_create.show();
        }, this);

        self.map.addControl(self.vector_edit.modify_control);
        self.map.addControl(self.vector_edit.select_control);
        self.vector_edit.activate();

        self.node_create.on('begin_create_node', function() {
            self.vector_edit.deactivate();
        });
        self.node_create.on('create_node', function(node_model, node_feature) {
            self.model.nodes.add(node_model, {feature: node_feature});
            self.vector_edit.activate();
            self.vector_edit.select_control.select(node_feature);
        });
    };

    self.clear_download_ui = function() {
        L.hide_message();
        self.edit_control.deactivate();
        self.map.removeControl(self.edit_control);
        self.download_layer.removeFeatures([box]);
        self.map.removeLayer(self.download_layer);
    };

    download_button.click(function(evt) {
        evt.preventDefault();
        self.clear_download_ui();
        var b = L.invproj(box.geometry.bounds);
        var bbox = b.left + ',' + b.bottom + ',' + b.right + ',' + b.top;
        L.download(bbox).done(function(data) {
            self.edit_osm(data);
        });
    });
    L.message("Select area then click ", download_button);

    return self;
};

L.xml_node = function(tag_name) {
    return $.parseXML('<' + tag_name + '/>').firstChild;
};


L.NodeModel = Backbone.Model.extend({
    initialize: function(attributes, options) {
        this.xml = options['xml'];
        this.$xml = $(this.xml);
        this.set({
            lat: this.$xml.attr('lat'),
            lon: this.$xml.attr('lon')
        });
        this.id = this.$xml.attr('id');
        this.ways = new Backbone.Collection;
    },

    change: function(options) {
        _(['lat', 'lon']).forEach(function(name) {
            if(options['changes'][name]) {
                this.$xml.attr(name, this.get(name));
            }}, this);
        Backbone.Model.prototype.change.apply(this, arguments);
    },

    destroy: function() {
        this.trigger('destroy', this);
    }
});


L.WayModel = Backbone.Model.extend({
    initialize: function(attributes, options) {
        this.xml = options['xml'];
        this.$xml = $(this.xml);
        this.id = this.$xml.attr('id');
        this.nodes = new Backbone.Collection(
            _(this.$xml.find('> nd')).map(function(nd_xml) {
                var node_id = $(nd_xml).attr('ref');
                var node = options['nodes'].get(node_id);
                node.ways.add(this);
                return node;
            }, this));
        this.nodes.on('destroy', function(node) {
            this.$xml.find('> nd[ref="' + node.id + '"]').remove();
        }, this);
    }
});


L.LayerModel = Backbone.Model.extend({
    initialize: function(attributes, options) {
        this.xml = options['xml'];
        this.$xml = $(this.xml);

        this.nodes = new Backbone.Collection(
            _(this.$xml.find('> node')).map(function(node_xml) {
                return new L.NodeModel({}, {xml: node_xml});
            }));

        this.ways = new Backbone.Collection(
            _(this.$xml.find('> way')).map(function(way_xml) {
                return new L.WayModel({}, {
                    xml: way_xml,
                    nodes: this.nodes
                });
            }, this));

        this.nodes.on('add', function(node) {
            this.$xml.append(node.xml);
        }, this);

        this.nodes.on('destroy', function(node) {
            node.$xml.remove();
        });

        function propagate_events() {
            this.trigger.apply(this, arguments);
        }
        this.nodes.on('all', propagate_events, this);
        this.ways.on('all', propagate_events, this);
    }
});


L.node_point = function(node_model) {
    return new OpenLayers.Geometry.Point(
        node_model.get('lon'),
        node_model.get('lat'));
};

L.update_point = function(point, new_data) {
    point.x = new_data.x;
    point.y = new_data.y;
    point.clearBounds();
}


L.NodeVector = Backbone.View.extend({
    initialize: function(options) {
        this.layer_vector = options['layer_vector'];
        var geometry = L.proj(L.node_point(this.model));
        this.feature = options['feature'];
        if(! this.feature) {
            this.feature = new OpenLayers.Feature.Vector(geometry);
        }
        this.feature.L_vector = this;
    },

    vector_moved: function() {
        var new_position = L.invproj(this.feature.geometry.clone());
        this.model.set({
            'lon': L.quantize(new_position.x),
            'lat': L.quantize(new_position.y)
        });
    }
});


L.WayVector = Backbone.View.extend({
    initialize: function(options) {
        this.layer_vector = options['layer_vector'];
        this.node_point = {};
        var line_string = new OpenLayers.Geometry.LineString();
        this.model.nodes.forEach(function(node_model) {
            var point_geometry = L.proj(L.node_point(node_model));
            line_string.addComponent(point_geometry);
            this.node_point[node_model.id] = point_geometry;
        }, this);
        this.feature = new OpenLayers.Feature.Vector(line_string);
        this.feature.L_vector = this;
        this.model.nodes.on('remove', this.remove_node, this);
        this.model.nodes.on('change', this.node_change, this);
    },

    remove_node: function(node_model) {
        var point = _(this.node_point).pop(node_model.id);
        this.feature.geometry.removeComponent(point);
        this.trigger('geometry_change', this);
    },

    node_change: function(node_model, options) {
        if(!(options['changes']['lat'] ||
             options['changes']['lon'])) {
            return;
        }
        L.update_point(this.node_point[node_model.id],
                       L.proj(L.node_point(node_model)));
        this.trigger('geometry_change', this);
    }
});


L.LayerVector = Backbone.View.extend({
    initialize: function() {
        this.node_vectors = {};
        this.node_layer = new OpenLayers.Layer.Vector('Nodes', {});
        this.model.nodes.forEach(this.add_node, this);
        this.model.nodes.on('add', this.add_node, this);
        this.model.nodes.on('remove', this.remove_node, this);

        this.node_layer.events.on({
            'featuremodified': function(evt) {
                var feature = evt.feature;
                var node_vector = feature.L_vector;
                node_vector.vector_moved();
            }
        });

        this.way_vectors = {};
        this.way_layer = new OpenLayers.Layer.Vector('Ways', {});
        this.model.ways.forEach(this.add_way, this);
        this.model.ways.on('add', this.add_way, this);
    },

    add_node: function(node_model, collection, options) {
        var node_vector = new L.NodeVector({
            layer_vector: this,
            model: node_model,
            feature: options['feature']
        });
        this.node_vectors[node_model.id] = node_vector;
        this.node_layer.addFeatures([node_vector.feature]);
    },

    remove_node: function(node_model) {
        var node_feature = this.node_vectors[node_model.id].feature;
        this.node_layer.removeFeatures([node_feature]);
    },

    add_way: function(way_model) {
        var way_vector = new L.WayVector({
            layer_vector: this,
            model: way_model
        });
        this.way_vectors[way_model.id] = way_vector;
        this.way_layer.addFeatures([way_vector.feature]);
        way_vector.on('geometry_change', this.geometry_change, this);
    },

    geometry_change: function(way_vector) {
        this.way_layer.drawFeature(way_vector.feature);
    }
});


L.NodeView = Backbone.View.extend({

    className: 'node-properties',

    events: {
        'click .close.button': 'close',
        'click .new.button': 'new_tag',
        'click .delete.button': 'delete'
    },

    initialize: function() {
        this.render();
        this.model.on('change', this.render, this);
    },

    render: function() {
        $('.node-view-info', this.el).remove();
        var template = L.template['node-view-info'];
        var tmpl_data = _({id: this.model.id}).extend(this.model.attributes);
        this.$el.prepend(template(tmpl_data));
        if($('table.node-tags', this.el).length < 1) {
            this.render_table();
        }
    },

    render_table: function() {
        var tags_data = _($('> tag', this.model.xml)).map(function(tag_xml) {
            return {
                'key': $(tag_xml).attr('k'),
                'value': $(tag_xml).attr('v')
            };
        });
        this.$el.append(L.template['tags-table']({'tags': tags_data}));
    },

    new_tag: function(evt) {
        evt.preventDefault();
        var tag_html = L.template['tag-tr']({'key': "", 'value': ""});
        $('table.node-tags', this.el).append(tag_html);
    },

    save: function() {
        $('> tag', this.model.xml).remove();
        $('tr.tag', this.el).each(_(function(i, tr) {
            var key = $('input[name=key]', tr).val();
            var value = $('input[name=value]', tr).val();
            if(key && value) {
                var tag = $(L.xml_node('tag')).attr({k: key, v: value});
                this.model.$xml.append(tag);
            }
        }).bind(this));
    },

    delete: function(evt) {
        evt.preventDefault();
        this.close()
        this.model.destroy();
    },

    close: function(evt) {
        if(evt) { evt.preventDefault(); }
        this.save();
        this.trigger('close');
    }

});


L.NodeCreate = Backbone.View.extend({

    templateName: 'node-create',
    className: 'node-properties',

    events: {
        'click .node-create-button a': 'buttonClick'
    },

    initialize: function(options) {
        this.layer_vector = options['layer_vector'];
        this.generate_id = options['generate_id'];
        this.draw_node_control = new OpenLayers.Control.DrawFeature(
            this.layer_vector.node_layer,
            OpenLayers.Handler.Point);
        this.draw_node_control.events.register('featureadded',
            this, this.feature_added);
        this.render();
    },

    render: function() {
        this.$el.html(L.template[this.templateName]({model: this.model}));
    },

    buttonClick: function(evt) {
        evt.preventDefault();
        $('.node-create-button', this.el).hide();
        $('.node-create-message', this.el).show();
        this.trigger('begin_create_node');
        this.draw_node_control.activate();
    },

    show: function() {
        $('.node-create-message', this.el).hide();
        $('.node-create-button', this.el).show();
        this.$el.show();
    },

    hide: function() {
        this.$el.hide();
    },

    feature_added: function(evt) {
        var node_feature = evt.feature;
        var coords = L.invproj(node_feature.geometry.clone());
        var node_xml = L.xml_node('node');
        $(node_xml).attr({
            lon: L.quantize(coords.x),
            lat: L.quantize(coords.y),
            id: this.generate_id(),
            version: 1
        });
        var node_model = new L.NodeModel({}, {xml: node_xml});
        this.draw_node_control.deactivate();
        this.trigger('create_node', node_model, node_feature);
    }
});


L.VectorEdit = Backbone.View.extend({
    initialize: function(options) {
        this.layer_vector = options['layer_vector'];
        this.modify_control = new OpenLayers.Control.ModifyFeature(
            this.layer_vector.node_layer,
            {standalone: true});
        this.select_control = new OpenLayers.Control.SelectFeature(
            this.layer_vector.node_layer,
            {
                'onSelect': this.modify_control.selectFeature,
                'onUnselect': this.modify_control.unselectFeature,
                scope: this.modify_control
            });
        this.select_control.events.on({
            'featurehighlighted': function(e) {
                this.trigger('select', e.feature);
            },
            'featureunhighlighted': function(e) {
                this.trigger('deselect');
            },
            scope: this
        });
    },

    activate: function() {
        this.select_control.activate();
        this.modify_control.activate();
    },

    deactivate: function() {
        this.select_control.deactivate();
        this.modify_control.deactivate();
    }
});


})(window.L);
