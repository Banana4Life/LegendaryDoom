enum Sound {
    SHOT = "external/shot.wav",
    PISTOL = "WAD:PISTOL",
    PLASMA = "WAD:PLASMA",
    START = "WAD:PSTART",
    STOP = "WAD:PSTOP",
}

class AudioManager {

    audioContext: AudioContext
    muted: boolean
    audioCache
    t: number
    private gameData: DoomGame;

    constructor(gameData: DoomGame) {
        this.gameData = gameData;
        this.muted = false
        this.audioCache = {}
        this.t = 0
    }

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
        if (audio instanceof WADAudio) {
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

    newAudio(sound: Sound | string): WADAudio | HTMLAudioElement {
        if (sound.startsWith("WAD:")) {
            return this.getWadSound(sound.substr(4))
        } else {
            return new Audio(sound)
        }
    }

    private getWadSound(name: string): WADAudio {
        let ds = this.gameData.getSound(name)
        let samples: Float32Array = new Float32Array(ds.samples.length)
        for (let i = 0; i < ds.samples.length; ++i) {
            samples[i] = ((ds.samples[i] / 256) - 0.5) * 2
        }
        let audioBuffer = this.audioContext.createBuffer(1, samples.length, ds.sampleRate)
        audioBuffer.getChannelData(0).set(samples)
        // TODO cooldown values?
        return new WADAudio(audioBuffer, 0.15)
    }

    musicCache = {}

    playing
    midiInitialized = false
    paused = false

    toggleMusic(mute = false) {
        if (this.playing) {
            if (mute) {
                this.muted = !this.muted
            }
            this.paused = !this.paused
            if (this.paused || this.muted) {
                // @ts-ignore
                MIDI.Player.pause()
                console.log("paused music")
            } else {
                // @ts-ignore
                MIDI.Player.resume()
                console.log("resumed music")
            }
        }
    }

    playMusic(name, volume = 0.2) {
        console.log("Playing" + this.playing)
        console.log("Play" + name)
        if (this.playing && this.playing === name) {
            return
        }

        if (!this.musicCache[name]) {
            this.musicCache[name] = this.getMidiFromMus(name)
        }

        let midiFile = this.musicCache[name]
        if (midiFile) {
            this.playing = name
            this.midiInitialized = false
            console.log("Start playing Midi " + name + " with " + midiFile['instruments'])
            // @ts-ignore
            MIDI.Player.playMidiFile(midiFile, volume, () => {
                this.midiInitialized = true
            })
            // @ts-ignore
            MIDI.Player.setListener(data => {
                if (data.now >= data.end) {
                    this.playing = undefined
                    console.log("MIDI Song finished")
                }
            })

        }
    }

    getMidiFromMus(name) {
        let music = this.gameData.getMusic(name)
        let midiBinary = mus2midi(music.data.buffer)
        if (midiBinary !== false) {
            return MidiFile(new Uint8Array(midiBinary))
        }
        return undefined
    }


}

class WADAudio {
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