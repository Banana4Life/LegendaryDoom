attribute vec4 vertexPosition;
attribute vec4 vertexColor;

uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;

varying lowp vec4 color;

void main() {
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vertexPosition;
    color = vertexColor;
}