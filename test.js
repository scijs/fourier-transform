import { test } from 'node:test'
import assert from 'node:assert/strict'
import rfft from './index.js'

const EPSILON = 1e-6

// Validation

test('rejects invalid input', () => {
	assert.throws(() => rfft(new Float32Array(0)))
	assert.throws(() => rfft(new Float32Array(1)))
	assert.throws(() => rfft(new Float32Array(3)))
	assert.throws(() => rfft(new Float32Array(6)))
	assert.throws(() => rfft(new Float32Array(15)))
})

// Fundamental identities

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

// Linearity

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

// Sizes

test('all power-of-2 sizes from 2 to 16384', () => {
	for (let N = 2; N <= 16384; N *= 2) {
		const input = new Float32Array(N)
		for (let i = 0; i < N; i++) input[i] = Math.sin(2 * Math.PI * 3 * i / N)
		const s = rfft(input)
		assert.equal(s.length, N / 2)
		// bin 3 should be the peak (for N >= 8 where bin 3 is a distinct frequency)
		if (N >= 8) {
			for (let i = 1; i < s.length; i++) {
				if (i === 3) continue
				assert(s[i] <= s[3] + EPSILON, `N=${N}: bin ${i} (${s[i]}) > bin 3 (${s[3]})`)
			}
		}
	}
})

// Output modes

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
	const peakA = sa[5]
	assert(Math.abs(peakA - 1) < EPSILON)

	rfft(b) // overwrites sa since same N

	assert(sa[5] < EPSILON, `sa[5] should be overwritten: ${sa[5]}`)
	assert(Math.abs(sa[10] - 1) < EPSILON, `sa now reflects b's spectrum`)
})

test('zero signal', () => {
	const s = rfft(new Float32Array(64))
	for (let i = 0; i < s.length; i++)
		assert.equal(s[i], 0, `bin ${i}: ${s[i]}`)
})
