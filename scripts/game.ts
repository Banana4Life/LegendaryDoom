class Game {
    controls = new Controls()
    renderer = new Renderer()
    audio = new AudioManager()
    doomGame: DoomGame
    paused = false

    update(dt) {
        this.update0(dt)
        this.renderer.render(dt)
        return true
    }

    togglePause() {
        game.audio.toggleMusic()
        game.paused = !game.paused
        console.log("Paused? " + game.paused)
        document.querySelectorAll(".paused").forEach(e => {
            if (game.paused) {
                e.classList.add("is-paused")
                game.audio.play(Sound.STOP)
            } else {
                e.classList.remove("is-paused")
                game.audio.play(Sound.START)
            }
        })
    }

    updateLoop(root, pt: number) {
        root.requestAnimationFrame(t => {
            let dt = 0
            if (!game.paused) {
                if (pt !== 0) {
                    dt = (t - pt) / 1000
                }
            }
            if (game.update(dt) === false) {
                return
            }
            game.updateLoop(root, t)
        })
    }

    init() {
        this.controls.init(0, 0)
        this.controls.keys.SPACEBAR.addCallback(this.togglePause)
        this.controls.keys.M.addCallback(() => this.audio.toggleMusic(true))

        // Load from external/doom.wad if possible
        let dataPromise = fetch("external/doom.wad").then(res => res.blob())
            .then(blob => new File([blob], "doom.wad", {type: WAD.FileMimeType}))
            .then(file => parseWad(file))
            .then(wad => DoomGame.parse(wad)).then(doomGame => this.doomGame = doomGame)
            .then(() => this.audio.playMusic("D_INTER"))
        let rendererPromise = this.renderer.initRenderer()
        Promise.all([dataPromise, rendererPromise]).then(this.startLoop)
    }

    private update0(dt) {
        game.audio.update(dt)
        if (this.paused) {
            return
        }

        // TODO actual game logic
        if (this.controls.buttonPressed(this.controls.buttons.LEFT)) {
            // game.audio.play(Sound.PISTOL, 0.2)
            game.audio.play(Sound.PLASMA, 0.2, true)
        }
        if (this.controls.buttonPressed(this.controls.buttons.MIDDLE)) {
            game.audio.playWadSound("OOF", 0.2)
        }
        if (this.controls.keyPressed(this.controls.keys.MOVE_FORWARD)) {
            document.querySelector("h3").textContent = "You are getting closer too DOOM!"
            // game.audio.play(Sound.SHOT)
            game.audio.playWadSound("PUNCH", 0.2)

        } else {
            document.querySelector("h3").textContent = "DOOM awaits you!"
        }

    }

    private startLoop() {
        game.renderer.loadMap(game.doomGame.maps[0])

        this.paused = false
        game.updateLoop(window, 0)
    }

}

let game = new Game()
