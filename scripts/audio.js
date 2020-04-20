var Sound;
(function (Sound) {
    Sound["SHOT"] = "external/shot.wav";
    Sound["PISTOL"] = "WAD:PISTOL";
    Sound["PLASMA"] = "WAD:PLASMA";
    Sound["START"] = "WAD:PSTART";
    Sound["STOP"] = "WAD:PSTOP";
})(Sound || (Sound = {}));
var AudioManager = /** @class */ (function () {
    function AudioManager(gameData) {
        this.mutedSounds = false;
        this.musicCache = {};
        this.midiInitialized = false;
        this.paused = false;
        this.instrumentSet = new Set();
        this.gameData = gameData;
        this.muted = false;
        this.audioCache = {};
        this.t = 0;
    }
    AudioManager.prototype.update = function (dt) {
        this.t += dt;
    };
    AudioManager.prototype.playWadSound = function (sound, volume) {
        if (volume === void 0) { volume = 1; }
        this.play("WAD:" + sound, volume);
    };
    AudioManager.prototype.play = function (sound, volume, now) {
        if (volume === void 0) { volume = 1; }
        if (now === void 0) { now = false; }
        if (this.mutedSounds) {
            return;
        }
        if (!this.audioContext) {
            this.audioContext = new AudioContext();
        }
        if (!this.audioCache[sound]) {
            this.audioCache[sound] = this.newAudio(sound);
        }
        var audio = this.audioCache[sound];
        if (audio instanceof WADAudio) {
            if (now || audio.paused || audio.ended) {
                audio.play(this.t, this.audioContext, volume);
            }
        }
        else if (audio instanceof Audio) {
            if (now || audio.paused || audio.ended) {
                audio.volume = volume;
                audio.play();
            }
        }
        else {
            console.log("Missing Sound " + sound);
        }
    };
    AudioManager.prototype.newAudio = function (sound) {
        if (sound.startsWith("WAD:")) {
            return this.getWadSound(sound.substr(4));
        }
        else {
            return new Audio(sound);
        }
    };
    AudioManager.prototype.getWadSound = function (name) {
        var ds = this.gameData.getSound(name);
        var samples = new Float32Array(ds.samples.length);
        for (var i = 0; i < ds.samples.length; ++i) {
            samples[i] = ((ds.samples[i] / 256) - 0.5) * 2;
        }
        var audioBuffer = this.audioContext.createBuffer(1, samples.length, ds.sampleRate);
        audioBuffer.getChannelData(0).set(samples);
        // TODO cooldown values?
        return new WADAudio(audioBuffer, 0.15);
    };
    AudioManager.prototype.toggleSounds = function () {
        this.mutedSounds = !this.mutedSounds;
        if (this.mutedSounds) {
            logToGameConsole("Sound muted");
        }
        else {
            logToGameConsole("Sound unmuted");
        }
    };
    AudioManager.prototype.toggleMusic = function (mute) {
        if (mute === void 0) { mute = false; }
        if (this.playing) {
            if (mute) {
                this.muted = !this.muted;
                if (this.muted) {
                    logToGameConsole("Music muted");
                }
                else {
                    logToGameConsole("Music unmuted");
                }
            }
            this.paused = !this.paused;
            if (this.paused || this.muted) {
                // @ts-ignore
                MIDI.Player.pause();
            }
            else {
                // @ts-ignore
                MIDI.Player.resume();
            }
        }
    };
    AudioManager.prototype.cacheMusic = function () {
        var _this = this;
        return Promise.all([
            this.cacheMusic0('D_E1M1'),
            this.cacheMusic0('D_E1M2'),
            this.cacheMusic0('D_E1M3'),
            this.cacheMusic0('D_E1M4'),
            this.cacheMusic0('D_E1M5'),
            this.cacheMusic0('D_E1M6'),
            this.cacheMusic0('D_E1M7'),
            this.cacheMusic0('D_E1M8'),
            this.cacheMusic0('D_E1M9'),
            this.cacheMusic0('D_INTER'),
            this.cacheMusic0('D_INTRO'),
            this.cacheMusic0('D_VICTOR'),
            this.cacheMusic0('D_INTROA')
        ]).then(function () { return console.log("SET:" + Array.from(_this.instrumentSet.values())); });
    };
    AudioManager.prototype.cacheMusic0 = function (name) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            if (!_this.musicCache[name]) {
                _this.musicCache[name] = _this.getMidiFromMus(name);
            }
            var cached = _this.musicCache[name];
            for (var cachedElementKey in cached['instruments']) {
                _this.instrumentSet.add(cached['instruments'][cachedElementKey]);
            }
            if (cached) {
                resolve(cached);
            }
            else {
                reject();
            }
        });
    };
    AudioManager.prototype.playMusic = function (name, volume) {
        var _this = this;
        if (volume === void 0) { volume = 0.2; }
        if (this.playing && this.playing === name) {
            return;
        }
        this.cacheMusic0(name).then(function (midiFile) {
            _this.playing = name;
            _this.midiInitialized = false;
            // @ts-ignore
            MIDI.Player.playMidiFile(midiFile, volume, function () {
                logToGameConsole("Now playing " + name);
                // with ${midiFile['instruments']}
                _this.midiInitialized = true;
            });
            // @ts-ignore
            MIDI.Player.setListener(function (data) {
                if (data.now >= data.end) {
                    _this.playing = undefined;
                    // @ts-ignore
                    MIDI.Player.setListener(undefined);
                    // console.log("MIDI Song finished")
                }
            });
        });
    };
    AudioManager.prototype.getMidiFromMus = function (name) {
        var music = this.gameData.getMusic(name);
        var midiBinary = mus2midi(music.data.buffer, name);
        // console.log(btoa(new Uint8Array(midiBinary).reduce((data, byte) => data + String.fromCharCode(byte), '')))
        if (midiBinary !== false) {
            return MidiFile(new Uint8Array(midiBinary));
        }
        return undefined;
    };
    return AudioManager;
}());
var WADAudio = /** @class */ (function () {
    function WADAudio(buffer, cooldown) {
        this.ended = false;
        this.paused = true;
        this.startTime = 0;
        this.buffer = buffer;
        this.cooldown = cooldown;
    }
    WADAudio.prototype.play = function (startTime, audioContext, volume) {
        var _this = this;
        if (volume === void 0) { volume = 1; }
        if (this.cooldown !== -1 && startTime - this.startTime <= this.cooldown) {
            return;
        }
        this.startTime = startTime;
        var gain = audioContext.createGain();
        gain.gain.value = volume;
        gain.connect(audioContext.destination);
        var bufferSource = audioContext.createBufferSource();
        bufferSource.buffer = this.buffer;
        bufferSource.connect(gain);
        bufferSource.onended = function () {
            _this.ended = true;
        };
        this.ended = false;
        this.paused = false;
        bufferSource.start();
    };
    WADAudio.prototype.setEnded = function () {
        this.ended = true;
    };
    return WADAudio;
}());
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXVkaW8uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJhdWRpby50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxJQUFLLEtBTUo7QUFORCxXQUFLLEtBQUs7SUFDTixtQ0FBMEIsQ0FBQTtJQUMxQiw4QkFBcUIsQ0FBQTtJQUNyQiw4QkFBcUIsQ0FBQTtJQUNyQiw2QkFBb0IsQ0FBQTtJQUNwQiwyQkFBa0IsQ0FBQTtBQUN0QixDQUFDLEVBTkksS0FBSyxLQUFMLEtBQUssUUFNVDtBQUVEO0lBU0ksc0JBQVksUUFBa0I7UUFMOUIsZ0JBQVcsR0FBWSxLQUFLLENBQUM7UUFpRTdCLGVBQVUsR0FBRyxFQUFFLENBQUE7UUFHZixvQkFBZSxHQUFHLEtBQUssQ0FBQTtRQUN2QixXQUFNLEdBQUcsS0FBSyxDQUFBO1FBbURkLGtCQUFhLEdBQUcsSUFBSSxHQUFHLEVBQUUsQ0FBQTtRQWxIckIsSUFBSSxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUM7UUFDekIsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUE7UUFDbEIsSUFBSSxDQUFDLFVBQVUsR0FBRyxFQUFFLENBQUE7UUFDcEIsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUE7SUFDZCxDQUFDO0lBRUQsNkJBQU0sR0FBTixVQUFPLEVBQUU7UUFDTCxJQUFJLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQTtJQUNoQixDQUFDO0lBRUQsbUNBQVksR0FBWixVQUFhLEtBQWEsRUFBRSxNQUFrQjtRQUFsQix1QkFBQSxFQUFBLFVBQWtCO1FBQzFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBTyxLQUFPLEVBQUUsTUFBTSxDQUFDLENBQUE7SUFDckMsQ0FBQztJQUVELDJCQUFJLEdBQUosVUFBSyxLQUFxQixFQUFFLE1BQWtCLEVBQUUsR0FBb0I7UUFBeEMsdUJBQUEsRUFBQSxVQUFrQjtRQUFFLG9CQUFBLEVBQUEsV0FBb0I7UUFDaEUsSUFBSSxJQUFJLENBQUMsV0FBVyxFQUFFO1lBQ2xCLE9B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