var cachedRecord = {};
var stopIdToName;
var nameToStopId = {};

/*
Add an event handler for using hashes to navigate on the page
Since there is a navbar we want to scroll up 50 pixels when using hashes
*/
window.addEventListener("hashchange", function() {
	scrollBy(0, -50);
});

document.addEventListener('DOMContentLoaded', function () {
	// Get bus stops and the user's preferences from the API
	$.get(apiUrl + "stops", function(data) {
		stopIdToName = data;
		for (var key in data) {
			nameToStopId[data[key]] = key;
		}
	});
	$.get(apiUrl + userId + "/preferences", function(data) {
		cachedRecord = data;
	});

	// When the user's preferences are loaded, render them
	$(document).ajaxStop(function() {
		$(this).unbind("ajaxStop");
		renderUserPreferences();
	});
});

/*
Render the user preferences in cachedRecord
*/
function renderUserPreferences() {
	$(".preferences").empty();
	$("#new-group-button").remove();
	document.getElementById("buttons-div").appendChild(getButton("Edit Preferences", enableEditMode));
	var time = document.createElement("h4");
	time.innerHTML = cachedRecord["time"] + " minutes";
	document.getElementById("time-div").appendChild(time);
	document.getElementById("home-div").appendChild(getGroupElement(cachedRecord["home"]));
	document.getElementById("destination-div").appendChild(getGroupElement(cachedRecord["destination"]));
	for (var i = 0; i < cachedRecord["order"].length; i++) {
		var div = document.createElement("div");
		div.id = cachedRecord["order"][i];
		div.classList.add("list-group");
		div.appendChild(getGroupElement(div.id));
		document.getElementById("groups-div").appendChild(div);
	}
}

/*
Get an HTML element for the group with the specified nickname
*/
function getGroupElement(nickname) {
	var span = document.createElement("span");
	if (nickname) {
		span.appendChild(getListElement(nickname, true));
		for (var i = 0; i < cachedRecord["groups"][nickname].length; i++) {
			span.appendChild(getListElement(stopIdToName[cachedRecord["groups"][nickname][i]], false));
		}
	} else {
		var listElement = getListElement("Click the edit button to set up this group", true);
		listElement.classList.add("warning");

		// Manually change color because list-elements do 
		// not support color changes using bootswatch
		listElement.style.backgroundColor = "#ff6600";
		listElement.style.borderColor = "#ff6600";
		span.appendChild(listElement);
	}
	return span;
}

/*
Get an HTML element for an element in a group
*/
function getListElement(content, isActive) {
	var listElement = document.createElement("a");
	listElement.innerHTML = content;
	listElement.style.fontSize = "large";
	listElement.classList.add("list-group-item", isActive ? "active" : "stop");
	return listElement;
}

/*
Enable edit mode by making fields editable and adding buttons
*/
function enableEditMode() {
	// Clear the edit button and time div
	$("#buttons-div").empty();
	$("#time-div").empty();

	// Add the submit and cancel buttons
	var buttonsDiv = document.getElementById("buttons-div");
	submitButton = getButton("Submit", handleSubmit);
	submitButton.id = "submit-button";
	buttonsDiv.appendChild(submitButton);
	buttonsDiv.appendChild(getButton("Cancel", renderUserPreferences));

	// Add the editable time element
	timeElement = document.createElement("input");
	timeElement.type = "number";
	timeElement.min = 0;
	timeElement.max = 30;
	timeElement.id = "time-input";
	timeElement.classList.add("form-control", "input-lg");
	timeElement.value = cachedRecord["time"];
	timeElement.onkeypress = function(evt) {
		var charCode = evt.which ? evt.which : event.keyCode;
		return charCode <= 31 || (charCode >= 48 && charCode <= 57);
	};
	timeElement.onkeyup = validateTime;
	timeElement.onmouseup = validateTime;
	document.getElementById("time-div").appendChild(timeElement);

	// Change all existing groups to edit mode
	changeGroupToEdit("home-div");
	changeGroupToEdit("destination-div");
	for (var i = 0; i < cachedRecord["order"].length; i++) {
		changeGroupToEdit(cachedRecord["order"][i]);
	}

	// Add the new group button
	var newButton = getButton("New", appendGroup(document.getElementById("groups-div")));
	newButton.id = "new-group-button";
	document.getElementsByClassName("well-lg")[3].appendChild(newButton);

	// Populate the datalist for stop names if it is unpopulated
	var datalist = document.getElementById("system-stops");
	if (!datalist.childNodes.length) {
		for (var stopName in nameToStopId) {
			var option = document.createElement("option");
			option.value = stopName;
			datalist.appendChild(option);
		}
	}
}

/*
Change the specified group to edit mode
*/
function changeGroupToEdit(groupDivId) {
	var groupDiv = document.getElementById(groupDivId);
	var nicknameElement = groupDiv.getElementsByClassName("active")[0];
	var groupSpan = nicknameElement.parentNode;
	groupSpan.replaceChild(getNicknameInput(groupDiv,
			nicknameElement.classList.contains("warning") ? "" : nicknameElement.textContent,
			groupDivId.includes("-") ? "Clear" : "Delete"),
		nicknameElement);
	var stopElements = $.extend(true, [], groupDiv.getElementsByClassName("stop"));
	for (var i = 0; i < stopElements.length; i++) {
		var stopInput = getStopInput(stopElements[i].textContent, stopElements.length !== 1);
		stopElements[i].remove();
		groupSpan.appendChild(stopInput);
	}
	groupDiv.appendChild(getImageButton(imageUrl + "plus.png", appendStop(groupDiv)));
}

/*
Handle a user submitting their changes
If the user has invalid groups, point out their errors
Otherwise, make API calls to match the user's changes
*/
function handleSubmit() {
	// Disable the submit button while this submit is being handled
	var submitButton = document.getElementById("submit-button");
    submitButton.setAttribute("disabled", "disabled");
	submitButton.onclick = "";

	// Scrape the current state of the UI for the 
	// updated preferences and order of groups
	var timeValue = document.getElementById("time-input").value;
	var updatedTime = timeValue ? parseInt(timeValue) : 0;
	updated = {};
	homeDestinationOrder = [];
	var errorElements = [];
	var newHome = scrapeGroupData("home-div", updated, homeDestinationOrder, errorElements);
	var newDestination = scrapeGroupData("destination-div", updated, homeDestinationOrder, errorElements);
	var groupElements = document.getElementById("groups-div").getElementsByClassName("list-group");
	updatedOrder = [];
	for (var i = 0; i < groupElements.length; i++) {
		scrapeGroupData(groupElements[i].id, updated, updatedOrder, errorElements);
	}

	// If there are any errors, display an error message 
	// and highlight the invalid elements
	if (errorElements.length) {
		for (var i = 0; i < errorElements.length; i++) {
			updateValidity(errorElements[i], false);
		}
		var errorDiv = document.createElement("div");
		errorDiv.classList.add("alert", "alert-dismissible", "alert-danger");
		errorDiv.innerHTML = "Groups need to have a nickname and at least one stop. Please fix the highlighted preferences.";
		document.getElementById("buttons-div").appendChild(errorDiv);
		return;
	}

	// Update the user's preferences in the database
	$.ajax({
		url: apiUrl + userId + "/preferences",
		type: "PUT",
		contentType: "application/json",
		data: JSON.stringify({
			"time": updatedTime,
			"home": newHome,
			"destination": newDestination,
			"groups": updated,
			"order": updatedOrder
		}),
		success: function(data) {
			cachedRecord = data;
			renderUserPreferences();
		},
		error: function(data) {
			/* HANDLE THE ERROR */
			console.log("Failed to update group");
			submitButton.removeAttribute("disabled");
	    	submitButton.onclick = handleSubmit;
		}
	});
}

/*
Scrape information from the UI about the specified group
to update the user's preferences in updated and order
Return the group's nickname for a valid group, null for
an empty group, and for invalid groups add the elements that
are causing the errors to errorElements
*/
function scrapeGroupData(groupDivId, updated, order, errorElements) {
	var groupDiv = document.getElementById(groupDivId);
	var nicknameElement = groupDiv.getElementsByClassName("active")[0];
	var nickname = nicknameElement.value;
	var stopElements = groupDiv.getElementsByClassName("stop");
	var stopIds = [];
	for (var i = 0; i < stopElements.length; i++) {
		var stopName = stopElements[i].value;
		if (stopName) {
			stopIds.push(parseInt(nameToStopId[stopName]));
		}
	}

	// Verify the validity of this group
	if (nickname && stopIds.length) {
		updated[nickname] = stopIds;
		order.push(nickname);
		return nickname;
	}
	if (!nickname && !stopIds.length) {
		return null;
	}

	// Determine if the nicknames or stops are empty
	if (!nickname) {
		errorElements.push(nicknameElement);
	} else {
		// Remove all empty stops so a new highlighted one can be added
		while (stopElements.length) {
			stopElements[0].parentNode.remove();
		}
		appendStop(groupDiv)();
		errorElements.push(stopElements[0]);
	}
}

/*
Get a button element with the specified text and callback function
*/
function getButton(displayText, callback) {
	var button = document.createElement("a");
	button.innerHTML = displayText;
	button.onclick = callback;
	if (typeof getButton.buttonClasses === "undefined") {
		getButton.buttonClasses = {
			"Submit": "btn-success",
			"New": "btn-success",
			"Clear": "btn-warning",
			"Delete": "btn-danger"
		};
	}
	button.classList.add("btn", "btn-lg", getButton.buttonClasses[displayText] || "btn-primary");
	return button;
}

/*
Get a button element with the specified image and callback function
*/
function getImageButton(image, callback) {
	var button = document.createElement("img");
	button.style.display = "block";
	button.style.margin = "0 auto";
	button.src = image;
	button.onclick = callback;
	return button;
}

/*
Verify that the time is between 0 and 30
*/
function validateTime() {
	var timeField = document.getElementById("time-input");
	var isValid = timeField.value >= 0 && timeField.value <= 30;
	updateValidity(timeField, isValid);
}

/*
Verify that the stop is valid
*/
function validateStop(stopElement) {
	var isValid = stopElement.value in nameToStopId;
	var groupSpan = stopElement.parentNode.parentNode;
	var stopElements = groupSpan.getElementsByClassName("stop");
	for (var i = 0; i < stopElements.length && isValid; i++) {
		isValid = stopElement.value !== stopElements[i].value 
			|| stopElement === stopElements[i];
	}
	updateValidity(stopElement, isValid || stopElement.value === "");
}

/*
Verify that the nickname is valid
*/
function validateNickname(nicknameElement) {
	// Verify that all characters in the nickname are alphanumeric or spaces
	var isValid = new RegExp("^[a-zA-Z0-9]+$").test(nicknameElement.value.replace(" ", ""));

	// Verify that the nickname is not a duplicate
	var nicknameElements = document.getElementsByClassName("active");
	for (var i = 0; i < nicknameElements.length && isValid; i++) {
		isValid = nicknameElement.value !== nicknameElements[i].value 
			|| nicknameElement === nicknameElements[i];
	}
	updateValidity(nicknameElement, isValid);
}

/*
Update the validity of the specified element and update the
status of the submit button based on all elements' validity
*/
function updateValidity(element, isValid) {
	if (isValid) {
		element.classList.remove("invalid");
	} else {
		element.classList.add("invalid");
	}
	updateSubmitState();
}

/*
Update the state of the submit button based on the validity of all elements
*/
function updateSubmitState() {
	var submitButton = document.getElementById("submit-button");
	if ($(".invalid").length) {
    	submitButton.setAttribute("disabled", "disabled");
		submitButton.onclick = "";
	} else {
		$(".alert").remove();
	    submitButton.removeAttribute("disabled");
	    submitButton.onclick = handleSubmit;
	}
}

/*
Get a callback for appending stops to the specified group
*/
function appendStop(groupDiv) {
	return function() {
		var groupSpan = groupDiv.childNodes[0];
		replaceFirstStop(groupSpan, true);
		groupSpan.appendChild(getStopInput("", groupSpan.childNodes.length !== 1));
	}
}

/*
Get a callback for deleting the specified stop
*/
function deleteStop(stopElement) {
	return function() {
		var groupSpan = stopElement.parentNode;
		stopElement.remove();
		replaceFirstStop(groupSpan, false);
		updateSubmitState();
	}
}

/*
If the specified group has only 1 stop and another one is being 
added or the second to last stop was just deleted, replace the 
only stop with a new stop that optionally has a delete button
*/
function replaceFirstStop(groupSpan, hasButton) {
	if (groupSpan.childNodes.length === 2) {
		var stopDiv = groupSpan.childNodes[1];
		var stopField = stopDiv.childNodes[0];
		var newStopDiv = getStopInput(stopField.value, hasButton);
		if (stopField.classList.contains("invalid")) {
			newStopDiv.childNodes[0].classList.add("invalid");
		}
		groupSpan.replaceChild(newStopDiv, stopDiv);
	}
}

/*
Get a callback for appending new groups to the existing groups
*/
function appendGroup(groupsDiv) {
	var counter = 0;
	return function() {
		var groupDiv = document.createElement("div");
		groupDiv.id = "newnickname-" + counter++;
		groupDiv.classList.add("list-group");
		var span = document.createElement("span");
		span.appendChild(getNicknameInput(groupDiv, "", "Delete"));
		groupDiv.appendChild(span);
		groupDiv.appendChild(getImageButton(imageUrl + "plus.png", appendStop(groupDiv)));
		groupsDiv.appendChild(groupDiv);
	}
}

/*
Get a callback for deleting the specified group
*/
function deleteGroup(groupElement) {
	return function() {
		groupElement.remove();
		updateSubmitState();
	}
}

/*
Get a callback for clearing the specified group
*/
function clearGroup(groupDiv) {
	return function() {
		var span = groupDiv.childNodes[0];
		span.innerHTML = "";
		span.appendChild(getNicknameInput(groupDiv, "", "Clear"));
		updateSubmitState();
	}
}

/*
Get a nickname div in the specified group with the specified type of button
*/
function getNicknameInput(groupDiv, nickname, buttonType) {
	var nicknameDiv = document.createElement("div");
	nicknameDiv.classList.add("input-group");
	nicknameDiv.appendChild(getInputElement(nickname, true));
	var span = document.createElement("span");
	span.classList.add("input-group-btn");
	span.appendChild(getButton(buttonType, 
		buttonType === "Delete" ? 
			deleteGroup(groupDiv) : 
			clearGroup(groupDiv)));
	nicknameDiv.appendChild(span);
	return nicknameDiv;
}

/*
Get a stop div with the specified stop name and an optional delete button
*/
function getStopInput(stopName, hasButton) {
	var stopDiv = document.createElement("div");
	var stopInput = getInputElement(stopName, false);
	stopDiv.appendChild(stopInput);
	if (hasButton) {
		stopDiv.classList.add("input-group");
		var span = document.createElement("span");
		span.classList.add("input-group-btn");
		span.appendChild(getImageButton(imageUrl + "x.png", deleteStop(stopDiv)));
		stopDiv.appendChild(span);
	} else {
		stopInput.classList.add("form-group", "stop");
		stopInput.classList.remove("list-group-item");
	}
	stopInput.setAttribute("list", "system-stops");
	return stopDiv;
}

/*
Get an input element that is either a nickname or stop with the specified content
*/
function getInputElement(content, isNickname) {
	var input = document.createElement("input");
	input.value = content;
	input.classList.add("list-group-item", "form-control", "input-lg");
	if (isNickname) {
		input.classList.add("active");
		input.setAttribute("maxlength", 30);
		input.oninput = function() {
			validateNickname(input);
		};
	} else {
		input.placeholder = "Bus stop name (Rackham)";
		input.classList.add("stop");
		input.oninput = function() {
			validateStop(input);
		};
	}
	return input;
}
