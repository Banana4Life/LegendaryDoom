class Game {
    controls: Controls
    renderer: Renderer
    audio: AudioManager
    doomGame: DoomGame
    paused: boolean


    constructor(gameData: DoomGame) {
        this.controls = new Controls()
        this.renderer = new Renderer()
        this.audio = new AudioManager(this)
        this.doomGame = gameData
        this.paused = false
    }

    update(dt) {
        this.update0(dt)
        this.renderer.render(dt)
        return true
    }

    togglePause() {
        this.audio.toggleMusic()
        this.paused = !this.paused
        console.log("Paused? " + this.paused)
        document.querySelectorAll(".paused").forEach(e => {
            if (this.paused) {
                e.classList.add("is-paused")
                this.audio.play(Sound.STOP)
            } else {
                e.classList.remove("is-paused")
                this.audio.play(Sound.START)
            }
        })
    }

    updateLoop(root, pt: number) {
        let self = this
        root.requestAnimationFrame(t => {
            let dt = 0
            if (!self.paused) {
                if (pt !== 0) {
                    dt = (t - pt) / 1000
                }
            }
            if (self.update(dt) === false) {
                return
            }
            self.updateLoop(root, t)
        })
    }

    init(): Promise<void> {
        this.controls.init(0, 0)
        this.controls.keys.SPACEBAR.addCallback(this.togglePause)
        this.controls.keys.M.addCallback(() => this.audio.toggleMusic(true))


        return this.renderer.initRenderer()
            .then(this.startLoop.bind(this))
    }

    private update0(dt) {
        this.audio.update(dt)
        if (this.paused) {
            return
        }

        // TODO actual game logic
        if (this.controls.buttonPressed(this.controls.buttons.LEFT)) {
            // game.audio.play(Sound.PISTOL, 0.2)
            this.audio.play(Sound.PLASMA, 0.2, true)
        }
        if (this.controls.buttonPressed(this.controls.buttons.MIDDLE)) {
            this.audio.playWadSound("OOF", 0.2)
        }
        if (this.controls.keyPressed(this.controls.keys.MOVE_FORWARD)) {
            document.querySelector("h3").textContent = "You are getting closer too DOOM!"
            // game.audio.play(Sound.SHOT)
            this.audio.playWadSound("PUNCH", 0.2)

        } else {
            document.querySelector("h3").textContent = "DOOM awaits you!"
        }

    }

    private startLoop() {
        this.renderer.loadMap(this.doomGame.maps[0])

        this.paused = false
        this.updateLoop(window, 0)
    }

}
