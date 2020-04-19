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

    t = 0

    update(dt) {
        this.t += dt
    }

    playWadSound(sound: string, volume: number = 1) {
        this.play(`WAD:${sound}`, volume)
    }

    play(sound: Sound | string, volume: number = 1, now: boolean = false) {
        if (!this.audioContext) {
            this.audioContext = new AudioContext()
        }
        if (!this.audioCache[sound]) {
            this.audioCache[sound] = this.newAudio(sound)
        }
        let audio = this.audioCache[sound]
        if (audio instanceof WadAudio) {
            if (now || audio.paused || audio.ended) {
                audio.play(this.t, this.audioContext, volume)
            }
        } else if (audio instanceof Audio) {
            if (now || audio.paused || audio.ended) {
                audio.volume = volume
                audio.play()
            }
        } else {
            console.log("Missing Sound " + sound)
        }
    }

    newAudio(sound: Sound | string) {
        if (sound.startsWith("WAD:")) {
            if (game.doomGame) {
                return this.getWadSound(sound.substr(4))
            }
        } else {
            return new Audio(sound)
        }
    }

    private getWadSound(name: string) {
        let ds = game.doomGame.getSound(name)
        let samples: Float32Array = new Float32Array(ds.samples.length)
        ds.samples.forEach((value, idx, arr) => samples[idx] = ((value / 256) - 0.5) * 2)
        let audioBuffer = this.audioContext.createBuffer(1, samples.length, ds.sampleRate)
        audioBuffer.getChannelData(0).set(samples)
        // TODO cooldown values?
        return new WadAudio(audioBuffer, 0.15)
    }

    // @ts-ignore
    soundfont = Soundfont

    playing = false
    playMusic() {
        if (this.playing) {
            return
        }
        this.playing = true;

        let ac = new AudioContext()
        let map = this.getMusic()
        this.soundfont.instrument(ac, 'acoustic_grand_piano', {}).then(function (piano) {
            piano.schedule(0, map)
            piano.stop(map[map.length-1][0]+1)
            // piano.on('stop', () => {
            //     console.log("stopped")
            //     this["playing"] = false
            // });
        })
    }

    private getMusic() {
        let map = []
        let delta = 0.05
        map.push([delta*0, 'C4'])
        map.push([delta*1, 'D4'])
        map.push([delta*2, 'E4'])
        map.push([delta*3, 'F4'])
        map.push([delta*4, 'G4'])
        map.push([delta*5, 'A4'])
        map.push([delta*6, 'B4'])
        map.push([delta*7, 'C5'])
        return map
    }
}

class WadAudio {
    buffer: AudioBuffer
    ended = false
    paused = true
    startTime = 0
    cooldown

    constructor(buffer: AudioBuffer, cooldown) {
        this.buffer = buffer
        this.cooldown = cooldown
    }

    play(startTime: number, audioContext: AudioContext, volume: number = 1) {
        if (this.cooldown !== -1 && startTime - this.startTime <= this.cooldown) {
            return
        }
        this.startTime = startTime

        let gain = audioContext.createGain()
        gain.gain.value = volume
        gain.connect(audioContext.destination)

        let bufferSource = audioContext.createBufferSource()
        bufferSource.buffer = this.buffer
        bufferSource.connect(gain)
        bufferSource.onended = () => {
            this.ended = true
        }
        this.ended = false
        this.paused = false
        bufferSource.start()
    }

    setEnded() {
        this.ended = true
    }


}