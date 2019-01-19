'use strict'

import test from 'tape'
import rfft from '../'
import rfftAsm from '../asm'
import dsp from 'dsp.js'
import ndfft from 'ndarray-fft'
import ndarray from 'ndarray'
import {draw, normalize} from './util'
import {real, imag, mags} from './fixture'

var isBrowser = typeof document !== 'undefined'


test('rfft', function (t) {
	//RFFT direct transform
	var mag1 = rfftAsm(real);

	//FFT transform
	var fft = new dsp.FFT(real.length, 44100);
	fft.forward(real);
	var mag2 = fft.spectrum;

	//ndarray-fft
	var x = ndarray(real);
	var y = ndarray(imag);
	ndfft(1, x, y);
	var mag3 = new Array();
	for (var i = x.shape[0]/2; i < x.shape[0]; i++) {
		var rv = x.get(i), iv = y.get(i);
		mag3.push(Math.sqrt(rv*rv + iv*iv))
	}
	normalize(mag3)

  	// draw(mag1)
  	// draw(mag2)
  	// draw(mag3)

	for (var i = 0; i < mag1.length; i++) {
		var v1 = mag1[i]
		var v2 = mag2[i]
		var v3 = mag3[i]
		if (Math.abs(v1 - v2) > 1e-2) console.log(v1, v2, i)
	}

	// assert.almost(mag1, mag2);

	t.end()
});


test.skip('performance', function (t) {

	t.almost(rfft(real), rfftAsm(real))

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


