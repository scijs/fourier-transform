# Fourier transform packages comparison

Packages are npm-searched by keywords `fourier`, `fft` and alike.

The task is to process waveform of 4096 real/imaginary numbers 1000 times. Results show **total time** taken in my laptop (lenovo x220 if it makes sense) in node6.

* [fft-asm.js](https://github.com/g200kg/Fft-asm.js) __0.7s__
* [fili](https://www.npmjs.com/package/fili) __8s__
* [ml-fft](https://www.npmjs.com/package/ml-fft) __0.32s__
* [ndarray-fft](https://www.npmjs.com/package/ndarray-fft) __0.37s__
* [fft](https://www.npmjs.com/package/fft) __4s__
* [dsp-fft](https://www.npmjs.com/package/dsp-fft) __40s__
* [webgl-dft](https://github.com/dfcreative/gl-fourier) __5.4s__
* [corbanbrook/dsp.js](https://github.com/corbanbrook/dsp.js)
	* fft __0.222s__
	* rfft (real-values only FFT) __0.098s__ ★
	* dft __160s__
* [dspjs](https://www.npmjs.com/package/dspjs) — incredibly weird fork of dsp.js with no `module.exports`. How are we supposed to use it?
* [digitalsignals](https://www.npmjs.com/package/digitalsignals) — old fork of dsp.js
	* fft __0.321s__
	* rfft (real-values only FFT) __0.139s__
	* dft __150s__
* [fft-js](https://npmjs.org/package/fft-js)
	* fft __39.4s__
	* fftInPlace __120s__
	* dft **∞s** (I waited like for a couple of mins for single run and then bored)
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

**PS.** Correctness of transforms is not verified, we trust developers in that sense.

**PPS.** Results are opinionated single-run measurements, so there are deviations, but relative performance is demonstrative.

**PPPS.** I did not do any research of options of these packages, just used default settings. Quite possibly some packages use windowing, table creation or other pre-calculation which affects performance and can be disabled.

**PPPPS.** I was unable to compile [dsp](https://npmjs.org/package/dsp), [node-fft](https://npmjs.org/package/fft), [kissfft](https://npmjs.org/package/kissfft). They have native bindings and may render decent results.

**PPPPPS.** If you feel like running benchmark for yourself or contributing: clone repo, do `npm install` and `npm test`.
