class ConfigurableKey {
    codes

    constructor(...codes: String[]) {
        this.codes = codes
    }

    configure(...codes: String[]) {
        this.codes = codes
    }

    isPressed(pressedKeys: String[]): boolean {
        for (const pressedKey of pressedKeys) {
            if (this.codes.contains(pressedKey)) {
                return true;
            }
        }
        return false;
    }

}

let keys = {
    MOVE_FORWARD: new ConfigurableKey("KeyW", "ArrowUp"),
    MOVE_BACKWARD: new ConfigurableKey("KeyS", "ArrowDown"),
    MOVE_LEFT: new ConfigurableKey("KeyA", "ArrowLeft"),
    MOVE_RIGHT: new ConfigurableKey("KeyD", "ArrowRight"),

    ESACAPE: new ConfigurableKey("Escape"),
}

class Controls {
    pressedKeys: String[] = []
    mousePos = {
        x: 0,
        y: 0
    }

    init(mouseX: number, mouseY: number) {
        this.initListeners();
        this.mousePos.x = mouseX
        this.mousePos.y = mouseY
    }

    arePressed(...keys: ConfigurableKey[]) {
        for (const key of keys) {
            if (key.isPressed(this.pressedKeys)) {
                return true;
            }
        }
        return false;
    }

    private magicWords = "";

    private initListeners() {
        window.addEventListener("beforeunload", e => {
            e.preventDefault()
        })

        document.addEventListener("keydown", (e: KeyboardEvent) => {
            // console.log(`DOWN ${e.code}`)
            controls.pressedKeys.push(e.code)
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
        })

        document.addEventListener("keyup", (e: KeyboardEvent) => {
            // console.log(`UP ${e.code}`)
            controls.pressedKeys.splice(controls.pressedKeys.indexOf(e.code))
        })
        document.addEventListener("click", (e: MouseEvent) => {
            console.log(`CLICK ${this.mousePos.x}:${this.mousePos.y}`)
        })

        document.addEventListener("mousedown", (e: MouseEvent) => {
            // console.log(`CLICK ${this.mousePos.x}:${this.mousePos.y}`)
        })

        document.addEventListener("mouseup", (e: MouseEvent) => {
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

let controls = new Controls()

