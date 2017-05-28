/**
 * Real values fourier transform.
 *
 * @module  fourier-transform
 *
 */

'use strict'

module.exports = rfft


var maxLen = 8192
var maxBytes = 65536 // maxLen * Float64Array.BYTES_PER_ELEMENT

var heap = new ArrayBuffer(maxBytes*4)
var input = new Float64Array(heap, maxBytes, maxLen)
var output = new Float64Array(heap, maxBytes*2, maxLen/2)
var _rfft = FFT({Math: Math, Float64Array: Float64Array}, null, heap)

function rfft (src) {
	if (!src) throw Error('Input data is not provided, pass an array.')

	var n = src.length
	if (n > maxLen) throw Error('Input length is too big, must be under ' + maxLen)

	var k = Math.floor(Math.log(n) / Math.LN2)
	if (Math.pow(2, k) !== n) throw Error('Invalid array size, must be a power of 2.')

	input.set(src)

	_rfft(n, k)

	return output.subarray(0, n/2)
}





function FFT(stdlib, foreign, heap) {
	'use asm'

	var TAU = 6.283185307179586
    var sqrt = stdlib.Math.sqrt
    var sin = stdlib.Math.sin
    var cos = stdlib.Math.cos
    var abs = stdlib.Math.abs
    var SQRT1_2 = stdlib.Math.SQRT1_2
    var imul = stdlib.Math.imul

	//memory layout is [x, input, output]
    var arr = new stdlib.Float64Array(heap)
    var x = new stdlib.Float64Array(heap)
	var input = 8192
	var output = 16384

	function rfft (n, k) {
        n = n|0
        k = k|0

		//.forward call
		var i         = 0, j = 0,
			bSi       = 0.0,
			n2 = 0, n4 = 0, n8 = 0, nn = 0,
			t1 = 0.0, t2 = 0.0, t3 = 0.0, t4 = 0.0,
			i1 = 0, i2 = 0, i3 = 0, i4 = 0, i5 = 0, i6 = 0, i7 = 0, i8 = 0,
			st1 = 0.0, cc1 = 0.0, ss1 = 0.0, cc3 = 0.0, ss3 = 0.0,
			e = 0.0,
			a = 0.0,
			rval = 0.0, ival = 0.0, mag = 0.0
        var ix = 0, i0 = 0, id = 0

        i = n >>> 1
        bSi = 2.0 / +(n|0)

		reverseBinPermute(n)

		for (ix = 0, id = 4; (ix|0) < (n|0); id = imul(id, 4)) {
			for (i0 = ix; (i0|0) < (n|0); i0 = i0 + id|0) {
				//sumdiff(x[i0], x[i0+1]) // {a, b}  <--| {a+b, a-b}
				st1 = x[i0 << 3 >> 3] - x[i0+1 << 3 >> 3]
				x[i0 << 3 >> 3] = x[i0 << 3 >> 3] + x[i0+1 << 3 >> 3]
				x[i0+1 << 3 >> 3] = st1
			}
			ix = imul(2, (id-1))
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
				if((n4|0) != 1) {
					for(i0 = ix; (i0|0) < (n|0); i0 = i0 + id|0) {
						i1 = i0
						i2 = i1 + n4|0
						i3 = i2 + n4|0
						i4 = i3 + n4|0

						//diffsum3_r(x[i3], x[i4], t1) // {a, b, s} <--| {a, b-a, a+b}
						t1 = x[i3 << 3 >> 3] + x[i4 << 3 >> 3]
						x[i4 << 3 >> 3] = x[i4 << 3 >> 3] - x[i3 << 3 >> 3]
						//sumdiff3(x[i1], t1, x[i3])   // {a, b, d} <--| {a+b, b, a-b}
						x[i3 << 3 >> 3] = x[i1 << 3 >> 3] - t1
						x[i1 << 3 >> 3] = x[i1 << 3 >> 3] + t1

						i1 = i1 + n8|0
						i2 = i2 + n8|0
						i3 = i3 + n8|0
						i4 = i4 + n8|0

						//sumdiff(x[i3], x[i4], t1, t2) // {s, d}  <--| {a+b, a-b}
						t1 = x[i3 << 3 >> 3] + x[i4 << 3 >> 3]
						t2 = x[i3 << 3 >> 3] - x[i4 << 3 >> 3]

						t1 = -t1 * SQRT1_2
						t2 = t2 * SQRT1_2

						// sumdiff(t1, x[i2], x[i4], x[i3]) // {s, d}  <--| {a+b, a-b}
						st1 = +(x[i2 << 3 >> 3])
						x[i4 << 3 >> 3] = t1 + st1
						x[i3 << 3 >> 3] = t1 - st1

						//sumdiff3(x[i1], t2, x[i2]) // {a, b, d} <--| {a+b, b, a-b}
						x[i2 << 3 >> 3] = x[i1 << 3 >> 3] - t2
						x[i1 << 3 >> 3] = x[i1 << 3 >> 3] + t2
					}
				} else {
					for(i0 = ix; (i0|0) < (n|0); i0 = i0 + id|0) {
						i1 = i0
						i2 = i1 + n4|0
						i3 = i2 + n4|0
						i4 = i3 + n4|0

						//diffsum3_r(x[i3], x[i4], t1) // {a, b, s} <--| {a, b-a, a+b}
						t1 = x[i3 << 3 >> 3] + x[i4 << 3 >> 3]
						x[i4 << 3 >> 3] = x[i4 << 3 >> 3] - x[i3 << 3 >> 3]

						//sumdiff3(x[i1], t1, x[i3])   // {a, b, d} <--| {a+b, b, a-b}
						x[i3 << 3 >> 3] = x[i1 << 3 >> 3] - t1
						x[i1 << 3 >> 3] = x[i1 << 3 >> 3] + t1
					}
				}

				ix = (id << 1) - n2|0
				id = id << 2
			} while ((ix|0) < (n|0))

			e = TAU / +(n2|0)

			for (j = 1; (j|0) < (n8|0); j = j + 1|0) {
				a = +(j|0) * e
				ss1 = sin(a)
				cc1 = cos(a)

				//ss3 = sin(3*a) cc3 = cos(3*a)
				cc3 = 4.0*cc1*(cc1*cc1-0.75)
				ss3 = 4.0*ss1*(0.75-ss1*ss1)

				ix = 0; id = n2 << 1
				do {
					for (i0 = ix; (i0|0) < (n|0); i0 = i0 + id|0) {
						i1 = i0 + j|0
						i2 = i1 + n4|0
						i3 = i2 + n4|0
						i4 = i3 + n4|0

						i5 = i0 + n4 - j|0
						i6 = i5 + n4|0
						i7 = i6 + n4|0
						i8 = i7 + n4|0

						//cmult(c, s, x, y, &u, &v)
						//cmult(cc1, ss1, x[i7], x[i3], t2, t1) // {u,v} <--| {x*c-y*s, x*s+y*c}
						t2 = x[i7 << 3 >> 3]*cc1 - x[i3 << 3 >> 3]*ss1
						t1 = x[i7 << 3 >> 3]*ss1 + x[i3 << 3 >> 3]*cc1

						//cmult(cc3, ss3, x[i8], x[i4], t4, t3)
						t4 = x[i8 << 3 >> 3]*cc3 - x[i4 << 3 >> 3]*ss3
						t3 = x[i8 << 3 >> 3]*ss3 + x[i4 << 3 >> 3]*cc3

						//sumdiff(t2, t4)   // {a, b} <--| {a+b, a-b}
						st1 = t2 - t4
						t2 = t2 + t4
						t4 = st1

						//sumdiff(t2, x[i6], x[i8], x[i3]) // {s, d}  <--| {a+b, a-b}
						//st1 = x[i6] x[i8] = t2 + st1 x[i3] = t2 - st1
						x[i8 << 3 >> 3] = t2 + x[i6 << 3 >> 3]
						x[i3 << 3 >> 3] = t2 - x[i6 << 3 >> 3]

						//sumdiff_r(t1, t3) // {a, b} <--| {a+b, b-a}
						st1 = t3 - t1
						t1 = t1 + t3
						t3 = st1

						//sumdiff(t3, x[i2], x[i4], x[i7]) // {s, d}  <--| {a+b, a-b}
						//st1 = x[i2] x[i4] = t3 + st1 x[i7] = t3 - st1
						x[i4 << 3 >> 3] = t3 + x[i2 << 3 >> 3]
						x[i7 << 3 >> 3] = t3 - x[i2 << 3 >> 3]

						//sumdiff3(x[i1], t1, x[i6])   // {a, b, d} <--| {a+b, b, a-b}
						x[i6 << 3 >> 3] = x[i1 << 3 >> 3] - t1
						x[i1 << 3 >> 3] = x[i1 << 3 >> 3] + t1

						//diffsum3_r(t4, x[i5], x[i2]) // {a, b, s} <--| {a, b-a, a+b}
						x[i2 << 3 >> 3] = t4 + x[i5 << 3 >> 3]
						x[i5 << 3 >> 3] = x[i5 << 3 >> 3] - t4
					}

					ix = (id << 1) - n2|0
					id = id << 2

				} while ((ix|0) < (n|0))
			}
		}

		while (i = i - 1|0) {
			rval = +(x[i << 3 >> 3])
			ival = +(x[n-i-1 << 3 >> 3])
			mag = bSi * sqrt(rval * rval + ival * ival)
			arr[output + i << 3 >> 3] = mag
		}

		arr[output + 0 << 3 >> 3] = abs(bSi * x[0 << 3 >> 3])
	}


	function reverseBinPermute (n) {
        n = n|0

		var halfSize    = 0,
			nm1         = 0,
			i = 1, r = 0, h = 0

		halfSize = n >>> 1
		nm1 = n - 1|0

		x[0 << 3 >> 3] = arr[input + 0 << 3 >> 3]

		do {
			r = r + halfSize|0
			x[i << 3 >> 3] = arr[input + r << 3 >> 3]
			x[r << 3 >> 3] = arr[input + i << 3 >> 3]

			i = i + 1|0

			h = halfSize << 1

			while (h = h >> 1, ((r = r ^ h) & h) == 0) {

			}

			if ((r|0) >= (i|0)) {
				x[i << 3 >> 3]     = arr[input + r << 3 >> 3]
				x[r << 3 >> 3]     = arr[input + i << 3 >> 3]

				x[nm1-i << 3 >> 3] = arr[input + nm1-r << 3 >> 3]
				x[nm1-r << 3 >> 3] = arr[input + nm1-i << 3 >> 3]
			}
			i = i + 1|0
		} while ((i|0) < (halfSize|0))

		x[nm1 << 3 >> 3] = arr[input + nm1 << 3 >> 3]

	}

	return rfft
}
