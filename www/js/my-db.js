var db;

// Create the table if it doesn't exist. Each CMID is 4 chars.
function dbSetup(tx) {
    tx.executeSql('CREATE TABLE IF NOT EXISTS cm_table (CMID1 text, CMID2 text, CMID3 text, CMID4 text)');
}

function errorHandler(e) {
    myApp.alert(e.message, "Error"); // TODO: Handle the error?
}

function dbLoadCMID() {
    db.transaction(function(tx) {
        tx.executeSql("select * from cm_table", [], gotCMID, errorHandler);
    }, errorHandler, function() {})
}

function gotCMID(tx, results) {
    if(results.rows.length == 0) {
        return false;
    }
    // Save the results globally
    CMID1 = results.rows.item(0).CMID1;
    CMID2 = results.rows.item(0).CMID2;
    CMID3 = results.rows.item(0).CMID3;
    CMID4 = results.rows.item(0).CMID4;

    // Put the results into the CMID entry fields.
    $$('#CMID-input1').val(CMID1);
    $$('#CMID-input2').val(CMID2);
    $$('#CMID-input3').val(CMID3);
    $$('#CMID-input4').val(CMID4);
}

function dbSaveCMID(ID1, ID2, ID3, ID4) {
    db.transaction(function(tx) {
        tx.executeSql("INSERT INTO cm_table(CMID1, CMID2, CMID3, CMID4) VALUES(?,?,?,?)", [ID1, ID2, ID3, ID4])
    }, errorHandler, function() {})
}

function dbClearCMID() {
    db.transaction(function(tx) {
        tx.executeSql("DELETE FROM cm_table")
    }, errorHandler, function() {})
}
