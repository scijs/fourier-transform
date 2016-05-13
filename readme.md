# Fourier transform packages comparison

Tired of looking for fourier transform package? Here is benchmark of known to npm fourier transform packages.

The task is to process waveform of 4096 real/imaginary numbers 1000 times. Results show total time taken in my laptop (lenovo x220 if it makes sense) in node6. Probably should compare in various browsers as well (TODO).

Packages are just npm-searched by keywords `fourier` and `fft`.

* []()
* [ml-fft](https://www.npmjs.com/package/ml-fft) __0.32s__
* [ndarray-fft](https://www.npmjs.com/package/ndarray-fft) __0.37s__
* [fft](https://www.npmjs.com/package/fft) __4s__
* [dsp-fft](https://www.npmjs.com/package/dsp-fft) __40s__
* [webgl-dft](https://github.com/dfcreative/gl-fourier) __5.4s__
* [corbanbrook/dsp.js](https://github.com/corbanbrook/dsp.js)
	* fft __0.222s__
	* rfft (real-values only FFT) __0.098s__
	* dft __160s__
* [dspjs](https://www.npmjs.com/package/dspjs) — incredibly weird fork of dsp.js with no `module.exports`. How are we supposed to use it?
* [digitalsignals](https://www.npmjs.com/package/digitalsignals) — old fork of dsp.js
	* fft __0.321s__
	* rfft (real-values only FFT) __0.139s__
	* dft __150s__
* [fft-js](https://npmjs.org/package/fft-js)
	* fft __39.4s__
	* fftInPlace __120s__
	* dft ∞s (I waited like for a couple of mins for single run and then bored)
* [aureoom-js-fft](https://npmjs.org/package/aureoom-js-fft) __11s__
* [stft](https://npmjs.org/package/stft) __1.5s__
* [frequencyjs](https://npmjs.org/package/frequencyjs)
	* dft __730s__
	* fft __1.088s__
* [fourier](https://npmjs.org/package/fourier)
	* fft __0.375s__
	* dft __96s__
	* ditRadix2 __0.315s__
	* ditRadix2Simple __0.731s__
	* fft-32-raw __0.29s__
	* fft-32-asm __0.38s__

PS. Results are not verified, examples are based on packages’ readme/tests.
PPS. Results are opinionated single-run measurements, if you don’t believe - run for yourself: clone repo, do `npm install` and `npm test`.