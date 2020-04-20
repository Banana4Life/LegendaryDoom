var Controls = /** @class */ (function () {
    function Controls() {
        this.keys = {
            MOVE_FORWARD: new ConfigurableKey("KeyW", "ArrowUp"),
            MOVE_BACKWARD: new ConfigurableKey("KeyS", "ArrowDown"),
            MOVE_LEFT: new ConfigurableKey("KeyA", "ArrowLeft"),
            MOVE_RIGHT: new ConfigurableKey("KeyD", "ArrowRight"),
            MOVE_UP: new ConfigurableKey("ShiftLeft"),
            MOVE_DOWN: new ConfigurableKey("ControlLeft"),
            ESCAPE: new ConfigurableKey("Escape"),
            SPACEBAR: new ConfigurableKey("Space"),
            MUTE_MUSIC: new ConfigurableKey("KeyM"),
            MUTE_SOUND: new ConfigurableKey("KeyN")
        };
        this.buttons = {
            LEFT: 0,
            MIDDLE: 1,
            RIGHT: 2
        };
        this.pressedKeys = [];
        this.pressedButton = [];
        this.mousePos = {
            x: 0,
            y: 0,
            lastX: 0,
            lastY: 0,
        };
        this.magicWords = "";
    }
    Controls.prototype.init = function (mouseX, mouseY) {
        this.initListeners();
        this.mousePos.x = mouseX;
        this.mousePos.y = mouseY;
        this.mousePos.lastX = 0;
        this.mousePos.lastY = 0;
    };
    Controls.prototype.getMouseChange = function () {
        var x = this.mousePos.lastX;
        var y = this.mousePos.lastY;
        this.mousePos.lastX = 0;
        this.mousePos.lastY = 0;
        return [x, y];
    };
    Controls.prototype.buttonPressed = function () {
        var buttons = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            buttons[_i] = arguments[_i];
        }
        for (var _a = 0, buttons_1 = buttons; _a < buttons_1.length; _a++) {
            var button = buttons_1[_a];
            if (this.pressedButton.indexOf(button) >= 0) {
                return true;
            }
        }
        return false;
    };
    Controls.prototype.keyPressed = function () {
        var keys = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            keys[_i] = arguments[_i];
        }
        for (var _a = 0, keys_1 = keys; _a < keys_1.length; _a++) {
            var key = keys_1[_a];
            if (key.hasCodeIn(this.pressedKeys)) {
                return true;
            }
        }
        return false;
    };
    Controls.prototype.lockPointer = function (elem) {
        // console.log("Locking pointer onto " + elem)
        elem.requestPointerLock();
    };
    Controls.prototype.initListeners = function () {
        var _this = this;
        document.querySelectorAll("canvas").forEach(function (elem) {
            elem.addEventListener("click", function (e) {
                if (e.target instanceof Element) {
                    _this.lockPointer(e.target);
                }
            });
        });
        window.addEventListener("beforeunload", function (e) {
            e.preventDefault();
        });
        document.addEventListener("keydown", function (e) {
            // console.log(`DOWN ${e.code}`)
            if (_this.pressedKeys.indexOf(e.code) === -1) {
                _this.pressedKeys.push(e.code);
            }
            if (!e.code.startsWith("F")) {
                e.preventDefault();
            }
            if (e.code === "F12") {
                console.log("Welcome to the CHEATS Zone!");
            }
            if (e.code === "Enter") {
                _this.doMagic();
            }
            _this.magicWords += e.key;
            for (var keysKey in _this.keys) {
                var key = _this.keys[keysKey];
                if (key.callbacks.length > 0) {
                    if (key.hasCode(e.code)) {
                        key.makeCallbacks(e);
                    }
                }
            }
        });
        document.addEventListener("keyup", function (e) {
            // console.log(`UP ${e.code}`)
            _this.pressedKeys.splice(_this.pressedKeys.indexOf(e.code));
        });
        document.addEventListener("click", function (e) {
            // console.log(`CLICK ${this.mousePos.x}:${this.mousePos.y}`)
        });
        document.addEventListener("mousedown", function (e) {
            _this.pressedButton.push(e.button);
            // console.log(`CLICK ${this.mousePos.x}:${this.mousePos.y}`)
        });
        document.addEventListener("mouseup", function (e) {
            _this.pressedButton.splice(_this.pressedButton.indexOf(e.button));
            // console.log(`CLICK ${this.mousePos.x}:${this.mousePos.y}`)
        });
        document.addEventListener("mousemove", function (e) {
            if (document.pointerLockElement) {
                _this.mousePos.x += e.movementX;
                _this.mousePos.y += e.movementY;
                _this.mousePos.lastX += e.movementX;
                _this.mousePos.lastY += e.movementY;
                // console.log(`LMOVE ${e.movementX}:${e.movementY}`)
            }
            else {
                // console.log(`MOVE ${e.movementX}:${e.movementY}`)
            }
        });
    };
    Controls.prototype.doMagic = function () {
        if (this.magicWords.endsWith("god")) {
            console.log("Do you believe?");
        }
        this.magicWords = "";
    };
    return Controls;
}());
var ConfigurableKey = /** @class */ (function () {
    function ConfigurableKey() {
        var codes = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            codes[_i] = arguments[_i];
        }
        this.callbacks = [];
        this.codes = codes;
    }
    ConfigurableKey.prototype.configure = function () {
        var codes = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            codes[_i] = arguments[_i];
        }
        this.codes = codes;
    };
    ConfigurableKey.prototype.hasCodeIn = function (pressedKeys) {
        for (var _i = 0, pressedKeys_1 = pressedKeys; _i < pressedKeys_1.length; _i++) {
            var pressedKey = pressedKeys_1[_i];
            if (this.codes.indexOf(pressedKey) >= 0) {
                return true;
            }
        }
        return false;
    };
    ConfigurableKey.prototype.hasCode = function (pressedKey) {
        if (this.codes.indexOf(pressedKey) >= 0) {
            return true;
        }
    };
    ConfigurableKey.prototype.addCallback = function (callback) {
        this.callbacks.push(callback);
    };
    ConfigurableKey.prototype.makeCallbacks = function (event) {
        for (var _i = 0, _a = this.callbacks; _i < _a.length; _i++) {
            var callback = _a[_i];
            callback(event);
        }
    };
    return ConfigurableKey;
}());
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udHJvbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJjb250cm9scy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtJQUFBO1FBRUksU0FBSSxHQUFHO1lBQ0gsWUFBWSxFQUFFLElBQUksZUFBZSxDQUFDLE1BQU0sRUFBRSxTQUFTLENBQUM7WUFDcEQsYUFBYSxFQUFFLElBQUksZUFBZSxDQUFDLE1BQU0sRUFBRSxXQUFXLENBQUM7WUFDdkQsU0FBUyxFQUFFLElBQUksZUFBZSxDQUFDLE1BQU0sRUFBRSxXQUFXLENBQUM7WUFDbkQsVUFBVSxFQUFFLElBQUksZUFBZSxDQUFDLE1BQU0sRUFBRSxZQUFZLENBQUM7WUFDckQsT0FBTyxFQUFFLElBQUksZUFBZSxDQUFDLFdBQVcsQ0FBQztZQUN6QyxTQUFTLEVBQUUsSUFBSSxlQUFlLENBQUMsYUFBYSxDQUFDO1lBRTdDLE1BQU0sRUFBRSxJQUFJLGVBQWUsQ0FBQyxRQUFRLENBQUM7WUFDckMsUUFBUSxFQUFFLElBQUksZUFBZSxDQUFDLE9BQU8sQ0FBQztZQUV0QyxVQUFVLEVBQUUsSUFBSSxlQUFlLENBQUMsTUFBTSxDQUFDO1lBQ3ZDLFVBQVUsRUFBRSxJQUFJLGVBQWUsQ0FBQyxNQUFNLENBQUM7U0FDMUMsQ0FBQTtRQUVELFlBQU8sR0FBRztZQUNOLElBQUksRUFBRSxDQUFDO1lBQ1AsTUFBTSxFQUFFLENBQUM7WUFDVCxLQUFLLEVBQUUsQ0FBQztTQUNYLENBQUE7UUFFRCxnQkFBVyxHQUFhLEVBQUUsQ0FBQTtRQUMxQixrQkFBYSxHQUFhLEVBQUUsQ0FBQTtRQUM1QixhQUFRLEdBQUc7WUFDUCxDQUFDLEVBQUUsQ0FBQztZQUNKLENBQUMsRUFBRSxDQUFDO1lBQ0osS0FBSyxFQUFFLENBQUM7WUFDUixLQUFLLEVBQUUsQ0FBQztTQUNYLENBQUE7UUFDTyxlQUFVLEdBQUcsRUFBRSxDQUFBO0lBd0gzQixDQUFDO0lBdEhHLHVCQUFJLEdBQUosVUFBSyxNQUFjLEVBQUUsTUFB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