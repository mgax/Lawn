(function(L) {


L.SelectArea = Backbone.View.extend({

    tagName: 'span',

    events: {
        'click .btn-download': 'select'
    },

    initialize: function(options) {
        this.map = options['map'];
        this.render();
        this.layer = new OpenLayers.Layer.Vector('Edit', {});
        this.map.addLayer(this.layer);

        this.draw_control = new OpenLayers.Control.DrawFeature(
            this.layer,
            OpenLayers.Handler.RegularPolygon,
            {
                handlerOptions: {
                    sides: 4,
                    snapAngle: 90,
                    irregular: true,
                    persist: true
                }
            });
        this.draw_control.handler.callbacks.done = _.bind(this.draw_done, this);
        this.map.addControl(this.draw_control);
        this.draw_control.activate();
    },

    draw_done: function(map_bbox) {
        this.bbox = L.invproj(map_bbox.getBounds());
    },

    cleanup: function() {
        this.draw_control.deactivate();
        this.map.removeControl(this.draw_control);
        this.map.removeLayer(this.layer);
    },

    render: function() {
        var btn = $('<a href="#" class="button btn-download">');
        this.$el.empty().append(
            "Drag to select area. Then click ", btn.text('download'), ".");
    },

    select: function(evt) {
        evt.preventDefault();
        if(! this.bbox) { return; }
        this.trigger('select', this.bbox);
    }
});


L.EditingContext = L.Base.extend({

    initialize: function(options) {
        this.map = options['map'];
    },

    begin_selection: function() {
        this.select_area = new L.SelectArea({map: this.map});
        L.message(this.select_area.el);
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
