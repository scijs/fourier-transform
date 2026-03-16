/**
 * Real-valued split-radix FFT.
 * Returns magnitude spectrum as Float64Array of length N/2.
 *
 * @module fourier-transform
 */

const { sqrt, sin, cos, abs, SQRT1_2 } = Math
const TWO_PI = 6.283185307179586

// Per-size cached buffers and precomputed twiddle factors
const cache = new Map()

function init(N) {
	const x = new Float64Array(N)
	const spectrum = new Float64Array(N >>> 1)

	// Count twiddle factors per stage
	let total = 0, n2 = 2, nn = N >>> 1
	const stages = []
	while ((nn = nn >>> 1)) {
		n2 = n2 << 1
		const n8 = n2 >>> 3
		const count = n8 > 1 ? n8 - 1 : 0
		stages.push({ offset: total, count })
		total += count
	}

	// Interleaved twiddle table: [cc1, ss1, cc3, ss3] per entry
	const tw = new Float64Array(total << 2)
	n2 = 2; nn = N >>> 1
	let si = 0
	while ((nn = nn >>> 1)) {
		n2 = n2 << 1
		const n8 = n2 >>> 3
		const e = TWO_PI / n2
		const off = stages[si].offset << 2
		for (let j = 1; j < n8; j++) {
			const a = j * e
			const s = sin(a), c = cos(a)
			const idx = off + ((j - 1) << 2)
			tw[idx] = c
			tw[idx + 1] = s
			tw[idx + 2] = 4 * c * (c * c - 0.75)
			tw[idx + 3] = 4 * s * (0.75 - s * s)
		}
		si++
	}

	const entry = { x, spectrum, tw, stages }
	cache.set(N, entry)
	return entry
}

export default function rfft(input) {
	const N = input.length
	if (!N || (N & (N - 1))) throw Error('Input length must be a positive power of 2.')

	const { x, spectrum, tw, stages } = cache.get(N) || init(N)
	const bSi = 2 / N

	reverseBinPermute(N, x, input)

	// First pass: length-2 butterflies
	for (let ix = 0, id = 4; ix < N; id *= 4) {
		for (let i0 = ix; i0 < N; i0 += id) {
			const t = x[i0] - x[i0 + 1]
			x[i0] += x[i0 + 1]
			x[i0 + 1] = t
		}
		ix = 2 * (id - 1)
	}

	// Subsequent stages
	let n2 = 2, nn = N >>> 1, si = 0
	while ((nn = nn >>> 1)) {
		let ix = 0
		n2 = n2 << 1
		let id = n2 << 1
		const n4 = n2 >>> 2
		const n8 = n2 >>> 3

		do {
			if (n4 !== 1) {
				for (let i0 = ix; i0 < N; i0 += id) {
					let i1 = i0, i2 = i1 + n4, i3 = i2 + n4, i4 = i3 + n4

					let t1 = x[i3] + x[i4]
					x[i4] -= x[i3]
					x[i3] = x[i1] - t1
					x[i1] += t1

					i1 += n8; i2 += n8; i3 += n8; i4 += n8

					t1 = x[i3] + x[i4]
					let t2 = x[i3] - x[i4]
					t1 = -t1 * SQRT1_2
					t2 *= SQRT1_2

					const st1 = x[i2]
					x[i4] = t1 + st1
					x[i3] = t1 - st1
					x[i2] = x[i1] - t2
					x[i1] += t2
				}
			} else {
				for (let i0 = ix; i0 < N; i0 += id) {
					const i1 = i0, i3 = i1 + n4 + n4, i4 = i3 + n4
					const t1 = x[i3] + x[i4]
					x[i4] -= x[i3]
					x[i3] = x[i1] - t1
					x[i1] += t1
				}
			}
			ix = (id << 1) - n2
			id = id << 2
		} while (ix < N)

		// Twiddle factor butterflies
		const { offset, count } = stages[si]
		for (let j = 0; j < count; j++) {
			const ti = (offset + j) << 2
			const cc1 = tw[ti], ss1 = tw[ti + 1], cc3 = tw[ti + 2], ss3 = tw[ti + 3]

			ix = 0; id = n2 << 1
			do {
				for (let i0 = ix; i0 < N; i0 += id) {
					const i1 = i0 + j + 1
					const i2 = i1 + n4
					const i3 = i2 + n4
					const i4 = i3 + n4
					const i5 = i0 + n4 - j - 1
					const i6 = i5 + n4
					const i7 = i6 + n4
					const i8 = i7 + n4

					let t2 = x[i7] * cc1 - x[i3] * ss1
					let t1 = x[i7] * ss1 + x[i3] * cc1
					let t4 = x[i8] * cc3 - x[i4] * ss3
					let t3 = x[i8] * ss3 + x[i4] * cc3

					const st1 = t2 - t4
					t2 += t4
					t4 = st1

					x[i8] = t2 + x[i6]
					x[i3] = t2 - x[i6]

					const st2 = t3 - t1
					t1 += t3
					t3 = st2

					x[i4] = t3 + x[i2]
					x[i7] = t3 - x[i2]

					x[i6] = x[i1] - t1
					x[i1] += t1

					x[i2] = t4 + x[i5]
					x[i5] -= t4
				}
				ix = (id << 1) - n2
				id = id << 2
			} while (ix < N)
		}
		si++
	}

	// Magnitude spectrum: Re(X[k]) = x[k], Im(X[k]) = x[N-k]
	let i = N >>> 1
	while (--i) {
		const rval = x[i], ival = x[N - i]
		spectrum[i] = bSi * sqrt(rval * rval + ival * ival)
	}
	spectrum[0] = abs(bSi * x[0])

	return spectrum
}

function reverseBinPermute(N, dest, source) {
	const halfSize = N >>> 1
	const nm1 = N - 1

	dest[0] = source[0]
	if (halfSize < 2) { dest[nm1] = source[nm1]; return }

	let i = 1, r = 0

	do {
		r += halfSize
		dest[i] = source[r]
		dest[r] = source[i]

		i++

		let h = halfSize << 1
		while (h = h >> 1, !((r ^= h) & h)) {}

		if (r >= i) {
			dest[i] = source[r]
			dest[r] = source[i]
			dest[nm1 - i] = source[nm1 - r]
			dest[nm1 - r] = source[nm1 - i]
		}
		i++
	} while (i < halfSize)

	dest[nm1] = source[nm1]
}
