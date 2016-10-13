/*
* INITIALIZE
*/
var isMaterial = Framework7.prototype.device.ios === false;
var isIos = Framework7.prototype.device.ios === true;

var CMID = ""; // Cross Manifold ID. TODO: Store locally.
var pubnubUpdateChannel = "CM_Update_" + CMID; // This channel is for updates from the Pi that will be displayed on the app.
var pubnubCommandChannel = "CM_Command_" + CMID; // This channel is for commands from the app to the Pi to change the thermostats.

// Arrays to store thermostat info and settings found within each message.
// TODO: Grab these values from the subscribed messages.
var currentTempArray = [];
var desiredTempArray = [];
var modeArray = [];
var nameArray = [];
var ignoreNotificationsBool;

var currentZoneNumber;
var index = 1;

// Accessible anywhere.
Template7.global = {
    material: isMaterial,
    ios: isIos
};

var $$ = Dom7; // Custom DOM library, almost the exact same as jQuery

// Rearrange some div classes to match android and iOS. TODO: Check if working.
if (!isIos) {
    $$('.view.navbar-through').removeClass('navbar-through').addClass('navbar-fixed'); // Change class
    $$('.view .navbar').prependTo('.view .page'); // And move Navbar into Page
}

// Initialize app
var myApp = new Framework7({
    material: isMaterial ? true : false,
    precompileTemplates: true,
    template7Pages: true,
    smartSelectOpenIn: 'picker'
});

// Add view
var mainView = myApp.addView('.view-main', {
    dynamicNavbar: true, // Only used in iOS
    domCache: true // TODO: Is this used?
});

// TODO: Switch back to 'deviceready' event after testing
// Handle Cordova Device Ready Event
/*$$(document).on('deviceready', function() {
    console.log("Device is ready!");
});*/
/* TODO: remove after testing */
if (navigator.userAgent.match(/(iPhone|Android)/)) {
    document.addEventListener("deviceready", onDeviceReady, false);
} else {
    onDeviceReady();
}
function onDeviceReady() {
  console.log("Device is ready!");
}
/* remove after testing */

// Initialize Pubnub TODO: Ensure this is only ever called once?
var pubnub = PUBNUB.init({
    publish_key: 'pub-c-3082c989-10c9-4690-b759-2b7f56c733e7',
    subscribe_key: 'sub-c-88a5713a-8040-11e6-920d-02ee2ddab7fe',
    error: function (error) {
      console.log('Error: ' + error);
    }
})



/*
* PAGE NAVIGATION
*/
function loadLoginPage() {
  index = 1;
  mainView.router.load({
    pageName: 'login'
  })
}

function loadMainTemplate() {
  index = 1;

  var thermostatArray = [];
  // Push all readings into the array
  for(var i = 0; i < currentTempArray.length; i++) {
    var reading = {
      "current":currentTempArray[i],
      "desired":desiredTempArray[i],
      "name":nameArray[i],
      "mode":modeArray[i]
    }
    thermostatArray.push(reading);
  }

  var context = {
    "thermostatDetails":thermostatArray
  }

  mainView.router.load({
    template: myApp.templates.main,
    animatePages:true,
    context: context,
    reload: true
  });
}

function loadZoneScheduleTemplate() {
  index = 1;
  var context = {
    "zone": currentZoneNumber
  }
  mainView.router.load({
    template:myApp.templates.schedule,
    context:context
  })
}

function loadSettingsTemplate() {
  index = 1;
  var nameObjectArray = [];
  for(var i = 0; i < nameArray.length; i++) { // TODO: There must be a better way of doing this.
    var nameObject = {"name":nameArray[i]};
    nameObjectArray.push(nameObject);
  }

  mainView.router.load({
    template: myApp.templates.settings,
    animatePages:true,
    context: {"names":nameObjectArray}
  });
}

function loadZoneSettingsTemplate() {
  index = 1;
  mainView.router.load({
    template: myApp.templates.zonesettings,
    animatePages:true,
    context: {
      "zoneNumber":currentZoneNumber,
      "mode":modeArray[currentZoneNumber-1],
      "name":nameArray[currentZoneNumber-1]
    }
  });
}

// Login: Check if the channel is live by checking the update history. If there is a message than the corresponding Pi is active.
$$(document).on('click', '.login-button', function() {
  pubnubLogin();
})

$$(document).on('click', '.schedule-button', function() {
  // Get the corrsponding zone number
  var theClass = $$(this).attr("class");
  var regex = /zone-([0-9])/;
  var match = regex.exec(theClass);
  currentZoneNumber = parseInt(match[1]);
  loadZoneScheduleTemplate();
})

// Settings
$$(document).on('click', '.navbar .settings-button', function() {
  loadSettingsTemplate();
});

// Back
$$(document).on('click', '.navbar .back-button', function() {
  loadMainTemplate(); // TODO: figure out how to add back transition (see my question on framework7 forum Oct. 13 /16)
});

// Logout
$$(document).on('click', '.logout-button', function() {
  // Remove old thermostat reading divs otherwise they grow exponentially
  $$( ".current-temp, .desired-temp" ).remove();

  // Unsubscribe from channel
  pubnub.unsubscribe({
    channel: pubnubUpdateChannel
  })

  CMID = "";
  pubnubUpdateChannel = "";
  pubnubCommndChannel = "";

  loadLoginPage();
})

// Zone Settings
$$(document).on('click', '.zone-settings-button', function() {
  currentZoneNumber = parseInt($$(this).text().replace("Zone ", ""));
  loadZoneSettingsTemplate();
});

// Done adjusting zone Settings
// TODO: Save settings from this page to the corresponding arrays.
$$(document).on('click', '.done-button', function() {
  modeArray[currentZoneNumber-1] = $$('.mode .item-after').text();
  nameArray[currentZoneNumber-1] = $$('.name input').val();

  mainView.router.back({
    animatePages:true
  });
});



/*
* FUNCTIONS
*/
/* TESTING PAYLOAD SIZE */
// Calculating a PubNub Message Payload Size.
function calculate_payload_size( channel, message ) {
    return encodeURIComponent(
        channel + JSON.stringify(message)
    ).length + 100;
}
// Estimate of final JSON message in order to get an idea of max size. (Pubnub max is 32KB)
// CTRL + ALT + F to manually fold selected text
  var testMessage = [
{
  "name":"schedule-1",
  "monday":[
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70},
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70}
  ],
  "tuesday":[
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70},
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70}
  ],
  "wednesday":[
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70},
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70}
  ],
  "thursday":[
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70},
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70}
  ],
  "friday":[
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70},
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70}
  ],
  "saturday":[
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70},
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70}
  ],
  "sunday":[
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70},
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70}
  ]
},
{
  "name":"schedule-2",
  "monday":[
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70},
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70}
  ],
  "tuesday":[
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70},
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70}
  ],
  "wednesday":[
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70},
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70}
  ],
  "thursday":[
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70},
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70}
  ],
  "friday":[
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70},
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70}
  ],
  "saturday":[
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70},
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70}
  ],
  "sunday":[
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70},
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70}
  ]
},
{
  "name":"schedule-3",
  "monday":[
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70},
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70}
  ],
  "tuesday":[
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70},
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70}
  ],
  "wednesday":[
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70},
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70}
  ],
  "thursday":[
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70},
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70}
  ],
  "friday":[
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70},
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70}
  ],
  "saturday":[
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70},
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70}
  ],
  "sunday":[
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70},
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70}
  ]
},
{
  "name":"schedule-4",
  "monday":[
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70},
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70}
  ],
  "tuesday":[
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70},
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70}
  ],
  "wednesday":[
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70},
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70}
  ],
  "thursday":[
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70},
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70}
  ],
  "friday":[
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70},
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70}
  ],
  "saturday":[
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70},
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70}
  ],
  "sunday":[
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70},
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70}
  ]
},
{
  "name":"schedule-5",
  "monday":[
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70},
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70}
  ],
  "tuesday":[
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70},
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70}
  ],
  "wednesday":[
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70},
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70}
  ],
  "thursday":[
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70},
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70}
  ],
  "friday":[
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70},
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70}
  ],
  "saturday":[
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70},
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70}
  ],
  "sunday":[
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70},
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70}
  ]
},
{
  "name":"schedule-6",
  "monday":[
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70},
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70}
  ],
  "tuesday":[
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70},
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70}
  ],
  "wednesday":[
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70},
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70}
  ],
  "thursday":[
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70},
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70}
  ],
  "friday":[
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70},
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70}
  ],
  "saturday":[
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70},
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70}
  ],
  "sunday":[
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70},
    {"time":"06:00", "temp":75},
    {"time":"10:00", "temp":70},
    {"time":"16:00", "temp":78},
    {"time":"20:00", "temp":70}
  ]
}
]

console.log(calculate_payload_size(pubnubUpdateChannel, testMessage));



/*
* SIMPLE CONTROLS
*/
// Send command to the Pi with the desired temperatures.
$$(document).on('click', '.apply-button', function() {
  // Wipe the array, loop through all desired temps and push the cleaned numbers to an array.
  desiredTempArray  = [];
  $$(".desired-temp").each(function() {
    desiredTempArray.push(parseInt($$(this).text().replace("°", "")));
  });

  pubnubPublishCommand();
  pubnubPublishUpdate();
})

// Auto switch input box when full.
$$(".CMID-input").keyup(function() {
  if($$(this).val().length == 4) {
    $$(this).next().focus();
  }
})

// Attempt login when enter is pushed. TOOD: Change this for mobile? Does it need to be a form?
$$('.CMID-input').keydown(function (e) {
    if(e.keyCode == 13){
        pubnubLogin();
    }
})

// Increment corresponding desired temperature.
$$(document).on('click', '.increment', function() {
  var val = parseInt($$(this).prev().text().replace("°", "")) + 1;
  $$(this).prev().text(val + '°');
})

// Decrement corresponding desired temperature.
$$(document).on('click', '.decrement', function() {
  var val = parseInt($$(this).next().text().replace("°", "")) - 1;
  $$(this).next().text(val + '°');
})
