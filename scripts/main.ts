function callback(canvas, gl, shaders) {
    render(gl, shaders);
}

function main() {
    initCanvas(callback)
}

window.onload = main;