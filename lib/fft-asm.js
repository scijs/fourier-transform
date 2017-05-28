//see https://github.com/g200kg/Fft-asm.js


module.exports = FftModule;

if (typeof window !== 'undefined') global = window

function FftModule(sz,asm) {
	var i,j,k;
	this.sz=sz;
	this.bufsz=sz*32;
	if(this.bufsz<4096)
		this.bufsz=4096;
	this.heap=new ArrayBuffer(this.bufsz);
	this.foreign=new ArrayBuffer(4096);
	this.flt64=new Float64Array(this.heap);
	if(asm)
		this.fftasm=FftModuleAsm(global,this.foreign,this.heap);
	else
		this.fftasm=FftModuleNoAsm(global,this.foreign,this.heap);
	this.fftasm.setup(sz);
	var t,th=Math.PI;
	for(i=1,j=0;i<sz;i<<=1) {
		t=0.0;
		for(k=0;k<i;++k,j+=2) {
			t+=th;
			this.flt64[sz*2+j]=Math.cos(t);
			this.flt64[sz*2+j+1]=Math.sin(t);
		}
		th*=0.5;
	}
	this.bitrev=new Array(sz);
	this.bitrev[0]=0;
	this.bitrev[sz-1]=sz-1;
	for(j=1,i=0;j<sz-1;++j) {
		for(var k=sz>>1;k>(i^=k);k>>=1)
			;
		this.bitrev[j]=i;
	}
	this.fft=function(real,imag,normalize,asm) {
		var i;
		for(i=0;i<this.sz;++i) {
			this.flt64[this.bitrev[i]]=real[i];
			this.flt64[this.sz+this.bitrev[i]]=imag[i];
		}
		this.fftasm.fft(normalize);
		for(i=0;i<this.sz;++i) {
			real[i]=this.flt64[i];
			imag[i]=this.flt64[this.sz+i];
		}
	}
	this.fftmag=function(real,imag) {
		var i;
		for(i=0;i<this.sz;++i) {
			this.flt64[this.bitrev[i]]=real[i];
			this.flt64[this.sz+this.bitrev[i]]=imag[i];
		}
		this.fftasm.fft(1);
		this.fftasm.mag();
		for(i=0;i<this.sz;++i) {
			real[i]=this.flt64[i];
		}
	}
}



//
//FFT Module without "use asm" for comparison
//
function FftModuleNoAsm(stdlib, foreign, heap) {
	//"use asm";
	var FLOAT64 = new stdlib.Float64Array(heap);
	var sqrt=stdlib.Math.sqrt;
	var sz=0;
	function setup(n) {
		n=n|0;
		sz=n;
	}
	function fft(normalize) {
		normalize=normalize|0;
		var m=0, mh=0, i=0, j=0, k=0;
		var wr=0.0, wi=0.0, xr=0.0, xi=0.0, w=0.0, r=0.0;
		var tcnt=0;
		for(mh=1;(m=mh<<1)<=(sz|0);mh=m) {
			for(i=0;(i|0)<(mh|0);i=(i+1)|0) {
				wr=+FLOAT64[(sz*16+tcnt)>>3];
				wi=+FLOAT64[(sz*16+tcnt+8)>>3];
				tcnt=(tcnt+16)|0;
				for(j=i;(j|0)<(sz|0);j=(j+m)|0) {
					k=(j+mh)|0;
					xr=wr*FLOAT64[k<<3>>3]-wi*FLOAT64[(sz+k)<<3>>3];
					xi=wr*FLOAT64[(sz+k)<<3>>3]+wi*FLOAT64[k<<3>>3];
					FLOAT64[k<<3>>3] = +FLOAT64[j<<3>>3]-xr;
					FLOAT64[(sz+k)<<3>>3] = +FLOAT64[(sz+j)<<3>>3]-xi;
					FLOAT64[j<<3>>3] = +FLOAT64[j<<3>>3] + xr;
					FLOAT64[(sz+j)<<3>>3] = +FLOAT64[(sz+j)<<3>>3] + xi;
				}
			}
		}
		if(normalize) {
			r = +(1.0/+(sz|0));
			for(i=0;(i|0)<(sz|0);i=(i+1)|0) {
				FLOAT64[i<<3>>3]=+FLOAT64[i<<3>>3]*r;
				FLOAT64[(sz+i)<<3>>3]=+FLOAT64[(sz+i)<<3>>3]*r;
			}
		}
	}
	function mag() {
		var i=0,j=0;
		for(i=0;(i|0)<(sz|0);i=(i+1)|0) {
			j=(sz*2-i-1)|0;
			FLOAT64[i<<3>>3]=sqrt(FLOAT64[i<<3>>3]*FLOAT64[i<<3>>3]+FLOAT64[j<<3>>3]*FLOAT64[j<<3>>3]);
		}
	}
	return {
		setup:setup,
		fft:fft,
		mag:mag
	};
}



//
//FFT Module with "use asm"
//
function FftModuleAsm(stdlib, foreign, heap) {
	"use asm";
	var FLOAT64 = new stdlib.Float64Array(heap);
	var sqrt=stdlib.Math.sqrt;
	var sz=0;
	function setup(n) {
		n=n|0;
		sz=n;
	}
	function fft(normalize) {
		normalize=normalize|0;
		var m=0, mh=0, i=0, j=0, k=0;
		var wr=0.0, wi=0.0, xr=0.0, xi=0.0, w=0.0, r=0.0;
		var tcnt=0;
		for(mh=1;(m=mh<<1)<=(sz|0);mh=m) {
			for(i=0;(i|0)<(mh|0);i=(i+1)|0) {
				wr=+FLOAT64[(sz*16+tcnt)>>3];
				wi=+FLOAT64[(sz*16+tcnt+8)>>3];
				tcnt=(tcnt+16)|0;
				for(j=i;(j|0)<(sz|0);j=(j+m)|0) {
					k=(j+mh)|0;
					xr=wr*FLOAT64[k<<3>>3]-wi*FLOAT64[(sz+k)<<3>>3];
					xi=wr*FLOAT64[(sz+k)<<3>>3]+wi*FLOAT64[k<<3>>3];
					FLOAT64[k<<3>>3] = +FLOAT64[j<<3>>3]-xr;
					FLOAT64[(sz+k)<<3>>3] = +FLOAT64[(sz+j)<<3>>3]-xi;
					FLOAT64[j<<3>>3] = +FLOAT64[j<<3>>3] + xr;
					FLOAT64[(sz+j)<<3>>3] = +FLOAT64[(sz+j)<<3>>3] + xi;
				}
			}
		}
		if(normalize) {
			r = +(1.0/+(sz|0));
			for(i=0;(i|0)<(sz|0);i=(i+1)|0) {
				FLOAT64[i<<3>>3]=+FLOAT64[i<<3>>3]*r;
				FLOAT64[(sz+i)<<3>>3]=+FLOAT64[(sz+i)<<3>>3]*r;
			}
		}
	}
	function mag() {
		var i=0,j=0;
		for(i=0;(i|0)<(sz|0);i=(i+1)|0) {
			j=(sz*2-i-1)|0;
			FLOAT64[i<<3>>3]=sqrt(FLOAT64[i<<3>>3]*FLOAT64[i<<3>>3]+FLOAT64[j<<3>>3]*FLOAT64[j<<3>>3]);
		}
	}
	return {
		setup:setup,
		fft:fft,
		mag:mag
	};
}
