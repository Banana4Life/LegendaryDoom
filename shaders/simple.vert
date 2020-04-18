attribute vec4 vertexPosition;
attribute vec2 textureCoord;

uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;

varying highp vec2 vTextureCoord;

void main() {
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vertexPosition;
    vTextureCoord = textureCoord;
}