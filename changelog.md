# 2.1.0

## Breaking

- ESM only. Use `import rfft from 'fourier-transform'` instead of `require()`.
- Returns `Float64Array` instead of `Array`.
- Returns internal buffer by default — overwritten on next call with same N. Pass an output buffer to keep results: `rfft(input, output)`.
- Fixed off-by-one in magnitude spectrum. Imaginary components were indexed as `x[N-k-1]` instead of `x[N-k]`, shifting bins with imaginary content by one. Results are now correct.
- Rejects N < 2 (previously N=1 returned empty array silently).
- Removed `asm.js` entry point.

## Added

- `fft()` named export — returns complex DFT as `[re, im]`, N/2+1 bins, unnormalized.
- `ifft(re, im)` — inverse of `fft()`, native split-radix DIF inverse (~1.8x faster than complex IFFT approach).
- `cfft(re, im)` / `cifft(re, im)` — in-place complex FFT and inverse FFT (radix-2 Cooley-Tukey).
- Optional output buffer parameter for both `rfft()` and `fft()`.

## Performance

- Float64Array working buffers instead of generic Array.
- Precomputed twiddle factors and bit-reversal table, cached per size.
- Zero-copy real part in `fft()` via subarray view.
- ~2.7x faster than dsp.js (the original split-radix ancestor).
- On par with fft.js (indutny) in raw transform speed.

## Removed

- `asm.js` — no modern engine validates `'use asm'` anymore.
- All runtime dependencies (zero deps).
