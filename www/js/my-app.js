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
var scheduleNameArray = []; // Schedule name for each thermostat. Each element refers to a schedule (Only used if in schedule mode).
var scheduleArray = [] // Schedule templates define time+temp pairs. A thermostat can use a template with name in scheduleNameArray[].

var currentPage = "main"; // Options are main, settings, manage, edit. I've implemented my own navigation to have better control of transitions.
var currentZoneNumber;
var currentScheduleNumber;
var index = 1;
var groupNumber = 0; // Used to number the buttons in the Edit Schedule page

// Accessible anywhere.
Template7.global = {
    material: isMaterial,
    ios: isIos,
    dayArray: ['M', 'T', 'W', 'Th', 'F', 'Sa', 'Su']
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
  currentPage = "main";
}

// Reload the current page when an update is recieved. inAnimated should be false (no transition)
function refreshPage() {
  switch(currentPage) {
    case "main":
      loadMainTemplate(true, false);
      break;
    case "settings":
      loadSettingsTemplate(true, false);
      break;
    case "manage":
      loadManageSchedulesTemplate(true, false);
      break;
    case "edit":
      loadEditScheduleTemplate(false);
      break;
    default:
      loadMainTemplate(true, false);
  }
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
      force:true,
      animatePages:isAnimated
    });
  }
  currentPage = "main";
}

function loadSettingsTemplate(isForward, isAnimated) {
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
      content: html,
      animatePages:isAnimated
    });
  } else {
    mainView.router.back({ // Back button pressed to reach this page.
      content: html,
      force:true,
      animatePages:isAnimated
    });
  }
  currentPage = "settings";
}

function loadManageSchedulesTemplate(isForward, isAnimated) {
  index = 1;
  var html = myApp.templates.manageschedules({
    "schedule":scheduleArray
  })

  if(isForward) {
    mainView.router.load({
      content: html,
      animatePages:isAnimated
    });
  } else {
    mainView.router.back({ // Back button pressed to reach this page.
      content: html,
      force:true,
      animatePages:isAnimated
    });
  }
  currentPage = "manage";
}

function loadEditScheduleTemplate(isAnimated) {
  index = 0;
  groupNumber = 0;


  var html = myApp.templates.editschedule({
    "name":scheduleArray[currentScheduleNumber].name,
    "groups":scheduleArray[currentScheduleNumber].groups
  })

  mainView.router.load({
    content: html,
    animatePages:isAnimated
  })
  currentPage = "edit";
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
  currentPage = "settings";
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
  loadSettingsTemplate(true, true);
});

// Back to main
$$(document).on('click', '.navbar .back-to-main-button', function() {
  loadMainTemplate(false,true);
});


// Manage Schedules
$$(document).on('click', '.manage-schedules-button', function() {
  loadManageSchedulesTemplate(true, true);
})

// Back to settings
$$(document).on('click', '.navbar .back-to-settings-button', function() {
  loadSettingsTemplate(false, true);
});

// Edit a Schedule
$$(document).on('click', '.edit-schedule-button', function() {
  // Get the corresponding schedule number (so we know which elements of our array to change.)
  var theClass = $$(this).attr("class");
  var regex = /schedule-([0-9])/;
  var match = regex.exec(theClass);
  currentScheduleNumber = parseInt(match[1]) - 1;

  loadEditScheduleTemplate(true);
})

$$(document).on('click', '.back-to-manage-schedules-button', function() {
  loadManageSchedulesTemplate(false, true);
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
  loadSettingsTemplate(false, true);
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

  loadLoginPage();
})



/*
* HELPER FUNCTIONS
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
    "name": [
      "Main Room",
      "Master Bedroom",
      "Basement",
      "Tommy's Bedroom",
      "Attic",
      "Kids Room"
    ],
    "currentTemp": [
      70,
      72,
      69,
      71,
      72,
      75
    ],
    "desiredTemp": [
      70,
      77,
      70,
      70,
      74,
      73
    ],
    "mode": [
      "Disable Thermostat",
      "Regular",
      "Schedule",
      "Schedule",
      "Regular",
      "Regular"
    ],
    "scheduleName": [
      "Schedule 1",
      "Schedule 2",
      "Schedule 2",
      "",
      "Schedule 1",
      ""
    ],
    "schedules": [
    {
      "name":"Schedule-1",
      "groups":[
        {"days":["monday","tuesday","wednesday","thursday","friday"],
         "pairs":[
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
        {"days":["saturday","sunday"],
         "pairs":[
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
    },
    {
      "name":"Schedule-2",
      "groups":[
        {"days":["monday","tuesday","wednesday","thursday","friday"],
         "pairs":[
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
        {"days":["saturday","sunday"],
         "pairs":[
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
    },
    {
      "name":"Schedule-3",
      "groups":[
        {"days":["monday","tuesday","wednesday","thursday","friday"],
         "pairs":[
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
        {"days":["saturday","sunday"],
         "pairs":[
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
    },
    {
      "name":"Schedule-4",
      "groups":[
        {"days":["monday","tuesday","wednesday","thursday","friday"],
         "pairs":[
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
        {"days":["saturday","sunday"],
         "pairs":[
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
   ]
  }
console.log(calculate_payload_size(pubnubUpdateChannel, testMessage));

function parseTimeTemp(text) {
  var regex = /([0-9]{2}):([0-9]{2}) - ([0-9]{2})/;
  var match = regex.exec(text);
  var hour = match[1];
  var min = match[2];
  var temp = match[3];

  console.log("timeTemp = " + hour + ' ' + min + ' ' + temp);
  return [hour, min, temp];
}



/*
* SIMPLE CONTROLS
*/
// Main Page - When apply is clicked send update to all connected devices
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

// Edit Schedule Page - Open modal for edit-time-temp
$$(document).on('click', '.edit-time-temp', function() {
  var target = $$(this).prev().children("span");
  console.log(target.text());
  var targetValues = parseTimeTemp(target.text());

  var picker = myApp.picker({
      input: 'garbage',
      rotateEffect: true,
      toolbarTemplate:
          '<div class="toolbar">' +
              '<div class="toolbar-inner">' +
                  '<div class="right">' +
                      '<a href="#" class="link close-picker">Done</a>' +
                  '</div>' +
              '</div>' +
          '</div>',
      cols: [
          {
              values: (function () {
                var arr = [];
                for (var i = 0; i <= 23; i++) { arr.push(i < 10 ? '0' + i : i); }
                return arr;
            })(),
            textAlign:'right'
          },
          {
            divider:true,
            content:':'
          },
          {
              values: ['00','15','30','45'],
              textAlign:'left'
          },
          {
            divider:true,
            content:' - '
          },
          {
            values: (function () {
              var arr = [];
              for (var i = 60; i <= 90; i++) { arr.push(i); }
              return arr;
            })(),
            textAlign:'right'
          },
          {
            divider:true,
            content:'°'
          }
      ],
      onChange: function (picker) {
          target.text(picker.cols[0].value + ':' + picker.cols[2].value + ' - ' + picker.cols[4].value + '°');
      }
  });
  picker.open();

  picker.cols[0].setValue(targetValues[0],0);
  picker.cols[2].setValue(targetValues[1],0);
  picker.cols[4].setValue(targetValues[2],0);
})

// Edit Schedule Page - Add new group.
$$(document).on('click', '.add-group-button', function() {
  var newGroup = {
    "days":[false,false,false,false,false,false,false],
    "pairs":[
      {
        "time":"06:00",
        "temp":75
      },
      {
        "time":"09:00",
        "temp":70
      },
      {
        "time":"17:00",
        "temp":75
      },
      {
        "time":"22:00",
        "temp":70
      }
    ]
  }
  scheduleArray[currentScheduleNumber].groups.push(newGroup);
  pubnubPublishUpdate();
})

// Garbage button on Edit Schedule page - enter delete mode
$$(document).on('click', '.edit-garbage-button', function(index) {
  // Show X for each group
  $$('.delete-group-button').each(function() {
    $$(this).css('opacity', 1);
  })

  // Change the garbage can button to done and adjust classes
  $$('.edit-garbage-button').removeClass('edit-garbage-button').addClass('edit-done-button');
  $$('.edit-done-button').children('i').removeClass('fa-trash-o').text('Done');

  // Change edit button to delete for each time-temp pair
  $$('.edit-time-temp').each(function() {
    $$(this).removeClass('edit-time-temp').addClass('delete-time-temp').children('i').removeClass('fa-pencil').addClass('fa-times');
  })
});

// Done button on Edit Schedule page - exit delete mode
$$(document).on('click', '.edit-done-button', function(index) {
  console.log("edit-done clicked");
  // Show X for each group
  $$('.delete-group-button').each(function() {
    $$(this).css('opacity', 0); // TODO - still clickable
  })

  // Change the garbage can button to done and adjust classes
  $$('.edit-garbage-button').addClass('edit-garbage-button').removeClass('edit-done-button');
  $$('.edit-done-button').children('i').addClass('fa-trash-o').text('');

  // Change edit button to delete for each time-temp pair
  $$('.edit-time-temp').each(function() {
    $$(this).addClass('edit-time-temp').removeClass('delete-time-temp').children('i').addClass('fa-pencil').removeClass('fa-times');
  })
});

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
  var val = parseInt($$(this).prev().text().replace("°", ""));
  if(val < 99){
    val++;
  }
  $$(this).prev().text(val + '°');
})

// Decrement corresponding desired temperature.
$$(document).on('click', '.decrement', function() {
  var val = parseInt($$(this).next().text().replace("°", ""));
  if(val > 50) {
    val--;
  }
  $$(this).next().text(val + '°');
})
