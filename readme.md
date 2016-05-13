# Fourier transform packages comparison

The task is to process waveform of 4096 real/imaginary numbers 1000 times. Results show total time taken in my laptop (lenovo x220 if it makes any sense) in node6. Probably should compare in various browsers as well (TODO).

Packages are just npm-searched by keywords `fourier` and `fft`.

* [digitalsignals](https://www.npmjs.com/package/digitalsignals) — fork of dsp.js, nothing changed in code
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
