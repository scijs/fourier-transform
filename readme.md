# fourier-transform [![test](https://github.com/scijs/fourier-transform/actions/workflows/test.yml/badge.svg)](https://github.com/scijs/fourier-transform/actions/workflows/test.yml)

FFT for real and complex signals. Split-radix real FFT + radix-2 complex FFT. Precomputed twiddle factors, typed-array buffers, zero dependencies.

## Usage

```js
import rfft from 'fourier-transform'

// magnitude spectrum (N/2 bins)
const spectrum = rfft(waveform)
```

```js
import { fft } from 'fourier-transform'

// complex DFT of real input (N/2+1 bins, unnormalized)
const [re, im] = fft(waveform)
```

```js
import { cfft, cifft } from 'fourier-transform'

// in-place complex FFT / inverse FFT
const re = new Float64Array(N), im = new Float64Array(N)
cfft(re, im)   // forward
cifft(re, im)  // inverse (1/N normalized)
```

## API

### `rfft(input, output?)` — default export

Returns magnitude spectrum as `Float64Array` of length N/2.

- `input` — `Float32Array`, `Float64Array`, or plain `Array`. Length must be power of 2 (>= 2).
- `output` — optional `Float64Array(N/2)` to write into.
- Returns internal buffer if no output provided (overwritten on next call with same N).

Normalization: a unit-amplitude cosine at frequency bin *k* produces `spectrum[k] = 1.0`.

### `fft(input, output?)` — named export

Returns complex DFT as `[re, im]`, each `Float64Array` of length N/2+1 (DC through Nyquist).

- `output` — optional `[Float64Array(N/2+1), Float64Array(N/2+1)]`.
- Unnormalized: `X[k] = sum( x[n] * e^(-j*2*pi*k*n/N) )`.
- DC and Nyquist bins always have `im = 0` (real input).

### `irfft(re, im, output?)` — named export

Inverse of `fft()` — recovers time-domain signal from complex spectrum. Returns `Float64Array` of length N.

- `re`, `im` — `Float64Array` of length N/2+1 (as returned by `fft()`).
- `im[0]` and `im[N/2]` are ignored (half-complex format has no slot for them).
- Native split-radix DIF inverse — no complex FFT overhead.

```js
const [re, im] = fft(signal)
// modify spectrum...
const recovered = irfft(re, im)
```

### `cfft(re, im)` — named export

In-place complex forward FFT (unnormalized). Both `re` and `im` must be `Float64Array` of equal power-of-2 length (>= 2). Modifies arrays in place.

### `cifft(re, im)` — named export

In-place complex inverse FFT (1/N normalized). Same signature as `cfft`.

### View semantics

`rfft`, `fft`, and `irfft` return internal cached buffers by default. The next call with the same N overwrites the previous result. Pass an output buffer to keep results across calls:

```js
const out = new Float64Array(N / 2)
rfft(signal, out) // safe to keep
```

## Performance

N=4096 real-valued FFT, complex output, 20k iterations (lower is better):

```
fft.js (indutny)          16.5µs  ×1.0  — radix-4, interleaved output
fourier-transform         17.8µs  ×1.1  — split-radix, separate re/im
ooura                     23.6µs  ×1.4  — Ooura C port
ml-fft                    37.0µs  ×2.2
dsp.js                    48.1µs  ×2.9  — our split-radix ancestor
kissfft-wasm              49.4µs  ×3.0  — WASM KissFFT
ndarray-fft               63.1µs  ×3.8
als-fft                 2311.4µs  ×140
fft-js                  2329.2µs  ×141  — naive recursive
```

Raw transform speed is identical to fft.js. The gap is the cost of returning separate `re`/`im` arrays vs interleaved output.

`npm run benchmark` to reproduce.

## Acknowledgments

Forward split-radix real FFT from [dsp.js](https://github.com/corbanbrook/dsp.js) by @corbanbrook, derived from [RealFFT](http://www.jjj.de/fxt/). Inverse split-radix DIF algorithm from [FXT](https://www.jjj.de/fxt/fxtbook.pdf) by Joerg Arndt.

## License

MIT

<p align="center"><a href="https://github.com/krishnized/license">ॐ</a></p>
