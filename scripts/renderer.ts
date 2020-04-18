function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        let infoLog = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error('An error occurred compiling the shaders: ' + infoLog);
    }

    return shader;
}

function loadShader(gl, baseName, attributes, uniforms) {
    function location(name, type) {
        switch (type) {
            case gl.VERTEX_SHADER:
                return `${name}.vert`;
            case gl.FRAGMENT_SHADER:
                return `${name}.frag`;
            default:
                throw "unknown type";
        }
    }

    function compile(as) {
        return source => compileShader(gl, as, source);
    }

    let vertex = fetch(location(baseName, gl.VERTEX_SHADER))
        .then(response => response.text())
        .then(compile(gl.VERTEX_SHADER));

    let fragment = fetch(location(baseName, gl.FRAGMENT_SHADER))
        .then(response => response.text())
        .then(compile(gl.FRAGMENT_SHADER));

    return Promise.all([vertex, fragment]).then(([vertexShader, fragmentShader]) => {
        const shaderProgram = gl.createProgram();
        gl.attachShader(shaderProgram, vertexShader);
        gl.attachShader(shaderProgram, fragmentShader);
        gl.linkProgram(shaderProgram);

        if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
            let infoLog = gl.getProgramInfoLog(shaderProgram);
            gl.deleteProgram(shaderProgram);
            throw new Error('Unable to initialize the shader program: ' + infoLog);
        }

        let shader = {
            program: shaderProgram,
            attribute: {},
            uniform: {},
        };

        for (let attribute of attributes) {
            shader.attribute[attribute] = gl.getAttribLocation(shaderProgram, attribute);
        }

        for (let uniform of uniforms) {
            shader.uniform[uniform] = gl.getUniformLocation(shaderProgram, uniform);
        }

        return shader;
    });
}

function initCanvas(callback) {
    let canvas = document.querySelector("canvas");
    let gl = canvas.getContext("webgl");

    if (gl == null) {
        alert("Unable to initialize WebGL!");
        return;
    }

    let shaders = [
        loadShader(gl, "shaders/simple", ["vertexPos"], ["projectionMatrix", "modelViewMatrix"])
    ];

    Promise.all(shaders).then(loadedShaders => {
        callback(canvas, gl, loadedShaders);
    }, err => {
        console.error("Error!", err)
    });
}

function render(gl, shaders) {
    window.requestAnimationFrame(t => {
        gl.clearColor((t % 1000) / 1000, 0.0, 0.0, 1.0)
        gl.clear(gl.COLOR_BUFFER_BIT)

        render(gl, shaders)
    })
}