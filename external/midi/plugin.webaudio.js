/*
	----------------------------------------------------------
	Web Audio API - OGG or MPEG Soundbank
	----------------------------------------------------------
	http://webaudio.github.io/web-audio-api/
	----------------------------------------------------------
*/

(function(root) { 'use strict';

	window.AudioContext && (function() {
		var audioContext = null; // new AudioContext();
		var useStreamingBuffer = false; // !!audioContext.createMediaElementSource;
		var midi = root.WebAudio = {api: 'webaudio'};
		var ctx; // audio context
		var sources = {};
		var effects = {};
		var masterVolume = 127;
		var audioBuffers = {};
		///
		midi.audioBuffers = audioBuffers;
		midi.send = function(data, delay) { };
		midi.setController = function(channelId, type, value, delay) { };

		midi.setVolume = function(channelId, volume, delay) {
			if (delay) {
				setTimeout(function() {
					masterVolume = volume;
				}, delay * 1000);
			} else {
				masterVolume = volume;
			}
		};

		midi.programChange = function(channelId, program, delay) {
// 			if (delay) {
// 				return setTimeout(function() {
// 					var channel = root.channels[channelId];
// 					channel.instrument = program;
// 				}, delay);
// 			} else {
				var channel = root.channels[channelId];
				channel.instrument = program;
// 			}
		};

		midi.pitchBend = function(channelId, program, delay) {
// 			if (delay) {
// 				setTimeout(function() {
// 					var channel = root.channels[channelId];
// 					channel.pitchBend = program;
// 				}, delay);
// 			} else {
				var channel = root.channels[channelId];
				channel.pitchBend = program;
// 			}
		};

		midi.noteOn = function(channelId, noteId, velocity, delay) {
			delay = delay || 0;

			/// check whether the note exists
			var channel = root.channels[channelId];
			var instrument = channel.instrument;
			var bufferId = instrument + '' + noteId;
			var buffer = audioBuffers[bufferId];
			if (!buffer) {
				MIDI.soundf
				console.log("Missing Note" + MIDI.GM.byId[instrument].id, instrument, channelId);
				return;
			}

			/// convert relative delay to absolute delay
			if (delay < ctx.currentTime) {
				delay += ctx.currentTime;
			}
		
			/// create audio buffer
			if (useStreamingBuffer) {
				var source = ctx.createMediaElementSource(buffer);
			} else { // XMLHTTP buffer
				var source = ctx.createBufferSource();
				source.buffer = buffer;
			}

			/// add effects to buffer
			if (effects) {
				var chain = source;
				for (var key in effects) {
					chain.connect(effects[key].input);
					chain = effects[key];
				}
			}

			/// add gain + pitchShift
			var gain = (velocity / 127) * (masterVolume / 127) * 2 - 1;
			source.connect(ctx.destination);
			source.playbackRate.value = 1; // pitch shift 
			source.gainNode = ctx.createGain(); // gain
			source.gainNode.connect(ctx.destination);
			source.gainNode.gain.value = Math.min(1.0, Math.max(-1.0, gain));
			source.connect(source.gainNode);
			///
			if (useStreamingBuffer) {
				if (delay) {
					return setTimeout(function() {
						buffer.currentTime = 0;
						buffer.play()
					}, delay * 1000);
				} else {
					buffer.currentTime = 0;
					buffer.play()
				}
			} else {
				source.start(delay || 0);
			}
			///
			sources[channelId + '' + noteId] = source;
			///
			return source;
		};

		midi.noteOff = function(channelId, noteId, delay) {
			delay = delay || 0;

			/// check whether the note exists
			var channel = root.channels[channelId];
			var instrument = channel.instrument;
			var bufferId = instrument + '' + noteId;
			var buffer = audioBuffers[bufferId];
			if (buffer) {
				if (delay < ctx.currentTime) {
					delay += ctx.currentTime;
				}
				///
				var source = sources[channelId + '' + noteId];
				if (source) {
					if (source.gainNode) {
						// @Miranet: 'the values of 0.2 and 0.3 could of course be used as 
						// a 'release' parameter for ADSR like time settings.'
						// add { 'metadata': { release: 0.3 } } to soundfont files
						var gain = source.gainNode.gain;
						gain.linearRampToValueAtTime(gain.value, delay);
						gain.linearRampToValueAtTime(-1.0, delay + 0.3);
					}
					///
					if (useStreamingBuffer) {
						if (delay) {
							setTimeout(function() {
								buffer.pause();
							}, delay * 1000);
						} else {
							buffer.pause();
						}
					} else {
						if (source.noteOff) {
							source.noteOff(delay + 0.5);
						} else {
							source.stop(delay + 0.5);
						}
					}
					///
					delete sources[channelId + '' + noteId];
					///
					return source;
				}
			}
		};

		midi.chordOn = function(channel, chord, velocity, delay) {
			var res = {};
			for (var n = 0, note, len = chord.length; n < len; n++) {
				res[note = chord[n]] = midi.noteOn(channel, note, velocity, delay);
			}
			return res;
		};

		midi.chordOff = function(channel, chord, delay) {
			var res = {};
			for (var n = 0, note, len = chord.length; n < len; n++) {
				res[note = chord[n]] = midi.noteOff(channel, note, delay);
			}
			return res;
		};

		midi.stopAllNotes = function() {
			for (var sid in sources) {
				var delay = 0;
				if (delay < ctx.currentTime) {
					delay += ctx.currentTime;
				}
				var source = sources[sid];
				source.gain.linearRampToValueAtTime(1, delay);
				source.gain.linearRampToValueAtTime(0, delay + 0.3);
				if (source.noteOff) { // old api
					source.noteOff(delay + 0.3);
				} else { // new api
					source.stop(delay + 0.3);
				}
				delete sources[sid];
			}
		};

		midi.setEffects = function(list) {
			if (ctx.tunajs) {
				for (var n = 0; n < list.length; n ++) {
					var data = list[n];
					var effect = new ctx.tunajs[data.type](data);
					effect.connect(ctx.destination);
					effects[data.type] = effect;
				}
			} else {
				return console.log('Effects module not installed.');
			}
		};

		midi.connect = function(opts) {
			root.setDefaultPlugin(midi);
			midi.setContext(ctx || createAudioContext(), opts.onsuccess);
		};
	
		midi.getContext = function() {
			return ctx;
		};
	
		midi.setContext = function(newCtx, onload, onprogress, onerror) {
			ctx = newCtx;

			/// tuna.js effects module - https://github.com/Dinahmoe/tuna
			if (typeof Tuna !== 'undefined' && !ctx.tunajs) {
				ctx.tunajs = new Tuna(ctx);
			}
		
			/// loading audio files
			var urls = [];
			var notes = root.keyToNote;
			for (var key in notes) urls.push(key);
			var requestAudio = function(soundfont, instrumentId, index, key) {
				var url = soundfont[key];
				if (url) {
					bufferPending[instrumentId] ++;
					return loadAudio(url).then(buffer => {
						buffer.id = key;
						let noteId = root.keyToNote[key];
						audioBuffers[instrumentId + '' + noteId] = buffer;
					})
				}
				console.log("Missing url for soundfont " + instrumentId + " " + key)
				return Promise.reject()
			};

			let allPromise = Promise.resolve()

			///
			let bufferPending = {};
			for (let instrument in root.Soundfont) {
				let soundfont = root.Soundfont[instrument];
				if (soundfont.isLoaded) {
					continue;
				}
				///
				let synth = root.GM.byName[instrument];
				let instrumentId = synth.number;
				///
				bufferPending[instrumentId] = 0;
				///
				allPromise = allPromise.then(() => {
					let promise = Promise.resolve()
					console.log(`Load instrument ${instrumentId}`)
					for (let index = 0; index < urls.length; index++) {
						let key = urls[index];
						promise = promise.then(() => requestAudio(soundfont, instrumentId, index, key))
					}
					promise = promise.then(() => {
						console.log(`Loaded instrument ${instrumentId}`)
						soundfont.isLoaded = true;
					})
					return promise

				})
			}

			allPromise.then(onload).catch(onerror)
		};

		function convertDataURIToBinary(base64) {
			let raw = atob(base64);
			let rawLength = raw.length;
			let array = new Uint8Array(new ArrayBuffer(rawLength));

			for(let i = 0; i < rawLength; i++) {
				array[i] = raw.charCodeAt(i);
			}
			return array;
		}

		/* Load audio file: streaming | base64 | arraybuffer
		---------------------------------------------------------------------- */
		function loadAudio(url) {
			let base64 = url.split(',')[1];
			let array = convertDataURIToBinary(base64)
			return ctx.decodeAudioData(array.buffer)
		}
		
		function createAudioContext() {
			return new (window.AudioContext || window.webkitAudioContext)();
		}
	})();
})(MIDI);

var foobar