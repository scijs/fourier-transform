/* eslint-disable semi */
var suite = require('./suite')
var Benchmark = require('benchmark');
function noop () {}

run(build(suite));

function build (suite) {
  // a little benchmark.js wrapper
  var tests = {};
  var libName = '';
  function setup (name, fn) {
    libName = name;
    return fn ? fn() : null;
  }
  function test (name, fn) { tests[libName + ' - ' + name] = fn; }
  setup.skip = test.skip = noop

  suite(setup, test)
  return tests
}

function run (tests) {
  var bench = new Benchmark.Suite();
  Object.keys(tests).forEach((k) => {
    bench.add(k, tests[k]);
  });
  bench.on('cycle', function (event) {
    console.log(String(event.target));
  })
  .on('complete', function () {
    console.log('Fastest is ', this.filter('fastest').map('name'));
  })
  .on('error', function (e) {
    console.error('ERROR', e);
  });
  bench.run({ 'async': false });
}
