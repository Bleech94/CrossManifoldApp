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
var scheduleArray = []; // Schedule templates define time+temp pairs. A thermostat can use a template with name in scheduleNameArray[].
var tempScheduleArray = []; // Same as scheduleArray, but allows you to edit a schedule without refreshing whenever a message is recieved.

// Array of booleans corresponding to which of the above arrays are used on each page.
// This is used to determine if the page needs to be refreshed when a message is recieved.
var arraysUsedObj = {
  "main":[true,true,true,true,false,false],
  "settings":[true,false,false,true,false,false],
  "edit":[false,false,false,false,true,true],
  "manage":[false,false,false,false,true,false]
}

var currentPage = "main"; // Options are main, settings, manage, edit. I've implemented my own navigation to have better control of transitions.
var currentZoneNumber;
var currentScheduleNumber = 0;
var index = 1; // Used in various places for numbering in html templates.
var groupNumber = 0; // Used to number the buttons in the Edit Schedule page.
var pairNumber = 0; // Used to number the pairs in the Edit Schedule page.

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

  isEveryDayChecked();

  var html = myApp.templates.editschedule({
    "name":tempScheduleArray[currentScheduleNumber].name,
    "groups":tempScheduleArray[currentScheduleNumber].groups
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

// Login: Check if the channel is live by checking the update history. If there is a message then the corresponding Pi is active.
$$(document).on('click', '.login-button', function() {
  pubnubLogin();
})

// Settings
$$(document).on('click', '.navbar .settings-button', function() {
  loadSettingsTemplate(true, true);
});

// Back to Main
$$(document).on('click', '.navbar .back-to-main-button', function() {
  loadMainTemplate(false,true);
});


// Manage Schedules
$$(document).on('click', '.manage-schedules-button', function() {
  loadManageSchedulesTemplate(true, true);
})

// Back to Settings
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

// Back to Manage Schedules
$$(document).on('click', '.back-to-manage-schedules-button', function() {
  tempScheduleArray = JSON.parse(JSON.stringify(scheduleArray)); // Any changes not applied should be scrapped.
  loadManageSchedulesTemplate(false, true);
})

// Zone Settings
$$(document).on('click', '.zone-settings-button', function() {
  currentZoneNumber = parseInt($$(this).text().replace("Zone ", ""));
  loadZoneSettingsTemplate();
});

// Back to Settings and save new settings TODO: Change this so it doesn't send updates after every change?
$$(document).on('click', '.navbar .back-to-settings-save-button', function() {
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
* CONTROL
*/
// Main Page - Select a schedule
$$(document).on('click', '.select-schedule-button', function() {
  // Get the corrsponding zone number
  var theClass = $$(this).attr("class");
  var regex = /zone-([0-9])/;
  var match = regex.exec(theClass);
  currentZoneNumber = parseInt(match[1]);
})

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
      },
      onClose: function(picker) {
        var theClass = target.attr("class");

        // Get group number
        var group = getGroupNumber(target);

        // Get pair number
        regex = /pair-([0-9])/;
        match = regex.exec(theClass);
        var pair = parseInt(match[1]);

        tempScheduleArray[currentScheduleNumber].groups[group].pairs[pair].time = picker.cols[0].value + ':' + picker.cols[2].value;
        tempScheduleArray[currentScheduleNumber].groups[group].pairs[pair].temp = picker.cols[4].value
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
  tempScheduleArray[currentScheduleNumber].groups.push(newGroup);
  refreshPage();
})

// Edit Schedule - garbage/Done icon
$$(document).on('click', '.edit-garbage-button', function(event) {

if($$('.delete-group-button').eq(0).css('opacity') == 0) { // Garbage button on Edit Schedule page - enter delete mode
  // Show X for each group
  $$('.delete-group-button').each(function() {
    $$(this).css('opacity', 1);
  })

  // Change the garbage can button to Done
  $$('.edit-garbage-button').children('i').removeClass('fa-trash-o').text('Done');

  // Change edit button to delete for each time-temp pair
  $$('.edit-time-temp').each(function() {
    $$(this).removeClass('edit-time-temp').addClass('delete-time-temp').children('i').removeClass('fa-pencil').addClass('fa-times');
  })
} else { // Done button on Edit Schedule page - exit delete mode

  // Hide X for each group
  $$('.delete-group-button').each(function() {
    $$(this).css('opacity', 0); // TODO - make unclickable
  })

  // Change Done to the garbage can button
  $$('.edit-garbage-button').children('i').addClass('fa-trash-o').text('');

  // Change delete button to edit for each time-temp
  $$('.delete-time-temp').each(function() {
    $$(this).addClass('edit-time-temp').removeClass('delete-time-temp').children('i').addClass('fa-pencil').removeClass('fa-times');
  })
}
});

// Edit Schedule - Delete group
$$(document).on('click', '.delete-group-button', function(event) {
  var theParent = $$(this).parent().text();
  var regex = /Group ([0-9])/;
  var match = regex.exec(theParent);
  var selectedGroupIndex = parseInt(match[1]) - 1;

  tempScheduleArray[currentScheduleNumber].groups.splice(selectedGroupIndex, 1);

  refreshPage();
  $$('.edit-garbage-button').click();
})

// Edit Schedule - Apply changes
$$(document).on('click', '.apply-schedule-button', function() {
  var target = $$("input[name='M']:checked");
  var group = getGroupNumber(target);
  setDayInGroup(0, group);

  target = $$("input[name='T']:checked");
  group = getGroupNumber(target);
  setDayInGroup(1, group);

  target = $$("input[name='W']:checked");
  group = getGroupNumber(target);
  setDayInGroup(2, group);

  target = $$("input[name='Th']:checked");
  group = getGroupNumber(target);
  setDayInGroup(3, group);

  target = $$("input[name='F']:checked");
  group = getGroupNumber(target);
  setDayInGroup(4, group);

  target = $$("input[name='Sa']:checked");
  group = getGroupNumber(target);
  setDayInGroup(5, group);

  target = $$("input[name='Su']:checked");
  group = getGroupNumber(target);
  setDayInGroup(6, group);


  scheduleArray = JSON.parse(JSON.stringify(tempScheduleArray));
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



/*
* HELPER FUNCTIONS
*/
// Get the number from group-<number> class
function getGroupNumber(target) {
  var theClass = target.attr("class");
  var regex = /group-([0-9])/;
  var match = regex.exec(theClass);
  return parseInt(match[1]);
}

// Set each day of a schedule to true for 1 group and false for the rest.
function setDayInGroup(day, group) {
  tempScheduleArray[currentScheduleNumber].groups[group].days[day] = true;

  for(var i = 0; i < tempScheduleArray[currentScheduleNumber].groups.length; i++) {
    if(i != group) {
      tempScheduleArray[currentScheduleNumber].groups[i].days[day] = false;
    }
  }
}

/* TESTING PAYLOAD SIZE */
// Calculating a PubNub Message Payload Size.
function calculate_payload_size( channel, message ) {
    return encodeURIComponent(
        channel + JSON.stringify(message)
    ).length + 100;
}
// Estimate of final JSON message in order to get an idea of max size. (Pubnub max is 32KB)
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

// Ensure that each day has 1 box selected, if not select group 1. Names: ['M', 'T', 'W', 'Th', 'F', 'Sa', 'Su']
function isEveryDayChecked() {
  var dayBools = [false,false,false,false,false,false,false] // Initially false for every day.

  // Loop through each group in the current schedule
  for(var i = 0; i < tempScheduleArray[currentScheduleNumber].groups.length; i++) {
    // Loop through each day of the week
    for(var j = 0; j < 7;j++) {
      // If this day is selected (True)
      if(tempScheduleArray[currentScheduleNumber].groups[i].days[j]) {
        // If this day already has a true value
        if(dayBools[j]) {
          // Unselect this day from the schedule
          tempScheduleArray[currentScheduleNumber].groups[i].days[j] = false;
        } else {
          // Set dayBools to true for this day
          dayBools[j] = true;
        }
      }
    }
  }

  // If any day is unselected in every group then select it in the first group.
  for(var k = 0; k < 7; k++) {
    if(!dayBools[k]) {
      tempScheduleArray[currentScheduleNumber].groups[0].days[k] = true;
    }
  }
}

function parseTimeTemp(text) {
  var regex = /([0-9]{2}):([0-9]{2}) - ([0-9]{2})/;
  var match = regex.exec(text);
  var hour = match[1];
  var min = match[2];
  var temp = match[3];

  //console.log("timeTemp = " + hour + ' ' + min + ' ' + temp);
  return [hour, min, temp];
}
