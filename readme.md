# Fourier transform packages comparison

The task is to process waveform of 4096 real/imaginary numbers 1000 times. Results show total time taken in my laptop (lenovo x220 if it makes any sense) in node6. Probably should compare in various browsers as well (TODO).

Packages are just npm-searched by keywords `fourier` and `fft`.

* [fft-js](https://npmjs.org/package/fft-js)
	* fft 39.4s
	* fftInPlace 120s
	* dft ∞s (I waited like for a couple of mins for single run and then bored)
* [aureoom-js-fft](https://npmjs.org/package/aureoom-js-fft) 11s
* [stft](https://npmjs.org/package/stft) 1.5s
* [frequencyjs](https://npmjs.org/package/frequencyjs)
	* dft 730s
	* fft 1.088s
* [fourier](https://npmjs.org/package/fourier)
	* fft 0.375s
	* dft 96s
	* ditRadix2 0.315s
	* ditRadix2Simple 0.731s
	* fft-32-raw 0.29s
	* fft-32-asm 0.38s
