class Game {
    controls: Controls
    renderer: Renderer
    audio: AudioManager
    doomGame: DoomGame
    paused: boolean
    private readonly cameraTransform: Transform
    private cameraPitch: number


    constructor(gameData: DoomGame) {
        this.cameraTransform = new Transform()
        this.cameraPitch = 0

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
        this.renderer.cameraYaw = deg2rad(playerThing.angle)
        this.cameraTransform.thing = playerThing
        this.cameraTransform.mobj = this.doomGame.mobj[playerThing.type]

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
        // if (this.controls.keyPressed(this.controls.keys.MOVE_UP)) {
        //     dy += -speed
        // }
        // if (this.controls.keyPressed(this.controls.keys.MOVE_DOWN)) {
        //     dy += speed
        // }

        let [dyaw, dpitch] = this.controls.getMouseChange()


        // this.cameraPitch += deg2rad(this.multi * 90 * dt) // Bob
        this.cameraPitch += deg2rad(dpitch * dt * 2)
        this.renderer.cameraYaw += deg2rad(dyaw * dt * 2)
        if (this.cameraPitch < deg2rad(-45)) {
            this.cameraPitch = deg2rad(-45)
        }if (this.cameraPitch > deg2rad(45)) {
            this.cameraPitch = deg2rad(45)
        }

        let map = this.doomGame.maps[0]
        let newPos = this.cameraTransform.getMoveForward(dx * dt, dy * dt, dz * dt)
        this.tryMove(map, this.cameraTransform, newPos);

        this.cameraTransform.setEulerAngles(0, this.cameraPitch, this.renderer.cameraYaw)

        let [x,y,z] = this.cameraTransform.getPosition()
        let targetHeight = this.getHeight(-z, -x)

        newPos = this.cameraTransform.getMoveForward(0,(-targetHeight - y -41) * dt * 20,0)
        this.cameraTransform.setPosition(newPos)

        if (this.controls.buttonPressed(this.controls.buttons.LEFT)) {
            // game.audio.play(Sound.PISTOL, 0.2)
            this.audio.playWadSound("PUNCH", 0.2)
            // this.audio.play(Sound.PLASMA, 0.2, true)
        }
        if (this.controls.buttonPressed(this.controls.buttons.MIDDLE)) {
            this.audio.playWadSound("OOF", 0.2)
        }
        if (this.controls.keyPressed(this.controls.keys.MOVE_FORWARD)) {
            document.querySelector("h3").textContent = "You are getting closer too DOOM!"
        } else {
            document.querySelector("h3").textContent = "DOOM awaits you!"
        }

    }

    private loadSkies(): DoomPicture[] {
        return ["SKY1", "SKY2", "SKY3"].map(n => this.doomGame.getArbitraryPicture(n))
    }

    private startLoop() {
        this.renderer.loadColorMaps(this.doomGame.colorMaps)
        this.renderer.loadPalettes(this.doomGame.colorPalettes)
        this.renderer.loadTextures(this.doomGame.textures.textures, this.loadSkies())
        this.renderer.loadMap(this.doomGame.maps[0])
        // this.loadThings()

        this.paused = false
        this.updateLoop(window, 0)
    }

    liveThings: Transform[] = []

    private loadThings() {
        for (const thing of this.doomGame.maps[0].things) {
            let mobj = this.doomGame.mobj[thing.type]
            if (mobj) {
                if (this.cameraTransform.thing === thing) {
                    continue
                }
                let transform = new Transform()
                transform.setPosition(-thing.y, -this.getHeight(thing.x, thing.y), -thing.x)
                transform.setEulerAngles(0, 0, deg2rad(thing.angle))
                transform.thing = thing
                transform.mobj = mobj
                this.renderer.addThing(transform)
                this.liveThings.push(transform)
            }

        }
    }

    FRACBITS = 16
    FRACUNIT =(1<< this.FRACBITS)
    MAXRADIUS = 32 * this.FRACUNIT
    MAPBLOCKSHIFT = this.FRACBITS + 7


    private checkPosition(map: DoomMap, tmthing: Transform, tmthingX, tmthingY, tmthingZ) {

        let [nx,ny,nz] = tmthing.getPosition()
        let tx = -nz
        let ty = -nx
        let tz = -(ny+41)

        let tmfloor = tz
        let tmdropoff = tz
        let tmCeiling = map.getSectorAt(tx, ty).ceilingHeight

        let blockMapOriginX = map.blockMap.originX << FRACBITS
        let blockMapOriginY = map.blockMap.originY << FRACBITS

        function forEachThing(x,y,func,things) {
            let blockPosSearch = y * map.blockMap.columnCount + x
            for (const thing of things) {

                let blockx = (tmthingX- blockMapOriginX) >> MAPBLOCKSHIFT
                let blocky = (tmthingY - blockMapOriginY) >> MAPBLOCKSHIFT

                let blockPos = blocky * map.blockMap.columnCount + blockx

                if (blockPosSearch === blockPos) {
                    if (!func( thing ) ) {
                        let [x,y,z] = thing.getPosition()
                        // console.log(`Collided with thing ${thing.thing.type} at ${-z}:${-x}`)
                        return false
                    }
                }
            }
            return true
        }

        function forEachLine(x,y,func) {
            if (x < 0 || y < 0 || x >= map.blockMap.columnCount || y >= map.blockMap.rowCount) {
                return true;
            }
            let offset = y * map.blockMap.columnCount +x
            for (const lineIdx of map.blockMap.lineDefIndices[offset]) {
                let lineDef = map.lineDefs[lineIdx]
                if (!func(lineDef)) {
                    return false
                }
            }
            return true // everything was checked
        }

        let radius = tmthing.mobj.radius >> FRACBITS

        const tmboxTop = tmthingY + radius
        const tmboxBottom = tmthingY - radius
        const tmboxRight = tmthingX + radius
        const tmboxLeft = tmthingX - radius

        let ceilingline

        let xl = (tmboxLeft - blockMapOriginX - this.MAXRADIUS) >> this.MAPBLOCKSHIFT
        let xh = (tmboxRight - blockMapOriginX + this.MAXRADIUS) >> this.MAPBLOCKSHIFT
        let yl = (tmboxBottom - blockMapOriginY - this.MAXRADIUS) >> this.MAPBLOCKSHIFT
        let yh = (tmboxTop - blockMapOriginY + this.MAXRADIUS) >> this.MAPBLOCKSHIFT

        function PIT_CheckThing(thing: Transform) {

            if (!(thing.mobj.flags & (MF_SOLID | MF_SPECIAL | MF_SHOOTABLE))) {
                return true
            }
            let blockdist = (thing.mobj.radius >> FRACBITS) + (tmthing.mobj.radius >> FRACBITS)

            let [x1,y1,z1] = thing.getPosition()
            let thingx = -z1
            let thingy = -x1
            if (Math.abs(thingx - tmthingX) >= blockdist
                || Math.abs(thingy -tmthingY) >= blockdist) {
                return true // didn't hit it
            }
            if (tmthing === thing) {
                return true
            }

            if (tmthing.mobj.flags & MF_SKULLFLY) {
                // TODO
                // damage = ((P_Random()%8)+1)*tmthing->info->damage;
                //
                // P_DamageMobj (thing, tmthing, tmthing, damage);
                //
                // tmthing->flags &= ~MF_SKULLFLY;
                // tmthing->momx = tmthing->momy = tmthing->momz = 0;
                //
                // P_SetMobjState (tmthing, tmthing->info->spawnstate);
                return false		// stop moving
            }
            // missiles can hit other things
            if (tmthing.mobj.flags & MF_MISSILE) {
                // TODO
                // see if it went over / under
                // if (tmthing.z > thing.z + thingmodj.height)
                // return true;		// overhead
                // if (tmthing.z+tmthingmodj.height < thing.z)
                // return true;		// underneath

                // if (tmthing->target && (
                //     tmthing->target->type == thing->type ||
                //  (tmthing->target->type == MT_KNIGHT && thing->type == MT_BRUISER)||
                //  (tmthing->target->type == MT_BRUISER && thing->type == MT_KNIGHT) ) ) {
                //     // Don't hit same species as originator.
                //     if (thing == tmthing->target)
                //     return true;
                //
                //     if (thing->type != MT_PLAYER)
                //     {
                //         // Explode, but do no damage.
                //         // Let players missile other players.
                //         return false;
                //     }
                // }

                if (!(thing.mobj.flags & MF_SHOOTABLE)) {
                    // didn't do any damage
                    return !(thing.mobj.flags & MF_SOLID)
                }

                // damage / explode
                // TODO
                // damage = ((P_Random()%8)+1)*tmthing->info->damage;
                // P_DamageMobj (thing, tmthing, tmthing->target, damage);

                // don't traverse any more
                return false
            }

            // check for special pickup
            if (thing.mobj.flags & MF_SPECIAL) {
                let solid = thing.mobj.flags & MF_SOLID
                if (tmthing.mobj.flags & MF_PICKUP) {
                    // can remove thing
                    // TODO
                    // P_TouchSpecialThing (thing, tmthing);
                    console.log(`Pickup ${thing.mobj.doomednum}`)
                }
                return !solid
            }

            return !(thing.mobj.flags & MF_SOLID)
        }

        for (let bx = xl; bx <= xh; bx++)
            for (let by = yl; by <= yh; by++)
                if (!forEachThing(bx, by, PIT_CheckThing, this.liveThings))
                    return false

        // check lines
        xl = ((tmboxLeft << this.FRACBITS ) - blockMapOriginX) >> MAPBLOCKSHIFT
        xh = ((tmboxRight << this.FRACBITS ) - blockMapOriginX) >> MAPBLOCKSHIFT
        yl = ((tmboxBottom << this.FRACBITS ) - blockMapOriginY) >> MAPBLOCKSHIFT
        yh = ((tmboxTop << this.FRACBITS ) - blockMapOriginY) >> MAPBLOCKSHIFT

        function PIT_CheckLine(linedef: DoomLineDef) {
            let v1 = map.vertexes[linedef.startVertexIndex]
            let v2 = map.vertexes[linedef.endVertexIndex]

            let boxLeft, boxRight, boxTop, boxBottom
            if (v1[0] < v2[0]) {
                boxLeft = v1[0]
                boxRight = v2[0]
            } else {
                boxLeft = v2[0]
                boxRight = v1[0]
            }
            if (v1[1] < v2[1]) {
                boxBottom = v1[1]
                boxTop = v2[1]
            } else {
                boxBottom = v2[1]
                boxTop = v1[1]
            }

            if(tmboxRight <= boxLeft
                || tmboxLeft >= boxRight
                || tmboxTop <= boxBottom
                || tmboxBottom >= boxTop) {
                return true
            }

            function P_BoxOnLineSide(boxleft, boxRight, boxTop, boxBottom, lineDef: DoomLineDef) {

                let v1 = map.vertexes[lineDef.startVertexIndex]
                let v2 = map.vertexes[lineDef.endVertexIndex]
                let lddx = v2[0] - v1[0]
                let lddy = v2[1] - v1[1]
                let slopetype

                if (!lddx)
                    slopetype = "ST_VERTICAL"
                else if (!lddy)
                    slopetype = "ST_HORIZONTAL"
                else if (lddy / lddx > 0)
                    slopetype = "ST_POSITIVE"
                else
                    slopetype = "ST_NEGATIVE"

                function P_PointOnLineSide(x,y, line: DoomLineDef, lddx, lddy, v1) {
                    let v1offsetX = v1[0]
                    let v1offsetY = v1[1]
                    if (!lddx) {
                        return x <= v1offsetX ? lddy > 0 : lddy < 0
                    }
                    if (!lddy) {
                        return y <= v1offsetY ? lddx < 0 : lddx > 0
                    }

                    let dx = (x - v1offsetX)
                    let dy = (y - v1offsetY)

                    let left = ((lddy ) * dx)
                    let right = (dy * (lddx ))

                    if (right < left) {
                        return 0		// front side
                    }
                    return 1			// back side
                }

                let p1, p2
                switch (slopetype)
                {
                    case "ST_HORIZONTAL":
                        p1 = tmboxTop > v1[1];
                        p2 = tmboxBottom > v1[1];
                        if (lddx < 0)
                        {
                            p1 ^= 1;
                            p2 ^= 1;
                        }
                        break;

                    case "ST_VERTICAL":
                        p1 = tmboxRight< v1[0];
                        p2 = tmboxLeft < v1[0]
                        if (lddy < 0)
                        {
                            p1 ^= 1;
                            p2 ^= 1;
                        }
                        break;

                    case "ST_POSITIVE":
                        p1 = P_PointOnLineSide (tmboxLeft, tmboxTop, lineDef, lddx, lddy, v1);
                        p2 = P_PointOnLineSide (tmboxRight, tmboxBottom, lineDef, lddx, lddy, v1);
                        break;

                    case "ST_NEGATIVE":
                        p1 = P_PointOnLineSide (tmboxRight, tmboxTop, lineDef, lddx, lddy, v1);
                        p2 = P_PointOnLineSide (tmboxLeft, tmboxBottom, lineDef, lddx, lddy, v1);
                        break;
                }

                if (p1 == p2)
                    return p1;
                return -1;
            }

            if (P_BoxOnLineSide (tmboxLeft, tmboxRight, tmboxTop, tmboxBottom, linedef) != -1)
                return true;

            // A line has been hit

            // The moving thing's destination position will cross
            // the given line.
            // If this should not be allowed, return false.
            // If the line is special, keep track of it
            // to process later if the move is proven ok.
            // NOTE: specials are NOT sorted by order,
            // so two special lines that are only 8 pixels apart
            // could be crossed in either order.
            const ML_BLOCKING = 1
            const ML_BLOCKMONSTERS = 2

            let backsector
            if (linedef.rightSideDefIndex !== -1) {
                backsector = map.sideDefs[linedef.rightSideDefIndex].sectorIndex
            } else {
                backsector = 0
            }
            let frontsector
            if (linedef.leftSideDefIndex != -1) {
                frontsector = map.sideDefs[linedef.leftSideDefIndex].sectorIndex
            } else {
                frontsector = 0
            }

            if (!backsector)
                return false;		// one sided line

            if (!(tmthing.mobj.flags & MF_MISSILE) )
            {
                if (linedef.flags & ML_BLOCKING) {
                    return false; 	// explicitly blocking everything
                }
                if ( tmthing.thing.type !== 1 && linedef.flags & ML_BLOCKMONSTERS )
                    return false;	// block monsters only
            }

            function P_LineOpening(ld) {
                let openrange
                let opentop
                let openbottom
                let lowfloor
                if (ld.rightSideDefIndex === -1) {
                    // single sided line
                    openrange = 0
                    return
                }

                let frontCeiling = map.sectors[frontsector].ceilingHeight
                let frontFloor = map.sectors[frontsector].floorHeight
                let backCeiling = map.sectors[backsector].ceilingHeight
                let backFloor = map.sectors[backsector].floorHeight

                if (frontCeiling < backCeiling)
                    opentop = frontCeiling
                else
                    opentop = backCeiling

                if (frontFloor > backFloor) {
                    openbottom = frontFloor
                    lowfloor = backFloor
                } else {
                    openbottom = backFloor
                    lowfloor = frontFloor
                }

                openrange = opentop - openbottom
                return [opentop, openbottom, lowfloor]
            }

            // set openrange, opentop, openbottom
            let [opentop, openbottom, lowfloor] = P_LineOpening (linedef);

            // adjust floor / ceiling heights
            if (opentop < tmCeiling)
            {
                tmCeiling = opentop;
                ceilingline = linedef;
            }

            if (openbottom > tmfloor)
                tmfloor = openbottom;

            if (lowfloor < tmdropoff)
                tmdropoff = lowfloor;

            // if contacted a special line, add it to the list
            if (linedef.specialType)
            {
                console.log("Special Linedef")
                // TODO
                // spechit[numspechit] = ld;
                // numspechit++;
            }
            return true;
        }

        for (let bx = xl; bx <= xh; bx++)
            for (let by = yl; by <= yh; by++)
                if (!forEachLine(bx, by, PIT_CheckLine))
                    return false

        return [tmfloor, tmdropoff, tmCeiling]
    }


    private tryMove(map: DoomMap, tmthing: Transform, newPos: [number, number, number]) {

        let [nx,ny,nz] = newPos
        let tx = -nz
        let ty = -nx
        let tz = -(ny+41)

        // NoClip?
        let checkPosition = this.checkPosition(map, tmthing, tx, ty, tz)
        if (!checkPosition) {
            return false
        }

        let [tmfloor, tmdropoff, tmCeiling] = checkPosition

        if (tmCeiling - tmfloor < tmthing.mobj.height / FRACUNIT) {
            return false	// doesn't fit
        }

        // floatok = true; ??
        if (!(tmthing.mobj.flags & MF_TELEPORT)
            && tmCeiling - tz < tmthing.mobj.height / FRACUNIT) {
            return false	// mobj must lower itself to fit
        }

        if (!(tmthing.mobj.flags & MF_TELEPORT)
            && tmfloor - tz > 24) {
            return false	// too big a step up
        }


        if (!(tmthing.mobj.flags & (MF_DROPOFF | MF_FLOAT))
            && tmfloor - tmdropoff > 24) {
            return false	// don't stand over a dropoff
        }

        tmthing.setPosition(newPos)

        return true
    }
}
