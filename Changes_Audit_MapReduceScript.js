/**
 *	MIT License
 *	Copyright (c) 2023 Lars White
 *
 *	Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 *	The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 *	THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
/**
 *	NetSuite Script ID:		customscript_taco_changes_audit_mrs
**/
/**
 *	Instructions:
 *
 *	To install/setup this Script in NetSuite do the following:
 *	- Create a new Script record using this .js file (detailed instructions: https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_4489062315.html#Creating-a-Script-Record)
 *	- Create the following Script Parameters:
 *		- Run in Sandbox
 *			Label:			Run in Sandbox
 *			ID:				custscript_taco_changes_audit_sb
 *			Description:	This check box can be used to restrict the script to operate only in production. This is desirable when admins get all emails sent in non-production environments, and reports like this one are not (usually) critical outside of production.
 *			Type:			Check Box
 *			Display>Help:	Check this box if this report needs to be generated outside of production.
 *		- Directory ID
 *			Label:			Directory ID
 *			ID:				custscript_taco_changes_audit_dir_id
 *			Description:	The Internal ID of the directory/folder that will house the csv version of these reports in NetSuite's File Cabinet must be populated here.
 *			Type:			Integer Number
 *			Display>Help:	Populate with the Internal ID of the directory/folder that will house the csv version of these reports in NetSuite's File Cabinet.
 *		- Email Recipients
 *			Label:			Email Recipients
 *			ID:				custscript_taco_changes_audit_recipients
 *			Description:	Populate this field with the email address(es) that should receive the report. Separate multiple email addresses with a semicolon. There can be up to 10 recipients.
 *			Type:			Email Address
 *			Display>Help:	Populate with the email address(es) that should receive the report. Separate multiple email addresses with a semicolon. There can be up to 10 recipients.
 *		- Email Author
 *			Label:			Email Author
 *			ID:				custscript_taco_changes_audit_author
 *			Description:	Populate this field with the Employee that will be associated with sending out these reports.
 *			Type:			List/Record
 *			List/Record:	Employee
 *			Display>Help:	Select the Employee record that will be associated with sending out these reports.
 *		- Audit Type
 *			Label:			Audit Type
 *			ID:				custscript_taco_changes_audit_selection
 *			Description:	Populate this field with the 1, 2, or 3. 1 indicates this will produce an Enable Features report. 2 indicates this will produce a Scripts report. 3 indicates this will produce a Workflow report.
 *			Type:			Integer Number
 *			Display>Help:	Enter 1, 2, or 3 in this field. 1 is for Enable Features. 2 is for Scripts. 3 is for Workflows.
 */
/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 */
define(['N', 'N/error', 'N/runtime', 'N/search', 'N/file', 'N/email', 'N/render'],
/**
 * @param {N} N
 * @param {error} error
 * @param {search} search
 */
function(N, error, runtime, search, file, email, render) {
	// daysBetween() is used to get the number of days since the provided date.
	daysBetween = (dateOne) => {
		let dateTwo = new Date();													// Get the current date/time.
		if(dataExists(dateOne)) {
			let timeDiff = Math.abs(dateTwo - dateOne);								// Subtracting dates like this will give the number of milliseconds between the two dates.
			let daysOfDifference = Math.floor(timeDiff / (1000 * 60 * 60 * 24));	// (milliseconds/second x seconds/minute x minutes/hour x hours/day)
			return daysOfDifference;
		}
		else { return 'Not Available'; }
	}

	dataExists = (value) =>	{
		if(value !='null' && value != null && value != '' && value != undefined && value != 'undefined' && value != 'NaN' && value != NaN && value != 'Invalid Date') 
		{ return true; }
		else 
		{ return false;	}
	}

	todaysDate = () => {
		let d = new Date(),
			month = '' + (d.getMonth() + 1),
			day = '' + d.getDate(),
			year = d.getFullYear();

		if (month.length < 2) 
			month = '0' + month;
		if (day.length < 2) 
			day = '0' + day;

		return [year, month, day].join('-');
	}

    getInputData = (context) => {
		// Check to see if the environment is production or not (production accountId's will be an integer, other account types will have letters as well).
		let nsAccId = runtime.accountId;
		let scriptRecord = runtime.getCurrentScript();
		let sandboxEnabled = runtime.getCurrentScript().getParameter('custscript_taco_changes_audit_sb');
		// Depending on the Script Deployment setup, this Script will effectively stop here in a non-production account. The reason for this is to allow this script to be automatically turned off in sandboxes upon a refresh.
		if(isNaN(nsAccId)) {
			if(!sandboxEnabled) {
				log.audit('The option to run outside production is not checked. Stopping process.');
				return;
			}
		}
		let auditSearchObj;
		// A parameter will determine which Search will be performed.
		let searchSelection = scriptRecord.getParameter({name:'custscript_taco_changes_audit_selection'});
		// Define the Search used for Enable Features changes.
		if(searchSelection == 1) {
			auditSearchObj = search.create({
				type: "systemnote",
				filters:
				[
					["recordtype","anyof","-393","-394"], 
					"AND", 
					["type","is","F"]
				],
				columns:
				[
					search.createColumn({
						name: "record",
						sort: search.Sort.ASC
					}),
					"name",
					"role",
					search.createColumn({
						name: "date",
						sort: search.Sort.DESC
					}),
					"type",
					"field",
					"oldvalue",
					"newvalue"
				]
			});
		}
		// Define the Search for Scripts and Script Deployment changes.
		if(searchSelection == 2) {
			auditSearchObj = search.create({
				type: "systemnote",
				filters:
				[
					["date","notbefore","01/01/2023 12:00 am"], 
					"AND", 
					["recordtype","anyof","-417","-418","-120","-321"]
				],
				columns:
				[
					search.createColumn({
						name: "record",
						sort: search.Sort.ASC
					}),
					"name",
					search.createColumn({
						name: "date",
						sort: search.Sort.DESC
					}),
					"context",
					"type",
					"field",
					"oldvalue",
					"newvalue",
					"role",
					"recordid",
					"recordtype"
				]
			});
		}
		// Define the Search for Workflow changes.
		if(searchSelection == 3) {
			auditSearchObj = search.create({
				type: "workflow",
				filters:
				[
					["systemnotes.date","onorafter","01/01/2023 12:00 am"]	// The NetSuite environments go-live data should be here.
				],
				columns:
				[
					"name",
					search.createColumn({
						name: "name",
						join: "systemNotes"
					}),
					search.createColumn({
						name: "date",
						join: "systemNotes",
						sort: search.Sort.DESC
					}),
					search.createColumn({
						name: "oldvalue",
						join: "systemNotes"
					}),
					search.createColumn({
						name: "newvalue",
						join: "systemNotes"
					})
				]
			});
		}

		return auditSearchObj;
    }

	// The map function has been passed a Saved Search, not the results of a Saved Search, just a Saved Search. The map function will automatically handle the results of the Saved Search one at a time here.
	// In this case, all the search results need to be passed through and the real work will happen at summarize(). This means every piece of information is going to get crammed into the context.key as a big string, which will need to be split in summarize().
    map = (context) => {
		// The following small change will alter the context variable making it easier to access the email field on the Customer record (from the Saved Search results).
		let s_modifiedContext = context.value;
		s_modifiedContext = s_modifiedContext.replace('"date.systemNotes"','"dateSystemNotes"');
		s_modifiedContext = s_modifiedContext.replace('"name.systemNotes"','"nameSystemNotes"');
		s_modifiedContext = s_modifiedContext.replace('"oldvalue.systemNotes"','"oldvalueSystemNotes"');
		s_modifiedContext = s_modifiedContext.replace('"newvalue.systemNotes"','"newvalueSystemNotes"');
		const searchResult = JSON.parse(s_modifiedContext);
        const i_intId		= searchResult.id;							// Workflow Internal ID
		const s_record		= searchResult.values.record;				// 
		const s_context		= searchResult.values.context;				// 
		const s_type		= searchResult.values.type;					// 
		let s_field;
		if(searchResult.values.record || searchResult.values.type) { s_field = searchResult.values.field.value; }
		let s_role;
		if(searchResult.values.record || searchResult.values.type) { s_role = searchResult.values.role.text; }			// 
		const s_recordid	= searchResult.values.recordid;				// 
		const s_recordtype	= searchResult.values.recordtype;			// 
//log.debug('map: the mess','i_intId: ' + i_intId + ' s_record: ' + s_record + ' s_context: ' + s_context + ' s_type: ' + s_type + ' s_field: ' + s_field + ' s_role: ' + s_role + ' s_recordid: ' + s_recordid + ' s_recordtype: ' + s_recordtype);
		// Workflow name
		let s_workflow;
		if(!searchResult.values.record && !searchResult.values.type) { s_workflow = searchResult.values.name; }
		// Who made the change
		let i_who;
		let s_who;
		if(searchResult.values.record || searchResult.values.type) {
			i_who = searchResult.values.name.value;
			s_who = searchResult.values.name.text; 
		}
		else {
			i_who = searchResult.values.nameSystemNotes.value;// Internal ID of the user that made the change
			s_who = searchResult.values.nameSystemNotes.text;
		}
		// Date of change
		let d_date
		if(searchResult.values.date) { d_date = searchResult.values.date; }
		else { d_date = searchResult.values.dateSystemNotes; }
		// New Value
		let s_newVal;
		if(searchResult.values.newvalue) { s_newVal = searchResult.values.newvalue; }
		else { s_newVal	= searchResult.values.newvalueSystemNotes; }
		// Old Value
		let s_oldVal;
		if(searchResult.values.oldvalue) { s_oldVal	= searchResult.values.oldvalue; }
		else { s_oldVal	= searchResult.values.oldvalueSystemNotes; }
		// Remove any ';' in the string variables. This will prevent issues when performing the split() in summarize().
		if(s_workflow) { s_workflow = s_workflow.replace(/;/g,''); }
		s_who = s_who.replace(/;/g,'');
		s_oldval = s_oldVal.replace(/;/g,'');
		s_newVal = s_newVal.replace(/;/g,'');
		// Combining all of the data above, the context key should be unique for each result from the original search.
		const contextKey = i_intId + ';' + s_record + ';' + s_context + ';' + s_type + ';' + s_field + ';' + s_role + ';' + s_recordid + ';' + s_recordtype + ';' + s_workflow + ';' + d_date + ';' + i_who + ';' + s_who + ';' + s_oldVal + ';' + s_newVal;
		context.write(contextKey);
    }

	// Nothing needs to happen in reduce() other than passing the context.key through to summarize().
	reduce = (context) => {
		context.write(context.key);
	}

	// The summarize function is empty, but still executed. If the summarize function does not execute, the Script status does not change to Completed. This is a minor issue that is easily solved by having an empty summarize function.
    summarize = (summary) => {
		log.audit('summarize() entered');
		let contents = '';	// This is to become the csv version of the data.
		let fileName = todaysDate() + '-';
		let dataLine;
		let dataArray = [];
		let b_alert = false;
		try{
			let scriptRecord	= runtime.getCurrentScript();
			let directoryId		= scriptRecord.getParameter({name:'custscript_taco_changes_audit_dir_id'});
			let recipientList	= scriptRecord.getParameter({name:'custscript_taco_changes_audit_recipients'});
			let emailAuthor		= scriptRecord.getParameter({name:'custscript_taco_changes_audit_author'});
			let auditSelect		= scriptRecord.getParameter({name:'custscript_taco_changes_audit_selection'});
			// Iterate over the data passed to summarize().
			summary.output.iterator().each(function(key, value) {
				if(key) {
					dataLine = key.split(';');
					dataArray.push([dataLine[0], dataLine[1], dataLine[2], dataLine[3], dataLine[4], dataLine[5], dataLine[6], dataLine[7], dataLine[8], dataLine[9], dataLine[10], dataLine[11], dataLine[12], dataLine[13], daysBetween(new Date(dataLine[9])), new Date(dataLine[9])]);
				}
				return true;
			});
			// Sort the data from newest to oldest.
			const sortedData = dataArray.sort((a, b) => b[15] - a[15]);
			if(sortedData[0][14] == 0) { b_alert = true; }

			// Prepare the email.
			let emailSubject;
			let auditTypeTxt = '';
			if(b_alert) { emailSubject = 'New Change Alert: '; }
			else { emailSubject = 'Audit Log: '; }
			if(auditSelect == 1) { auditTypeTxt = 'Features'; }
			if(auditSelect == 2) { auditTypeTxt = 'Scripts'; }
			if(auditSelect == 3) { auditTypeTxt = 'Workflows'; }
			emailSubject = emailSubject + auditTypeTxt;
			fileName = fileName + auditTypeTxt + '.csv';

			// Set the map that will be used to create the report from the array.
//	 i_intId	  s_record	   s_context	s_type		 s_field	  s_role	   s_recordid	s_recordtype s_workflow	  d_date	   i_who		 s_who		   s_oldVal		 s_newVal	   daysOld							javascriptDate
//	[dataLine[0], dataLine[1], dataLine[2], dataLine[3], dataLine[4], dataLine[5], dataLine[6], dataLine[7], dataLine[8], dataLine[9], dataLine[10], dataLine[11], dataLine[12], dataLine[13], daysOld(new Date(dataLine[9])), new Date(dataLine[9])]
			let o_tableMap;
			if(auditSelect == 1) { o_tableMap = {header:["Record","Who","Role","Date","Type","Field","Old Value","New Value","Days Since Change"], array:[1,11,5,9,3,4,12,13,14]}; }
			if(auditSelect == 2) { o_tableMap = {header:["Record","Who","Date","Context","Type","Field","Old Value","New Value","Role","Record ID","Record Type","Days Since Change"], array:[1,11,9,2,3,4,12,13,5,6,7,14]}; }
			if(auditSelect == 3) { o_tableMap = {header:["Workflow","Who","Date","Old Value","New Value","Days Since Change"], array:[8,11,9,12,13,14]}; }

			// Create the html table that will go into the body of the email.
			let s_htmlTable = '<table><tr class="the-table-header">';
			for(let i=0;i<o_tableMap.header.length -1;i++) {
				s_htmlTable = s_htmlTable + "<td>" + o_tableMap.header[i] + "</td>";
				// While creating the html table header, also create the header for the csv.
				contents = contents + o_tableMap.header[i] + ',';
			}
			// Remove the last comma on the csv header, and add a return character.
			contents = contents.slice(0,-1) + '\n';
			// Continue creating the html data table.
			s_htmlTable = s_htmlTable + "</tr>";
			for(let i=0;i<sortedData.length;i++) {
				s_htmlTable = s_htmlTable + "<tr>";
				for(let j=0;j<o_tableMap.array.length -1;j++) {
					// Bold changes that happened within the last day.
					if(sortedData[i][14] == 0) { s_htmlTable = s_htmlTable + "<td><b>" + sortedData[i][o_tableMap.array[j]] + "</b></td>"; }
					// Older changes will not get emphasized.
					else { s_htmlTable = s_htmlTable + "<td>" + sortedData[i][o_tableMap.array[j]] + "</td>"; }
					// Populate the same data in the csv version. Ensure there are no extra commas.
//	firstLast.replace(/,/g, '');
					contents = contents + sortedData[i][o_tableMap.array[j]].replace(/,/g, '') + ',';
				}
				s_htmlTable = s_htmlTable + "</tr>";
				// Remove the last comma on the csv row, and add a return character.
				contents = contents.slice(0,-1) + '\n';
			}
			s_htmlTable = s_htmlTable + "</table>";
			// Remove the last return character, since there is no more data to populate the last row created.
			contents = contents.slice(0,-1);

			let bodyMessage = 
				'<html>' +
				'<head>' +
				'<style>' +
				'body {font-family:Verdana,sans-serif;font-size:15px;line-height:1.5;background-color:#00467f;overflow-x:hidden}' +
				'table {padding-left:3px;padding-right:3px;}' +
				'code {font-family:monospace;font-size:1em;color:#eeeeee;}' +
				'.the-main {position:relative;top:45px;transition:margin-left 0.4s;color:#fff;background-color:#000000;padding-top:25px;}' +
				'.the-section {max-width:800px;margin:auto;margin-bottom:25px;background-color:#222222;padding:60px 85px 60px 85px;}' +
				'.the-table-header {color:#ffffff;background-color:#00467f;font-weight:bold;}' +
				'</style>' +
				'</head>' +
				'<body>' +
				'<div class="the-main">' +
					'<div class="the-section">' +
						s_htmlTable +
						"<br/>" +
						"<i>This was generated by the Script with ID:</i> <code>customscript_taco_changes_audit_mrs</code>" +
					'</div>' +
				'</div>';

			let fileObj = file.create({
				name: fileName,
				fileType: file.Type.PLAINTEXT,
				contents: contents
			});
			// Specify the folder location for the output file. Update the fileObj.folder property with the ID of the folder in the file cabinet that is to contain the output file.
			fileObj.folder = directoryId;
			// Save the file.
			let fileIntId = fileObj.save();
			log.audit('summarize(): report generated','fileIntId: ' + fileIntId);

			// Email the results.
			email.send({
				author: emailAuthor,		// Internal ID of an Employee record
				recipients: recipientList,	// The list of email addresses that will receive the audit email
				subject: emailSubject,
				body: bodyMessage,
				attachments: [fileObj]
			});
		}
		catch(e){
			let msg = '';
			if (e instanceof nlobjError) {
				msg = e.getCode() + '\n' + e.getDetails();
				log.error({
					title: 'system error',
					details: msg
				});
			} else {
				msg = e.toString();
				log.error({
					title: 'unexpected error',
					details: msg
				});
			}
		}
    }

    return {
        getInputData: getInputData,
        map: map,
        reduce: reduce,
        summarize: summarize
    };
});
