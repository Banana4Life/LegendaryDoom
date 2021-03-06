class Controls {

    keys = {
        MOVE_FORWARD: new ConfigurableKey("KeyW", "ArrowUp"),
        MOVE_BACKWARD: new ConfigurableKey("KeyS", "ArrowDown"),
        MOVE_LEFT: new ConfigurableKey("KeyA", "ArrowLeft"),
        MOVE_RIGHT: new ConfigurableKey("KeyD", "ArrowRight"),
        MOVE_UP: new ConfigurableKey("ShiftLeft"),
        MOVE_DOWN: new ConfigurableKey("ControlLeft"),

        ESCAPE: new ConfigurableKey("Escape"),
        SPACEBAR: new ConfigurableKey("Space"),

        ENTER: new ConfigurableKey("Enter"),

        MUTE_MUSIC: new ConfigurableKey("KeyM"),
        MUTE_SOUND: new ConfigurableKey("KeyN")
    }

    buttons = {
        LEFT: 0,
        MIDDLE: 1,
        RIGHT: 2
    }

    pressedKeys: String[] = []
    pressedButton: number[] = []
    mousePos = {
        x: 0,
        y: 0,
        lastX: 0,
        lastY: 0,
    }
    private magicWords = ""

    init(mouseX: number, mouseY: number): void {
        this.initListeners()
        this.mousePos.x = mouseX
        this.mousePos.y = mouseY
        this.mousePos.lastX = 0
        this.mousePos.lastY = 0
    }

    getMouseChange(): [number, number] {
        let x = this.mousePos.lastX
        let y = this.mousePos.lastY
        this.mousePos.lastX = 0
        this.mousePos.lastY = 0
        return [x, y]
    }

    buttonPressed(...buttons: number[]): boolean {
        for (const button of buttons) {
            if (this.pressedButton.indexOf(button) >= 0) {
                return true
            }
        }
        return false
    }

    keyPressed(...keys: ConfigurableKey[]): boolean {
        for (const key of keys) {
            if (key.hasCodeIn(this.pressedKeys)) {
                return true
            }
        }
        return false
    }

    lockPointer(elem: Element): void {
        // console.log("Locking pointer onto " + elem)
        elem.requestPointerLock()
    }

    private initListeners(): void {

        document.querySelectorAll("canvas").forEach(elem => {
            elem.addEventListener("click", e => {
                if (e.target instanceof Element) {
                    this.lockPointer(e.target)
                }
            })
        })

        window.addEventListener("beforeunload", e => {
            e.preventDefault()
        })

        document.addEventListener("keydown", (e: KeyboardEvent) => {
            // console.log(`DOWN ${e.code}`)
            if (this.pressedKeys.indexOf(e.code) === -1) {
                this.pressedKeys.push(e.code)
            }
            if (!e.code.startsWith("F")) {
                e.preventDefault()
            }
            if (e.code === "F12") {
                console.log("Welcome to the CHEATS Zone!")
            }

            for (let keysKey in this.keys) {
                let key: ConfigurableKey = this.keys[keysKey]
                if (key.callbacks.length > 0) {
                    if (key.hasCode(e.code)) {
                        key.makeCallbacks(e, this.magicWords)
                    }
                }
            }
            if (e.code === "Enter") {
                this.magicWords = ""
            } else {
                this.magicWords += e.key
            }
        })

        document.addEventListener("keyup", (e: KeyboardEvent) => {
            // console.log(`UP ${e.code}`)
            this.pressedKeys.splice(this.pressedKeys.indexOf(e.code))
        })
        document.addEventListener("click", (e: MouseEvent) => {
            // console.log(`CLICK ${this.mousePos.x}:${this.mousePos.y}`)
        })

        document.addEventListener("mousedown", (e: MouseEvent) => {
            this.pressedButton.push(e.button)
            // console.log(`CLICK ${this.mousePos.x}:${this.mousePos.y}`)
        })

        document.addEventListener("mouseup", (e: MouseEvent) => {
            this.pressedButton.splice(this.pressedButton.indexOf(e.button))
            // console.log(`CLICK ${this.mousePos.x}:${this.mousePos.y}`)
        })

        document.addEventListener("mousemove", (e: MouseEvent) => {
            if (document.pointerLockElement) {
                this.mousePos.x += e.movementX
                this.mousePos.y += e.movementY
                this.mousePos.lastX += e.movementX
                this.mousePos.lastY += e.movementY
                // console.log(`LMOVE ${e.movementX}:${e.movementY}`)
            } else {
                // console.log(`MOVE ${e.movementX}:${e.movementY}`)
            }
        })
    }

}

class ConfigurableKey {
    codes
    callbacks = []

    constructor(...codes: String[]) {
        this.codes = codes
    }
    configure(...codes: String[]) {
        this.codes = codes
    }

    hasCodeIn(pressedKeys: String[]): boolean {
        for (const pressedKey of pressedKeys) {
            if (this.codes.indexOf(pressedKey) >= 0) {
                return true
            }
        }
        return false
    }

    hasCode(pressedKey: String): boolean {
        if (this.codes.indexOf(pressedKey) >= 0) {
            return true
        }
    }

    addCallback(callback) {
        this.callbacks.push(callback)
    }

    makeCallbacks(event: KeyboardEvent, magicwords) {
        for (const callback of this.callbacks) {
            callback(event, magicwords)
        }
    }
}

