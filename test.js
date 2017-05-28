'use strict'

var test = require('tape')
var assert = require('assert')
var almost = require('almost-equal')
var rfft = require('./')
var rfftAsm = require('./asm')
var dsp = require('dsp.js')
var ndfft = require('ndarray-fft')
var ndarray = require('ndarray')

var isBrowser = typeof document !== 'undefined'

var N = 4096/4;
var real = new Float32Array(N);
var im = new Float32Array(N);

for (var i = 0; i < N; i++) {
	real[i] = Math.sin(10000 * (i / N) / (Math.PI * 2) );
	im[i] = 0;
	// real[i] = Math.random() * 2 - 0.5;
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
		return assert.almost(x, y[i]);
	});

	var EPSILON = 10e-2;
	if (!almost(x, y, EPSILON)) assert.fail(x, y,
		`${x} ≈ ${y}`, '≈');

	return true;
};


test.skip('rfft', function (t) {
	//RFFT direct transform
	var mag1 = rfftAsm(real);

	//FFT transform
	var fft = new dsp.FFT(N, 44100);
	fft.forward(real);
	var mag2 = fft.spectrum;

	//ndarray-fft
	var x = ndarray(real);
	var y = ndarray(im);
	ndfft(1, x, y);
	var mag3 = new Array();
	for (var i = x.shape[0]/2; i < x.shape[0]; i++) {
		var rv = x.get(i), iv = y.get(i);
		mag3.push(Math.sqrt(rv*rv + iv*iv))
	}
	normalize(mag3)

  if (isBrowser) {
  	draw(mag1)
  	draw(mag2)
  	draw(mag3)
  }

	for (var i = 0; i < mag1.length; i++) {
		var v1 = mag1[i]
		var v2 = mag2[i]
		var v3 = mag3[i]
		// if (Math.abs(v1 - v2) > 1e-2) console.log(v1, v2, i)
	}

	// assert.almost(mag1, mag2);

	t.end()
});


test('performance', function (t) {

	assert.almost(rfft(real), rfftAsm(real))

	console.time('asm')
	for (var i = 0; i < 1e4; i++) {
		rfftAsm(real);
	}
	console.timeEnd('asm')

	console.time('regular')
	for (var i = 0; i < 1e4; i++) {
		rfft(real);
	}
	console.timeEnd('regular')



	t.end()
});


if (isBrowser) {
  function draw (arr) {
    let canvas = document.body.appendChild(document.createElement('canvas'));
    let ctx = canvas.getContext('2d')
    canvas.style.cssText = `
    margin: 5px;
    display: block;
    outline: 1px solid rgba(255,240,230,1);
    `

    let w = canvas.width;
    let h = canvas.height;

    ctx.beginPath();
    for (let i = 0, len = arr.length; i < len; i++) {
      let r = i/len;
      ctx.lineTo(r*w, h - h*arr[i]);
    }

    ctx.stroke();
    ctx.closePath();
  }
}

function normalize (arr) {
	var max = -999;
	var min = 999;

	for (var i = 0, l = arr.length; i < l; i++) {
		max = Math.max(arr[i], max);
		min = Math.min(arr[i], min);
	}

	for (var i = 0, l = arr.length; i < l; i++) {
		arr[i] = (arr[i] - min) / (max - min)
	}

	return arr;
}
