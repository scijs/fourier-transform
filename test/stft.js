import t from 'tst'
import { stft, istft, stftBatch, stftStream, stftAnalysisStream, winSqFloor } from '../stft.js'

const EPSILON = 1e-3
const PI2 = Math.PI * 2

// --- Validation ---

t('stft rejects invalid frameSize', () => {
	let threw = false
	try { stft(new Float32Array(2048), { frameSize: 100 }) } catch (e) { threw = true }
	if (!threw) throw new Error('Expected frameSize validation to throw')

	threw = false
	try { stft(new Float32Array(2048), { frameSize: 0 }) } catch (e) { threw = true }
	if (!threw) throw new Error('Expected frameSize=0 validation to throw')
})

t('stft rejects invalid hopSize', () => {
	let threw = false
	try { stft(new Float32Array(2048), { hopSize: 0 }) } catch (e) { threw = true }
	if (!threw) throw new Error('Expected hopSize=0 validation to throw')

	threw = false
	try { stft(new Float32Array(2048), { hopSize: -1 }) } catch (e) { threw = true }
	if (!threw) throw new Error('Expected hopSize=-1 validation to throw')
})

// --- Basic properties ---

t('stft returns frames for non-empty signal', () => {
	const N = 64, hop = 16
	const signal = new Float32Array(N * 3)
	for (let i = 0; i < signal.length; i++) signal[i] = Math.sin(i * 0.1)

	const frames = stft(signal, { frameSize: N, hopSize: hop })
	if (frames.length === 0) throw new Error('Expected frames')
})

t('stft frame structure', () => {
	const signal = new Float32Array(128)
	signal[64] = 1

	const frames = stft(signal, { frameSize: 64, hopSize: 32 })
	if (frames.length === 0) throw new Error('Expected frames')

	for (const f of frames) {
		if (!(f.re instanceof Float64Array)) throw new Error('re should be Float64Array')
		if (!(f.im instanceof Float64Array)) throw new Error('im should be Float64Array')
		if (!(f.mag instanceof Float64Array)) throw new Error('mag should be Float64Array')
		if (!(f.phase instanceof Float64Array)) throw new Error('phase should be Float64Array')
		if (f.re.length !== 33) throw new Error('re length should be 33')
		if (f.im.length !== 33) throw new Error('im length should be 33')
		if (f.mag.length !== 33) throw new Error('mag length should be 33')
		if (f.phase.length !== 33) throw new Error('phase length should be 33')
		if (typeof f.time !== 'number') throw new Error('time should be a number')
	}
})

t('stft sine signal has peak at correct bin with low side lobes', () => {
	const N = 256, k = 16
	const signal = new Float32Array(N * 4)
	for (let i = 0; i < signal.length; i++) signal[i] = Math.sin(PI2 * k * i / N)

	const frames = stft(signal, { frameSize: N, hopSize: N >> 2 })
	const validFrames = frames.filter(f => f.time >= N && f.time < signal.length - N)
	if (validFrames.length === 0) throw new Error('Expected valid frames')

	for (const f of validFrames) {
		let peakBin = 0, peakVal = 0
		for (let i = 0; i < f.mag.length; i++) {
			if (f.mag[i] > peakVal) { peakVal = f.mag[i]; peakBin = i }
		}
		if (peakBin !== k) throw new Error(`Expected peak at bin ${k}, got ${peakBin}`)
		// Hann window main lobe spans ~4 bins; side lobes beyond that are ~-31dB
		for (let b = 0; b < f.mag.length; b++) {
			if (Math.abs(b - k) <= 2) continue
			if (f.mag[b] >= peakVal * 0.05) throw new Error(`bin ${b} side lobe too high: ${f.mag[b]} vs peak ${peakVal}`)
		}
	}
})

t('stft of sine has peak at correct bin', () => {
	const N = 256, k = 8
	const signal = new Float32Array(N * 4)
	for (let i = 0; i < signal.length; i++) signal[i] = Math.sin(PI2 * k * i / N)

	const frames = stft(signal, { frameSize: N, hopSize: N >> 2 })
	const validFrames = frames.filter(f => f.time >= N && f.time < signal.length - N)
	if (validFrames.length === 0) throw new Error('Expected valid frames')

	for (const f of validFrames) {
		let peakBin = 0, peakVal = 0
		for (let i = 0; i < f.mag.length; i++) {
			if (f.mag[i] > peakVal) { peakVal = f.mag[i]; peakBin = i }
		}
		if (peakBin !== k) throw new Error(`Expected peak at bin ${k}, got ${peakBin}`)
	}
})

// --- Round-trip identity ---

t('istft(stft(signal)) ≈ signal for sine', () => {
	const N = 256
	const signal = new Float32Array(N * 4)
	for (let i = 0; i < signal.length; i++) signal[i] = Math.sin(PI2 * 3 * i / N) + 0.5 * Math.cos(PI2 * 7 * i / N)

	const frames = stft(signal, { frameSize: N, hopSize: N >> 2 })
	const recovered = istft(frames, { frameSize: N, hopSize: N >> 2, signalLength: signal.length })

	let maxErr = 0
	for (let i = 0; i < signal.length; i++) {
		const err = Math.abs(recovered[i] - signal[i])
		if (err > maxErr) maxErr = err
	}
	if (maxErr >= EPSILON) throw new Error(`Max round-trip error ${maxErr} exceeds ${EPSILON}`)
})

t('istft(stft(signal)) ≈ signal for noise', () => {
	const N = 512
	const signal = new Float32Array(N * 4)
	for (let i = 0; i < signal.length; i++) signal[i] = (Math.random() * 2 - 1) * 0.5

	const frames = stft(signal, { frameSize: N, hopSize: N >> 2 })
	const recovered = istft(frames, { frameSize: N, hopSize: N >> 2, signalLength: signal.length })

	let maxErr = 0
	for (let i = 0; i < signal.length; i++) {
		const err = Math.abs(recovered[i] - signal[i])
		if (err > maxErr) maxErr = err
	}
	if (maxErr >= EPSILON) throw new Error(`Max round-trip error ${maxErr} exceeds ${EPSILON}`)
})

t('istft with mag+phase only (no re/im) still works', () => {
	const N = 128
	const signal = new Float32Array(N * 4)
	for (let i = 0; i < signal.length; i++) signal[i] = Math.sin(PI2 * 5 * i / N)

	const frames = stft(signal, { frameSize: N, hopSize: N >> 2 })
	const stripped = frames.map(f => ({ mag: f.mag, phase: f.phase, time: f.time }))
	const recovered = istft(stripped, { frameSize: N, hopSize: N >> 2, signalLength: signal.length })

	let maxErr = 0
	for (let i = 0; i < signal.length; i++) {
		const err = Math.abs(recovered[i] - signal[i])
		if (err > maxErr) maxErr = err
	}
	if (maxErr >= EPSILON) throw new Error(`Max round-trip error ${maxErr} exceeds ${EPSILON}`)
})

// --- stftBatch ---

t('stftBatch identity process returns same signal', () => {
	const N = 256
	const signal = new Float32Array(N * 4)
	for (let i = 0; i < signal.length; i++) signal[i] = Math.sin(PI2 * 3 * i / N) + 0.5 * Math.cos(PI2 * 7 * i / N)

	const result = stftBatch(signal, (mag, phase) => ({ mag, phase }), { frameSize: N, hopSize: N >> 2 })

	let maxErr = 0
	for (let i = 0; i < signal.length; i++) {
		const err = Math.abs(result[i] - signal[i])
		if (err > maxErr) maxErr = err
	}
	if (maxErr >= EPSILON) throw new Error(`Max batch identity error ${maxErr} exceeds ${EPSILON}`)
})

t('stftBatch process receives correct ctx', () => {
	const N = 128, hop = 32, sr = 48000
	const signal = new Float32Array(N * 2).fill(1)
	let ctxReceived = null

	stftBatch(signal, (mag, phase, state, ctx) => {
		if (!ctxReceived) ctxReceived = ctx
		return { mag, phase }
	}, { frameSize: N, hopSize: hop, sampleRate: sr })

	if (!ctxReceived) throw new Error('Expected ctx to be passed')
	if (ctxReceived.N !== N) throw new Error(`Expected ctx.N=${N}, got ${ctxReceived.N}`)
	if (ctxReceived.half !== N >> 1) throw new Error(`Expected ctx.half=${N >> 1}`)
	if (ctxReceived.hop !== hop) throw new Error(`Expected ctx.hop=${hop}`)
	if (ctxReceived.sampleRate !== sr) throw new Error(`Expected ctx.sampleRate=${sr}`)
	if (typeof ctxReceived.freqPerBin !== 'number') throw new Error('Expected ctx.freqPerBin')
	if (typeof ctxReceived.frameStart !== 'number') throw new Error('Expected ctx.frameStart')
})

// --- stftStream ---

t('stftStream identity process returns same signal', () => {
	const N = 256
	const signal = new Float32Array(N * 4)
	for (let i = 0; i < signal.length; i++) signal[i] = Math.sin(PI2 * 3 * i / N) + 0.5 * Math.cos(PI2 * 7 * i / N)

	const stream = stftStream((mag, phase) => ({ mag, phase }), { frameSize: N, hopSize: N >> 2 })
	const chunks = []
	let chunkSize = 73
	for (let i = 0; i < signal.length; i += chunkSize) {
		chunks.push(stream.write(signal.subarray(i, Math.min(i + chunkSize, signal.length))))
	}
	chunks.push(stream.flush())

	let totalLen = 0
	for (const c of chunks) totalLen += c.length
	if (totalLen !== signal.length) throw new Error(`Expected ${signal.length} samples, got ${totalLen}`)

	const result = new Float32Array(totalLen)
	let off = 0
	for (const c of chunks) { result.set(c, off); off += c.length }

	let maxErr = 0
	for (let i = 0; i < signal.length; i++) {
		const err = Math.abs(result[i] - signal[i])
		if (err > maxErr) maxErr = err
	}
	if (maxErr >= EPSILON) throw new Error(`Max stream identity error ${maxErr} exceeds ${EPSILON}`)
})

t('complex frames: an identity process returns the signal, batch and stream, as the polar path does', () => {
	const N = 1024, hop = 256, len = 12000, sig = new Float32Array(len)
	for (let i = 0; i < len; i++) sig[i] = Math.sin(i * 0.05) * 0.6 + Math.sin(i * 0.31) * 0.2
	const batch = stftBatch(sig, (re, im) => ({ re, im }), { frameSize: N, hopSize: hop, complex: true })
	const polar = stftBatch(sig, (mag, phase) => ({ mag, phase }), { frameSize: N, hopSize: hop })
	const s = stftStream((re, im) => ({ re, im }), { frameSize: N, hopSize: hop, complex: true }), parts = []
	for (let o = 0; o < len; o += 700) parts.push(s.write(sig.subarray(o, o + 700)))
	parts.push(s.flush())
	const stream = new Float32Array(parts.reduce((n, p) => n + p.length, 0))
	let q = 0
	for (const p of parts) { stream.set(p, q); q += p.length }
	if (batch.length !== len || stream.length !== len) throw new Error(`lengths ${batch.length}, ${stream.length}`)
	for (let i = 0; i < len; i++) {
		if (Math.abs(batch[i] - sig[i]) >= 1e-5 || Math.abs(stream[i] - sig[i]) >= 1e-5) throw new Error(`i=${i}: ${batch[i]}, ${stream[i]} vs ${sig[i]}`)
		if (Math.abs(batch[i] - polar[i]) >= 1e-6) throw new Error(`i=${i}: complex ${batch[i]} vs polar ${polar[i]}`)
	}
})

t('stftStream rejects write after flush', () => {
	const stream = stftStream((mag, phase) => ({ mag, phase }), { frameSize: 64, hopSize: 16 })
	stream.flush()
	let threw = false
	try { stream.write(new Float32Array(10)) } catch (e) { threw = true }
	if (!threw) throw new Error('Expected write-after-flush to throw')
})

// --- stftAnalysisStream ---

t('stftAnalysisStream produces same frames as stft', () => {
	const N = 128
	const signal = new Float32Array(N * 8)
	for (let i = 0; i < signal.length; i++) signal[i] = Math.sin(PI2 * 4 * i / N) + 0.3 * Math.cos(PI2 * 11 * i / N)

	const batchFrames = stft(signal, { frameSize: N, hopSize: N >> 2 })

	const stream = stftAnalysisStream({ frameSize: N, hopSize: N >> 2 })
	const streamFrames = []

	let chunkSize = 37
	for (let i = 0; i < signal.length; i += chunkSize) {
		streamFrames.push(...stream.write(signal.subarray(i, Math.min(i + chunkSize, signal.length))))
	}
	streamFrames.push(...stream.flush())

	if (streamFrames.length !== batchFrames.length) {
		throw new Error(`Expected ${batchFrames.length} frames, got ${streamFrames.length}`)
	}

	for (let i = 0; i < batchFrames.length; i++) {
		const bf = batchFrames[i], sf = streamFrames[i]
		if (sf.time !== bf.time) throw new Error(`Frame ${i}: time mismatch ${sf.time} vs ${bf.time}`)
		for (let k = 0; k < bf.mag.length; k++) {
			if (Math.abs(sf.mag[k] - bf.mag[k]) >= 1e-9) {
				throw new Error(`Frame ${i} bin ${k}: mag mismatch ${sf.mag[k]} vs ${bf.mag[k]}`)
			}
		}
	}
})

// --- Edge cases ---

t('stft of empty signal returns empty array', () => {
	const frames = stft(new Float32Array(0))
	if (frames.length !== 0) throw new Error(`Expected 0 frames, got ${frames.length}`)
})

t('istft of empty frames returns empty array', () => {
	const recovered = istft([])
	if (recovered.length !== 0) throw new Error(`Expected length 0, got ${recovered.length}`)
})

t('istft with single frame has correct shape and peak location', () => {
	const N = 64, half = N >> 1
	const mag = new Float64Array(half + 1)
	const phase = new Float64Array(half + 1)
	mag[4] = 1
	phase[4] = 0

	const recovered = istft([{ mag, phase, time: half }], { frameSize: N, hopSize: N >> 2, signalLength: N })
	if (recovered.length !== N) throw new Error(`Expected length ${N}, got ${recovered.length}`)

	let peakVal = 0, peakIdx = 0
	for (let i = 0; i < N; i++) {
		if (Math.abs(recovered[i]) > peakVal) { peakVal = Math.abs(recovered[i]); peakIdx = i }
	}
	if (peakIdx < 20 || peakIdx > 44) throw new Error(`Peak at ${peakIdx}, expected near centre`)
	if (peakVal < 0.01) throw new Error(`Peak too small: ${peakVal}`)
})

// --- Coverage: untested paths ---

t('istft infers signalLength from last frame without explicit signalLength', () => {
	const N = 128
	const signal = new Float32Array(N * 4)
	for (let i = 0; i < signal.length; i++) signal[i] = Math.sin(PI2 * 5 * i / N)

	const frames = stft(signal, { frameSize: N, hopSize: N >> 2 })
	const recovered = istft(frames, { frameSize: N, hopSize: N >> 2 })

	// Inferred length may include tail padding; check it at least covers the signal
	if (recovered.length < signal.length) throw new Error(`Expected recovered length >= ${signal.length}, got ${recovered.length}`)

	let maxErr = 0
	for (let i = 0; i < signal.length; i++) {
		const err = Math.abs(recovered[i] - signal[i])
		if (err > maxErr) maxErr = err
	}
	if (maxErr >= EPSILON) throw new Error(`Max inferred-length error ${maxErr} exceeds ${EPSILON}`)
})

t('stft accepts Float64Array and plain Array', () => {
	const N = 64
	const signal64 = new Float64Array(N * 2)
	for (let i = 0; i < signal64.length; i++) signal64[i] = Math.sin(PI2 * 3 * i / N)

	const frames64 = stft(signal64, { frameSize: N, hopSize: N >> 2 })
	if (frames64.length === 0) throw new Error('Expected frames for Float64Array')

	const signalArr = Array.from(signal64)
	const framesArr = stft(signalArr, { frameSize: N, hopSize: N >> 2 })
	if (framesArr.length === 0) throw new Error('Expected frames for Array')

	if (frames64.length !== framesArr.length) throw new Error('Frame count mismatch between Float64Array and Array')
})

t('stft, stftBatch: every frame the signal times the window, zeros past its ends, to the bit', async () => {
	const { fft } = await import('../index.js')
	// the definition: each sample tested against the signal's bounds
	const hann = (i, N) => 0.5 * (1 - Math.cos(PI2 * i / N))
	const frameAt = (x, start, N) => Float64Array.from({ length: N }, (_, i) => (start + i >= 0 && start + i < x.length ? x[start + i] : 0) * hann(i, N))
	const same = (a, b) => a.length === b.length && a.every((v, i) => Object.is(v, b[i]))
	let frames = 0
	for (const N of [8, 64, 256]) for (const len of [1, N / 4 + 1, N, 3 * N + 5]) for (const x of [Float32Array.from({ length: len }, (_, i) => Math.sin(i) + 0.1), Array.from({ length: len }, (_, i) => Math.cos(i * 0.3))]) {
		const hop = Math.max(1, (N >> 2) + 1)
		stft(x, { frameSize: N, hopSize: hop }).forEach((f, k) => {
			const [re, im] = fft(frameAt(x, k * hop - N, N))
			if (!same(f.re, re) || !same(f.im, im)) throw new Error(`stft N ${N} len ${len} frame ${k} differs from the definition`)
			frames++
		})
		stftBatch(x, (re, im, state, ctx) => {
			const [r, i] = fft(frameAt(x, ctx.frameStart, N))
			if (!same(re, r) || !same(im, i)) throw new Error(`stftBatch N ${N} len ${len} at ${ctx.frameStart} differs from the definition`)
			frames++
			return { re, im }
		}, { frameSize: N, hopSize: hop, complex: true })
	}
	if (frames < 200) throw new Error(`only ${frames} frames checked`)
})

t('manipulating frames between stft and istft preserves round-trip', () => {
	const N = 128
	const signal = new Float32Array(N * 4)
	for (let i = 0; i < signal.length; i++) signal[i] = Math.sin(PI2 * 5 * i / N)

	const frames = stft(signal, { frameSize: N, hopSize: N >> 2 })

	// Mutate: zero out low-energy bins
	for (const f of frames) {
		const m = f.mag
		for (let k = 0; k < m.length; k++) {
			if (m[k] < 0.5) {
				m[k] = 0
				f.phase[k] = 0
			}
		}
	}

	const recovered = istft(frames, { frameSize: N, hopSize: N >> 2, signalLength: signal.length })
	if (recovered.length !== signal.length) throw new Error(`Expected length ${signal.length}, got ${recovered.length}`)
})

t('istft with time==null frames falls back to hop-based positioning', () => {
	const N = 64, hop = 16, half = N >> 1
	const mag = new Float64Array(half + 1)
	const phase = new Float64Array(half + 1)
	mag[4] = 1
	phase[4] = 0

	// No .time property — istft should position by frame index * hop
	const frames = [{ mag, phase }, { mag, phase }]
	const recovered = istft(frames, { frameSize: N, hopSize: hop, signalLength: N + hop })
	if (recovered.length !== N + hop) throw new Error(`Expected length ${N + hop}, got ${recovered.length}`)
})

t('stftBatch ctx.opts is a clone, not the original reference', () => {
	const N = 64
	const signal = new Float32Array(N * 2).fill(1)
	const opts = { frameSize: N, hopSize: N >> 2, customFlag: true }
	let ctxReceived = null

	stftBatch(signal, (mag, phase, state, ctx) => {
		if (!ctxReceived) ctxReceived = ctx
		return { mag, phase }
	}, opts)

	if (!ctxReceived) throw new Error('Expected ctx')
	if (ctxReceived.opts === opts) throw new Error('ctx.opts should be a clone, not same reference')
	if (ctxReceived.opts.customFlag !== true) throw new Error('ctx.opts.customFlag should be preserved')
	if (ctxReceived.opts.frameSize !== N) throw new Error('ctx.opts.frameSize should be preserved')
	if (ctxReceived.opts.hopSize !== (N >> 2)) throw new Error('ctx.opts.hopSize should be preserved')
	// Mutating the original opts after the call should not affect ctx.opts (clone isolation)
	opts.customFlag = false
	if (ctxReceived.opts.customFlag !== true) throw new Error('ctx.opts should be isolated from later mutations of opts')
})

t('stftBatch 2x stretch produces 2x length and preserves sine frequency', () => {
	const N = 256, k = 8
	const signal = new Float32Array(N * 4)
	for (let i = 0; i < signal.length; i++) signal[i] = Math.sin(PI2 * k * i / N)

	const factor = 2.0
	const result = stftBatch(signal, (mag, phase) => ({ mag, phase }), {
		frameSize: N,
		hopSize: N >> 2,
		anaHop: (N >> 2),
		synHop: (N >> 2) * factor,
	})

	const expectedLen = Math.round(signal.length * factor)
	if (Math.abs(result.length - expectedLen) > N) {
		throw new Error(`Expected length ~${expectedLen}, got ${result.length}`)
	}

	// A time-stretched sine should remain a sine at the same frequency
	// Check via autocorrelation: find dominant period, verify it's ~2x original
	const frames = stft(result, { frameSize: N, hopSize: N >> 2 })
	const midFrames = frames.filter(f => f.time >= N && f.time < result.length - N)
	if (midFrames.length === 0) throw new Error('Expected valid frames for stretched signal')

	for (const f of midFrames) {
		let peakBin = 0, peakVal = 0
		for (let i = 0; i < f.mag.length; i++) {
			if (f.mag[i] > peakVal) { peakVal = f.mag[i]; peakBin = i }
		}
		if (peakBin !== k) throw new Error(`Expected peak at bin ${k}, got ${peakBin}`)
	}
})

t('stftStream 2x stretch produces 2x length and preserves sine frequency', () => {
	const N = 256, k = 8
	const signal = new Float32Array(N * 4)
	for (let i = 0; i < signal.length; i++) signal[i] = Math.sin(PI2 * k * i / N)

	const factor = 2.0
	const stream = stftStream((mag, phase) => ({ mag, phase }), {
		frameSize: N,
		hopSize: N >> 2,
		anaHop: (N >> 2),
		synHop: (N >> 2) * factor,
	})

	const chunks = []
	let chunkSize = 73
	for (let i = 0; i < signal.length; i += chunkSize) {
		chunks.push(stream.write(signal.subarray(i, Math.min(i + chunkSize, signal.length))))
	}
	chunks.push(stream.flush())

	let totalLen = 0
	for (const c of chunks) totalLen += c.length

	const expectedLen = Math.round(signal.length * factor)
	if (Math.abs(totalLen - expectedLen) > N) {
		throw new Error(`Expected total length ~${expectedLen}, got ${totalLen}`)
	}

	const result = new Float32Array(totalLen)
	let off = 0
	for (const c of chunks) { result.set(c, off); off += c.length }

	// Verify sine frequency preserved
	const frames = stft(result, { frameSize: N, hopSize: N >> 2 })
	const midFrames = frames.filter(f => f.time >= N && f.time < result.length - N)
	if (midFrames.length === 0) throw new Error('Expected valid frames for stretched signal')

	for (const f of midFrames) {
		let peakBin = 0, peakVal = 0
		for (let i = 0; i < f.mag.length; i++) {
			if (f.mag[i] > peakVal) { peakVal = f.mag[i]; peakBin = i }
		}
		if (peakBin !== k) throw new Error(`Expected peak at bin ${k}, got ${peakBin}`)
	}
})

t('stftBatch 0.5x compression produces half length and preserves sine frequency', () => {
	const N = 256, k = 8
	const signal = new Float32Array(N * 6)
	for (let i = 0; i < signal.length; i++) signal[i] = Math.sin(PI2 * k * i / N)

	const factor = 0.5
	const result = stftBatch(signal, (mag, phase) => ({ mag, phase }), {
		frameSize: N,
		hopSize: N >> 2,
		anaHop: (N >> 2),
		synHop: (N >> 2) * factor,
	})

	const expectedLen = Math.round(signal.length * factor)
	if (Math.abs(result.length - expectedLen) > N) {
		throw new Error(`Expected length ~${expectedLen}, got ${result.length}`)
	}

	const frames = stft(result, { frameSize: N, hopSize: N >> 2 })
	const midFrames = frames.filter(f => f.time >= N && f.time < result.length - N)
	if (midFrames.length === 0) throw new Error('Expected valid frames for compressed signal')

	for (const f of midFrames) {
		let peakBin = 0, peakVal = 0
		for (let i = 0; i < f.mag.length; i++) {
			if (f.mag[i] > peakVal) { peakVal = f.mag[i]; peakBin = i }
		}
		if (peakBin !== k) throw new Error(`Expected peak at bin ${k}, got ${peakBin}`)
	}
})

t('stftStream 0.5x compression produces half length and preserves sine frequency', () => {
	const N = 256, k = 8
	const signal = new Float32Array(N * 6)
	for (let i = 0; i < signal.length; i++) signal[i] = Math.sin(PI2 * k * i / N)

	const factor = 0.5
	const stream = stftStream((mag, phase) => ({ mag, phase }), {
		frameSize: N,
		hopSize: N >> 2,
		anaHop: (N >> 2),
		synHop: (N >> 2) * factor,
	})

	const chunks = []
	let chunkSize = 73
	for (let i = 0; i < signal.length; i += chunkSize) {
		chunks.push(stream.write(signal.subarray(i, Math.min(i + chunkSize, signal.length))))
	}
	chunks.push(stream.flush())

	let totalLen = 0
	for (const c of chunks) totalLen += c.length

	const expectedLen = Math.round(signal.length * factor)
	if (Math.abs(totalLen - expectedLen) > N) {
		throw new Error(`Expected total length ~${expectedLen}, got ${totalLen}`)
	}

	const result = new Float32Array(totalLen)
	let off = 0
	for (const c of chunks) { result.set(c, off); off += c.length }

	const frames = stft(result, { frameSize: N, hopSize: N >> 2 })
	const midFrames = frames.filter(f => f.time >= N && f.time < result.length - N)
	if (midFrames.length === 0) throw new Error('Expected valid frames for compressed signal')

	for (const f of midFrames) {
		let peakBin = 0, peakVal = 0
		for (let i = 0; i < f.mag.length; i++) {
			if (f.mag[i] > peakVal) { peakVal = f.mag[i]; peakBin = i }
		}
		if (peakBin !== k) throw new Error(`Expected peak at bin ${k}, got ${peakBin}`)
	}
})

t('winSqFloor is exported and caches results', () => {
	const win = new Float64Array(64)
	for (let i = 0; i < 64; i++) win[i] = 0.5 * (1 - Math.cos(PI2 * i / 64))
	const f1 = winSqFloor(win, 16)
	const f2 = winSqFloor(win, 16)
	if (f1 !== f2) throw new Error('winSqFloor should return cached value')
	if (f1 <= 0) throw new Error('winSqFloor should be positive')
})

// --- Time-stretch mapping & fractional hops ---

t('stftBatch stretch maps input time t to t*factor (center-aligned, no lag)', () => {
	// Tone burst gated [0.4s, 0.9s) — the pre-fix engine lagged output by (N/2)(factor-1).
	const sr = 44100, n = sr * 2, from = Math.floor(0.4 * sr)
	const signal = new Float32Array(n)
	for (let i = from; i < Math.floor(0.9 * sr); i++) signal[i] = Math.sin(PI2 * 440 * i / sr) * 0.8

	for (const factor of [0.5, 2]) {
		const out = stftBatch(signal, (mag, phase) => ({ mag, phase }), {
			frameSize: 2048, anaHop: 512 / factor, synHop: 512,
		})
		if (out.length !== Math.round(n * factor)) throw new Error(`length ${out.length} != ${Math.round(n * factor)}`)
		// envelope half-max crossing
		const win = 256, nWin = Math.floor(out.length / win)
		let maxRms = 0
		const env = new Float64Array(nWin)
		for (let k = 0; k < nWin; k++) {
			let s = 0
			for (let i = 0; i < win; i++) { const v = out[k * win + i]; s += v * v }
			env[k] = Math.sqrt(s / win)
			if (env[k] > maxRms) maxRms = env[k]
		}
		let onset = -1
		for (let k = 0; k < nWin; k++) if (env[k] > maxRms * 0.5) { onset = k * win; break }
		const ideal = from * factor
		if (Math.abs(onset - ideal) > 512) throw new Error(`${factor}x: onset ${onset}, ideal ${ideal}`)
	}
})

t('stftStream fractional anaHop (1.5x stretch) stays finite and carries the tone', () => {
	// Regression: the engine stepped frame positions by a fractional hop and read
	// fractional indices -> NaN for every non-integer-hop factor.
	const N = 2048, sr = 44100, n = 32768, factor = 1.5
	const signal = new Float32Array(n)
	for (let i = 0; i < n; i++) signal[i] = Math.sin(PI2 * 440 * i / sr) * 0.8

	const stream = stftStream((mag, phase) => ({ mag, phase }), {
		frameSize: N, anaHop: (N >> 2) / factor, synHop: N >> 2,
	})
	let total = 0, energy = 0, bad = 0
	const consume = (out) => {
		for (let j = 0; j < out.length; j++) { if (!Number.isFinite(out[j])) bad++; energy += out[j] * out[j] }
		total += out.length
	}
	for (let i = 0; i < n; i += 1024) consume(stream.write(signal.subarray(i, Math.min(i + 1024, n))))
	consume(stream.flush())

	if (bad) throw new Error(`${bad} non-finite samples`)
	if (Math.abs(total - n * factor) > N) throw new Error(`length ${total}, expected ~${n * factor}`)
	if (Math.sqrt(energy / total) < 0.3) throw new Error('lost signal energy')
})

t('stftBatch: function hops returning constants match the constant path', () => {
	const sr = 44100, n = sr, d = new Float32Array(n)
	for (let i = 0; i < n; i++) d[i] = 0.5 * Math.sin(2 * Math.PI * 440 * i / sr)
	const ident = (mag, phase) => ({ mag, phase })
	const cst = stftBatch(d, ident, { frameSize: 2048, anaHop: 256, synHop: 512 })
	const fnc = stftBatch(d, ident, { frameSize: 2048, anaHop: () => 256, synHop: () => 512 })
	const overlap = Math.min(cst.length, fnc.length)
	for (let i = 0; i < overlap; i++)
		if (Math.abs(cst[i] - fnc[i]) > 1e-9) throw new Error(`sample ${i} differs: ${cst[i]} vs ${fnc[i]}`)
	if (Math.abs(fnc.length - cst.length) > 2048) throw new Error(`fn-path length far off: ${fnc.length} vs ${cst.length}`)
})

t('stftBatch + stftStream: sliding synHop integrates (factor 1→2 ≈ 1.5× length)', () => {
	const sr = 44100, n = sr, d = new Float32Array(n)
	for (let i = 0; i < n; i++) d[i] = 0.5 * Math.sin(2 * Math.PI * 440 * i / sr)
	const ident = (mag, phase) => ({ mag, phase })
	const synFn = fs => 256 + 256 * Math.min(1, Math.max(0, fs / n))

	const batch = stftBatch(d, ident, { frameSize: 2048, anaHop: 256, synHop: synFn })
	if (Math.abs(batch.length / n - 1.5) > 0.05) throw new Error(`batch length ratio ${batch.length / n}`)
	for (const v of batch) if (!Number.isFinite(v)) throw new Error('non-finite batch output')

	const s = stftStream(ident, { frameSize: 2048, anaHop: 256, synHop: synFn })
	let total = 0, bad = 0
	const consume = c => { total += c.length; for (const v of c) if (!Number.isFinite(v)) bad++ }
	for (let i = 0; i < n; i += 1024) consume(s.write(d.subarray(i, Math.min(i + 1024, n))))
	consume(s.flush())
	if (bad) throw new Error(`${bad} non-finite stream samples`)
	if (Math.abs(total / n - 1.5) > 0.05) throw new Error(`stream length ratio ${total / n}`)
})

t('stftStream: variable anaHop function (sliding analysis cadence) stays finite', () => {
	const sr = 44100, n = sr >> 1, d = new Float32Array(n)
	for (let i = 0; i < n; i++) d[i] = 0.5 * Math.sin(2 * Math.PI * 440 * i / sr)
	const ident = (mag, phase) => ({ mag, phase })
	// factor 1→2 expressed on the analysis side: anaHop 512→256, synHop fixed 512
	const anaFn = fs => 512 / (1 + Math.min(1, Math.max(0, fs / n)))
	const s = stftStream(ident, { frameSize: 2048, anaHop: anaFn, synHop: 512 })
	let total = 0
	for (let i = 0; i < n; i += 1024) {
		const c = s.write(d.subarray(i, Math.min(i + 1024, n)))
		for (const v of c) if (!Number.isFinite(v)) throw new Error('non-finite')
		total += c.length
	}
	total += s.flush().length
	// mean factor 512/anaHop over source ≈ ∫(1+t) = 1.5
	if (Math.abs(total / n - 1.5) > 0.08) throw new Error(`length ratio ${total / n}, expected ≈1.5`)
})

t('stftStream: analysis hop longer than the frame (strong compression) streams ≡ batch', () => {
	// The input compaction dropped floor(nextFramePos) − N samples even when fewer were
	// buffered: bufLen went negative and the next write threw (RangeError)
	const n = 44100, d = new Float32Array(n)
	for (let i = 0; i < n; i++) d[i] = 0.5 * Math.sin(2 * Math.PI * 330 * i / 44100)
	const ident = (mag, phase) => ({ mag, phase })
	const opts = { frameSize: 1024, synHop: 256, anaHop: 256 / 0.1 }        // anaHop 2560 > N
	const batch = stftBatch(d, ident, opts)
	for (const size of [997, 64, 3000]) {
		const s = stftStream(ident, opts), parts = []
		for (let i = 0; i < n; i += size) parts.push(s.write(d.subarray(i, Math.min(i + size, n))))
		parts.push(s.flush())
		const out = new Float32Array(parts.reduce((a, p) => a + p.length, 0))
		let o = 0; for (const p of parts) { out.set(p, o); o += p.length }
		if (out.length !== batch.length) throw new Error(`chunks ${size}: length ${out.length} ≠ batch ${batch.length}`)
		let m = 0; for (let i = 0; i < out.length; i++) m = Math.max(m, Math.abs(out[i] - batch[i]))
		if (m > 1e-6) throw new Error(`chunks ${size}: max deviation ${m}`)
	}
})

t('stftStream: function hops emit a sample as soon as it is final (one pOut hold-back, not two)', () => {
	// A sample is final once the next frame's synthesis start passes it: after each write the
	// stream must have emitted floor(−pOut + Σ synHop of the frames processed). Function hops
	// held back pOut more, twice the latency of the same hops given as constants.
	const N = 2048, n = 12000, d = new Float32Array(n).fill(0.1)
	const slide = fs => 256 + 256 * Math.min(1, Math.max(0, fs / n))
	for (const [anaHop, synHop, r0] of [[() => 512, () => 512, 1], [() => 256, () => 512, 2], [() => 512, () => 256, 0.5], [256, slide, 1], [fs => 512 / (1 + Math.max(0, fs) / n), 512, 1]]) {
		const pOut = Math.round(N / 2 * (r0 + 1))
		let syn = 0, E = 0
		const s = stftStream((mag, phase, st, ctx) => (syn += ctx.synHop, { mag, phase }), { frameSize: N, anaHop, synHop })
		for (let m = 0; m < n; m += 100) {
			E += s.write(d.subarray(m, m + 100)).length
			const min = Math.max(0, Math.floor(syn - pOut))
			if (E !== min) throw new Error(`r0 ${r0}, after ${m + 100}: emitted ${E}, final ${min}`)
		}
	}
})

t('stftStream: constant hops keep their emission schedule, round(M·r) − pOut after M samples', () => {
	const N = 2048, n = 12000, d = new Float32Array(n).fill(0.1)
	for (const [anaHop, synHop] of [[512, 512], [256, 512], [512, 256], [512 / 1.5, 512]]) {
		const r = synHop / anaHop, pOut = Math.round(N / 2 * (r + 1)), s = stftStream((mag, phase) => ({ mag, phase }), { frameSize: N, anaHop, synHop })
		let E = 0
		for (let m = 0; m < n; m += 100) {
			E += s.write(d.subarray(m, m + 100)).length
			const want = Math.max(0, Math.round((m + 100) * r) - pOut)
			if (E !== want) throw new Error(`r ${r}, after ${m + 100}: emitted ${E}, want ${want}`)
		}
	}
})

// --- Writing into memory the caller holds: write(chunk, out, length), flush(out) ---

// a seeded generator, and the cases: every option the stream has, at N 256 so 40 frames' signal wraps every buffer
// (the input moved down past 2N, the output sums past 4N) many times; a sliding hop made anew for every stream
const seeded = s => () => (s = (s * 16807) % 2147483647) / 2147483647
const sameBits = (a, b) => a.length === b.length && a.every((v, i) => Object.is(v, b[i]))
const slide = () => { let k = 0; return (fs, ctx) => ctx ? 60 : 56 + ((k++ * 7) % 13) }
const turn = (re, im) => { for (let k = 0; k < re.length; k++) { const r = re[k]; re[k] = 0.9 * r - 0.2 * im[k]; im[k] = 0.2 * r + 0.9 * im[k] } return { re, im } }
const tilt = (mag, phase, st, ctx) => { for (let k = 0; k < mag.length; k++) mag[k] *= 0.6 + 0.4 * Math.cos(k / 7 + ctx.frameStart / 900); return { mag, phase } }
const mix = (res, ims) => { for (let c = 0; c < res.length; c++) for (let k = 0; k < res[c].length; k++) { res[c][k] = 0.8 * res[c][k] + 0.2 * res[(c + 1) % res.length][k]; ims[c][k] *= 0.9 } }
const writeCases = () => [
	[{}, tilt], [{ hopSize: 128 }, tilt], [{ hopSize: 70 }, tilt], [{ complex: true }, turn],
	[{ anaHop: 32, synHop: 64 }, tilt], [{ anaHop: 64, synHop: 32 }, tilt], [{ anaHop: 64 / 1.5, synHop: 64 }, tilt], [{ anaHop: 640, synHop: 64 }, tilt],
	[{ anaHop: slide(), synHop: 64, complex: true }, turn],
	[{ channels: 1 }, tilt], [{ channels: 2, complex: true }, turn], [{ channels: 3 }, tilt], [{ channels: 2, anaHop: 32, synHop: 48 }, tilt],
	[{ channels: 2, complex: true, joint: true }, mix], [{ channels: 3, complex: true, joint: true }, mix], [{ channels: 2, anaHop: slide(), synHop: 64, complex: true, joint: true }, mix],
]

t('stftStream write(chunk, out, length), flush(out): the samples write(chunk) and flush() return, call for call, bit for bit; mono, channels, every option', () => {
	const N = 256, n = 40 * N + 123, rnd = seeded(7)
	let calls = 0
	for (let w = 0; w < writeCases().length; w++) {
		for (const sizes of [[n], Array.from({ length: 200 }, () => 1 + Math.floor(rnd() * 600)), Array.from({ length: 400 }, () => 1 + Math.floor(rnd() * 9))]) {
			const [opts, process] = writeCases()[w], C = opts.channels ?? 1, multi = opts.channels != null
			const x = Array.from({ length: C }, (_, c) => Float32Array.from({ length: n }, (_, i) => Math.sin(i * (0.02 + 0.01 * c)) + 0.2 * (rnd() - 0.5)))
			const chunk = (t, k) => x.map(ch => ch.subarray(t, t + k))
			// the reference: the arrays the stream returns
			const ref = [], a = stftStream(process, { frameSize: N, ...opts })
			let t = 0
			for (const k of sizes) { if (t >= n) break; const c = chunk(t, Math.min(k, n - t)); ref.push(multi ? a.write(c) : [a.write(c[0])]); t += c[0].length }
			ref.push(multi ? a.flush() : [a.flush()], multi ? a.flush() : [a.flush()])
			// the same into outs; every other chunk inside a longer array, with its length
			const [opts2] = writeCases()[w], b = stftStream(process, { frameSize: N, ...opts2, maxChunk: 600 })
			const outs = Array.from({ length: C }, () => new Float32Array(2 * n)), inside = Array.from({ length: C }, () => new Float32Array(700).fill(NaN))
			t = 0
			ref.forEach((want, i) => {
				let got
				if (i >= ref.length - 2) got = multi ? b.flush(outs) : b.flush(outs[0])
				else {
					const k = want === ref[i] && Math.min(sizes[i], n - t), c = chunk(t, k)
					if (i % 2 && k <= 700) { inside.forEach((v, j) => v.set(c[j])); got = multi ? b.write(inside, outs, k) : b.write(inside[0], outs[0], k) }
					else got = multi ? b.write(c, outs) : b.write(c[0], outs[0])
					t += k
				}
				if (typeof got !== 'number') throw new Error(`case ${w}: write(chunk, out) returned ${typeof got}, not a count`)
				for (let c = 0; c < C; c++) if (got !== want[c].length || !sameBits(outs[c].subarray(0, got), want[c])) throw new Error(`case ${w} ${JSON.stringify(opts2)}: call ${i} channel ${c}, ${got} samples against ${want[c].length}`)
				calls++
			})
		}
	}
	if (calls < 5000) throw new Error(`only ${calls} calls compared`)
})

t('stftStream write(chunk, out): an out too short gives what it holds, the rest waits; flush(out) until 0 gives the tail', () => {
	const N = 256, n = 30 * N, rnd = seeded(3)
	for (const [opts, process] of writeCases()) {
		const C = opts.channels ?? 1, multi = opts.channels != null
		const x = Array.from({ length: C }, () => Float32Array.from({ length: n }, () => rnd() - 0.5))
		const [opts2] = writeCases().find(([o]) => JSON.stringify(o) === JSON.stringify(opts))
		const a = stftStream(process, { frameSize: N, ...opts }), b = stftStream(process, { frameSize: N, ...opts2 })
		const want = Array.from({ length: C }, () => []), got = Array.from({ length: C }, () => []), outs = Array.from({ length: C }, () => new Float32Array(37))
		const keep = k => { if (k > 37) throw new Error(`gave ${k} into 37`); outs.forEach((o, c) => got[c].push(...o.subarray(0, k))) }
		for (let t = 0; t < n; t += 500) {
			const c = x.map(ch => ch.subarray(t, t + 500))
			;(multi ? a.write(c) : [a.write(c[0])]).forEach((o, i) => want[i].push(...o))
			keep(multi ? b.write(c, outs) : b.write(c[0], outs[0]))
		}
		;(multi ? a.flush() : [a.flush()]).forEach((o, i) => want[i].push(...o))
		for (let k, g = 0; (k = multi ? b.flush(outs) : b.flush(outs[0])); g++) { keep(k); if (g > n) throw new Error('flush(out) does not come to 0') }
		for (let c = 0; c < C; c++) if (!sameBits(got[c], want[c])) throw new Error(`${JSON.stringify(opts)} channel ${c}: ${got[c].length} samples against ${want[c].length}, or their bits`)
	}
})

t('stftStream, stftBatch: a process may edit its bins in place and return nothing, the bits of returning them', () => {
	const x = Float32Array.from({ length: 9000 }, (_, i) => Math.sin(i * 0.03) + 0.3 * Math.sin(i * 0.71))
	const scale = a => { for (let k = 0; k < a.length; k++) a[k] *= 0.5 + 0.5 * Math.cos(k / 5) }
	for (const [ret, none, opts] of [
		[(mag, phase) => (scale(mag), { mag, phase }), mag => { scale(mag) }, { frameSize: 512 }],
		[(re, im) => (scale(re), scale(im), { re, im }), (re, im) => { scale(re); scale(im) }, { frameSize: 512, complex: true }],
	]) {
		if (!sameBits(stftBatch(x, ret, opts), stftBatch(x, none, opts))) throw new Error(`stftBatch ${JSON.stringify(opts)}: differs`)
		const s1 = stftStream(ret, opts), s2 = stftStream(none, opts)
		if (!sameBits([...s1.write(x), ...s1.flush()], [...s2.write(x), ...s2.flush()])) throw new Error(`stftStream ${JSON.stringify(opts)}: differs`)
	}
})

// The validator's measure (@audio/compile tools/verify.js, `young`): in a child Node with its flags, a case a child as it runs a
// processor a child (code shared by streams of other options would tier anew inside the count), the bytes V8's young
// generation takes in over 2^15 warm calls, read in two forced minor collections, the lesser of two runs
const ALLOC_CHILD = `
import v8 from 'node:v8'
const { stftStream } = await import(${JSON.stringify(new URL('../stft.js', import.meta.url).href)})
const minor = { type: 'minor' }, young = s => s.reduce((a, x) => x.spaceName === 'new_space' || x.spaceName === 'new_large_object_space' ? a + x.spaceUsedSize : a, 0)
const count = f => { const p = new v8.GCProfiler(); p.start(); gc(minor); f(); gc(minor); const g = p.stop().statistics; let y = 0; for (let i = 1; i < g.length; i++) y += young(g[i].beforeGC.heapSpaceStatistics) - young(g[i - 1].afterGC.heapSpaceStatistics); return y }
const N = 1024, half = N >> 1, F = 64, CALLS = 1 << 15, gain = Float64Array.from({ length: half + 1 }, (_, k) => 0.5 + 0.5 * Math.cos(k / 9))
// callbacks that allocate nothing: in place, returning a result made once (its fields set)
const rp = { mag: null, phase: null }, rc = { re: null, im: null }
const polar = (mag, phase) => { for (let k = 0; k <= half; k++) mag[k] *= gain[k]; rp.mag = mag; rp.phase = phase; return rp }
const complex = (re, im) => { for (let k = 0; k <= half; k++) { re[k] *= gain[k]; im[k] *= gain[k] } rc.re = re; rc.im = im; return rc }
const joint = (res, ims) => { for (let c = 0; c < res.length; c++) complex(res[c], ims[c]) }
const x = [0, 1, 2].map(c => Float32Array.from({ length: 64 * F }, (_, i) => Math.sin(i * (0.01 + 0.003 * c)) + 0.1 * Math.sin(i * 1.3)))
// a chunk of each channel count made beforehand: the loop takes them as they are
const chunks = [1, 2, 3].map(C => Array.from({ length: 64 }, (_, k) => x.slice(0, C).map(ch => ch.subarray(k * F, k * F + F))))
const outs = [1, 2, 3].map(C => Array.from({ length: C }, () => new Float32Array(F + 2 * N)))
const per = (make, C = 1) => { const w = make(), cs = chunks[C - 1], run = n => { for (let i = 0; i < n; i++) w(cs[i & 63]) }; run(1 << 13); run(1 << 13); return Math.min(count(() => run(CALLS)), count(() => run(CALLS))) / CALLS }
const mono = (process, opts) => { const s = stftStream(process, { frameSize: N, maxChunk: F, ...opts }); return c => s.write(c[0], outs[0][0]) }
const multi = (process, opts) => { const s = stftStream(process, { frameSize: N, maxChunk: F, ...opts }), o = outs[opts.channels - 1]; return c => s.write(c, o) }
const cases = {
	'mono, polar': () => per(() => mono(polar, {})),
	'mono, complex': () => per(() => mono(complex, { complex: true })),
	// two streams of the code: V8 no longer folds one closure's constants into it (a manifest keeps a stream a channel)
	'two mono streams': () => per(() => { const a = mono(polar, {}), b = mono(polar, {}); return c => { a(c); b(c) } }),
	'two channels, complex': () => per(() => multi(complex, { channels: 2, complex: true }), 2),
	'three channels, joint': () => per(() => multi(joint, { channels: 3, complex: true, joint: true }), 3),
	'analysis hop not whole': () => per(() => mono(polar, { anaHop: 256 / 1.5, synHop: 256 })),
	'control, write(chunk): new arrays': () => per(() => { const s = stftStream(polar, { frameSize: N }); return c => s.write(c[0]) }),
}
const name = process.argv[1]
console.log(JSON.stringify(name ? cases[name]() : Object.keys(cases)))
`
t('stftStream write(chunk, out): nothing allocated a call in the steady state, mono, two streams, channels, joint, a hop not whole', async () => {
	const { default: v8 } = await import('node:v8')
	if (!v8.GCProfiler) return console.warn(`skipped: Node ${process.version} has no v8.GCProfiler to count with (18.15 and later have it)`)
	const { execFileSync } = await import('node:child_process')
	const child = (...a) => JSON.parse(execFileSync(process.execPath, ['--expose-gc', '--no-concurrent-recompilation', '--no-allocation-site-pretenuring', '--input-type=module', '-e', ALLOC_CHILD, ...a], { encoding: 'utf8' }))
	for (const k of child()) {
		const b = child(k)
		if (k.startsWith('control')) { if (!(b > 1)) throw new Error(`the measure does not see the old form's arrays: ${b} bytes a call`) }
		else if (!(b <= 1 / 16)) throw new Error(`${k}: ${b} bytes a call (at most 1/16)`)
	}
})
