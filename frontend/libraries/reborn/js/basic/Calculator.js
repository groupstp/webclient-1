/*
	Класс, ответственный за вычисления
	Умеет:
		Переводить широту и долготу (координаты WGS84) в XY (координаты UTM)
		Находить расстояние между двумя точками по широте и долготе
		Решать прямую геодезическую задачу в координатах XY
		Переводить радианы в градусы и обратно
*/

window.Calculator = class Calculator extends SmartObject{
	constructor(){
		super();
		this.sma = 6378137.0;
		this.smb = 6356752.314;
		this.smEccSquared = 6.69437999013e-03;
		this.UTMScaleFactor = 0.9996;
	}

	/*
		Находит угол наклона отрезка, соединяющего точки start и end		
	*/
	getAngle(start, end){
		var 
			// переводим координаты в XY, возвращаем угол наклона
			startxy = this.fromLatLngToXY(start),
			endxy = this.fromLatLngToXY(end);
		return Math.atan2(endxy.y - startxy.y, endxy.x-startxy.x);
	}

	/**
		Решает прямую геодезическую задачу.
		Дано: координаты начальной точки (широта и долгота), направление (угол к оси X) и расстояние.
		Найти: координаты конечной точки.
		@param start массив, содержащий широту и долготу начальной точки.
		@param angle Угол к оси X, задающий направление движения (в радианах!).
		@param distance Расстояние, которое нужно пройти.
		@returns Широту и долготу конечной точки.
	*/
	forwardTask(start, angle, distance){
		let 
			// переводим координаты начальной точки в XY
			startxy = this.fromLatLngToXY(start),
			// находим приращение координат
			deltaX = distance*Math.cos(angle),
			deltaY = distance*Math.sin(angle);
		// результат в системе UTM	
		startxy.x = startxy.x+deltaX;
		startxy.y = startxy.y+deltaY;
		// возвращаем результат, переведённый обратно в WGS84
		return this.fromXYtoLatLng(startxy);
	}

	// та же пгз, но без перевода, работает только с UTM
	forwardTaskXY(start, angle, distance){
		let
			end = {x: null, y: null, southhemi: start.southhemi, zone: start.zone},
			// находим приращение координат
			deltaX = distance*Math.cos(angle),
			deltaY = distance*Math.sin(angle);
		// результат в системе UTM	
		end.x = start.x+deltaX;
		end.y = start.y+deltaY;
		// возвращаем результат, 
		return end;
	}

	getDistance(from, to){
		const R = 6371000;
		var rad = Math.PI / 180,
			lat1 = from[0] * rad,
			lat2 = to[0] * rad,
			a = Math.sin(lat1) * Math.sin(lat2) +
			Math.cos(lat1) * Math.cos(lat2) * Math.cos((to[1] - from[1]) * rad);
		return R * Math.acos(Math.min(a, 1));	
	}

	degToRad (deg) {
		return (deg / 180.0 * 3.14159265358979);
	}

	radToDeg (rad) {
		return (rad / 3.14159265358979 * 180.0);
	}

	/*
	* UTMCentralMeridian
	*
	* Determines the central meridian for the given UTM zone.
	* Inputs:
	*	 zone - An integer value designating the UTM zone, range [1,60].
	* Returns:
	*   The central meridian for the given UTM zone, in radians, or zero
	*   if the UTM zone parameter is outside the range [1,60].
	*   Range of the central meridian is the radian equivalent of [-177,+177].
	*
	*/
	UTMCentralMeridian (zone) {		
		return this.degToRad(-183.0 + (zone * 6.0));
	}

	/*
	* arcLengthOfMeridian
	*
	* Computes the ellipsoidal distance from the equator to a point at a
	* given latitude.
	* Reference: Hoffmann-Wellenhof, B., Lichtenegger, H., and Collins, J.,
	* GPS: Theory and Practice, 3rd ed.  New York: Springer-Verlag Wien, 1994.	
	* Inputs:
	*	 phi - Latitude of the point, in radians.	
	* Globals:
	*	 sma - Ellipsoid model major axis.
	*	 smb - Ellipsoid model minor axis.	
	* Returns:
	*	 The ellipsoidal distance of the point from the equator, in meters.	
	*/
	arcLengthOfMeridian (phi) {
		var alpha, beta, gamma, delta, epsilon, n;
		var result;
		/* Precalculate n */
		n = (this.sma - this.smb) / (this.sma + this.smb);
		/* Precalculate alpha */
		alpha = ((this.sma + this.smb) / 2.0)
		   * (1.0 + (Math.pow (n, 2.0) / 4.0) + (Math.pow (n, 4.0) / 64.0));
		/* Precalculate beta */
		beta = (-3.0 * n / 2.0) + (9.0 * Math.pow (n, 3.0) / 16.0)
		   + (-3.0 * Math.pow (n, 5.0) / 32.0);
		/* Precalculate gamma */
		gamma = (15.0 * Math.pow (n, 2.0) / 16.0)
			+ (-15.0 * Math.pow (n, 4.0) / 32.0);
		/* Precalculate delta */
		delta = (-35.0 * Math.pow (n, 3.0) / 48.0)
			+ (105.0 * Math.pow (n, 5.0) / 256.0);
		/* Precalculate epsilon */
		epsilon = (315.0 * Math.pow (n, 4.0) / 512.0);
		/* Now calculate the sum of the series and return */
		result = alpha
		* (phi + (beta * Math.sin (2.0 * phi))
			+ (gamma * Math.sin (4.0 * phi))
			+ (delta * Math.sin (6.0 * phi))
			+ (epsilon * Math.sin (8.0 * phi)));
		return result;
	}

	/*
	* footpointLatitude
	*
	* Computes the footpoint latitude for use in converting transverse
	* Mercator coordinates to ellipsoidal coordinates.
	*
	* Reference: Hoffmann-Wellenhof, B., Lichtenegger, H., and Collins, J.,
	*   GPS: Theory and Practice, 3rd ed.  New York: Springer-Verlag Wien, 1994.
	*
	* Inputs:
	*   y - The UTM northing coordinate, in meters.
	*
	* Returns:
	*   The footpoint latitude, in radians.    
	*/
    footpointLatitude (y){
		var y, alpha, beta, gamma, delta, epsilon, n;
		var result;        
		/* Precalculate n (Eq. 10.18) */
		n = (this.sma - this.smb) / (this.sma + this.smb);
		/* Precalculate alpha (Eq. 10.22) */
		/* (Same as alpha in Eq. 10.17) */
		alpha = ((this.sma + this.smb) / 2.0)
		    * (1 + (Math.pow (n, 2.0) / 4) + (Math.pow (n, 4.0) / 64));
		/* Precalculate y (Eq. 10.23) */
		y = y / alpha;
		/* Precalculate beta (Eq. 10.22) */
		beta = (3.0 * n / 2.0) + (-27.0 * Math.pow (n, 3.0) / 32.0)
		    + (269.0 * Math.pow (n, 5.0) / 512.0);
		/* Precalculate gamma (Eq. 10.22) */
		gamma = (21.0 * Math.pow (n, 2.0) / 16.0)
		    + (-55.0 * Math.pow (n, 4.0) / 32.0);
		/* Precalculate delta (Eq. 10.22) */
		delta = (151.0 * Math.pow (n, 3.0) / 96.0)
		    + (-417.0 * Math.pow (n, 5.0) / 128.0);
		/* Precalculate epsilon (Eq. 10.22) */
		epsilon = (1097.0 * Math.pow (n, 4.0) / 512.0);
		/* Now calculate the sum of the series (Eq. 10.21) */
		result = y + (beta * Math.sin (2.0 * y))
		    + (gamma * Math.sin (4.0 * y))
		    + (delta * Math.sin (6.0 * y))
		    + (epsilon * Math.sin (8.0 * y));
		return result;
	}

	/*
	* mapLatLonToXY
	*
	* Converts a latitude/longitude pair to x and y coordinates in the
	* Transverse Mercator projection.  Note that Transverse Mercator is not
	* the same as UTM; a scale factor is required to convert between them.	
	* Reference: Hoffmann-Wellenhof, B., Lichtenegger, H., and Collins, J.,
	* GPS: Theory and Practice, 3rd ed.  New York: Springer-Verlag Wien, 1994.	
	* Inputs:
	*	phi - Latitude of the point, in radians.
	*	lambda - Longitude of the point, in radians.
	*	lambda0 - Longitude of the central meridian to be used, in radians.	
	* Outputs:
	*	xy - A 2-element array containing the x and y coordinates
	*		 of the computed point.		
	*/
	mapLatLonToXY (phi, lambda, lambda0) {
		var N, nu2, ep2, t, t2, l;
		var l3coef, l4coef, l5coef, l6coef, l7coef, l8coef;
		var tmp;

		/* Precalculate ep2 */
		ep2 = (Math.pow (this.sma, 2.0) - Math.pow (this.smb, 2.0)) / Math.pow (this.smb, 2.0);

		/* Precalculate nu2 */
		nu2 = ep2 * Math.pow (Math.cos (phi), 2.0);

		/* Precalculate N */
		N = Math.pow (this.sma, 2.0) / (this.smb * Math.sqrt (1 + nu2));

		/* Precalculate t */
		t = Math.tan (phi);
		t2 = t * t;
		tmp = (t2 * t2 * t2) - Math.pow (t, 6.0);

		/* Precalculate l */
		l = lambda - lambda0;

		/* Precalculate coefficients for l**n in the equations below
		   so a normal human being can read the expressions for easting
		   and northing
		   -- l**1 and l**2 have coefficients of 1.0 */
		l3coef = 1.0 - t2 + nu2;
		l4coef = 5.0 - t2 + 9 * nu2 + 4.0 * (nu2 * nu2);
		l5coef = 5.0 - 18.0 * t2 + (t2 * t2) + 14.0 * nu2
			- 58.0 * t2 * nu2;
		l6coef = 61.0 - 58.0 * t2 + (t2 * t2) + 270.0 * nu2
			- 330.0 * t2 * nu2;
		l7coef = 61.0 - 479.0 * t2 + 179.0 * (t2 * t2) - (t2 * t2 * t2);
		l8coef = 1385.0 - 3111.0 * t2 + 543.0 * (t2 * t2) - (t2 * t2 * t2);

		var xy = {};

		/* Calculate easting (x) */
		xy.x = N * Math.cos (phi) * l
			+ (N / 6.0 * Math.pow (Math.cos (phi), 3.0) * l3coef * Math.pow (l, 3.0))
			+ (N / 120.0 * Math.pow (Math.cos (phi), 5.0) * l5coef * Math.pow (l, 5.0))
			+ (N / 5040.0 * Math.pow (Math.cos (phi), 7.0) * l7coef * Math.pow (l, 7.0));

		/* Calculate northing (y) */
		xy.y = this.arcLengthOfMeridian (phi)
			+ (t / 2.0 * N * Math.pow (Math.cos (phi), 2.0) * Math.pow (l, 2.0))
			+ (t / 24.0 * N * Math.pow (Math.cos (phi), 4.0) * l4coef * Math.pow (l, 4.0))
			+ (t / 720.0 * N * Math.pow (Math.cos (phi), 6.0) * l6coef * Math.pow (l, 6.0))
			+ (t / 40320.0 * N * Math.pow (Math.cos (phi), 8.0) * l8coef * Math.pow (l, 8.0));
		return xy;
	}

	/*
	* mapXYToLatLon
	*
	* Converts x and y coordinates in the Transverse Mercator projection to
	* a latitude/longitude pair.  Note that Transverse Mercator is not
	* the same as UTM; a scale factor is required to convert between them.
	*
	* Reference: Hoffmann-Wellenhof, B., Lichtenegger, H., and Collins, J.,
	*   GPS: Theory and Practice, 3rd ed.  New York: Springer-Verlag Wien, 1994.
	*
	* Inputs:
	*   x - The easting of the point, in meters.
	*   y - The northing of the point, in meters.
	*   lambda0 - Longitude of the central meridian to be used, in radians.
	*
	* Outputs:
	*   philambda - A 2-element containing the latitude and longitude
	*			   in radians.
	*
	* Returns:
	*   The function does not return a value.
	*
	* Remarks:
	*   The local variables Nf, nuf2, tf, and tf2 serve the same purpose as
	*   N, nu2, t, and t2 in mapLatLonToXY, but they are computed with respect
	*   to the footpoint latitude phif.
	*
	*   x1frac, x2frac, x2poly, x3poly, etc. are to enhance readability and
	*   to optimize computations.
	*
	*/
	mapXYToLatLon(x, y, lambda0){
		var phif, Nf, Nfpow, nuf2, ep2, tf, tf2, tf4, cf;
		var x1frac, x2frac, x3frac, x4frac, x5frac, x6frac, x7frac, x8frac;
		var x2poly, x3poly, x4poly, x5poly, x6poly, x7poly, x8poly;
		
		/* Get the value of phif, the footpoint latitude. */
		phif = this.footpointLatitude (y);
			
		/* Precalculate ep2 */
		ep2 = (Math.pow (this.sma, 2.0) - Math.pow (this.smb, 2.0))
		    / Math.pow (this.smb, 2.0);
			
		/* Precalculate cos (phif) */
		cf = Math.cos (phif);
			
		/* Precalculate nuf2 */
		nuf2 = ep2 * Math.pow (cf, 2.0);
			
		/* Precalculate Nf and initialize Nfpow */
		Nf = Math.pow (this.sma, 2.0) / (this.smb * Math.sqrt (1 + nuf2));
		Nfpow = Nf;
			
		/* Precalculate tf */
		tf = Math.tan (phif);
		tf2 = tf * tf;
		tf4 = tf2 * tf2;
		
		/* Precalculate fractional coefficients for x**n in the equations
		   below to simplify the expressions for latitude and longitude. */
		x1frac = 1.0 / (Nfpow * cf);
		
		Nfpow *= Nf;   /* now equals Nf**2) */
		x2frac = tf / (2.0 * Nfpow);
		
		Nfpow *= Nf;   /* now equals Nf**3) */
		x3frac = 1.0 / (6.0 * Nfpow * cf);
		
		Nfpow *= Nf;   /* now equals Nf**4) */
		x4frac = tf / (24.0 * Nfpow);
		
		Nfpow *= Nf;   /* now equals Nf**5) */
		x5frac = 1.0 / (120.0 * Nfpow * cf);
		
		Nfpow *= Nf;   /* now equals Nf**6) */
		x6frac = tf / (720.0 * Nfpow);
		
		Nfpow *= Nf;   /* now equals Nf**7) */
		x7frac = 1.0 / (5040.0 * Nfpow * cf);
		
		Nfpow *= Nf;   /* now equals Nf**8) */
		x8frac = tf / (40320.0 * Nfpow);
		
		/* Precalculate polynomial coefficients for x**n.
		   -- x**1 does not have a polynomial coefficient. */
		x2poly = -1.0 - nuf2;
		
		x3poly = -1.0 - 2 * tf2 - nuf2;
		
		x4poly = 5.0 + 3.0 * tf2 + 6.0 * nuf2 - 6.0 * tf2 * nuf2
			- 3.0 * (nuf2 *nuf2) - 9.0 * tf2 * (nuf2 * nuf2);
		
		x5poly = 5.0 + 28.0 * tf2 + 24.0 * tf4 + 6.0 * nuf2 + 8.0 * tf2 * nuf2;
		
		x6poly = -61.0 - 90.0 * tf2 - 45.0 * tf4 - 107.0 * nuf2
			+ 162.0 * tf2 * nuf2;
		
		x7poly = -61.0 - 662.0 * tf2 - 1320.0 * tf4 - 720.0 * (tf4 * tf2);
		
		x8poly = 1385.0 + 3633.0 * tf2 + 4095.0 * tf4 + 1575 * (tf4 * tf2);
		
		var result = new Array(2);
		/* Calculate latitude */
		result[0] = phif + x2frac * x2poly * (x * x)
			+ x4frac * x4poly * Math.pow (x, 4.0)
			+ x6frac * x6poly * Math.pow (x, 6.0)
			+ x8frac * x8poly * Math.pow (x, 8.0);
			
		/* Calculate longitude */
		result[1] = lambda0 + x1frac * x
			+ x3frac * x3poly * Math.pow (x, 3.0)
			+ x5frac * x5poly * Math.pow (x, 5.0)
			+ x7frac * x7poly * Math.pow (x, 7.0);
		return result;
	}

	/*
		* LatLonToUTMXY
		*
		* Converts a latitude/longitude pair to x and y coordinates in the
		* Universal Transverse Mercator projection.
		*
		* Inputs:
		*   lat - Latitude of the point, in radians.
		*   lon - Longitude of the point, in radians.
		*   zone - UTM zone to be used for calculating values for x and y.
		*		  If zone is less than 1 or greater than 60, the routine
		*		  will determine the appropriate zone from the value of lon.
		*
		* Outputs:
		*   xy - A 2-element array where the UTM x and y values will be stored.
		*
		* Returns:
		*   The UTM zone used for calculating the values of x and y.
		*
	*/
	fromLatLngToXY(latlng, altCM = null) {
		var zone = Math.floor ((latlng[1] + 180.0) / 6) + 1;
		var cm = (altCM === null) ? this.UTMCentralMeridian(zone) : this.degToRad(altCM);		
		var X = this.degToRad(latlng[0]);
		var Y = this.degToRad(latlng[1]);
		var xy = this.mapLatLonToXY(X, Y, cm);
		/* Adjust easting and northing for UTM system. */
		xy.x = xy.x * this.UTMScaleFactor + 500000.0;
		xy.y = xy.y * this.UTMScaleFactor;
		if (xy.y < 0.0)
			xy.y = xy.y + 10000000.0;
		xy.zone = zone;
		xy.southhemi =  (xy[1]<0)?true:false
		return xy;
	}

	/*
	* fromXYtoLatLng
	*
	* Converts x and y coordinates in the Universal Transverse Mercator
	* projection to a latitude/longitude pair.
	*
	* Inputs:
	*   x - The easting of the point, in meters.
	*   y - The northing of the point, in meters.
	*   zone - The UTM zone in which the point lies.
	*   southhemi - True if the point is in the southern hemisphere;
	*			   false otherwise.
	*
	* Outputs:
	*   latlon - A 2-element array containing the latitude and
	*			longitude of the point, in radians.
	*
	* Returns:
	*   The function does not return a value.
	*
	*/
	fromXYtoLatLng (source){
		var cmeridian;
		var x = source.x - 500000.0; 
		x /= this.UTMScaleFactor;
	   	var y = source.y;				
		/* If in southern hemisphere, adjust y accordingly. */
		if (source.southhemi)
			y -= 10000000.0;					
		y /= this.UTMScaleFactor;			
		cmeridian = this.UTMCentralMeridian(source.zone);
		var result = this.mapXYToLatLon(x, y, cmeridian);
		return [this.radToDeg(result[0]), this.radToDeg(result[1])];
	}

	/*
		Более простой и менее точный перевод
	*/

	/*
		Переводит прямоугольные координаты XY в широту и долготу
	*/
	fromXYtoLatLng2 (xy) {		
		var d = 180 / Math.PI,
		    r = 6378137,
		    tmp = 6356752.314245179 / r,
		    e = Math.sqrt(1 - tmp * tmp),
		    ts = Math.exp(-xy.y / r),
		    phi = Math.PI / 2 - 2 * Math.atan(ts);

		for (var i = 0, dphi = 0.1, con; i < 15 && Math.abs(dphi) > 1e-7; i++) {
			con = e * Math.sin(phi);
			con = Math.pow((1 - con) / (1 + con), e / 2);
			dphi = Math.PI / 2 - 2 * Math.atan(ts * con) - phi;
			phi += dphi;
		}
		return [phi * d, xy.x * d / r];
	}

	/*
		Переводит широту и долготу в прямоугольные координаты XY
	*/
	fromLatLngToXY2 (latlon) {		
		var d = Math.PI / 180,
		    r = 6378137,
		    y = latlon[0] * d,
		    tmp = 6356752.314245179 / r,
		    e = Math.sqrt(1 - tmp * tmp),
		    con = e * Math.sin(y);
		var ts = Math.tan(Math.PI / 4 - y / 2) / Math.pow((1 - con) / (1 + con), e / 2);
		y = -r * Math.log(Math.max(ts, 1E-10));		
		var result = {x: latlon[1] * d * r, y: y};
		return result;
	}

	convertToSphericalMercator(latlng){
		var 
			d = Math.PI / 180,
			max = 85.0511287798,
			lat = Math.max(Math.min(max, latlng[0]), -max),
			sin = Math.sin(lat * d),
			R = 6378137,
			xy = {x: null, y: null};
		xy.x = R * latlng[1] * d;
		xy.y = R * Math.log((1 + sin) / (1 - sin)) / 2;
		return xy;
	}

	convertFromSphericalMercator(xy){
		var
			d = Math.PI / 180,
			R = 6378137;
		return [
			(2 * Math.atan(Math.exp(xy.y / R)) - (Math.PI / 2)) * d,
			xy.x * d / R
		];
	}

	/*wgs84ToSK42(latlon){		
		let lat, lng, h = 0;
		lat = wgs84LatToSK42Lat(lat, )
	}

	sk42ToGaussKruger(sk42){
		//
	}*/

	/*
		Находит угол наклона отрезка, соединяющего точки start и end		
	*/
	getAngle2(start, end){		
		var 
			// переводим координаты в XY, возвращаем угол наклона
			startxy = this.fromLatLngToXY(start),
			endxy = this.fromLatLngToXY(end),
			result = null, cm = null;			
		// если зоны не совпадают, то переводим координаты через самодельную зону
		if (startxy.zone !== endxy.zone && Math.abs(startxy.zone - endxy.zone) === 1){
			cm = Math.floor((start[1]+end[1])/2);			
			startxy = this.fromLatLngToXY(start, cm);
			endxy = this.fromLatLngToXY(end, cm);			
		};		
		result = Math.atan2(endxy.y - startxy.y, endxy.x-startxy.x);
		return result;
	}

	getLineEquation(p1,p2){
		var equation = {a: null, b: null, c: null, zone: null, southhemi: null};
		equation.a = (p1.y - p2.y);
		equation.b = (p2.x - p1.x);
		equation.c = (p1.x*p2.y - p2.x*p1.y);
		// предполагается, что мы работаем с числами небольшого порядка и эти параметры можно передавать упрощённо
		equation.zone = p1.zone;
		equation.southhemi = p1.southhemi;
		return equation;
	}

	getLinesIntersection(l1, l2){
		var point = {x: null, y: null, k: null, zone: null, southhemi: null};
		point.x = -1 * ((l1.c*l2.b - l2.c*l1.b) / (l1.a*l2.b - l2.a*l1.b));
		point.y = -1 * ((l1.a*l2.c - l2.a*l1.c) / (l1.a*l2.b - l2.a*l1.b));
		// предполагается, что мы работаем с числами небольшого порядка и эти параметры можно передавать упрощённо
		point.zone = l1.zone;
		point.southhemi = l1.southhemi;
		return point;
	}

	compare(latlon1, latlon2){
		return (latlon1[0] === latlon2[0] && latlon1[1] === latlon2[1]);
	}

}
