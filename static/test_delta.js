(function(L) {


function get_test_xml(name) {
    var deferred = $.Deferred();
    $.get('static/test_delta_data/' + name, function(data) {
        deferred.resolve($(data)[2]);
    });
    return deferred;
}


function run_test(name) {
    $.when(get_test_xml(name + '/a.osm'),
           get_test_xml(name + '/b.osm'),
           get_test_xml(name + '/e.osmchange')
           ).done(function(a, b, expected) {
        var diff = L.xml_diff(a, b);
        var same = (diff == expected);
        console.log(name, (same ? 'ok' : 'error'));
        if(! same) {
            console.log(name, 'result', diff);
            console.log(name, 'expect', expected);
        }
    });
}


L.xml_diff_test = function() {
    run_test('no_change');
}


})(window.L);
