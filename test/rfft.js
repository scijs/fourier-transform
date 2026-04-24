import t from 'tst'
import rfft from '../index.js'

const EPSILON = 1e-6

t('rejects invalid input', () => {
	let threw = false
	try { rfft(new Float32Array(0)) } catch (e) { threw = true }
	if (!threw) throw new Error('Expected throw for length 0')

	threw = false
	try { rfft(new Float32Array(1)) } catch (e) { threw = true }
	if (!threw) throw new Error('Expected throw for length 1')

	threw = false
	try { rfft(new Float32Array(3)) } catch (e) { threw = true }
	if (!threw) throw new Error('Expected throw for length 3')

	threw = false
	try { rfft(new Float32Array(6)) } catch (e) { threw = true }
	if (!threw) throw new Error('Expected throw for length 6')

	threw = false
	try { rfft(new Float32Array(15)) } catch (e) { threw = true }
	if (!threw) throw new Error('Expected throw for length 15')
})

t('impulse → flat spectrum', () => {
	for (const N of [4, 8, 64, 1024]) {
		const input = new Float32Array(N)
		input[0] = 1
		const s = rfft(input)
		const expected = 2 / N
		for (let i = 0; i < s.length; i++)
			if (Math.abs(s[i] - expected) >= EPSILON) throw new Error(`N=${N}, bin ${i}: ${s[i]} != ${expected}`)
	}
})

t('DC signal', () => {
	for (const N of [2, 4, 64, 256]) {
		const s = rfft(new Float32Array(N).fill(1))
		if (s.length !== N / 2) throw new Error(`Expected length ${N / 2}, got ${s.length}`)
		if (Math.abs(s[0] - 2) >= EPSILON) throw new Error(`N=${N} DC: ${s[0]}`)
		for (let i = 1; i < s.length; i++)
			if (s[i] >= EPSILON) throw new Error(`N=${N} bin ${i}: ${s[i]}`)
	}
})

t('zero signal', () => {
	const s = rfft(new Float32Array(64))
	for (let i = 0; i < s.length; i++)
		if (s[i] !== 0) throw new Error(`bin ${i}: ${s[i]}`)
})

t('pure cosine at various bins', () => {
	const N = 256
	for (const k of [1, 7, 32, 100]) {
		const input = new Float32Array(N)
		for (let n = 0; n < N; n++) input[n] = Math.cos(2 * Math.PI * k * n / N)
		const s = rfft(input)
		if (Math.abs(s[k] - 1) >= EPSILON) throw new Error(`cos k=${k}: expected 1, got ${s[k]}`)
		for (let i = 1; i < s.length; i++) {
			if (i === k) continue
			if (s[i] >= 1e-4) throw new Error(`cos k=${k}, bin ${i}: expected ~0, got ${s[i]}`)
		}
	}
})

t('pure sine at various bins', () => {
	const N = 256
	for (const k of [1, 5, 32, 127]) {
		const input = new Float32Array(N)
		for (let n = 0; n < N; n++) input[n] = Math.sin(2 * Math.PI * k * n / N)
		const s = rfft(input)
		if (Math.abs(s[k] - 1) >= EPSILON) throw new Error(`sin k=${k}: expected 1, got ${s[k]}`)
		for (let i = 1; i < s.length; i++) {
			if (i === k) continue
			if (s[i] >= 1e-4) throw new Error(`sin k=${k}, bin ${i}: expected ~0, got ${s[i]}`)
		}
	}
})

t('amplitude scaling', () => {
	const N = 128
	for (const amp of [0.5, 2, 7.3]) {
		const input = new Float32Array(N)
		for (let n = 0; n < N; n++) input[n] = amp * Math.cos(2 * Math.PI * 5 * n / N)
		const s = rfft(input)
		if (Math.abs(s[5] - amp) >= EPSILON) throw new Error(`amp=${amp}: expected ${amp}, got ${s[5]}`)
	}
})

t('Parseval energy conservation', () => {
	const N = 512
	const input = new Float32Array(N)
	for (let i = 0; i < N; i++) input[i] = Math.sin(i * 0.7) + 0.3 * Math.cos(i * 2.1)

	let timeEnergy = 0
	for (let i = 0; i < N; i++) timeEnergy += input[i] * input[i]
	timeEnergy /= N

	const s = rfft(input)
	let freqEnergy = s[0] * s[0] / 4
	for (let i = 1; i < s.length; i++) freqEnergy += s[i] * s[i] / 2

	if (Math.abs(timeEnergy - freqEnergy) >= 1e-3)
		throw new Error(`Parseval: time=${timeEnergy.toFixed(6)}, freq=${freqEnergy.toFixed(6)}`)
})

t('linearity (non-overlapping frequencies)', () => {
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
		if (Math.abs(sab[i] - (sa[i] + sb[i])) >= 1e-4)
			throw new Error(`bin ${i}: ${sab[i]} != ${sa[i]} + ${sb[i]}`)
})

t('all power-of-2 sizes from 2 to 16384', () => {
	for (let N = 2; N <= 16384; N *= 2) {
		const input = new Float32Array(N)
		for (let i = 0; i < N; i++) input[i] = Math.sin(2 * Math.PI * 3 * i / N)
		const s = rfft(input)
		if (s.length !== N / 2) throw new Error(`N=${N}: expected length ${N / 2}, got ${s.length}`)
		if (N >= 8) {
			for (let i = 1; i < s.length; i++) {
				if (i === 3) continue
				if (s[i] > s[3] + EPSILON) throw new Error(`N=${N}: bin ${i} (${s[i]}) > bin 3 (${s[3]})`)
			}
		}
	}
})

t('returns Float64Array', () => {
	if (!(rfft(new Float32Array([1, 0, 0, 0])) instanceof Float64Array))
		throw new Error('Expected Float64Array')
})

t('accepts plain Array input', () => {
	const s = rfft([1, 0, 0, 0])
	if (Math.abs(s[0] - 0.5) >= EPSILON) throw new Error(`s[0]=${s[0]}`)
	if (Math.abs(s[1] - 0.5) >= EPSILON) throw new Error(`s[1]=${s[1]}`)
})

t('output buffer parameter', () => {
	const N = 64
	const input = new Float32Array(N)
	for (let i = 0; i < N; i++) input[i] = Math.cos(2 * Math.PI * 5 * i / N)
	const out = new Float64Array(N / 2)
	const ret = rfft(input, out)
	if (ret !== out) throw new Error('Expected return to be out buffer')
	if (Math.abs(out[5] - 1) >= EPSILON) throw new Error(`out[5]=${out[5]}`)
})

t('internal buffer overwritten on repeated calls (view semantics)', () => {
	const N = 64
	const a = new Float32Array(N), b = new Float32Array(N)
	for (let i = 0; i < N; i++) {
		a[i] = Math.cos(2 * Math.PI * 5 * i / N)
		b[i] = Math.cos(2 * Math.PI * 10 * i / N)
	}
	const sa = rfft(a)
	if (Math.abs(sa[5] - 1) >= EPSILON) throw new Error(`sa[5]=${sa[5]}`)

	rfft(b)

	if (sa[5] >= EPSILON) throw new Error(`sa[5] should be overwritten: ${sa[5]}`)
	if (Math.abs(sa[10] - 1) >= EPSILON) throw new Error(`sa[10]=${sa[10]}`)
})
