/**
 * Short-Time Fourier Transform (STFT) and inverse STFT.
 *
 * @module fourier-transform/stft
 */

import { fft, ifft } from './index.js'

const PI2 = Math.PI * 2

// --- Hann window cache ---

const _hannCache = new Map()
const _floorCache = new Map() // key: `${N},${hop}`

function hannWindow(N) {
	let w = _hannCache.get(N)
	if (w) return w
	w = new Float64Array(N)
	for (let i = 0; i < N; i++) w[i] = 0.5 * (1 - Math.cos(PI2 * i / N))
	_hannCache.set(N, w)
	return w
}

export function winSqFloor(win, hop) {
	const key = `${win.length},${hop}`
	let f = _floorCache.get(key)
	if (f !== undefined) return f
	const N = win.length
	let min = Infinity
	for (let i = 0; i < hop; i++) {
		let s = 0
		for (let j = i; j < N; j += hop) s += win[j] * win[j]
		if (s > 0 && s < min) min = s
	}
	f = min === Infinity ? 1 : min
	_floorCache.set(key, f)
	return f
}

// --- Helpers ---

function isPow2(n) { return n > 0 && (n & (n - 1)) === 0 }

function scratch(N, half) {
	return {
		f: new Float64Array(N),
		re: new Float64Array(half + 1),
		im: new Float64Array(half + 1),
		mag: new Float64Array(half + 1),
		phase: new Float64Array(half + 1),
	}
}

// --- Kernels ---

/** Window a frame from src[srcPos..srcPos+N) and compute FFT into sc.re/sc.im */
function analyzeFrame(src, srcPos, win, sc) {
	const N = win.length
	const f = sc.f
	for (let i = 0; i < N; i++) f[i] = src[srcPos + i] * win[i]
	return fft(f, [sc.re, sc.im])
}

/** Convert complex [re, im] to polar into sc.mag/sc.phase */
function toPolar(re, im, sc, half) {
	const mag = sc.mag, phase = sc.phase
	for (let k = 0; k <= half; k++) {
		mag[k] = Math.sqrt(re[k] * re[k] + im[k] * im[k])
		phase[k] = Math.atan2(im[k], re[k])
	}
	return { mag, phase }
}

/** IFFT re/im, window, and OLA into out/norm at position pos */
function synthesizeFrame(re, im, pos, win, out, norm, sc) {
	const N = win.length
	const sf = ifft(re, im, sc.f)
	for (let i = 0; i < N; i++) {
		out[pos + i] += sf[i] * win[i]
		norm[pos + i] += win[i] * win[i]
	}
}

function makeFrame(re, im, time, half) {
	const reCopy = new Float64Array(re)
	const imCopy = new Float64Array(im)
	let _mag = null, _phase = null
	return {
		re: reCopy,
		im: imCopy,
		get mag() {
			if (!_mag) {
				_mag = new Float64Array(half + 1)
				for (let k = 0; k <= half; k++) _mag[k] = Math.sqrt(reCopy[k] * reCopy[k] + imCopy[k] * imCopy[k])
			}
			return _mag
		},
		get phase() {
			if (!_phase) {
				_phase = new Float64Array(half + 1)
				for (let k = 0; k <= half; k++) _phase[k] = Math.atan2(imCopy[k], reCopy[k])
			}
			return _phase
		},
		time,
	}
}

// --- Analysis-only STFT ---

/**
 * Compute the Short-Time Fourier Transform of a real-valued signal.
 *
 * Returns an array of frames, where each frame is `{ re, im, mag, phase, time }`.
 * The `time` field is the sample index of the frame centre in the original signal.
 * Frames are zero-padded at the boundaries so edge samples are fully windowed.
 *
 * @param {Float32Array|Float64Array|Array<number>} signal - Input signal.
 * @param {Object} [opts] - Options.
 * @param {number} [opts.frameSize=2048] - FFT size (power of 2).
 * @param {number} [opts.hopSize=512] - Hop between consecutive frames (default: frameSize/4).
 * @returns {Array<{re:Float64Array,im:Float64Array,mag:Float64Array,phase:Float64Array,time:number}>}
 */
export function stft(signal, opts) {
	const N = opts?.frameSize ?? 2048
	const hop = opts?.hopSize ?? (N >> 2)
	const half = N >> 1

	if (!isPow2(N)) throw new Error(`frameSize must be a power of 2, got ${N}`)
	if (hop <= 0) throw new Error(`hopSize must be > 0, got ${hop}`)

	const win = hannWindow(N)
	const sc = scratch(N, half)
	const frames = []

	if (!signal.length) return frames

	const pad = N
	const paddedLen = signal.length + pad * 2

	for (let pos = 0; pos + N <= paddedLen; pos += hop) {
		const f = sc.f
		for (let i = 0; i < N; i++) {
			const sIdx = pos + i - pad
			f[i] = (sIdx >= 0 && sIdx < signal.length ? signal[sIdx] : 0) * win[i]
		}
		const [re, im] = fft(f, [sc.re, sc.im])
		frames.push(makeFrame(re, im, pos - pad + half, half))
	}

	return frames
}

// --- Inverse STFT ---

/**
 * Inverse STFT — reconstruct a time-domain signal from STFT frames.
 *
 * @param {Array<{mag:Float64Array,phase:Float64Array}>} frames - Frames as returned by `stft()`, or objects with `mag` + `phase`.
 * @param {Object} [opts] - Options.
 * @param {number} [opts.frameSize=2048] - FFT size (must match analysis).
 * @param {number} [opts.hopSize=512] - Hop size (must match analysis).
 * @param {number} [opts.signalLength] - Expected output length. If omitted, inferred from
 *   the last frame's `time`, which may overshoot by up to `frameSize/2` when the last
 *   frame sits in the tail zero-padding. Pass `signalLength` explicitly for exact length.
 * @returns {Float64Array} Reconstructed signal.
 */
export function istft(frames, opts) {
	if (!frames?.length) return new Float64Array(0)

	const N = opts?.frameSize ?? 2048
	const hop = opts?.hopSize ?? (N >> 2)
	const half = N >> 1

	if (!isPow2(N)) throw new Error(`frameSize must be a power of 2, got ${N}`)

	const win = hannWindow(N)
	const floor = winSqFloor(win, hop)

	const lastFrame = frames[frames.length - 1]
	const signalLength = opts?.signalLength ?? (lastFrame.time != null ? lastFrame.time + half : (frames.length - 1) * hop + N)

	const pad = N
	const paddedLen = signalLength + pad * 2
	const out = new Float64Array(paddedLen)
	const norm = new Float64Array(paddedLen)
	const sc = { f: new Float64Array(N), re: new Float64Array(half + 1), im: new Float64Array(half + 1) }

	for (let f = 0; f < frames.length; f++) {
		const frame = frames[f]
		const pos = frame.time != null ? frame.time + pad - half : f * hop

		let re, im
		if (frame.re && frame.im) {
			re = frame.re
			im = frame.im
		} else {
			re = sc.re
			im = sc.im
			const mag = frame.mag, phase = frame.phase
			for (let k = 0; k <= half; k++) {
				re[k] = mag[k] * Math.cos(phase[k])
				im[k] = mag[k] * Math.sin(phase[k])
			}
		}

		synthesizeFrame(re, im, pos, win, out, norm, sc)
	}

	const result = new Float64Array(signalLength)
	for (let i = 0; i < signalLength; i++) {
		const j = i + pad
		const n = norm[j] < floor ? floor : norm[j]
		result[i] = n > 1e-10 ? out[j] / n : 0
	}

	return result
}

// --- Process-callback STFT (batch) ---

/**
 * Batch STFT with per-frame processing callback.
 *
 * `process(mag, phase, state, ctx)` receives the spectrum of each frame and
 * returns `{ mag, phase }` for synthesis. The result is overlap-added and
 * normalized to produce the output signal.
 *
 * @param {Float32Array|Float64Array} data - Input signal.
 * @param {Function} process - Callback `(mag, phase, state, ctx) => { mag, phase }`.
 * @param {Object} [opts] - Options.
 * @param {number} [opts.frameSize=2048] - FFT size (power of 2).
 * @param {number} [opts.hopSize=512] - Hop size (default: frameSize/4).
 * @param {number} [opts.anaHop=hopSize] - Analysis hop (distance between input frames).
 * @param {number} [opts.synHop=hopSize] - Synthesis hop (distance between output frames). `synHop !== anaHop` time-stretches by `synHop/anaHop`.
 * @param {number} [opts.sampleRate=44100] - Sample rate (passed to ctx).
 * @returns {Float32Array} Processed signal. Length is `round(data.length * synHop / anaHop)`.
 */
export function stftBatch(data, process, opts) {
	const N = opts?.frameSize ?? 2048
	const hop = opts?.hopSize ?? (N >> 2)
	const anaHop = opts?.anaHop ?? hop
	const synHop = opts?.synHop ?? hop
	const half = N >> 1

	if (!isPow2(N)) throw new Error(`frameSize must be a power of 2, got ${N}`)
	if (anaHop <= 0) throw new Error(`anaHop must be > 0, got ${anaHop}`)
	if (synHop <= 0) throw new Error(`synHop must be > 0, got ${synHop}`)

	const win = hannWindow(N)
	const sc = scratch(N, half)
	const pad = N
	const inLen = data.length
	const outLen = Math.round(inLen * synHop / anaHop)
	const paddedInLen = inLen + pad * 2
	const paddedOutLen = outLen + pad * 2

	const out = new Float64Array(paddedOutLen)
	const norm = new Float64Array(paddedOutLen)
	const state = {}
	const ctx = {
		N, half, hop,
		anaHop, synHop,
		freqPerBin: PI2 / N,
		frameStart: 0,
		sampleRate: opts?.sampleRate ?? 44100,
		opts: { ...opts },
	}

	let aPos = 0, sPos = 0
	while (sPos + N <= paddedOutLen && aPos + N <= paddedInLen) {
		const f = sc.f
		for (let i = 0; i < N; i++) {
			const sIdx = Math.round(aPos) + i - pad
			f[i] = (sIdx >= 0 && sIdx < inLen ? data[sIdx] : 0) * win[i]
		}
		const [re, im] = fft(f, [sc.re, sc.im])
		const { mag, phase } = toPolar(re, im, sc, half)

		ctx.frameStart = Math.round(aPos) - pad
		const r = process(mag, phase, state, ctx)

		for (let k = 0; k <= half; k++) {
			sc.re[k] = r.mag[k] * Math.cos(r.phase[k])
			sc.im[k] = r.mag[k] * Math.sin(r.phase[k])
		}

		synthesizeFrame(sc.re, sc.im, sPos, win, out, norm, sc)

		aPos += anaHop
		sPos += synHop
	}

	const floor = winSqFloor(win, synHop)
	const result = new Float32Array(outLen)
	for (let i = 0; i < outLen; i++) {
		const j = i + pad
		const n = norm[j] < floor ? floor : norm[j]
		result[i] = n > 1e-10 ? out[j] / n : 0
	}

	return result
}

// --- Process-callback STFT (stream) ---

/**
 * Streaming STFT with per-frame processing callback.
 *
 * Returns `{ write(chunk), flush() }`. `write()` returns output samples as
 * soon as they are ready. `flush()` drains remaining samples after the stream ends.
 *
 * @param {Function} process - Callback `(mag, phase, state, ctx) => { mag, phase }`.
 * @param {Object} [opts] - Options.
 * @param {number} [opts.frameSize=2048] - FFT size (power of 2).
 * @param {number} [opts.hopSize=512] - Hop size (default: frameSize/4).
 * @param {number} [opts.anaHop=hopSize] - Analysis hop.
 * @param {number} [opts.synHop=hopSize] - Synthesis hop. `synHop !== anaHop` time-stretches by `synHop/anaHop`.
 * @param {number} [opts.sampleRate=44100] - Sample rate (passed to ctx).
 * @returns {{write(chunk):Float32Array,flush():Float32Array}}
 */
export function stftStream(process, opts) {
	const N = opts?.frameSize ?? 2048
	const hop = opts?.hopSize ?? (N >> 2)
	const anaHop = opts?.anaHop ?? hop
	const synHop = opts?.synHop ?? hop
	const half = N >> 1

	if (!isPow2(N)) throw new Error(`frameSize must be a power of 2, got ${N}`)
	if (anaHop <= 0) throw new Error(`anaHop must be > 0, got ${anaHop}`)
	if (synHop <= 0) throw new Error(`synHop must be > 0, got ${synHop}`)

	const win = hannWindow(N)
	const sc = scratch(N, half)
	const pad = N
	const floor = winSqFloor(win, synHop)

	let outBuf = new Float64Array(N * 8)
	let normBuf = new Float64Array(N * 8)
	let outStart = -pad
	let emitted = 0
	let totalIn = 0
	let state = {}
	let nextSynPos = -pad
	const ctx = {
		N, half, hop,
		anaHop, synHop,
		freqPerBin: PI2 / N,
		frameStart: 0,
		sampleRate: opts?.sampleRate ?? 44100,
		opts: { ...opts },
	}

	function ensureOut(needLen) {
		if (needLen <= outBuf.length) return
		const len = Math.max(needLen, outBuf.length * 2)
		const ob = new Float64Array(len)
		const nb = new Float64Array(len)
		ob.set(outBuf)
		nb.set(normBuf)
		outBuf = ob
		normBuf = nb
	}

	function trimOut(emittedAbs) {
		const dropFront = emittedAbs - outStart
		if (dropFront > N * 4) {
			const keep = outBuf.length - dropFront
			outBuf.copyWithin(0, dropFront)
			outBuf.fill(0, keep)
			normBuf.copyWithin(0, dropFront)
			normBuf.fill(0, keep)
			outStart += dropFront
		}
	}

	const engine = _stftStreamEngine({ ...opts, hopSize: anaHop }, (re, im, time) => {
		ctx.frameStart = time - half
		const { mag, phase } = toPolar(re, im, sc, half)
		const r = process(mag, phase, state, ctx)

		for (let k = 0; k <= half; k++) {
			sc.re[k] = r.mag[k] * Math.cos(r.phase[k])
			sc.im[k] = r.mag[k] * Math.sin(r.phase[k])
		}

		const sf = ifft(sc.re, sc.im, sc.f)
		const pos = nextSynPos - outStart
		nextSynPos += synHop
		ensureOut(pos + N)
		for (let i = 0; i < N; i++) {
			outBuf[pos + i] += sf[i] * win[i]
			normBuf[pos + i] += win[i] * win[i]
		}
	})

	// Emit output up to synthesis position `synUpto`, clamped to the synthesis
	// length corresponding to all input received so far.
	function emit(synUpto) {
		synUpto = Math.min(synUpto, Math.round(totalIn * synHop / anaHop))
		if (synUpto <= emitted) return new Float32Array(0)
		const count = synUpto - emitted
		const out = new Float32Array(count)
		for (let i = 0; i < count; i++) {
			const j = emitted + i - outStart
			const n = normBuf[j] < floor ? floor : normBuf[j]
			out[i] = n > 1e-10 ? outBuf[j] / n : 0
		}
		emitted = synUpto
		trimOut(emitted)
		return out
	}

	return {
		write(chunk) {
			if (engine._flushed) throw new Error('stftStream already flushed')
			totalIn += chunk.length
			engine.write(chunk)
			// Safe emission: scale totalIn to synthesis coords, then back off one
			// frame-pad in synthesis coords (not analysis — pad is a sample-count
			// safety margin, not a hop-count).
			return emit(Math.round(totalIn * synHop / anaHop) - pad)
		},
		flush() {
			if (engine._flushed) return new Float32Array(0)
			engine.flush()
			return emit(Math.round(totalIn * synHop / anaHop))
		},
	}
}

// --- Shared streaming engine ---

/**
 * Internal streaming engine. `onFrame(re, im, time)` is called for each
 * analysis frame. Returns `{ write(chunk), flush() }`.
 */
function _stftStreamEngine(opts, onFrame) {
	const N = opts?.frameSize ?? 2048
	const hop = opts?.hopSize ?? (N >> 2)
	const half = N >> 1

	if (!isPow2(N)) throw new Error(`frameSize must be a power of 2, got ${N}`)
	if (hop <= 0) throw new Error(`hopSize must be > 0, got ${hop}`)

	const win = hannWindow(N)
	const sc = scratch(N, half)
	const pad = N

	let buf = new Float64Array(N * 4)
	let bufLen = pad
	let streamOffset = 0
	let nextFramePos = 0
	let flushed = false

	function ensure(need) {
		if (need <= buf.length) return
		const nb = new Float64Array(Math.max(need, buf.length * 2))
		nb.set(buf.subarray(0, bufLen))
		buf = nb
	}

	function processFrames(limitPos) {
		while (nextFramePos + N <= limitPos) {
			const [re, im] = analyzeFrame(buf, nextFramePos, win, sc)
			onFrame(re, im, streamOffset + nextFramePos - pad + half)
			nextFramePos += hop
		}

		if (nextFramePos > N * 2) {
			const keep = nextFramePos - N
			buf.copyWithin(0, keep, bufLen)
			bufLen -= keep
			nextFramePos -= keep
			streamOffset += keep
		}
	}

	return {
		write(chunk) {
			if (flushed) throw new Error('stream already flushed')
			ensure(bufLen + chunk.length)
			buf.set(chunk, bufLen)
			bufLen += chunk.length
			processFrames(bufLen)
		},
		flush() {
			if (flushed) return
			flushed = true
			ensure(bufLen + pad)
			buf.fill(0, bufLen, bufLen + pad)
			bufLen += pad
			processFrames(bufLen)
		},
		get _flushed() { return flushed },
	}
}

// --- Streaming analysis-only STFT ---

/**
 * Create a streaming STFT analysis processor.
 *
 * Returns `{ write(chunk), flush() }`. Each call returns an array of frames
 * `{ re, im, mag, phase, time }` ready for processing.
 *
 * @param {Object} [opts] - Options.
 * @param {number} [opts.frameSize=2048] - FFT size (power of 2).
 * @param {number} [opts.hopSize=512] - Analysis hop (default: frameSize/4).
 * @param {number} [opts.anaHop] - Alternative spelling of `hopSize`; takes precedence if set.
 * @returns {{write(chunk):Array<Object>,flush():Array<Object>}}
 */
export function stftAnalysisStream(opts) {
	const frames = []
	const N = opts?.frameSize ?? 2048
	const half = N >> 1
	const hop = opts?.hopSize ?? (N >> 2)
	const anaHop = opts?.anaHop ?? hop
	const engine = _stftStreamEngine({ ...opts, hopSize: anaHop }, (re, im, time) => {
		frames.push(makeFrame(re, im, time, half))
	})

	return {
		write(chunk) {
			const before = frames.length
			engine.write(chunk)
			return frames.splice(before)
		},
		flush() {
			engine.flush()
			return frames.splice(0)
		},
	}
}
