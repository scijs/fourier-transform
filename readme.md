Simple, minimalistic and efficient FFT implementation based off [fourier packages research](./benchmark.md). [![stable](http://badges.github.io/stability-badges/dist/stable.svg)](http://github.com/badges/stability-badges).

## Usage

[![npm install fourier-transform](https://nodei.co/npm/fourier-transform.png?mini=true)](https://npmjs.org/package/fourier-transform/)

```js
var ft = require('fourier-transform');

var frequencies = ft(waveform);
```

## API

### `rfft(real, output?)`

Real values fourier transform, exhibits highest performance. Based on [dsp.js RFFT](https://github.com/corbanbrook/dsp.js/blob/master/dsp.js#L554), which is based on [FXT](http://www.jjj.de/fxt/). Used as a default package output and expected to cover the most common use-case.

```js
var fft = require('fourier-transform/rfft');

var waveform = new Float32Array(1024);

var frequencies = fft(waveform);
```

### `fft(real, imaginary, output?)`

Common radix FFT implementation, based on [dsp.js FFT.forward](https://github.com/corbanbrook/dsp.js/). Takes real and imaginary values as input and returns output. If an output array passed, it will be populated with frequencies data.

```js
var fft = require('fourier-transform/fft');

var real = new Float32Array(1024);
var im = new Float32Array(1024);

var frequencies = fft(real, im);
```

### `ifft(frequencies, output?)`

Inverse FFT implementation, based off [dsp.js FFT.inverse](https://github.com/corbanbrook/dsp.js/). Useful for resynthesis.

```js
var ifft = require('fourier-transform/ifft');

var waveform = ifft(frequencies);
```

## Thanks

To all the [existing fft packages](./benchmark.md), without them this one would not be possible. Special thanks to @corbanbrook for the most efficient implementation in [dsp.js](https://github.com/corbanbrook/dsp.js).


## Contribute

If you find it slow, difficult or broken, please [post an issue](./issues). If you have ideas or know-hows for better implementation - [PR’s are welcome](./pull-request).

## Related

* [gl-fourier](https://github.com/dfcreative/gl-fourier) WebGL fourier transform implementations.
* [gl-spectrum](https://github.com/dfcreative/gl-spectrum) render spectrum in 2d/3d canvas.
* [audio-spectrum](https://github.com/audio-lab/audio-spectrum) render spectrum of a stream in node/browser.
* [audio-spectrogram](https://github.com/audio-lab/audio-spectrogram) render spectrogram of a stream in node/browser.