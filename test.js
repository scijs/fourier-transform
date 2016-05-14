var test = require('tst');
var assert = require('assert');
var almost = require('almost-equal');
var rfft = require('./rfft');
// var ifft = require('./ifft');
// var fft = require('./fft');



var N = 16;
var real = new Float32Array(N);
var im = new Float32Array(N);

for (var i = 0; i < N; i++) {
	real[i] = Math.sin(10000 * (i / N) / (Math.PI * 2) );
	real[i] = Math.random() * 2 - 0.5;
	// im[i] = Math.random() * 2 - 0.5;
}

var result = [
 0.2007274180650711,
 0.29625651240348816,
 0.6431688070297241,
 0.628587007522583,
 0.10844749957323074,
 0.04224899411201477,
 0.016048559918999672,
 0.013186296448111534 ];

assert.almost = function (x, y) {
	if (x.length && y.length) return x.every(function (x, i) {
		assert.almost(x, y[i]);
	});

	var EPSILON = 10e-8;
	if (!almost(x, y, EPSILON)) assert.fail(x, y,
		`${x} ≈ ${y}`, '≈');
	return true;
};


test.only('rfft', function () {
	var frequencies = rfft(real);
	assert.almost(frequencies, result);


	// var output = new Float32Array(N/2)

	// test('timing', function () {
	// 	for (var i = 0; i < 1000; i++) {
	// 		rfft(real, output);
	// 	}
	// });
});

test.skip('fft', function () {
	var frequencies = rfft(real);
	assert.almost(frequencies, result);
});

test.skip('ifft', function () {

});


test.skip('correctness', function () {
	var N = 16;
	var real = new Float32Array(N);
	var im = new Float32Array(N);

	for (var i = 0; i < N; i++) {
		real[i] = Math.sin(10000 * (i / N) / (Math.PI * 2))
	}

	var dsp = require('dsp.js');
	var fft = new dsp.RFFT(N, 44100);
	fft.forward(real);

	console.log(fft);
});