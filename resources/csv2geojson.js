/*!
 * ODI Leeds CSV to GeoJSON converter (version 1.0)
 */
var convert;
S(document).ready(function(){


	// Function to parse a CSV file and return a JSON structure
	// Guesses the format of each column based on the data in it.
	function CSV2JSON(data,start,end){

		// If we haven't sent a start row value we assume there is a header row
		if(typeof start!=="number") start = 1;
		// Split by the end of line characters
		if(typeof data==="string") data = data.split(/[\n\r]+/);
		// The last row to parse
		if(typeof end!=="number") end = data.length;

		if(end > data.length){
			// Cut down to the maximum length
			end = data.length;
		}


		var line,datum,header,types;
		var newdata = new Array();
		var formats = new Array();
		var req = new Array();

		for(var i = 0, rows = 0 ; i < end; i++){

			// If there is no content on this line we skip it
			if(data[i] == "") continue;

			// Split the line by commas (but not commas within quotation marks
			line = data[i].split(/,(?=(?:[^\"]*\"[^\"]*\")*(?![^\"]*\"))/);

			datum = new Array(line.length);
			types = new Array(line.length);

			// Loop over each column in the line
			for(var j=0; j < line.length; j++){

				// Remove any quotes around the column value
				datum[j] = (line[j][0]=='"' && line[j][line[j].length-1]=='"') ? line[j].substring(1,line[j].length-1) : line[j];

				// If the value parses as a float
				if(typeof parseFloat(datum[j])==="number" && parseFloat(datum[j]) == datum[j]){
					types[j] = "float";
					// Check if it is actually an integer
					if(typeof parseInt(datum[j])==="number" && parseInt(datum[j])+"" == datum[j]){
						types[j] = "integer";
						// If it is an integer and in the range 1700-2100 we'll guess it is a year
						if(datum[j] >= 1700 && datum[j] < 2100) types[j] = "year";
					}
				}else if(datum[j].search(/^(true|false)$/i) >= 0){
					// The format is boolean
					types[j] = "boolean";
				}else if(datum[j].search(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&\/\/=]*)/) >= 0){
					// The value looks like a URL
					types[j] = "URL";
				}else if(!isNaN(Date.parse(datum[j]))){
					// The value parses as a date
					types[j] = "datetime";
				}else{
					// Default to a string
					types[j] = "string";
					// If the string value looks like a time we set it as that
					if(datum[j].search(/^[0-2]?[0-9]\:[0-5][0-9]$/) >= 0) types[j] = "time";
				}
			}

			if(i == 0 && start > 0) header = datum;
			if(i >= start){
				newdata[rows] = datum;
				formats[rows] = types;
				rows++;
			}
		}
		
		// Now, for each column, we sum the different formats we've found
		var format = new Array(header.length);
		for(var j = 0; j < header.length; j++){
			var count = {};
			var empty = 0;
			for(var i = 0; i < newdata.length; i++){
				if(!newdata[i][j]) empty++;
			}
			for(var i = 0 ; i < formats.length; i++){
				if(!count[formats[i][j]]) count[formats[i][j]] = 0;
				count[formats[i][j]]++;
			}
			var mx = 0;
			var best = "";
			for(var k in count){
				if(count[k] > mx){
					mx = count[k];
					best = k;
				}
			}
			// Default
			format[j] = "string";

			// If more than 80% (arbitrary) of the values are a specific format we assume that
			if(mx > 0.8*newdata.length) format[j] = best;

			// If we have a few floats in with our integers, we change the format to float
			if(format[j] == "integer" && count['float'] > 0.1*newdata.length) format[j] = "float";

			req.push(header[j] ? true : false);

		}
		

		// Return the structured data
		return { 'fields': {'name':header,'title':clone(header),'format':format,'required':req }, 'rows': newdata };
	}

	// Function to clone a hash otherwise we end up using the same one
	function clone(hash) {
		var json = JSON.stringify(hash);
		var object = JSON.parse(json);
		return object;
	}

	function dropOver(evt){
		evt.stopPropagation();
		evt.preventDefault();
		S(this).addClass('drop');
	}
	function dragOff(){ S('.drop').removeClass('drop'); }

	String.prototype.regexLastIndexOf = function(regex, startpos) {
		regex = (regex.global) ? regex : new RegExp(regex.source, "g" + (regex.ignoreCase ? "i" : "") + (regex.multiLine ? "m" : ""));
		if(typeof (startpos) == "undefined") {
			startpos = this.length;
		} else if(startpos < 0) {
			startpos = 0;
		}
		var stringToWorkWith = this.substring(0, startpos + 1);
		var lastIndexOf = -1;
		var nextStop = 0;
		while((result = regex.exec(stringToWorkWith)) != null) {
			lastIndexOf = result.index;
			regex.lastIndex = ++nextStop;
		}
		return lastIndexOf;
	}

	// Main function
	function Converter(file){

		this.maxrows = 10000;	// Limit on the number of rows to display
		this.maxrowstable = 5;	// Limit on the number of rows to display
		this.maxcells = 3000;	// The row limit can be over-ridden by the maximum number of cells to show
		
		// The supported data types as specified in http://csvlint.io/about
		//this.datatypes = [{"label":"string","ref":"http://www.w3.org/2001/XMLSchema#string"},{"label":"integer","ref":"http://www.w3.org/2001/XMLSchema#int"},{"label":"float","ref":"http://www.w3.org/2001/XMLSchema#float"},{"label":"double","ref":"http://www.w3.org/2001/XMLSchema#double"},{"label":"URL","ref":"http://www.w3.org/2001/XMLSchema#anyURI"},{"label":"boolean","ref":"http://www.w3.org/2001/XMLSchema#boolean"},{"label":"non-positive integer","ref":"http://www.w3.org/2001/XMLSchema#nonPositiveInteger"}, {"label":"positive integer","ref":"http://www.w3.org/2001/XMLSchema#positiveInteger"}, {"label":"non-negative integer","ref":"http://www.w3.org/2001/XMLSchema#nonNegativeInteger"}, {"label":"negative integer","ref":"http://www.w3.org/2001/XMLSchema#negativeInteger"},{"label":"date","ref":"http://www.w3.org/2001/XMLSchema#date"}, {"label":"date & time","ref":"http://www.w3.org/2001/XMLSchema#dateTime"},{"label":"year","ref":"http://www.w3.org/2001/XMLSchema#gYear"},{"label":"year & month","ref":"http://www.w3.org/2001/XMLSchema#gYearMonth"},{"label":"time","ref":"http://www.w3.org/2001/XMLSchema#time "}];
		this.datatypes = [{"label":"string","ref":"http://www.w3.org/2001/XMLSchema#string"},{"label":"integer","ref":"http://www.w3.org/2001/XMLSchema#int"},{"label":"float","ref":"http://www.w3.org/2001/XMLSchema#float"},{"label":"double","ref":"http://www.w3.org/2001/XMLSchema#double"},{"label":"URL","ref":"http://www.w3.org/2001/XMLSchema#anyURI"},{"label":"boolean","ref":"http://www.w3.org/2001/XMLSchema#boolean"},{"label":"date","ref":"http://www.w3.org/2001/XMLSchema#date"}, {"label":"datetime","ref":"http://www.w3.org/2001/XMLSchema#dateTime"},{"label":"year","ref":"http://www.w3.org/2001/XMLSchema#gYear"},{"label":"time","ref":"http://www.w3.org/2001/XMLSchema#time "}];

		// If we provided a filename we load that now
		if(file) S().ajax(file,{'complete':this.parseCSV,'this':this,'cache':false});

		// When the user focuses on the schema output, it all gets selected
		S('#schema textarea').on('focus',function(){
			this.e[0].select()
		});
		
		S('#save').on('click',{me:this},function(e){
			e.data.me.save();
		});

		var _obj = this;

		// Setup the dnd listeners.
		var dropZone = document.getElementById('drop_zone');
		dropZone.addEventListener('dragover', dropOver, false);
		dropZone.addEventListener('dragout', dragOff, false);

		document.getElementById('standard_files').addEventListener('change', function(evt){
			return _obj.handleFileSelect(evt,'csv');
		}, false);

		return this;
	}

	// Return an HTML select box for the data types
	Converter.prototype.buildSelect = function(typ,row,col){
		var html = '<select id="'+row+'-'+col+'" data-row="'+row+'" data-col="'+col+'">';
		for(var t = 0; t < this.datatypes.length; t++) html += "<option"+(this.datatypes[t].label == typ ? " selected=\"selected\"":"")+" value=\""+this.datatypes[t].label+"\">"+this.datatypes[t].label+"</option>";
		html += "</select>";
		return html;
	}
	
	// Return an HTML true/false select box
	Converter.prototype.buildTrueFalse = function(yes,row,col){
		var html = '<select id="'+row+'-'+col+'" data-row="'+row+'" data-col="'+col+'">';
		html += '<option'+(yes ? " selected=\"selected\"":"")+' value="true">True</option>';
		html += '<option'+(!yes ? " selected=\"selected\"":"")+' value="false">False</option>';
		html += "</select>";
		return html;
	}
	
	// Parse the CSV file
	Converter.prototype.parseCSV = function(data,attr){

		this.csv = data;

		if(attr.cols*this.maxrows > this.maxcells){
			// We have lots of columns meaning that we have more cells that we're allowing
			// so limit the number of rows
			this.maxrows = Math.floor(this.maxcells/attr.cols);
		}
		this.records = attr.rows; 

		// Convert the CSV to a JSON structure
		this.data = CSV2JSON(data,1,this.maxrows+1);

		// Construct the HTML table
		this.buildTable()

		// Construct the map
		this.buildMap();


		// and the JSON schema
		this.buildSchema();

		return;
	}

	Converter.prototype.buildMap = function(){

		var lat = 53.79659;
		var lon = -1.53385;
		var d = 0.003;

		function makeMarker(colour){
			return L.divIcon({
				'className': '',
				'html':	'<svg xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:cc="http://creativecommons.org/ns#" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:svg="http://www.w3.org/2000/svg" xmlns="http://www.w3.org/2000/svg" width="7.0556mm" height="11.571mm" viewBox="0 0 25 41.001" id="svg2" version="1.1"><g id="layer1" transform="translate(1195.4,216.71)"><path style="fill:%COLOUR%;fill-opacity:1;fill-rule:evenodd;stroke:#ffffff;stroke-width:0.1;stroke-linecap:butt;stroke-linejoin:miter;stroke-opacity:1;stroke-miterlimit:4;stroke-dasharray:none" d="M 12.5 0.5 A 12 12 0 0 0 0.5 12.5 A 12 12 0 0 0 1.8047 17.939 L 1.8008 17.939 L 12.5 40.998 L 23.199 17.939 L 23.182 17.939 A 12 12 0 0 0 24.5 12.5 A 12 12 0 0 0 12.5 0.5 z " transform="matrix(1,0,0,1,-1195.4,-216.71)" id="path4147" /><ellipse style="opacity:1;fill:#ffffff;fill-opacity:1;stroke:none;stroke-width:1.428;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;stroke-dasharray:none;stroke-dashoffset:0;stroke-opacity:1" id="path4173" cx="-1182.9" cy="-204.47" rx="5.3848" ry="5.0002" /></g></svg>'.replace(/%COLOUR%/,colour||"#000000"),
				iconSize:	 [25, 41], // size of the icon
				shadowSize:	 [41, 41], // size of the shadow
				iconAnchor:	 [12.5, 41], // point of the icon which will correspond to marker's location
				shadowAnchor: [12.5, 41],	// the same for the shadow
				popupAnchor:	[0, -41] // point from which the popup should open relative to the iconAnchor
			});
		}

		if(!this.map){
			var mapel = S('#map');
			var mapid = mapel.attr('id');
			this.map = L.map(mapid,{'scrollWheelZoom':false}).fitBounds([
				[lat-d, lon-d],
				[lat+d, lon+d]
			]);
			// CartoDB map
			L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png', {
				attribution: 'Tiles: &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="http://cartodb.com/attributions">CartoDB</a>',
				subdomains: 'abcd',
				maxZoom: 19
			}).addTo(this.map);
		}

		function popuptext(feature){
			// does this feature have a property named popupContent?
			popup = '';
			if(feature.properties){
				// If this feature has a default popup
				// Convert "other_tags" e.g "\"ele:msl\"=>\"105.8\",\"ele:source\"=>\"GPS\",\"material\"=>\"stone\""
				if(feature.properties.other_tags){
					tags = feature.properties.other_tags.split(/,/);
					for(var t = 0; t < tags.length; t++){
						tags[t] = tags[t].replace(/\"/g,"");
						bits = tags[t].split(/\=\>/);
						if(bits.length == 2){
							if(!feature.properties[bits[0]]) feature.properties[bits[0]] = bits[1];
						}
					}
				}
				if(feature.properties.popup){
					popup = feature.properties.popup.replace(/\n/g,"<br />");
				}else{
					title = '';
					if(feature.properties.title || feature.properties.name || feature.properties.Name) title = (feature.properties.title || feature.properties.name || feature.properties.Name);
					//if(!title) title = "Unknown name";
					if(title) popup += '<h3>'+(title)+'</h3>';
					var added = 0;
					for(var f in feature.properties){
						if(f != "Name" && f!="name" && f!="title" && f!="other_tags" && (typeof feature.properties[f]==="number" || (typeof feature.properties[f]==="string" && feature.properties[f].length > 0))){
							popup += (added > 0 ? '<br />':'')+'<strong>'+f+':</strong> '+(typeof feature.properties[f]==="string" && feature.properties[f].indexOf("http")==0 ? '<a href="'+feature.properties[f]+'" target="_blank">'+feature.properties[f]+'</a>' : feature.properties[f])+'';
							added++;
						}
					}
				}
				// Loop over properties and replace anything
				for(p in feature.properties){
					while(popup.indexOf("%"+p+"%") >= 0){
						popup = popup.replace("%"+p+"%",feature.properties[p] || "?");
					}
				}
				popup = popup.replace(/%type%/g,feature.geometry.type.toLowerCase());
				// Replace any remaining unescaped parts
				popup = popup.replace(/%[^\%]+%/g,"?");
			}
			return popup;
		}
		function onEachFeature(feature, layer) {
			popup = popuptext(feature);
			if(popup) layer.bindPopup(popup);
		}
		var customicon = makeMarker('#FF6700');
		var geoattrs = {
			'style': { "color": '#E6007C', "weight": 2, "opacity": 0.65 },
			'pointToLayer': function(geoJsonPoint, latlng) { return L.marker(latlng,{icon: customicon}); },
			'onEachFeature': onEachFeature
		};
		

		var geojson = {
			"type": "FeatureCollection",
			"features": []
		}

		geojson.features = new Array();
		var x = -1;
		var y = -1;


		for(var c = 0; c < this.data.fields.title.length; c++){
			if(this.data.fields.title[c].toLowerCase() == "longitude") x = c;
			if(x < 0 && this.data.fields.title[c].toLowerCase() == "lon") x = c;
			if(x < 0 && this.data.fields.title[c].toLowerCase() == "geox") x = c;

			if(this.data.fields.title[c].toLowerCase() == "latitude") y = c;
			if(y < 0 && this.data.fields.title[c].toLowerCase() == "lat") y = c;
			if(y < 0 && this.data.fields.title[c].toLowerCase() == "geoy") y = c;
			
		}

		if(x >= 0 && y >= 0){
			for(var i = 0; i < this.data.rows.length; i++){
				feature = {"type":"Feature","properties":{},"geometry": { "type": "Point", "coordinates": [ parseFloat(parseFloat(this.data.rows[i][x]).toFixed(6)), parseFloat(parseFloat(this.data.rows[i][y]).toFixed(6)) ] }};
				for(var c = 0; c < this.data.rows[i].length; c++){
					var n = this.data.fields.title[c];
					if(this.data.fields.required[c]==true){
						feature.properties[n] = this.data.rows[i][c];
					}
				}
				geojson.features.push(feature);
			}
		}

		if(this.map){
			if(this.layer) this.map.removeLayer(this.layer);

			this.layer = L.geoJSON(geojson,geoattrs);
			this.layer.addTo(this.map);
			this.map.fitBounds(this.layer.getBounds());
		}
		
		txt = JSON.stringify(geojson);
		
		S('#geojson textarea').html(txt);

		function niceSize(b){
			if(b > 1e12) return (b/1e12).toFixed(2)+" TB";
			if(b > 1e9) return (b/1e9).toFixed(2)+" GB";
			if(b > 1e6) return (b/1e6).toFixed(2)+" MB";
			if(b > 1e3) return (b/1e3).toFixed(2)+" kB";
			return (b)+" bytes";
		}


		S('#filesize').html('<p>File size: '+niceSize(txt.length)+'</p>');


		return this;
	}
	
	
	// Construct the HTML table
	Converter.prototype.buildTable = function(){

		// Create the data table
		var table = "";
		var mx = Math.min(this.data.rows.length,this.maxrows);
		mx = Math.min(mx,this.maxrowstable);
		table += "<p>We loaded <em>"+this.records+" records</em> (only showing the first "+mx+").</p>";
		
		table += "<div class=\"table-holder\"><table>";
		table += '<tr><th>Title:</th>';

		for(var c in this.data.fields.name){
			table += '<th><input id="title-'+c+'" type="text" value="'+this.data.fields.title[c]+'" data-row="title" data-col="'+c+'" /></th>';
		}

		table += '</tr>';
		table += '<tr><th>Type:</th>';
		for(var c in this.data.fields.name){
			table += '<th>'+this.buildSelect(this.data.fields.format[c],"format",c)+'</th>';
		}
		table += '</tr>';

		table += '<tr><th>Keep?</th>';
		for(var c in this.data.fields.name){
			table += '<th class="constraint"><label></label>'+this.buildTrueFalse(this.data.fields.required[c],"required",c)+'<!--<button class="delete" title="Remove this constraint from this column">&times;</button><button class="add" title="Add a constraint to this column">&plus;</button>--></th>';
		}
		table += '</tr>';

		for(var i = 0; i < mx; i++){
			table += '<tr><td class="rn">'+(i+1)+'</td>';
			for(var c = 0; c < this.data.rows[i].length; c++){
				table += '<td '+(this.data.fields.format[c] == "float" || this.data.fields.format[c] == "integer" || this.data.fields.format[c] == "year" || this.data.fields.format[c] == "date" || this.data.fields.format[c] == "datetime" ? ' class="n"' : '')+'>'+this.data.rows[i][c]+'</td>';
			}
			table += '</tr>';
		}
		table += '</table></div>';
		table += '<output id="map"></output>';
		S('#contents').html(table);

		S('#contents select').on('change',{me:this},function(e,i){
			var el = document.getElementById(e.currentTarget.id);
			var value = el.options[el.selectedIndex].value;
			e.data.me.update(e.currentTarget.id,value);
		});
		S('#contents input').on('change',{me:this},function(e,i){
			e.data.me.update(e.currentTarget.id,e.currentTarget.value);
		});
		return this;
	}

	// Process a form element and update the data structure
	Converter.prototype.update = function(id,value){

		var el = S('#'+id);
		var row = el.attr('data-row');
		var col = el.attr('data-col');
		if(row == "title") this.data.fields.title[col] = value;
		if(row == "format") this.data.fields.format[col] = value;
		if(row == "required") this.data.fields.required[col] = (value.toLowerCase() == "true" ? true : false);

		// Go through form elements and update the format/constraints
		this.buildMap();

		return this;
	}
			
	// Build the JSON schema
	Converter.prototype.buildSchema = function(){
		var ref,t,c,json,i,lines;
		json = "{\n";
		json += '\t"fields": [\n';
		i = 0;
		for(c in this.data.fields.name){
			ref = "";
			for(t = 0 ; t < this.datatypes.length; t++){
				if(this.datatypes[t].label == this.data.fields.format[c]) ref = this.datatypes[t].ref;
			}
			json += '\t\t{\n';
			json += '\t\t\t"name": "'+this.data.fields.name[c]+'",\n';
			json += '\t\t\t"title": "'+this.data.fields.title[c]+'",\n';
			json += '\t\t\t"constraints": {\n';
			json += '\t\t\t\t"required": '+this.data.fields.required[c]+',\n';
			json += '\t\t\t\t"type": "'+ref+'"\n';
			json += '\t\t\t}\n';
			json += '\t\t}'+(i < this.data.fields.format.length-1 ? ',':'')+'\n';
			i++;
		}
		json += '\t]\n';
		json += '}';
		lines = json.split(/\n/);
		this.json = json;
		// Set the content of the output and resize the textarea so it is all visible
		S('#schema textarea').html(''+json+'').css({'height':(lines.length+1)+'em','line-height':'1em'});

		return this;
	}

	Converter.prototype.save = function(){

		// Bail out if there is no Blob function
		if(typeof Blob!=="function") return this;

		var textFileAsBlob = new Blob([this.json], {type:'text/plain'});
		if(!this.file) this.file = "schema.json";
		var fileNameToSaveAs = this.file.substring(0,this.file.lastIndexOf("."))+".geojson";

		function destroyClickedElement(event){ document.body.removeChild(event.target); }

		var dl = document.createElement("a");
		dl.download = fileNameToSaveAs;
		dl.innerHTML = "Download File";
		if(window.webkitURL != null){
			// Chrome allows the link to be clicked
			// without actually adding it to the DOM.
			dl.href = window.webkitURL.createObjectURL(textFileAsBlob);
		}else{
			// Firefox requires the link to be added to the DOM
			// before it can be clicked.
			dl.href = window.URL.createObjectURL(textFileAsBlob);
			dl.onclick = destroyClickedElement;
			dl.style.display = "none";
			document.body.appendChild(dl);
		}
		dl.click();
		S('.step3').addClass('checked');

		return this;
	}

	Converter.prototype.handleFileSelect = function(evt,typ){

		evt.stopPropagation();
		evt.preventDefault();
		dragOff();

		var files;
		if(evt.dataTransfer && evt.dataTransfer.files) files = evt.dataTransfer.files; // FileList object.
		if(!files && evt.target && evt.target.files) files = evt.target.files;

		function niceSize(b){
			if(b > 1e12) return (b/1e12).toFixed(2)+" TB";
			if(b > 1e9) return (b/1e9).toFixed(2)+" GB";
			if(b > 1e6) return (b/1e6).toFixed(2)+" MB";
			if(b > 1e3) return (b/1e3).toFixed(2)+" kB";
			return (b)+" bytes";
		}

		if(typ == "csv"){

			// files is a FileList of File objects. List some properties.
			var output = "";
			for (var i = 0, f; i < files.length; i++) {
				f = files[i];

				this.file = f.name;
				// ('+ (f.type || 'n/a')+ ')
				output += '<div><strong>'+ (f.name)+ '</strong> - ' + niceSize(f.size) + ', last modified: ' + (f.lastModifiedDate ? f.lastModifiedDate.toLocaleDateString() : 'n/a') + '</div>';

				// DEPRECATED as not reliable // Only process csv files.
				//if(!f.type.match('text/csv')) continue;

				var start = 0;
				var stop = Math.min(100000, f.size - 1);

				var reader = new FileReader();

				// Closure to capture the file information.
				reader.onloadend = function(evt) {
					if (evt.target.readyState == FileReader.DONE) { // DONE == 2
						if(stop > f.size - 1){
							var l = evt.target.result.regexLastIndexOf(/[\n\r]/);
							result = (l > 0) ? evt.target.result.slice(0,l) : evt.target.result;
						}else result = evt.target.result;

						var lines = result.match(/[\n\r]+/g);
						var cols = result.slice(0,result.indexOf("\n")).split(/,(?=(?:[^\"]*\"[^\"]*\")*(?![^\"]*\"))/);
						// Render table
						convert.parseCSV(result,{'url':f.name,'cols':cols.length,'rows':lines.length});
					}
				};
				
				// Read in the image file as a data URL.
				//reader.readAsText(f);
				var blob = f.slice(start,stop+1);
				reader.readAsText(blob);
			}
			//document.getElementById('list').innerHTML = '<p>File loaded:</p><ul>' + output.join('') + '</ul>';
			S('#drop_zone').append(output).addClass('loaded');
			S('.step1').addClass('checked');
		}else if(typ == "json"){

			f = files[0];
			output = '<div><strong>'+ escape(f.name)+ '</strong> ('+ (f.type || 'n/a')+ ') - ' + f.size + ' bytes, last modified: ' + (f.lastModifiedDate ? f.lastModifiedDate.toLocaleDateString() : 'n/a') + '</div>';
			S('#drop_zone_json').append(output).addClass('loaded');
			S('#validate').css({'display':'block'});
			S('.step4').addClass('checked');
		}
		return this;
	}

	Converter.prototype.validate = function(){

		return false;
	}

	// Define a new instance of the Converter
	convert = new Converter();
	
});