/**
 * Real values fourier transform.
 *
 * @module  fourier-transform
 *
 */
'use strict'

module.exports = function rfft (input, spectrum) {
	if (!input) throw Error("Input waveform is not provided, pass input array.")

	var N = input.length

	var k = Math.floor(Math.log(N) / Math.LN2)

	if (Math.pow(2, k) !== N) throw Error("Invalid array size, must be a power of 2.")

	if (!spectrum) spectrum = new Array(N/2)

	//.forward call
	var n         = N,
		x         = new Array(N),
		TWO_PI    = 2*Math.PI,
		sqrt      = Math.sqrt,
		i         = n >>> 1,
		bSi       = 2 / n,
		n2, n4, n8, nn,
		t1, t2, t3, t4,
		i1, i2, i3, i4, i5, i6, i7, i8,
		st1, cc1, ss1, cc3, ss3,
		e,
		a,
		rval, ival, mag

	reverseBinPermute(N, x, input)

	for (var ix = 0, id = 4; ix < n; id *= 4) {
		for (var i0 = ix; i0 < n; i0 += id) {
			//sumdiff(x[i0], x[i0+1]) // {a, b}  <--| {a+b, a-b}
			st1 = x[i0] - x[i0+1]
			x[i0] += x[i0+1]
			x[i0+1] = st1
		}
		ix = 2*(id-1)
	}

	n2 = 2
	nn = n >>> 1

	while((nn = nn >>> 1)) {
		ix = 0
		n2 = n2 << 1
		id = n2 << 1
		n4 = n2 >>> 2
		n8 = n2 >>> 3
		do {
			if(n4 !== 1) {
				for(i0 = ix; i0 < n; i0 += id) {
					i1 = i0
					i2 = i1 + n4
					i3 = i2 + n4
					i4 = i3 + n4

					//diffsum3_r(x[i3], x[i4], t1) // {a, b, s} <--| {a, b-a, a+b}
					t1 = x[i3] + x[i4]
					x[i4] -= x[i3]
					//sumdiff3(x[i1], t1, x[i3])   // {a, b, d} <--| {a+b, b, a-b}
					x[i3] = x[i1] - t1
					x[i1] += t1

					i1 += n8
					i2 += n8
					i3 += n8
					i4 += n8

					//sumdiff(x[i3], x[i4], t1, t2) // {s, d}  <--| {a+b, a-b}
					t1 = x[i3] + x[i4]
					t2 = x[i3] - x[i4]

					t1 = -t1 * Math.SQRT1_2
					t2 *= Math.SQRT1_2

					// sumdiff(t1, x[i2], x[i4], x[i3]) // {s, d}  <--| {a+b, a-b}
					st1 = x[i2]
					x[i4] = t1 + st1
					x[i3] = t1 - st1

					//sumdiff3(x[i1], t2, x[i2]) // {a, b, d} <--| {a+b, b, a-b}
					x[i2] = x[i1] - t2
					x[i1] += t2
				}
			} else {
				for(i0 = ix; i0 < n; i0 += id) {
					i1 = i0
					i2 = i1 + n4
					i3 = i2 + n4
					i4 = i3 + n4

					//diffsum3_r(x[i3], x[i4], t1) // {a, b, s} <--| {a, b-a, a+b}
					t1 = x[i3] + x[i4]
					x[i4] -= x[i3]

					//sumdiff3(x[i1], t1, x[i3])   // {a, b, d} <--| {a+b, b, a-b}
					x[i3] = x[i1] - t1
					x[i1] += t1
				}
			}

			ix = (id << 1) - n2
			id = id << 2
		} while (ix < n)

		e = TWO_PI / n2

		for (var j = 1; j < n8; j++) {
			a = j * e
			ss1 = Math.sin(a)
			cc1 = Math.cos(a)

			//ss3 = sin(3*a) cc3 = cos(3*a)
			cc3 = 4*cc1*(cc1*cc1-0.75)
			ss3 = 4*ss1*(0.75-ss1*ss1)

			ix = 0; id = n2 << 1
			do {
				for (i0 = ix; i0 < n; i0 += id) {
					i1 = i0 + j
					i2 = i1 + n4
					i3 = i2 + n4
					i4 = i3 + n4

					i5 = i0 + n4 - j
					i6 = i5 + n4
					i7 = i6 + n4
					i8 = i7 + n4

					//cmult(c, s, x, y, &u, &v)
					//cmult(cc1, ss1, x[i7], x[i3], t2, t1) // {u,v} <--| {x*c-y*s, x*s+y*c}
					t2 = x[i7]*cc1 - x[i3]*ss1
					t1 = x[i7]*ss1 + x[i3]*cc1

					//cmult(cc3, ss3, x[i8], x[i4], t4, t3)
					t4 = x[i8]*cc3 - x[i4]*ss3
					t3 = x[i8]*ss3 + x[i4]*cc3

					//sumdiff(t2, t4)   // {a, b} <--| {a+b, a-b}
					st1 = t2 - t4
					t2 += t4
					t4 = st1

					//sumdiff(t2, x[i6], x[i8], x[i3]) // {s, d}  <--| {a+b, a-b}
					//st1 = x[i6] x[i8] = t2 + st1 x[i3] = t2 - st1
					x[i8] = t2 + x[i6]
					x[i3] = t2 - x[i6]

					//sumdiff_r(t1, t3) // {a, b} <--| {a+b, b-a}
					st1 = t3 - t1
					t1 += t3
					t3 = st1

					//sumdiff(t3, x[i2], x[i4], x[i7]) // {s, d}  <--| {a+b, a-b}
					//st1 = x[i2] x[i4] = t3 + st1 x[i7] = t3 - st1
					x[i4] = t3 + x[i2]
					x[i7] = t3 - x[i2]

					//sumdiff3(x[i1], t1, x[i6])   // {a, b, d} <--| {a+b, b, a-b}
					x[i6] = x[i1] - t1
					x[i1] += t1

					//diffsum3_r(t4, x[i5], x[i2]) // {a, b, s} <--| {a, b-a, a+b}
					x[i2] = t4 + x[i5]
					x[i5] -= t4
				}

				ix = (id << 1) - n2
				id = id << 2

			} while (ix < n)
		}
	}

	while (--i) {
		rval = x[i]
		ival = x[n-i-1]
		mag = bSi * sqrt(rval * rval + ival * ival)
		spectrum[i] = mag
	}

	spectrum[0] = Math.abs(bSi * x[0])

	return spectrum
}


function reverseBinPermute (N, dest, source) {
	var halfSize    = N >>> 1,
		nm1         = N - 1,
		i = 1, r = 0, h

	dest[0] = source[0]

	do {
		r += halfSize
		dest[i] = source[r]
		dest[r] = source[i]

		i++

		h = halfSize << 1

		while (h = h >> 1, !((r ^= h) & h)) {}

		if (r >= i) {
			dest[i]     = source[r]
			dest[r]     = source[i]

			dest[nm1-i] = source[nm1-r]
			dest[nm1-r] = source[nm1-i]
		}
		i++
	} while (i < halfSize)

	dest[nm1] = source[nm1]
}
