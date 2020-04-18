enum Sound {
    SHOT = "external/shot.wav"
}

class AudioManager {

    audioCache = {}

    play(sound: Sound) {
        if (!this.audioCache[sound]) {
            this.audioCache[sound] = new Audio(sound)
        }
        let audio = this.audioCache[sound]
        if (audio.paused || audio.ended) {
            audio.play()
        }
    }
}