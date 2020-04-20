#version 300 es

in vec4 vertexPosition;
in vec2 textureCoord;
in float lightLevel;

uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;

out highp vec2 texCoord;
out highp float lightLvl;
out highp float camDistance;

void main() {
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vertexPosition;
    texCoord = textureCoord;
    lightLvl = lightLevel;
    camDistance = gl_Position.z;
}