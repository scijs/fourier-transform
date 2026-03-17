# fourier-transform [![test](https://github.com/scijs/fourier-transform/actions/workflows/test.yml/badge.svg)](https://github.com/scijs/fourier-transform/actions/workflows/test.yml)

Efficient real-valued FFT for 2<sup>n</sup>-size inputs. Split-radix algorithm with precomputed twiddle factors and typed-array buffers. Zero dependencies.

## Usage

```js
import rfft from 'fourier-transform'

// magnitude spectrum (N/2 bins)
const spectrum = rfft(waveform)
```

```js
import { fft } from 'fourier-transform'

// complex DFT output (N/2+1 bins, unnormalized)
const { re, im } = fft(waveform)
```

## API

### `rfft(input, output?)` — default export

Returns magnitude spectrum as `Float64Array` of length N/2.

- `input` — `Float32Array`, `Float64Array`, or plain `Array`. Length must be power of 2 (>= 2).
- `output` — optional `Float64Array(N/2)` to write into.
- Returns internal buffer if no output provided (overwritten on next call with same N).

Normalization: a unit-amplitude cosine at frequency bin *k* produces `spectrum[k] = 1.0`.

### `fft(input, output?)` — named export

Returns complex DFT as `{ re, im }`, each `Float64Array` of length N/2+1 (DC through Nyquist).

- `output` — optional `{ re: Float64Array(N/2+1), im: Float64Array(N/2+1) }`.
- Unnormalized: `X[k] = sum( x[n] * e^(-j*2*pi*k*n/N) )`.
- DC and Nyquist bins always have `im = 0` (real input).

### View semantics

Both functions return internal cached buffers by default. The next call with the same N overwrites the previous result. Pass an output buffer to keep results across calls:

```js
const out = new Float64Array(N / 2)
rfft(signal, out) // safe to keep
```

## Performance

N=4096 real-valued FFT, complex output, 20k iterations (lower is better):

```
fft.js (indutny)          16.2µs  ×1.0  — radix-4, interleaved output
fourier-transform         17.3µs  ×1.1  — split-radix, separate re/im
ooura                     23.1µs  ×1.4  — Ooura C port
ml-fft                    36.0µs  ×2.2
dsp.js                    47.1µs  ×2.9  — our split-radix ancestor
kissfft-wasm              49.4µs  ×3.1  — WASM KissFFT
ndarray-fft               62.6µs  ×3.9
fft-js                  2297.4µs  ×142   — naive recursive
```

Raw transform speed is identical to fft.js. The ×1.1 gap is entirely the cost of returning separate `re`/`im` arrays vs interleaved output.

`npm run benchmark` to reproduce.

## Acknowledgments

Based on the split-radix real FFT from [dsp.js](https://github.com/corbanbrook/dsp.js) by @corbanbrook, itself derived from [RealFFT](http://www.jjj.de/fxt/).

## License

MIT

<p align="center"><a href="https://github.com/krishnized/license">ॐ</a></p>
