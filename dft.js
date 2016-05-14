/**
 * DFT with webgl
 */
var createShader = require('gl-shader-output');


module.exports = function (N, real) {
	var gl = document.createElement('canvas').getContext('webgl');

	// var float = gl.getExtension('OES_texture_float');
	// if (!float) throw Error('WebGL does not support floats.');
	// var floatLinear = gl.getExtension('OES_texture_float_linear');
	// if (!floatLinear) throw Error('WebGL does not support floats.');

	var draw = createShader(`
		precision highp float;
		uniform sampler2D real;

		const float N = ${N}.;
		const float rate = 44100.;
		const float pi2 = ${Math.PI*2};
		const float pi = ${Math.PI};

		//phasor/source run state
		float distance;
		float step;

		//accumulated resonance energy for a source
		vec2 energy;

		//base frequency of a phasor
		float frequency;

		//get energy state of a phasor
		vec2 phasor () {
			return vec2(
				cos(pi2 * distance * frequency),
				sin(pi2 * distance * frequency)
			);
		}

		//get energy state of a source
		vec2 source () {
			return vec2(
				texture2D(real, vec2(distance, 0)).w
			);
		}

		void main () {
			energy = vec2(0);
			distance = 0.;
			step = 1./N;
			frequency = 0.5 * gl_FragCoord.x;

			// sum all input values masked by frequency values
			for (float i = 0.; i < N; i++) {
				energy += phasor() * source();
				distance += step;
			}

			gl_FragColor = vec4(vec3(length(energy / N)), 1);
		}
		`, {
		width: N/8,
		height: 1,
		gl: gl,
		float: true
	});


	var texture = createTexture(gl);
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.ALPHA, N, 1, 0, gl.ALPHA, gl.FLOAT, real);

	return function () {
		return draw({
			'real': 0
		});
	};
};



//create texture
function createTexture (gl) {
	var texture = gl.createTexture();

	gl.activeTexture(gl.TEXTURE0);

	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

	return texture;
}