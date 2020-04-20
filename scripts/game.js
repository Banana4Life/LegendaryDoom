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
            this.cameraTransform.setPosition(oldPos);
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
                        // console.log(`Collided with thing ${thing.thing.type} at ${-z}:${-x}`)
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
            var blockdist = (thing.mobj.radius >> FRACBITS) + (tmthing.mobj.radius >> FRACBITS);
            var _a = thing.getPosition(), x1 = _a[0], y1 = _a[1], z1 = _a[2];
            var thingx = -z1;
            var thingy = -x1;
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
                    console.log("Pickup " + thing.mobj.doomednum);
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
        yh = (tmboxTop - blockMapOriginY) >> MAPBLOCKSHIFT;
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
        for (var bx = xl; bx <= xh; bx++)
            for (var by = yl; by <= yh; by++)
                if (!forEachLine(bx, by, PIT_CheckLine))
                    return false;
        return true;
    };
    return Game;
}());
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2FtZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImdhbWUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7SUFVSSxjQUFZLFFBQWtCO1FBbUs5QixlQUFVLEdBQWdCLEVBQUUsQ0FBQTtRQXFCNUIsYUFBUSxHQUFHLEVBQUUsQ0FBQTtRQUNiLGFBQVEsR0FBRSxDQUFDLENBQUMsSUFBRyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUE7UUFDN0IsY0FBUyxHQUFHLEVBQUUsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFBO1FBQzlCLGtCQUFhLEdBQUcsSUFBSSxDQUFDLFFBQVEsR0FBRyxDQUFDLENBQUE7UUExTDdCLElBQUksQ0FBQyxlQUFlLEdBQUcsSUFBSSxTQUFTLEVBQUUsQ0FBQTtRQUN0QyxJQUFJLENBQUMsV0FBVyxHQUFHLENBQUMsQ0FBQTtRQUVwQixJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksUUFBUSxFQUFFLENBQUE7UUFDOUIsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLFFBQVEsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUE7UUFDbEQsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLFlBQVksQ0FBQyxRQUFRLENBQUMsQ0FBQTtRQUN2QyxJQUFJLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQTtRQUN4QixJQUFJLENBQUMsTUFBTSxHQUFHLEtBQUssQ0FBQTtJQUN2QixDQUFDO0lBRUQscUJBQU0sR0FBTixVQUFPLEVBQUU7UUFDTCxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxDQUFBO1FBQ2hCLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFBO1FBQ3hCLE9BQU8sSUFBSSxDQUFBO0lBQ2YsQ0FBQztJQUVELDBCQUFXLEdBQVg7UUFBQSxpQkFpQkM7UUFoQkcsSUFBSSxDQUFDLEtBQUssQ0FBQyxXQUFXLEVBQUUsQ0FBQTtRQUN4QixJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsSUFB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