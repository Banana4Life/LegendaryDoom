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
        this.setPosition(0, 0, 0)
        this.setEulerAngles(0, 0, 0)

        this.dirty = true
        this.matrix = mat4.identity
    }

    set(otherTransform) {
        this.setPosition(otherTransform.getTranslation())
        this.setEulerAngles(otherTransform.getRotation())
    }

    setPosition(x, y = 0, z = 0) {
        if (Array.isArray(x)) {
            [x, y, z] = x
        }
        this.transX = x
        this.transY = y
        this.transZ = z

        this.dirty = true
    }

    getPosition() {
        return [this.transX, this.transY, this.transZ]
    }

    move(x, y = 0, z = 0) {
        if (Array.isArray(x)) {
            [x, y, z] = x
        }
        this.setPosition(this.transX + x, this.transY + y, this.transZ + z)
    }

    moveForward(x, y, z) {
        let rotation = mat4.rotation(this.quaternion())
        let [x2, y2, z2, ] = mat4.multiplyV4(rotation, [x, y, z, 0])
        this.move(x2, y2, z2)
    }

    setEulerAngles(roll, pitch = 0, yaw = 0) {
        if (Array.isArray(roll)) {
            [roll, pitch, yaw] = roll
        }
        this.roll = roll
        this.pitch = pitch
        this.yaw = yaw

        this.dirty = true
    }

    getEulerAngles() {
        return [this.roll, this.pitch, this.yaw]
    }

    rotateByEulerAngles(roll, pitch = 0, yaw = 0) {
        if (Array.isArray(roll)) {
            [roll, pitch, yaw] = roll
        }
        this.setEulerAngles(this.roll + roll, this.pitch + pitch, this.yaw + yaw)
    }

    getTransformation() {
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

class Transform_ {
    private dirty: boolean
    private transform: number[]

    private scaleX: number = 1
    private scaleY: number = 1
    private scaleZ: number = 1
    private scale: number[]

    private rotW: number = 0
    private rotX: number = 0
    private rotY: number = 0
    private rotZ: number = 0
    private rotation: number[]

    private posX: number = 0
    private posY: number = 0
    private posZ: number = 0
    private translation: number[]

    constructor() {
        this.setPosition(0, 0, 0);
        this.setScale(1, 1, 1);
        this.setAngleAxis(0, 0, 0, 1);

        this.dirty = true;
        this.transform = mat4.identity;
    }

    set(otherTransform) {
        this.setPosition(otherTransform.getPosition());
        this.setScale(otherTransform.getScale());
        this.setRotationQuaternion(otherTransform.getRotationQuaternion());
    }

    setPosition(x: number | number[], y: number | undefined = undefined, z: number | undefined = undefined) {
        if (Array.isArray(x)) {
            [x, y, z] = x;
        }
        this.posX = x;
        this.posY = y;
        this.posZ = z;
        this.translation = mat4.translation(x, y, z);

        this.dirty = true;
    }

    getPosition(): [number, number, number] {
        return [this.posX, this.posY, this.posZ];
    }

    move(x, y, z = 0) {
        if (Array.isArray(x)) {
            [x, y, z] = x;
        }
        this.setPosition(this.posX + x, this.posY + y, this.posZ + z);
    }

    moveForward(x, y, z) {
        let [x2, y2, z2, ] = mat4.multiplyV4(this.rotation, [x, y, z, 0])
        this.move(x2, y2, z2)
    }

    setScale(x, y = x, z = x) {
        if (Array.isArray(x)) {
            [x, y, z] = x;
        }
        this.scaleX = x;
        this.scaleY = y;
        this.scaleZ = z;
        this.scale = mat4.scale(x, y, z);

        this.dirty = true;
    }

    getScale() {
        return [this.scaleX, this.scaleY, this.scaleZ];
    }

    setRotationQuaternion(w, x = undefined, y = undefined, z = undefined) {
        if (Array.isArray(w)) {
            [w, x, y, z] = w;
        }
        this.rotW = w;
        this.rotX = x;
        this.rotY = y;
        this.rotZ = z;
        this.rotation = mat4.rotation(w, x, y, z);

        this.dirty = true;
    }

    getRotationQuaternion() {
        return [this.rotW, this.rotX, this.rotY, this.rotZ];
    }

    setAngleAxis(angle, x, y, z) {
        let halfAngle = angle / 2.0;
        let s = Math.sin(halfAngle);

        this.setRotationQuaternion(Math.cos(halfAngle), x * s, y * s, z * s);
    }

    getAngleAxis() {
        let angle = 2.0 * Math.acos(this.rotW);
        if (angle === 0) {
            return [0, 0, 1, 0];
        }
        let s = Math.sqrt(1.0 - this.rotW * this.rotW);
        let x = this.rotX / s;
        let y = this.rotY / s;
        let z = this.rotZ / s;

        return [angle, x, y, z];
    }

    setEulerAngles(roll, pitch, yaw) {
        if (Array.isArray(roll)) {
            [roll, pitch, yaw] = roll;
        }
        const cy = Math.cos(yaw * 0.5);
        const sy = Math.sin(yaw * 0.5);
        const cp = Math.cos(pitch * 0.5);
        const sp = Math.sin(pitch * 0.5);
        const cr = Math.cos(roll * 0.5);
        const sr = Math.sin(roll * 0.5);

        this.setRotationQuaternion(cy * cp * cr + sy * sp * sr, cy * cp * sr - sy * sp * cr, sy * cp * sr + cy * sp * cr, sy * cp * cr - cy * sp * sr)
    }

    getEulerAngles() {
        const sinr_cosp = 2.0 * (this.rotW * this.rotX + this.rotY * this.rotZ);
        const cosr_cosp = 1.0 - 2.0 * (this.rotX * this.rotX + this.rotY * this.rotY);
        const roll = Math.atan2(sinr_cosp, cosr_cosp);

        const sinp = +2.0 * (this.rotW * this.rotY - this.rotZ * this.rotX);
        let pitch = 0;
        if (Math.abs(sinp) >= 1) {
            pitch = Math.sign(sinp) * (Math.PI / 2); // use 90 degrees if out of range
        } else {
            pitch = Math.asin(sinp);
        }


        const siny_cosp = +2.0 * (this.rotW * this.rotZ + this.rotX * this.rotY);
        const cosy_cosp = +1.0 - 2.0 * (this.rotY * this.rotY + this.rotZ * this.rotZ);
        const yaw = Math.atan2(siny_cosp, cosy_cosp);

        return [roll, pitch, yaw];
    }

    rotateByEulerAngles(roll, pitch, yaw) {
        if (Array.isArray(roll)) {
            [roll, pitch, yaw] = roll
        }
        let [cRoll, cPitch, cYaw] = this.getEulerAngles()
        this.setEulerAngles(cRoll + roll, cPitch + pitch, cYaw + yaw)
    }

    getTransformation() {
        if (this.dirty) {
            this.transform = mat4.multiply(this.rotation, mat4.multiply(this.scale, this.translation));
            this.dirty = false;
        }
        return this.transform;
    }
}
