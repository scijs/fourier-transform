/**
* Comparison of various FT methods.
*/

import t from 'tape'
import {draw, normalize, toMag} from './util'
import {real, imag, mags} from './fixture'
import eq from 'array-almost-equal'


t.skip('fourier-transform', function (t) {
	var ft = require('../');

	console.time(t.name)
	var result = ft(real);
	console.timeEnd(t.name)

	// draw(result)
	// draw(mags)

	t.end()
});

// t.skip('fili', function (t) {
// 	var Fili = require('fili');
// 	var fft = new Fili.Fft(N);

// 	console.time(t.name)
// 		fft.forward(real, 'hanning');
// 	console.timeEnd(t.name)
// });

//TODO: does not compile
t('dsp');

t('ml-fft', function (t) {
	var lib = require('ml-fft');
	var FFT = lib.FFT;

	var re = Array.from(real)
	var im = Array.from(imag)

	FFT.init(re.length);

	console.time(t.name)
	FFT.fft(re, im);
	console.timeEnd(t.name)

	// draw(normalize(toMag(re.slice(0, re.length / 2), im)))
	// draw(mags)

	t.end()
});

t.only('ooura', function (t) {
	var oo = new (require('ooura'))(real.length, {type: 'real', 'radix': 4})

	// compute FFT
	let re = oo.vectorArrayFactory()
	let im = oo.vectorArrayFactory()
	let x = Float64Array.from(real)

	// FIXME: this does not comply with python respective part
	console.time(t.name)
	oo.fft(x.buffer, re.buffer, im.buffer)
	console.timeEnd(t.name)

	// draw(normalize(toMag(re, im)))
	// draw(mags)

	t.end()
})

// does not compile
t.skip('kissfft');

// does not compile
t.skip('node-fft');

t('ndarray-fft', function (t) {
	var fft = require('ndarray-fft');
	var ndarray = require('ndarray');
	var x = ndarray(real);
	var y = ndarray(imag);

	console.time(t.name)
		fft(1, x, y);
	console.timeEnd(t.name)

	var ndmags = new Array();
	for (var i = 0; i < x.shape[0] / 2; i++) {
		var rv = x.get(i), iv = y.get(i);
		ndmags.push(Math.sqrt(rv*rv + iv*iv))
	}
	normalize(ndmags)

	// draw(ndmags)
	// draw(mags)

	t.end()
});

t('fft', function (t) {
	var FFT = require('fft');
	var fft = new FFT.complex(N, false);
	var out = new Float32Array(real);
	console.time(t.name)
		fft.simple(out, real, 'real');
	console.timeEnd(t.name)

	t.end()
});

t('dsp-fft', function (t) {
	var fft = require('dsp-fft').fft;
	console.time(t.name)
		fft(real);
	console.timeEnd(t.name)

	t.end()
});

t('dsp.js', function (t) {
	var dsp = require('dsp.js');

	var fft = new dsp.FFT(N, rate);
	console.time(t.name)
		fft.forward(real);
		fft.spectrum;
	console.timeEnd(t.name)

	t.end()

	var rfft = new dsp.RFFT(N, rate);
	console.time(t.name)
		rfft.forward(real);
		rfft.spectrum;
	console.timeEnd(t.name)

	t.end()

	var dft = new dsp.DFT(N, rate);
	console.time(t.name)
		dft.forward(real);
		dft.spectrum;
	console.timeEnd(t.name)

	t.end()
});

t.skip('dspjs', function (t) {
	var dsp = require('dspjs');
	console.log(dsp)
});

t('digitalsignals', function (t) {
	var dsp = require('digitalsignals');

	var fft = new dsp.FFT(N, rate);
	console.time(t.name)
		fft.forward(real);
		fft.spectrum;
	console.timeEnd(t.name)

	t.end()

	var rfft = new dsp.RFFT(N, rate);
	console.time(t.name)
		rfft.forward(real);
		rfft.spectrum;
	console.timeEnd(t.name)

	t.end()

	var dft = new dsp.DFT(N, rate);
	console.time(t.name)
		dft.forward(real);
		dft.spectrum;
	console.timeEnd(t.name)

	t.end()
});

t('fft-js', function (t) {
	var fftjs = require('fft-js');

	var fft = fftjs.fft;
	console.time(t.name)
		fft(real);
	console.timeEnd(t.name)

	t.end()

	var fftInPlace = fftjs.fftInPlace;
	console.time(t.name)
		fftInPlace(real);
	console.timeEnd(t.name)

	t.end()

	var dft = fftjs.dft;
	run.skip('dft', function (t) {
		dft(real);
	console.timeEnd(t.name)

	t.end()
});

t('aureooms-js-fft', function (t) {
	var fft = require('aureooms-js-fft');
	var array = require('aureooms-js-array');
	var random = require('aureooms-js-random');
	var number = require('aureooms-js-number');
	var complex = require('aureooms-js-complex');

	var kernel = complex.cartesian.kernel.compile(number, 'i');
	var cartesian = complex.cartesian.array.compile(kernel);

	var $ = fft.compile(cartesian);
	var _ = cartesian.complex;

	var n = N; // Math.pow(2, 10) | 0 ;
	var l = Math.log2(n) | 0;
	var m = n >>> 1;

	var u = array.alloc(n);
	var v = array.alloc(n);
	var w = array.alloc(n);

	for (var i = 0; i < n; ++i) {
		u[i] = _(random.randfloat(-1000, 1000), random.randfloat(-1000, 1000));
	}

	array.copy(u, 0, n, w, 0);

	console.time(t.name)
		$.fft(l, m, u, 0, n, v, 0, n);
	}, 10);
});

var STFT = require('stft');
t('stft', function (t) {
	var stft = STFT(1, N, function () {});
	console.time(t.name)
		stft(real);
	console.timeEnd(t.name)

	t.end()
});

t('frequencyjs', function (t) {
	var fjs = require('frequencyjs');

	console.time(t.name)
		fjs.Transform.toSpectrum(real, {sampling: N, method: 'dft'});
	console.timeEnd(t.name)

	t.end()

	console.time(t.name)
		fjs.Transform.toSpectrum(real, {method: 'fft'});
	console.timeEnd(t.name)

	t.end()
});

t('fourier', function (t) {
	var fourier = require('fourier');
	var fourierFFTRun = fourier.fft();
	console.time(t.name)
		fourierFFTRun(real, im);
	console.timeEnd(t.name)

	t.end()

	var fourierDFTRun = fourier.dft;
	console.time(t.name)
		fourierDFTRun(real, im);
	console.timeEnd(t.name)

	t.end()

	var fourierFFTDitRadix2Run = fourier.fftDitRadix2();
	console.time(t.name)
		fourierFFTDitRadix2Run(real, im);
	console.timeEnd(t.name)

	t.end()

	var fourierFFTDitRadix2SimpleRun = fourier.fftDitRadix2Simple;
	console.time(t.name)
		fourierFFTDitRadix2SimpleRun(real, im);
	console.timeEnd(t.name)

	t.end()

	// some tough guys
	var stdlib = {
		Math: Math,
		Float64Array: Float64Array,
		Float32Array: Float32Array
	};
	var refReal = new Float32Array(N);
	var refImag = new Float32Array(N);
	var _real = new Float32Array(N);
	var _imag = new Float32Array(N);

	for (i = 0; i < N; i++) {
		_real[i] = refReal[i] = real[i];
		_imag[i] = refImag[i] = im[i];
	}

	var heap = fourier.custom.alloc(N, 3);

	var raw = fourier.custom['fft_f32_' + N + '_raw'](stdlib, null, heap);
	raw.init();

	console.time(t.name)
		fourier.custom.array2heap(_real, new Float32Array(heap), N, 0);
		fourier.custom.array2heap(_imag, new Float32Array(heap), N, N);
		raw.transform();
		fourier.custom.heap2array(new Float32Array(heap), _real, N, 0);
		fourier.custom.heap2array(new Float32Array(heap), _imag, N, N);
	console.timeEnd(t.name)

	t.end()

	var asm = fourier.custom['fft_f32_' + N + '_asm'](stdlib, null, heap);
	asm.init();

	console.time(t.name)
		fourier.custom.array2heap(_real, new Float32Array(heap), N, 0);
		fourier.custom.array2heap(_imag, new Float32Array(heap), N, N);
		asm.transform();
		fourier.custom.heap2array(new Float32Array(heap), _real, N, 0);
		fourier.custom.heap2array(new Float32Array(heap), _imag, N, N);
	console.timeEnd(t.name)

	t.end()
});

t('fft-asm', function (t) {
	var FftModule = require('../asm')

	var fftasm = new FftModule(N / 2, true);
	var fftnoasm = new FftModule(N / 2, false);

	console.time(t.name)
		fftasm.fftmag(real, im);
	console.timeEnd(t.name)

	t.end()

	console.time(t.name)
		fftnoasm.fftmag(real, im);
	console.timeEnd(t.name)

	t.end()
})
