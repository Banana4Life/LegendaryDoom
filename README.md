LegendaryDoom
=============

A reimplementation of the Doom game using pure WebGL, keeping the spirit of classical games alive! It is amazing what the developers of Doom made possible with the equipment available at the time.

In order to play this game, you will need to have a valid Doom 1 WAD (IWAD to be precise, no PWAD support as of now).

How to "play"
-------------

In its current form it can hardly be considered a game, but in case you want to toy around with it:

1. Find yourself a original doom compatible WAD file (patch files are not supported yet)
2. Drag the file onto the "wad"-labeled box on the right
3. Wait for the game screen to populate
4. Click on the game screen and let the browser capture your mouse and keyboard (ESC key to leave)
5. Use WASD and mouse to move around

The state of the engine implementation
--------------------------------------

* Most of original Doom's WAD file format can be read
* Map-meshes are generated from the level data
* Things are spawned, walls are rendered
* The skybox is approximated
* Sounds can be played
* Music can be played (the soundfont is not nice though)
* Rough collision detection

What's missing
--------------

* Gameplay
* Proper collisions
* Floors and ceilings
* Sprite rendering
* Multiplayer (wait for next time :))

Browser Support
---------------

The game has been developed with Chromium and Firefox, other browses may or may not work, not guarantees given. Firefox may hang for a moment while loading the game assets due to the MUS -> MIDI conversion of the music.
