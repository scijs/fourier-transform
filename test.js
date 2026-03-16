import { test } from 'node:test'
import assert from 'node:assert/strict'
import rfft from './index.js'

const EPSILON = 1e-6

test('rejects invalid input', () => {
	assert.throws(() => rfft(new Float32Array(0)))
	assert.throws(() => rfft(new Float32Array(3)))
	assert.throws(() => rfft(new Float32Array(6)))
	assert.throws(() => rfft(new Float32Array(15)))
})

test('N=2', () => {
	const s = rfft(new Float32Array([1, 0]))
	assert.equal(s.length, 1)
	assert(Math.abs(s[0] - 1) < EPSILON, `DC: ${s[0]}`)
})

test('N=4 DC', () => {
	const s = rfft(new Float32Array([1, 1, 1, 1]))
	assert.equal(s.length, 2)
	assert(Math.abs(s[0] - 2) < EPSILON, `DC: ${s[0]}`)
	assert(s[1] < EPSILON, `bin 1: ${s[1]}`)
})

test('DC signal', () => {
	const N = 256
	const s = rfft(new Float32Array(N).fill(1))
	assert.equal(s.length, N / 2)
	assert(Math.abs(s[0] - 2) < EPSILON, `DC: ${s[0]}`)
	for (let i = 1; i < s.length; i++)
		assert(s[i] < EPSILON, `bin ${i}: ${s[i]}`)
})

test('pure cosine at various bins', () => {
	const N = 256
	for (const k of [1, 7, 32, 100]) {
		const input = new Float32Array(N)
		for (let n = 0; n < N; n++) input[n] = Math.cos(2 * Math.PI * k * n / N)
		const s = rfft(input)
		assert(Math.abs(s[k] - 1) < EPSILON, `k=${k}: expected 1, got ${s[k]}`)
		for (let i = 1; i < s.length; i++) {
			if (i === k) continue
			assert(s[i] < 1e-4, `k=${k}, bin ${i}: expected ~0, got ${s[i]}`)
		}
	}
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

test('various power-of-2 sizes', () => {
	for (const N of [4, 8, 16, 32, 64, 512, 1024, 2048, 4096]) {
		const input = new Float32Array(N)
		for (let i = 0; i < N; i++) input[i] = Math.sin(2 * Math.PI * 3 * i / N)
		const s = rfft(input)
		assert.equal(s.length, N / 2)
		// bin 3 should be the peak (for N >= 8)
		if (N >= 8) {
			for (let i = 1; i < s.length; i++) {
				if (i === 3) continue
				assert(s[i] < s[3] + EPSILON, `N=${N}: bin ${i} (${s[i]}) > bin 3 (${s[3]})`)
			}
		}
	}
})

test('returns Float64Array', () => {
	const s = rfft(new Float32Array([1, 0, 0, 0]))
	assert(s instanceof Float64Array)
})
