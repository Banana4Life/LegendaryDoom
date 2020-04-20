var Game = /** @class */ (function () {
    function Game(gameData) {
        this.liveThings = [];
        this.FRACBITS = 16;
        this.FRACUNIT = (1 << this.FRACBITS);
        this.MAXRADIUS = 32 * this.FRACUNIT;
        this.MAPBLOCKSHIFT = this.FRACBITS + 7;
        this.cameraTransform = new Transform();
        this.cameraPitch = 0;
        this.controls = new Controls();
        this.renderer = new Renderer(this.cameraTransform);
        this.audio = new AudioManager(gameData);
        this.doomGame = gameData;
        this.paused = false;
    }
    Game.prototype.update = function (dt) {
        this.update0(dt);
        this.renderer.render(dt);
        return true;
    };
    Game.prototype.togglePause = function () {
        var _this = this;
        this.audio.toggleMusic();
        this.paused = !this.paused;
        if (this.paused) {
            logToGameConsole("Game paused!");
        }
        else {
            logToGameConsole("Game resumed!");
        }
        document.querySelectorAll(".paused").forEach(function (e) {
            if (_this.paused) {
                e.classList.add("is-paused");
                _this.audio.play(Sound.STOP);
            }
            else {
                e.classList.remove("is-paused");
                _this.audio.play(Sound.START);
            }
        });
    };
    Game.prototype.updateLoop = function (root, pt) {
        var self = this;
        root.requestAnimationFrame(function (t) {
            var dt = 0;
            if (!self.paused) {
                if (pt !== 0) {
                    dt = (t - pt) / 1000;
                }
            }
            if (self.update(dt) === false) {
                return;
            }
            self.updateLoop(root, t);
        });
    };
    Game.prototype.init = function () {
        var _this = this;
        this.controls.init(0, 0);
        this.controls.keys.SPACEBAR.addCallback(this.togglePause.bind(this));
        this.controls.keys.MUTE_MUSIC.addCallback(function () { return _this.audio.toggleMusic(true); });
        this.controls.keys.MUTE_SOUND.addCallback(function () { return _this.audio.toggleSounds(); });
        var playerThing = this.doomGame.maps[0].things[0];
        this.cameraTransform.setPosition(-playerThing.y, -41, -playerThing.x);
        this.renderer.cameraYaw = deg2rad(playerThing.angle);
        this.cameraTransform.thing = playerThing;
        this.cameraTransform.mobj = this.doomGame.mobj[playerThing.type];
        return this.renderer.initRenderer()
            .then(this.startLoop.bind(this));
    };
    Game.prototype.getHeight = function (x, y) {
        var map = this.doomGame.maps[0];
        return map.getSectorAt(x, y).floorHeight;
    };
    Game.prototype.update0 = function (dt) {
        this.audio.update(dt);
        if (this.paused) {
            return;
        }
        var speed = 500;
        var dx = 0;
        var dy = 0;
        var dz = 0;
        if (this.controls.keyPressed(this.controls.keys.MOVE_FORWARD)) {
            dz += speed;
        }
        if (this.controls.keyPressed(this.controls.keys.MOVE_BACKWARD)) {
            dz += -speed;
        }
        if (this.controls.keyPressed(this.controls.keys.MOVE_LEFT)) {
            dx += speed;
        }
        if (this.controls.keyPressed(this.controls.keys.MOVE_RIGHT)) {
            dx += -speed;
        }
        // if (this.controls.keyPressed(this.controls.keys.MOVE_UP)) {
        //     dy += -speed
        // }
        // if (this.controls.keyPressed(this.controls.keys.MOVE_DOWN)) {
        //     dy += speed
        // }
        var _a = this.controls.getMouseChange(), dyaw = _a[0], dpitch = _a[1];
        // this.cameraPitch += deg2rad(this.multi * 90 * dt) // Bob
        this.cameraPitch += deg2rad(dpitch * dt * 2);
        this.renderer.cameraYaw += deg2rad(dyaw * dt * 2);
        if (this.cameraPitch < deg2rad(-45)) {
            this.cameraPitch = deg2rad(-45);
        }
        if (this.cameraPitch > deg2rad(45)) {
            this.cameraPitch = deg2rad(45);
        }
        var oldPos = this.cameraTransform.getPosition();
        this.cameraTransform.moveForward(dx * dt, dy * dt, dz * dt);
        this.cameraTransform.setEulerAngles(0, this.cameraPitch, this.renderer.cameraYaw);
        var _b = this.cameraTransform.getPosition(), x = _b[0], y = _b[1], z = _b[2];
        var targetHeight = this.getHeight(-z, -x);
        this.cameraTransform.moveForward(0, (-targetHeight - y - 41) * dt * 20, 0);
        var newPos = this.cameraTransform.getPosition();
        var map = this.doomGame.maps[0];
        if (!this.checkCollide(map, this.cameraTransform, oldPos, newPos)) {
            // console.log("Collide")
        }
        if (this.controls.buttonPressed(this.controls.buttons.LEFT)) {
            // game.audio.play(Sound.PISTOL, 0.2)
            this.audio.playWadSound("PUNCH", 0.2);
            // this.audio.play(Sound.PLASMA, 0.2, true)
        }
        if (this.controls.buttonPressed(this.controls.buttons.MIDDLE)) {
            this.audio.playWadSound("OOF", 0.2);
        }
        if (this.controls.keyPressed(this.controls.keys.MOVE_FORWARD)) {
            document.querySelector("h3").textContent = "You are getting closer too DOOM!";
        }
        else {
            document.querySelector("h3").textContent = "DOOM awaits you!";
        }
    };
    Game.prototype.loadSkies = function () {
        var _this = this;
        return ["SKY1", "SKY2", "SKY3"].map(function (n) { return _this.doomGame.getArbitraryPicture(n); });
    };
    Game.prototype.startLoop = function () {
        this.renderer.loadColorMaps(this.doomGame.colorMaps);
        this.renderer.loadPalettes(this.doomGame.colorPalettes);
        this.renderer.loadTextures(this.doomGame.textures.textures, this.loadSkies());
        this.renderer.loadMap(this.doomGame.maps[0]);
        this.loadThings();
        this.paused = false;
        this.updateLoop(window, 0);
    };
    Game.prototype.loadThings = function () {
        for (var _i = 0, _a = this.doomGame.maps[0].things; _i < _a.length; _i++) {
            var thing = _a[_i];
            var mobj = this.doomGame.mobj[thing.type];
            if (mobj) {
                if (this.cameraTransform.thing === thing) {
                    continue;
                }
                var transform = new Transform();
                transform.setPosition(-thing.y, -this.getHeight(thing.x, thing.y), -thing.x);
                transform.setEulerAngles(0, 0, deg2rad(thing.angle));
                transform.thing = thing;
                transform.mobj = mobj;
                this.renderer.addThing(transform);
                this.liveThings.push(transform);
            }
        }
    };
    Game.prototype.checkCollide = function (map, tmthing, oldPos, newPos) {
        var blockMapOriginX = map.blockMap.originX << this.FRACBITS;
        var blockMapOriginY = map.blockMap.originY << this.FRACBITS;
        var _a = tmthing.getPosition(), x = _a[0], y = _a[1], z = _a[2];
        var tmthingX = -z;
        var tmthingY = -x;
        function forEachThing(x, y, func, things) {
            var blockPosSearch = y * map.blockMap.columnCount + x;
            for (var _i = 0, things_1 = things; _i < things_1.length; _i++) {
                var thing = things_1[_i];
                var blockx = (tmthingX - blockMapOriginX) >> MAPBLOCKSHIFT;
                var blocky = (tmthingY - blockMapOriginY) >> MAPBLOCKSHIFT;
                var blockPos = blocky * map.blockMap.columnCount + blockx;
                if (blockPosSearch === blockPos) {
                    if (!func(thing)) {
                        var _a = thing.getPosition(), x_1 = _a[0], y_1 = _a[1], z_1 = _a[2];
                        console.log("Collided with thing " + thing.thing.type + " at " + -z_1 + ":" + -x_1);
                        return false;
                    }
                }
            }
            return true;
        }
        function forEachLine(x, y, func) {
            if (x < 0 || y < 0 || x >= map.blockMap.columnCount || y >= map.blockMap.rowCount) {
                return true;
            }
            var offset = y * map.blockMap.columnCount + x;
            for (var lineIdx = offset;; lineIdx++) {
                var lineDef = map.lineDefs[lineIdx];
                if (!func(lineDef)) {
                    return false;
                }
            }
            return true; // everything was checked
        }
        var nx = newPos[0], ny = newPos[1], nz = newPos[2];
        var tx = -nz;
        var ty = -nx;
        var radius = tmthing.mobj.radius;
        var tmboxTop = ty + radius;
        var tmboxBottom = ty - radius;
        var tmboxRight = tx + radius;
        var tmboxLeft = tx - radius;
        var tmfloor = ny;
        var tmdropoff = ny;
        var tmCeiling = map.getSectorAt(tx, ty).ceilingHeight;
        var ceilingline;
        var xl = (tmboxLeft - blockMapOriginX - this.MAXRADIUS) >> this.MAPBLOCKSHIFT;
        var xh = (tmboxRight - blockMapOriginX + this.MAXRADIUS) >> this.MAPBLOCKSHIFT;
        var yl = (tmboxBottom - blockMapOriginY - this.MAXRADIUS) >> this.MAPBLOCKSHIFT;
        var yh = (tmboxTop - blockMapOriginY + this.MAXRADIUS) >> this.MAPBLOCKSHIFT;
        function PIT_CheckThing(thing) {
            if (!(thing.mobj.flags & (MF_SOLID | MF_SPECIAL | MF_SHOOTABLE))) {
                return true;
            }
            var blockdist = thing.mobj.radius + tmthing.mobj.radius;
            var _a = thing.getPosition(), x1 = _a[0], y2 = _a[1], z3 = _a[2];
            var thingx = -z;
            var thingy = -x;
            if (Math.abs(thingx - tmthingX) >= blockdist
                || Math.abs(thingy - tmthingY) >= blockdist) {
                return true; // didn't hit it
            }
            if (tmthing === thing) {
                return true;
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
                return false; // stop moving
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
                    return !(thing.mobj.flags & MF_SOLID);
                }
                // damage / explode
                // TODO
                // damage = ((P_Random()%8)+1)*tmthing->info->damage;
                // P_DamageMobj (thing, tmthing, tmthing->target, damage);
                // don't traverse any more
                return false;
            }
            // check for special pickup
            if (thing.mobj.flags & MF_SPECIAL) {
                var solid = thing.mobj.flags & MF_SOLID;
                if (tmthing.mobj.flags & MF_PICKUP) {
                    // can remove thing
                    // TODO
                    // P_TouchSpecialThing (thing, tmthing);
                }
                return !solid;
            }
            return !(thing.mobj.flags & MF_SOLID);
        }
        for (var bx = xl; bx <= xh; bx++)
            for (var by = yl; by <= yh; by++)
                if (!forEachThing(bx, by, PIT_CheckThing, this.liveThings))
                    return false;
        // check lines
        xl = (tmboxLeft - blockMapOriginX) >> MAPBLOCKSHIFT;
        xh = (tmboxRight - blockMapOriginX) >> MAPBLOCKSHIFT;
        yl = (tmboxBottom - blockMapOriginY) >> MAPBLOCKSHIFT;
        function PIT_CheckLine(linedef) {
            // TODO not sure
            var leftSide = map.sideDefs[linedef.leftSideDefIndex];
            var rightSide = map.sideDefs[linedef.rightSideDefIndex];
            var boxLeft, boxRight, boxTop, boxBottom;
            if (leftSide.offsetX < rightSide.offsetX) {
                boxLeft = leftSide.offsetX;
                boxRight = rightSide.offsetX;
            }
            else {
                boxLeft = rightSide.offsetX;
                boxRight = leftSide.offsetX;
            }
            if (leftSide.offsetY < rightSide.offsetY) {
                boxBottom = leftSide.offsetY;
                boxTop = rightSide.offsetY;
            }
            else {
                boxBottom = rightSide.offsetY;
                boxTop = leftSide.offsetY;
            }
            if (tmboxRight >= boxLeft
                || tmboxLeft >= boxRight
                || tmboxTop <= boxBottom
                || tmboxBottom >= boxTop) {
                return true;
            }
            function P_BoxOnLineSide(boxleft, boxRight, boxTop, boxBottom, lineDef) {
                var v1 = map.sideDefs[lineDef.leftSideDefIndex];
                var v2 = map.sideDefs[lineDef.rightSideDefIndex];
                var lddx = v2.offsetX - v1.offsetX;
                var lddy = v2.offsetY - v1.offsetY;
                var slopetype;
                if (!lddx)
                    slopetype = "ST_VERTICAL";
                else if (!lddy)
                    slopetype = "ST_HORIZONTAL";
                else if (lddy / lddx > 0)
                    slopetype = "ST_POSITIVE";
                else
                    slopetype = "ST_NEGATIVE";
                function P_PointOnLineSide(x, y, line, lddx, lddy, v1) {
                    if (!lddx) {
                        if (x <= v1.offsetX)
                            return lddy > 0;
                        return lddy < 0;
                    }
                    if (!lddy) {
                        if (y <= v1.offsetY)
                            return lddx < 0;
                        return lddy > 0;
                    }
                    var dx = (x - v1.offsetX);
                    var dy = (y - v1.offsetY);
                    var left = ((lddy >> FRACBITS) * dx) >> FRACBITS;
                    var right = (dy * (lddy >> FRACBITS)) >> FRACBITS;
                    if (right < left)
                        return 0; // front side
                    return 1; // back side
                }
                var p1, p2;
                switch (slopetype) {
                    case "ST_HORIZONTAL":
                        p1 = tmboxTop > v1.offsetY;
                        p2 = tmboxBottom > v1.offsetY;
                        if (lddx < 0) {
                            p1 ^= 1;
                            p2 ^= 1;
                        }
                        break;
                    case "ST_VERTICAL":
                        p1 = tmboxRight < v1.offsetX;
                        p2 = tmboxLeft < v1.offsetX;
                        if (lddy < 0) {
                            p1 ^= 1;
                            p2 ^= 1;
                        }
                        break;
                    case "ST_POSITIVE":
                        p1 = P_PointOnLineSide(tmboxLeft, tmboxTop, lineDef, lddx, lddy, v1);
                        p2 = P_PointOnLineSide(tmboxRight, tmboxBottom, lineDef, lddx, lddy, v1);
                        break;
                    case "ST_NEGATIVE":
                        p1 = P_PointOnLineSide(tmboxRight, tmboxTop, lineDef, lddx, lddy, v1);
                        p2 = P_PointOnLineSide(tmboxLeft, tmboxBottom, lineDef, lddx, lddy, v1);
                        break;
                }
                if (p1 == p2)
                    return p1;
                return -1;
            }
            if (P_BoxOnLineSide(tmboxLeft, tmboxRight, tmboxTop, tmboxBottom, linedef) != -1)
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
            var ML_BLOCKING = 1;
            var ML_BLOCKMONSTERS = 2;
            var backsector;
            if (linedef.rightSideDefIndex !== -1) {
                backsector = map.sideDefs[linedef.rightSideDefIndex].sectorIndex;
            }
            else {
                backsector = 0;
            }
            var frontsector;
            if (linedef.leftSideDefIndex != -1) {
                frontsector = map.sideDefs[linedef.leftSideDefIndex].sectorIndex;
            }
            else {
                frontsector = 0;
            }
            if (!backsector)
                return false; // one sided line
            if (!(tmthing.mobj.flags & MF_MISSILE)) {
                if (linedef.flags & ML_BLOCKING) {
                    return false; // explicitly blocking everything
                }
                if (tmthing.thing.type !== 1 && linedef.flags & ML_BLOCKMONSTERS)
                    return false; // block monsters only
            }
            function P_LineOpening(ld) {
                var openrange;
                var opentop;
                var openbottom;
                var lowfloor;
                if (ld.rightSideDefIndex === -1) {
                    // single sided line
                    openrange = 0;
                    return;
                }
                var frontCeiling = map.sectors[frontsector].ceilingHeight;
                var frontFloor = map.sectors[frontsector].floorHeight;
                var backCeiling = map.sectors[backsector].ceilingHeight;
                var backFloor = map.sectors[backsector].floorHeight;
                if (frontCeiling < backCeiling)
                    opentop = frontCeiling;
                else
                    opentop = backCeiling;
                if (frontFloor > backFloor) {
                    openbottom = frontFloor;
                    lowfloor = backFloor;
                }
                else {
                    openbottom = backFloor;
                    lowfloor = frontFloor;
                }
                openrange = opentop - openbottom;
                return [opentop, openbottom, lowfloor];
            }
            // set openrange, opentop, openbottom
            var _a = P_LineOpening(linedef), opentop = _a[0], openbottom = _a[1], lowfloor = _a[2];
            // adjust floor / ceiling heights
            if (opentop < tmCeiling) {
                tmCeiling = opentop;
                ceilingline = linedef;
            }
            if (openbottom > tmfloor)
                tmfloor = openbottom;
            if (lowfloor < tmdropoff)
                tmdropoff = lowfloor;
            // if contacted a special line, add it to the list
            if (linedef.specialType) {
                // TODO
                // spechit[numspechit] = ld;
                // numspechit++;
            }
            return true;
        }
        yh = (tmboxTop - blockMapOriginY) >> MAPBLOCKSHIFT;
        for (var bx = xl; bx <= xh; bx++)
            for (var by = yl; by <= yh; by++)
                if (!forEachLine(bx, by, PIT_CheckLine))
                    return false;
        return true;
    };
    return Game;
}());
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2FtZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImdhbWUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7SUFVSSxjQUFZLFFBQWtCO1FBa0s5QixlQUFVLEdBQWdCLEVBQUUsQ0FBQTtRQXFCNUIsYUFBUSxHQUFHLEVBQUUsQ0FBQTtRQUNiLGFBQVEsR0FBRSxDQUFDLENBQUMsSUFBRyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUE7UUFDN0IsY0FBUyxHQUFHLEVBQUUsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFBO1FBQzlCLGtCQUFhLEdBQUcsSUFBSSxDQUFDLFFBQVEsR0FBRyxDQUFDLENBQUE7UUF6TDdCLElBQUksQ0FBQyxlQUFlLEdBQUcsSUFBSSxTQUFTLEVBQUUsQ0FBQTtRQUN0QyxJQUFJLENBQUMsV0FBVyxHQUFHLENBQUMsQ0FBQTtRQUVwQixJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksUUFBUSxFQUFFLENBQUE7UUFDOUIsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLFFBQVEsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUE7UUFDbEQsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLFlBQVksQ0FBQyxRQUFRLENBQUMsQ0FBQTtRQUN2QyxJQUFJLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQTtRQUN4QixJQUFJLENBQUMsTUFBTSxHQUFHLEtBQUssQ0FBQTtJQUN2QixDQUFDO0lBRUQscUJBQU0sR0FBTixVQUFPLEVBQUU7UUFDTCxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxDQUFBO1FBQ2hCLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFBO1FBQ3hCLE9BQU8sSUFBSSxDQUFBO0lBQ2YsQ0FBQztJQUVELDBCQUFXLEdBQVg7UUFBQSxpQkFpQkM7UUFoQkcsSUFBSSxDQUFDLEtBQUssQ0FBQyxXQUFXLEVBQUUsQ0FBQTtRQUN4QixJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQTtRQUMxQixJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDYixnQkFBZ0IsQ0FBQyxjQUFjLENBQUMsQ0FBQTtTQUNuQzthQUFNO1lBQ0gsZ0JBQWdCLENBQUMsZUFBZSxDQUFDLENBQUE7U0FDcEM7UUFDRCxRQUFRLENBQUMsZ0JBQWdCLENBQUMsU0FBUyxDQUFDLENBQUMsT0FBTyxDQUFDLFVBQUEsQ0FBQztZQUMxQyxJQUFJLEtBQUksQ0FBQyxNQUFNLEVBQUU7Z0JBQ2IsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLENBQUE7Z0JBQzVCLEtBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQTthQUM5QjtpQkFBTTtnQkFDSCxDQUFDLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsQ0FBQTtnQkFDL0IsS0FBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFBO2FBQy9CO1FBQ0wsQ0FBQyxDQUFDLENBQUE7SUFDTixDQUFDO0lBRUQseUJBQVUsR0FBVixVQUFXLElBQUksRUFBRSxFQUFVO1FBQ3ZCLElBQUksSUFBSSxHQUFHLElBQUksQ0FBQTtRQUNmLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxVQUFBLENBQUM7WUFDeEIsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFBO1lBQ1YsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUU7Z0JBQ2QsSUFBSSxFQUFFLEtBQUssQ0FBQyxFQUFFO29CQUNWLEVBQUUsR0FBRyxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUE7aUJBQ3ZCO2FBQ0o7WUFDRCxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLEtBQUssS0FBSyxFQUFFO2dCQUMzQixPQUFNO2FBQ1Q7WUFDRCxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQTtRQUM1QixDQUFDLENBQUMsQ0FBQTtJQUNOLENBQUM7SUFFRCxtQkFBSSxHQUFKO1FBQUEsaUJBY0M7UUFiRyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUE7UUFDeEIsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFBO1FBQ3BFLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxXQUFXLENBQUMsY0FBTSxPQUFBLEtBQUksQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxFQUE1QixDQUE0QixDQUFDLENBQUE7UUFDN0UsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBRSxjQUFNLE9BQUEsS0FBSSxDQUFDLEtBQUssQ0FBQyxZQUFZLEVBQUUsRUFBekIsQ0FBeUIsQ0FBQyxDQUFBO1FBRTNFLElBQUksV0FBVyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQTtRQUNqRCxJQUFJLENBQUMsZUFBZSxDQUFDLFdBQVcsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUE7UUFDckUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxTQUFTLEdBQUcsT0FBTyxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQTtRQUNwRCxJQUFJLENBQUMsZUFBZSxDQUFDLEtBQUssR0FBRyxXQUFXLENBQUE7UUFDeEMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFBO1FBRWhFLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxZQUFZLEVBQUU7YUFDOUIsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUE7SUFDeEMsQ0FBQztJQUVELHdCQUFTLEdBQVQsVUFBVSxDQUFDLEVBQUMsQ0FBQztRQUNULElBQUksR0FBRyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFBO1FBQy9CLE9BQU8sR0FBRyxDQUFDLFdBQVcsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFBO0lBQzNDLENBQUM7SUFFTyxzQkFBTyxHQUFmLFVBQWdCLEVBQUU7UUFDZCxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQTtRQUNyQixJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDYixPQUFNO1NBQ1Q7UUFFRCxJQUFJLEtBQUssR0FBRyxHQUFHLENBQUE7UUFDZixJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUE7UUFDVixJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUE7UUFDVixJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUE7UUFDVixJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxFQUFFO1lBQzNELEVBQUUsSUFBSSxLQUFLLENBQUE7U0FDZDtRQUNELElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLEVBQUU7WUFDNUQsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFBO1NBQ2Y7UUFDRCxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFO1lBQ3hELEVBQUUsSUFBSSxLQUFLLENBQUE7U0FDZDtRQUNELElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLEVBQUU7WUFDekQsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFBO1NBQ2Y7UUFDRCw4REFBOEQ7UUFDOUQsbUJBQW1CO1FBQ25CLElBQUk7UUFDSixnRUFBZ0U7UUFDaEUsa0JBQWtCO1FBQ2xCLElBQUk7UUFFQSxJQUFBLG1DQUErQyxFQUE5QyxZQUFJLEVBQUUsY0FBd0MsQ0FBQTtRQUduRCwyREFBMkQ7UUFDM0QsSUFBSSxDQUFDLFdBQVcsSUFBSSxPQUFPLENBQUMsTUFBTSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQTtRQUM1QyxJQUFJLENBQUMsUUFBUSxDQUFDLFNBQVMsSUFBSSxPQUFPLENBQUMsSUFBSSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQTtRQUNqRCxJQUFJLElBQUksQ0FBQyxXQUFXLEdBQUcsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUU7WUFDakMsSUFBSSxDQUFDLFdBQVcsR0FBRyxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQTtTQUNsQztRQUFBLElBQUksSUFBSSxDQUFDLFdBQVcsR0FBRyxPQUFPLENBQUMsRUFBRSxDQUFDLEVBQUU7WUFDakMsSUFBSSxDQUFDLFdBQVcsR0FBRyxPQUFPLENBQUMsRUFBRSxDQUFDLENBQUE7U0FDakM7UUFFRCxJQUFJLE1BQU0sR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLFdBQVcsRUFBRSxDQUFBO1FBRS9DLElBQUksQ0FBQyxlQUFlLENBQUMsV0FBVyxDQUFDLEVBQUUsR0FBRyxFQUFFLEVBQUUsRUFBRSxHQUFHLEVBQUUsRUFBRSxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUE7UUFDM0QsSUFBSSxDQUFDLGVBQWUsQ0FBQyxjQUFjLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxXQUFXLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQTtRQUU3RSxJQUFBLHVDQUE0QyxFQUEzQyxTQUFDLEVBQUMsU0FBQyxFQUFDLFNBQXVDLENBQUE7UUFFaEQsSUFBSSxZQUFZLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFBO1FBQ3pDLElBQUksQ0FBQyxlQUFlLENBQUMsV0FBVyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsWUFBWSxHQUFHLENBQUMsR0FBRSxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFDLENBQUMsQ0FBQyxDQUFBO1FBRXZFLElBQUksTUFBTSxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsV0FBVyxFQUFFLENBQUE7UUFFL0MsSUFBSSxHQUFHLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUE7UUFDL0IsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxlQUFlLEVBQUUsTUFBTSxFQUFFLE1BQU0sQ0FBQyxFQUFFO1lBQy9ELHlCQUF5QjtTQUM1QjtRQUVELElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDekQscUNBQXFDO1lBQ3JDLElBQUksQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLE9BQU8sRUFBRSxHQUFHLENBQUMsQ0FBQTtZQUNyQywyQ0FBMkM7U0FDOUM7UUFDRCxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxFQUFFO1lBQzNELElBQUksQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQTtTQUN0QztRQUNELElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLEVBQUU7WUFDM0QsUUFBUSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxXQUFXLEdBQUcsa0NBQWtDLENBQUE7U0FDaEY7YUFBTTtZQUNILFFBQVEsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUMsV0FBVyxHQUFHLGtCQUFrQixDQUFBO1NBQ2hFO0lBRUwsQ0FBQztJQUVPLHdCQUFTLEdBQWpCO1FBQUEsaUJBRUM7UUFERyxPQUFPLENBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsVUFBQSxDQUFDLElBQUksT0FBQSxLQUFJLENBQUMsUUFBUSxDQUFDLG1CQUFtQixDQUFDLENBQUMsQ0FBQyxFQUFwQyxDQUFvQyxDQUFDLENBQUE7SUFDbEYsQ0FBQztJQUVPLHdCQUFTLEdBQWpCO1FBQ0ksSUFBSSxDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQTtRQUNwRCxJQUFJLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLGFBQWEsQ0FBQyxDQUFBO1FBQ3ZELElBQUksQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQTtRQUM3RSxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO1FBQzVDLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQTtRQUVqQixJQUFJLENBQUMsTUFBTSxHQUFHLEtBQUssQ0FBQTtRQUNuQixJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQTtJQUM5QixDQUFDO0lBSU8seUJBQVUsR0FBbEI7UUFDSSxLQUFvQixVQUE0QixFQUE1QixLQUFBLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sRUFBNUIsY0FBNEIsRUFBNUIsSUFBNEIsRUFBRTtZQUE3QyxJQUFNLEtBQUssU0FBQTtZQUNaLElBQUksSUFBSSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQTtZQUN6QyxJQUFJLElBQUksRUFBRTtnQkFDTixJQUFJLElBQUksQ0FBQyxlQUFlLENBQUMsS0FBSyxLQUFLLEtBQUssRUFBRTtvQkFDdEMsU0FBUTtpQkFDWDtnQkFDRCxJQUFJLFNBQVMsR0FBRyxJQUFJLFNBQVMsRUFBRSxDQUFBO2dCQUMvQixTQUFTLENBQUMsV0FBVyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUE7Z0JBQzVFLFNBQVMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUE7Z0JBQ3BELFNBQVMsQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFBO2dCQUN2QixTQUFTLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQTtnQkFDckIsSUFBSSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUE7Z0JBQ2pDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFBO2FBQ2xDO1NBRUo7SUFDTCxDQUFDO0lBU08sMkJBQVksR0FBcEIsVUFBcUIsR0FBWSxFQUFFLE9BQWtCLEVBQUUsTUFBZ0MsRUFBRSxNQUFnQztRQUVySCxJQUFJLGVBQWUsR0FBRyxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFBO1FBQzNELElBQUksZUFBZSxHQUFHLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUE7UUFFdkQsSUFBQSwwQkFBK0IsRUFBOUIsU0FBQyxFQUFDLFNBQUMsRUFBQyxTQUEwQixDQUFDO1FBQ3BDLElBQUksUUFBUSxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ2xCLElBQUksUUFBUSxHQUFHLENBQUMsQ0FBQyxDQUFBO1FBR2pCLFNBQVMsWUFBWSxDQUFDLENBQUMsRUFBQyxDQUFDLEVBQUMsSUFBSSxFQUFDLE1BQU07WUFDakMsSUFBSSxjQUFjLEdBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxRQUFRLENBQUMsV0FBVyxHQUFHLENBQUMsQ0FBQTtZQUNyRCxLQUFvQixVQUFNLEVBQU4saUJBQU0sRUFBTixvQkFBTSxFQUFOLElBQU0sRUFBRTtnQkFBdkIsSUFBTSxLQUFLLGVBQUE7Z0JBRVosSUFBSSxNQUFNLEdBQUcsQ0FBQyxRQUFRLEdBQUUsZUFBZSxDQUFDLElBQUksYUFBYSxDQUFBO2dCQUN6RCxJQUFJLE1BQU0sR0FBRyxDQUFDLFFBQVEsR0FBRyxlQUFlLENBQUMsSUFBSSxhQUFhLENBQUE7Z0JBRTFELElBQUksUUFBUSxHQUFHLE1BQU0sR0FBRyxHQUFHLENBQUMsUUFBUSxDQUFDLFdBQVcsR0FBRyxNQUFNLENBQUE7Z0JBRXpELElBQUksY0FBYyxLQUFLLFFBQVEsRUFBRTtvQkFDN0IsSUFBSSxDQUFDLElBQUksQ0FBRSxLQUFLLENBQUUsRUFBRzt3QkFDYixJQUFBLHdCQUE2QixFQUE1QixXQUFDLEVBQUMsV0FBQyxFQUFDLFdBQXdCLENBQUE7d0JBQ2pDLE9BQU8sQ0FBQyxHQUFHLENBQUMseUJBQXVCLEtBQUssQ0FBQyxLQUFLLENBQUMsSUFBSSxZQUFPLENBQUMsR0FBQyxTQUFJLENBQUMsR0FBRyxDQUFDLENBQUE7d0JBQ3JFLE9BQU8sS0FBSyxDQUFBO3FCQUNmO2lCQUNKO2FBQ0o7WUFDRCxPQUFPLElBQUksQ0FBQTtRQUNmLENBQUM7UUFFRCxTQUFTLFdBQVcsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxFQUFDLElBQUk7WUFDekIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEdBQUcsQ0FBQyxRQUFRLENBQUMsV0FBVyxJQUFJLENBQUMsSUFBSSxHQUFHLENBQUMsUUFBUSxDQUFDLFFBQVEsRUFBRTtnQkFDL0UsT0FBTyxJQUFJLENBQUM7YUFDZjtZQUNELElBQUksTUFBTSxHQUFHLENBQUMsR0FBRyxHQUFHLENBQUMsUUFBUSxDQUFDLFdBQVcsR0FBRSxDQUFDLENBQUE7WUFFNUMsS0FBSyxJQUFJLE9BQU8sR0FBRyxNQUFNLEdBQUksT0FBTyxFQUFFLEVBQUU7Z0JBQ3BDLElBQUksT0FBTyxHQUFHLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUE7Z0JBRW5DLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUU7b0JBQ2hCLE9BQU8sS0FBSyxDQUFBO2lCQUNmO2FBQ0o7WUFDRCxPQUFPLElBQUksQ0FBQSxDQUFDLHlCQUF5QjtRQUN6QyxDQUFDO1FBRUksSUFBQSxjQUFFLEVBQUMsY0FBRSxFQUFDLGNBQUUsQ0FBVTtRQUN2QixJQUFJLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQTtRQUNaLElBQUksRUFBRSxHQUFHLENBQUMsRUFBRSxDQUFBO1FBQ1osSUFBSSxNQUFNLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUE7UUFFaEMsSUFBSSxRQUFRLEdBQUcsRUFBRSxHQUFHLE1BQU0sQ0FBQTtRQUMxQixJQUFJLFdBQVcsR0FBRyxFQUFFLEdBQUcsTUFBTSxDQUFBO1FBQzdCLElBQUksVUFBVSxHQUFHLEVBQUUsR0FBRyxNQUFNLENBQUE7UUFDNUIsSUFBSSxTQUFTLEdBQUcsRUFBRSxHQUFHLE1BQU0sQ0FBQTtRQUUzQixJQUFJLE9BQU8sR0FBRyxFQUFFLENBQUE7UUFDaEIsSUFBSSxTQUFTLEdBQUcsRUFBRSxDQUFBO1FBQ2xCLElBQUksU0FBUyxHQUFHLEdBQUcsQ0FBQyxXQUFXLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDLGFBQWEsQ0FBQTtRQUVyRCxJQUFJLFdBQVcsQ0FBQTtRQUVmLElBQUksRUFBRSxHQUFHLENBQUMsU0FBUyxHQUFHLGVBQWUsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksSUFBSSxDQUFDLGFBQWEsQ0FBQTtRQUM3RSxJQUFJLEVBQUUsR0FBRyxDQUFDLFVBQVUsR0FBRyxlQUFlLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLElBQUksQ0FBQyxhQUFhLENBQUE7UUFDOUUsSUFBSSxFQUFFLEdBQUcsQ0FBQyxXQUFXLEdBQUcsZUFBZSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxJQUFJLENBQUMsYUFBYSxDQUFBO1FBQy9FLElBQUksRUFBRSxHQUFHLENBQUMsUUFBUSxHQUFHLGVBQWUsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksSUFBSSxDQUFDLGFBQWEsQ0FBQTtRQUU1RSxTQUFTLGNBQWMsQ0FBQyxLQUFnQjtZQUVwQyxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssR0FBRyxDQUFDLFFBQVEsR0FBRyxVQUFVLEdBQUcsWUFBWSxDQUFDLENBQUMsRUFBRTtnQkFDOUQsT0FBTyxJQUFJLENBQUE7YUFDZDtZQUNELElBQUksU0FBUyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFBO1lBRW5ELElBQUEsd0JBQWdDLEVBQS9CLFVBQUUsRUFBQyxVQUFFLEVBQUMsVUFBeUIsQ0FBQTtZQUNwQyxJQUFJLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQTtZQUNmLElBQUksTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFBO1lBQ2YsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sR0FBRyxRQUFRLENBQUMsSUFBSSxTQUFTO21CQUNyQyxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sR0FBRSxRQUFRLENBQUMsSUFBSSxTQUFTLEVBQUU7Z0JBQzVDLE9BQU8sSUFBSSxDQUFBLENBQUMsZ0JBQWdCO2FBQy9CO1lBQ0QsSUFBSSxPQUFPLEtBQUssS0FBSyxFQUFFO2dCQUNuQixPQUFPLElBQUksQ0FBQTthQUNkO1lBRUQsSUFBSSxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssR0FBRyxXQUFXLEVBQUU7Z0JBQ2xDLE9BQU87Z0JBQ1AscURBQXFEO2dCQUNyRCxFQUFFO2dCQUNGLGtEQUFrRDtnQkFDbEQsRUFBRTtnQkFDRixrQ0FBa0M7Z0JBQ2xDLHFEQUFxRDtnQkFDckQsRUFBRTtnQkFDRix1REFBdUQ7Z0JBQ3ZELE9BQU8sS0FBSyxDQUFBLENBQUUsY0FBYzthQUMvQjtZQUNELGdDQUFnQztZQUNoQyxJQUFJLE9BQU8sQ0FBQyxJQUFJLENBQUMsS0FBSyxHQUFHLFVBQVUsRUFBRTtnQkFDakMsT0FBTztnQkFDUCw4QkFBOEI7Z0JBQzlCLDhDQUE4QztnQkFDOUMsNEJBQTRCO2dCQUM1Qiw4Q0FBOEM7Z0JBQzlDLDhCQUE4QjtnQkFFOUIsMkJBQTJCO2dCQUMzQiw4Q0FBOEM7Z0JBQzlDLHVFQUF1RTtnQkFDdkUsMkVBQTJFO2dCQUMzRSwrQ0FBK0M7Z0JBQy9DLG9DQUFvQztnQkFDcEMsbUJBQW1CO2dCQUNuQixFQUFFO2dCQUNGLG9DQUFvQztnQkFDcEMsUUFBUTtnQkFDUix3Q0FBd0M7Z0JBQ3hDLGdEQUFnRDtnQkFDaEQsd0JBQXdCO2dCQUN4QixRQUFRO2dCQUNSLElBQUk7Z0JBRUosSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLEdBQUcsWUFBWSxDQUFDLEVBQUU7b0JBQ3BDLHVCQUF1QjtvQkFDdkIsT0FBTyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLEdBQUcsUUFBUSxDQUFDLENBQUE7aUJBQ3hDO2dCQUVELG1CQUFtQjtnQkFDbkIsT0FBTztnQkFDUCxxREFBcUQ7Z0JBQ3JELDBEQUEwRDtnQkFFMUQsMEJBQTBCO2dCQUMxQixPQUFPLEtBQUssQ0FBQTthQUNmO1lBRUQsMkJBQTJCO1lBQzNCLElBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLEdBQUcsVUFBVSxFQUFFO2dCQUMvQixJQUFJLEtBQUssR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssR0FBRyxRQUFRLENBQUE7Z0JBQ3ZDLElBQUksT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLEdBQUcsU0FBUyxFQUFFO29CQUNoQyxtQkFBbUI7b0JBQ25CLE9BQU87b0JBQ1Asd0NBQXdDO2lCQUMzQztnQkFDRCxPQUFPLENBQUMsS0FBSyxDQUFBO2FBQ2hCO1lBRUQsT0FBTyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLEdBQUcsUUFBUSxDQUFDLENBQUE7UUFDekMsQ0FBQztRQUVELEtBQUssSUFBSSxFQUFFLEdBQUMsRUFBRSxFQUFHLEVBQUUsSUFBRSxFQUFFLEVBQUcsRUFBRSxFQUFFO1lBQzFCLEtBQUssSUFBSSxFQUFFLEdBQUMsRUFBRSxFQUFHLEVBQUUsSUFBRSxFQUFFLEVBQUcsRUFBRSxFQUFFO2dCQUMxQixJQUFJLENBQUMsWUFBWSxDQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsY0FBYyxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUM7b0JBQ3BELE9BQU8sS0FBSyxDQUFDO1FBRXpCLGNBQWM7UUFDZCxFQUFFLEdBQUcsQ0FBQyxTQUFTLEdBQUcsZUFBZSxDQUFDLElBQUUsYUFBYSxDQUFDO1FBQ2xELEVBQUUsR0FBRyxDQUFDLFVBQVUsR0FBRyxlQUFlLENBQUMsSUFBRSxhQUFhLENBQUM7UUFDbkQsRUFBRSxHQUFHLENBQUMsV0FBVyxHQUFHLGVBQWUsQ0FBQyxJQUFFLGFBQWEsQ0FBQztRQUVwRCxTQUFTLGFBQWEsQ0FBQyxPQUFvQjtZQUN2QyxnQkFBZ0I7WUFDaEIsSUFBSSxRQUFRLEdBQUcsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsZ0JBQWdCLENBQUMsQ0FBQTtZQUNyRCxJQUFJLFNBQVMsR0FBRyxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQyxDQUFBO1lBRXZELElBQUksT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUUsU0FBUyxDQUFBO1lBQ3hDLElBQUksUUFBUSxDQUFDLE9BQU8sR0FBRyxTQUFTLENBQUMsT0FBTyxFQUFFO2dCQUN0QyxPQUFPLEdBQUcsUUFBUSxDQUFDLE9BQU8sQ0FBQztnQkFDM0IsUUFBUSxHQUFHLFNBQVMsQ0FBQyxPQUFPLENBQUE7YUFDL0I7aUJBQU07Z0JBQ0gsT0FBTyxHQUFHLFNBQVMsQ0FBQyxPQUFPLENBQUM7Z0JBQzVCLFFBQVEsR0FBRyxRQUFRLENBQUMsT0FBTyxDQUFBO2FBQzlCO1lBQ0QsSUFBSSxRQUFRLENBQUMsT0FBTyxHQUFHLFNBQVMsQ0FBQyxPQUFPLEVBQ3hDO2dCQUNJLFNBQVMsR0FBRyxRQUFRLENBQUMsT0FBTyxDQUFBO2dCQUM1QixNQUFNLEdBQUcsU0FBUyxDQUFDLE9BQU8sQ0FBQTthQUM3QjtpQkFFRDtnQkFDSSxTQUFTLEdBQUcsU0FBUyxDQUFDLE9BQU8sQ0FBQTtnQkFDN0IsTUFBTSxHQUFHLFFBQVEsQ0FBQyxPQUFPLENBQUE7YUFDNUI7WUFFRCxJQUFHLFVBQVUsSUFBSSxPQUFPO21CQUNqQixTQUFTLElBQUksUUFBUTttQkFDckIsUUFBUSxJQUFJLFNBQVM7bUJBQ3JCLFdBQVcsSUFBSSxNQUFNLEVBQUU7Z0JBQzFCLE9BQU8sSUFBSSxDQUFBO2FBQ2Q7WUFFRCxTQUFTLGVBQWUsQ0FBQyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxTQUFTLEVBQUUsT0FBb0I7Z0JBRS9FLElBQUksRUFBRSxHQUFHLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLGdCQUFnQixDQUFDLENBQUE7Z0JBQy9DLElBQUksRUFBRSxHQUFHLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLGlCQUFpQixDQUFDLENBQUE7Z0JBQ2hELElBQUksSUFBSSxHQUFHLEVBQUUsQ0FBQyxPQUFPLEdBQUcsRUFBRSxDQUFDLE9BQU8sQ0FBQTtnQkFDbEMsSUFBSSxJQUFJLEdBQUcsRUFBRSxDQUFDLE9BQU8sR0FBRyxFQUFFLENBQUMsT0FBTyxDQUFBO2dCQUNsQyxJQUFJLFNBQVMsQ0FBQTtnQkFFYixJQUFJLENBQUMsSUFBSTtvQkFDTCxTQUFTLEdBQUcsYUFBYSxDQUFBO3FCQUN4QixJQUFJLENBQUMsSUFBSTtvQkFDVixTQUFTLEdBQUcsZUFBZSxDQUFBO3FCQUMxQixJQUFJLElBQUksR0FBRyxJQUFJLEdBQUcsQ0FBQztvQkFDcEIsU0FBUyxHQUFHLGFBQWEsQ0FBQTs7b0JBRXpCLFNBQVMsR0FBRyxhQUFhLENBQUE7Z0JBRTdCLFNBQVMsaUJBQWlCLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxJQUFpQixFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsRUFBRTtvQkFDN0QsSUFBSSxDQUFDLElBQUksRUFDVDt3QkFDSSxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUMsT0FBTzs0QkFDZixPQUFPLElBQUksR0FBRyxDQUFDLENBQUM7d0JBRXBCLE9BQU8sSUFBSSxHQUFHLENBQUMsQ0FBQztxQkFDbkI7b0JBQ0QsSUFBSSxDQUFDLElBQUksRUFDVDt3QkFDSSxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUMsT0FBTzs0QkFDZixPQUFPLElBQUksR0FBRyxDQUFDLENBQUM7d0JBRXBCLE9BQU8sSUFBSSxHQUFFLENBQUMsQ0FBQztxQkFDbEI7b0JBRUQsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLE9BQU8sQ0FBQyxDQUFDO29CQUMxQixJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsT0FBTyxDQUFDLENBQUM7b0JBRTFCLElBQUksSUFBSSxHQUFHLENBQUMsQ0FBQyxJQUFJLElBQUksUUFBUSxDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksUUFBUSxDQUFDO29CQUNqRCxJQUFJLEtBQUssR0FBRyxDQUFDLEVBQUUsR0FBRyxDQUFDLElBQUksSUFBSSxRQUFRLENBQUMsQ0FBQyxJQUFJLFFBQVEsQ0FBQztvQkFFbEQsSUFBSSxLQUFLLEdBQUcsSUFBSTt3QkFDWixPQUFPLENBQUMsQ0FBQyxDQUFFLGFBQWE7b0JBQzVCLE9BQU8sQ0FBQyxDQUFDLENBQUcsWUFBWTtnQkFDNUIsQ0FBQztnQkFFRCxJQUFJLEVBQUUsRUFBRSxFQUFFLENBQUE7Z0JBQ1YsUUFBUSxTQUFTLEVBQ2pCO29CQUNJLEtBQUssZUFBZTt3QkFDaEIsRUFBRSxHQUFHLFFBQVEsR0FBRyxFQUFFLENBQUMsT0FBTyxDQUFDO3dCQUMzQixFQUFFLEdBQUcsV0FBVyxHQUFHLEVBQUUsQ0FBQyxPQUFPLENBQUM7d0JBQzlCLElBQUksSUFBSSxHQUFHLENBQUMsRUFDWjs0QkFDSSxFQUFFLElBQUksQ0FBQyxDQUFDOzRCQUNSLEVBQUUsSUFBSSxDQUFDLENBQUM7eUJBQ1g7d0JBQ0QsTUFBTTtvQkFFVixLQUFLLGFBQWE7d0JBQ2QsRUFBRSxHQUFHLFVBQVUsR0FBRSxFQUFFLENBQUMsT0FBTyxDQUFDO3dCQUM1QixFQUFFLEdBQUcsU0FBUyxHQUFHLEVBQUUsQ0FBQyxPQUFPLENBQUM7d0JBQzVCLElBQUksSUFBSSxHQUFHLENBQUMsRUFDWjs0QkFDSSxFQUFFLElBQUksQ0FBQyxDQUFDOzRCQUNSLEVBQUUsSUFBSSxDQUFDLENBQUM7eUJBQ1g7d0JBQ0QsTUFBTTtvQkFFVixLQUFLLGFBQWE7d0JBQ2QsRUFBRSxHQUFHLGlCQUFpQixDQUFFLFNBQVMsRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUM7d0JBQ3RFLEVBQUUsR0FBRyxpQkFBaUIsQ0FBRSxVQUFVLEVBQUUsV0FBVyxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDO3dCQUMxRSxNQUFNO29CQUVWLEtBQUssYUFBYTt3QkFDZCxFQUFFLEdBQUcsaUJBQWlCLENBQUUsVUFBVSxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQzt3QkFDdkUsRUFBRSxHQUFHLGlCQUFpQixDQUFFLFNBQVMsRUFBRSxXQUFXLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUM7d0JBQ3pFLE1BQU07aUJBQ2I7Z0JBRUQsSUFBSSxFQUFFLElBQUksRUFBRTtvQkFDUixPQUFPLEVBQUUsQ0FBQztnQkFDZCxPQUFPLENBQUMsQ0FBQyxDQUFDO1lBQ2QsQ0FBQztZQUVELElBQUksZUFBZSxDQUFFLFNBQVMsRUFBRSxVQUFVLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQzdFLE9BQU8sSUFBSSxDQUFDO1lBRWhCLHNCQUFzQjtZQUV0QixxREFBcUQ7WUFDckQsa0JBQWtCO1lBQ2xCLCtDQUErQztZQUMvQywyQ0FBMkM7WUFDM0MsNkNBQTZDO1lBQzdDLDBDQUEwQztZQUMxQyxvREFBb0Q7WUFDcEQsb0NBQW9DO1lBQ3BDLElBQU0sV0FBVyxHQUFHLENBQUMsQ0FBQTtZQUNyQixJQUFNLGdCQUFnQixHQUFHLENBQUMsQ0FBQTtZQUUxQixJQUFJLFVBQVUsQ0FBQTtZQUNkLElBQUksT0FBTyxDQUFDLGlCQUFpQixLQUFLLENBQUMsQ0FBQyxFQUFFO2dCQUNsQyxVQUFVLEdBQUcsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxXQUFXLENBQUE7YUFDbkU7aUJBQU07Z0JBQ0gsVUFBVSxHQUFHLENBQUMsQ0FBQTthQUNqQjtZQUNELElBQUksV0FBVyxDQUFBO1lBQ2YsSUFBSSxPQUFPLENBQUMsZ0JBQWdCLElBQUksQ0FBQyxDQUFDLEVBQUU7Z0JBQ2hDLFdBQVcsR0FBRyxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLFdBQVcsQ0FBQTthQUNuRTtpQkFBTTtnQkFDSCxXQUFXLEdBQUcsQ0FBQyxDQUFBO2FBQ2xCO1lBRUQsSUFBSSxDQUFDLFVBQVU7Z0JBQ1gsT0FBTyxLQUFLLENBQUMsQ0FBRSxpQkFBaUI7WUFFcEMsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLEdBQUcsVUFBVSxDQUFDLEVBQ3RDO2dCQUNJLElBQUksT0FBTyxDQUFDLEtBQUssR0FBRyxXQUFXLEVBQUU7b0JBQzdCLE9BQU8sS0FBSyxDQUFDLENBQUUsaUNBQWlDO2lCQUNuRDtnQkFDRCxJQUFLLE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxLQUFLLENBQUMsSUFBSSxPQUFPLENBQUMsS0FBSyxHQUFHLGdCQUFnQjtvQkFDN0QsT0FBTyxLQUFLLENBQUMsQ0FBQyxzQkFBc0I7YUFDM0M7WUFFRCxTQUFTLGFBQWEsQ0FBQyxFQUFFO2dCQUNyQixJQUFJLFNBQVMsQ0FBQTtnQkFDYixJQUFJLE9BQU8sQ0FBQTtnQkFDWCxJQUFJLFVBQVUsQ0FBQTtnQkFDZCxJQUFJLFFBQVEsQ0FBQTtnQkFDWixJQUFJLEVBQUUsQ0FBQyxpQkFBaUIsS0FBSyxDQUFDLENBQUMsRUFBRTtvQkFDN0Isb0JBQW9CO29CQUNwQixTQUFTLEdBQUcsQ0FBQyxDQUFBO29CQUNiLE9BQU07aUJBQ1Q7Z0JBRUQsSUFBSSxZQUFZLEdBQUcsR0FBRyxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsQ0FBQyxhQUFhLENBQUE7Z0JBQ3pELElBQUksVUFBVSxHQUFHLEdBQUcsQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLENBQUMsV0FBVyxDQUFBO2dCQUNyRCxJQUFJLFdBQVcsR0FBRyxHQUFHLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDLGFBQWEsQ0FBQTtnQkFDdkQsSUFBSSxTQUFTLEdBQUcsR0FBRyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQyxXQUFXLENBQUE7Z0JBRW5ELElBQUksWUFBWSxHQUFHLFdBQVc7b0JBQzFCLE9BQU8sR0FBRyxZQUFZLENBQUE7O29CQUV0QixPQUFPLEdBQUcsV0FBVyxDQUFBO2dCQUV6QixJQUFJLFVBQVUsR0FBRyxTQUFTLEVBQUU7b0JBQ3hCLFVBQVUsR0FBRyxVQUFVLENBQUE7b0JBQ3ZCLFFBQVEsR0FBRyxTQUFTLENBQUE7aUJBQ3ZCO3FCQUFNO29CQUNILFVBQVUsR0FBRyxTQUFTLENBQUE7b0JBQ3RCLFFBQVEsR0FBRyxVQUFVLENBQUE7aUJBQ3hCO2dCQUVELFNBQVMsR0FBRyxPQUFPLEdBQUcsVUFBVSxDQUFBO2dCQUNoQyxPQUFPLENBQUMsT0FBTyxFQUFFLFVBQVUsRUFBRSxRQUFRLENBQUMsQ0FBQTtZQUMxQyxDQUFDO1lBRUQscUNBQXFDO1lBQ2pDLElBQUEsMkJBQXlELEVBQXhELGVBQU8sRUFBRSxrQkFBVSxFQUFFLGdCQUFtQyxDQUFDO1lBRTlELGlDQUFpQztZQUNqQyxJQUFJLE9BQU8sR0FBRyxTQUFTLEVBQ3ZCO2dCQUNJLFNBQVMsR0FBRyxPQUFPLENBQUM7Z0JBQ3BCLFdBQVcsR0FBRyxPQUFPLENBQUM7YUFDekI7WUFFRCxJQUFJLFVBQVUsR0FBRyxPQUFPO2dCQUNwQixPQUFPLEdBQUcsVUFBVSxDQUFDO1lBRXpCLElBQUksUUFBUSxHQUFHLFNBQVM7Z0JBQ3BCLFNBQVMsR0FBRyxRQUFRLENBQUM7WUFFekIsa0RBQWtEO1lBQ2xELElBQUksT0FBTyxDQUFDLFdBQVcsRUFDdkI7Z0JBQ0ksT0FBTztnQkFDUCw0QkFBNEI7Z0JBQzVCLGdCQUFnQjthQUNuQjtZQUNELE9BQU8sSUFBSSxDQUFDO1FBQ2hCLENBQUM7UUFFRCxFQUFFLEdBQUcsQ0FBQyxRQUFRLEdBQUcsZUFBZSxDQUFDLElBQUUsYUFBYSxDQUFDO1FBRWpELEtBQUssSUFBSSxFQUFFLEdBQUMsRUFBRSxFQUFHLEVBQUUsSUFBRSxFQUFFLEVBQUcsRUFBRSxFQUFFO1lBQzFCLEtBQUssSUFBSSxFQUFFLEdBQUMsRUFBRSxFQUFHLEVBQUUsSUFBRSxFQUFFLEVBQUcsRUFBRSxFQUFFO2dCQUMxQixJQUFJLENBQUMsV0FBVyxDQUFFLEVBQUUsRUFBQyxFQUFFLEVBQUMsYUFBYSxDQUFDO29CQUNsQyxPQUFPLEtBQUssQ0FBQztRQUV6QixPQUFPLElBQUksQ0FBQTtJQUNmLENBQUM7SUFDTCxXQUFDO0FBQUQsQ0FBQyxBQXZrQkQsSUF1a0JDIn0=