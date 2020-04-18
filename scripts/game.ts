class Game {
    controls = new Controls();
    renderer = new Renderer();
    audio = new AudioManager();
    paused = false;

    update(dt) {
        this.update0(dt);
        this.renderer.render(dt);
        return true
    }

    private update0(dt) {
        // TODO actual game logic
        if (this.controls.arePressed(this.controls.keys.MOVE_FORWARD)) {
            document.querySelector("h3").textContent = "You are getting closer too DOOM!";
            // game.audio.play(Sound.SHOT)
            game.audio.play(Sound.WAD_SHOT, 0.2)
        } else {
            document.querySelector("h3").textContent = "DOOM awaits you!";
        }
    }

    togglePause() {
        game.paused = !game.paused;
        console.log("Paused? " + game.paused)
        document.querySelectorAll(".paused").forEach(e => {
            if (game.paused) {
                e.classList.add("is-paused")
            } else {
                e.classList.remove("is-paused")
            }
        })
    }

    updateLoop(root, pt: number) {
        root.requestAnimationFrame(t => {
            let dt = 0;
            if (!game.paused) {
                if (pt !== 0) {
                    dt = (t - pt) / 1000;
                }
            }
            if (game.update(dt) === false) {
                return;
            }
            game.updateLoop(root, t);
        });
    }

    private startLoop() {
        this.paused = false;
        game.updateLoop(window, 0)
    }

    init() {
        this.controls.init(0,0)
        this.controls.keys.SPACEBAR.addCallback(this.togglePause)

        this.renderer.initRenderer().then(this.startLoop)

    }

}

let game = new Game();
