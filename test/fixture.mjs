import dsp from 'dsp.js'
import sin from 'audio-oscillator/sin'

var N = 4096/4;
var real = new Float32Array(N);
var imag = new Float32Array(N);

for (var i = 0; i < N; i++) {
	real[i] = Math.sin(4000 * (i / N) / (Math.PI * 2) );
	imag[i] = 0;
}

export { real, imag }


//FFT transform
var fft = new dsp.FFT(N, 44100);
fft.forward(real);

export const mags = fft.spectrum
