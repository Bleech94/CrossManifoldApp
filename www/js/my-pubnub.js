/*
* Functions
*/
// Subscribe to Updates channel. The Pi will send current and desired thermostat readings to this channel regularly.
function pubnubSubscribeToUpdates() {
  pubnub.subscribe({
    channel: pubnubUpdateChannel,
    message: function(m) {
      console.log("Message received: " + m.text) // TODO update current thermostat readings on main page when message recieved
    },
    connect: function(m) {console.log("Connected: " + m)},
    disconnect: function(m) {
      console.log("Disconnected: " + m);
      pubnubSubscribeToUpdates();
      console.log("Resubscribed.");
    },
    reconnect: function(m) {console.log("Reconnected: " + m)},
    error: function(m) {console.log("Network Error: " + m[0] + ' ' + m[1])},
    restore: true
  })
}

function pubnubPublishCommand(temp1, temp2, temp3, temp4, temp5, temp6) {
  pubnub.publish({
    channel: pubnubCommandChannel,
    message: {
        "desiredTemp1": temp1,  // TODO: Build message based on app readings when apply is pressed
        "desiredTemp2": temp2,
        "desiredTemp3": temp3,
        "desiredTemp4": temp4,
        "desiredTemp5": temp5,
        "desiredTemp6": temp6
    },
    callback: function(m){
        console.log(m)
    }
  })
}

// TODO: Fix this function. If there is no history, don't allow login. If there is some history then login is okay.
// Should return true or false
function pubnubLogin() {
  pubnub.history({
    channel: pubnubChannel,
    callback: function(m){
        console.log(m);
    },
    count: 1
  });
}
