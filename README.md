# CSV2GeoJSON

Convert CSV files containing columns with defined geographies into GeoJSON files. Detecting geography requires us to spot column headings in your CSV file. That means your CSV will need one or two of the following columns:

* latitude/longitude (WGS84) - two columns titled `Latitude`/`Longitude`, `lat`/`lon` or `geox`/`geoy`.
* OS Grid References - two columns titled `Easting`/`Northing`.
* LSOA - a column titled `LSOA11CD`, `LSOA01CD` or `LSOA` (interpreted as 2011 codes) and that column will need to contain valid ONS LSOA codes e.g. E01012334.
* MSOA - a column titled `MSOA11CD` or `MSOA` (interpreted as 2011 codes) and that column will need to contain valid ONS MSOA codes e.g. E02002273.
* Ward - a column titled `WD19CD` or `Ward` (interpreted as 2019 wards) and that column will need to contain valid ONS 2019 Ward codes e.g. E05000026.
* Constituency - a column titled `PCON17CD` or Constituency (interpreted as 2017 Westminster Constituencies) and that column will need to contain valid ONS 2017 Constituency codes e.g. E14000530.
* Local Authority Districts - a column titled `LAD19CD` or Local Authority (interpreted as 2019 Local Authority Boundaries) and that column will need to contain valid ONS 2019 Local Authority codes e.g. E06000001.

WGS84 and OSGB86 will result in a GeoJSON file containing points. LSOA-based data will add polygons derived from the [ONS Lower Layer Super Output Areas (December 2011) Boundaries EW BGC](https://geoportal.statistics.gov.uk/datasets/lower-layer-super-output-areas-december-2011-boundaries-ew-bgc) (OGL). MSOA-based data will add polygons derived from the [ONS Middle Layer Super Output Areas (December 2011) Boundaries EW BGC](https://geoportal.statistics.gov.uk/datasets/middle-layer-super-output-areas-december-2011-boundaries-ew-bgc) (OGL). Ward-based data will add polygons derived from the [ONS Wards (December 2019) Boundaries EW BGC](https://geoportal.statistics.gov.uk/datasets/wards-december-2019-boundaries-ew-bgc) (OGL). Constituency-based data will add polygons derived from the [ONS Westminster Parliamentary Constituencies (December 2017) UK BGC](https://geoportal.statistics.gov.uk/datasets/westminster-parliamentary-constituencies-december-2017-uk-bgc) (OGL). Local-Authority-based data will add polygons derived from the [ONS Local Authority Districts (April 2019) Boundaries UK BGC](https://geoportal.statistics.gov.uk/datasets/local-authority-districts-april-2019-boundaries-uk-bgc) (OGL). Other columns in the CSV file will be added as properties to each feature in the GeoJSON.
