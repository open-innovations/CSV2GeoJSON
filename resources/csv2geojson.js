/*!
 * ODI Leeds CSV to GeoJSON converter (version 1.1)
 */
var convert;
S(document).ready(function(){

	function receiveMessage(event) {
		console.log('Received message from '+event.origin);
		if(event.origin !== "https://odileeds.github.io") return;

		convert.reset();

		S('#drop_zone').append('<div><strong>Received data from '+event.data.referer+'</strong> - ' + niceSize(event.data.csv.length) + '</div>').addClass('loaded');

		convert.parseCSV(event.data.csv);

		return;
	}

	window.addEventListener("message", receiveMessage, false);

	/**
	 * CSVToArray parses any String of Data including '\r' '\n' characters,
	 * and returns an array with the rows of data.
	 * @param {String} CSV_string - the CSV string you need to parse
	 * @param {String} delimiter - the delimeter used to separate fields of data
	 * @returns {Array} rows - rows of CSV where first row are column headers
	 */
	function CSVToArray (CSV_string, delimiter) {
		delimiter = (delimiter || ","); // user-supplied delimeter or default comma

		var pattern = new RegExp( // regular expression to parse the CSV values.
			( // Delimiters:
				"(\\" + delimiter + "|\\r?\\n|\\r|^)" +
				// Quoted fields.
				"(?:\"([^\"]*(?:\"\"[^\"]*)*)\"|" +
				// Standard fields.
				"([^\"\\" + delimiter + "\\r\\n]*))"
			), "gi"
		);

		var rows = [[]];  // array to hold our data. First row is column headers.
		// array to hold our individual pattern matching groups:
		var matches = false; // false if we don't find any matches
		// Loop until we no longer find a regular expression match
		while (matches = pattern.exec( CSV_string )) {
			var matched_delimiter = matches[1]; // Get the matched delimiter
			// Check if the delimiter has a length (and is not the start of string)
			// and if it matches field delimiter. If not, it is a row delimiter.
			if (matched_delimiter.length && matched_delimiter !== delimiter) {
				// Since this is a new row of data, add an empty row to the array.
				rows.push( [] );
			}
			var matched_value;
			// Once we have eliminated the delimiter, check to see
			// what kind of value was captured (quoted or unquoted):
			if (matches[2]) { // found quoted value. unescape any double quotes.
				matched_value = matches[2].replace(
					new RegExp( "\"\"", "g" ), "\""
				);
			} else { // found a non-quoted value
				matched_value = matches[3];
			}
			// Now that we have our value string, let's add
			// it to the data array.
			rows[rows.length - 1].push(matched_value);
		}
		return rows; // Return the parsed data Array
	}

	// Function to parse a CSV file and return a JSON structure
	// Guesses the format of each column based on the data in it.
	function CSV2JSON(data,start,end){

		// If we haven't sent a start row value we assume there is a header row
		if(typeof start!=="number") start = 1;
		// Split by the end of line characters
		if(typeof data==="string") data = CSVToArray(data);
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

			line = data[i];

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
		S(this).addClass('drop').removeClass('loaded');
	}
	function dragOff(){
		S(this).removeClass('drop');
	}

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

		this.maxrowstable = 10;	// Limit on the number of rows to display
	
		// The supported data types as specified in http://csvlint.io/about
		//this.datatypes = [{"label":"string","ref":"http://www.w3.org/2001/XMLSchema#string"},{"label":"integer","ref":"http://www.w3.org/2001/XMLSchema#int"},{"label":"float","ref":"http://www.w3.org/2001/XMLSchema#float"},{"label":"double","ref":"http://www.w3.org/2001/XMLSchema#double"},{"label":"URL","ref":"http://www.w3.org/2001/XMLSchema#anyURI"},{"label":"boolean","ref":"http://www.w3.org/2001/XMLSchema#boolean"},{"label":"non-positive integer","ref":"http://www.w3.org/2001/XMLSchema#nonPositiveInteger"}, {"label":"positive integer","ref":"http://www.w3.org/2001/XMLSchema#positiveInteger"}, {"label":"non-negative integer","ref":"http://www.w3.org/2001/XMLSchema#nonNegativeInteger"}, {"label":"negative integer","ref":"http://www.w3.org/2001/XMLSchema#negativeInteger"},{"label":"date","ref":"http://www.w3.org/2001/XMLSchema#date"}, {"label":"date & time","ref":"http://www.w3.org/2001/XMLSchema#dateTime"},{"label":"year","ref":"http://www.w3.org/2001/XMLSchema#gYear"},{"label":"year & month","ref":"http://www.w3.org/2001/XMLSchema#gYearMonth"},{"label":"time","ref":"http://www.w3.org/2001/XMLSchema#time "}];
		this.datatypes = [{"label":"string","ref":"http://www.w3.org/2001/XMLSchema#string"},{"label":"integer","ref":"http://www.w3.org/2001/XMLSchema#int"},{"label":"float","ref":"http://www.w3.org/2001/XMLSchema#float"},{"label":"double","ref":"http://www.w3.org/2001/XMLSchema#double"},{"label":"URL","ref":"http://www.w3.org/2001/XMLSchema#anyURI"},{"label":"boolean","ref":"http://www.w3.org/2001/XMLSchema#boolean"},{"label":"date","ref":"http://www.w3.org/2001/XMLSchema#date"}, {"label":"datetime","ref":"http://www.w3.org/2001/XMLSchema#dateTime"},{"label":"year","ref":"http://www.w3.org/2001/XMLSchema#gYear"},{"label":"time","ref":"http://www.w3.org/2001/XMLSchema#time "}];

		this.geographies = {'LSOA11CD':{},'LSOA01CD':{},'MSOA11CD':{},'WD19CD':{},'WD20CD':{},'PCON17CD':{},'LAD19CD':{},'LAD20CD':{},'LAD21CD':{}};
		this.messages = [];

		// If we provided a filename we load that now
		if(file) S().ajax(file,{'complete':this.parseCSV,'this':this,'cache':false});
		
		// Hide the loader
		S('#loader').css({'display':'none'});

		// When the user focuses on the schema output, it all gets selected
		S('#schema textarea').on('focus',function(){
			this.e[0].select()
		});
		
		S('#save').on('click',{me:this},function(e){
			e.data.me.save();
		});


		// Setup the dnd listeners.
		var dropZone = document.getElementById('drop_zone');
		dropZone.addEventListener('dragover', dropOver, false);
		dropZone.addEventListener('dragout', dragOff, false);


		var _obj = this;
		document.getElementById('standard_files').addEventListener('change',function(evt){
			evt.stopPropagation();
			evt.preventDefault();
			_obj.reset();
			return _obj.handleFileSelect(evt,'csv');
		}, false);

		S('#results').css({'display':'none'});
		S('ul.tabs > li > a').on('click',{me:this},function(e){
			e.preventDefault();
			e.stopPropagation();
			selectPanel(e.currentTarget.getAttribute('href'));
		});
		
		S('#reset').on('click',{me:this},function(e){
			e.preventDefault();
			e.data.me.reset();
		});

		return this;
	}
	
	Converter.prototype.reset = function(){
		S('#results').css({'display':'none'});
		S('#drop_zone').removeClass('loaded');
		S('#filedetails').remove();
		S('#contents').html('');
		delete this.csv;
		delete this.attr;
		delete this.data;
		delete this.records;
		delete this.file;
		this.messages = [];
		S('.dropzone .file-details').html("");
	}

	function selectPanel(panel){
		var tabs = S('ul.tabs > li > a');
		var panels = S('.panel');

		for(var i = 0; i < tabs.length; i++){
			if(tabs[i].getAttribute('href')==panel) S(tabs[i]).addClass('b6-bg').removeClass('b4-bg');
			else S(tabs[i]).removeClass('b6-bg').addClass('b4-bg');
		}
		
		for(var i = 0; i < panels.length; i++){
			if(panels[i].getAttribute('id')==panel.substr(1)) S(panels[i]).css({'display':''});
			else S(panels[i]).css({'display':'none'});
		}
		
		if(panel == "#map") S('#map').trigger('resize');
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

		// Convert the CSV to a JSON structure
		this.data = CSV2JSON(data,1);
		this.records = this.data.rows.length; 

		this.loading();
		// Work out the geography of the points
		this.findGeography(function(){
			
			this.loaded();

			// Construct the HTML table
			this.buildTable()

			// Construct the map
			this.buildMap();
			
			this.buildMessages();

			selectPanel('#table');
		});

		return;
	}

	Converter.prototype.findGeography = function(callback){

		var x = -1;
		var y = -1;
		var p = -1;
		var crs = -1;

		var convertfromosgb = false;
		this.geotype = "";

		for(var c = 0; c < this.data.fields.title.length; c++){
			// Deal with X coordinate
			if(this.data.fields.title[c].toLowerCase() == "longitude") x = c;
			if(x < 0 && (this.data.fields.title[c].toLowerCase() == "lon" || this.data.fields.title[c].toLowerCase() == "long")) x = c;
			if(x < 0 && this.data.fields.title[c].toLowerCase() == "geox") x = c;
			if(x < 0 && (this.data.fields.title[c].toLowerCase() == "easting" || this.data.fields.title[c].toLowerCase() == "eastings")){
				x = c;
				convertfromosgb = true;
			}
			// Deal with Y coordinate
			if(this.data.fields.title[c].toLowerCase() == "latitude") y = c;
			if(y < 0 && this.data.fields.title[c].toLowerCase() == "lat") y = c;
			if(y < 0 && this.data.fields.title[c].toLowerCase() == "geoy") y = c;
			if(y < 0 && (this.data.fields.title[c].toLowerCase() == "northing" || this.data.fields.title[c].toLowerCase() == "northings")){
				y = c;
				convertfromosgb = true;
			}
			if(this.data.fields.title[c] == "CoordinateReferenceSystem") crs = c;
		}

		this.data.coords = new Array(this.data.rows.length);
		this.geocount = 0;

		if(x >= 0 && y >= 0){
			for(var i = 0; i < this.data.rows.length; i++){
				lat = this.data.rows[i][y];
				lon = this.data.rows[i][x];
				if(lat!="" && lon!=""){
					ll = [];
					if(crs >= 0){
						if(typeof this.data.rows[i][crs]==="string" && this.data.rows[i][crs].toLowerCase() == "osgb36"){
							ll = NEtoLL([lon,lat]);
						}
					}
					if(convertfromosgb) ll = NEtoLL([lon,lat]);
					if(ll.length == 2){
						lat = ll[0];
						lon = ll[1];				
					}
					if(lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180){
						this.data.coords[i] = [parseFloat(parseFloat(lon).toFixed(6)), parseFloat(parseFloat(lat).toFixed(6))];
						this.geocount++;
					}
				}else{
					this.data.coords[i] = [];
				}
			}

			if(typeof callback==="function") callback.call(this);

		}else{
			
			this.geotype = "";
			for(var c = 0; c < this.data.fields.title.length; c++){
				if(p < 0 && (this.data.fields.title[c].toUpperCase() == "LSOA" || this.data.fields.title[c].toUpperCase() == "LSOA11CD")){
					p = c;
					this.geotype = "LSOA11CD";
				}else if(p < 0 && this.data.fields.title[c].toUpperCase() == "LSOA01CD"){
					p = c;
					this.geotype = "LSOA01CD";
				}else if(p < 0 && (this.data.fields.title[c].toUpperCase() == "MSOA" || this.data.fields.title[c].toUpperCase() == "MSOA11CD")){
					p = c;
					this.geotype = "MSOA11CD";
				}else if(p < 0 && (this.data.fields.title[c].toUpperCase() == "WARD" || this.data.fields.title[c].toUpperCase() == "WD20CD")){
					p = c;
					this.geotype = "WD20CD";
				}else if(p < 0 && (this.data.fields.title[c].toUpperCase() == "WD19CD")){
					p = c;
					this.geotype = "WD19CD";
				}else if(p < 0 && (this.data.fields.title[c].toUpperCase() == "LOCAL AUTHORITY" || this.data.fields.title[c].toUpperCase() == "LAD21CD")){
					p = c;
					this.geotype = "LAD21CD";
				}else if(p < 0 && (this.data.fields.title[c].toUpperCase() == "LAD20CD")){
					p = c;
					this.geotype = "LAD20CD";
				}else if(p < 0 && (this.data.fields.title[c].toUpperCase() == "LAD19CD")){
					p = c;
					this.geotype = "LAD19CD";
				}else if(p < 0 && (this.data.fields.title[c].toUpperCase() == "CONSTITUENCY" || this.data.fields.title[c].toUpperCase() == "PCON17CD")){
					p = c;
					this.geotype = "PCON17CD";
				}
			}
			if(p >= 0 && this.geotype && this.geographies[this.geotype]){
				var polys = {};
				var i,poly;
				for(i = 0; i < this.data.rows.length; i++){
					poly = this.data.rows[i][p];
					if(!this.geographies[this.geotype][poly]) polys[poly] = 'https://odileeds.github.io/geography-bits/data/'+this.geotype+'/'+poly+'.geojsonl';
				}
				var toload = 0;
				var loaded = 0;
				for(poly in polys) toload++;
				var _obj = this;
				function done(p,geotype,callback){
					_obj.data[geotype] = new Array(_obj.data.rows.length);
					_obj.geocount = 0;
					for(i = 0; i < _obj.data.rows.length; i++){
						poly = _obj.data.rows[i][p];
						// We don't have a geometry property
						if(!_obj.geographies[geotype][poly].geometry){
							_obj.messages.push({'type':'warning','title':'<em>'+poly+'</em> does not appear to be a valid '+geotype});
						}else{
							_obj.geocount++;
						}

						_obj.data[geotype][i] = clone(_obj.geographies[geotype][poly]);
						for(j = 0; j < _obj.data.rows[i].length; j++){
							v = _obj.data.rows[i][j];
							if(parseFloat(v)==v) v = parseFloat(v);
							_obj.data[geotype][i].properties[_obj.data.fields.title[j]] = v;
						}
					}
					S('#progressbar').addClass('done');
					if(typeof callback==="function") callback.call(_obj);
				}
				if(toload == 0){
					// Immediately call the callback
					done(p,this.geotype,callback);
				}else{
					S('#progressbar').removeClass('done');
					S('#progressbar .progress-inner').css({'width':'0%'});
					// Load every geography
					for(poly in polys){
						S().ajax(polys[poly],{
							'dataType':'json',
							'this':this,
							'poly':poly,
							'geotype':this.geotype,
							'p':p,
							'callback':callback,
							'success':function(d,attr){
								loaded++;
								S('#progressbar .progress-inner').css({'width':(100*loaded/toload)+'%'});
								if(!this.geographies[attr.geotype]) this.geographies[attr.geotype] = {};
								this.geographies[attr.geotype][attr.poly] = d;
								if(toload==loaded) done(attr.p,attr.geotype,attr.callback);
							},
							'error':function(err,attr){
								// It didn't load so we'll add it to the tally
								loaded++;
								console.error('Unable to load '+attr.url);
								this.geographies[attr.geotype][attr.poly] = {'properties':{}};
								if(toload==loaded) done(attr.p,attr.geotype,attr.callback);
							}
						});
					}
				}
			}else{
				if(typeof callback==="function") callback.call(this);
			}
		}

		return this;
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

	Converter.prototype.addPolygonLayer = function(layerselected,colour){

		// Clear any existing layer
		if(this.layer){
			this.layer.clearLayers();
			this.map.removeLayer(this.layer);
			delete this.layer;
			if(this.geojson.features) this.geojson.features = [];
		}

		var _obj,key,geoattr,added,inverse;
		_obj = this;
		inverse = false;
		added = 0;
		function getRange(k){
			var v,i;
			var min = 1e100;
			var max = -1e100;
			for(i = 0; i < _obj.data.rows.length; i++){
				if(_obj.geojson.features[i].geometry){
					v = parseFloat(_obj.data.rows[i][k]);
					if(typeof v==="number" && !isNaN(v)){
						min = Math.min(min,v);
						max = Math.max(max,v);
					}
				}
			}
			if(min == -0) min = 0;
			return {'min':min,'max':max,'key':_obj.data.fields.name[k],'k':k};
		}
		this.layerselector = [];
		this.layerprops = {'min':0,'max':1,'key':''};

		geoattr = {
			'style': function(feature){
				if(feature.geometry.type == "Polygon" || feature.geometry.type == "MultiPolygon"){
					var val = 0;
					var k = _obj.layerprops.key;
					if(typeof feature.properties[k]==="number") val = feature.properties[k];
					if(typeof val==="number"){
						var f = (val-_obj.layerprops.min)/(_obj.layerprops.max - _obj.layerprops.min);
						if(inverse) f = 1-f;
						v = (f*0.6 + 0.2);
					}
					return { "color": colour, "weight": 0.5, "opacity": 0.65, "fillOpacity": v };
				}else return { "color": colour };	
			},
			'onEachFeature': function(feature, layer){
				var popup =  popuptext(feature,{'this':_obj});
				if(popup) layer.bindPopup(popup);
			}
		};
		if(this.data[this.geotype]){
			for(var i = 0; i < this.data[this.geotype].length; i++){
				feature = {"type":"Feature","properties":{},"geometry": this.data[this.geotype][i].geometry };
				for(var c = 0; c < this.data.rows[i].length; c++){
					var n = this.data.fields.title[c];
					if(this.data.fields.required[c]==true && this.data.rows[i][c]!=""){
						v = this.data.rows[i][c];
						if(parseFloat(v)==v) v = parseFloat(v);
						feature.properties[n] = v;
					}
				}
				this.geojson.features.push(feature);
				added++;
			}
		}else{
			this.messages.push({'type':'warning','title':'Geotype ('+this.geotype+') error'});
		}

		var options = '';
		var s = -1;
		if(typeof layerselected==="number") s = layerselected;
		
		for(var k = 0, i = 0; k < this.data.fields.format.length; k++){
			if(this.data.fields.required[k]){
				if(this.data.fields.format[k]=="integer" || this.data.fields.format[k]=="float"){
					if(s < 0 && i==0) s = k;
					this.layerselector.push({'title':this.data.fields.name[k]});
					options += '<option value="'+k+'"'+(k==s ? ' selected="selected"':'')+'>'+this.data.fields.name[k]+'</option>';
					i++;
				}
			}
		}
		this.layerprops = getRange(s);
		this.layer = L.geoJSON(this.geojson,geoattr);

		if(layerselected < 0){

			this.customSelector._container.innerHTML = '<select>'+options+'</select>';
			
			S(this.customSelector._container).css({'display':''}).find('select').off('change').on('change',{me:this,colour:colour},function(e){
				if(e.data.me.layerselector.length>0){
					e.data.me.addPolygonLayer(parseInt(e.currentTarget.value),e.data.colour);
					e.data.me.layer.addTo(e.data.me.map);
				}
			});
		}
		return added;
	}
	Converter.prototype.buildMap = function(){

		var lat = 53.79659;
		var lon = -1.53385;
		var d = 0.003;

		if(!this.map){
			var mapel = S('#map output');
			var mapid = mapel.attr('id');
			this.map = L.map(mapid,{'scrollWheelZoom':true}).fitBounds([
				[lat-d, lon-d],
				[lat+d, lon+d]
			]);
			// CartoDB map
			L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png', {
				attribution: 'Tiles: &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="http://cartodb.com/attributions">CartoDB</a>',
				subdomains: 'abcd',
				maxZoom: 19
			}).addTo(this.map);
			
			if(this.customSelector) this.map.removeControl(this.customSelector);
			
			L.Control.CustomSelector = L.Control.extend({
				'options': { 'position': 'topright' },
				'onAdd': function(map) {
					var container = L.DomUtil.create('div','mycontrol');
					var selector = L.DomUtil.create('select','myclass');
					selector.innerHTML = '';
					container.appendChild(selector);
					return container;
				},
				onRemove: function(map) {
					// Nothing to do here
				}
			});
			
			this.customSelector = new L.Control.CustomSelector();
			
			this.map.addControl(this.customSelector);
		}
		
		


		this.geojson = {
			"type": "FeatureCollection",
			"features": []
		}
		var colour = '#FF6700';
		var added = 0;

		S(this.customSelector._container).css({'display':'none'});

	

		if(this.geotype){
			added = this.addPolygonLayer(-1,colour);

		}else{
			
			var customicon = makeMarker('#FF6700');

			// Build marker list
			var markerList = [];
			for(var i = 0; i < this.data.rows.length; i++){
				if(this.data.coords[i] && this.data.coords[i].length == 2){

					feature = {"type":"Feature","properties":{},"geometry": { "type": "Point", "coordinates": this.data.coords[i] }};
					for(var c = 0; c < this.data.rows[i].length; c++){
						var n = this.data.fields.title[c];
						if(this.data.fields.required[c]==true && this.data.rows[i][c]!="") feature.properties[n] = this.data.rows[i][c];
					}
					this.geojson.features.push(feature);
					added++;

					// Add marker
					marker = L.marker([this.data.coords[i][1],this.data.coords[i][0]],{icon: customicon});
					marker.bindPopup(popuptext(feature));
					markerList.push(marker);
				}
			}
			if(this.map && this.geojson.features.length > 0){
				if(this.layer) this.map.removeLayer(this.layer);

				// Define a cluster layer
				this.layer = L.markerClusterGroup({
					chunkedLoading: true,
					maxClusterRadius: 70,
					iconCreateFunction: function (cluster) {
						var markers = cluster.getAllChildMarkers();
						return L.divIcon({ html: '<div class="marker-group" style="background-color:#FF6700;color:black">'+markers.length+'</div>', className: '',iconSize: L.point(40, 40) });
					},
					// Disable all of the defaults:
					spiderfyOnMaxZoom: true, showCoverageOnHover: false, zoomToBoundsOnClick: true
				});
				// Add marker list to layer
				this.layer.addLayers(markerList);
			}
		}
		
		if(this.layer){
			if(added > 0) this.map.fitBounds(this.layer.getBounds(),{'padding':[8,8]});
			this.layer.addTo(this.map);
		}


		
		txt = JSON.stringify(this.geojson);
		
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
		var thead = "";
		var tbody = "";
		var mx = Math.min(this.data.rows.length,this.maxrowstable);

		if(S('#output-table').length==0){
			S('#table output').html('<p id="about-table"></p><div id="output-table" class="table-holder"><table><thead></thead><tbody></tbody></table></div>');


			thead += '<tr><th>Title:</th>';

			for(var c in this.data.fields.name){
				thead += '<th><input id="title-'+c+'" type="text" value="'+this.data.fields.title[c]+'" data-row="title" data-col="'+c+'" /></th>';
			}

			thead += '</tr>';
			thead += '<tr><th>Type:</th>';
			for(var c in this.data.fields.name){
				thead += '<th>'+this.buildSelect(this.data.fields.format[c],"format",c)+'</th>';
			}
			thead += '</tr>';

			thead += '<tr><th>Keep?</th>';
			for(var c in this.data.fields.name){
				thead += '<th class="constraint"><label></label>'+this.buildTrueFalse(this.data.fields.required[c],"required",c)+'<!--<button class="delete" title="Remove this constraint from this column">&times;</button><button class="add" title="Add a constraint to this column">&plus;</button>--></th>';
			}
			thead += '</tr>';

			S('#output-table thead').html(thead);

			S('#output-table select').on('change',{me:this},function(e,i){
				var el = document.getElementById(e.currentTarget.id);
				var value = el.options[el.selectedIndex].value;
				e.data.me.update(e.currentTarget.id,value);
			});
			S('#output-table input').on('change',{me:this},function(e,i){
				e.data.me.update(e.currentTarget.id,e.currentTarget.value);
			});

		}

		S('#about-table').html("We loaded <em>"+this.records+" records</em> (only showing the first "+mx+" in the table)."+(this.geocount < this.records ? ' <strong>'+this.geocount+'/'+this.records+' records appear to have valid geography</strong>.':''));

		for(var i = 0; i < mx; i++){
			cls = "";
			if(this.data.coords && this.data.coords[i] && this.data.coords[i].length!=2) cls = ' class="nogeo"';
			if(this.geotype && this.data[this.geotype] && this.data[this.geotype][i] && !this.data[this.geotype][i].geometry) cls = ' class="nogeo"';
			tbody += '<tr'+cls+'><td class="rn">'+(i+1)+'</td>';
			for(var c = 0; c < this.data.rows[i].length; c++){
				tbody += '<td '+(this.data.fields.format[c] == "float" || this.data.fields.format[c] == "integer" || this.data.fields.format[c] == "year" || this.data.fields.format[c] == "date" || this.data.fields.format[c] == "datetime" ? ' class="n"' : '')+'>'+this.data.rows[i][c]+'</td>';
			}
			tbody += '</tr>';
		}
		S('#output-table tbody').html(tbody);

		return this;
	}

	// Construct the HTML table
	Converter.prototype.buildMessages = function(){
	
		var html = "";
		var i;
		var warnings = 0;
		for(i = 0; i < this.messages.length; i++){
			sym = "";
			if(this.messages[i]['type']=="warning"){
				sym = "⚠️";
				warnings++;
			}
			html += '<li>'+sym+' '+this.messages[i].title+'</li>';
		}
		if(html) html = '<ol>'+html+'</ol>';
		S('#messages output').html(html);
		if(warnings > 0){
			S('.nmessage').html("⚠️"+' '+this.messages.length);
			S('.nmessage').parent().parent().css({'display':''});
		}else{
			S('.nmessage').html("");
			S('.nmessage').parent().parent().css({'display':'none'});
		}
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
		if(row == "title" || row == "required"){
			this.loading();
			this.findGeography(function(){
				this.loaded();
				this.buildTable();
				this.buildMap();
				this.buildMessages();
			});
		}

		return this;
	}

	Converter.prototype.loading = function(){
		S('#loader').css({'display':''});
		// Clear any existing messages
		this.messages = [];
		return this;
	}
	
	Converter.prototype.loaded = function(){
		S('#results').css({'display':''});
		S('#loader').css({'display':'none'});
		return this;
	}
	Converter.prototype.save = function(){

		// Bail out if there is no Blob function
		if(typeof Blob!=="function") return this;

		var textFileAsBlob = new Blob([JSON.stringify(this.geojson)], {type:'text/plain'});
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

		return this;
	}

	Converter.prototype.handleFileSelect = function(evt,typ){

		dragOff();

		var files;
		if(evt.dataTransfer && evt.dataTransfer.files) files = evt.dataTransfer.files; // FileList object.
		if(!files && evt.target && evt.target.files) files = evt.target.files;

		if(typ == "csv"){

			// files is a FileList of File objects. List some properties.
			var output = "";
			for (var i = 0, f; i < files.length; i++) {
				f = files[i];

				this.file = f.name;
				// ('+ (f.type || 'n/a')+ ')
				output += '<div class="file-details"><strong>'+ (f.name)+ '</strong> - ' + niceSize(f.size) + ', last modified: ' + (f.lastModifiedDate ? f.lastModifiedDate.toLocaleDateString() : 'n/a') + '</div>';

				// DEPRECATED as not reliable // Only process csv files.
				//if(!f.type.match('text/csv')) continue;

				var start = 0;
				var stop = f.size - 1; //Math.min(100000, f.size - 1);

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
		}
		return this;
	}

	Converter.prototype.validate = function(){

		return false;
	}


	function NEtoLL(coo) {

		osgb=new GT_OSGB();
		osgb.setGridCoordinates(coo[0],coo[1]);
		wgs84 = osgb.getWGS84();
		return [wgs84.latitude,wgs84.longitude];
		
	}
	
	function niceSize(b){
		if(b > 1e12) return (b/1e12).toFixed(2)+" TB";
		if(b > 1e9) return (b/1e9).toFixed(2)+" GB";
		if(b > 1e6) return (b/1e6).toFixed(2)+" MB";
		if(b > 1e3) return (b/1e3).toFixed(2)+" kB";
		return (b)+" bytes";
	}



	// Define a new instance of the Converter
	convert = new Converter();
	
});