/*
* INITIALIZE
*/
var isMaterial = Framework7.prototype.device.ios === false;
var isIos = Framework7.prototype.device.ios === true;

var CMID = ""; // Cross Manifold ID. TODO: Store locally.
var pubnubUpdateChannel = "CM_Update_" + CMID; // This channel is for updates from the Pi that will be displayed on the app.

var loginLocked = false; // To ensure the user only tries to login once at a time. // TODO Delete

// Arrays to store thermostat info and settings found within each message.
var nameArray = []; // Zone names
var currentTempArray = []; // Current temperature of each thermostat
var desiredTempArray = []; // Desired temperature of each thermostat
var modeArray = []; // Mode that each thermostat is set to
var scheduleNameArray = []; // Schedule name for each thermostat. Each element refers to a schedule (Only used if in schedule mode).
var scheduleArray = []; // Schedule templates define time+temp pairs. A thermostat can use a template with name in scheduleNameArray[].
var tempScheduleArray = []; // Same as scheduleArray. This allows you to edit a schedule without refreshing whenever a message is recieved.

// Array of booleans corresponding to which of the above arrays are used on each page.
// This is used to determine if the page needs to be refreshed when a message is recieved.
var arraysUsedObj = {
    "main":[true,true,true,true,false,false],
    "settings":[true,false,false,true,false,false],
    "edit":[false,false,false,false,true,true],
    "manage":[false,false,false,false,true,false]
}

var deleteMode = false;

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
    domCache: false
});

// TODO: Switch back to 'deviceready' event after testing
// Handle Cordova Device Ready Event
$$(document).on('deviceready', function() {
    console.log("Device is ready!");
    document.addEventListener("backbutton", backPage, false)
});

/*
if (navigator.userAgent.match(/(iPhone|Android)/)) {
    document.addEventListener("deviceready", onDeviceReady, false);
} else {
    onDeviceReady();
}
function onDeviceReady() {
    console.log("Device is ready!");
}
*/

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
// TODO: Logout is broken unless I use domCache = true (which breaks scrollTop())
function loadLoginPage() {
    console.log("Loading login page");
    index = 1;
    mainView.router.load({
        template: myApp.templates.login
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

function backPage() {
    switch(currentPage) {
        case "main":
            loadMainTemplate(true, false); // TODO: Close app?
            break;
        case "settings":
            loadMainTemplate(false, true);
            break;
        case "manage":
            loadSettingsTemplate(false, true);
            break;
        case "edit":
            loadManageSchedulesTemplate(false,true);
            break;
        default:
            loadMainTemplate(false, true); // TODO: change to something else?
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
            "mode":modeArray[i],
            "schedule":scheduleNameArray[i]
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

// Load page to select a schedule for current zone
function loadSelectTemplate(isAnimated) {
    index = 1;

    var nameArray = [];
    for(var i = 0; i < scheduleArray.length; i++) {
        nameArray.push(scheduleArray[i].name);
    }

    var html = myApp.templates.select({
        "names": nameArray
    })

    mainView.router.load({ // Back button pressed to reach this page.
        content: html,
        force:true,
        animatePages:isAnimated
    })
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

    if(deleteMode) {
        // Change the garbage can button to Done
        $$('.manage-garbage-button').children('i').removeClass('fa-trash-o').text('Done');

        // Change the button classes from edit to delete, hide the arrows and add garbage cans
        $$('.edit-schedule-button').each(function() {
            $$(this).addClass('delete-schedule-button').removeClass('edit-schedule-button').children('.item-inner').css('background-size', '0 0').children('.item-after').children('i').addClass('fa-times');
        })
    }
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

    // Scroll back to current position when page loads (only used when the page is refreshed).
    $$('.page-content').scrollTop($$('.page-content').offset().top, 0);

    // Make the page look
    if(deleteMode) {
        // Show X for each group
        $$('.delete-group-button').each(function() {
            $$(this).css('opacity', 1).css('pointer-events', 'auto');
        })

        // Change the garbage can button to Done
        $$('.edit-garbage-button').children('i').removeClass('fa-trash-o').text('Done');

        // Change edit button to delete for each time-temp pair
        $$('.edit-time-temp-button').each(function() {
            $$(this).removeClass('edit-time-temp-button').addClass('delete-time-temp-button').children('i').removeClass('fa-pencil').addClass('fa-times');
        })
    }
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
    // Prevent trying to login multiple times at once - this causes weird issues.
    if(loginLocked == false) {
        loginLocked = true;
        pubnubLogin();
    }
    setTimeout(function() {
        loginLocked = false;
    }, 1000);
    if(Keyboard.isVisible) {
        myApp.alert("keyboard active");
        Keyboard.hide();
    }
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
    deleteMode = false;
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
    parseWeekdaySelectors();
    deleteMode = false;

    // If changes were made and not applied ask if they would like to save their changes.
    if(!isJSONEqual(scheduleArray, tempScheduleArray) || ($$('.name input').val() != scheduleArray[currentScheduleNumber].name)) {
        myApp.modal({
            title:  'Unsaved Changes',
            text: 'Would you like to save your changes?',
            buttons: [
                {
                    text: 'Yes',
                    onClick: function() { // TODO: cleanup. Same code as apply-schedule-button
                        myApp.showIndicator();
                        setTimeout(function () {
                            myApp.hideIndicator();
                        }, 1200);
                        // Prevent duplicate names.
                        if(!isNameAvailable($$('.name input').val()) &&
                         $$('.name input').val() != scheduleArray[currentScheduleNumber].name) {
                            myApp.alert("You cannot have 2 schedules with the same name.", "Changes Not Applied");
                            return;
                        }

                        // Update the nameArray
                        for(var i = 0; i < scheduleNameArray.length; i ++) {
                            if(scheduleNameArray[i] == tempScheduleArray[currentScheduleNumber].name) {
                                scheduleNameArray[i] = $$('.name input').val();
                            }
                        }

                        // Set the new schedule name.
                        tempScheduleArray[currentScheduleNumber].name = $$('.name input').val();

                        // NOTE: The time-temp pairs are automatically updated in tempSchedule when they're changed.

                        // Sort all time-temps by time within each group
                        for(var i = 0; i < tempScheduleArray[currentScheduleNumber].groups.length; i++) {
                            tempScheduleArray[currentScheduleNumber].groups[i].pairs = sortTimeTemps(tempScheduleArray[currentScheduleNumber].groups[i].pairs);
                        }

                        // Apply the changes by making the schedule = tempSchedule.
                        scheduleArray = JSON.parse(JSON.stringify(tempScheduleArray));

                        pubnubPublishUpdate();
                        loadManageSchedulesTemplate(false, true);
                    }
                },
                {
                    text: 'No',
                    onClick: function() {
                        deleteMode = false;
                        tempScheduleArray = JSON.parse(JSON.stringify(scheduleArray)); // Any changes not applied should be scrapped.
                        loadManageSchedulesTemplate(false, true);
                    }
                }
            ]
        })
    } else {
        tempScheduleArray = JSON.parse(JSON.stringify(scheduleArray)); // Any changes not applied should be scrapped.
        loadManageSchedulesTemplate(false, true);
    }
})

// Zone Settings
$$(document).on('click', '.zone-settings-button', function() {
    currentZoneNumber = parseInt($$(this).text().replace("Zone ", ""));
    loadZoneSettingsTemplate();
});

// Back to Settings and save new settings TODO: Change this so there is a name page and a mode page instead of a page for each zone?
$$(document).on('click', '.navbar .back-to-settings-save-button', function() {
    // If the name or mode have changed then publish update.
    if(!(isJSONEqual(nameArray[currentZoneNumber-1], $$('.name input').val()) &&
    isJSONEqual(modeArray[currentZoneNumber-1], $$('.mode .item-after').text()))) {
        nameArray[currentZoneNumber-1] = $$('.name input').val();

        // Make Disable Thermostat shorter.
        if($$('.mode .item-after').text() == "Disable Theromstat") {
            modeArray[currentZoneNumber-1] = "Disable";
        } else {
            modeArray[currentZoneNumber-1] = $$('.mode .item-after').text();
        }
        pubnubPublishUpdate();
    }
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
$$(document).on('click', '.list-schedules-button', function() {
    // Get the corrsponding zone number
    var theClass = $$(this).attr("class");
    var regex = /zone-([0-9])/;
    var match = regex.exec(theClass);
    currentZoneNumber = parseInt(match[1]);
    console.log(currentZoneNumber);

    loadSelectTemplate(true);
})

$$(document).on('click', '.select-schedule-button', function() {
    scheduleNameArray[currentZoneNumber-1] = $$(this).text();
    loadMainTemplate(false, true);
})

// Main Page - When apply is clicked send update to all connected devices
$$(document).on('click', '.apply-button', function() {
    myApp.showIndicator();
    setTimeout(function () {
        myApp.hideIndicator();
    }, 1000);
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

// Manage Schedules Page - Add a new Schedule
$$(document).on('click', '.add-schedule-button', function() {
    if(scheduleArray.length >= 6) {
        myApp.alert("You may only have 6 schedules at a time.", "Cannot Create Schedule");
        return;
    }

    var newScheduleName = findScheduleName();
    var newSchedule = {
        "name":newScheduleName,
        "groups":[
            {"days":[true,true,true,true,true,false,false],
            "pairs":[
                {"time":"02:00","temp":"75"},
                {"time":"09:00","temp":70},
                {"time":"17:00","temp":75},
                {"time":"22:00","temp":70}]
            },
            {"days":[false,false,false,false,false,true,true],
            "pairs":[
                {"time":"05:00","temp":"75"},
                {"time":"09:00","temp":70},
                {"time":"17:00","temp":75},
                {"time":"22:00","temp":70}]
            }
        ]
    }

    scheduleArray.push(newSchedule);
    tempScheduleArray.push(newSchedule);
    pubnubPublishUpdate();
    refreshPage();
})

// Manage Schedules Page - Garbage/Done button
$$(document).on('click', '.manage-garbage-button', function(event) {
    if($$(this).text() == '') {
        deleteMode = true;

        // Change the garbage can button to Done
        $$('.manage-garbage-button').children('i').removeClass('fa-trash-o').text('Done');

        // Change the button classes from edit to delete, hide the arrows and add garbage cans
        $$('.edit-schedule-button').each(function() {
            $$(this).addClass('delete-schedule-button').removeClass('edit-schedule-button').children('.item-inner').css('background-size', '0 0').children('.item-after').children('i').addClass('fa-times');
        })
    } else {
        deleteMode = false;

        // Change the garbage can button to Done
        $$('.manage-garbage-button').children('i').addClass('fa-trash-o').text('');

        // Change the button classes from edit to delete, hide the arrows and add garbage cans
        $$('.delete-schedule-button').each(function() {
            $$(this).removeClass('delete-schedule-button').addClass('edit-schedule-button').children('.item-inner').css('background-size', '10px 20px').children('.item-after').children('i').removeClass('fa-times');
        })
    }
});

// Manage Schedules Page - Delete schedule
$$(document).on('click', '.delete-schedule-button', function(event) {
    if(tempScheduleArray.length > 1) {
        var scheduleName = $$(this).text();
        var scheduleIndex;
        for(scheduleIndex = 0; scheduleIndex < tempScheduleArray.length; scheduleIndex++) {
            if(tempScheduleArray[scheduleIndex].name == scheduleName) {
                break;
            }
        }

        // If any zones have this schedule selected change them to the first one.
        for(var i = 0; i < scheduleNameArray.length; i++) {
            if(scheduleNameArray[i] == scheduleName) {
                if(scheduleIndex != 0) { // If we are not deleting the 0th element
                    scheduleNameArray[i] = tempScheduleArray[0].name;
                } else {
                    scheduleNameArray[i] = tempScheduleArray[1].name;
                }
            }
        }

        tempScheduleArray.splice(scheduleIndex, 1);
        scheduleArray.splice(scheduleIndex, 1);
        pubnubPublishUpdate();
        refreshPage();
    } else {
        myApp.alert("You must have at least 1 schedule.", "Cannot Delete"); // TODO add confirm() to delete this schedule?
    }
})

// Edit Schedule Page - Open modal for edit-time-temp-button
$$(document).on('click', '.edit-time-temp-button', function() {
    var target = $$(this)
    var textTarget = $$(this).prev().children("span");
    var targetValues = parseTimeTemp(textTarget.text());

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
            textTarget.text(picker.cols[0].value + ':' + picker.cols[2].value + ' - ' + picker.cols[4].value + '°');
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

// Edit Schedule Page - Add Time-Temp
$$(document).on('click', '.add-time-temp-button', function() {
    // Get the group number we're adding to.
    var groupNum = getGroupNumber($$(this));

    if(tempScheduleArray[currentScheduleNumber].groups[groupNum].pairs.length >= 10) {
        myApp.alert("You can only have 10 time-temperature pairs per group.", "Cannot Add Pair");
        return;
    }

    var timeTemp = {
        "time":"12:00",
        "temp":70
    }

    // Add the time-temp to the temp Schedule
    tempScheduleArray[currentScheduleNumber].groups[groupNum].pairs.push(timeTemp);
    parseWeekdaySelectors();
    refreshPage();
})

$$(document).on('click','.delete-time-temp-button',function(){
    var regex = /pair-([0-9])/;
    var match = regex.exec($$(this).attr("class"));
    var pairNum = parseInt(match[1]);
    var groupNum = getGroupNumber($$(this));

    if(tempScheduleArray[currentScheduleNumber].groups[groupNum].pairs.length > 2) {
        parseWeekdaySelectors();
        tempScheduleArray[currentScheduleNumber].groups[groupNum].pairs.splice(pairNum, 1);
        refreshPage();
    } else {
        myApp.alert("You must have at least 2 time-temperature pairs per group.", "Cannot Delete Pair")
    }
})

// Edit Schedule Page - Add new group.
$$(document).on('click', '.add-group-button', function() {
    if(tempScheduleArray[currentScheduleNumber].groups.length < 7) {
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
        parseWeekdaySelectors();
        refreshPage();
    } else {
        myApp.alert("You can only have 1 group per day.", "Cannot Add Group");
    }
})

// Edit Schedule Page - garbage/Done icon
$$(document).on('click', '.edit-garbage-button', function(event) {
    if($$('.delete-group-button').eq(0).css('opacity') == 0) { // Garbage button on Edit Schedule page - enter delete mode
        deleteMode = true;

        // Show X for each group
        $$('.delete-group-button').each(function() {
            $$(this).css('opacity', 1).css('pointer-events', 'auto');
        })

        // Change the garbage can button to Done
        $$('.edit-garbage-button').children('i').removeClass('fa-trash-o').text('Done');

        // Change edit button to delete for each time-temp pair
        $$('.edit-time-temp-button').each(function() {
            $$(this).removeClass('edit-time-temp-button').addClass('delete-time-temp-button').children('i').removeClass('fa-pencil').addClass('fa-times');
        })
    } else { // Done button on Edit Schedule page - exit delete mode
        deleteMode = false;

        // Hide X for each group
        $$('.delete-group-button').each(function() {
            $$(this).css('opacity', 0).css('pointer-events','none');
        })

        // Change Done to the garbage can button
        $$('.edit-garbage-button').children('i').addClass('fa-trash-o').text('');

        // Change delete button to edit for each time-temp
        $$('.delete-time-temp-button').each(function() {
            $$(this).addClass('edit-time-temp-button').removeClass('delete-time-temp-button').children('i').addClass('fa-pencil').removeClass('fa-times');
        })
    }
});

// Edit Schedule Page - Delete group
$$(document).on('click', '.delete-group-button', function(event) {
    if(tempScheduleArray[currentScheduleNumber].groups.length > 1) {
        var theParent = $$(this).parent().text();
        var regex = /Group ([0-9])/;
        var match = regex.exec(theParent);
        var selectedGroupIndex = parseInt(match[1]) - 1;

        // save the current weekday selectors incase they were changed.
        parseWeekdaySelectors();

        // Change all weekday selectors of the deleted group to the first group.
        tempScheduleArray[currentScheduleNumber].groups[selectedGroupIndex].days.forEach(function(isDaySelected, index) {
            if(isDaySelected) {
                tempScheduleArray[currentScheduleNumber].groups[selectedGroupIndex > 0 ? 0 : 1].days[index] = true;
            }
        })

        // Delete the group
        tempScheduleArray[currentScheduleNumber].groups.splice(selectedGroupIndex, 1);

        refreshPage();
        //$$('.edit-garbage-button').click(); // TODO: Find a way to deal with this - even with delay doesn't work consistently.
    } else {
        myApp.alert("You must have at least 1 group.", "Cannot Delete"); // TODO add confirm() to delete this schedule?
    }
})

// Edit Schedule Page - Apply changes
$$(document).on('click', '.apply-schedule-button', function() {
    myApp.showIndicator();
    setTimeout(function () {
        myApp.hideIndicator();
    }, 1200);
    // Prevent duplicate names.
    if(!isNameAvailable($$('.name input').val()) &&
     $$('.name input').val() != scheduleArray[currentScheduleNumber].name) {
        myApp.alert("You cannot have 2 schedules with the same name.", "Changes Not Applied");
        return;
    }

    // Update the nameArray
    for(var i = 0; i < scheduleNameArray.length; i ++) {
        if(scheduleNameArray[i] == tempScheduleArray[currentScheduleNumber].name) {
            scheduleNameArray[i] = $$('.name input').val();
        }
    }

    // Set the new schedule name.
    tempScheduleArray[currentScheduleNumber].name = $$('.name input').val();

     // Grab the values of the weekday selectors.
    parseWeekdaySelectors();

    // NOTE: The time-temp pairs are automatically updated in tempSchedule when they're changed.

    // Sort all time-temps by time within each group
    for(var i = 0; i < tempScheduleArray[currentScheduleNumber].groups.length; i++) {
        tempScheduleArray[currentScheduleNumber].groups[i].pairs = sortTimeTemps(tempScheduleArray[currentScheduleNumber].groups[i].pairs);
    }

    // Apply the changes by making the schedule = tempSchedule.
    scheduleArray = JSON.parse(JSON.stringify(tempScheduleArray));

    pubnubPublishUpdate();
    refreshPage();
})

// Auto switch input box when full.
$$(document).on("keyup", ".CMID-input", function() {
    if($$(this).val().length == 4) {
        $$(this).next().focus();
    }
})

// Attempt login when enter is pushed. TOOD: Change this for mobile? Does it need to be a form?
$$(document).on('keydown', '.CMID-input', function (e) {
    if(e.keyCode == 13){
        $$('.login-button').click();
    }
});

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

/* TESTING PAYLOAD SIZE */
// Calculating a PubNub Message Payload Size.
function calculate_payload_size( channel, message ) {
    return encodeURIComponent(
        channel + JSON.stringify(message)
    ).length + 100;
}
// Estimate of final JSON message in order to get an idea of max size. (Pubnub max is 32KB)
var testMessage ={"names":["Living Room","Master Bedroom","Basement","Tommy's Bedroom","Attic","Kids Room","Living Room","Master Bedroom","Basement","Tommy's Bedroom","Attic","Kids Room"],"currentTemps":[75,72,69,71,73,75,75,72,69,71,73,75],"desiredTemps":[68,70,72,70,70,74,75,72,69,71,73,75],"modes":["Regular","Schedule","Disable Thermostat","Schedule","Schedule","Regular","Regular","Schedule","Disable Thermostat","Schedule","Schedule","Regular"],"scheduleNames":["Winter","Winter","Winter","Winter","Winter","Winter","Winter","Winter","Winter","Winter","Winter","Winter"],"schedules":[{"name":"Winter","groups":[{"days":[true,false,false,false,false,false,false],"pairs":[{"time":"02:00","temp":"75"},{"time":"09:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"17:00","temp":75},{"time":"22:00","temp":70}]},{"days":[false,false,false,false,false,false,true],"pairs":[{"time":"05:00","temp":"75"},{"time":"09:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"17:00","temp":75},{"time":"22:00","temp":70}]},{"days":[false,true,false,false,false,false,false],"pairs":[{"time":"06:00","temp":75},{"time":"09:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"17:00","temp":75},{"time":"22:00","temp":70}]},{"days":[false,false,true,false,false,false,false],"pairs":[{"time":"06:00","temp":75},{"time":"09:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"17:00","temp":75},{"time":"22:00","temp":70}]},{"days":[false,false,false,true,false,false,false],"pairs":[{"time":"06:00","temp":75},{"time":"09:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"17:00","temp":75},{"time":"22:00","temp":70}]},{"days":[false,false,false,false,true,false,false],"pairs":[{"time":"06:00","temp":75},{"time":"09:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"17:00","temp":75},{"time":"22:00","temp":70}]},{"days":[false,false,false,false,false,true,false],"pairs":[{"time":"06:00","temp":75},{"time":"09:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"17:00","temp":75},{"time":"22:00","temp":70}]}]},{"name":"Winter","groups":[{"days":[true,false,false,false,false,false,false],"pairs":[{"time":"02:00","temp":"75"},{"time":"09:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"17:00","temp":75},{"time":"22:00","temp":70}]},{"days":[false,false,false,false,false,false,true],"pairs":[{"time":"05:00","temp":"75"},{"time":"09:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"17:00","temp":75},{"time":"22:00","temp":70}]},{"days":[false,true,false,false,false,false,false],"pairs":[{"time":"06:00","temp":75},{"time":"09:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"17:00","temp":75},{"time":"22:00","temp":70}]},{"days":[false,false,true,false,false,false,false],"pairs":[{"time":"06:00","temp":75},{"time":"09:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"17:00","temp":75},{"time":"22:00","temp":70}]},{"days":[false,false,false,true,false,false,false],"pairs":[{"time":"06:00","temp":75},{"time":"09:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"17:00","temp":75},{"time":"22:00","temp":70}]},{"days":[false,false,false,false,true,false,false],"pairs":[{"time":"06:00","temp":75},{"time":"09:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"17:00","temp":75},{"time":"22:00","temp":70}]},{"days":[false,false,false,false,false,true,false],"pairs":[{"time":"06:00","temp":75},{"time":"09:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"17:00","temp":75},{"time":"22:00","temp":70}]}]},{"name":"Winter","groups":[{"days":[true,false,false,false,false,false,false],"pairs":[{"time":"02:00","temp":"75"},{"time":"09:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"17:00","temp":75},{"time":"22:00","temp":70}]},{"days":[false,false,false,false,false,false,true],"pairs":[{"time":"05:00","temp":"75"},{"time":"09:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"17:00","temp":75},{"time":"22:00","temp":70}]},{"days":[false,true,false,false,false,false,false],"pairs":[{"time":"06:00","temp":75},{"time":"09:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"17:00","temp":75},{"time":"22:00","temp":70}]},{"days":[false,false,true,false,false,false,false],"pairs":[{"time":"06:00","temp":75},{"time":"09:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"17:00","temp":75},{"time":"22:00","temp":70}]},{"days":[false,false,false,true,false,false,false],"pairs":[{"time":"06:00","temp":75},{"time":"09:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"17:00","temp":75},{"time":"22:00","temp":70}]},{"days":[false,false,false,false,true,false,false],"pairs":[{"time":"06:00","temp":75},{"time":"09:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"17:00","temp":75},{"time":"22:00","temp":70}]},{"days":[false,false,false,false,false,true,false],"pairs":[{"time":"06:00","temp":75},{"time":"09:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"17:00","temp":75},{"time":"22:00","temp":70}]}]},{"name":"Winter","groups":[{"days":[true,false,false,false,false,false,false],"pairs":[{"time":"02:00","temp":"75"},{"time":"09:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"17:00","temp":75},{"time":"22:00","temp":70}]},{"days":[false,false,false,false,false,false,true],"pairs":[{"time":"05:00","temp":"75"},{"time":"09:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"17:00","temp":75},{"time":"22:00","temp":70}]},{"days":[false,true,false,false,false,false,false],"pairs":[{"time":"06:00","temp":75},{"time":"09:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"17:00","temp":75},{"time":"22:00","temp":70}]},{"days":[false,false,true,false,false,false,false],"pairs":[{"time":"06:00","temp":75},{"time":"09:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"17:00","temp":75},{"time":"22:00","temp":70}]},{"days":[false,false,false,true,false,false,false],"pairs":[{"time":"06:00","temp":75},{"time":"09:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"17:00","temp":75},{"time":"22:00","temp":70}]},{"days":[false,false,false,false,true,false,false],"pairs":[{"time":"06:00","temp":75},{"time":"09:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"17:00","temp":75},{"time":"22:00","temp":70}]},{"days":[false,false,false,false,false,true,false],"pairs":[{"time":"06:00","temp":75},{"time":"09:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"17:00","temp":75},{"time":"22:00","temp":70}]}]},{"name":"Winter","groups":[{"days":[true,false,false,false,false,false,false],"pairs":[{"time":"02:00","temp":"75"},{"time":"09:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"17:00","temp":75},{"time":"22:00","temp":70}]},{"days":[false,false,false,false,false,false,true],"pairs":[{"time":"05:00","temp":"75"},{"time":"09:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"17:00","temp":75},{"time":"22:00","temp":70}]},{"days":[false,true,false,false,false,false,false],"pairs":[{"time":"06:00","temp":75},{"time":"09:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"17:00","temp":75},{"time":"22:00","temp":70}]},{"days":[false,false,true,false,false,false,false],"pairs":[{"time":"06:00","temp":75},{"time":"09:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"17:00","temp":75},{"time":"22:00","temp":70}]},{"days":[false,false,false,true,false,false,false],"pairs":[{"time":"06:00","temp":75},{"time":"09:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"17:00","temp":75},{"time":"22:00","temp":70}]},{"days":[false,false,false,false,true,false,false],"pairs":[{"time":"06:00","temp":75},{"time":"09:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"17:00","temp":75},{"time":"22:00","temp":70}]},{"days":[false,false,false,false,false,true,false],"pairs":[{"time":"06:00","temp":75},{"time":"09:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"17:00","temp":75},{"time":"22:00","temp":70}]}]},{"name":"Winter","groups":[{"days":[true,false,false,false,false,false,false],"pairs":[{"time":"02:00","temp":"75"},{"time":"09:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"17:00","temp":75},{"time":"22:00","temp":70}]},{"days":[false,false,false,false,false,false,true],"pairs":[{"time":"05:00","temp":"75"},{"time":"09:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"17:00","temp":75},{"time":"22:00","temp":70}]},{"days":[false,true,false,false,false,false,false],"pairs":[{"time":"06:00","temp":75},{"time":"09:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"17:00","temp":75},{"time":"22:00","temp":70}]},{"days":[false,false,true,false,false,false,false],"pairs":[{"time":"06:00","temp":75},{"time":"09:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"17:00","temp":75},{"time":"22:00","temp":70}]},{"days":[false,false,false,true,false,false,false],"pairs":[{"time":"06:00","temp":75},{"time":"09:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"17:00","temp":75},{"time":"22:00","temp":70}]},{"days":[false,false,false,false,true,false,false],"pairs":[{"time":"06:00","temp":75},{"time":"09:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"17:00","temp":75},{"time":"22:00","temp":70}]},{"days":[false,false,false,false,false,true,false],"pairs":[{"time":"06:00","temp":75},{"time":"09:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"12:00","temp":70},{"time":"17:00","temp":75},{"time":"22:00","temp":70}]}]}]}


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

// Grab the values of the weekday Selectors and update them for the current schedule in tempScheduleArray
function parseWeekdaySelectors() {
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
}

// Set each day of a schedule to true for 1 group and false for the rest.
function setDayInGroup(day, group) {
    //console.log('day: ' + day);
    //console.log('group: ' + group);
    //console.log('tempScheduleArray[currentScheduleNumber].groups[group]:' + tempScheduleArray[currentScheduleNumber].groups[group]);

    // If this group has not been deleted, set the day for that group and set the day for all other groups to false
    if(typeof tempScheduleArray[currentScheduleNumber].groups[group] !== 'undefined') {
        //console.log("group " + group + " not deleted");
        tempScheduleArray[currentScheduleNumber].groups[group].days[day] = true;
        for(var i = 0; i < tempScheduleArray[currentScheduleNumber].groups.length; i++) {
            if(i != group) {
                tempScheduleArray[currentScheduleNumber].groups[i].days[day] = false;
            }
        }
    } else { // If this group has been deleted, set this day to the first group (1 group will always exist)
        //console.log("group " + group + " deleted");
        tempScheduleArray[currentScheduleNumber].groups[0].days[day] = true;

        for(var i = 0; i < tempScheduleArray[currentScheduleNumber].groups.length; i++) {
            if(i != 0) {
                tempScheduleArray[currentScheduleNumber].groups[i].days[day] = false;
            }
        }
    }
}

function sortTimeTemps(array) {
    // array is an array of objects with properties "time" and "temp" which are strings.
    // They should be sorted by time.

    function compare(a,b) {
        if(a.time < b.time) {
            return -1;
        }
        if(a.time > b.time) {
            return 1;
        }
        return 0;
    }

    return array.sort(compare);
}

// Find a name 'Schedule-#' that isn't taken.
// TODO: Make it so lower numbers are checked before higher?
function findScheduleName() {
    var newScheduleName;

    // Set offset to be 1 - we will try to name the new schedule 'Schedule-<# schedules + offset>'.
    // If the name is available, set it and we're done.
    // If a name is taken, increment offset and try again.

    for(var offset = 1; offset <= scheduleArray.length + 1; offset++) {
        if(isNameAvailable('Schedule-' + (scheduleArray.length + offset))) {
            var newScheduleName = 'Schedule-' + (scheduleArray.length + offset);
        }

        if(newScheduleName) {
            return newScheduleName;
        }
    }
}

function isNameAvailable(name) {
    for(var i = 0; i < scheduleArray.length; i++) {

        // If the name is taken return false
        if(scheduleArray[i].name == name) {
            return false;
        }

        // If this is the last schedule to check and the name isn't a duplicate return true
        if(i == (scheduleArray.length - 1)) {
            return true;
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
