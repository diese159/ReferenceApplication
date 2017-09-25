/***
	HTML5 <video> player impelmentation for HbbTV
***/



function VideoPlayerEME(element_id, profile, width, height){
	this.FILETYPES = {
		MP4:0,
		MPEG:1,
		DASH:2
	};
	this.DRMTYPES = {
		NONE:0,
		PLAYREADY:1,
		MARLIN:2,
		WIDEVINE:3
	};
	this.element_id = element_id;
	this.element = document.getElementById(element_id);
	if(!this.element){
		this.element = document.createElement("div");
		this.element.setAttribute("id", this.element_id);
	}
	$(this.element).addClass("hidden");
	this.fullscreenElement = this.element;
	this.width = width;
	this.height = height;
	this.visible = false;
	this.url = null;
	this.video = null;
	this.profile = profile;

	// Timers and intervals
	this.progressUpdateInterval = null;
	this.hidePlayerTimer = null;

	this.init();
}

VideoPlayerEME.prototype.init = function(){
	var self = this;
}

VideoPlayerEME.prototype.populate = function(){
	this.element.innerHTML = "";
	this.video = null;
	this.loadingImage = document.createElement("div");
	this.loadingImage.setAttribute("id", "loadingImage");
	this.loadingImage.addClass("hidden");
	this.element.appendChild(this.loadingImage);
	//this.element.appendChild(this.controls.element);
	this.setFullscreen(true);
}

VideoPlayerEME.prototype.displayPlayer = function( sec ){
	clearTimeout( this.hidePlayerTimer );
	$("#player").removeClass("hide");
	$("#player").addClass("show");
	if(sec){
		this.hidePlayerTimer = setTimeout( function(){
			$("#player").removeClass("show");
		}, sec * 1000);
	}
}

VideoPlayerEME.prototype.navigate = function(key){
	var self = this;
	
	console.log("Key code pressed: " + key);
	
	if( self.onAdBreak ){
		console.log("Navigation on ad break");
	}
	
	switch(key){
		case VK_UP:
			//self.controls.show();
			self.displayPlayer(5);
		break;

		case VK_DOWN:
			//self.controls.hide();
			self.displayPlayer(5);
		break;

		case VK_BACK:
		case VK_STOP:
			console.log("call: stop()");
			self.stop();
		break;

		case VK_LEFT:
		case VK_REWIND:
			if( !self.onAdBreak ){
				self.rewind( 30 );
				self.displayPlayer(5);
			}
			break;
		case VK_RIGHT:
		case VK_FAST_FWD:
			if( !self.onAdBreak ){
				self.forward( 30 );
				self.displayPlayer(5);
			}
			break;
		case VK_ENTER:
		case VK_PLAY_PAUSE:
		case VK_PAUSE:
		case VK_PLAY:
			if( !self.onAdBreak ){
				console.log("pauseplay ad?");
			}
			else{
				if( this.isPlaying() ){
					this.pause();
				}
				else{
					this.play();
				}
			}
		break;
		case VK_YELLOW:
			try{
				if( this.video.textTracks ){
					console.log("switch text Track");
					n = 0;
					$.each( this.video.textTracks, function(i, lang){
						console.log("Subtitles " + i + ": " + lang.language + " - " + lang.label + " mode: " + lang.mode);
						lang.mode = 'hidden';
						n++;
					} );
					this.subtitleTrack += 1;
					if( this.subtitleTrack >= n )
						this.subtitleTrack = -1;
					if( this.subtitleTrack >= 0 ){
						this.video.textTracks[ this.subtitleTrack ].mode = 'showing';
						console.log("set track " + this.subtitleTrack  + ": " + this.video.textTracks[ this.subtitleTrack ].language );
						showInfo("Switch subtitles to language: " + this.video.textTracks[ this.subtitleTrack ].label );
					}
					else{
						showInfo("Subtitles off");
					}
				}
			} catch( e ){
				console.log( e.description );
			}
		break;
		default:
			if( key >= VK_0 && key <= VK_9 ){
				self.showSubtitleTrack( key );
			}
		break;
	}
}

VideoPlayerEME.prototype.getStreamComponents = function(){
	/*
	try {
		if(typeof this.video.getComponents == 'function') {
			comps_a = vidobj.getComponents(vidobj.COMPONENT_TYPE_AUDIO);
			if (comps_a.length > 1) {
				showInfo("Found "+comps_a.length+" audio track(s)");
				$('#paudio').show();
			}
		} else {
			showInfo("Switching audio components not supported");
		}
	} catch (e) {
		showInfo("Switching audio components not supported");
	}
	*/
}

VideoPlayerEME.prototype.setDisplay = function( container ){
	if( container ){
		// detach from DOM
		var element = $(this.element).detach();
		element.addClass("hidden");
		// append into
		$(container).prepend( element );
		element.removeClass("hidden");
	}
	else{
		// if target not set, assume to set fullscreen
		this.setFullscreen(true);
	}
};
	
VideoPlayerEME.prototype.createPlayer = function(){
	var self = this;

	if( !$("#player")[0] ){
		$("body").append( '<div id="player" class="hide">'
			+'<div id="playposition"></div>'
			+'<div id="playtime"></div>'
			+'<div id="progress_currentTime" style="left:130px"></div>'
            +'<div id="progressbarbg"></div><div id="progressSeekable" style="transition03all"></div><div id="progressbar" style="transition03all"></div>'
			+'<div id="prew"></div>'
			+'<div id="ppauseplay" class="pause"><div class="vcrbtn"></div><span id="pauseplay"></span></div> '
			+'<div id="pff"></div>'
			+'</div>');
		console.log("Add player component");
	}

	if( this.profile.hbbtv == false ){
		try{
			this.video = $("<video id='video' data-dashjs-player controls></video>")[0];
			this.element.appendChild( this.video );
			var player = this.video;
			console.log( "video object created ", this.video );
		} catch( e ){
			console.log("Error creating dashjs video object ", e.description );
		}
		
		addEventListeners( player, 'ended abort', function(e){
			console.log( e.type );
			self.stop();
		} );
		
		var canplay = false;
		player.addEventListener('canplay', function(){
			canplay = true;
			console.log("canplay");
			// check prerolls on first start
			if( self.adBreaks ){
				console.log("has ads");
				var playPreroll = false;
				$.each( self.adBreaks, function(n, adBreak){
					if( !adBreak.played && adBreak.position == "preroll" ){
						console.log("found preroll ad");
						console.log("play preroll");
						adBreak.played = true;
						playPreroll = true;
						self.getAds( adBreak );
						return false;
					}
				});
				
			}
			
			if( !playPreroll ){
				player.play();
			}
			
		} );
		
	}
	else if( this.profile.hbbtv == "1.5" ){
		this.video = $("<object id='video' type='application/dash+xml'></object>")[0];
		this.element.appendChild( this.video );
	}
	else if( this.profile.hbbtv == "2.0" ){
		this.video = $("<video id='video' type='application/dash+xml' class='fullscreen'></video>")[0];
		this.element.appendChild( this.video );
		var player = this.video;
		
		console.log("html5 video object created");
		
		addEventListeners( player, 'ended abort', function(e){
			console.log( e.type );
			self.stop();
		} );
		
		player.addEventListener('error', function(e){
			self.setLoading(false);
			if( !self.video ){
				return;
			}
			try{
				var errorMessage = "undefined";
				switch( self.video.error.code ){
					case 1: /* MEDIA_ERR_ABORTED */ 
						errorMessage = "fetching process aborted by user";
						break;
					case 2: /* MEDIA_ERR_NETWORK */
						errorMessage = "error occurred when downloading";
						break;
					case 3: /* = MEDIA_ERR_DECODE */ 
						errorMessage = "error occurred when decoding";
						break;
					case 4: /* MEDIA_ERR_SRC_NOT_SUPPORTED */ 
						errorMessage = "audio/video not supported";
						break;
				}
				showInfo( "MediaError: " + errorMessage );
				
				Monitor.videoError( errorMessage );
			} catch(e){
				console.log("error reading video error code");
				console.log(e.description);
			}
		} );
		
		player.addEventListener('play', function(){ 
			console.log("video play event triggered");
		} );
		
		player.seektimer = null;
		player.addEventListener('seeked', function(){
			console.log("Seeked");
			player.play();
		});
		
		var canplay = false;
		player.addEventListener('canplay', function(){
			canplay = true;
			console.log("canplay");
			// check prerolls on first start
			if( self.adBreaks ){
				console.log("has ads");
				var playPreroll = false;
				$.each( self.adBreaks, function(n, adBreak){
					if( !adBreak.played && adBreak.position == "preroll" ){
						console.log("found preroll ad");
						console.log("play preroll");
						adBreak.played = true;
						playPreroll = true;
						self.getAds( adBreak );
						return false;
					}
				});
				
			}
			
			if( !playPreroll ){
				player.play();
			}
			
		} );
		
		player.addEventListener('loadedmetadata', function(){
			console.log("loadedmetadata");
			try{
				console.log( typeof self.setSubtitles );
				self.setSubtitles(); // set subtitles AFTER metadata load
				
				
			
			} catch( e ){
				console.log( e.description );
			}
		} );
		
		addEventListeners( player, "waiting", function(e){ 
			console.log( e.type );
			self.setLoading(true);
		} );
		
		addEventListeners( player, "waiting stalled suspend", function(e){ 
			console.log( e.type );
		} );
		
		addEventListeners( player, 'playing pause emptied', function(e){
			self.setLoading(false);
			console.log( e.type );
		} );
		
		
		player.addEventListener('ended emptied error', function(){
			self.setLoading(false);
			Monitor.videoEnded(console.log);
		} );
		
		player.addEventListener('progress', function(){
			//Monitor.videoBuffering(); 
			self.setLoading(false);
		} );
		
		player.addEventListener('pause', function(){
			Monitor.videoPaused(); 
			self.setLoading(false);
		} );
		
		player.addEventListener('playing', function(){
			Monitor.videoPlaying();
			self.setLoading(false);
			var tracks = self.video.videoTracks.length;
			console.log("Video tracks: " + tracks );
			
			// set up inband cue events listeners
			console.log("set up cuechange listeners");
			$.each( player.textTracks, function( i, track ){
				
				console.log("text track " + i);
				track.oncuechange = function(evt) {
					
					showInfo("cuechange! kind=" + this.kind);
					try{
						console.log( this.id );
					} catch(e){
						console.log("error", e.message );
					}
					try{
						console.log( this.data );
					} catch(e){
						console.log("error", e.message );
					}
					try{
						console.log( this.track );
					} catch(e){
						console.log("error", e.message );
					}
					try{
						console.log( this.track.activeCues );
					} catch(e){
						console.log("error", e.message );
					}
					try{
						
						var myTrack = this.track;             // track element is "this" 
						var myCues = myTrack.activeCues;      // activeCues is an array of current cues.                                                    
						if (myCues.length > 0) {              
							console.log( myCues[0].getCueAsSource() ); 
						}
					} catch(e){
						console.log("error", e.message );
					}
				};
				track.mode = "showing";
				//console.log( JSON.stringify( track ) );
				/*
				$(track).on("cuechange", function(evt) {
					showInfo("cuechange!");
					console.log( JSON.stringify( evt ) );
				});
				*/
			});
			
		} );
		
		
		player.addEventListener('timeupdate', function(){
			self.updateProgressBar();
			self.checkAds();
		} );
		
		player.seek = function( sec, absolute ){
			try{
				var target = ( absolute? sec : player.currentTime + sec);
				
				if( target < 0 )
					target = 0;
				else if( target > player.duration )
					return;
				
				console.log("position: " + player.currentTime + "s. seek "+sec+"s to " + target);
				// Set position
				player.currentTime = target;
			} catch(e){
				console.log("error seeking: " + e.description);
			}
		}
		
		return true;
	}
	return true;
}

/*
TODO: Add analytics
Monitor.videoConnecting(); // playstate 3
Monitor.videoStopped(callback); // käyttäjä  painaa back/stop tms // callbackkiin funkkari joka kutsutaan kun kaikki tulokset on lähetetty ja palataan takaisin videon toistosta
Monitor.switchAudio(lang); // code of language track
Monitor.switchSubtitle(lang); // annetaan valitun raidan kielikoodi
*/

// TODO: outband subtitles handling: https://developer.mozilla.org/en-US/Apps/Fundamentals/Audio_and_video_delivery/Adding_captions_and_subtitles_to_HTML5_video



VideoPlayerEME.prototype.setURL = function(url){
	console.log("setURL(",url,")");
	
	this.player = dashjs.MediaPlayer().create();
    this.player.initialize(document.querySelector("#video"), url, true);
	return;
};

VideoPlayerEME.prototype.checkAds = function(){
	//console.log("checkAds");
	if( this.adBreaks ){
		
		var position =  Math.floor( this.video.currentTime );
		var self = this;
		$.each( this.adBreaks, function(n, adBreak){
			if( !adBreak.played && adBreak.position == position ){
				console.log("found ad break at position " + position);
				adBreak.played = true;
				self.getAds( adBreak ); // play ads on current second
				return false;
			}
		} );
	}
};

VideoPlayerEME.prototype.prepareAdPlayers = function(){
	
	// if ad players are prepared do nothing
	if( $("#ad1")[0] && $("#ad2")[0] ){
		console.log("ready to play ads");
		return;
	}
	var self = this;
	// create new adPlayers
	self.adPlayer = [ $("<video id='ad1' type='video/mp4' preload='auto'></video>")[0], $("<video id='ad2' type='video/mp4' preload='auto'></video>")[0] ];
	self.element.appendChild( self.adPlayer[0] );
	self.element.appendChild( self.adPlayer[1] );
	self.element.appendChild( $("<div id='adInfo'></div>")[0] );
	
	console.log("html5 ad-video objects created");
	
	var adEnd = function(e){
		self.setLoading(false);
		
		console.log("ad ended. adCount="+ self.adCount + " adBuffer length: " + self.adBuffer.length );
		console.log( e.type );
		var player = $(this);
		if( self.adCount < self.adBuffer.length ){
			player.addClass("hide");
			
			self.playAds();
			
		}
		else{
			// no more ads, continue content
			console.log("No more ads, continue content video");
			self.onAdBreak = false;
			player.addClass("hide"); // hide ad video
			$("#adInfo").removeClass("show");
			
			self.video.play();
			$(self.video).removeClass("hide"); // show content video
		}
		
	};
	
	var onAdPlay = function(){ 
		//console.log("ad play event triggered");
		
		//$("#adInfo").html("");
	};
	
	var onAdProgress = function(e){ 
		//console.log( e.type );
	};
	
	var onAdTimeupdate = function(){
		//self.updateProgressBar();
		var timeLeft = Math.floor( this.duration - this.currentTime )
		if( timeLeft != NaN ){
			//console.log( timeLeft );
			$("#adInfo").addClass("show");
			$("#adInfo").html("Ad " + self.adCount + "/" + self.adBuffer.length + " (" + timeLeft + "s)" );
		}
	};
	
	addEventListeners( self.adPlayer[0], 'ended', adEnd );
	addEventListeners( self.adPlayer[1], 'ended', adEnd );
	addEventListeners( self.adPlayer[0], 'playing', onAdPlay );
	addEventListeners( self.adPlayer[1], 'playing', onAdPlay );
	addEventListeners( self.adPlayer[0], 'timeupdate', onAdTimeupdate );
	addEventListeners( self.adPlayer[1], 'timeupdate', onAdTimeupdate );
	addEventListeners( self.adPlayer[0], 'progress', onAdProgress );
	addEventListeners( self.adPlayer[1], 'progress', onAdProgress );
};

VideoPlayerEME.prototype.getAds = function( adBreak ){
	this.onAdBreak = true; // disable seeking
	this.adCount = 0;
	this.video.pause();
	var self = this;
	console.log("get ads breaks=" + adBreak.ads);
	$.get( "../getAds.php?breaks=" + adBreak.ads, function(ads){
		self.adBuffer = ads;
		//self.adCount = ads.length;
		console.log( "Got " + ads.length + " ads");
		
		self.prepareAdPlayers();
		
		self.playAds();
		
	}, "json" );
};

VideoPlayerEME.prototype.playAds = function(){
	this.onAdBreak = true; // disable seeking
	this.video.pause();
	$(this.video).addClass("hide");
	
	var self = this;
	
	var activeAdPlayer = self.adPlayer[ self.adCount % 2 ];
	var idleAdPlayer = self.adPlayer[ (self.adCount + 1) % 2 ];
	
	// for the first ad, set active ad src. Later the active players url is always set and preload before the player is activated
	if( self.adCount == 0 ){
		activeAdPlayer.src = self.adBuffer[ self.adCount ];
	}
	
	self.adCount++
	
	// set next ad url to idle player and preload it
	if( self.adBuffer.length > self.adCount ){
		idleAdPlayer.src = self.adBuffer[ self.adCount ];
		idleAdPlayer.load();
	}
	
	activeAdPlayer.play();
	$( activeAdPlayer ).removeClass("hide");
	$( idleAdPlayer ).addClass("hide");
};

VideoPlayerEME.prototype.setAdBreaks = function( breaks ){
	if( !breaks){
		this.breaks = null;
	}
	else{
		console.log("setAdBreaks(", breaks ,")");
		this.adBreaks = breaks;
	}
};

VideoPlayerEME.prototype.setDRM = function( system, la_url){
	if( !system ){
		this.drm = null;
	}
	else{
		console.log("setDRM(",la_url,")");
		this.drm = { la_url : la_url, system : system, ready : false, error : null};
	}
};

VideoPlayerEME.prototype.getVideoType = function(file_extension){
	if(file_extension == "mp4"){
		return this.FILETYPES.MP4;
	}
	else if(["mpg", "mpeg", "ts"].indexOf(file_extension) > -1){
		return this.FILETYPES.MPEG;
	}
	else if(file_extension == "mpd"){
		return this.FILETYPES.DASH;
	}
	return null;
};

VideoPlayerEME.prototype.sendLicenseRequest = function(callback){
	console.log("sendLicenseRequest()");
	
	/***
		Create DRM object and container for it
	***/
	if( !$("#drm")[0] ){
		$("body").append("<div id='drm'></div>");
	}
	$("#drm").html('<object id="oipfDrm" type="application/oipfDrmAgent" width="0" height="0"></object>');
	this.oipfDrm = $("#oipfDrm")[0];
	this.drm.successCallback = callback;
	var self = this;
	// Case Playready
	// TODO: other DRMs
	if( this.drm.system == "playready" ){
		var msgType = "application/vnd.ms-playready.initiator+xml";
		var xmlLicenceAcquisition =
		'<?xml version="1.0" encoding="utf-8"?>' +
		'<PlayReadyInitiator xmlns="http://schemas.microsoft.com/DRM/2007/03/protocols/">' +
		  '<LicenseServerUriOverride>' +
			'<LA_URL>' +
				this.drm.la_url +
			'</LA_URL>' +
		  '</LicenseServerUriOverride>' +
		'</PlayReadyInitiator>';
		var DRMSysID = "urn:dvb:casystemid:19219";
		
	}
	else if( this.drm.system == "marlin" ){
		var msgType = "application/vnd.marlin.drm.actiontoken+xml";
		var xmlLicenceAcquisition =
		'<?xml version="1.0" encoding="utf-8"?>' +
		'<Marlin xmlns="http://marlin-drm.com/epub"><Version>1.1</Version><RightsURL><RightsIssuer><URL>'+ this.drm.la_url +'</URL></RightsIssuer></RightsURL></Marlin>';
		var DRMSysID = "urn:dvb:casystemid:19188";
	}
	
	try {
		this.oipfDrm.onDRMMessageResult = drmMsgHandler;
	} catch (e) {
		console.log("sendLicenseRequest Error 1: " + e.message );
	}
	try {
		this.oipfDrm.onDRMRightsError = drmRightsErrorHandler;
	} catch (e) {
		console.log("sendLicenseRequest Error 2: " + e.message );
	}
	try {
		this.oipfDrm.sendDRMMessage(msgType, xmlLicenceAcquisition, DRMSysID);
	} catch (e) {
		console.log("sendLicenseRequest Error 3: " + e.message );
	}
	
	
	
	function drmMsgHandler(msgID, resultMsg, resultCode) {
		showInfo("msgID, resultMsg, resultCode: " + msgID +","+  resultMsg +","+ resultCode);
		var errorMessage = "";
		switch (resultCode) {
			case 0:
				self.drm.ready = true;
				console.log("call self.drm.successCallback()");
				self.drm.successCallback();
			break;
			case 1:
				errorMessage = ("DRM: Unspecified error");
			break;
			case 2:
				errorMessage = ("DRM: Cannot process request");
			break;
			case 3:
				errorMessage = ("DRM: Wrong format");
			break;
			case 4:
				errorMessage = ("DRM: User Consent Needed");
			break;
			case 5:
				errorMessage = ("DRM: Unknown DRM system");
			break;
		}
		
		if( resultCode > 0 ){
			showInfo( errorMessage );
			Monitor.drmError(errorMessage);
		}
	}

	function drmRightsErrorHandler(resultCode, id, systemid, issuer) {
		var errorMessage = "";
		switch (resultCode) {
			case 0:
				errorMessage = ("DRM: No license error");
			break;
			case 1:
				errorMessage = ("DRM: Invalid license error");
			break;
			case 2:
				errorMessage = ("license valid");
			break;
		}
		showInfo( errorMessage );
		Monitor.drmError(errorMessage);
	}
	

};

VideoPlayerEME.prototype.setSubtitles = function(){
	// out-of-band subtitles must be an array containing containing language code and source.ttml file url.
	
	try{
		var player = this.video;
		
		console.log("set subs from active assets metadata 'subtitles'");
		this.subtitles = menu.focus.subtitles;
		
		console.log( JSON.stringify( this.subtitles ) );
		
		if( this.subtitles && this.subtitles.length ){
			
			$.each( this.subtitles, function(i, lang){
				//console.log( lang );
				console.log("Subtitles " + i + ": " + lang.code + " - " + lang.src);
				//var track = $("<track name='subtitles' value='srclang:"+ lang.code +" src: " + lang.src + "' />")[0];

								
				var track = document.createElement("track");
				//track.kind = "captions";
				track.kind = "subtitles";
				track.label = "Language " + i;
				track.srclang = lang.code;
				track.src = lang.src;
				track.addEventListener("load", function() {
					console.log("text track ready: " + this.srclang);
					if( this.language == this.subtitles[0].code ){
						this.mode = "showing";
						//player.textTracks[0].mode = "showing"; // disabled?
					}
					else{
						this.mode = 'hidden';
					}
				});
				track.addEventListener("oncuechange", function() {
					console.log("oncuechange");
				});
				player.appendChild(track);
				
			} );
			console.log( "Text tracks: " + player.textTracks.length );
			$.each( player.textTracks, function(i, track){
				console.log( track );
			} );
			this.subtitleTrack = 0;
			player.textTracks[0].mode = "showing";
		}
		else{
			console.log( "no subs" );
		}
	} catch(e){
		console.log("r:582  " + e.description );
	}
};

VideoPlayerEME.prototype.showSubtitleTrack = function(nth){
	var player = this.video;
	if( player.textTracks.length <= nth ){
		console.log( "No track " + nth + " available. Tracklist length is " + player.textTracks.length );
		return;
	}
	// hide all tracks
	$.each( player.textTracks, function(i, track){
		track.mode = "hidden";
		console.log( track );
	} );
	
	// show selected
	player.TextTracks.TextTrack[nth].mode = "showing";
	
	$.each( player.textTracks, function(i, track){
		console.log( track.language + ": " + track.mode );
	} );
};


VideoPlayerEME.prototype.startVideo = function(fullscreen){
	console.log("startVideo()");
	
	try{
		var broadcast = $("#broadcast")[0];
		if( !broadcast ){
			$("body").append("<object type='video/broadcast' id='broadcast'></object>");
		}
		broadcast = $("#broadcast")[0];
		broadcast.bindToCurrentChannel();
		broadcast.stop();
		console.log("broadcast stopped");
	}
	catch(e){
		console.log("error stopping broadcast");
	}
	
	var self = this;
	
	if( this.drm && this.drm.ready == false ){
		console.log("Send DRM License aquistion");
		this.sendLicenseRequest( function( response ){
			console.log("license ready ", self.drm);
			if( self.drm.ready ){
				self.startVideo( fullscreen );
			}
			else if( self.drm.error ){
				showInfo( "Error: " + self.drm.error );
			}
			else{
				showInfo( "Unknown DRM error! " + JSON.stringify( response ));
			}
			//self.startVideo( fullscreen );
		} );
		return;
	}
	
	
	try{
		if( !self.video ){
			console.log("populate player and create video object");
			self.populate();
			self.createPlayer();
		}
	}
	catch(e){
		console.log( e.message );
		console.log( e.description );
	}
	
	try{	
		self.element.removeClass("hidden");
		self.visible = true;
		
		console.log("video.play()")
		self.video.play();
		if(fullscreen){
			self.setFullscreen(fullscreen);
			//self.controls.show();
			self.displayPlayer(5);
		}
	}
	catch(e){
		console.log( e.message );
		console.log( e.description );
	}
};



VideoPlayerEME.prototype.pause = function(){
	var self = this;
	try{
		self.video.pause();
		//self.controls.show();
		self.displayPlayer();
		console.log("video should be playing now");
	}
	catch(e){
		console.log(e);
	}
};

VideoPlayerEME.prototype.stop = function(){
	var self = this;
	
	// if video not exist
	if( !self.video ){
		self.clearVideo();
		return;
	}
	try{
		self.video.pause();
		console.log("video.pause(); succeed");
		self.clearVideo();
		console.log("clearVideo(); succeed");
	}
	catch(e){
		console.log("error stopping video");
		console.log(e.description);
	}
};

VideoPlayerEME.prototype.play = function(){
	var self = this;
	try{
		self.video.play();
		self.displayPlayer(5);
	}
	catch(e){
		console.log(e);
	}
};

VideoPlayerEME.prototype.rewind = function( sec ){
	var self = this;
	try{
		sec = sec || -30;
		if( sec > 0 ){
			sec = -sec;
		}
		//sec = Math.max(self.video.currentTime+sec, 0);
		console.log("rewind video "+ sec +"s");
		Monitor.videoSeek(sec);
		self.video.seek(sec);
		$("#prew").addClass("activated");
		clearTimeout( this.seekActiveTimer );
		this.seekActiveTimer = setTimeout( function(){
			$("#prew").removeClass("activated");
		}, 700);
	}
	catch(e){
		console.log(e.message);
		console.log(e.description);
	}
};

VideoPlayerEME.prototype.forward = function( sec ){
	var self = this;
	try{
		sec = sec || 30;
		
		if( self.video.duration > self.video.currentTime + sec ){
			Monitor.videoSeek(sec);
			self.video.seek(sec);
			console.log("forward video "+sec+"s");
			self.displayPlayer(5);
			$("#pff").addClass("activated");
			clearTimeout( this.seekActiveTimer );
			this.seekActiveTimer = setTimeout( function(){
				$("#pff").removeClass("activated");
			}, 700);
		}
	}
	catch(e){
		console.log(e);
	}
};

VideoPlayerEME.prototype.clearVideo = function(){
	var self = this;
	self.element.addClass("hidden");
	$("#player").removeClass("show");
	self.visible = false;
	try{
		if(self.video){
			self.video.pause();
			self.video.src = "";
			$( "#video" ).remove(); // clear from dom
			this.video = null;
		}
	}
	catch(e){
		console.log("Error at clearVideo()");
		console.log(e.description);
	}
	this.subtitles = null;
};

VideoPlayerEME.prototype.isFullscreen = function(){
	var self = this;
	return self.fullscreen;
};

VideoPlayerEME.prototype.isPlaying = function(){
	return ( this.video && !this.video.paused ); // return true/false
};

VideoPlayerEME.prototype.doPlayStateChange = function(){
	
};

VideoPlayerEME.prototype.updateProgressBar = function(){
	try{
		var self = this;
		var position = this.video.currentTime;
		var duration = this.video.duration;
		
		//console.log("update progress bar");
		
		pbar = document.getElementById("progressbar");

		var barWidth = Math.floor((position / duration) * 895 );
		if(barWidth > 895){
			barWidth = 895;
		}
		else if( barWidth < 0 ){
			barWidth = 0;
		}
		
		pbar.style.width = barWidth + "px";
		
		var play_position = barWidth;
		
		$("#playposition").css("left", play_position);
		$("#progress_currentTime").css("left", play_position);


		
		$("#playposition").html("");
		if(position){
			var pp_hours = Math.floor(position / 60 / 60);
			var pp_minutes = Math.floor((position-(pp_hours*60*60)) / 60);
			var pp_seconds = Math.round((position-(pp_hours*60*60)-(pp_minutes*60)));
			$("#playposition").html( addZeroPrefix(pp_hours) + ":" + addZeroPrefix(pp_minutes) + ":" + addZeroPrefix(pp_seconds) );
		}

		document.getElementById("playtime").innerHTML = "";
		if(duration){
			var pt_hours = Math.floor(duration / 60 / 60);
			var pt_minutes = Math.floor((duration-(pt_hours*60*60))  / 60);
			var pt_seconds = Math.round((duration-(pt_hours*60*60)-(pt_minutes*60)) );
			document.getElementById("playtime").innerHTML = addZeroPrefix(pt_hours) + ":" + addZeroPrefix(pt_minutes) + ":" + addZeroPrefix(pt_seconds);
		}
	} catch(e){
		console.log( e.message );
	}

};



VideoPlayerEME.prototype.setLoading = function(loading, reason){
	this.loading = loading;
	if(this.loading){
		this.loadingImage.removeClass("hidden");
	}
	else{
		this.loadingImage.addClass("hidden");
	}
	if(reason){
		console.log(reason);
	}
};

VideoPlayerEME.prototype.setFullscreen = function(fs){
	this.fullscreen = fs;
	if(fs){
		this.element.addClass("fullscreen");
		this.setDisplay( $("body")[0] ); // sets video player object to child of body
	}
	else{
		this.element.removeClass("fullscreen");
		this.setDisplay( menu.focus.element ); // sets video player object to child of focused tile element
		//this.controls.hide();
		$("#player").removeClass("show");
	}

};

VideoPlayerEME.prototype.isVisible = function(fs){
	return this.visible;
};