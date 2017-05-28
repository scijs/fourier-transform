/* eslint-disable semi */
/**
* Comparison of various FT methods.
*/

module.exports = function (setup, run) {
  var N = 4096;
  var real = new Float32Array(N);
  var im = new Float32Array(N);
  var rate = 44100;

  for (var i = 0; i < N; i++) {
    real[i] = Math.random() * 2 - 0.5;
    im[i] = Math.random() * 2 - 0.5;
  }

  setup('fourier-transform', function () {
    var ft = require('../');
    run('fft', function () {
      ft(real);
    });
  });

  setup('fili', function () {
    var Fili = require('fili');
    var fft = new Fili.Fft(N);

    run('fft', function () {
      fft.forward(real, 'hanning');
    }, 100);
  });

  //TODO: does not compile
  setup('dsp');

  setup('ml-fft', function () {
    var lib = require('ml-fft');
    var FFT = lib.FFT;

    FFT.init(N);

    run('fft', function () {
      FFT.fft(real, im);
    });
  });

  // does not compile
  setup.skip('kissfft');

  // does not compile
  setup.skip('node-fft');

  setup('ndarray-fft', function () {
    var fft = require('ndarray-fft');
    var ndarray = require('ndarray');
    var x = ndarray(real);
    var y = ndarray(im);
    run('fft', function () {
      fft(1, x, y);
    });
  });

  setup('fft', function () {
    var FFT = require('fft');
    var fft = new FFT.complex(N, false);
    var out = new Float32Array(real);
    run('fft', function () {
      fft.simple(out, real, 'real');
    }, 10);
  });

  setup('dsp-fft', function () {
    var fft = require('dsp-fft').fft;
    run('fft', function () {
      fft(real);
    }, 100);
  });

  if (typeof document !== 'undefined') {
    run('webgl dft', function () {
      var dft = require('./dft')(N, real);
      run('dft', function () {
        dft();
      }, 10);
    });
  }

  setup('dsp.js', function () {
    var dsp = require('dsp.js');

    var fft = new dsp.FFT(N, rate);
    run('fft', function () {
      fft.forward(real);
      fft.spectrum;
    });

    var rfft = new dsp.RFFT(N, rate);
    run('rfft', function () {
      rfft.forward(real);
      rfft.spectrum;
    });

    var dft = new dsp.DFT(N, rate);
    run('dft', function () {
      dft.forward(real);
      dft.spectrum;
    }, 100);
  });

  setup.skip('dspjs', function () {
    var dsp = require('dspjs');
    console.log(dsp)
  });

  setup('digitalsignals', function () {
    var dsp = require('digitalsignals');

    var fft = new dsp.FFT(N, rate);
    run('fft', function () {
      fft.forward(real);
      fft.spectrum;
    });

    var rfft = new dsp.RFFT(N, rate);
    run('rfft', function () {
      rfft.forward(real);
      rfft.spectrum;
    });

    var dft = new dsp.DFT(N, rate);
    run('dft', function () {
      dft.forward(real);
      dft.spectrum;
    }, 100);
  });

  setup('fft-js', function () {
    var fftjs = require('fft-js');

    var fft = fftjs.fft;
    run('fft 100 ×', function () {
      fft(real);
    }, 100);

    var fftInPlace = fftjs.fftInPlace;
    run('fft-in-place', function () {
      fftInPlace(real);
    }, 100);

    var dft = fftjs.dft;
    run.skip('dft', function () {
      dft(real);
    });
  });

  setup('aureooms-js-fft', function () {
    var fft = require('aureooms-js-fft');
    var array = require('aureooms-js-array');
    var random = require('aureooms-js-random');
    var number = require('aureooms-js-number');
    var complex = require('aureooms-js-complex');

    var kernel = complex.cartesian.kernel.compile(number, 'i');
    var cartesian = complex.cartesian.array.compile(kernel);

    var $ = fft.compile(cartesian);
    var _ = cartesian.complex;

    var n = N; // Math.pow(2, 10) | 0 ;
    var l = Math.log2(n) | 0;
    var m = n >>> 1;

    var u = array.alloc(n);
    var v = array.alloc(n);
    var w = array.alloc(n);

    for (var i = 0; i < n; ++i) {
      u[i] = _(random.randfloat(-1000, 1000), random.randfloat(-1000, 1000));
    }

    array.copy(u, 0, n, w, 0);

    run('run', function () {
      $.fft(l, m, u, 0, n, v, 0, n);
    }, 10);
  });

  var STFT = require('stft');
  setup('stft', function () {
    var stft = STFT(1, N, function () {});
    run('fft', function () {
      stft(real);
    });
  });

  setup('frequencyjs', function () {
    var fjs = require('frequencyjs');

    run('dft', function () {
      fjs.Transform.toSpectrum(real, {sampling: N, method: 'dft'});
    });

    run('fft', function () {
      fjs.Transform.toSpectrum(real, {method: 'fft'});
    });
  });

  setup('fourier', function () {
    var fourier = require('fourier');
    var fourierFFTRun = fourier.fft();
    run('fft', function () {
      fourierFFTRun(real, im);
    });

    var fourierDFTRun = fourier.dft;
    run('dft', function () {
      fourierDFTRun(real, im);
    }, 1000);

    var fourierFFTDitRadix2Run = fourier.fftDitRadix2();
    run('ditRadix2', function () {
      fourierFFTDitRadix2Run(real, im);
    });

    var fourierFFTDitRadix2SimpleRun = fourier.fftDitRadix2Simple;
    run('ditRadix2simple', function () {
      fourierFFTDitRadix2SimpleRun(real, im);
    });

    // some tough guys
    var stdlib = {
      Math: Math,
      Float64Array: Float64Array,
      Float32Array: Float32Array
    };
    var refReal = new Float32Array(N);
    var refImag = new Float32Array(N);
    var _real = new Float32Array(N);
    var _imag = new Float32Array(N);

    for (i = 0; i < N; i++) {
      _real[i] = refReal[i] = real[i];
      _imag[i] = refImag[i] = im[i];
    }

    var heap = fourier.custom.alloc(N, 3);

    var raw = fourier.custom['fft_f32_' + N + '_raw'](stdlib, null, heap);
    raw.init();

    run('fft-32-raw', function () {
      fourier.custom.array2heap(_real, new Float32Array(heap), N, 0);
      fourier.custom.array2heap(_imag, new Float32Array(heap), N, N);
      raw.transform();
      fourier.custom.heap2array(new Float32Array(heap), _real, N, 0);
      fourier.custom.heap2array(new Float32Array(heap), _imag, N, N);
    });

    var asm = fourier.custom['fft_f32_' + N + '_asm'](stdlib, null, heap);
    asm.init();

    run('fft-32-asm', function () {
      fourier.custom.array2heap(_real, new Float32Array(heap), N, 0);
      fourier.custom.array2heap(_imag, new Float32Array(heap), N, N);
      asm.transform();
      fourier.custom.heap2array(new Float32Array(heap), _real, N, 0);
      fourier.custom.heap2array(new Float32Array(heap), _imag, N, N);
    });
  });

  setup('fft-asm', function () {
    var FftModule = require('./../lib/fft-asm')

    var fftasm = new FftModule(N / 2, true);
    var fftnoasm = new FftModule(N / 2, false);

    run('asm run', function () {
      fftasm.fftmag(real, im);
    });

    run('noasm run', function () {
      fftnoasm.fftmag(real, im);
    });
  })
}
