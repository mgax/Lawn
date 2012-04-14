(function(L) {


L.SelectArea = Backbone.View.extend({
    events: {
        'click .btn-download': 'select'
    },

    initialize: function(options) {
        this.map = options['map'];
        this.render();
        this.layer = new OpenLayers.Layer.Vector('Edit', {});
        this.map.addLayer(this.layer);

        this.edit_control = new OpenLayers.Control.ModifyFeature(this.layer, {
            vertexRenderIntent: 'temporary',
            mode: OpenLayers.Control.ModifyFeature.RESIZE |
                  OpenLayers.Control.ModifyFeature.RESHAPE |
                  OpenLayers.Control.ModifyFeature.DRAG
        });
        this.map.addControl(this.edit_control);
        this.edit_control.activate();

        var bounds = this.map.calculateBounds().scale(0.5);
        this.box = new OpenLayers.Feature.Vector(bounds.toGeometry());
        this.layer.addFeatures([this.box]);
        this.edit_control.selectControl.select(this.box);
    },

    cleanup: function() {
        this.edit_control.deactivate();
        this.map.removeControl(this.edit_control);
        this.layer.removeFeatures([this.box]);
        this.map.removeLayer(this.layer);
    },

    render: function() {
        var btn = $('<a href="#" class="button btn-download">');
        this.$el.empty().append(btn.text('download'));
    },

    select: function(evt) {
        evt.preventDefault();
        var bbox = L.invproj(this.box.geometry.bounds);
        this.trigger('select', bbox);
    }
});


L.EditingContext = function(options) {
    this.initialize.apply(this, arguments);
}

_.extend(L.EditingContext.prototype, Backbone.Events, {

    initialize: function(options) {
        this.map = options['map'];
    },

    begin_selection: function() {
        this.select_area = new L.SelectArea({map: this.map});
        L.message("Select area then click ", this.select_area.el);
        this.select_area.on('select', function(bbox) {
            L.hide_message();
            this.select_area.cleanup();
            var bbox_values = [bbox.left, bbox.bottom, bbox.right, bbox.top];
            var bbox_arg = (bbox_values).map(L.quantize).join(',');
            L.download(bbox_arg).done(_.bind(this.edit_osm, this));
        }, this);
    },

    edit_osm: function(data) {
        this.original_data = $('osm', data)[0];
        this.current_data = $(this.original_data).clone()[0];
        $(this.current_data).attr('generator', L.xml_signature);
        this.trigger('osm_loaded');
        this.model = new L.LayerModel({}, {xml: this.current_data});
        this.layer_editor = new L.LayerEditor({
            model: this.model,
            map: this.map
        });
        this.layer_editor.$el.appendTo($('#menu'));
    },

    diff: function() {
        return L.xml_diff(this.original_data, this.current_data);
    }

});


})(window.L);
