import rfft from '../index.js'

const sizes = [256, 1024, 4096, 16384]
const warmup = 1000
const iterations = 50000

for (const N of sizes) {
	const input = new Float32Array(N)
	for (let i = 0; i < N; i++) input[i] = Math.random() * 2 - 1

	// warmup (also primes twiddle cache)
	for (let i = 0; i < warmup; i++) rfft(input)

	const start = performance.now()
	for (let i = 0; i < iterations; i++) rfft(input)
	const elapsed = performance.now() - start

	const us = (elapsed / iterations * 1000).toFixed(1)
	console.log(`N=${String(N).padStart(5)}  ${us.padStart(6)}µs/call  (${iterations} iters, ${elapsed.toFixed(0)}ms)`)
}
