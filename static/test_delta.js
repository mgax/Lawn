(function(L) {


function get_test_xml(name) {
    var deferred = $.Deferred();
    $.get('static/test_delta_data/' + name, function(data) {
        var root_node = null;
        if(data) {
            var root_node = $.parseXML(data.replace(/>\s+</g, '><')).firstChild;
            $('*', root_node).each(function(i, node) {
                node.namespaceURI = "";
            });
        }
        deferred.resolve(root_node);
    });
    return deferred;
}


function run_test(name) {
    $.when(get_test_xml(name + '/a.osm'),
           get_test_xml(name + '/b.osm'),
           get_test_xml(name + '/e.osmchange')
           ).done(function(a, b, expected) {
        var diff = L.xml_diff(a, b);
        $(diff).attr('generator', null);
        if(L.serialize_xml(diff) != L.serialize_xml(expected)) {
            console.log(name, 'fail', diff, expected);
        }
        else {
            console.log(name, 'ok');
        }
    });
}


L.xml_diff_test = function() {
    run_test('no_change');
    run_test('node_create');
    run_test('node_delete');
    run_test('node_move');
    run_test('node_add_tag');
    run_test('node_change_tag');
    run_test('node_remove_tag');
    run_test('way_create');
    run_test('way_delete');
    run_test('way_add_node');
    run_test('way_remove_node');
    run_test('way_reorder_nodes');
}


})(window.L);
