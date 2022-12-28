let backendPath = "https://hhvjdbhqp4.execute-api.us-east-1.amazonaws.com/prod";
// let backendPath = "https://1snwvce58a.execute-api.us-east-1.amazonaws.com/dev";

var formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
});

function addUnit(address, unit) {
    if (typeof unit != "undefined" && unit.length > 0) {
        let addressTokens = address.split(',');
        let street = addressTokens[0];
        street = street + " Unit " + unit;
        addressTokens.shift();
        let addressEnding = addressTokens.join(',');
        address = street + ',' + addressEnding;
    }
    console.log('Formed address ' + address + ' from address and unit');
    return address;
}

function addZipCode(address, zip) {
    if (typeof zip != "undefined" && zip.length > 0) {
        address = address + ' ' + zip;
    }
    console.log('Formed address ' + address + ' from address and zip');
    return address;
}

function parseValuationResult(result) {
    try {
        let estimatedValue = result.EstimatedValue;
        let estimatedMinValue = result.EstimatedMinValue;
        let estimatedMaxValue = result.EstimatedMaxValue;
        let confidenceScore = result.ConfidenceScore;
        console.log('Got estimate of ' + estimatedValue);

        if ((estimatedValue === "" || estimatedValue === "$0" || estimatedValue === "$NaN" || typeof estimatedValue === "undefined")) {
            throw 'Unable to pull value estimates';
        } else {
            let adjustedEstimate = estimatedValue;
            console.log('Got adjustedEstimate: ' + adjustedEstimate);
            $("#value-estimate-storage").attr("value", adjustedEstimate); // added 12-27-2022 to decide whether to show failure page
            $(".selling-estimate").html(adjustedEstimate);
            $(".selling-estimate").val(adjustedEstimate);
            $(".value-estimate").html(estimatedValue);
            $(".value-estimate").val(estimatedValue);
            $(".value-estimate-min").html(estimatedMinValue);
            $(".value-estimate-min").val(estimatedMinValue);
            $(".value-estimate-max").html(estimatedMaxValue);
            $(".value-estimate-max").val(estimatedMaxValue);

            $(".confidence-score").html(confidenceScore);
            $(".confidence-score").val(confidenceScore);
        }
    } catch (error) {
        console.log(error);
        $(".offer-header").html("We were unable to pull your value report");
        $(".value-estimate").html("$-");
        $(".value-estimate-min").html("$-");
        $(".value-estimate-max").html("$-");
        $(".confidence-score").html(0);
        $(".value-estimate").val("$-");
        $(".value-estimate-min").val("$-");
        $(".value-estimate-max").val("$-");
        $(".confidence-score").val(0);
        $("#offer-explanation").hide();
        $("#schedule-walkthrough").hide();
    }
}

function pullPropertyInfo(address, agentId, domain) {

    /* Currently, each pullPropertyInfo request returns a new sessionId */
    let propertyRequest = { "address": address, "agentId": agentId, "site": domain };

    // ADDED 8/22/22 - Use existing sessionId if it exists
    let sessionId = $("#session-id-storage").val();
    console.log('Pulled this existing sessionId from session-id-storage before requesting property info: ' + sessionId);
    if (typeof sessionId != "undefined" && sessionId.length > 0) {
        propertyRequest['sessionId'] = sessionId;
    }

    console.log('Pulling property info for ' + address);
    let url = backendPath + "/property";
    $.ajax({
        url: url,
        method: 'POST',
        data: JSON.stringify(propertyRequest),
    }).done(function (result) {
        let property = result.Property;
        let sessionId = result.sessionId; // this becomes the sessionId that tracks subsequent changes
        $("#session-id-storage").attr("value", sessionId); // this becomes the sessionId that tracks subsequent changes
        console.log('Pulled this property: ' + property);
        console.log('Pulled this sessionId: ' + sessionId);
        return parseValuationResult(property);
    }).fail(function (err) {
        console.log('Unabled to pull home value estimate');
        console.log(err);
    });
}

function validateAddress(address) {
    console.log('About to validate address: ' + address);
    let url = backendPath + "/address";
    $.ajax({
        url: url,
        method: 'POST',
        data: JSON.stringify({ "address": address }), // data: JSON.stringify(sellingDetails),
    }).done(function (result) {
        console.log('Validation result ' + result);
        console.log('Invalid address? ' + result.invalidAddress);
        console.log('Submitted address ' + result.submittedAddress);
        $('#updating-home-details-loader').hide()
        // $('#updating-home-details-loader').css('display', 'flex');
        $('#market-analysis-loader').hide(); // maybe rename to "address-loader"
        try {
            if (!result.invalidAddress) {
                console.log('Looks like it was a valid address');

                // PARSE AND STORE VALIDATED ADDRESS COMPONENTS         
                let addressDisplayText = result.addressTextModified;
                $(".address-display").html(addressDisplayText);
                $("#address-send").attr("value", addressDisplayText); // for the form submission(s); potentially move down to unit submit section and send "unitAddress"
                $("#address-storage").attr("value", addressDisplayText); // house number, street, and unit (if any)

                $("#street-storage").attr("value", result.street);
                $("#unit-storage").attr("value", result.unit); // should be included above in street, I think
                $("#unit-type-storage").attr("value", result.unitType); // sub-premises type
                $("#city-storage").attr("value", result.city);
                $("#state-storage").attr("value", result.state);
                $("#zip-storage").attr("value", result.zip);

                // REQUEST PROPERTY INFO FROM BACKEND
                let agentId = $("#agent-id-storage").val();
                let site = $("#domain-storage").val();
                pullPropertyInfo(addressDisplayText, agentId, site); // alternatively, we could do this in the address valdation endpoint

                $("#zip-code-page").hide();
                $("#condo-unit-page").hide(); // may have never gotten here
                $("#invalid-address-page").hide(); // for good measure(?)
                $("#relationship-page").show();
            } else if (result.invalidZip) {
                let addressDisplayText = address;
                $(".address-display").html(addressDisplayText);
                $("#address-storage").attr("value", addressDisplayText);
                $("#relationship-page").hide();
                $("#invalid-address-page").hide();
                $("#zip-code-page").show();
            } else if ((result.needUnit && !result.unitProvided)) {
                console.log('We need a unit!');
                let addressDisplayText = result.addressTextModified;
                console.log('addressDisplayText: ' + addressDisplayText);
                $(".address-display").html(addressDisplayText);
                $("#address-storage").attr("value", addressDisplayText);
                $("#relationship-page").hide();
                $("#zip-code-page").hide();
                $("#invalid-address-page").hide();
                $("#condo-unit-page").show();
            } else if ((result.needUnit && result.invalidUnit)) {
                console.log('We need a unit!');
                let addressDisplayText = result.addressTextModified;
                console.log('addressDisplayText: ' + addressDisplayText);
                $(".address-display").html(addressDisplayText);
                $("#address-storage").attr("value", addressDisplayText);
                $("#relationship-page").hide();
                $("#zip-code-page").hide();
                $("#invalid-address-page").hide();
                $("#invaid-unit-page").show();
            } else {
                console.log('Invalid address...deciding what to do next');
                $("#zip-code-page").hide();
                $("#condo-unit-page").hide();
                $("#relationship-page").hide(); // but wouldn't it be this?
                $("#invalid-address-page").show();
                let errorMessage = 'We were unable to validate that address';
                if (result.extraneousUnitProvided) {
                    errorMessage = 'Did you mean to submit a unit number?';
                }
                $(".address-error-message").html(errorMessage);
            }
        } catch (error) {
            console.log(error);
        }
    });
}

$(document).ready(function () {
    let queryString = window.location.search;
    let params = new URLSearchParams(queryString);
    let site = params.get("site");
    let address = params.get("address");
    let agentId = params.get("agent");

    console.log('Pulled address from queryString: ' + address);
    console.log('Pulled source site from queryString: ' + site);
    console.log('Pulled agent from queryString: ' + agentId);

    if (!site || !address || !agentId) {
        let routeTo = "https://my.homevalue.report";
        // let queryString = '?address=' + encodeURIComponent(address) + '&agent=' + encodeURIComponent(agentId) + '&site=' + encodeURIComponent(site);
        // routeTo = routeTo + queryString;
        console.log('Routing to URL ' + routeTo);
        location.href = routeTo;
    }

    // history.replaceState({}, null, "/value");  

    // IT'S possible that we should query with the source site name here to ensure safety
    $("#agent-id-storage").attr("value", agentId);
    console.log(agentId);

    // UPDATE ADDRESS DISPLAY AND STORAGE FIELDS
    $(".address-display").html(address);
    $("#address-storage").attr("value", address); // NOTE - consider removing

    // STORE THE SOURCE USER CAME FROM
    $("#domain-storage").attr("value", site); // get with $("#domain-storage").val();

    // HIDE UNUSED LOADERS
    $("#market-analysis-loader").show();
    // $('#updating-home-details-loader').removeClass('hide');
    $('#updating-home-details-loader').hide();

    validateAddress(address);
    history.replaceState({}, null, "value");
    setTimeout(function () { $("#market-analysis-loader").hide(); }, 2500);
});

document.getElementById("no-unit-btn").addEventListener('click', (event) => {
    console.log('Just clicked no unit btn');
    console.log('Progressing without re-validating the no-unit address');
    $("#unit-storage").attr("value", ""); // NOTE - NEW ADDED 12/19/22
    $("#condo-unit-page").hide();
});

document.getElementById("unit-submit-btn").addEventListener('click', (event) => {
    // STORE UNIT
    let unit = document.getElementById("unit-input").value.trim();
    $("#unit-storage").attr("value", unit); // NOTE - NEW ADDED 12/19/22
    console.log('User entered unit: ' + unit);

    // UPDATE ADDRESS
    console.log('Adding unit to address : ' + unit);
    let address = $("#address-storage").val();
    console.log('Adding to address from storage: ' + address);

    let unitAddress = addUnit(address, unit);

    // SHOW LOADER
    $('#updating-home-details-loader').removeClass('hide');

    // VALIDATE ADDRESS
    validateAddress(unitAddress); // don't set condo (false), because already did on first pull
});

document.getElementById("zip-submit-btn").addEventListener('click', (event) => {
    let zipCode = document.getElementById("zip-code-input").value.trim();
    let address = $("#address-storage").val();
    console.log('Adding to address from storage: ' + address);

    let zipCodeAddress = addZipCode(address, zipCode);

    // SHOW LOADER
    $('#updating-home-details-loader').removeClass('hide');

    // VALIDATE ADDRESS
    validateAddress(zipCodeAddress);
    setTimeout(function () { $("#market-analysis-loader").hide(); }, 2500);
});

window.onbeforeunload = function () {
    let finished = $("#finished").val();
    console.log("finished? " + finished);
    let warningMessage = null;
    if (!finished) {
        console.log('Setting warning');
        warningMessage = 'Are you sure you want to leave?';
    }
    console.log(warningMessage);
    return warningMessage;
};

function mobileCheck() {
    let isMobile = false;
    if ((window.matchMedia("(max-width: 767px)").matches) && (!!('ontouchstart' in window))) {
        isMobile = true;
    }
    return isMobile;
};

function handleBounce() {
    let finished = $("#finished").val(); // has a value if already bounced or reached report
    if (!finished) { // if no value has been set
        let sessionInfo = getCurrentSessionInfo();
        sessionInfo["finished"] = false;
        sessionInfo["bounced"] = true;
        sessionInfo = JSON.stringify(sessionInfo);
        navigator.sendBeacon(backendPath + "/session", sessionInfo);
        $("#finished").attr("value", "no"); // technically "bounced", but just needs any value so we don't re-notify
    }
}

window.onunload = function () {
    handleBounce();
};

document.onvisibilitychange = function () {
    console.log('Visibility change');
    let mobileDevice = mobileCheck();
    console.log('Mobile: ' + mobileDevice);
    if ((mobileDevice) && (document.visibilityState === 'hidden')) {
        handleBounce();
    }
};


document.querySelectorAll('.show-report').forEach(item => {
    item.addEventListener('click', event => {
        $("#visitor-info-page").hide();
        let valueEstimate = $("#value-estimate-storage").val();
        console.log("Got valueEstimate from #value-estimate-storage: " + valueEstimate);
        if ((valueEstimate === "" || valueEstimate === "$0" || valueEstimate === "$NaN" || typeof valueEstimate === "undefined" || !valueEstimate)) {
            console.log("Should show failure page");
            $("#failure-page").show();
            $('#failure-loader').css('display', 'flex'); // replacing typical "$("#success-loader").show();" ; alternative may be to always show it with 'flex' in webflow then just do the .hide() step below
            setTimeout(function () { $("#failure-loader").hide(); }, 3000);
        } else {
            $("#success-page").show();
            $('#success-loader').css('display', 'flex'); // replacing typical "$("#success-loader").show();" ; alternative may be to always show it with 'flex' in webflow then just do the .hide() step below
            setTimeout(function () { $("#success-loader").hide(); }, 3000);
            $(".value-div").show();
        }
    })
});

function updateSession(sessionFields) {
    console.log('Right before updateSession()');
    let request = $.ajax({
        url: backendPath + "/session",
        method: "POST",
        data: JSON.stringify(sessionFields),
    });

    request.done(function (data) {
        console.log("SUCCESS: " + data);
    });

    request.fail(function () {
        console.log("Request failed");
    });
}

function getCurrentSessionInfo() {

    let site = $("#domain-storage").val();
    let agentId = $("#agent-id-storage").val();
    let sessionId = $("#session-id-storage").val();
    console.log('Got sessionId from div before submit: ' + sessionId);
    console.log('Got agentId from div before submit: ' + agentId);

    let addressSend = $("#address-storage").val();

    let submittedName;
    try {
        submittedName = $("#name-input").val(); // 7/10/2022 - was "#First-Name"
        if (submittedName.length <= 1) {
            submittedName = '-';
        }
    } catch (error) {
        console.log(error);
        submittedName = ' ';
    }

    let submittedNumber;
    try {
        submittedNumber = $("#phone-input").val();
        if (submittedNumber.length <= 5) {
            submittedNumber = '-';
        }
    } catch (error) {
        console.log(error);
        submittedNumber = ' ';
    }

    let sessionInfo = {
        "site": site,
        "sessionId": sessionId,
        "agentId": agentId,
        "Submitted-Address": addressSend, // "Submitted Address": addressSend,
        "Submitted-Name": submittedName,
        "Submitted-Number": submittedNumber,
    }

    let checkRadioNames = ["Relationship-to-Home", "Considering-Selling"];
    for (const checkRadioName of checkRadioNames) {
        console.log('Checking radio selections for ' + checkRadioName);
        let sellerDetails = checkSellerDetails(checkRadioName);
        sessionInfo[checkRadioName] = sellerDetails;
    }

    console.log('Sending this sessionInfo: ' + sessionInfo);

    return sessionInfo;
}

function checkSellerDetails(name) {
    let checkedRadio = document.querySelector('input[name="' + name + '"]:checked');

    let checkedValue;
    if (checkedRadio != null) {
        checkedValue = checkedRadio.value
    } else {
        checkedValue = "None given";
    }
    return checkedValue;
}

// DO THIS IS IF WANT TO SUBMIT ON SHOW REPORT
const showReportButtons = document.querySelectorAll('.show-report');
for (const showReportButton of showReportButtons) {
    showReportButton.addEventListener('click', function handleClick(event) {
        console.log('Submitting details to show report...');

        // TOOK THE BELOW OUT OF submitSellerDetails()
        let addressSend = $("#address-storage").val();
        $("#address-appointment").attr("value", addressSend); // for the form submission(s); potentially move down to unit submit section and send "unitAddress"
        $("#address-virtual-appointment").attr("value", addressSend);

        // Send off session update
        let sessionInfo = getCurrentSessionInfo();
        sessionInfo["finished"] = true;
        $("#finished").attr("value", true);
        updateSession(sessionInfo);
    });
}