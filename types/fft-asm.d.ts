export = FftModule;
declare function FftModule(sz: any, asm: any): void;
declare class FftModule {
    constructor(sz: any, asm: any);
    sz: any;
    bufsz: number;
    heap: ArrayBuffer;
    foreign: ArrayBuffer;
    flt64: Float64Array;
    fftasm: {
        setup: (n: any) => void;
        fft: (normalize: any) => void;
        mag: () => void;
    };
    bitrev: any[];
    fft: (real: any, imag: any, normalize: any, asm: any) => void;
    fftmag: (real: any, imag: any) => void;
}
