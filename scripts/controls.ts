class Controls {

    keys = {
        MOVE_FORWARD: new ConfigurableKey("KeyW", "ArrowUp"),
        MOVE_BACKWARD: new ConfigurableKey("KeyS", "ArrowDown"),
        MOVE_LEFT: new ConfigurableKey("KeyA", "ArrowLeft"),
        MOVE_RIGHT: new ConfigurableKey("KeyD", "ArrowRight"),

        ESCAPE: new ConfigurableKey("Escape"),
        SPACEBAR: new ConfigurableKey("Space"),
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
        y: 0
    }

    init(mouseX: number, mouseY: number) {
        this.initListeners();
        this.mousePos.x = mouseX
        this.mousePos.y = mouseY
    }


    buttonPressed(...buttons: number[]) {
        for (const button of buttons) {
            if (this.pressedButton.indexOf(button) >= 0) {
                return true
            }
        }
        return false
    }

    keyPressed(...keys: ConfigurableKey[]) {
        for (const key of keys) {
            if (key.hasCodeIn(this.pressedKeys)) {
                return true
            }
        }
        return false
    }

    private magicWords = "";

    private initListeners() {

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
            this.pressedKeys.push(e.code)
            if (!e.code.startsWith("F")) {
                e.preventDefault()
            }
            if (e.code === "F12") {
                console.log("Welcome to the CHEATS Zone!")
            }

            if (e.code === "Enter") {
                this.doMagic();
            }
            this.magicWords += e.key;

            for (let keysKey in this.keys) {
                let key: ConfigurableKey = this.keys[keysKey]
                if (key.callbacks.length > 0) {
                    if (key.hasCode(e.code)) {
                        key.makeCallbacks(e);
                    }
                }
            }
        })

        document.addEventListener("keyup", (e: KeyboardEvent) => {
            // console.log(`UP ${e.code}`)
            this.pressedKeys.splice(this.pressedKeys.indexOf(e.code))
        })
        document.addEventListener("click", (e: MouseEvent) => {
            console.log(`CLICK ${this.mousePos.x}:${this.mousePos.y}`)
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
                // console.log(`LMOVE ${e.movementX}:${e.movementY}`)
            } else {
                // console.log(`MOVE ${e.movementX}:${e.movementY}`)
            }
        })
    }

    private doMagic() {
        if (this.magicWords.endsWith("god")) {
            console.log("Do you believe?")
        }
        this.magicWords = ""
    }

    lockPointer(elem: Element) {
        console.log("Pointer Locked onto " + elem)
        elem.requestPointerLock()
    }

}

class ConfigurableKey {
    codes

    constructor(...codes: String[]) {
        this.codes = codes
    }

    configure(...codes: String[]) {
        this.codes = codes
    }

    hasCodeIn(pressedKeys: String[]): boolean {
        for (const pressedKey of pressedKeys) {
            if (this.codes.indexOf(pressedKey) >= 0) {
                return true;
            }
        }
        return false;
    }

    hasCode(pressedKey: String): boolean {
        if (this.codes.indexOf(pressedKey) >= 0) {
            return true;
        }
    }

    callbacks = []

    addCallback(callback) {
        this.callbacks.push(callback);
    }

    makeCallbacks(event: KeyboardEvent) {
        for (const callback of this.callbacks) {
            callback(event);
        }
    }
}

