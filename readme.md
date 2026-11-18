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

### `ifft(re, im, output?)` — named export

Inverse of `fft()` — recovers time-domain signal from complex spectrum. Returns `Float64Array` of length N.

- `re`, `im` — `Float64Array` of length N/2+1 (as returned by `fft()`).
- `im[0]` and `im[N/2]` are ignored (half-complex format has no slot for them).
- Native split-radix DIF inverse — no complex FFT overhead.

```js
const [re, im] = fft(signal)
// modify spectrum...
const recovered = ifft(re, im)
```

### `cfft(re, im)` — named export

In-place complex forward FFT (unnormalized). Both `re` and `im` must be `Float64Array` of equal power-of-2 length (>= 2). Modifies arrays in place.

### `cifft(re, im)` — named export

In-place complex inverse FFT (1/N normalized). Same signature as `cfft`.

### `pair(N)` – `fourier-transform/pair`

Two real FFTs at once, one channel in each lane of WebAssembly SIMD (`pair.wat`, 3 KB, compiled synchronously): each lane runs the split-radix above with the same float ops in the same order, so its bins are the bits `fft()` gives and its samples the bits `ifft()` gives, in a quarter to a third of the time of the two calls (N = 2048, Node 25, Apple M4 Max). `null` where WebAssembly SIMD does not run, or for N not a power of 2 from 4.

```js
import pair from 'fourier-transform/pair'

const p = pair(2048)
for (let i = 0; i < 2048; i++) { p.input[2 * i] = left[i]; p.input[2 * i + 1] = right[i] }
p.fft()                // p.re[0], p.im[0]: left's bins; p.re[1], p.im[1]: right's
p.ifft()               // p.output[0], p.output[1]: the samples of the bins
```

One pair per size, on one memory: a call overwrites what the last one left. `own(N)` gives a pair of one's own, with room in its memory past `base` (`room(bytes)`) for what its holder keeps beside the transforms, and two passes over it: `win(a, b, w)`, the input from two frames each times a window, and `ola(oa, ob, on, w, w2)`, the output times the window added into two sums and the window's square into a normalizer, the products and sums of the JS loops. `stftStream` keeps its output sums there.

## STFT

```js
import { stft, istft, stftBatch, stftStream, stftAnalysisStream } from 'fourier-transform/stft'
```

### `stft(signal, opts?)` — analysis

Returns an array of frames, each with `{ re, im, mag, phase, time }`.

- `signal` — `Float32Array`, `Float64Array`, or plain `Array`.
- `opts.frameSize` — FFT size, power of 2. Default: `2048`.
- `opts.hopSize` — hop between frames. Default: `frameSize / 4`.
- `time` is the sample index of the frame centre in the original signal.
- Zero-padded by `frameSize` at front and back so edge samples are fully windowed.

```js
const frames = stft(waveform, { frameSize: 2048, hopSize: 512 })
for (const f of frames) {
  console.log(f.time, f.mag[100]) // time in samples, magnitude at bin 100
}
```

### `istft(frames, opts?)` — synthesis

Reconstructs a time-domain signal from STFT frames.

- `frames` — array of `{ mag, phase, time? }` or `{ re, im, time? }` objects.
- `opts.signalLength` — expected output length. Inferred from last frame if omitted.
  - When inferred, the tail may include padding; pass `signalLength` for exact control.
- Returns `Float64Array`.
- If `re`/`im` are present, they are used directly (no polar round-trip). Otherwise `mag`/`phase` are converted to cartesian.

```js
const recovered = istft(frames, { frameSize: 2048, hopSize: 512, signalLength: waveform.length })
```

### `stftBatch(data, process, opts?)` — batch with callback

Processes each frame through a callback and overlap-adds the result.

- `process(mag, phase, state, ctx)` → `{ mag, phase }`, or nothing when it edited `mag` and `phase` in place
  - `mag`, `phase` — `Float64Array(half + 1)`
  - `state` — persistent object across frames
  - `ctx` — `{ N, half, hop, anaHop, synHop, freqPerBin, frameStart, sampleRate, opts }`
    - `ctx.frameStart` — sample index of the frame start in the original signal. Negative at boundaries due to zero-padding.
    - `ctx.opts` — cloned copy of `opts`. Use this to pass custom parameters (e.g. `ratio`, `ratioFn`) through to your process callback.
- `opts.anaHop` — analysis hop (default: `hopSize`).
- `opts.synHop` — synthesis hop (default: `hopSize`). When `anaHop !== synHop`, the output is time-stretched or compressed.
- `opts.complex` – `process(re, im, state, ctx)` → `{ re, im }`, or nothing when edited in place, gets the complex bins (`Float64Array(half + 1)`) instead of polar form: a process that rotates or scales bins skips the `atan2` / `sin` / `cos` round trip.
- Returns `Float32Array` of length `round(data.length * synHop / anaHop)` (same as input when `anaHop === synHop`).

```js
const result = stftBatch(signal, (mag, phase, state, ctx) => {
  // Simple spectral gate
  for (let k = 0; k < mag.length; k++) if (mag[k] < 0.1) mag[k] = 0
  return { mag, phase }
}, { frameSize: 2048, hopSize: 512 })
```

### `stftStream(process, opts?)` — streaming with callback

Streaming version of `stftBatch`. Returns `{ write(chunk), flush() }`.

- Supports `opts.anaHop` / `opts.synHop` for time-stretching in streaming context, and `opts.complex`.
- `opts.channels`: one stream for that many channels, `write(chunks)` and `flush()` taking and returning an array of them. The frames of every channel sit at the same places, the hops are asked once a frame, `process` gets a state per channel and `ctx.channel`; each channel's samples are the ones its own stream gives, and two channels' transforms run at once (`pair`).
- `opts.joint` (with `channels` and `complex`): `process(res, ims, state, ctx)` once a frame with every channel's bins, an array a channel, edited in place, and one state: for a step that turns the channels together (a vocoder that keeps the phase between them).
- `write(chunk, out, length)` and `flush(out)` write the samples into `out` (a `Float32Array`; with `channels`, an array of them) from its start instead of returning new arrays, and return how many: the same bits, call for call. `out` takes as many as it holds, the rest waits for the next call. `length`: the samples taken from the chunk's start, when the chunk is a longer array.
- `opts.maxChunk` (default `frameSize`): the longest chunk `write` is given. The stream's memory is made for it when the stream is made, so a real-time loop allocates nothing; a longer chunk grows it once. Measured on Node 25, 22 and 20 at frames up to 8192; two limits on Node 22 and 20: frames of 16384 and up allocate 8 bytes a call, and a second stream made in a process allocates 3 to 4.75 bytes a call. With constant hops a write gives at most `ceil(maxChunk · synHop / anaHop) + 1` samples and a flush at most `round(frameSize / 2 · (synHop / anaHop + 1))`: an `out` of the larger holds every call.

```js
const stream = stftStream((mag, phase) => ({ mag, phase }), { frameSize: 2048 })

for (const chunk of audioChunks) {
  const processed = stream.write(chunk)
  // emit processed...
}
const tail = stream.flush()
```

A real-time loop, 128 samples a call, nothing allocated (a callback that edits in place and returns nothing allocates nothing either):

```js
const gain = mag => { for (let k = 0; k < mag.length; k++) mag[k] *= 0.5 }
const stream = stftStream(gain, { frameSize: 2048, maxChunk: 128 })
const out = new Float32Array(2048)

function block (input) {
  const n = stream.write(input, out)   // out[0..n): the samples now final
  // copy out[0..n) on, into a FIFO say: a subarray of it a call would be an allocation a call
}
```

### `stftAnalysisStream(opts?)` — streaming analysis

Streaming version of `stft`. Returns `{ write(chunk), flush() }` that emit frames.

- Supports `opts.anaHop` for non-uniform analysis spacing.

```js
const stream = stftAnalysisStream({ frameSize: 2048, hopSize: 512 })
const frames = stream.write(chunk1)
frames.push(...stream.write(chunk2))
frames.push(...stream.flush())
```

### View semantics

`rfft`, `fft`, and `ifft` return internal cached buffers by default. The next call with the same N overwrites the previous result. Pass an output buffer to keep results across calls:

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
