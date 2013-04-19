		window.onbeforeunload = function (event) {
			mosync.rlog("closing the game");
			if (socket) {
				socket.disconnect();
			}
		}

		document.addEventListener("deviceready", loadGameData, true);

		// Global Vars Used for Mutiplayer Gaming Mode
		var deviceUID, deviceName,
			multiplayerMode, socket, socketIOScriptLoaded = false,
			playerList = {},
			multiplayerServer = "192.168.0.103";

		var mWinnerName;
		var mGameFieldTop;
		var mGameFieldLeft;
		var mGameFieldSize;

		var mOrientation;

		var mGameField = new Array();

		var mTime;

		/*
			0 = main menu
			1 = game intro
			2 = game
			3 = game over
			4 = game finished
		*/

		var mState = 0;

		var mIsMoving;

		var mOrientationScheduled;
		var mOrientationSensor = new SensorConnection("Orientation");

		var mFailLogo = new Array();

		var mCanvas;
		var mContext;

		var mColorOfEach = new Array(6);

		var mScore = 0;

		var mNumTypeBlocks = 5;

		function loadGameData() {

			mosync.app.screenSetOrientation(mosync.SCREEN_ORIENTATION_PORTRAIT);
			
			document.addEventListener("deviceready", function () {
				// initialization of global vars 
				// about player data like phone id 
				// phone name
				deviceUID = device.uuid;
				deviceName = device.name;
				document.getElementById('menu').style.display = "block";

			}, true);

			document.addEventListener("backbutton", function (){
				if(multiplayerMode){
					socket.disconnect();
					menu();
				}

				if( mState = 0 ) {
					mosync.bridge.send(["close"]);
				}

			}, true);
		}

		function menu() {

			mState = 0;
			document.getElementById('menu').style.display = "block";
			document.getElementById('single').style.display = 'block';
			document.getElementById('multi').style.marginTop = "10pt";
			document.getElementById('connectionControls').style.display = "none";
			document.getElementById('loading').style.display = "none";
			document.getElementById('gameCanvas').style.display = "none";
		}

		function singlePlayer() {
			multiplayerMode = false;
			document.getElementById('menu').style.display = "none";
			document.getElementById('gameCanvas').style.display = "block";
			initialize();
		}

		function showMultiplayer() {
			document.getElementById('single').style.display = 'none';
			document.getElementById('multi').style.marginTop = "70%";
			document.getElementById('connectionControls').style.display = 'block';
			document.getElementById('name').value = deviceName;
			document.getElementById('serverip').value = multiplayerServer;
		}
		
		function connectToServer() {
			var name = document.getElementById('name').value,
				server = document.getElementById('serverip').value;
			if (name === "" || server === "") {
				// try to connect to the server
				alert("Name or serverip is empty.");
			} else {
				document.getElementById('loading').style.display = "block";
				deviceName = name;
				multiplayerServer = server;

				if (socketIOScriptLoaded){
					multiplayer();
				} else {
					$.getScript("http://" + multiplayerServer + ":8085/socket.io/socket.io.js", function (){
						multiplayer();
						socketIOScriptLoaded = true;
					}).fail(function () {
						document.getElementById('loading').style.display = "none";
						mosync.rlog("Failure connecting with server " + multiplayerServer);
					});
				}
			}
		}

		function multiplayer() {

			document.getElementById('connectionControls').style.display = 'block';
			socket = io.connect("http://" + multiplayerServer + ":8085/", {'force new connection': true});
			
			document.getElementById('loading').style.display = "block";
			
			// Register to the server
			socket.emit("register", {
				id : deviceUID,
				name: deviceName
			});

			// initialize
			socket.on("start", function (){
				document.getElementById('menu').style.display = "none";
				document.getElementById('loading').style.display = "none";
				document.getElementById('gameCanvas').style.display = "block";

				multiplayerMode = true;
				initialize();
			});

			socket.on("scores", function (data) {
				playerList = data;
			});

			socket.on("win", function (data) {
				// Check who is winning
				var playerScore = 0, playerid;

				for (var i in data){

					if (data[i].score > playerScore) {
						playerScore = data[i].score;
						playerid = i;
					}
				}
				
				if(playerid === deviceUID) {
					mState = 4;	
				} else {
					mWinnerName = data[playerid].name;
					mState = 3;
				}
			});
		}

		function sendScore(score) {
			if (multiplayerMode) {
				socket.emit("score", {
					id: deviceUID,
					score: score
				});
			}
		}

		/**
		 * Initialization.
		 */
		 function initialize()
		 {

			document.body.addEventListener('touchmove', function(event)
			{
					event.preventDefault();
			}, false); 

			mCanvas = document.getElementById('gameCanvas');
			mCanvas.addEventListener('touchstart', function(event)
			{
				event.preventDefault();

				var touch = event.touches[0];
				if(mState == 2)
				{
					if (touch.pageY < mGameFieldTop) {

						mState = 0;
						mosync.rlog("Disconnection");
						socket.disconnect();
						menu();
					} else if (touch.pageY > (mGameFieldTop+mGameFieldSize*10)){

						shuffleBlocks();
					} else {
						deleteBlock(touch.pageX, touch.pageY);
					}
				}
				
				else if((mState == 3) || (mState == 4))
				{
					if((touch.pageY > (mGameFieldTop+mGameFieldSize*10)) || (touch.pageY < mGameFieldTop))
						restartGame();
				}
				
			}, false);

			mContext = mCanvas.getContext('2d');

			resizeCanvas();
			calculateGameSize();

			restartGame();
/*
			initBlocks();
			resetBlocks();

			mOrientationScheduled = -1;


		   	mIsMoving = false;

		   	mTime = new Date().getTime();

		   	mState = 4;
*/
			mOrientationSensor.addEventListener("onsensordata", updateOrientation);			  	
		   	toggleOrientation();


	    	setInterval(update,16);
	    }

	    function restartGame()
	    {
	    	initBlocks();
			resetBlocks();

			mOrientationScheduled = -1;

		   	mIsMoving = false;

		   	mTime = new Date().getTime();

		   	mState = 2;

		   	mScore = 0;

		   	sendScore(mScore);
	    }

		function updateOrientation(sensorData)
		{
			if(mIsMoving == false)
			{
				doOrientation(sensorData.data.x);
				updateNeighbours();
			}
			else
			{
				mRotationScheduled = sensorData.data.x;
			}
		}

		function doOrientation(orientation)
		{
			if(orientation == -1)
				return;

			mOrientation = orientation;
			mOrientationScheduled = -1;
		}

		function toggleOrientation()
		{
			if(mOrientationSensor.status == "open")
			{
				mOrientationSensor.startWatch({interval:500});
			}
			else
			{
				mOrientationSensor.endWatch();
			}
		}

		/**
		 * Handle the backbutton event.
		 */
		function close()
		{
			// Close the application if the back key is pressed.
			mosync.bridge.send(["close"]);
		}

		function resizeCanvas()
		{

        	mCanvas.setAttribute('height', window.innerHeight);
        	mCanvas.setAttribute('width', window.innerWidth);
        	mContext.scale(1.0, 1.0);
		}

		function calculateGameSize()
		{
			var s = mCanvas.width;
			if(mCanvas.height < s)
			{
				s = mCanvas.height;
				mGameFieldTop = 0;
				mGameFieldLeft = (mCanvas.width - s)/2;
			}
			else
			{
				mGameFieldTop = (mCanvas.height - s)/2;
				mGameFieldLeft = 0;
			}
			mGameFieldSize = s/10.0;
		}

		function createBlock()
		{
			var block = Object.create(
			{
				"color" : "rgb(255, 255, 255)",
				"type" : Math.round(Math.random()*(mNumTypeBlocks-1)),
				"visited" : true,
				"xpos" : 0.0,
				"ypos" : 0.0,
				"left" : { tile : null, dist : 0 },
				"right" : { tile : null, dist : 0 },
				"up" : { tile : null, dist : 0 },
				"down" : { tile : null, dist : 0 }
			})

			switch(block.type)
			{
				case 0:	
				var col = mContext.createLinearGradient(0, 100, 100, 400);
				col.addColorStop(0, "rgb(208,51,58)");
				col.addColorStop(1, "rgb(228,71,78)");
				block.color = col;
				break;
				case 1:	
				var col = mContext.createLinearGradient(0, 100, 100, 400);
				col.addColorStop(0, "rgb(234,154,90)");
				col.addColorStop(1, "rgb(254,173,110)");
				block.color = col;
				break;
				case 2:	
				var col = mContext.createLinearGradient(0, 100, 100, 400);
				col.addColorStop(0, "rgb(248,232,204)");
				col.addColorStop(1, "rgb(255,252,224)");
				block.color = col;
				break;
				case 3:	
				var col = mContext.createLinearGradient(0, 100, 100, 400);
				col.addColorStop(0, "rgb(58,51,208)");
				col.addColorStop(1, "rgb(78,72,228)");
				block.color = col;
				break;
				case 4:	
				var col = mContext.createLinearGradient(0, 100, 100, 400);
				col.addColorStop(0, "rgb(94,154,234)");
				col.addColorStop(1, "rgb(114,174,254)");
				block.color = col;
				break;
				case 5:	
				var col = mContext.createLinearGradient(0, 100, 100, 400);
				col.addColorStop(0, "rgb(48,232,204)");
				col.addColorStop(1, "rgb(68,252,224)");
				block.color = col;
				break;
				default:
				mosync.rlog("oops.. color not available, was " + block.type)
				break;
			}
			mColorOfEach[block.type]++;

			return block;
		}

		function initBlocks()
		{
			var legalBoard = false;
			while(!legalBoard)
			{
				for(var i = 0; i < mNumTypeBlocks; i++)
					mColorOfEach[i] = 0;

				for (var i = 0; i < 100; i++)
					mGameField[i] = createBlock();

				legalBoard = true;
				for(var i = 0; i < mNumTypeBlocks; i++)
				{
					if(mColorOfEach[i]<3)
						legalBoard = false;

					mosync.rlog("num of " + i + " is " + mColorOfEach[i]);
				}
			}
		}

		function resetBlocks()
		{
			var filled = new Array(10);
			for(var i = 0; i < 10; i++)
				filled[i] = 0;

			for (var i = 0; i < mGameField.length; i++)
			{
				var x = 0;

				var found = false;
				while(!found)
				{
					x = Math.round(Math.random()*9.0);	
					if(filled[x] < 10)
					{
						filled[x]++;
						found = true;
					}
				}

				mGameField[i].xpos = x;
				mGameField[i].ypos = filled[x]-1;
			}

			updateNeighbours();
		}

		function updateNeighbours()
		{
			// find neighbours
			for (var i = 0; i < mGameField.length; i++)
			{
				// LEFT
				mGameField[i].left.dist = 0;
				if(mGameField[i].xpos != 0)
				{
					mGameField[i].left.dist = mGameField[i].xpos;

					for(var j = 0; j < mGameField.length; j++)
						if(mGameField[j].ypos == mGameField[i].ypos)
							if(mGameField[j].xpos < mGameField[i].xpos)
								mGameField[i].left.dist--;
				}

				// RIGHT
				mGameField[i].right.dist = 0;
				if(mGameField[i].xpos != 9)
				{
					mGameField[i].right.dist = 9 - mGameField[i].xpos;
					for(var j = 0; j < mGameField.length; j++)
						if(mGameField[j].ypos == mGameField[i].ypos)
							if(mGameField[j].xpos > mGameField[i].xpos)
								mGameField[i].right.dist--;
				}

				// UP
				mGameField[i].up.dist = 0;
				if(mGameField[i].ypos != 0)
				{						
					mGameField[i].up.dist  = mGameField[i].ypos;
					for(var j = 0; j < mGameField.length; j++)
						if(mGameField[j].xpos == mGameField[i].xpos)
							if(mGameField[j].ypos < mGameField[i].ypos)
								mGameField[i].up.dist --;
				}

				// DOWN
				mGameField[i].down.dist = 0;
				if(mGameField[i].ypos != 9)
				{
					mGameField[i].down.dist = 9 - mGameField[i].ypos;
					for(var j = 0; j < mGameField.length; j++)
						if(mGameField[j].xpos == mGameField[i].xpos)
							if(mGameField[j].ypos > mGameField[i].ypos)
								mGameField[i].down.dist--;
				}

				updateNeighbourTiles(mGameField[i]);
			}

		}

		function updateNeighbourTiles(tile)
		{
				// Update neighbour if any
				var cx = tile.xpos;
				var cy = tile.ypos;
				
				tile.up.tile = null;
				tile.down.tile = null;
				tile.left.tile = null;
				tile.right.tile = null; 

				for(var j = 0; j < mGameField.length; j++)
				{
					if((mGameField[j].xpos == cx) && (mGameField[j].ypos == (cy-1)))
						tile.up.tile = mGameField[j];

					if((mGameField[j].xpos == cx) && (mGameField[j].ypos == (cy+1)))
						tile.down.tile = mGameField[j];
					
					if((mGameField[j].ypos == cy) && (mGameField[j].xpos == (cx-1)))
						tile.left.tile = mGameField[j];
					
					if((mGameField[j].ypos == cy) && (mGameField[j].xpos == (cx+1)))
						tile.right.tile = mGameField[j];
				}
		}

		function clearVisited()
		{
			for(var i = 0; i < mGameField.length; i++)
				mGameField[i].visited = false;
		}

		function countNeighboursRecursive(tile)
		{
			if (tile.visited)
				return 0;

			tile.visited = true;

			var res = 1;

			if(tile.up.tile != null)
				if(tile.up.tile.type == tile.type)
					res += countNeighboursRecursive(tile.up.tile);

			if(tile.down.tile != null)
				if(tile.down.tile.type == tile.type)
					res += countNeighboursRecursive(tile.down.tile);
			
			if(tile.left.tile != null)
				if(tile.left.tile.type == tile.type)
					res += countNeighboursRecursive(tile.left.tile);
			
			if(tile.right.tile != null)
				if(tile.right.tile.type == tile.type)
					res += countNeighboursRecursive(tile.right.tile);

			return res;
		}

		
		function deleteBlock(xpos, ypos)
		{
			var tx = Math.floor((xpos - mGameFieldLeft)/mGameFieldSize);
			var ty = Math.floor((ypos - mGameFieldTop)/mGameFieldSize);
			
			updateNeighbours();
			
			for(var i = 0; i < mGameField.length; i++)
			{
				if(mGameField[i].xpos == tx && mGameField[i].ypos == ty)
				{
					clearVisited();
					var c = countNeighboursRecursive(mGameField[i]);

					// now we can just deleted all the visited bricks..
					if(c > 0)
					{
						mScore += (c * 20) + ((c-2) * 20);

						sendScore(mScore);

						while(true)
						{
							var keepGoing = false;
							for(var i = 0; i < mGameField.length; i++)
							{
								if(mGameField[i].visited == true)
								{
									mColorOfEach[mGameField[i].type]--;
									keepGoing = true;
									mGameField.splice(i, 1);
									break;
								}
							}
							if(!keepGoing)
								break;
						}
					}
					updateNeighbours();
					return;
				}
			}		
		}


		function moveTiles()
		{
			var speed = 0.5;

			mIsMoving = false;

			// DOWN
			if(mOrientation == 1)
			{
				for(var i = 0; i < mGameField.length; i++)
				{
					if(mGameField[i].down.dist > 0.1)
					{
						mIsMoving = true;
						mGameField[i].down.dist -= speed;
						mGameField[i].ypos += speed;
					}
				}
			}
			// UP
			else if(mOrientation == 2)
			{
				for(var i = 0; i < mGameField.length; i++)
				{
					if(mGameField[i].up.dist > 0.1)
					{
						mIsMoving = true;
						mGameField[i].up.dist -= speed;
						mGameField[i].ypos -= speed;
					}
				}
			}
			// LEFT
			else if(mOrientation == 3)
			{
				for(var i = 0; i < mGameField.length; i++)
				{
					if(mGameField[i].left.dist > 0.1)
					{
						mIsMoving = true;
						mGameField[i].left.dist -= speed;
						mGameField[i].xpos -= speed;
					}
				}
			}
			// RIGHT
			else if(mOrientation == 4)
			{
				for(var i = 0; i < mGameField.length; i++)
				{
					if(mGameField[i].right.dist > 0.1)
					{
						mIsMoving = true;
						mGameField[i].right.dist -= speed;
						mGameField[i].xpos += speed;
					}
				}
			}

			updateNeighbours();
		}

		function addTiles()
		{
			
			var ms = new Date().getTime();
			var elapsed = ms - mTime;
			if(elapsed < 2000)
				return;

			if(mIsMoving == true)
				return;
			
			mTime = ms;

			var list = new Array(10);
			for(var i = 0; i <10; i++)
				list[i] = new Array(10);

			for(var i = 0; i < 10; i++)
				for(var j = 0; j < 10; j++)
					list[i][j] = true;	

			for(var i = 0; i < mGameField.length; i++)
				list[mGameField[i].xpos][mGameField[i].ypos] = false;

			for(var i = 0; i < 4; i++)
			{
				while(true)
				{
					var x = Math.round(Math.random()*9.0);
					var y = Math.round(Math.random()*9.0);

					if(list[x][y] == true)
					{
						var tile = createBlock();
						tile.xpos = x;
						tile.ypos = y;
						mGameField[mGameField.length] = tile;
						break;
					}
				}
			}

			updateNeighbours();
		}

		function shuffleBlocks()
		{
			if(mGameField.length > 70)
				return;

			var list = new Array(10);
			for(var i = 0; i <10; i++)
				list[i] = new Array(10);

			for(var i = 0; i < 10; i++)
				for(var j = 0; j < 10; j++)
					list[i][j] = true;	

			for(var i = 0; i < mGameField.length; i++)
				list[mGameField[i].xpos][mGameField[i].ypos] = false;

			for(var i = 0; i < 4; i++)
			{
				while(true)
				{
					var x = Math.round(Math.random()*9.0);
					var y = Math.round(Math.random()*9.0);

					if(list[x][y] == true)
					{
						var tile = mGameField[Math.round(Math.random()*mGameField.length)];
						tile.xpos = x;
						tile.ypos = y;
						break;
					}
				}
			}

			updateNeighbours();

		}

		function checkGameState()
		{
			if(mGameField.length == 0)
			{
				//mState = 4;

				if(multiplayerMode) {
					mState = 5;
					socket.emit("win", { id : deviceUID});	
				}
				
				return true;
			}
			// Turn off game over check
			/*
			for(var i = 0; i < mNumTypeBlocks; i++) {
				if((mColorOfEach[i] > 0) && (mColorOfEach[i] < 3))
				{
					mState = 3;
					return true;
				}
			}*/
				
			return false;
		}


		function update()
		{
			if(mState == 2)
			{
				if(!checkGameState())
				{
					doOrientation(mOrientationScheduled);
					//addTiles();
					moveTiles();
					draw();
					drawScore();
					drawOtherScores();
				}
			}
			else if(mState == 3)
			{	
				var time = new Date().getTime();

				var w = 40;//mCanvas.width;
				var h = mCanvas.height/2.0;

				mContext.save();

				mContext.globalAlpha = 0.4;

				draw();

				mContext.restore();

				drawScore();
				drawOtherScores();

				var sx1 = Math.sin(time * 0.001) * 60.0;
				var sy1 = Math.sin(time * 0.002) * Math.cos(time*0.003) * Math.sin(time*0.001) *  30.0;
				var sx2 = Math.sin(time * 0.002) * 60.0;
				var sy2 = Math.cos(time * 0.002) * Math.cos(time*0.004) * Math.sin(time*0.002) *  30.0;

				mContext.save();

				if(mOrientation == 2)
				{
					mContext.translate(mCanvas.width, mCanvas.height);
					mContext.rotate(Math.PI);
				}
				else if(mOrientation == 3)
				{
					mContext.translate(mCanvas.width*1.25, mCanvas.width/4.0);
					mContext.rotate(Math.PI/2.0);
				}
				else if(mOrientation == 4)
				{
					mContext.translate(-mCanvas.width/4.0, mCanvas.width*1.25);
					mContext.rotate(-Math.PI/2.0);
				}

				mContext.font = "100px TrebuchetMS";

				mContext.fillStyle = "rgb(40, 40, 40)";
				mContext.fillText("Game", sx1 + w + 4, sy1 + h - 20);
				mContext.fillText("Over", sx2 + w + 4, sy2 + h + h/4 + 4);
				
				mContext.fillStyle = "rgb(200, 200, 200)";
				mContext.fillText("Game", sx1 + w, sy1 + h - 16);
				mContext.fillText("Over", sx2 + w, sy2 + h + h/4);

				mContext.font = "30px TrebuchetMS";
				mContext.fillStyle = "rgb(40, 40, 40)";
				mContext.fillText("Winner: " + mWinnerName, 
								  sx1 + w + 4, sy1 + h + h/2);

				mContext.font = "30px TrebuchetMS";
				mContext.fillStyle = "rgb(200, 200, 200)";
				mContext.fillText("Winner: " + mWinnerName, 
								  sx1 + w, sy1 + h + h/2);

				mContext.restore();
			}
			else if(mState == 4)
			{
				draw();

				mContext.save();

				if(mOrientation == 2)
				{
					mContext.translate(mCanvas.width, mCanvas.height);
					mContext.rotate(Math.PI);
				}
				else if(mOrientation == 3)
				{
					mContext.translate(mCanvas.width*1.25, mCanvas.width/4.0);
					mContext.rotate(Math.PI/2.0);
				}
				else if(mOrientation == 4)
				{
					mContext.translate(-mCanvas.width/4.0, mCanvas.width*1.25);
					mContext.rotate(-Math.PI/2.0);
				}

				mContext.font = "70px TrebuchetMS";

				mContext.fillStyle = "rgb(40, 40, 40)";
				mContext.fillText("SUCCESS", 26, 200);
				
				mContext.fillStyle = "rgb(200, 200, 200)";
				mContext.fillText("SUCCESS", 22, 196);

				mContext.restore();
			}
			else if(mState == 5)
			{
				draw();

				mContext.save();

				if(mOrientation == 2)
				{
					mContext.translate(mCanvas.width, mCanvas.height);
					mContext.rotate(Math.PI);
				}
				else if(mOrientation == 3)
				{
					mContext.translate(mCanvas.width*1.25, mCanvas.width/4.0);
					mContext.rotate(Math.PI/2.0);
				}
				else if(mOrientation == 4)
				{
					mContext.translate(-mCanvas.width/4.0, mCanvas.width*1.25);
					mContext.rotate(-Math.PI/2.0);
				}

				mContext.font = "70px TrebuchetMS";

				mContext.fillStyle = "rgb(40, 40, 40)";
				mContext.fillText("Waiting...", 26, 200);
				
				mContext.fillStyle = "rgb(200, 200, 200)";
				mContext.fillText("Waiting...", 22, 196);

				mContext.restore();
			}
		}

		function draw()
		{
			// draw background
	    	var bkgGrad = mContext.createLinearGradient(0, 20, 100, 225);
			bkgGrad.addColorStop(0, "rgb(50,50,60)");
			bkgGrad.addColorStop(1, "rgb(60,70,60)");
			mContext.fillStyle = bkgGrad;


	    	//ctx.fillStyle = "rgb(120, 120, 120)";
	    	mContext.fillRect(0, 0, mCanvas.width, mCanvas.height);


	    	mContext.fillStyle = "rgb(40, 40, 40)";
	    	mContext.fillRect(mGameFieldLeft-4, mGameFieldTop-4, mGameFieldSize*10+8, mGameFieldSize*10+8);


	    	var fieldGrad = mContext.createLinearGradient(200, 0, 200, 400);
			fieldGrad.addColorStop(0, "rgb(60,60,60)");
			fieldGrad.addColorStop(1, "rgb(0,0,0)");
			mContext.fillStyle = fieldGrad;

	    	//ctx.fillStyle = "rgb(60, 60, 60)";
	    	mContext.fillRect(mGameFieldLeft, mGameFieldTop, mGameFieldSize*10, mGameFieldSize*10);

	    	for(var i = 0; i < mGameField.length; i++)
	    	{	
	    		/*
	    		ctx.fillStyle = "black";
	    		ctx.fillRect(	mGameFieldLeft + mGameField[i].xpos * mGameFieldSize,
	    			mGameFieldTop + mGameField[i].ypos * mGameFieldSize,
	    			mGameFieldSize, 
	    			mGameFieldSize);	    
				*/
				
				var left = mGameFieldLeft + mGameField[i].xpos * mGameFieldSize;
				var top = mGameFieldTop + mGameField[i].ypos * mGameFieldSize;
				var right = left + mGameFieldSize;
				var bottom = top + mGameFieldSize;

	    		mContext.fillStyle = mGameField[i].color;
	    		mContext.fillRect(left, top, mGameFieldSize, mGameFieldSize);
	    		
	    		mContext.beginPath();
	    		if(mGameField[i].up.tile != null)
	    		{
	    			if(mGameField[i].up.tile.type != mGameField[i].type)
	    			{
	    				mContext.moveTo(left, top);
	    				mContext.lineTo(right, top);
	    			}
	    		}
	    		if(mGameField[i].down.tile != null)
	    		{
	    			if(mGameField[i].down.tile.type != mGameField[i].type)
	    			{
	    				mContext.moveTo(left, bottom);
	    				mContext.lineTo(right, bottom);
	    			}
	    		}
	    		if(mGameField[i].left.tile != null)
	    		{
	    			if(mGameField[i].left.tile.type != mGameField[i].type)
	    			{
	    				mContext.moveTo(left, top);
	    				mContext.lineTo(left, bottom);
	    			}
	    		}
	    		if(mGameField[i].right.tile != null)
	    		{
	    			if(mGameField[i].right.tile.type != mGameField[i].type)
	    			{
	    				mContext.moveTo(right, top);
	    				mContext.lineTo(right, bottom);
	    			}
	    		}

	    		mContext.strokeStyle = "black";
	    		mContext.stroke();
	    		
	    	}
	    	
	    }

	    function drawScore()
	    {
	    	mContext.font = "40px TrebuchetMS";

	    	mContext.save();

			if(mOrientation == 2)
			{
				mContext.translate(mCanvas.width, mCanvas.height);
				mContext.rotate(Math.PI);
			}
			else if(mOrientation == 3)
			{
				mContext.translate(mCanvas.width, 4);
				mContext.rotate(Math.PI/2.0);
			}
			else if(mOrientation == 4)
			{
				mContext.translate(0, mCanvas.height);
				mContext.rotate(-Math.PI/2.0);
			}
			var x = 5;
			var y = 40;

			mContext.fillStyle = "rgb(40, 40, 40)";
			mContext.fillText(mScore, x + 4, y + 4);

			mContext.fillStyle = "rgb(200, 200, 200)";
			mContext.fillText(mScore, x, y);

			mContext.restore();
	    }

	    function drawOtherScores()
	    {
	    	var x = 120;
			var y = 12;

	    	mContext.font = "12px TrebuchetMS";

	    	mContext.save();

	    	if(mOrientation == 2)
			{
				x = 120; y = 12;
				mContext.translate(mCanvas.width, mCanvas.height);
				mContext.rotate(Math.PI);
			}
			else if(mOrientation == 3)
			{
				x = 12; y = 60;
				mContext.translate(mCanvas.width, 4);
				mContext.rotate(Math.PI/2.0);
			}
			else if(mOrientation == 4)
			{
				x = 5; y = 60;
				mContext.translate(0, mCanvas.height);
				mContext.rotate(-Math.PI/2.0);
			}
			

			for (i in playerList) {
				if (i != deviceUID) {
					mContext.fillStyle = "rgb(204, 223, 195)";
					mContext.fillText(playerList[i].name + ": " + 
									  playerList[i].score, x, y);
					y += 12;
				}
			}

			mContext.restore();
	    }
