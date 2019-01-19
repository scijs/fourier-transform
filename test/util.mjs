
export function draw (arr) {
	if (!global.document) return

	let canvas = document.body.appendChild(document.createElement('canvas'));
	let ctx = canvas.getContext('2d')
	canvas.style.cssText = `
	margin: 5px;
	display: block;
	outline: 1px solid rgba(255,240,230,1);
	`

	let w = canvas.width;
	let h = canvas.height;

	ctx.beginPath();
	for (let i = 0, len = arr.length; i < len; i++) {
	  let r = i/len;
	  ctx.lineTo(r*w, h - h*arr[i]);
	}

	ctx.stroke();
	ctx.closePath();
}

export function normalize (arr) {
	var max = -999;
	var min = 999;

	for (var i = 0, l = arr.length; i < l; i++) {
		max = Math.max(arr[i], max);
		min = Math.min(arr[i], min);
	}

	for (var i = 0, l = arr.length; i < l; i++) {
		arr[i] = (arr[i] - min) / (max - min)
	}

	return arr;
}

export function toMag (re, im) {
	return re.map((r, i) => {
		return Math.sqrt(r * r + im[i] * im[i])
	})
}
