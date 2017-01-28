var express = require('express'), app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var path = require("path");
var Engine = require('tingodb')();

app.use('/js', express.static(path.join(__dirname, 'public/js')))
app.use('/css', express.static(path.join(__dirname, 'public/css')))
app.use('/bootstrap', express.static(path.join(__dirname, 'public/bootstrap')))
app.set('view engine', 'ejs');

var database = new Engine.Db(__dirname + '/db',{});

var db_list = database.collection('db_list');

var user_sock_list = {};

/*
db_list.update({ "name" : { $exists : true } }, {
	"name" : "default",
	"db_user" : "default_user",
	"db_chat" : "default_chat"
},  { upsert: true }, function(err){
	if(err)
		console.log(err);
});

db_list.update({ "name" : { $exists : true } }, {
	"name" : "room01",
	"db_user" : "room_01_user",
	"db_chat" : "room_01_chat"
},  { upsert: true }, function(err){
	if(err)
		console.log(err);
});
*/

db_list.findOne({'name': 'default'}, function(err, document) {
	if(err)
		console.log(err);
	if(!document) {
		db_list.insert({
			"name" : "default",
			"db_user" : "default_user",
			"db_chat" : "default_chat"
		}, function(err){
			if(err)
				console.log(err);
		});
	}
});

db_list.findOne({'name': 'default'}, function(err, document) {
	if(!document) {
		db_list.insert({
			"name" : "room01",
			"db_user" : "room_01_user",
			"db_chat" : "room_01_chat"
		}, function(err){
			if(err)
				console.log(err);
		});
	}
});

var list_of_cols = [];

db_list.find().toArray(function(err, list){
	if(err)
		console.log(err);
	list_of_cols = list;
});

/*
var default_room_users = database.collection('default_room_users');
var default_room_chat = database.collection('default_room_chat');
*/

app.get('/', function(req, res){
  //res.sendFile(__dirname + '/index', {db_list: list_of_cols});
  res.render(__dirname + '/views/index', {db_list: JSON.stringify(list_of_cols)});
});


app.get('/erasedb', function(req, res){
	/*
	default_room_users.remove({}, function(err) {
								 if (err)
									 console.log(err);
								});
	
	default_room_chat.remove({}, function(err) {
								 if (err)
									 console.log(err);
								});
	*/
	
	db_list.remove({}, function(err) {
								 if (err)
									 console.log(err);
								});							
	console.log("DB cleared");
});


db_list.find().toArray(function(err, list){
	if(err)
		console.log(err);
	// console.log("db_list "+list);
	list.map(function(item, idx){
		console.log(item.name);
		var db_user = database.collection(item.db_user);
		var db_chat = database.collection(item.db_chat);
		start_io_servers(item.name, db_user, db_chat);
	});
});

function start_io_servers(name, db_user, db_chat) {
	io.of('/'+name).on('connection', function(socket){
		var user;
		socket.on('chat message', function(u_name, msg){
			db_chat.insert({
				"user" : u_name,
				"msg"	: msg
			});
			socket.broadcast.emit('chat message', u_name, msg);
	  });
	  
	  socket.on('new user', function(msg){
		// console.log(msg);
		user = msg;
		user_sock_list[socket.id] = msg;
		
		var users_in_room = [];
		get_all_data(db_user, function(list){
			// console.log(list);
			list.map(function(item, idx){
				users_in_room.push(item.user);
			});
			socket.broadcast.emit('new user joined', msg);
			// console.log(users_in_room);
			get_all_data(db_chat, function(list){
				socket.emit('online users', users_in_room);
				socket.emit('chat data', list);
			}, -1, 10);
		});
		 
		
		db_user.insert({
			"user" : msg
		});
		//console.log("Inserted new user");
	  });
	  
	  socket.on('disconnect', function(){
		  console.log("received user disconnect");
		 db_user.remove({
			"user" : user_sock_list[socket.id]
		 }, function(err) {
			 if (err)
				 console.log(err);
		 });
		 socket.broadcast.emit("user left", user_sock_list[socket.id]);
		 delete user_sock_list[socket.id];
	  });
	  
	  socket.on('change room', function(u_name, user_db, chat_db){
		  change_rooms(u_name, user_db, chat_db, socket);
	  });
	  
	  socket.on('new room', function(room_name){
		  console.log("New room event");
		  var room_user_db = room_name + "_user";
		  var room_chat_db = room_name + "_chat";
		  db_list.findOne({'name': room_name}, function(err, document) {
				if(!document) {
					console.log("Found doc");
					db_list.insert({
						"name" : room_name,
						"db_user" : room_user_db,
						"db_chat" : room_chat_db
					}, function(err){
						if(err)
							console.log(err);
					});
					var new_room_user = database.collection(room_user_db);
					var new_room_chat = database.collection(room_chat_db);
					start_io_servers(room_name, new_room_user, new_room_chat);
					socket.emit("room created", room_name, room_user_db, room_chat_db);
					
					db_list.find().toArray(function(err, list){
						if(err)
							console.log(err);
						list_of_cols = list;
						list.map(function(item, idx) {
							if(item.name !== room_name) {
								io.of('/'+item.name).emit("new room", room_name, room_user_db, room_chat_db, socket.id);
							}
						});
					});
				}
			});
	  });
	  
	});
}

function change_rooms(u_name, user_db, chat_db, socket){
	 console.log("Room change event "+ user_db + " " + chat_db);
	 var new_user = database.collection(user_db);
	 var new_chat = database.collection(chat_db);
	 new_user.insert({
		"user" : u_name
	 }, function(err){
		 if(err)
			 console.log("Specific "+err);
	 });
	 user_sock_list[socket.id] = u_name;
	 var users_in_room = [];
	 get_all_data(new_user, function(list){
		console.log(list);
		list.map(function(item, idx){
			users_in_room.push(item.user);
		});
		socket.broadcast.emit('new user joined', u_name);
		// console.log(users_in_room);
		get_all_data(new_chat, function(list){
			socket.emit('online users', users_in_room);
			socket.emit('chat data', list);
		}, -1, 10);
	});
  }

function get_all_data(chat_room, callback, p_sort = {}, p_limit = 0) {
	if(p_sort === -1)
		p_sort = {'_id' : -1};
	chat_room
			.find()
			.sort(p_sort)
			.limit(p_limit)
			.toArray(function(err, list){
						if(err)
							console.log(err);
						list.reverse();
						callback(list);
					});
}

http.listen(5000, function(){
  console.log('listening on *:5000');
});
