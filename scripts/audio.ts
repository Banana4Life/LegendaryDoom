enum Sound {
    SHOT = "external/shot.wav",
    PISTOL = "WAD:PISTOL",
    PLASMA = "WAD:PLASMA",
    START = "WAD:PSTART",
    STOP = "WAD:PSTOP"
}

class AudioManager {

    audioContext: AudioContext

    audioCache = {}

    play(sound: Sound, volume: number = 1) {
        if (!this.audioContext) {
            this.audioContext = new AudioContext();
        }
        if (!this.audioCache[sound]) {
            this.audioCache[sound] = this.newAudio(sound)
        }
        let audio = this.audioCache[sound]
        if (audio instanceof WadAudio) {
            if (audio.paused || audio.ended) {
                audio.play(this.audioContext, volume)
            }
        } else if (audio instanceof Audio) {
            if (audio.paused || audio.ended) {
                audio.volume = volume
                audio.play()
            }
        } else {
            console.log("Missing Sound " + sound)
        }
    }

    newAudio(sound: Sound) {
        if (sound.startsWith("WAD:")) {
            if (game.doomGame) {
                return this.getWadSound(sound.substr(4))
            }
        } else {
            return new Audio(sound);
        }
    }

    private getWadSound(name: string) {
        let ds = game.doomGame.getSound(name)
        let samples: Float32Array = new Float32Array(ds.samples.length);
        ds.samples.forEach((value, idx, arr) => samples[idx] = ((value / 256) - 0.5) * 2)
        let audioBuffer = this.audioContext.createBuffer(1, samples.length, ds.sampleRate);
        audioBuffer.getChannelData(0).set(samples)
        return new WadAudio(audioBuffer);
    }
}

class WadAudio {
    buffer: AudioBuffer
    ended = false;
    paused = true;

    constructor(buffer: AudioBuffer) {
        this.buffer = buffer;
    }

    play(audioContext: AudioContext, volume: number = 1) {
        let gain = audioContext.createGain();
        gain.gain.value = volume;
        gain.connect(audioContext.destination);

        let bufferSource = audioContext.createBufferSource();
        bufferSource.buffer = this.buffer
        bufferSource.connect(gain)
        bufferSource.onended = () => {
            this.ended = true;
        }
        this.ended = false;
        this.paused = false;
        bufferSource.start()
    }

    setEnded() {
        this.ended = true;
    }


}