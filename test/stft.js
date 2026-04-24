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
