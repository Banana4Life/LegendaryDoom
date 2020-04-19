/*
	----------------------------------------------------------
	MIDI.Player : 0.3.1 : 2015-03-26
	----------------------------------------------------------
	https://github.com/mudcube/MIDI.js
	----------------------------------------------------------
*/

if (typeof MIDI === 'undefined') MIDI = {};
if (typeof MIDI.Player === 'undefined') MIDI.Player = {};

(function() { 'use strict';

var midi = MIDI.Player;
midi.currentTime = 0;
midi.endTime = 0; 
midi.restart = 0; 
midi.playing = false;
midi.timeWarp = 1;
midi.startDelay = 0;
midi.BPM = 120;

midi.start =
midi.resume = function(onsuccess) {
    if (midi.currentTime < -1) {
    	midi.currentTime = -1;
    }
    startAudio(midi.currentTime, null, onsuccess);
};

midi.pause = function() {
	var tmp = midi.restart;
	stopAudio();
	midi.restart = tmp;
};

midi.stop = function() {
	stopAudio();
	midi.restart = 0;
	midi.currentTime = 0;
};

midi.setListener = function(onsuccess) {
	onMidiEvent = onsuccess;
};

midi.removeListener = function() {
	onMidiEvent = undefined;
};

// helpers

midi.playMidiFile = function(midiFile, onsuccess, onprogress) {
	midi.stop()
	midi.replayer = new Replayer(midiFile, midi.timeWarp, null, midi.BPM);
	midi.data = midi.replayer.getData();
	midi.endTime = getLength();
	MIDI.loadPlugin({
		instruments: midiFile['instruments'],
		onsuccess: midi.start,
		onprogress: onprogress,
		onerror: console.log,
		soundfontUrl: "https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/",
		api: "webaudio"
	});
}

midi.loadMidiFile = function(onsuccess, onprogress, onerror) {
	try {
		let midiFile = MidiFile(midi.currentData);
		midi.replayer = new Replayer(midiFile, midi.timeWarp, null, midi.BPM);
		midi.data = midi.replayer.getData();
		midi.endTime = getLength();

		MIDI.loadPlugin({
			instruments: midiFile['instruments'],
			onsuccess: onsuccess,
			onprogress: onprogress,
			onerror: onerror,
			soundfontUrl: "https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/"
		});
	} catch(event) {
		onerror && onerror(event);
	}
};

midi.loadFile = function(file, onsuccess, onprogress, onerror) {
	midi.stop();
	if (file instanceof Uint8Array) {
		midi.currentData = file;
		midi.loadMidiFile(onsuccess, onprogress, onerror)
	}
	else if (file.indexOf('base64,') !== -1) {
		midi.currentData = window.atob(file.split(',')[1]);;
		midi.loadMidiFile(onsuccess, onprogress, onerror);
	} else {
		var fetch = new XMLHttpRequest();
		fetch.open('GET', file);
		fetch.overrideMimeType('text/plain; charset=x-user-defined');
		fetch.onreadystatechange = function() {
			if (this.readyState === 4) {
				if (this.status === 200) {
					var t = this.responseText || '';
					var ff = [];
					var mx = t.length;
					var scc = String.fromCharCode;
					for (var z = 0; z < mx; z++) {
						ff[z] = scc(t.charCodeAt(z) & 255);
					}
					///
					var data = ff.join('');
					midi.currentData = data;
					midi.loadMidiFile(onsuccess, onprogress, onerror);
				} else {
					onerror && onerror('Unable to load MIDI file');
				}
			}
		};
		fetch.send();
	}
};

// Playing the audio

var eventQueue = []; // hold events to be triggered
var queuedTime; // 
var startTime = 0; // to measure time elapse
var noteRegistrar = {}; // get event for requested note
var onMidiEvent = undefined; // listener
var scheduleTracking = function(channel, note, currentTime, offset, message, velocity, time) {
	return setTimeout(function() {
		var data = {
			channel: channel,
			note: note,
			now: currentTime,
			end: midi.endTime,
			message: message,
			velocity: velocity
		};
		//
		if (message === 128) {
			delete noteRegistrar[note];
		} else {
			noteRegistrar[note] = data;
		}
		if (onMidiEvent) {
			onMidiEvent(data);
		}
		midi.currentTime = currentTime;
		///
		eventQueue.shift();
		///
		if (eventQueue.length < 1000) {
			startAudio(queuedTime, true);
		} else if (midi.currentTime === queuedTime && queuedTime < midi.endTime) { // grab next sequence
			startAudio(queuedTime, true);
		}
	}, currentTime - offset);
};

var getContext = function() {
	if (MIDI.api === 'webaudio') {
		return MIDI.WebAudio.getContext();
	} else {
		midi.ctx = {currentTime: 0};
	}
	return midi.ctx;
};

var getLength = function() {
	var data =  midi.data;
	var length = data.length;
	var totalTime = 0.5;
	for (var n = 0; n < length; n++) {
		totalTime += data[n][1];
	}
	return totalTime;
};

var __now;
var getNow = function() {
    if (window.performance && window.performance.now) {
        return window.performance.now();
    } else {
		return Date.now();
	}
};

var startAudio = function(currentTime, fromCache, onsuccess) {
	if (!midi.replayer) {
		return;
	}
	if (!fromCache) {
		if (typeof currentTime === 'undefined') {
			currentTime = midi.restart;
		}
		///
		midi.playing && stopAudio();
		midi.playing = true;
		midi.data = midi.replayer.getData();
		midi.endTime = getLength();
	}
	///
	var note;
	var offset = 0;
	var messages = 0;
	var data = midi.data;
	var ctx = getContext();
	var length = data.length;
	//
	queuedTime = 0.5;
	///
	var interval = eventQueue[0] && eventQueue[0].interval || 0;
	var foffset = currentTime - midi.currentTime;
	///
	if (MIDI.api !== 'webaudio') { // set currentTime on ctx
		var now = getNow();
		__now = __now || now;
		ctx.currentTime = (now - __now) / 1000;
	}
	///
	startTime = ctx.currentTime;
	///
	for (var n = 0; n < length && messages < 100; n++) {
		var obj = data[n];
		if ((queuedTime += obj[1]) <= currentTime) {
			offset = queuedTime;
			continue;
		}
		///
		currentTime = queuedTime - offset;
		///
		var event = obj[0].event;
		if (event.type !== 'channel') {
			continue;
		}
		///
		var channelId = event.channel;
		var channel = MIDI.channels[channelId];
		var delay = ctx.currentTime + ((currentTime + foffset + midi.startDelay) / 1000);
		var queueTime = queuedTime - offset + midi.startDelay;
		switch (event.subtype) {
			case 'controller':
				MIDI.setController(channelId, event.controllerType, event.value, delay);
				break;
			case 'programChange':
				MIDI.programChange(channelId, event.programNumber, delay);
				break;
			case 'pitchBend':
				MIDI.pitchBend(channelId, event.value, delay);
				break;
			case 'noteOn':
				if (channel.mute) break;
				note = event.noteNumber - (midi.MIDIOffset || 0);
				eventQueue.push({
				    event: event,
				    time: queueTime,
				    source: MIDI.noteOn(channelId, event.noteNumber, event.velocity, delay),
				    interval: scheduleTracking(channelId, note, queuedTime + midi.startDelay, offset - foffset, 144, event.velocity)
				});
				messages++;
				break;
			case 'noteOff':
				if (channel.mute) break;
				note = event.noteNumber - (midi.MIDIOffset || 0);
				eventQueue.push({
				    event: event,
				    time: queueTime,
				    source: MIDI.noteOff(channelId, event.noteNumber, delay),
				    interval: scheduleTracking(channelId, note, queuedTime, offset - foffset, 128, 0)
				});
				break;
			default:
				break;
		}
	}
	///
	onsuccess && onsuccess(eventQueue);
};

var stopAudio = function() {
	var ctx = getContext();
	midi.playing = false;
	midi.restart += (ctx.currentTime - startTime) * 1000;
	// stop the audio, and intervals
	while (eventQueue.length) {
		var o = eventQueue.pop();
		window.clearInterval(o.interval);
		if (!o.source) continue; // is not webaudio
		if (typeof(o.source) === 'number') {
			window.clearTimeout(o.source);
		} else { // webaudio
			o.source.disconnect(0);
		}
	}
	// run callback to cancel any notes still playing
	for (var key in noteRegistrar) {
		var o = noteRegistrar[key]
		if (noteRegistrar[key].message === 144 && onMidiEvent) {
			onMidiEvent({
				channel: o.channel,
				note: o.note,
				now: o.now,
				end: o.end,
				message: 128,
				velocity: o.velocity
			});
		}
	}
	// reset noteRegistrar
	noteRegistrar = {};
};

})();