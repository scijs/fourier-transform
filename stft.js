/**
 * Short-Time Fourier Transform (STFT) and inverse STFT.
 *
 * @module fourier-transform/stft
 */

import { fft, ifft } from './index.js'
import { own } from './pair.js'

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

/** f = the N samples of src from `start` times the window, zeros where they fall outside it (the padding):
 *  the bounds found once a frame, not tested every sample */
function windowIn(f, src, start, win) {
	const N = win.length, a = Math.min(N, Math.max(0, -start)), b = Math.max(a, Math.min(N, src.length - start))
	f.fill(0, 0, a)
	for (let i = a; i < b; i++) f[i] = src[start + i] * win[i]
	f.fill(0, b, N)
	return f
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

/** A frame's processed spectrum. With `complex`, process(re, im, state, ctx) → { re, im } works on the
 *  complex bins (it converts only what it needs, no polar round trip); otherwise process(mag, phase,
 *  state, ctx) → { mag, phase }, converted back into sc.re/sc.im. */
function spectrum(process, complex, re, im, state, ctx, sc, half) {
	if (complex) { const r = process(re, im, state, ctx); return [r.re, r.im] }
	const { mag, phase } = toPolar(re, im, sc, half)
	const r = process(mag, phase, state, ctx)
	for (let k = 0; k <= half; k++) {
		sc.re[k] = r.mag[k] * Math.cos(r.phase[k])
		sc.im[k] = r.mag[k] * Math.sin(r.phase[k])
	}
	return [sc.re, sc.im]
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
	const mag = new Float64Array(half + 1)
	const phase = new Float64Array(half + 1)
	for (let k = 0; k <= half; k++) {
		mag[k] = Math.sqrt(reCopy[k] * reCopy[k] + imCopy[k] * imCopy[k])
		phase[k] = Math.atan2(imCopy[k], reCopy[k])
	}
	return { re: reCopy, im: imCopy, mag, phase, time }
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
		const [re, im] = fft(windowIn(sc.f, signal, pos - pad, win), [sc.re, sc.im])
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
 * @param {boolean} [opts.complex] - `process(re, im, state, ctx) => { re, im }` receives the complex bins instead of polar form (may edit them in place).
 * @returns {Float32Array} Processed signal. Length is `round(data.length * synHop / anaHop)`.
 */
export function stftBatch(data, process, opts) {
	const N = opts?.frameSize ?? 2048
	const hop = opts?.hopSize ?? (N >> 2)
	const anaHopV = opts?.anaHop ?? hop
	const synHopV = opts?.synHop ?? hop
	const half = N >> 1
	const complex = !!opts?.complex

	// Hops may be functions `(frameStart, ctx) => hop` sampled once per frame —
	// time-varying stretch (sliding tempo). Constant hops keep the exact legacy path.
	const anaHopFn = typeof anaHopV === 'function' ? anaHopV : null
	const synHopFn = typeof synHopV === 'function' ? synHopV : null
	const varHop = !!(anaHopFn || synHopFn)
	const anaHop = anaHopFn ? anaHopFn(0, null) : anaHopV
	const synHop = synHopFn ? synHopFn(0, null) : synHopV

	if (!isPow2(N)) throw new Error(`frameSize must be a power of 2, got ${N}`)
	if (anaHop <= 0) throw new Error(`anaHop must be > 0, got ${anaHop}`)
	if (synHop <= 0) throw new Error(`synHop must be > 0, got ${synHop}`)

	const win = hannWindow(N)
	const sc = scratch(N, half)
	const pad = N
	// Analysis frame k starts at k·anaHop − pad; synthesis frame k at k·synHop − pOut.
	// pOut = (N/2)(synHop/anaHop + 1) makes frame CENTERS map c → c·synHop/anaHop, so
	// input time t lands at exactly t·factor (no constant lag, no tail truncation).
	// At synHop === anaHop this reduces to pOut === pad — plain OLA is unchanged.
	// For function hops pOut anchors to the initial ratio; the mapping follows the
	// running hop accumulators from there.
	const pOut = Math.round(half * (synHop / anaHop + 1))
	const inLen = data.length
	const paddedInLen = inLen + pad * 2

	let out, norm, paddedOutLen
	const alloc = len => {
		paddedOutLen = len
		out = new Float64Array(len)
		norm = new Float64Array(len)
	}
	if (!varHop) alloc(Math.round(inLen * synHop / anaHop) + pOut * 2)
	else alloc(Math.ceil(inLen * (synHop / anaHop) * 1.5) + pOut * 2 + N)  // grown on demand
	const grow = need => {
		if (need <= paddedOutLen) return
		const len = Math.max(need, paddedOutLen * 2)
		const o = new Float64Array(len), n = new Float64Array(len)
		o.set(out); n.set(norm)
		out = o; norm = n; paddedOutLen = len
	}

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
	while (aPos + N <= paddedInLen && (varHop || sPos + N <= paddedOutLen)) {
		if (varHop) grow(sPos + N)
		const [re, im] = fft(windowIn(sc.f, data, Math.round(aPos) - pad, win), [sc.re, sc.im])

		ctx.frameStart = Math.round(aPos) - pad
		if (anaHopFn) ctx.anaHop = Math.max(1e-6, anaHopFn(ctx.frameStart, ctx))
		if (synHopFn) ctx.synHop = Math.max(1e-6, synHopFn(ctx.frameStart, ctx))
		const [yr, yi] = spectrum(process, complex, re, im, state, ctx, sc, half)

		synthesizeFrame(yr, yi, sPos, win, out, norm, sc)

		aPos += varHop ? ctx.anaHop : anaHop
		sPos += varHop ? ctx.synHop : synHop
	}

	// Variable synHop has no periodic COLA phase — fall back to the epsilon guard.
	const floor = synHopFn ? 0 : winSqFloor(win, synHop)
	const outLen = varHop ? Math.max(0, Math.round(sPos) - pOut) : Math.round(inLen * synHop / anaHop)
	const result = new Float32Array(outLen)
	for (let i = 0; i < outLen; i++) {
		const j = i + pOut
		if (j >= paddedOutLen) break
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
 * With `opts.channels`, one stream for that many channels: `write(chunks)` and `flush()` take and give an array
 * of them, the frames of every channel at the same places, the hops asked once a frame; each channel's samples
 * are the ones its own stream gives (two channels' transforms run at once, fourier-transform/pair, where
 * WebAssembly SIMD runs).
 *
 * @param {Function} process - Callback `(mag, phase, state, ctx) => { mag, phase }`; with channels, a state each and `ctx.channel`.
 * @param {Object} [opts] - Options.
 * @param {number} [opts.frameSize=2048] - FFT size (power of 2).
 * @param {number} [opts.hopSize=512] - Hop size (default: frameSize/4).
 * @param {number} [opts.anaHop=hopSize] - Analysis hop.
 * @param {number} [opts.synHop=hopSize] - Synthesis hop. `synHop !== anaHop` time-stretches by `synHop/anaHop`.
 * @param {number} [opts.sampleRate=44100] - Sample rate (passed to ctx).
 * @param {boolean} [opts.complex] - `process(re, im, state, ctx) => { re, im }` receives the complex bins instead of polar form (may edit them in place).
 * @param {number} [opts.channels] - Channels in one stream: write and flush take and return arrays.
 * @param {boolean} [opts.joint] - With `channels` and `complex`: `process(res, ims, state, ctx)` once a frame with every channel's bins (an array a channel, edited in place) and one state.
 * @returns {{write(chunk):Float32Array,flush():Float32Array}}
 */
export function stftStream(process, opts) {
	if (opts?.channels != null) return streams(process, opts, opts.channels)
	const s = streams(process, opts, 1)
	return { write: chunk => s.write([chunk])[0], flush: () => s.flush()[0] }
}

function streams(process, opts, nch) {
	const N = opts?.frameSize ?? 2048
	const hop = opts?.hopSize ?? (N >> 2)
	const anaHopV = opts?.anaHop ?? hop
	const synHopV = opts?.synHop ?? hop
	const half = N >> 1
	const complex = !!opts?.complex

	// Hops may be functions `(frameStart, ctx) => hop` sampled once per frame —
	// time-varying stretch. Constant hops keep the exact legacy path.
	const anaHopFn = typeof anaHopV === 'function' ? anaHopV : null
	const synHopFn = typeof synHopV === 'function' ? synHopV : null
	const varHop = !!(anaHopFn || synHopFn)
	const anaHop = anaHopFn ? anaHopFn(0, null) : anaHopV
	const synHop = synHopFn ? synHopFn(0, null) : synHopV

	if (!isPow2(N)) throw new Error(`frameSize must be a power of 2, got ${N}`)
	if (anaHop <= 0) throw new Error(`anaHop must be > 0, got ${anaHop}`)
	if (synHop <= 0) throw new Error(`synHop must be > 0, got ${synHop}`)
	if (!(nch >= 1)) throw new Error(`channels must be at least 1, got ${nch}`)

	const win = hannWindow(N), win2 = win.map(w => w * w)
	const sc = scratch(N, half)
	const pad = N
	// Same center-aligned mapping as stftBatch: synthesis frame k sits at
	// k·synHop − pOut so input time t lands at t·synHop/anaHop exactly.
	const pOut = Math.round(half * (synHop / anaHop + 1))
	const floor = synHopFn ? 0 : winSqFloor(win, synHop)
	// the analysis frames' hop (the engine's: a function called with the frame start alone, its first call here)
	const hopFn = anaHopFn
	const engHop = hopFn ? hopFn(0) : anaHop
	if (engHop <= 0) throw new Error(`hopSize must be > 0, got ${engHop}`)
	// two channels at a time through a pair kernel of the stream's own (fourier-transform/pair), where it runs: in its
	// memory the window and its square (W), the frame pair (F), and the output sums with their normalizer (O on)
	const pr = own(N), W = pr ? pr.base : 0, F = W + 16 * N, O = F + 16 * N

	// the input since the frame the next one starts in, channel by channel
	let inBuf = Array.from({ length: nch }, () => new Float64Array(N * 4))
	let bufLen = pad
	let streamOffset = 0
	let nextFramePos = 0
	let flushed = false

	// the output sums and the window's, `len` samples each: in the kernel's memory, the normalizer then each channel's
	// (the views made anew), else arrays of their own
	let outBuf, normBuf, frames
	function sums(len) {
		if (!pr) { outBuf = Array.from({ length: nch }, () => new Float64Array(len)); normBuf = new Float64Array(len); return }
		const buf = pr.room(O - pr.base + 8 * len * (nch + 1))
		normBuf = new Float64Array(buf, O, len)
		outBuf = Array.from({ length: nch }, (_, c) => new Float64Array(buf, O + 8 * len * (c + 1), len))
		frames = [new Float64Array(buf, F, N), new Float64Array(buf, F + 8 * N, N)]
	}
	sums(N * 8)
	if (pr) { new Float64Array(pr.input.buffer, W, N).set(win); new Float64Array(pr.input.buffer, W + 8 * N, N).set(win2) }
	let outStart = -pOut
	let emitted = 0
	let totalIn = 0
	// joint: one call a frame with every channel's bins, one state; their bins each channel's own arrays (a pair's two
	// stay in its kernel)
	const joint = !!opts?.joint
	if (joint && !complex) throw new Error('joint frames are complex bins: pass complex')
	const states = Array.from({ length: joint ? 1 : nch }, () => ({}))
	const spec = joint && !(pr && nch <= 2) ? Array.from({ length: nch }, () => [new Float64Array(half + 1), new Float64Array(half + 1)]) : null
	let nextSynPos = -pOut
	const ctx = {
		N, half, hop,
		anaHop, synHop,
		freqPerBin: PI2 / N,
		frameStart: 0,
		sampleRate: opts?.sampleRate ?? 44100,
		opts: { ...opts },
		channel: 0,
	}

	function ensureIn(need) {
		if (need <= inBuf[0].length) return
		const len = Math.max(need, inBuf[0].length * 2)
		inBuf = inBuf.map(b => { const nb = new Float64Array(len); nb.set(b.subarray(0, bufLen)); return nb })
	}

	function ensureOut(needLen) {
		const was = normBuf.length
		if (needLen <= was) return
		const keep = [normBuf, ...outBuf].map(b => b.slice())
		sums(Math.max(needLen, was * 2))
		;[normBuf, ...outBuf].forEach((b, i) => { b.set(keep[i]); b.fill(0, was) })
	}

	// what is emitted goes; what the frames have added is past it, up to the last one's end, zeros after
	function trimOut(emittedAbs) {
		const dropFront = emittedAbs - outStart
		if (dropFront > N * 4) {
			const end = Math.min(normBuf.length, Math.max(dropFront, Math.ceil(nextSynPos - outStart) + N))
			for (const b of [...outBuf, normBuf]) { b.copyWithin(0, dropFront, end); b.fill(0, end - dropFront, end) }
			outStart += dropFront
		}
	}

	// A channel's processed bins, written into re/im (process may return its own arrays, or polar ones)
	function bins(c, re, im) {
		ctx.channel = c
		const [yr, yi] = spectrum(process, complex, re, im, states[c], ctx, sc, half)
		if (yr !== re) re.set(yr.subarray(0, half + 1))
		if (yi !== im) im.set(yi.subarray(0, half + 1))
	}

	// A pair's frames, channels c and c + 1 (`two`), windowed and transformed in the kernel
	function pairIn(c, two, pos) {
		frames[0].set(inBuf[c].subarray(pos, pos + N))
		if (two) frames[1].set(inBuf[c + 1].subarray(pos, pos + N))
		pr.win(F, two ? F + 8 * N : F, W)
		pr.fft()
	}

	// The kernel's bins back to samples, added into the pair's sums at `at`: at a whole sample in the kernel, the
	// normalizer with the first pair; a fractional one (a synthesis hop not whole) as the JS loop takes it
	function pairOut(c, two, at) {
		const len = normBuf.length
		pr.ifft()
		if (Number.isInteger(at)) return pr.ola(O + 8 * (len * (c + 1) + at), two ? O + 8 * (len * (c + 2) + at) : -1, c ? -1 : O + 8 * at, W, W + 8 * N)
		for (let l = 0; l < (two ? 2 : 1); l++) {
			const o = outBuf[c + l], s = pr.output[l]
			for (let i = 0; i < N; i++) o[at + i] += s[i] * win[i]
		}
		if (!c) for (let i = 0; i < N; i++) normBuf[at + i] += win2[i]
	}

	// One frame of every channel, starting at pos in the input, its centre at time
	function frame(pos, time) {
		ctx.frameStart = time - half
		if (anaHopFn) ctx.anaHop = Math.max(1e-6, anaHopFn(ctx.frameStart, ctx))
		if (synHopFn) ctx.synHop = Math.max(1e-6, synHopFn(ctx.frameStart, ctx))
		const at = nextSynPos - outStart
		nextSynPos += varHop ? ctx.synHop : synHop
		ensureOut(at + N)
		if (joint) return jointFrame(pos, at)
		for (let c = 0; c < nch; c += 2) {
			if (pr) {
				const two = c + 1 < nch
				pairIn(c, two, pos)
				bins(c, pr.re[0], pr.im[0])
				if (two) bins(c + 1, pr.re[1], pr.im[1])
				pairOut(c, two, at)
				continue
			}
			for (let l = c; l < Math.min(nch, c + 2); l++) {
				const f = sc.f, src = inBuf[l]
				for (let i = 0; i < N; i++) f[i] = src[pos + i] * win[i]
				const [re, im] = fft(f, [sc.re, sc.im])
				ctx.channel = l
				const [yr, yi] = spectrum(process, complex, re, im, states[l], ctx, sc, half)
				const sf = ifft(yr, yi, sc.f), o = outBuf[l]
				for (let i = 0; i < N; i++) o[at + i] += sf[i] * win[i]
			}
		}
		if (!pr) for (let i = 0; i < N; i++) normBuf[at + i] += win2[i]
	}

	// The frame of every channel in one call: process(res, ims, state, ctx) edits their bins in place
	function jointFrame(pos, at) {
		if (!spec) {
			const two = nch === 2
			pairIn(0, two, pos)
			process(two ? pr.re : [pr.re[0]], two ? pr.im : [pr.im[0]], states[0], ctx)
			return pairOut(0, two, at)
		}
		for (let c = 0; c < nch; c += 2) {
			const two = c + 1 < nch
			if (pr) {
				pairIn(c, two, pos)
				for (let l = 0; l < (two ? 2 : 1); l++) { spec[c + l][0].set(pr.re[l]); spec[c + l][1].set(pr.im[l]) }
			} else for (let l = c; l < (two ? c + 2 : c + 1); l++) {
				const f = sc.f, src = inBuf[l]
				for (let i = 0; i < N; i++) f[i] = src[pos + i] * win[i]
				fft(f, spec[l])
			}
		}
		process(spec.map(s => s[0]), spec.map(s => s[1]), states[0], ctx)
		for (let c = 0; c < nch; c += 2) {
			const two = c + 1 < nch
			if (pr) {
				for (let l = 0; l < (two ? 2 : 1); l++) { pr.re[l].set(spec[c + l][0]); pr.im[l].set(spec[c + l][1]) }
				pairOut(c, two, at)
			} else for (let l = c; l < (two ? c + 2 : c + 1); l++) {
				const sf = ifft(spec[l][0], spec[l][1], sc.f), o = outBuf[l]
				for (let i = 0; i < N; i++) o[at + i] += sf[i] * win[i]
			}
		}
		if (!pr) for (let i = 0; i < N; i++) normBuf[at + i] += win2[i]
	}

	function processFrames(limitPos) {
		// hop may be fractional (stftStream passes anaHop = hopSize/factor): keep the
		// accumulator exact and round only the read position, mirroring stftBatch.
		while (Math.round(nextFramePos) + N <= limitPos) {
			const pos = Math.round(nextFramePos)
			frame(pos, streamOffset + pos - pad + half)
			nextFramePos += hopFn ? Math.max(1e-6, hopFn(streamOffset + pos - pad)) : engHop
		}

		if (nextFramePos > N * 2) {
			// a hop longer than the frame can put the next frame past the buffered input:
			// drop at most what is buffered, the rest of the gap stays in nextFramePos
			const keep = Math.min(Math.floor(nextFramePos) - N, bufLen)
			for (const b of inBuf) b.copyWithin(0, keep, bufLen)
			bufLen -= keep
			nextFramePos -= keep
			streamOffset += keep
		}
	}

	// Emit output up to synthesis position `synUpto`, clamped to what is final.
	// Constant hops: the closed-form input→synthesis ratio. Function hops: every
	// future frame writes at ≥ nextSynPos, so [0, nextSynPos) is final: a running
	// accumulator replaces the formula, and the clamp alone is the emission point.
	function emit(synUpto) {
		synUpto = Math.min(synUpto, varHop ? Math.floor(nextSynPos) : Math.round(totalIn * synHop / anaHop))
		if (synUpto <= emitted) return outBuf.map(() => new Float32Array(0))
		const count = synUpto - emitted
		const outs = outBuf.map(() => new Float32Array(count))
		for (let i = 0; i < count; i++) {
			const j = emitted + i - outStart
			const n = normBuf[j] < floor ? floor : normBuf[j]
			for (let c = 0; c < nch; c++) outs[c][i] = n > 1e-10 ? outBuf[c][j] / n : 0
		}
		emitted = synUpto
		trimOut(emitted)
		return outs
	}

	return {
		write(chunks) {
			if (flushed) throw new Error('stftStream already flushed')
			const len = chunks[0].length
			totalIn += len
			ensureIn(bufLen + len)
			for (let c = 0; c < nch; c++) inBuf[c].set(chunks[c], bufLen)
			bufLen += len
			processFrames(bufLen)
			// Constant hops: the deepest-processed frame starts at ≈(totalIn − N) in
			// analysis coords, which synthesizes at totalIn·factor − pOut; everything
			// before that is final. Function hops: nextSynPos already sits there.
			return emit(varHop ? Infinity : Math.round(totalIn * synHop / anaHop) - pOut)
		},
		flush() {
			if (flushed) return outBuf.map(() => new Float32Array(0))
			flushed = true
			ensureIn(bufLen + pad)
			for (const b of inBuf) b.fill(0, bufLen, bufLen + pad)
			bufLen += pad
			processFrames(bufLen)
			return emit(Infinity)
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
	const hopV = opts?.hopSize ?? (N >> 2)
	// hopSize may be a function `(frameStart) => hop` — sampled per analysis frame
	const hopFn = typeof hopV === 'function' ? hopV : null
	const hop = hopFn ? hopFn(0) : hopV
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
		// hop may be fractional (stftStream passes anaHop = hopSize/factor): keep the
		// accumulator exact and round only the read position, mirroring stftBatch.
		while (Math.round(nextFramePos) + N <= limitPos) {
			const pos = Math.round(nextFramePos)
			const [re, im] = analyzeFrame(buf, pos, win, sc)
			onFrame(re, im, streamOffset + pos - pad + half)
			nextFramePos += hopFn ? Math.max(1e-6, hopFn(streamOffset + pos - pad)) : hop
		}

		if (nextFramePos > N * 2) {
			// a hop longer than the frame can put the next frame past the buffered input:
			// drop at most what is buffered, the rest of the gap stays in nextFramePos
			const keep = Math.min(Math.floor(nextFramePos) - N, bufLen)
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
		_flushed() { return flushed },
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
