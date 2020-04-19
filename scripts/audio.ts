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

    musicCache = {}

    playing = false
    playMusic(name) {
        name = "D_E1M1"
        if (this.playing) {
            return
        }

        if (!this.musicCache[name]) {
            this.musicCache[name] = this.getMidiFromMus(name)
        }

        let midiFile = this.musicCache[name]
        if (midiFile) {
            console.log("Start Midi...")
            // @ts-ignore
            MIDI.Player.playMidiFile(midiFile)
            // @ts-ignore
            MIDI.Player.setListener(data => {
                if (data.now >= data.end) {
                    this.playing = false;
                    console.log("MIDI Song finished");
                    this.playMusic(name)
                }
            })
            this.playing = true;
        }
    }

    getMidiFromMus(name) {
        let music = game.doomGame.getMusic(name)
        let midiBinary = mus2midi(music.data.buffer)
        if (midiBinary !== false) {
            return MidiFile(new Uint8Array(midiBinary))
        }
        return undefined;
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