# fourier-transform [![stable](https://img.shields.io/badge/stability-stable-brightgreen.svg)](http://github.com/badges/stability-badges) [![Build Status](https://img.shields.io/travis/scijs/fourier-transform.svg)](https://travis-ci.org/scijs/fourier-transform)

Minimalistic and efficient FFT implementation for 2<sup>n</sup>-size inputs. Includes regular and asm.js versions.

[![npm install fourier-transform](https://nodei.co/npm/fourier-transform.png?mini=true)](https://npmjs.org/package/fourier-transform/)

```js
var ft = require('fourier-transform');
var db = require('decibels');

var frequency = 440;
var size = 1024;
var sampleRate = 44100;
var waveform = new Float32Array(size);
for (var i = 0; i < size; i++) {
	waveform[i] = Math.sin(frequency * Math.PI * 2 * (i / sampleRate));
}

//get normalized magnitudes for frequencies from 0 to 22050 with interval 44100/1024 ≈ 43Hz
var spectrum = ft(waveform);

//convert to decibels
var decibels = spectrum.map((value) => db.fromGain(value))
```

To use asm.js version, require as `require('fourier-transform/asm')`. That is ~35% faster.

## Thanks

To all the [existing fft packages](./benchmark.md), without them this one would not be possible. Special thanks to @corbanbrook for the most efficient implementation in [dsp.js](https://github.com/corbanbrook/dsp.js). This package is based on [dsp.js RFFT](https://github.com/corbanbrook/dsp.js/blob/master/dsp.js#L554), which is based on [RealFFT](http://www.jjj.de/fxt/).

## Contribute

If you find it slow, difficult or broken, please [post an issue](https://github.com/dfcreative/fourier-transform/issues). If you have ideas or know-hows for better implementation - [PR’s are welcome](https://github.com/dfcreative/fourier-transform/pulls).

## Related

* [fourier transforms benchmark](./benchmark.md).
* [ndarray-fft](https://github.com/scijs/ndarray-fft) FFT for ndarrays, allowing not-power-of-two inputs.
* [gl-fourier](https://github.com/dfcreative/gl-fourier) WebGL fourier transform implementations.
* [gl-spectrum](https://github.com/dfcreative/gl-spectrum) render spectrum in 2d/3d canvas.
