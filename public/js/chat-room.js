var socket;
var socket_list = {};
var current_active_view;
var u_name;

$(document).ready(function(){
	
	console.log(db_list);
	
	db_list.map(function(item, idx){
		//$('#chat_rooms').append($('<li id="'+item.name+'" class="list-group-item">').html("<a href='' data-room-user='"+item.db_user+"' data-room-chat='"+item.db_chat+"'>"+item.name+"</a>"));
		$('#chat_rooms').append($("<a href='' id='"+item.name+"' class='list-group-item' data-room-user='"+item.db_user+"' data-room-chat='"+item.db_chat+"'>").text(item.name));
		socket_list[item.name] = item.name;
	});
	
	change_sock_ns('default');
	current_active_view = 'default';
	$('#'+current_active_view).addClass('active');
	
	$('[data-toggle="popover"]').popover(); 
	
	//socket_funcs();
	
	$("#u_name_form").submit(function(){
		u_name = $('#u_name').val();
		socket.emit('new user', $('#u_name').val());
		$('#username').addClass('hidden');
		$('#main_window').removeClass('hidden');
		$('#online_users').append($('<li class="list-group-item">').text($('#u_name').val()));
		$('#main_window').find('.panel-title').text(u_name);
		return false;
	});
	
	$('#message_form').submit(function(event){
		event.preventDefault();
		$('#messages').append($('<li class="list-group-item">').html('<span class="label label-primary">You</span> '+$('#m').val()));
		socket.emit('chat message', u_name, $('#m').val());
		$('#m').val('');
		var elem = document.getElementById('messages');
		elem.scrollTop = elem.scrollHeight;
		return false;
	});
	
	//$('#chat_rooms').find('a').click(function(event){
	$('#chat_rooms').on('click', 'a', function(event){
		event.preventDefault();
		socket.disconnect();
		console.log($(this).html());
		change_sock_ns($(this).html());
		socket.emit('change room', u_name, $(this).attr('data-room-user'), $(this).attr('data-room-chat'));
		$("#messages").empty();
		$("#online_users").empty();
		change_active_room($(this).attr('id'));
	});
	
	var chat_rooms_mob = 0;
	$('#show_chat_mob').click(function(){
		++chat_rooms_mob;
		if(chat_rooms_mob % 2 === 1)
			$('#chat_rooms').addClass('chat_rooms_mob');
		else
			$('#chat_rooms').removeClass('chat_rooms_mob');
	});
	
	var online_mob = 0;
	$('#show_online_mob').click(function(){
		++online_mob;
		if(online_mob % 2 === 1)
			$('#online_users').addClass('online_mob');
		else
			$('#online_users').removeClass('online_mob');
	});
	
	$('body').on('submit', '#new_chat_room', function(e){
		e.preventDefault();
		socket.emit('new room', $('#new_chat_room').find('input[type="text"]').val());
		$('#new_chat_room_pop').not(this).popover('hide');
		$('#new_chat_room_pop').click();
	});
});


function change_active_room(room){
	$('#'+current_active_view).removeClass('active');
	$('#'+room).addClass('active');
	current_active_view = room;
}

function change_sock_ns(ns){
	socket = io('/'+ns,  {'force new connection': true});
	socket_funcs();
}

function socket_funcs(){
	
	socket.on('chat message', function(user, msg){
		$('#messages').append($('<li class="list-group-item">').html('<span class="label label-primary">'+user+'</span> '+msg));
		var elem = document.getElementById('messages');
		elem.scrollTop = elem.scrollHeight;
	});
	
	socket.on('new user joined', function(msg){
		console.log(msg + "joined");
		$('#online_users').append($('<li class="list-group-item">').text(msg));
	});
	
	socket.on('online users', function(msg){
		console.log("Users" + msg);
		msg.map(function(item, idx){
			$('#online_users').append($('<li class="list-group-item">').text(item));
		});
	});
	
	socket.on('chat data', function(msg){
		msg.map(function(item, idx){
			console.log(item.user + ":" + item.msg);
			$('#messages').append($('<li class="list-group-item">').html('<span class="label label-primary">'+item.user+'</span> '+item.msg));
			var elem = document.getElementById('messages');
			elem.scrollTop = elem.scrollHeight;
		});
		/*
		msg.map(function(item, idx){
			$('#online_users').append($('<li>').text(item));
		});
		*/
	});
	
	socket.on('user left', function(msg){
		console.log(msg + "left");
		$('#online_users > li').filter(function() { return $.text([this]) === msg; }).remove();
	});
	
	socket.on('room created', function(room, room_user, room_chat){
		console.log(room + " created");
		$('#chat_rooms').append($("<a href='' id='"+room+"' class='list-group-item' data-room-user='"+room_user+"' data-room-chat='"+room_chat+"'>").text(room));
		socket.disconnect();
		change_sock_ns(room);
		socket.emit('change room', u_name, room_user, room_chat);
		$("#messages").empty();
		$("#online_users").empty();
		change_active_room(room);
	});
	
	socket.on('new room', function(room, room_user, room_chat, socket_id){
		console.log("New room added " + room);
		
		$('#chat_rooms').append($("<a href='' id='"+room+"' class='list-group-item' data-room-user='"+room_user+"' data-room-chat='"+room_chat+"'>").text(room));
	});
}