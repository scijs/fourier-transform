import { test } from 'node:test'
import assert from 'node:assert/strict'
import rfft, { fft, irfft, cfft, cifft } from './index.js'

const EPSILON = 1e-6

// --- Validation ---

test('rejects invalid input', () => {
	assert.throws(() => rfft(new Float32Array(0)))
	assert.throws(() => rfft(new Float32Array(1)))
	assert.throws(() => rfft(new Float32Array(3)))
	assert.throws(() => rfft(new Float32Array(6)))
	assert.throws(() => rfft(new Float32Array(15)))
})

// --- Fundamental identities ---

test('impulse → flat spectrum', () => {
	for (const N of [4, 8, 64, 1024]) {
		const input = new Float32Array(N)
		input[0] = 1
		const s = rfft(input)
		const expected = 2 / N
		for (let i = 0; i < s.length; i++)
			assert(Math.abs(s[i] - expected) < EPSILON, `N=${N}, bin ${i}: ${s[i]} != ${expected}`)
	}
})

test('DC signal', () => {
	for (const N of [2, 4, 64, 256]) {
		const s = rfft(new Float32Array(N).fill(1))
		assert.equal(s.length, N / 2)
		assert(Math.abs(s[0] - 2) < EPSILON, `N=${N} DC: ${s[0]}`)
		for (let i = 1; i < s.length; i++)
			assert(s[i] < EPSILON, `N=${N} bin ${i}: ${s[i]}`)
	}
})

test('zero signal', () => {
	const s = rfft(new Float32Array(64))
	for (let i = 0; i < s.length; i++)
		assert.equal(s[i], 0, `bin ${i}: ${s[i]}`)
})

test('pure cosine at various bins', () => {
	const N = 256
	for (const k of [1, 7, 32, 100]) {
		const input = new Float32Array(N)
		for (let n = 0; n < N; n++) input[n] = Math.cos(2 * Math.PI * k * n / N)
		const s = rfft(input)
		assert(Math.abs(s[k] - 1) < EPSILON, `cos k=${k}: expected 1, got ${s[k]}`)
		for (let i = 1; i < s.length; i++) {
			if (i === k) continue
			assert(s[i] < 1e-4, `cos k=${k}, bin ${i}: expected ~0, got ${s[i]}`)
		}
	}
})

test('pure sine at various bins', () => {
	const N = 256
	for (const k of [1, 5, 32, 127]) {
		const input = new Float32Array(N)
		for (let n = 0; n < N; n++) input[n] = Math.sin(2 * Math.PI * k * n / N)
		const s = rfft(input)
		assert(Math.abs(s[k] - 1) < EPSILON, `sin k=${k}: expected 1, got ${s[k]}`)
		for (let i = 1; i < s.length; i++) {
			if (i === k) continue
			assert(s[i] < 1e-4, `sin k=${k}, bin ${i}: expected ~0, got ${s[i]}`)
		}
	}
})

test('amplitude scaling', () => {
	const N = 128
	for (const amp of [0.5, 2, 7.3]) {
		const input = new Float32Array(N)
		for (let n = 0; n < N; n++) input[n] = amp * Math.cos(2 * Math.PI * 5 * n / N)
		const s = rfft(input)
		assert(Math.abs(s[5] - amp) < EPSILON, `amp=${amp}: expected ${amp}, got ${s[5]}`)
	}
})

// Parseval's theorem: sum(|x|^2)/N = spectrum[0]^2/4 + sum_{k=1}^{N/2-1}(spectrum[k]^2/2)
test('Parseval energy conservation', () => {
	const N = 512
	const input = new Float32Array(N)
	for (let i = 0; i < N; i++) input[i] = Math.sin(i * 0.7) + 0.3 * Math.cos(i * 2.1)

	let timeEnergy = 0
	for (let i = 0; i < N; i++) timeEnergy += input[i] * input[i]
	timeEnergy /= N

	const s = rfft(input)
	let freqEnergy = s[0] * s[0] / 4
	for (let i = 1; i < s.length; i++) freqEnergy += s[i] * s[i] / 2

	assert(Math.abs(timeEnergy - freqEnergy) < 1e-3,
		`Parseval: time=${timeEnergy.toFixed(6)}, freq=${freqEnergy.toFixed(6)}`)
})

test('linearity (non-overlapping frequencies)', () => {
	const N = 128
	const a = new Float32Array(N), b = new Float32Array(N), sum = new Float32Array(N)
	for (let i = 0; i < N; i++) {
		a[i] = Math.cos(2 * Math.PI * 3 * i / N)
		b[i] = 0.5 * Math.cos(2 * Math.PI * 10 * i / N)
		sum[i] = a[i] + b[i]
	}
	const sa = new Float64Array(rfft(a))
	const sb = new Float64Array(rfft(b))
	const sab = rfft(sum)

	for (let i = 0; i < sa.length; i++)
		assert(Math.abs(sab[i] - (sa[i] + sb[i])) < 1e-4, `bin ${i}: ${sab[i]} != ${sa[i]} + ${sb[i]}`)
})

// --- Sizes ---

test('all power-of-2 sizes from 2 to 16384', () => {
	for (let N = 2; N <= 16384; N *= 2) {
		const input = new Float32Array(N)
		for (let i = 0; i < N; i++) input[i] = Math.sin(2 * Math.PI * 3 * i / N)
		const s = rfft(input)
		assert.equal(s.length, N / 2)
		if (N >= 8) {
			for (let i = 1; i < s.length; i++) {
				if (i === 3) continue
				assert(s[i] <= s[3] + EPSILON, `N=${N}: bin ${i} (${s[i]}) > bin 3 (${s[3]})`)
			}
		}
	}
})

// --- Output modes ---

test('returns Float64Array', () => {
	assert(rfft(new Float32Array([1, 0, 0, 0])) instanceof Float64Array)
})

test('accepts plain Array input', () => {
	const s = rfft([1, 0, 0, 0])
	assert(Math.abs(s[0] - 0.5) < EPSILON)
	assert(Math.abs(s[1] - 0.5) < EPSILON)
})

test('output buffer parameter', () => {
	const N = 64
	const input = new Float32Array(N)
	for (let i = 0; i < N; i++) input[i] = Math.cos(2 * Math.PI * 5 * i / N)
	const out = new Float64Array(N / 2)
	const ret = rfft(input, out)
	assert.equal(ret, out)
	assert(Math.abs(out[5] - 1) < EPSILON)
})

test('internal buffer overwritten on repeated calls (view semantics)', () => {
	const N = 64
	const a = new Float32Array(N), b = new Float32Array(N)
	for (let i = 0; i < N; i++) {
		a[i] = Math.cos(2 * Math.PI * 5 * i / N)
		b[i] = Math.cos(2 * Math.PI * 10 * i / N)
	}
	const sa = rfft(a)
	assert(Math.abs(sa[5] - 1) < EPSILON)

	rfft(b) // overwrites sa since same N

	assert(sa[5] < EPSILON, `sa[5] should be overwritten: ${sa[5]}`)
	assert(Math.abs(sa[10] - 1) < EPSILON, `sa now reflects b's spectrum`)
})

// --- Complex output (fft) ---

test('fft: returns N/2+1 complex bins', () => {
	const N = 64
	const [re, im] = fft(new Float32Array(N))
	assert.equal(re.length, N / 2 + 1)
	assert.equal(im.length, N / 2 + 1)
})

test('fft: DC signal → real-only X[0]=N', () => {
	const N = 64
	const [re, im] = fft(new Float32Array(N).fill(1))
	assert(Math.abs(re[0] - N) < EPSILON, `DC re: ${re[0]}`)
	assert(Math.abs(im[0]) < EPSILON, `DC im: ${im[0]}`)
	for (let k = 1; k <= N / 2; k++) {
		assert(Math.abs(re[k]) < EPSILON, `re[${k}]: ${re[k]}`)
		assert(Math.abs(im[k]) < EPSILON, `im[${k}]: ${im[k]}`)
	}
})

test('fft: cosine → real component X[k] = N/2', () => {
	const N = 128
	for (const k of [1, 5, 32]) {
		const input = new Float32Array(N)
		for (let n = 0; n < N; n++) input[n] = Math.cos(2 * Math.PI * k * n / N)
		const [re, im] = fft(input)
		assert(Math.abs(re[k] - N / 2) < EPSILON, `cos k=${k}: re=${re[k]}, expected ${N / 2}`)
		assert(Math.abs(im[k]) < EPSILON, `cos k=${k}: im=${im[k]}, expected 0`)
	}
})

test('fft: sine → imaginary component X[k] = -jN/2', () => {
	const N = 128
	for (const k of [1, 5, 63]) {
		const input = new Float32Array(N)
		for (let n = 0; n < N; n++) input[n] = Math.sin(2 * Math.PI * k * n / N)
		const [re, im] = fft(input)
		assert(Math.abs(re[k]) < EPSILON, `sin k=${k}: re=${re[k]}, expected 0`)
		assert(Math.abs(im[k] - (-N / 2)) < EPSILON, `sin k=${k}: im=${im[k]}, expected ${-N / 2}`)
	}
})

test('fft: DC and Nyquist always have zero imaginary', () => {
	for (const N of [4, 64, 512]) {
		const input = new Float32Array(N)
		for (let i = 0; i < N; i++) input[i] = Math.sin(i * 1.7) + Math.cos(i * 0.3)
		const [, im] = fft(input)
		assert.equal(im[0], 0, `N=${N}: DC im must be 0`)
		assert.equal(im[N / 2], 0, `N=${N}: Nyquist im must be 0`)
	}
})

test('fft: magnitude matches rfft', () => {
	const N = 256
	const input = new Float32Array(N)
	for (let i = 0; i < N; i++) input[i] = Math.sin(i * 0.7) + Math.cos(i * 1.3)

	const mag = new Float64Array(rfft(input))
	const [re, im] = fft(input)

	const bSi = 2 / N
	assert(Math.abs(mag[0] - Math.abs(bSi * re[0])) < EPSILON, `DC mismatch`)
	for (let k = 1; k < N / 2; k++) {
		const expected = bSi * Math.sqrt(re[k] * re[k] + im[k] * im[k])
		assert(Math.abs(mag[k] - expected) < EPSILON, `bin ${k}: rfft=${mag[k]}, fft=${expected}`)
	}
})

test('fft: output buffer parameter', () => {
	const N = 64
	const out = [new Float64Array(N / 2 + 1), new Float64Array(N / 2 + 1)]
	const ret = fft(new Float32Array(N).fill(1), out)
	assert.equal(ret, out)
	assert(Math.abs(out[0][0] - N) < EPSILON)
})

test('fft: view overwritten on repeated calls', () => {
	const N = 64
	const a = new Float32Array(N), b = new Float32Array(N)
	for (let i = 0; i < N; i++) {
		a[i] = Math.cos(2 * Math.PI * 5 * i / N)
		b[i] = Math.sin(2 * Math.PI * 10 * i / N)
	}
	const ra = fft(a)
	assert(Math.abs(ra[0][5] - N / 2) < EPSILON)

	fft(b) // overwrites ra since same N

	assert(Math.abs(ra[0][5]) < EPSILON, 'ra[0][5] should be overwritten')
	assert(Math.abs(ra[1][10] - (-N / 2)) < EPSILON, 'ra now reflects b')
})

// --- Inverse real FFT (irfft) ---

test('irfft: rejects invalid input', () => {
	// bins=1 → N=0 (invalid)
	assert.throws(() => irfft(new Float64Array(1), new Float64Array(1)))
	// bins=4 → N=6 (not power of 2)
	assert.throws(() => irfft(new Float64Array(4), new Float64Array(4)))
})

test('irfft(fft(x)) round-trip recovers signal', () => {
	for (const N of [4, 64, 256, 1024]) {
		const input = new Float32Array(N)
		for (let i = 0; i < N; i++) input[i] = Math.sin(i * 0.7) + Math.cos(i * 1.3)

		const [re, im] = fft(input)
		const recovered = irfft(re, im)

		assert.equal(recovered.length, N)
		for (let i = 0; i < N; i++)
			assert(Math.abs(recovered[i] - input[i]) < EPSILON, `N=${N}, i=${i}: ${recovered[i]} vs ${input[i]}`)
	}
})

test('irfft: DC spectrum → constant signal', () => {
	const N = 64, half = N / 2
	const re = new Float64Array(half + 1)
	const im = new Float64Array(half + 1)
	re[0] = N // X[0] = N for DC=1
	const out = irfft(re, im)
	for (let i = 0; i < N; i++)
		assert(Math.abs(out[i] - 1) < EPSILON, `i=${i}: ${out[i]}`)
})

test('irfft: cosine spectrum → cosine signal', () => {
	const N = 128, k0 = 5, half = N / 2
	const re = new Float64Array(half + 1)
	const im = new Float64Array(half + 1)
	re[k0] = N / 2 // cos at bin k0
	const out = irfft(re, im)
	for (let i = 0; i < N; i++) {
		const expected = Math.cos(2 * Math.PI * k0 * i / N)
		assert(Math.abs(out[i] - expected) < EPSILON, `i=${i}: ${out[i]} vs ${expected}`)
	}
})

test('irfft: sine spectrum → sine signal', () => {
	const N = 128, k0 = 5, half = N / 2
	const re = new Float64Array(half + 1)
	const im = new Float64Array(half + 1)
	im[k0] = -N / 2 // sin at bin k0: X[k0] = -jN/2
	const out = irfft(re, im)
	for (let i = 0; i < N; i++) {
		const expected = Math.sin(2 * Math.PI * k0 * i / N)
		assert(Math.abs(out[i] - expected) < EPSILON, `i=${i}: ${out[i]} vs ${expected}`)
	}
})

test('irfft: output buffer parameter', () => {
	const N = 64, half = N / 2
	const re = new Float64Array(half + 1)
	const im = new Float64Array(half + 1)
	re[0] = N
	const buf = new Float64Array(N)
	const ret = irfft(re, im, buf)
	assert.equal(ret, buf)
	assert(Math.abs(buf[0] - 1) < EPSILON)
})

test('irfft: view overwritten on repeated calls', () => {
	const N = 64, half = N / 2

	const re1 = new Float64Array(half + 1), im1 = new Float64Array(half + 1)
	re1[0] = N // DC → all ones
	const a = irfft(re1, im1)
	assert(Math.abs(a[half] - 1) < EPSILON, 'DC: a[32] should be 1')

	const re2 = new Float64Array(half + 1), im2 = new Float64Array(half + 1)
	re2[3] = N / 2 // cosine at bin 3 → cos(2π·3·32/64) = cos(3π) = -1
	irfft(re2, im2) // overwrites a

	assert(Math.abs(a[half] - (-1)) < EPSILON, 'a[32] should now be -1 (cosine at bin 3)')
})

// --- Complex FFT (cfft / cifft) ---

test('cfft: rejects invalid input', () => {
	assert.throws(() => cfft(new Float64Array(0), new Float64Array(0)))
	assert.throws(() => cfft(new Float64Array(1), new Float64Array(1)))
	assert.throws(() => cfft(new Float64Array(3), new Float64Array(3)))
})

test('cfft: impulse → flat spectrum', () => {
	const N = 64
	const re = new Float64Array(N), im = new Float64Array(N)
	re[0] = 1
	cfft(re, im)
	for (let k = 0; k < N; k++) {
		assert(Math.abs(re[k] - 1) < EPSILON, `re[${k}]: ${re[k]}`)
		assert(Math.abs(im[k]) < EPSILON, `im[${k}]: ${im[k]}`)
	}
})

test('cfft: complex exponential e^{j2πk₀n/N} → delta at bin k₀', () => {
	const N = 64, k0 = 7
	const re = new Float64Array(N), im = new Float64Array(N)
	for (let n = 0; n < N; n++) {
		re[n] = Math.cos(2 * Math.PI * k0 * n / N)
		im[n] = Math.sin(2 * Math.PI * k0 * n / N)
	}
	cfft(re, im)
	for (let k = 0; k < N; k++) {
		const expRe = k === k0 ? N : 0
		assert(Math.abs(re[k] - expRe) < EPSILON, `re[${k}]: ${re[k]}, expected ${expRe}`)
		assert(Math.abs(im[k]) < EPSILON, `im[${k}]: ${im[k]}`)
	}
})

test('cfft: real cosine → symmetric spectrum', () => {
	const N = 64, k0 = 5
	const re = new Float64Array(N), im = new Float64Array(N)
	for (let n = 0; n < N; n++) re[n] = Math.cos(2 * Math.PI * k0 * n / N)
	cfft(re, im)
	// cos → X[k0] = N/2, X[N-k0] = N/2 (conjugate symmetry)
	assert(Math.abs(re[k0] - N / 2) < EPSILON)
	assert(Math.abs(im[k0]) < EPSILON)
	assert(Math.abs(re[N - k0] - N / 2) < EPSILON)
	assert(Math.abs(im[N - k0]) < EPSILON)
})

test('cfft: real sine → antisymmetric imaginary', () => {
	const N = 64, k0 = 5
	const re = new Float64Array(N), im = new Float64Array(N)
	for (let n = 0; n < N; n++) re[n] = Math.sin(2 * Math.PI * k0 * n / N)
	cfft(re, im)
	// sin → X[k0] = -jN/2, X[N-k0] = jN/2
	assert(Math.abs(re[k0]) < EPSILON)
	assert(Math.abs(im[k0] - (-N / 2)) < EPSILON)
	assert(Math.abs(re[N - k0]) < EPSILON)
	assert(Math.abs(im[N - k0] - N / 2) < EPSILON)
})

test('cfft: consistent with fft for real input', () => {
	const N = 128
	const input = new Float32Array(N)
	for (let i = 0; i < N; i++) input[i] = Math.sin(i * 0.7) + Math.cos(i * 1.3)

	const [fRe, fIm] = fft(input)

	const cRe = new Float64Array(N), cIm = new Float64Array(N)
	for (let i = 0; i < N; i++) cRe[i] = input[i]
	cfft(cRe, cIm)

	// fft returns N/2+1 bins; cfft returns full N (with conjugate symmetry)
	for (let k = 0; k <= N / 2; k++) {
		assert(Math.abs(cRe[k] - fRe[k]) < EPSILON, `re[${k}]: cfft=${cRe[k]}, fft=${fRe[k]}`)
		assert(Math.abs(cIm[k] - fIm[k]) < EPSILON, `im[${k}]: cfft=${cIm[k]}, fft=${fIm[k]}`)
	}
})

test('cfft + cifft: round-trip recovers original', () => {
	const N = 256
	const re = new Float64Array(N), im = new Float64Array(N)
	const origRe = new Float64Array(N), origIm = new Float64Array(N)
	for (let i = 0; i < N; i++) {
		re[i] = origRe[i] = Math.sin(i * 0.3) + Math.cos(i * 1.7)
		im[i] = origIm[i] = Math.cos(i * 0.5) - Math.sin(i * 2.1)
	}

	cfft(re, im)
	cifft(re, im)

	for (let i = 0; i < N; i++) {
		assert(Math.abs(re[i] - origRe[i]) < EPSILON, `re[${i}]: ${re[i]} vs ${origRe[i]}`)
		assert(Math.abs(im[i] - origIm[i]) < EPSILON, `im[${i}]: ${im[i]} vs ${origIm[i]}`)
	}
})

test('cfft: Parseval energy conservation', () => {
	const N = 128
	const re = new Float64Array(N), im = new Float64Array(N)
	for (let i = 0; i < N; i++) { re[i] = Math.sin(i * 0.7); im[i] = Math.cos(i * 1.3) }

	let timeEnergy = 0
	for (let i = 0; i < N; i++) timeEnergy += re[i] * re[i] + im[i] * im[i]

	cfft(re, im)

	let freqEnergy = 0
	for (let i = 0; i < N; i++) freqEnergy += re[i] * re[i] + im[i] * im[i]
	freqEnergy /= N

	assert(Math.abs(timeEnergy - freqEnergy) < 1e-3,
		`Parseval: time=${timeEnergy.toFixed(6)}, freq=${freqEnergy.toFixed(6)}`)
})

test('cfft: all power-of-2 sizes from 2 to 4096', () => {
	for (let N = 2; N <= 4096; N *= 2) {
		const re = new Float64Array(N), im = new Float64Array(N)
		re[0] = 1
		cfft(re, im)
		for (let k = 0; k < N; k++)
			assert(Math.abs(re[k] - 1) < EPSILON, `N=${N}, re[${k}]=${re[k]}`)
	}
})
