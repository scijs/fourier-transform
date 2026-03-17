# fourier-transform

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
fft.js (indutny)          16.0µs/call         — radix-4
fourier-transform         17.4µs/call   ×1.1  — split-radix
ooura                     23.0µs/call   ×1.4  — Ooura C port
ml-fft                    36.7µs/call   ×2.3
dsp.js                    47.0µs/call   ×2.9  — original split-radix ancestor
kissfft-wasm              48.5µs/call   ×3.0  — WASM KissFFT
ndarray-fft               61.4µs/call   ×3.8
fft-js                  2370.9µs/call  ×148.3  — naive recursive
```

`npm run benchmark` to reproduce.

## Acknowledgments

Based on the split-radix real FFT from [dsp.js](https://github.com/corbanbrook/dsp.js) by @corbanbrook, itself derived from [RealFFT](http://www.jjj.de/fxt/).

## License

MIT
