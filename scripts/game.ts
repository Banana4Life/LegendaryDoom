class Game {
    controls: Controls
    renderer: Renderer
    audio: AudioManager
    doomGame: DoomGame
    paused: boolean
    private readonly cameraTransform: Transform
    private cameraPitch: number
    private cameraYaw: number


    constructor(gameData: DoomGame) {
        this.cameraTransform = new Transform()
        this.cameraPitch = 0
        this.cameraYaw = 0

        this.controls = new Controls()
        this.renderer = new Renderer(this.cameraTransform)
        this.audio = new AudioManager(gameData)
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
        if (this.paused) {
            logToGameConsole("Game paused!")
        } else {
            logToGameConsole("Game resumed!")
        }
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
        this.controls.keys.SPACEBAR.addCallback(this.togglePause.bind(this))
        this.controls.keys.MUTE_MUSIC.addCallback(() => this.audio.toggleMusic(true))
        this.controls.keys.MUTE_SOUND.addCallback( () => this.audio.toggleSounds())

        let playerThing = this.doomGame.maps[0].things[0]
        this.cameraTransform.setPosition(-playerThing.y, -41, -playerThing.x)
        this.cameraYaw = deg2rad(playerThing.angle)

        return this.renderer.initRenderer()
            .then(this.startLoop.bind(this))
    }

    getHeight(x,y) {
        let map = this.doomGame.maps[0]
        return map.getSectorAt(x,y).floorHeight
    }

    private update0(dt) {
        this.audio.update(dt)
        if (this.paused) {
            return
        }

        let speed = 500
        let dx = 0
        let dy = 0
        let dz = 0
        if (this.controls.keyPressed(this.controls.keys.MOVE_FORWARD)) {
            dz += speed
        }
        if (this.controls.keyPressed(this.controls.keys.MOVE_BACKWARD)) {
            dz += -speed
        }
        if (this.controls.keyPressed(this.controls.keys.MOVE_LEFT)) {
            dx += speed
        }
        if (this.controls.keyPressed(this.controls.keys.MOVE_RIGHT)) {
            dx += -speed
        }
        if (this.controls.keyPressed(this.controls.keys.MOVE_UP)) {
            dy += -speed
        }
        if (this.controls.keyPressed(this.controls.keys.MOVE_DOWN)) {
            dy += speed
        }

        let [dyaw, dpitch] = this.controls.getMouseChange()


        // this.cameraPitch += deg2rad(this.multi * 90 * dt) // Bob
        this.cameraPitch += deg2rad(dpitch * dt * 2)
        this.cameraYaw += deg2rad(dyaw * dt * 2)
        if (this.cameraPitch < deg2rad(-45)) {
            this.cameraPitch = deg2rad(-45)
        }if (this.cameraPitch > deg2rad(45)) {
            this.cameraPitch = deg2rad(45)
        }

        this.cameraTransform.moveForward(dx * dt, dy * dt, dz * dt)
        this.cameraTransform.setEulerAngles(0, this.cameraPitch, this.cameraYaw)

        let [x,y,z] = this.cameraTransform.getPosition()

        let targetHeight = this.getHeight(-z, -x)
        this.cameraTransform.moveForward(0,(-targetHeight - y -41) * dt * 20,0)

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
        this.renderer.loadColorMaps(this.doomGame.colorMaps)
        this.renderer.loadPalettes(this.doomGame.colorPalettes)
        this.renderer.loadTextures(this.doomGame.textures.textures)
        this.renderer.loadMap(this.doomGame.maps[0])
        this.loadThings()

        this.paused = false
        this.updateLoop(window, 0)
    }

    private loadThings() {
        for (const thing of this.doomGame.maps[0].things) {
            let transform = new Transform()
            transform.setPosition(-thing.y, -this.getHeight(thing.x, thing.y), -thing.x)
            transform.setEulerAngles(0, 0, deg2rad(thing.angle))
            this.renderer.addThing(transform)
        }
    }
}
