import t from 'tst'
import pair, { own } from '../pair.js'
import { fft, ifft } from '../index.js'
import { stftStream } from '../stft.js'

// a seeded generator: the same inputs every run
const rand = (s => () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32 - 0.5)(1)
const same = (a, b) => a.length === b.length && a.every((v, i) => Object.is(v, b[i]))

t('pair: each lane gives fft() and ifft() bit for bit, N 4 to 16384', () => {
	for (let N = 4; N <= 16384; N *= 2) {
		const p = pair(N), half = N >> 1
		if (!p) return console.warn('pair: no WebAssembly SIMD here, skipped')
		for (let rep = 0; rep < 3; rep++) {
			// lane a spans magnitudes 1e-2…1e2, lane b is plain noise
			const a = Float64Array.from({ length: N }, () => rand() * 10 ** (4 * rand())), b = Float64Array.from({ length: N }, rand)
			for (let i = 0; i < N; i++) { p.input[2 * i] = a[i]; p.input[2 * i + 1] = b[i] }
			p.fft()
			for (const [c, x] of [[0, a], [1, b]]) {
				const re = new Float64Array(half + 1), im = new Float64Array(half + 1)
				fft(x, [re, im])
				if (!same(re, p.re[c]) || !same(im, p.im[c])) throw new Error(`N ${N} lane ${c}: bins differ from fft()`)
			}
			const bins = [0, 1].map(() => [Float64Array.from({ length: half + 1 }, rand), Float64Array.from({ length: half + 1 }, rand)])
			for (let c = 0; c < 2; c++) { p.re[c].set(bins[c][0]); p.im[c].set(bins[c][1]) }
			p.ifft()
			for (let c = 0; c < 2; c++) {
				const o = new Float64Array(N)
				ifft(bins[c][0], bins[c][1], o)
				if (!same(o, p.output[c])) throw new Error(`N ${N} lane ${c}: samples differ from ifft()`)
			}
		}
	}
})

t('own: a pair apart from the shared one; win and ola the products and sums of the JS loops, bit for bit', () => {
	for (const N of [4, 64, 2048]) {
		const p = own(N)
		if (!p) return console.warn('own: no WebAssembly SIMD here, skipped')
		if (p === pair(N) || own(N) === p) throw new Error('expected a pair of its own')
		// room: the window, its square, two frames, the sums of two channels and their normalizer, past base; then grown
		const W = p.base, F = W + 16 * N, O = F + 16 * N, L = 3 * N
		let buf = p.room(16 * N + 16 * N + 24 * L)
		const view = (at, n) => new Float64Array(buf, at, n)
		const w = Float64Array.from({ length: N }, rand), w2 = w.map(v => v * v), a = Float64Array.from({ length: N }, rand), b = Float64Array.from({ length: N }, rand)
		view(W, N).set(w); view(W + 8 * N, N).set(w2); view(F, N).set(a); view(F + 8 * N, N).set(b)
		p.win(F, F + 8 * N, W)
		for (let i = 0; i < N; i++) if (!Object.is(p.input[2 * i], a[i] * w[i]) || !Object.is(p.input[2 * i + 1], b[i] * w[i])) throw new Error(`N ${N}: win differs at ${i}`)
		// the sums as JS adds them, a frame at a time at two places (at a whole sample), a's alone at the second
		const sums = [0, 1, 2].map(() => Float64Array.from({ length: L }, rand))
		;[0, 1, 2].forEach(c => view(O + 8 * L * c, L).set(sums[c]))
		for (const [at, two] of [[0, true], [N >> 1, false]]) {
			p.fft(); p.ifft()
			p.ola(O + 8 * (L + at), two ? O + 8 * (2 * L + at) : -1, O + 8 * at, W, W + 8 * N)
			for (let i = 0; i < N; i++) { sums[1][at + i] += p.output[0][i] * w[i]; if (two) sums[2][at + i] += p.output[1][i] * w[i]; sums[0][at + i] += w2[i] }
		}
		buf = p.room(16 * N + 16 * N + 24 * L + 65536)
		if (p.input.buffer !== buf) throw new Error('room: the arrays made anew on the grown memory')
		for (let c = 0; c < 3; c++) if (!same(new Float64Array(buf, O + 8 * L * c, L), sums[c])) throw new Error(`N ${N}: ola differs in sum ${c}`)
	}
})

t('pair: null for sizes it does not take', () => {
	if (pair(3) !== null || pair(2) !== null || pair(1000) !== null) throw new Error('expected null')
})

t('stftStream channels: each channel the samples its own stream gives, three channels, sliding hops', () => {
	const n = 20000, x = [0, 1, 2].map(c => Float32Array.from({ length: n }, (_, i) => Math.sin(i * (0.03 + 0.02 * c)) + 0.1 * rand()))
	const process = (re, im, st) => { st.k = (st.k || 0) + 1; for (let k = 0; k < re.length; k++) { const r = re[k]; re[k] = 0.9 * r - 0.1 * im[k]; im[k] = 0.1 * r + 0.9 * im[k] } return { re, im } }
	// a hop that slides, asked with its context once a frame, as a stretcher does
	const hop = () => { let k = 0; return (fs, ctx) => ctx ? 300 : 280 + ((k++ * 7) % 41) }
	const opts = () => ({ frameSize: 1024, synHop: 256, anaHop: hop(), complex: true })
	const one = x.map(ch => { const s = stftStream(process, opts()), out = []; for (let i = 0; i < n; i += 3000) out.push(...s.write(ch.subarray(i, i + 3000))); out.push(...s.flush()); return out })
	const s = stftStream(process, { ...opts(), channels: 3 }), all = [[], [], []]
	for (let i = 0; i < n; i += 3000) s.write(x.map(ch => ch.subarray(i, i + 3000))).forEach((o, c) => all[c].push(...o))
	s.flush().forEach((o, c) => all[c].push(...o))
	for (let c = 0; c < 3; c++) if (!same(one[c], all[c])) throw new Error(`channel ${c} differs from its own stream`)
	if (!(one[0].length > n / 2)) throw new Error('expected the stream to give its output')
})
