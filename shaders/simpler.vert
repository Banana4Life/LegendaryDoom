attribute vec3 coordinates;
attribute vec3 colors;

uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;

varying vec4 pointColor;

void main(void) {
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(coordinates, 1.0);
    pointColor = vec4(colors, 1.0);
}