import t from 'tst'
import { fft, ifft, cfft, cifft } from '../index.js'

const EPSILON = 1e-6

// --- Complex output (fft) ---

t('fft: returns N/2+1 complex bins', () => {
	const N = 64
	const [re, im] = fft(new Float32Array(N))
	if (re.length !== N / 2 + 1) throw new Error(`re length: ${re.length}`)
	if (im.length !== N / 2 + 1) throw new Error(`im length: ${im.length}`)
})

t('fft: DC signal → real-only X[0]=N', () => {
	const N = 64
	const [re, im] = fft(new Float32Array(N).fill(1))
	if (Math.abs(re[0] - N) >= EPSILON) throw new Error(`DC re: ${re[0]}`)
	if (Math.abs(im[0]) >= EPSILON) throw new Error(`DC im: ${im[0]}`)
	for (let k = 1; k <= N / 2; k++) {
		if (Math.abs(re[k]) >= EPSILON) throw new Error(`re[${k}]: ${re[k]}`)
		if (Math.abs(im[k]) >= EPSILON) throw new Error(`im[${k}]: ${im[k]}`)
	}
})

t('fft: cosine → real component X[k] = N/2', () => {
	const N = 128
	for (const k of [1, 5, 32]) {
		const input = new Float32Array(N)
		for (let n = 0; n < N; n++) input[n] = Math.cos(2 * Math.PI * k * n / N)
		const [re, im] = fft(input)
		if (Math.abs(re[k] - N / 2) >= EPSILON) throw new Error(`cos k=${k}: re=${re[k]}`)
		if (Math.abs(im[k]) >= EPSILON) throw new Error(`cos k=${k}: im=${im[k]}`)
	}
})

t('fft: sine → imaginary component X[k] = -jN/2', () => {
	const N = 128
	for (const k of [1, 5, 63]) {
		const input = new Float32Array(N)
		for (let n = 0; n < N; n++) input[n] = Math.sin(2 * Math.PI * k * n / N)
		const [re, im] = fft(input)
		if (Math.abs(re[k]) >= EPSILON) throw new Error(`sin k=${k}: re=${re[k]}`)
		if (Math.abs(im[k] - (-N / 2)) >= EPSILON) throw new Error(`sin k=${k}: im=${im[k]}`)
	}
})

t('fft: DC and Nyquist always have zero imaginary', () => {
	for (const N of [4, 64, 512]) {
		const input = new Float32Array(N)
		for (let i = 0; i < N; i++) input[i] = Math.sin(i * 1.7) + Math.cos(i * 0.3)
		const [, im] = fft(input)
		if (im[0] !== 0) throw new Error(`N=${N}: DC im must be 0`)
		if (im[N / 2] !== 0) throw new Error(`N=${N}: Nyquist im must be 0`)
	}
})

t('fft: magnitude matches rfft', () => {
	const N = 256
	const input = new Float32Array(N)
	for (let i = 0; i < N; i++) input[i] = Math.sin(i * 0.7) + Math.cos(i * 1.3)

	import('../index.js').then(m => {
		const mag = new Float64Array(m.default(input))
		const [re, im] = fft(input)

		const bSi = 2 / N
		if (Math.abs(mag[0] - Math.abs(bSi * re[0])) >= EPSILON) throw new Error('DC mismatch')
		for (let k = 1; k < N / 2; k++) {
			const expected = bSi * Math.sqrt(re[k] * re[k] + im[k] * im[k])
			if (Math.abs(mag[k] - expected) >= EPSILON) throw new Error(`bin ${k}: ${mag[k]} vs ${expected}`)
		}
	})
})

t('fft: output buffer parameter', () => {
	const N = 64
	const out = [new Float64Array(N / 2 + 1), new Float64Array(N / 2 + 1)]
	const ret = fft(new Float32Array(N).fill(1), out)
	if (ret !== out) throw new Error('Expected return to be out buffer')
	if (Math.abs(out[0][0] - N) >= EPSILON) throw new Error(`out[0][0]=${out[0][0]}`)
})

t('fft: view overwritten on repeated calls', () => {
	const N = 64
	const a = new Float32Array(N), b = new Float32Array(N)
	for (let i = 0; i < N; i++) {
		a[i] = Math.cos(2 * Math.PI * 5 * i / N)
		b[i] = Math.sin(2 * Math.PI * 10 * i / N)
	}
	const ra = fft(a)
	if (Math.abs(ra[0][5] - N / 2) >= EPSILON) throw new Error(`ra[0][5]=${ra[0][5]}`)

	fft(b)

	if (Math.abs(ra[0][5]) >= EPSILON) throw new Error('ra[0][5] should be overwritten')
	if (Math.abs(ra[1][10] - (-N / 2)) >= EPSILON) throw new Error(`ra[1][10]=${ra[1][10]}`)
})

// --- Inverse real FFT (ifft) ---

t('ifft: rejects invalid input', () => {
	let threw = false
	try { ifft(new Float64Array(1), new Float64Array(1)) } catch (e) { threw = true }
	if (!threw) throw new Error('Expected throw for bins=1')

	threw = false
	try { ifft(new Float64Array(4), new Float64Array(4)) } catch (e) { threw = true }
	if (!threw) throw new Error('Expected throw for bins=4 (N=6)')
})

t('ifft(fft(x)) round-trip recovers signal', () => {
	for (const N of [4, 64, 256, 1024]) {
		const input = new Float32Array(N)
		for (let i = 0; i < N; i++) input[i] = Math.sin(i * 0.7) + Math.cos(i * 1.3)

		const [re, im] = fft(input)
		const recovered = ifft(re, im)

		if (recovered.length !== N) throw new Error(`N=${N}: length ${recovered.length}`)
		for (let i = 0; i < N; i++)
			if (Math.abs(recovered[i] - input[i]) >= EPSILON)
				throw new Error(`N=${N}, i=${i}: ${recovered[i]} vs ${input[i]}`)
	}
})

t('ifft: DC spectrum → constant signal', () => {
	const N = 64, half = N / 2
	const re = new Float64Array(half + 1)
	const im = new Float64Array(half + 1)
	re[0] = N
	const out = ifft(re, im)
	for (let i = 0; i < N; i++)
		if (Math.abs(out[i] - 1) >= EPSILON) throw new Error(`i=${i}: ${out[i]}`)
})

t('ifft: cosine spectrum → cosine signal', () => {
	const N = 128, k0 = 5, half = N / 2
	const re = new Float64Array(half + 1)
	const im = new Float64Array(half + 1)
	re[k0] = N / 2
	const out = ifft(re, im)
	for (let i = 0; i < N; i++) {
		const expected = Math.cos(2 * Math.PI * k0 * i / N)
		if (Math.abs(out[i] - expected) >= EPSILON) throw new Error(`i=${i}: ${out[i]} vs ${expected}`)
	}
})

t('ifft: sine spectrum → sine signal', () => {
	const N = 128, k0 = 5, half = N / 2
	const re = new Float64Array(half + 1)
	const im = new Float64Array(half + 1)
	im[k0] = -N / 2
	const out = ifft(re, im)
	for (let i = 0; i < N; i++) {
		const expected = Math.sin(2 * Math.PI * k0 * i / N)
		if (Math.abs(out[i] - expected) >= EPSILON) throw new Error(`i=${i}: ${out[i]} vs ${expected}`)
	}
})

t('ifft: output buffer parameter', () => {
	const N = 64, half = N / 2
	const re = new Float64Array(half + 1)
	const im = new Float64Array(half + 1)
	re[0] = N
	const buf = new Float64Array(N)
	const ret = ifft(re, im, buf)
	if (ret !== buf) throw new Error('Expected return to be buf')
	if (Math.abs(buf[0] - 1) >= EPSILON) throw new Error(`buf[0]=${buf[0]}`)
})

t('ifft: view overwritten on repeated calls', () => {
	const N = 64, half = N / 2

	const re1 = new Float64Array(half + 1), im1 = new Float64Array(half + 1)
	re1[0] = N
	const a = ifft(re1, im1)
	if (Math.abs(a[half] - 1) >= EPSILON) throw new Error(`DC: a[${half}]=${a[half]}`)

	const re2 = new Float64Array(half + 1), im2 = new Float64Array(half + 1)
	re2[3] = N / 2
	ifft(re2, im2)

	if (Math.abs(a[half] - (-1)) >= EPSILON) throw new Error(`a[${half}]=${a[half]}, expected -1`)
})

// --- Complex FFT (cfft / cifft) ---

t('cfft: rejects invalid input', () => {
	let threw = false
	try { cfft(new Float64Array(0), new Float64Array(0)) } catch (e) { threw = true }
	if (!threw) throw new Error('Expected throw for length 0')

	threw = false
	try { cfft(new Float64Array(1), new Float64Array(1)) } catch (e) { threw = true }
	if (!threw) throw new Error('Expected throw for length 1')

	threw = false
	try { cfft(new Float64Array(3), new Float64Array(3)) } catch (e) { threw = true }
	if (!threw) throw new Error('Expected throw for length 3')
})

t('cfft: impulse → flat spectrum', () => {
	const N = 64
	const re = new Float64Array(N), im = new Float64Array(N)
	re[0] = 1
	cfft(re, im)
	for (let k = 0; k < N; k++) {
		if (Math.abs(re[k] - 1) >= EPSILON) throw new Error(`re[${k}]: ${re[k]}`)
		if (Math.abs(im[k]) >= EPSILON) throw new Error(`im[${k}]: ${im[k]}`)
	}
})

t('cfft: complex exponential e^{j2πk₀n/N} → delta at bin k₀', () => {
	const N = 64, k0 = 7
	const re = new Float64Array(N), im = new Float64Array(N)
	for (let n = 0; n < N; n++) {
		re[n] = Math.cos(2 * Math.PI * k0 * n / N)
		im[n] = Math.sin(2 * Math.PI * k0 * n / N)
	}
	cfft(re, im)
	for (let k = 0; k < N; k++) {
		const expRe = k === k0 ? N : 0
		if (Math.abs(re[k] - expRe) >= EPSILON) throw new Error(`re[${k}]: ${re[k]}`)
		if (Math.abs(im[k]) >= EPSILON) throw new Error(`im[${k}]: ${im[k]}`)
	}
})

t('cfft: real cosine → symmetric spectrum', () => {
	const N = 64, k0 = 5
	const re = new Float64Array(N), im = new Float64Array(N)
	for (let n = 0; n < N; n++) re[n] = Math.cos(2 * Math.PI * k0 * n / N)
	cfft(re, im)
	if (Math.abs(re[k0] - N / 2) >= EPSILON) throw new Error(`re[${k0}]=${re[k0]}`)
	if (Math.abs(im[k0]) >= EPSILON) throw new Error(`im[${k0}]=${im[k0]}`)
	if (Math.abs(re[N - k0] - N / 2) >= EPSILON) throw new Error(`re[${N - k0}]=${re[N - k0]}`)
	if (Math.abs(im[N - k0]) >= EPSILON) throw new Error(`im[${N - k0}]=${im[N - k0]}`)
})

t('cfft: real sine → antisymmetric imaginary', () => {
	const N = 64, k0 = 5
	const re = new Float64Array(N), im = new Float64Array(N)
	for (let n = 0; n < N; n++) re[n] = Math.sin(2 * Math.PI * k0 * n / N)
	cfft(re, im)
	if (Math.abs(re[k0]) >= EPSILON) throw new Error(`re[${k0}]=${re[k0]}`)
	if (Math.abs(im[k0] - (-N / 2)) >= EPSILON) throw new Error(`im[${k0}]=${im[k0]}`)
	if (Math.abs(re[N - k0]) >= EPSILON) throw new Error(`re[${N - k0}]=${re[N - k0]}`)
	if (Math.abs(im[N - k0] - N / 2) >= EPSILON) throw new Error(`im[${N - k0}]=${im[N - k0]}`)
})

t('cfft: consistent with fft for real input', () => {
	const N = 128
	const input = new Float32Array(N)
	for (let i = 0; i < N; i++) input[i] = Math.sin(i * 0.7) + Math.cos(i * 1.3)

	const [fRe, fIm] = fft(input)

	const cRe = new Float64Array(N), cIm = new Float64Array(N)
	for (let i = 0; i < N; i++) cRe[i] = input[i]
	cfft(cRe, cIm)

	for (let k = 0; k <= N / 2; k++) {
		if (Math.abs(cRe[k] - fRe[k]) >= EPSILON) throw new Error(`re[${k}]: ${cRe[k]} vs ${fRe[k]}`)
		if (Math.abs(cIm[k] - fIm[k]) >= EPSILON) throw new Error(`im[${k}]: ${cIm[k]} vs ${fIm[k]}`)
	}
})

t('cfft + cifft: round-trip recovers original', () => {
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
		if (Math.abs(re[i] - origRe[i]) >= EPSILON) throw new Error(`re[${i}]: ${re[i]} vs ${origRe[i]}`)
		if (Math.abs(im[i] - origIm[i]) >= EPSILON) throw new Error(`im[${i}]: ${im[i]} vs ${origIm[i]}`)
	}
})

t('cfft: Parseval energy conservation', () => {
	const N = 128
	const re = new Float64Array(N), im = new Float64Array(N)
	for (let i = 0; i < N; i++) { re[i] = Math.sin(i * 0.7); im[i] = Math.cos(i * 1.3) }

	let timeEnergy = 0
	for (let i = 0; i < N; i++) timeEnergy += re[i] * re[i] + im[i] * im[i]

	cfft(re, im)

	let freqEnergy = 0
	for (let i = 0; i < N; i++) freqEnergy += re[i] * re[i] + im[i] * im[i]
	freqEnergy /= N

	if (Math.abs(timeEnergy - freqEnergy) >= 1e-3)
		throw new Error(`Parseval: time=${timeEnergy.toFixed(6)}, freq=${freqEnergy.toFixed(6)}`)
})

t('cfft: all power-of-2 sizes from 2 to 4096', () => {
	for (let N = 2; N <= 4096; N *= 2) {
		const re = new Float64Array(N), im = new Float64Array(N)
		re[0] = 1
		cfft(re, im)
		for (let k = 0; k < N; k++)
			if (Math.abs(re[k] - 1) >= EPSILON) throw new Error(`N=${N}, re[${k}]=${re[k]}`)
	}
})
