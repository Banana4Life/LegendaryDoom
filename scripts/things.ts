class Transform {
    dirty
    matrix
    transX
    transY
    transZ
    roll
    pitch
    yaw

    constructor() {
        this.setTranslation(0, 0, 0)
        this.setRotation(0, 0, 0)

        this.dirty = true
        this.matrix = mat4.identity
    }

    set(otherTransform) {
        this.setTranslation(otherTransform.getTranslation())
        this.setRotation(otherTransform.getRotation())
    }

    setTranslation(x, y = 0, z = 0) {
        if (Array.isArray(x)) {
            [x, y, z] = x
        }
        this.transX = x
        this.transY = y
        this.transZ = z

        this.dirty = true
    }

    getTranslation() {
        return [this.transX, this.transY, this.transZ]
    }

    translate(x, y = 0, z = 0) {
        if (Array.isArray(x)) {
            [x, y, z] = x
        }
        this.setTranslation(this.transX + x, this.transY + y, this.transZ + z)
    }

    setRotation(roll, pitch = 0, yaw = 0) {
        if (Array.isArray(roll)) {
            [roll, pitch, yaw] = roll
        }
        this.roll = roll
        this.pitch = pitch
        this.yaw = yaw

        this.dirty = true
    }

    getRotation() {
        return [this.roll, this.pitch, this.yaw]
    }

    rotate(roll, pitch = 0, yaw = 0) {
        if (Array.isArray(roll)) {
            [roll, pitch, yaw] = roll
        }
        this.setRotation(this.roll + roll, this.pitch + pitch, this.yaw + yaw)
    }

    getMatrix() {
        if (this.dirty) {
            //this.matrix = mat4.multiply(mat4.rotation(this.roll, this.pitch, this.yaw),
            this.matrix = mat4.multiply(mat4.translation(this.transX, this.transY, this.transZ),
                mat4.rotation(this.quaternion()))
            this.dirty = false
        }
        return this.matrix
    }

    private quaternion() {
        const cr = Math.cos(this.roll / 2)
        const sr = Math.sin(this.roll / 2)
        const cp = Math.cos(this.pitch / 2)
        const sp = Math.sin(this.pitch / 2)
        const cy = Math.cos(this.yaw / 2)
        const sy = Math.sin(this.yaw / 2)

        return [
            cr * cp * cy + sr * sp * sy,
            sr * cp * cy - cr * sp * sy,
            sr * cp * sy + cr * sp * cy,
            cr * cp * sy - sr * sp * cy
        ]
    }
}