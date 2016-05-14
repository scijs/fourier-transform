Minimalistic and efficient FFT implementation based on [dsp.js RFFT](https://github.com/corbanbrook/dsp.js/blob/master/dsp.js#L554), which is based on [RealFFT](http://www.jjj.de/fxt/). Exhibits highest performance in [fourier packages benchmark](./benchmark.md). [![stable](http://badges.github.io/stability-badges/dist/stable.svg)](http://github.com/badges/stability-badges).

## Usage

[![npm install fourier-transform](https://nodei.co/npm/fourier-transform.png?mini=true)](https://npmjs.org/package/fourier-transform/)

```js
var ft = require('fourier-transform');

var waveform = new Float64Array(1024);

var frequencies = ft(waveform);
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