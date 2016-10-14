/*
* INITIALIZE
*/
var isMaterial = Framework7.prototype.device.ios === false;
var isIos = Framework7.prototype.device.ios === true;

var CMID = ""; // Cross Manifold ID. TODO: Store locally.
var pubnubUpdateChannel = "CM_Update_" + CMID; // This channel is for updates from the Pi that will be displayed on the app.

// Arrays to store thermostat info and settings found within each message.
var nameArray = []; // Zone names
var currentTempArray = []; // Current temperature of each thermostat
var desiredTempArray = []; // Desired temperature of each thermostat
var modeArray = []; // Mode that each thermostat is set to
var scheduleNameArray = []; // Schedule name for each thermostat references a template (Only used if in schedule mode).
var scheduleArray = [] // Schedule templates define time+temp pairs. A thermostat can use a template with name in scheduleNameArray[].

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
    domCache: true
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

// Initialize Pubnub
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

// Load the main page
function loadMainTemplate(isForward, isAnimated) {
  // Remove old thermostat reading divs otherwise they grow exponentially
  $$( ".current-temp, .desired-temp" ).remove();

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

  var html = myApp.templates.main({
    "thermostatDetails":thermostatArray
  })

  if(isForward) {
    mainView.router.load({
      content: html,
      animatePages:isAnimated
    });
  } else {
    mainView.router.back({ // Back button pressed to reach this page.
      content: html,
      force:true
    });
  }
}

function loadSettingsTemplate(isForward) {
  index = 1;
  var nameObjectArray = [];

  for(var i = 0; i < nameArray.length; i++) {
    var nameObject = {"name":nameArray[i]};
    nameObjectArray.push(nameObject);
  }

  var html = myApp.templates.settings({
    "names":nameObjectArray
  })

  if(isForward) {
    mainView.router.load({
      content: html
    });
  } else {
    mainView.router.back({ // Back button pressed to reach this page.
      content: html,
      force:true
    });
  }
}

function loadManageSchedulesTemplate(isForward) {
  var html = myApp.templates.manageschedules({
    "schedule":scheduleArray
  })

  if(isForward) {
    mainView.router.load({
      content: html
    });
  } else {
    mainView.router.back({ // Back button pressed to reach this page.
      content: html,
      force:true
    });
  }
}

function loadEditScheduleTemplate() {
  var html = myApp.templates.editschedule({

  })

  mainView.router.load({
    content: html
  })
}

function loadZoneSettingsTemplate() {
  index = 1;

  var html = myApp.templates.zonesettings({
    "zoneNumber":currentZoneNumber,
    "mode":modeArray[currentZoneNumber-1],
    "name":nameArray[currentZoneNumber-1]
  })

  mainView.router.load({
    content: html
  });
}

// Login: Check if the channel is live by checking the update history. If there is a message than the corresponding Pi is active.
$$(document).on('click', '.login-button', function() {
  pubnubLogin();
})

$$(document).on('click', '.select-schedule-button', function() {
  // Get the corrsponding zone number
  var theClass = $$(this).attr("class");
  var regex = /zone-([0-9])/;
  var match = regex.exec(theClass);
  currentZoneNumber = parseInt(match[1]);
})

// Settings
$$(document).on('click', '.navbar .settings-button', function() {
  loadSettingsTemplate(true);
});

// Back to main
$$(document).on('click', '.navbar .back-to-main-button', function() {
  loadMainTemplate(false,true);
});


// Manage Schedules
$$(document).on('click', '.manage-schedules-button', function() {
  loadManageSchedulesTemplate(true);
})

$$(document).on('click', '.edit-schedule-button', function() {
  loadEditScheduleTemplate();
})

$$(document).on('click', '.back-to-manage-schedules-button', function() {
  loadManageSchedulesTemplate(false);
})

// Zone Settings
$$(document).on('click', '.zone-settings-button', function() {
  currentZoneNumber = parseInt($$(this).text().replace("Zone ", ""));
  loadZoneSettingsTemplate();
});

// Back to settings and save new settings TODO: Change this so it doesn't send updates after every change?
$$(document).on('click', '.navbar .back-to-settings-save-button', function() {
  console.log("back to settings");
  nameArray[currentZoneNumber-1] = $$('.name input').val();
  modeArray[currentZoneNumber-1] = $$('.mode .item-after').text();
  pubnubPublishUpdate();
  loadSettingsTemplate(false);
});


// Back to settings
$$(document).on('click', '.navbar .back-to-settings-button', function() {
  loadSettingsTemplate(false);
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
var testMessage = {

"name":["Living Room","Master Bedroom","Basement","Tommy's Bedroom","Attic","Kids Room"],

"currentTemp":[70,72,69,71,72,75],

"desiredTemp":[73,72,70,69,72,74],

"mode":["Schedule","Schedule","Schedule","Regular","Schedule","Regular"],

"scheduleName":["Schedule 1","Schedule 2","Schedule 2","","Schedule 1",""],

"schedule": [

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

}

]

}
//console.log(calculate_payload_size(pubnubUpdateChannel, testMessage));



/*
* SIMPLE CONTROLS
*/
// Send update to all connected devices
$$(document).on('click', '.apply-button', function() {
  // Wipe the array, loop through all desired temps and push the cleaned numbers to an array.
  desiredTempArray  = [];
  $$(".desired-temp").each(function() {
    var desiredTemp = parseInt($$(this).text().replace("°", ""));
    if(desiredTemp) {
      desiredTempArray.push(desiredTemp);
    } else {
      desiredTempArray.push(70);
    }
  });
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
