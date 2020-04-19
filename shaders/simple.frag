varying highp vec2 texCoord;
varying highp vec4 texBoundary;
varying highp vec2 texTiling;

uniform sampler2D sampler;

void main() {
    highp float tiledCoordX = mod((texCoord.x - texBoundary.x) * texTiling.x, texBoundary.z) + texBoundary.x;
    highp float tiledCoordY = mod((texCoord.y - texBoundary.y) * texTiling.y, texBoundary.w) + texBoundary.y;
    gl_FragColor = texture2D(sampler, vec2(tiledCoordX, texCoord.y));
}
