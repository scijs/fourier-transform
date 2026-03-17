import { createRequire } from 'node:module'
import { fft } from '../index.js'

const require = createRequire(import.meta.url)

const N = 4096
const WARMUP = 500
const ITERATIONS = 20000

// Shared input
const input = new Float32Array(N)
for (let i = 0; i < N; i++) input[i] = Math.random() * 2 - 1

// --- Setup each library outside the timed loop ---

// fourier-transform (this package)
const ftRun = () => fft(input)

// fft.js (indutny, radix-4) — widely considered fastest pure-JS FFT
const FFTJS = require('fft.js')
const fftjs = new FFTJS(N)
const fftjsOut = fftjs.createComplexArray()
const fftjsRun = () => fftjs.realTransform(fftjsOut, input)

// ml-fft (in-place, pre-allocated arrays)
const { FFT: MLFFT } = require('ml-fft')
MLFFT.init(N)
const mlRe = new Array(N), mlIm = new Array(N)
const mlfftRun = () => {
	for (let i = 0; i < N; i++) { mlRe[i] = input[i]; mlIm[i] = 0 }
	MLFFT.fft(mlRe, mlIm)
}

// dsp.js (our ancestor, the original split-radix)
const dsp = require('dsp.js')
const dspfft = new dsp.FFT(N, 44100)
const dspRun = () => dspfft.forward(input)

// ndarray-fft
const ndfft = require('ndarray-fft')
const ndarray = require('ndarray')
const ndRe = new Float64Array(N), ndIm = new Float64Array(N)
const ndx = ndarray(ndRe), ndy = ndarray(ndIm)
const ndfftRun = () => {
	for (let i = 0; i < N; i++) { ndRe[i] = input[i]; ndIm[i] = 0 }
	ndfft(1, ndx, ndy)
}

// ooura (port of Ooura's C FFT, radix-4)
const Ooura = require('ooura')
const oo = new Ooura(N, { type: 'real', radix: 4 })
const ooIn = new Float64Array(N)
const ooRe = oo.scalarArrayFactory()
const ooIm = oo.scalarArrayFactory()
const oouraRun = () => {
	for (let i = 0; i < N; i++) ooIn[i] = input[i]
	oo.fft(ooIn.buffer, ooRe.buffer, ooIm.buffer)
}

// kissfft-wasm (WASM KissFFT)
const { rfft: kissRfft } = await import('kissfft-wasm')
const kissInput = new Float64Array(input)
const kissRun = () => kissRfft(kissInput)

// fft-js (naive Cooley-Tukey, educational)
const fftjs2 = require('fft-js')
const fftjs2Input = Array.from(input)
const fftjs2Run = () => fftjs2.fft(fftjs2Input)

// --- Benchmark runner ---

const libs = [
	['fourier-transform', ftRun],
	['fft.js (indutny)', fftjsRun],
	['ml-fft', mlfftRun],
	['dsp.js', dspRun],
	['ndarray-fft', ndfftRun],
	['ooura', oouraRun],
	['kissfft-wasm', kissRun],
	['fft-js', fftjs2Run],
]

console.log(`\nFFT benchmark — N=${N}, ${ITERATIONS} iterations\n`)

const results = []

for (const [name, fn] of libs) {
	// warmup
	for (let i = 0; i < WARMUP; i++) fn()

	const start = performance.now()
	for (let i = 0; i < ITERATIONS; i++) fn()
	const elapsed = performance.now() - start

	const us = elapsed / ITERATIONS * 1000
	results.push({ name, us, elapsed })
}

// Sort by speed
results.sort((a, b) => a.us - b.us)

const fastest = results[0].us
for (const { name, us, elapsed } of results) {
	const ratio = us / fastest
	const bar = '█'.repeat(Math.min(40, Math.round(ratio * 4)))
	console.log(
		`${name.padEnd(22)} ${us.toFixed(1).padStart(7)}µs/call  ${ratio === 1 ? '      ' : ('×' + ratio.toFixed(1)).padStart(6)}  ${bar}`
	)
}
console.log()
