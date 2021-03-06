(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/*
	Геозона, обозначаемая полигоном
*/
window.GeoZone = class GeoZone extends GeoObject{
	constructor(data, view, master){
		super(data, view, master);
		this.minimumNodes = 3;		
	}

	/*
		Строит четырёхугольную геозону вокруг полученной точки
	*/
	static calculate(initialPoint, dimension){
		var 
			ll = [],
			calc = GeoZoneManager.getCalculator(),
			center = null;
		center = calc.fromLatLngToXY(initialPoint);
		// заполняем массив клонами центра
		for (var i = 0; i < 4; i++){
			ll.push(JSON.parse(JSON.stringify(center)));
		}
		// изменяем координаты, чтобы получить прямоугольник
		ll[0].x = ll[0].x - dimension.width/2; ll[0].y = ll[0].y + dimension.height/2;
		ll[1].x = ll[1].x + dimension.width/2; ll[1].y = ll[1].y + dimension.height/2;
		ll[2].x = ll[2].x + dimension.width/2; ll[2].y = ll[2].y - dimension.height/2;
		ll[3].x = ll[3].x - dimension.width/2; ll[3].y = ll[3].y - dimension.height/2;
		// переводим в широту и долготу
		for (var i = 0; i < 4; i++){
			ll[i] = calc.fromXYtoLatLng(ll[i]);
		}
		/*ll.push(StaticMap.fromXYtoLatLng({x: center.x - dimension.width/2, y: center.y + dimension.height/2}));
		ll.push(StaticMap.fromXYtoLatLng({x: center.x + dimension.width/2, y: center.y + dimension.height/2}));
		ll.push(StaticMap.fromXYtoLatLng({x: center.x + dimension.width/2, y: center.y - dimension.height/2}));
		ll.push(StaticMap.fromXYtoLatLng({x: center.x - dimension.width/2, y: center.y - dimension.height/2}));	*/
		return ll;
	}

	static getDefaultDimension(){
		return {width: 50, height: 50};
	}

	splitBorder(index, coords){		
		this.latLngs.splice(index+1, 0, coords);
		this.isModified = true;
		if (this.view) this.view.splitBorder(index, coords);		
	}

	transpose(newCenter){
		const 
			oldCenter = this.getCenter(),
			delta = [newCenter[0] - oldCenter[0], newCenter[1]-oldCenter[1]],
			oldNodes = this.getLatLngs();
		let newNodes = oldNodes.map((latlon) => { return [latlon[0]+delta[0], latlon[1]+delta[1]] });
		this.setLatLngs(newNodes);
	}

	addChild(obj){		
		this.children.push(obj);
		obj.parent = this;
		if (this.view && obj.view){
			this.view.addChild(obj.view);
		}		
	}

}

/*
	Полигональный капитальный объект
*/
window.CapitalPlaneObject = class CapitalPlaneObject extends GeoZone{
	constructor(data, view, master){
		super(data, view, master);
	}
}

/*
	Пикет, обозначаемый полигоном; используется для деления дорог на участки
*/
window.Picket = class Picket extends GeoObject{
	constructor(data, view, master){
		super(data, view, master);
		this.minimumNodes = 6;		
	}	

	// производит рассчет и строит пикет по координатам, возвращает массив с координатами
	static calculate(segments, startsAt, length, width){		
		// вспомогательная функция для обсчета поворотов
		function getTurnPoint(i, deflection){
			let p1, p2, l1, l2;
			p1 = calc.forwardTaskXY(segments[i].start, segments[i].angle+deflection, width/2);
			p2 = calc.forwardTaskXY(segments[i].end, segments[i].angle+deflection, width/2);
			l1 = calc.getLineEquation(p1, p2);
			p1 = calc.forwardTaskXY(segments[i+1].start, segments[i+1].angle+deflection, width/2);
			p2 = calc.forwardTaskXY(segments[i+1].end, segments[i+1].angle+deflection, width/2);
			l2 = calc.getLineEquation(p1, p2);
			return calc.getLinesIntersection(l1,l2);
		}
		// угол поворота - 90 градусов в радианах
		const turn = 1.5708;
		let
			// калькулятор
			calc = GeoZoneManager.getCalculator(),
			// осевая точка (используется для прохождения поворотов)
			axialPoint = null,
			// массивы с точками полигона: перед, зад, левая и правая сторона (чтобы не путаться в индексах)
			rearSide = new Array(3),
			frontSide = new Array(3),
			leftSide = [],
			rightSide = [],
			// сегменты ЛО, на которых начинается и кончается пикет
			startSegment = null,			
			endSegment = null,
			// конечная отметка пикета
			endsAt = startsAt + length,
			// вспомогательная переменная для откладывания расстояний
			d = 0,
			// вспомогательная переменная для хранения промежуточных отметок расстояния
			mark = 0,
			// счетчик
			i = 0;
		// находим стартовый сегмент		
		while (!startSegment){			
			if (segments[i].startsAt <= startsAt && segments[i].endsAt > startsAt) startSegment = segments[i];
			i++;
		}
		// находим конечный сегмент, если пикет не влезает, обрезаем его
		i = 0;		
		while (!endSegment){
			if (segments[i].endsAt >= endsAt && segments[i].startsAt < endsAt) {
				endSegment = segments[i]
			} else if (i === segments.length-1 && endsAt < segments[i]) {
				endsAt = segments[i].endsAt;
				endSegment = segments[i];
			}
			i++;
		}		
		// строим задний торец пикета из 3 точек
		d = startsAt - startSegment.startsAt;
		// центральная (осевая) точка
		rearSide[1] = calc.forwardTaskXY(startSegment.start, startSegment.angle, d);
		axialPoint = rearSide[1];
		// точки справа и слева
		rearSide[0] = calc.forwardTaskXY(rearSide[1], startSegment.angle-turn, width/2);
		rearSide[2] = calc.forwardTaskXY(rearSide[1], startSegment.angle+turn, width/2);

		// проходим повороты
		// запоминаем полную длину пикета
		// !т.к. пикет может не влезать в размечаемую область, то endsAt-startsAt не обязательно равно length		
		d = endsAt - startsAt;		
		if (startSegment.index !== endSegment.index){
			// задаём временную отметку расстояния - точку отсчета
			mark = startsAt;
			// перебираем сегменты, через стыки между которыми проходит пикет
			for (i = startSegment.index; i < endSegment.index; i++){
				// если углы сегментов разные, вычисляем точки на поворотах, если одинаковые, то все чуть проще
				// !!! i+1
				if (segments[i].angle !== segments[i+1].angle){
					// левая сторона				
					leftSide.push(getTurnPoint(i, turn));
					// правая сторона
					rightSide.push(getTurnPoint(i, turn*-1));	
				} else {
					leftSide.push(calc.forwardTaskXY(segments[i].end, segments[i].angle+turn, width/2));
					rightSide.push(calc.forwardTaskXY(segments[i].end, segments[i].angle-turn, width/2));
				}
				// отнимаем от длины пройденное после очередного стыка расстояние
				d -= (segments[i].endsAt - mark);
				// сдвигаем точку отсчёта для следующей итерации
				mark = segments[i].endsAt;
				axialPoint = segments[i].end;
			}
		}		
		// строим передний торец
		// осевая точка
		// если поворотов не было, то d равняется длине пикета (возможно урезаной)
		// если повороты были, то d уменьшено
		frontSide[1] = calc.forwardTaskXY(axialPoint, endSegment.angle, d);
		// точки слева и справа
		frontSide[0] = calc.forwardTaskXY(frontSide[1], endSegment.angle+turn, width/2);
		frontSide[2] = calc.forwardTaskXY(frontSide[1], endSegment.angle-turn, width/2);
		/*let 
			frontSide1 = frontSide.map((node)=>{return calc.fromXYtoLatLng(node)}), 
			rearSide1 = rearSide.map((node)=>{return calc.fromXYtoLatLng(node)}), 
			leftSide1 = leftSide.map((node)=>{return calc.fromXYtoLatLng(node)}), 
			rightSide1 = rightSide.map((node)=>{return calc.fromXYtoLatLng(node)});
		console.log('--------------------');
		console.log(rearSide1.toString());
		console.log(frontSide1.toString());
		console.log(leftSide1.toString());
		console.log(rightSide1.toString());*/
		// склеиваем стороны (правую разворачиваем, ведь по сути мы пушили в неё точки наоборот)
		let res = rearSide.concat(leftSide, frontSide,  rightSide.reverse());
		// переводим результат в широту и долготу
		return res.map((node)=>{return calc.fromXYtoLatLng(node)});

	}

	/* Пикет нельзя редактировать стандартными способами, поэтому методы редактирования выключены (кроме перезаписи координат)*/
	moveNodeTo(index, coords){}
	removeNode(index){}
	pushPoint(ll){}
	addNode(index, coords){}
}

/*
	Окружность
*/
window.CircleObject = class CircleObject extends GeoObject{
	constructor(data, view, master){
		super(data, view, master);
		this.minimumNodes = 1;
		this.center = data.center;
		this.radius = data.radius;
		this.latLngs = [this.radius];
	}

	getLatLngs(){
		return this.latLngs;
	}

	setRadius(newRadius){		
		this.radius = newRadius;
		this.isModified = true;
		if (this.view) this.view.setRadius(newRadius);

	}

	setCenter(newCenter){
		this.center = newCenter;
		this.isModified = true;
		if (this.view) this.view.setCenter(newCenter);
	}

	transpose(newCenter){
		this.setCenter(newCenter);
	}

	// у окружностей не работает
	setLatLngs(ll){}

	moveNodeTo(index, coords){}

	removeNode(index){}

	pushPoint(ll){}

	addNode(index, coords){}

	getBounds(){}

	getCenter(){		
		return this.center;
	}

	getRadius(){
		return this.radius;
	}

	isComplete(){
		return (this.getLatLngs().length >= this.minimumNodes);
	}

	static getDefaultRadius(){ return 5000; }

	//-------------------
}

/*
	Круглая геозона
*/
window.CircleGeoZone = class CircleGeoZone extends CircleObject{
	constructor(data, view, master){
		super(data, view, master);
	}
}

/*
	Регион - очень большая нередактируемая геозона
*/
window.Region = class Region extends GeoZone{
	constructor(data, view, master){
		super(data, view, master);
	}
}

/*
	Линейный объект, обозначаемый ломаной линией
*/
window.LinearObject = class LinearObject extends GeoObject{
	constructor(data, view, master){
		super(data, view, master);
		this.minimumNodes = 2;
	}

	splitBorder(index, coords){
		this.latLngs.splice(index, 0, coords);
		this.isModified = true;
		if (this.view) this.view.splitBorder(index, coords);
	}
}

/*
	Дорога, обозначаемая ломаной. Дробится на пикеты
*/
window.Road = class Road extends LinearObject{
	constructor(data, view, master){
		super(data, view, master);
	}
}

/*
	Маршрут, соединяющий контрольные точки
*/
window.SimpleRoute = class SimpleRoute extends LinearObject{
	constructor(data, view, master){
		super(data, view, master);
	}
}

/*
	Маршрут, соединяющий контрольные точки
*/
window.FactRoute = class FactRoute extends SimpleRoute{
	constructor(data, view, master){
		super(data, view, master);
		// данный объект является временным и его не надо сохранять в базу
		this.isDummy = true;
	}
}

window.PlannedRoute = class PlannedRoute extends SimpleRoute{
	constructor(data, view, master){
		super(data, view, master);
		// данный объект является временным и его не надо сохранять в базу
		this.isDummy = true;
	}
}


/*
	Точечный объект, обозначаемый маркером
*/
window.PointObject = class PointObject extends GeoObject{
	constructor(data, view, master){
		super(data, view, master);
		this.minimumNodes = 1;
	}	

	pushPoint(ll){
		this.latLngs = [ll];
		if (this.view) this.view.pushPoint(ll);
	}
}

/*
	Точечный капитальный объект
*/
window.CapitalPointObject = class CapitalPointObject extends PointObject{
	constructor(){
		super();
	}
}
},{}],2:[function(require,module,exports){
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

},{}],3:[function(require,module,exports){
/*
	Абстрактный геообъект
*/
window.GeoObject = class GeoObject extends SmartObject{

	constructor(data, view, master){
		super();
		// ссылка на управляющий объект
		this.master = master;
		// визуальная часть
		this.view = view;
		// внутренний id (readonly)
		Object.defineProperty(this, 'objectID', {value: data.objectID, writable: false});
		// uuid объекта в БД
		this.uuid = data.uuid || null;
		// ID родительского объекта
		this.parentID = data.parentID || null;
		// дочерние объекты
		this.children = [];		
		//this.children = data.children ? JSON.parse(JSON.stringify(data.children)) : [];
		// уровень объекта в иерархии
		this.level = 1;
		// координаты точек, формирующих контур объекта
		this.latLngs = data.nodes || [];
		// свойства объекта (поля и значения)
		this.props = data.props || {};		
		// минимальное кол-во вершин для отображения
		this.minimumNodes = 0;
		// изменён объект или нет
		this.isModified = false;
		// поле, показывающее, что данный объект является временным и его не надо сохранять в базу
		this.isDummy = false;
		// если у объекта есть визуальная часть, то подписываемся на её события
		if (this.view){
			var self = this;
			// развыбирание объекта на карте
			this.view.addListener('unselectView', function(context){
				self.master.fire('staticObjectUnselect', context);
			});
			// скрытие объекта
			this.view.addListener('hideView', function(context){
				self.master.fire('staticObjectHide', context);
			});
		}
	}

	getLatLngs(){
		return this.latLngs;
	}

	setLatLngs(ll){
		this.latLngs = ll;
		this.isModified = true;
		if (this.view) this.view.setLatLngs(ll);
	}

	moveNodeTo(index, coords){
		this.latLngs[index] = coords;
		this.isModified = true;
		if (this.view) this.view.moveNodeTo(index, coords);
	}

	removeNode(index){
		this.latLngs.splice(index, 1);
		this.isModified = true;
		if (this.view) this.view.removeNode(index);		
	}

	pushPoint(ll){
		this.latLngs.push(ll);
		this.isModified = true;
		if (this.view) this.view.pushPoint(ll);	
	}

	addNode(index, coords){
		this.latLngs.splice(index, 0, coords);
		this.isModified = false;
		if (this.view) this.view.addNode(index, coords);	
	}	

	getBounds(){}

	getCenter(){		
		return this.master.map.staticObjects[this.objectID].getCenter();
	}

	isComplete(){
		return (this.getLatLngs().length >= this.minimumNodes);
	}

	getConvertedData(){
		let children = this.children.map(function(item){return item.getConvertedData()});		
		let res = {
			className: this.getClassName(),
			objectID: this.objectID,
			nodes: this.latLngs.slice(),
			uuid: this.uuid,
			parentUUID: this.parent ? this.parent.uuid : null,
			parentObjectID: this.parent ? this.parent.objectID : null,
			children: children,
			groupID: this.group ? this.group.objectID : null,
			isComplete: this.isComplete()
		};
		return res;
	}	
}
},{}],4:[function(require,module,exports){
/*
	Класс, отвечающий за манипулирование геообъектами;
	Управляющий объект, который эксплуатирует пользователь скрипта.
	Хранит ссылки на геообъекты.
*/
window.GeoZoneManager = class GeoZoneManager extends SmartObject{

	constructor(){
		super();
		// хэш, хранящий статические объекты
		this.staticObjects = {};
		// перечень объектов, записанных в бд (имеющих uuid)
		this.confirmedObjects = {};		
		// карта-болванка, заменяется через метод plugMap
		this.map = new StaticMap('');
		// слоты для обращения к карте, редактору и мониторингу
		this.staticMap = {};
		this.editor = {};
		this.monitoring = {};
		this.calculator = new Calculator();
	}


	
	/*
		Создает и выкладывает на карту 1 статический объект
	*/
	deployObject(className, data){		
		var view = null;
		// генерируем новый objectID, если он отсутствует
		// (это нужно для перехода со старой версии, где не было разделения на objectID и uuid)		
		if (!data.objectID){
			data.objectID = this.getNewID();
		}
		// если объект развертывается из бд, то пишем его в подтверждённые
		if (data.uuid){
			this.confirmedObjects[data.objectID] = data.uuid;
		}
		if (className !== 'Group'){
			view = this.map.addComplexObject(className, data);
			this.staticObjects[data.objectID] = eval('new '+className+'(data, view, this)');
			if (data.parentUUID || data.parentObjectID){
				let parentObjectID = data.parentObjectID || this.getObjectIDbyUUID(data.parentUUID);
				if (this.staticObjects[parentObjectID]){
					this.staticObjects[parentObjectID].addChild(this.staticObjects[data.objectID]);
				} else {
					// если родитель указан, но отсутствует, кидаем ошибку
					this.fire('invalidparent', {parentUUID: data.parentUUID, parentObjectID: data.parentObjectID});
				}
			}
		} else {			
 			let deployData = JSON.parse(JSON.stringify(data));
 			deployData.children = [];
			for (var i = 0; i < data.children.length; i++){				
				deployData.children.push(this.staticObjects[data.children[i]]);
			}

			view = this.map.addComplexObject('MGroup', data);
			this.staticObjects[data.objectID] = new Group(deployData, view, this);			
		}
		// кидаем событие о добавлении объекта, в котором передаём ссылку на выложенный объект
		this.fire('staticObjectDeploy', {link: this.staticObjects[data.objectID]});
	}	

	/*
		Создает и выкладывает на карту группу статических объектов
	*/
	deployObjects(data){
		// функция для рекурсивного выкладывания на карту вложенных геозон
			
		self = this;
		if ('geoZones' in data){
			function deployGeoZone(gz){
				let objectID = null, parentObjectID = null, parentUUID = null;
				// проверяем есть ли такой объект
				// находим его objectID
				objectID = gz.objectID || self.getObjectIDbyUUID(gz.uuid);
				// если такой объект уже есть, дальше не идём
				if (!self.staticObjects[objectID]){
					// если у ГЗ указан родитель, проверяем, добавлен ли он
					parentUUID = gz.parentUUID;
					parentObjectID = gz.parentObjectID || self.getObjectIDbyUUID(parentUUID);
					// если родитель указан, но отсутствует, перебираем все геозоны, ищем родителя текущей и выкладываем его					
					if ((gz.parentUUID || parentObjectID) && !self.staticObjects[parentObjectID]){
						let i = 0;
						while (i < data['geoZones'].length && !self.staticObjects[parentObjectID]){
							if (data['geoZones'][i].uuid === parentUUID || data['geoZones'][i].objectID === parentObjectID){
								deployGeoZone(data['geoZones'][i]);
							}
							i++;
						}											
					}
					// после того, как родитель добавлен (если он был), выкладываем сам объект
					self.deployObject('GeoZone', gz);
				}				
			}

			data['geoZones'].forEach(function(gz){
				//self.deployObject('GeoZone', gz);
				deployGeoZone(gz);
			});
		}
		if ('regions' in data){
			data['regions'].forEach(function(reg){
				self.deployObject('Region', reg);				
			});
		}
		if ('capitalPlaneObjects' in data){
			data['capitalPlaneObjects'].forEach(function(obj){
				self.deployObject('CapitalPlaneObject', obj);				
			});
		}
		if ('plannedRoutes' in data){
			data['plannedRoutes'].forEach(function(obj){
				self.deployObject('PlannedRoute', obj);				
			});
		}	
		if ('factRoutes' in data){
			data['factRoutes'].forEach(function(obj){
				self.deployObject('FactRoute', obj);				
			});
		}		
	}

	/*
		Удаляет статический объект по ID
	*/
	deleteStaticObject(ID){		
		// кидаем событие об удалении объекта
		this.fire('staticObjectDelete', {objectID: ID});
		//Перебираем чилдренов объекта, рекурсивно удаляем их
		for (var i = 0; i < this.staticObjects[ID].children.length; i++){
			this.deleteStaticObject(this.staticObjects[ID].children[i].objectID);
		}
		this.children = [];
		// Удаляем объект из списков ГЗМа
		this.staticObjects[ID] = null;
	}

	disbandGroup(objectID){
		this.staticObjects[objectID].disband();
		this.map.disbandGroup(objectID);
		this.staticObjects[objectID] = null;
	}

	/*
		Генератор uuid, используемых редактором; ID объекта в бд редактор не использует.
	*/
	getNewID() {
		var d = new Date().getTime();
		var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
			var r = (d + Math.random()*16)%16 | 0;
			d = Math.floor(d/16);
			return (c=='x' ? r : (r&0x3|0x8)).toString(16);
		});
		return uuid;
	};

	/*
		Задает uuid статического объекта, если он ещё не задан
	*/
	setUUID(objectID, uuid){
		if (this.staticObjects[objectID] && !this.staticObjects[objectID].uuid){
			this.staticObjects[objectID].uuid = uuid;
			// записывает объект в подтверждённые
			this.confirmedObjects[objectID] = uuid;
		}
	}

	/*
		Массовое задание uuid'ов
	*/
	setUUIDs(data){
		for (let objectID in data){
			this.setUUID(objectID, data[objectID]);
		}
	}

	/*
		Возвращает objectID по uuid
	*/
	getObjectIDbyUUID(uuid){
		var id = null;
		for (var key in this.staticObjects){
			if (this.staticObjects[key].uuid === uuid) {
				id = key;
			}
		}
		return id;
	}

	/*
		Возвращает uuid по objectID
	*/
	getUUIDbyObjectID(objectID){
		var u = null;
		if (this.staticObjects[objectID] && this.staticObjects[objectID].uuid){
			u = this.staticObjects[objectID].uuid;
		}
		return u;
	}

	/*
		Возвращает хэш с соответствием всех ID'шников в обе стороны
	*/
	getIDMap(){
		var res = {
			uuid: {},
			objectID: {}
		};
		for (var objectID in this.staticObjects){
			res.objectID[objectID] = this.staticObjects[objectID].uuid || null;
			if (this.staticObjects[objectID].uuid){
				res.uuid[this.staticObjects[objectID].uuid] = objectID;
			}
		}
		return res;
	}

	deleteObject(id){}

	deleteObjects(ids){}

	deleteSelectedObjects(){
		this.deleteObjects(this.map.getSelectedObjects());
	}

	/*
		Выбирает целевой объект на карте по id, zoomIn - подгонять ли карту по размерам объекта при выделении
	*/
	selectObject(objectID, zoomIn){
		this.map.selectObject(objectID);
	}

	/*
		Дает карте команду сбросить выделение со всех объектов
	*/
	unfocus(){}

	freeze(){
		// убираем обработчики клика по карте, мы больше не получаем данные от кликов
		this.map.clearListeners('mapClick');
		// даем карте команду на выход из режима редактирования
		this.map.freeze();
	}	

	/*
		Возвращает true, если объект с id == child можно включить в объект с id == parent
	*/
	canInclude(parentID, child){
		var res = false;		
		if (this.staticObjects[parentID].getClassName() == 'GeoZone' && this.staticObjects[child].getClassName() == 'GeoZone') res = true;		
		return res;
	}

	/*
		Подключение карты и навешивание обработчиков
	*/
	plugMap(map){
		if (['Leaflet'].indexOf(map.getPlatform()) >= 0){
			this.map = map;
			var self = this;			
			// обработка перезаписи координат объекта
			this.addListener('latLngChange', function(context){
				this.map.staticObjects[context.objectID].setLatLngs(context.coords);
			});
			// обработка удаления вершины объекта
			this.addListener('removeNode', function(context){				
				this.map.staticObjects[context.objectID].removeNode(context.index);
			});
			// обработка перемещения вершины объекта
			this.addListener('moveNode', function(context){				
				this.map.staticObjects[context.objectID].moveNodeTo(context.index, context.coords);
			});			
			// обработка перемещения вершины объекта
			this.addListener('staticObjectDelete', function(context){
				this.map.eraseStaticObject(context.objectID);
			});
			// обработка перемещения вершины объекта
			this.addListener('pushPoint', function(context){				
				this.map.staticObjects[context.objectID].pushPoint(context.coords);
			});
			// обработка расщепления границы
			this.addListener('splitBorder', function(context){
				this.map.staticObjects[context.objectID].splitBorder(context.index, context.coords);
			});
			// обработка добавления точки в произвольную позицию
			this.addListener('addNode', function(context){
				this.map.staticObjects[context.objectID].addNode(context.index, context.coords);
			});
			// изменение радиуса окружности
			this.addListener('changeRadius', function(context){				
				this.map.staticObjects[context.objectID].setRadius(context.newRadius);
			});
			// перемещение центра окружности
			this.addListener('changeCenter', function(context){
				this.map.staticObjects[context.objectID].setCenter(context.newCenter);
			});
			// события карты, отправляемые наружу
			// перемещение курсора
			this.map.addListener('mousemove', function(context){
				self.fire('mapCursorMove', context);
			});
			// выбор объекта
			this.map.addListener('select', function(context){
				self.fire('mapSelect', context);
			});			
			// развыбор объекта
			this.map.addListener('unselect', function(context){
				self.fire('mapUnselect', context);
			});
			// нанесение разметки для разбивки линейных объектов
			// один маркер поставлен
			this.map.addListener('markPlaced', function(context){
				self.fire('markPlaced', context);
			});
			// разметка нанесена
			this.map.addListener('markupComplete', function(context){
				self.fire('markupComplete', context);
			});
		}
	}

	plugEditor(editor){
		this.editor = editor;
		this.editor.master = this;
		var self = this;
		// обработка визуального растягивания объекта на карте
		this.map.addListener('moveNodeVisual', function(context){			
			self.editor.moveNodeVisual(context);
		});
		this.map.addListener('radiusChange', function(context){			
			self.editor.radiusChange(context);
		});
		// обработка директивного растягивания через плашку
		this.map.addListener('moveNodeDirect', function(context){			
			self.editor.moveNodeDirect(context);
		});
		// обработка директивного удаления через плашку
		this.map.addListener('removeNode', function(context){		
			self.editor.removeNode(context);
		});
		// обработка расщепления границы
		this.map.addListener('splitBorderVisual', function(context){			
			self.editor.splitBorderVisual(context);
		});
		this.map.addListener('objectDragEnd', function(context){
			self.editor.transpose(context);
		});
	}

	plugMonitor(monitor){
		this.monitor = monitor;
	}

	/*
		Переводит прямоугольные координаты в широту и долготу
	*/
	xyToLatLng(xy){}

	/*
		Переводит широту и долготу в прямоугольные координаты
	*/
	latLngToXY(ll){}

	/*
		Возвращает копию объекта source
	*/
	cloneObject(source){}

	isMajorObject(id){}

	/*
		Подгоняет зум карты, центрируя её на координатах latlng и задавая радиус охвата в километрах;
		Вызов перенаправляется к карте, возможен вызов без параметров, в этом случае центровка карты производится по статическим объектам на ней.
	*/
	fitMap(latlng, radius){
		if (latlng){			
			this.map.setView(latlng, radius);
		} else {
			this.map.fitByObjects();
		}
		
	}

	/*
		Проверяет объект obj на конфликты с другими объектами на карте
	*/
	noConflicts(obj){}

	/*
		Кидает ошибку
	*/
	throwError(errorName, context){}

	placeMarker(coords){
		var point = coords.split(',');
		point[0] = parseFloat(point[0], 6);
		point[1] = parseFloat(point[1], 6);
		this.map.createMarker1(point);
	}

	static getCalculator(){
		return new Calculator();
	}
}
},{}],5:[function(require,module,exports){
window.Group = class Group extends GeoObject{

	constructor(data, master){		
		super(data, master);
		// у группы нет координат
		this.latLngs = [];
		this.children = data.children;
		for (var i = 0; i < this.children; i++){
			this.children[i].group = this;
		}
	}

	/*
		Расформировывает группу без удаления чилдренов
	*/
	disband(){
		for (var i = 0; i < this.children.length; i++){
			this.children[i].group = null;
		}
		this.children = [];		
	}

	// будет доработан
	getBounds(){}

	getCenter(){		
		return [];
	}

	isComplete(){
		return true;
	}	

	/*
		У группы нет собственной видимой части, поэтому
			нет координат;
			нельзя добавлять/удалять точки;			
	*/

	getLatLngs(){return this.latLngs;}
	setLatLngs(ll){}
	moveNodeTo(index, coords){}
	removeNode(index){}
	pushPoint(ll){}
	addNode(index, coords){}
}
},{}],6:[function(require,module,exports){
window.GzmBounds = class GzmBounds {

	constructor(source){		
		let raw = this.fromNative(source);		
		this._north = raw.north;
		this._east = raw.east;
		this._south = raw.south;
		this._west = raw.west;
	}

	// конвертирует исходные нативные границы (подлежит переопределению)
	fromNative(source){
		return {
			north: null,
			south: null,
			east: null,
			west: null
		};
	}

	// возвращает платформенно-зависимый объект границ, построенный из общего (подлежит переопределению)
	toNative(){
		return null;
	}	

	// манипуляции с объектом
	// возвращает другие границы, полученные путём объединения с другими (либо с одним объектом, либо с массивом)
	unite(anotherBounds){
		let
			n = Math.max(anotherBounds.getNorth(), this._north),
			e = Math.max(anotherBounds.getEast(), this._east),
			s = Math.min(anotherBounds.getSouth(), this._south),
			w = Math.min(anotherBounds.getWest(), this._west),
			arg = [n, e, s, w];		
		return eval('new '+this.constructor.name+'(arg)');
	}

	// возвращает границы, полученные путем дополнения текущих границ точкой
	extend(coords){
		let
			s = Math.min(coords[0], this._south),
			n = Math.max(coords[0], this._north),
			e = Math.max(coords[1], this._east),
			w = Math.min(coords[1], this._west),
			arg = [n, e, s, w];
		return eval('new '+this.constructor.name+'(arg)');
	}

	// возвращает увеличенные на num % границы
	broadenBy(num){
		let
			bufHeight = Math.abs(this._south - this._north) * num,
			bufWidth = Math.abs(this._west - this._east) * num,
			n = this._north + bufHeight,
			e = this._east + bufWidth,
			s = this._south - bufHeight,
			w = this._west - bufWidth;arg = [n, e, s, w];
		return eval('new '+this.constructor.name+'(arg)');
	}

	// проверки
	// проверка на попадание точки в границы
	contains(coords){
		return (coords[0] >= this._south) && (coords[0] <= this._norths) && 
			   (coords[1] >= this._west) && (coords[1] <= this.east);
	}

	includes(bounds){
		return (this._north >= bounds.getNorth() && this._east >= bounds.getEast() && this._south <= bounds.getSouth() && this._west <= bounds.getWest());
	}

	// проверка на пересечение
	intersects(bounds){
		let
			latIntersects = (bounds._north >= this._south) && (bounds._south <= this._north),
			lngIntersects = (bounds._east >= this._west) && (bounds._west <= this._east);
		return latIntersects && lngIntersects;
	}

	// проверка на перекрывание
	overlaps(bounds){
		let
			latOverlaps = (bounds._north > this._south) && (bounds._south < this._north),
			lngOverlaps = (bounds._east > this._west) && (bounds._west < this._east);
		return latOverlaps && lngOverlaps;
	}

	// проверка на совпадение
	equals(bounds){
		return (bounds._north === this._north) && (bounds._east === this._east) && (bounds._south === this._south) && (bounds._west === this._west);
	}

	// получение координат границ по сторонам света
	getSouth(){
		return this._south;
	}

	getNorth(){
		return this._north;
	}

	getWest(){
		return this._west;
	}

	getEast(){
		return this._east;
	}

	getSouthWest(){
		return this._south && this._west ? [this._south, this._west] : null;
	}

	getNorthWest(){
		return this._north && this._west ? [this._north, this._west] : null;
	}

	getSouthEast(){
		return this._south && this._east ? [this._south, this._east] : null;
	}

	getNorthEast(){
		return this._north, this._east ? [this._north, this._east] : null;
	}

	// центр
	getCenter(){
		return [(this._north + this._south) / 2, (this._west + this._east) / 2 ];
	}
}
},{}],7:[function(require,module,exports){
/*
	Класс, умеющий подписываться на события и реагировать на них.
*/
window.SmartObject = class SmartObject{
	constructor(){
		// обработчики событий; по ключу, содержащему имя события мы получаем доступ к массиву коллбэков
		this.handlers = {};		
	}

	/* 
		подписка на событие 
	*/
	addListener(event, callback){
		if (!(event in this.handlers)){		
			this.handlers[event] = [];
		}
		this.handlers[event].push(callback);
	}

	/*
		Удаляет все обработчики заданного события
	*/
	clearListeners(event){
		this.handlers[event] = [];
	}

	/*
		вызов события
	*/
	fire(event, data){
		// если объект подписан на событие
		if (event in this.handlers){			
			// перебираем коллбэки в массиве и вызываем их, передавая контекст и данные из события
			for(var i = 0; i < this.handlers[event].length; i++){
				this.handlers[event][i].call(this, data);
			}
		}
	}

	/*
		Возвращает имя класса
	*/
	getClassName(){
		return this.constructor.name;
	}

	/*
		Метод, в котором объект подписывается на большую часть событий
	*/
	subscribe(){}
}
},{}],8:[function(require,module,exports){
/*
	Абстрактный класс, отвечающий за статическую карту
*/
window.StaticMap = class StaticMap extends SmartObject{	

	constructor(container){
		super();		
		// платформа, на которой реализована карта
		this.platform = 'Dummy';		
		// если есть контейнер, цепляем его DOM-элемент
		if (document){
			this.container = document.getElementById(container);
		} else this.container = null;
		// ID выделенных объектов
		this.selectedStaticObjects = [];
		this.selectedDynamicObjects = [];
		// хэш для статических объектов (геозоны, дороги и т.д.)
		this.staticObjects = {};
		// хэш для динамически отслеживаемых объектов
		this.dynamicObjects = {};
		// хэш для примитивных объектов (полигоны, линии, маркеры)
		this.primitives = {};
		// переменная для генерации ID новых примитивов		
		this.primitivesCounter = 0;		
		// центр карты по умолчанию
		this.defaultCenter = [66.78889,93.77528];		
		// зум по умолчанию
		this.defaultZoom = 3;
		this.tilesUrl = 'http://Dummymaphasnotiles';
		// положение курсора
		this.cursorLocation = [null, null];
		// радиус обозреваемой области
		this.areaRadius = null;
		// центр обозреваемой области
		this.areaCenter = null;
		this.calculator = GeoZoneManager.getCalculator();
		this.subscribe();
	}

	/*
		Статический метод, возвращающий коллекцию стилей объектов
	*/
	static getStyleCollection(){
		return {
			markers: {
				defaultMarker: {icon: 'fa fa-map-marker', className: 'gzmBaloon', pattern: 'baloon', color: '#FF5252'},				
				defaultStretcher: {icon: 'fa fa-circle', className: 'gzmStretcher', pattern: 'symmetric', color: '#2196F3'},
				directionArrow: {icon: 'fa fa-arrow-right', className: 'gzmArrow', pattern: 'arrow'}
			},
			ghostArea: {
				solid:       {color: '#B71C1C', opacity: 0.3, borderWeight: 0}, 
				transparent: {color: '#000000', opacity: 0, borderWeight: 0}
			},
			markedArea : {
				line:   {color: '#8A2BE2', weight: 4, opacity: 0, dashArray: null},
				marker: {icon: 'fa fa-map-marker', className: 'gzmBaloon', pattern: 'baloon', color: '#8A2BE2'},
			},
			popups:{
				popupOffsets: {
					smallOffset: {offset: {x: 0, y: -5}},
					bigOffset: {offset: {x: 0, y: -30}}
				}
			},
			routes: {
				factRoute: {
					common:   {color: '#B71C1C', weight: 4, opacity: 0, dashArray: null},
					selected: {color: '#F44336', weight: 4, opacity: 0, dashArray: null}
				},
				plannedRoute: {color: '#008000', weight: 4, opacity: 0, dashArray: null}
			},
			road: {color: '#FFFF00', weight: 4, opacity: 0, dashArray: null},
			geoZone: {
				defaultGeoZone: {
					common:   {color: '#EF5350', opacity: 0.5, borderWeight: 0},
					selected: {color: '#D32F2F', opacity: 0.5, borderWeight: 0}
					/*
					common:   {color: '#2196F3', opacity: 0.5, borderWeight: 0},
					selected: {color: '#3949AB', opacity: 0.5, borderWeight: 0}
					*/
				},
				weight:
					[
						{common: {color: '#EF5350', opacity: 0.5, borderWeight: 0}, selected: {color: '#D32F2F', opacity: 0.5, borderWeight: 0}}, // 0 красная
						{common: {color: '#42A5F5', opacity: 0.5, borderWeight: 0}, selected: {color: '#1976D2', opacity: 0.5, borderWeight: 0}}, // 1 синяя
						{common: {color: '#FFA726', opacity: 0.5, borderWeight: 0}, selected: {color: '#F57C00', opacity: 0.5, borderWeight: 0}}, // 2 оранжевая
						{common: {color: '#AB47BC', opacity: 0.5, borderWeight: 0}, selected: {color: '#7B1FA2', opacity: 0.5, borderWeight: 0}}, // 3 фиолетовая

						{common: {color: '#2196F3', opacity: 0.5, borderWeight: 0}, selected: {color: '#3949AB', opacity: 0.5, borderWeight: 0}}, // 4
						{common: {color: '#2196F3', opacity: 0.5, borderWeight: 0}, selected: {color: '#3949AB', opacity: 0.5, borderWeight: 0}}, // 5
						{common: {color: '#2196F3', opacity: 0.5, borderWeight: 0}, selected: {color: '#3949AB', opacity: 0.5, borderWeight: 0}} // 6
					]				
			},
			region: {
				defaultRegion: {color: '#616161', opacity: 0.1, borderWeight: 1, borderColor: '#000000'}
			},
			capitalPlaneObject: {
				common:   {color: '#616161', opacity: 0.8, borderWeight: 1, borderColor: '#FFFFFF'},
				selected: {color: '#212121', opacity: 0.8, borderWeight: 1, borderColor: '#FFFFFF'}
			},
			circle: {
				default: {
					common:   {color: '#2196F3', opacity: 0.5, borderWeight: 0, borderColor: '#000000', dashArray: '5, 10'},
					selected: {color: '#3949AB', opacity: 0.5, borderWeight: 0, borderColor: '#000000', dashArray: '5, 10'}
				},
				interactive: {
					common:   {color: '#2196F3', opacity: 0.5, borderWeight: 1, borderColor: '#000000', dashArray: '5, 10'},
					selected: {color: '#3949AB', opacity: 0.5, borderWeight: 5, borderColor: '#B71C1C',  dashArray: null}
				}
			},
			/*
			picketStyle: {fillColor: 'yellow', fillOpacity: 0.8, color: 'black', weight: 1, strokeOpacity: 1},			
			chosenPicketStyle: {fillColor: 'orange', fillOpacity: 0.8, color: 'black', weight: 1, strokeOpacity: 1},
			*/
			picket: {
				common:   {color: '#FFFF00', opacity: 0.8, borderWeight: 1, borderColor: '#000000'},
				selected: {color: '#FFA500', opacity: 0.8, borderWeight: 1, borderColor: '#000000'}
			},
			defaultBorder: {color: '#B71C1C', weight: 5, opacity: 0, dashArray: null},
			dottedBorder:  {color: '#B71C1C', weight: 5, opacity: 0, dashArray: '5, 10'},
			label: {
				align: {
					hor: {
						left: 0, 
						center: 1, 
						right: 2
					},
					vert: {
						top: 0, 
						middle: 1, 
						bottom: 2
					}					
				},				
				picketLabel: {},
				geoZoneLabel: {},
				defaultLabel: {}
			},
			dynamicObjects: {
				default: {
					common: {
						marker: {icon: 'fa fa-circle fa-3x', className: 'gzmDynamic', pattern: 'dynamic', color: '#000000'},
						label: {text: 'color: #000000; font-size: 14px; font-weight: normal;', align: [1,0]},
					},
					selected: {
						marker: {icon: 'fa fa-circle fa-3x', className: 'gzmDynamic', pattern: 'dynamic', color: '#FF0000'},
						label: {text: 'color: #000000; font-size: 14px; font-weight: bold;', align: [1,0]}
					}

				},
				truck: {
					common: {
						marker: {icon: 'fa fa-truck fa-3x', className: 'gzmDynamic', pattern: 'dynamic', color: '#000000'},
						label: {text: 'color: #000000; font-size: 14px; font-weight: normal;', align: [1,0]},
					},
					selected: {
						marker: {icon: 'fa fa-truck fa-3x', className: 'gzmDynamic', pattern: 'dynamic', color: '#FF0000'},
						label: {text: 'color: #000000; font-size: 14px; font-weight: bold;', align: [1,0]}
					}

				}
			}
		}
	}

	static getStyleForObject(obj){
		var 
			style = {},
			collection = StaticMap.getStyleCollection();
		switch (obj.getClassName()) {
			case 'MGeoZone':
				let 
					weight = obj.weight <= 6 ? obj.weight : 6,
					selector = obj.isSelected ? 'selected' : 'common';					
				style = collection.geoZone.weight[weight][selector];				
				break;
			case 'MCircleGeoZone':
				if (obj.isSelected)					
					style = collection.circle.interactive.selected				
				else			
					style = collection.circle.interactive.common				
				break;
			case 'MCircleObject':
				if (obj.isSelected)					
					style = collection.circle.default.selected				
				else			
					style = collection.circle.default.common				
				break;
			case 'MRegion':
				style = collection.region.defaultRegion;
				break;
			case 'MCapitalPlaneObject':
				if (obj.isSelected) 
					style = collection.capitalPlaneObject.selected
				else
					style = collection.capitalPlaneObject.common;
				break;
			case 'MPicket':
				if (obj.isSelected) 
					style = collection.picket.selected
				else
					style = collection.picket.common;
				break;
			case 'MFactRoute':
				if (obj.isSelected)
					style = collection.routes.factRoute.selected
				else 
					style = collection.routes.factRoute.common;
					
				break;
			case 'MPlannedRoute':
				style = collection.routes.plannedRoute;
				break;
			case 'MRoad':
				style = collection.road;
				break;
			case 'DynamicObject':
				if (obj.isSelected)
					style = collection.dynamicObjects.default.selected
				else
					style = collection.dynamicObjects.default.common;
				break;
			case 'DTruck':
				if (obj.isSelected)
					style = collection.dynamicObjects.truck.selected
				else
					style = collection.dynamicObjects.truck.common
		}		
		return style;
	}

	setCursorStyle(style){}

	/*
		Возвращает зум
	*/
	getZoom(){
		return null;
	}

	getAreaRadius(){
		return this.areaRadius;
	}

	getAreaCenter(){
		return this.areaCenter;
	}

	calcAreaRadius(){}

	calcAreaCenter(){}

	getCursorLocation(){
		// возвращаем криповую копию массива, чтобы его нельзя было изменить
		return [this.cursorLocation[0], this.cursorLocation[1]];
	}
	

	
	addComplexObject(className, data){
		var newObj = null;
		var self = this;

		if (className !== 'MGroup'){
			newObj = eval('new M'+className+'(data, this)');
		} else {
			let deployData = JSON.parse(JSON.stringify(data));
			deployData.children = [];
			for (var i = 0; i < data.children.length; i++){
				deployData.children.push(this.staticObjects[data.children[i]]);
			}
			newObj = new MGroup(deployData, this);
		}
		// добавляем объекту обработчик клика (передаёт событие наверх, в ГЗМ)
		newObj.addListener('mapClick', function(context){
			self.fire('mapClick', context);
		});
		// добавляем линейному объекту обработчик нанесения разметки
		if (newObj.getArchetype() === 'Line'){
			// установка одного маркера
			newObj.addListener('markPlaced', function(context){
				self.fire('markPlaced', context);
			});
			// установка разметки
			newObj.addListener('markupComplete', function(context){				
				self.fire('markupComplete', context);
			});
		}
		this.staticObjects[data.objectID] = newObj;
		return newObj;
	}

	/*
		Стирает объект с карты
	*/
	eraseStaticObject(ID){
		var ids = this.staticObjects[ID].grabIDs();
		for (var i = 0; i < ids.length; i++){			
			this.removePrimitive(this.primitives[ids[i]]);
		}
		this.staticObjects[ID].fire('delete', {objectID: ID});
		this.staticObjects[ID] = null;
		let index = this.selectedStaticObjects.indexOf(ID);
		if (index >= 0){
			this.selectedStaticObjects.splice(index, 1);
		}		
	}

	eraseDynamicObject(uuid){		
		var ids = this.dynamicObjects[uuid].grabIDs();		
		for (var i = 0; i < ids.length; i++){
			this.removePrimitive(this.primitives[ids[i]]);
		}
		this.dynamicObjects[uuid] = null;
		let index = this.selectedDynamicObjects.indexOf(uuid);
		if (index >= 0){
			this.selectedDynamicObjects.splice(index, 1);
		}
	}

	disbandGroup(objectID){
		this.staticObjects[objectID].disband();
		this.staticObjects[objectID] = null;
	}

	hideStaticObject(id){
		if (this.staticObjects[id].isVisible) this.staticObjects[id].hide();
	}

	showStaticObject(id){
		if (!this.staticObjects[id].isVisible) this.staticObjects[id].show();
	}

	// фокус на объект
	// выбирает объект, развыбирая и замораживая предыдущий выделенный
	// перемещает камеру на объект, зумирует карту под него
	focus(objectID){
		let 
			isStatic = this.staticObjects[objectID],
			isDynamic = this.dynamicObjects[objectID];			
		if (isStatic){
			let b = this.staticObjects[objectID].getBounds();
			this.fitTo(b);
		} else this.setView(this.dynamicObjects[objectID].position);		
		this.selectObject(objectID, false);
	}

	// переход к объекту и зум карты под него
	goToObject(objectID){		
		this.fitTo(this.staticObjects[objectID].getBounds());
	}

	// проверяет, помещается ли объект в обозреваемую область карты
	hasFullVisionOn(location){
		/*
			Найти расстояние между центрами
			Оно должно быть <= разнице между радиусом карты и радиусом объекта
		*/
		/*let d = this.calculator.getDistance(location.center, this.areaCenter);		
		return d <= (this.areaRadius - location.actualRadius);*/
		let b = this.getBounds();
		return b.includes(location);

	}

	// проверяет, попадает ли точка в обозреваемую область карты
	hasVisionOn(coords){
		//return (this.calculator.getDistance(coords, this.areaCenter) < this.areaRadius);
		return this.getBounds().contains(coords);
	}

	// развыбирает статический объект
	unselectStaticObject(id){
		// исключаем объект из списка выбранных
		this.selectedStaticObjects.splice(this.selectedStaticObjects.indexOf(id), 1);
		// вызываем метод, изменяющий отображение объекта и кидающий событие о развыбирании
		this.staticObjects[id].unselect();
	}

	// развыбирает динамический объект
	unselectDynamicObject(id){
		// исключаем объект из списка выбранных
		this.selectedDynamicObjects.splice(this.selectedDynamicObjects.indexOf(id), 1);
		// изменяем отображение объекта
		this.dynamicObjects[id].unselect();		
	}
	
	/* Снимает выделение со всех объектов */
	dropSelection(){
		this.dropSelectionStatic();
		this.dropSelectionDynamic();		
	}

	// снимает выделение со статических объектов
	dropSelectionStatic(){
		let s = this.selectedStaticObjects.slice();		
		for (var i = 0; i < s.length; i++){
			this.unselectStaticObject(s[i]);
		}
		s = null;
	}

	// снимает выделение с динамических объектов
	dropSelectionDynamic(){
		let s = this.selectedDynamicObjects.slice();
		for (var i = 0; i < s.length; i++){
			this.unselectDynamicObject(s[i]);
		}
		s = null;
	}

	/*
		Возвращает массив с ID выбранных объектов
	*/
	getSelectedStaticObjects(){
		return this.selectedStaticObjects;
	}

	getLastSelectedObject(){
		return this.selectedStaticObjects[this.selectedStaticObjects.length - 1] || this.selectedDynamicObjects[this.selectedDynamicObjects.length-1] || null;
	}

	/*
		Выбирает объект по id, addict - накопительное выделение
	*/	
	selectObject(objectID, addict){
		let 
			isStatic = this.staticObjects[objectID],
			isDynamic = this.dynamicObjects[objectID],
			objectLink = null;			
		// если выбирается статический объект
		if (isStatic){
				// развыбираем динамические объекты
				this.dropSelectionDynamic()
			// если выделение не накопительное (через ctrl), то сбросить выделение со статических объектов
			if (!addict && this.selectedStaticObjects.length > 0) {
				this.dropSelectionStatic();
			}
			objectLink = this.staticObjects[objectID];
			this.selectedStaticObjects.push(objectID);
		} else if (isDynamic){
			this.dropSelection();
			objectLink = this.dynamicObjects[objectID];
			this.selectedDynamicObjects.push(objectID);
		}
		objectLink.select();	
		// кидаем событие
		var context = {
			message: 'Some object was selected',
			objectInfo: {
				objectID: objectLink.objectID,				
				className: objectLink.getClassName(),
				center: objectLink.getCenter(),
				//props: JSON.parse(JSON.stringify(this.staticObjects[this.getLastSelectedObject()].props))
			},
			objectsCount: isStatic ? this.getSelectedStaticObjects().length : 1
		};
		if (objectLink.uuid) context.uuid = objectLink.uuid
		this.fire('select', context);	
	}

	/*
		Переводит объект в режим растягивания
	*/
	stretchObject(objectID){
		this.staticObjects[objectID].stretch();
	}

	/*
		Обработчик клика по карте по умолчанию (выбирает/развыбирает объекты)
	*/
	defaultClickHandler(context){	
		let
			dynamicObjectClicked = context.uuid,
			staticObjectClicked = context.objectID,			
			objectID = null
		// если клик был по объекту, выбираем его, иначе сбрасываем выделение
		if (staticObjectClicked || dynamicObjectClicked){
			if (staticObjectClicked) {
				if (this.staticObjects[context.objectID].group)
					objectID = this.staticObjects[context.objectID].group.objectID
				else objectID = context.objectID;
			}
			else objectID = context.uuid;
			this.selectObject(objectID, context.ctrlKey);					
		} else this.dropSelection();
	}

	/*
		Стандартные обработчики событий карты
	*/
	subscribe(){
		var self = this;
		this.addListener('mapClick', this.defaultClickHandler);		
	}

	/* 
		Возвращает платформу, на которой реализована карта
	*/
	getPlatform(){
		return this.platform;
	}

	/*
		Загружает тайлы карты
	*/
	loadTiles(){}

	/*
		Конвертирует обобщенный стиль в тот вид, который понятен карте
	*/
	convertStyle(rawStyle){
		return rawStyle;
	}

	/*
		Создаёт средствами карты иконку по описанию из стиля
	*/
	convertIcon(iconStyle){
		return iconStyle
	}

	/*
		Подгоняет зум карты, центрируя её на координатах latlng и задавая радиус охвата в километрах;
		Возможен вызов без параметров, в этом случае центровка карты производится по статическим объектам на ней.
	*/
	setView(latlng, radius){}

	/*
		Подгоняет область обзора карты по имеющимся на ней статическим объектам
	*/
	fitByObjects()	{
		let b = null;
		for (let id in this.staticObjects){			
			if (!b) {				
				b = this.staticObjects[id].getBounds();
			} else {
				b = b.unite(this.staticObjects[id].getBounds());
			}
		}
		if (b){			
			this.fitTo(b);
		}
	}

	// у абстрактной карты нет нативных границ
	checkNativeBounds(obj){return false;}

	/*
		Подгоняет область обзора карты по заданным границам (платформенно-зависимый метод)
	*/
	fitTo(bounds){}

	/*
		Добавляет простую линию. Возвращает ссылку на созданный объект.
	*/
	createLine(from, to, owner, style){}

	/*
		Добавляет сегмент - линию, в свойствах которой прописаны отметки расстояния её начала и конца. Возвращает ссылку на созданный объект.
	*/
	createSegment(from, to, owner, style){}

	/*
	Рисует простую окружность. Возвращает ссылку на созданный объект.
	*/
	createCircle(center, radius, owner, style){}

	/*
	Рисует простой полигон. Возвращает ссылку на созданный объект.
	*/
	createPolygon(coords, owner, style){}

	/*
		Добавляет на карту маркер. Возвращает ссылку на созданный объект.
	*/
	createMarker(point, owner, style){}

	/*
		Добавляет на карту плашку. Возвращает ссылку на созданный объект.
	*/
	createPopup(point, owner, content, style, readOnly){}

	createHashPopup(point, owner, content, style, readOnly){}

	createStretcherPopup(point, owner, content, style, readOnly, index){}

	/*
		Удаляет с карты примитив
	*/
	removePrimitive(obj){
		this.primitives[obj.objectID].hide();
		this.primitives[obj.objectID] = null;
	}

	/*
		Выводит карту из режима редактирования
	*/
	freeze(){
		// убираем обработчики клика по карте, мы больше не получаем данные от кликов
		this.clearListeners('mapClick');
		// ставим дефолтный обработчик
		this.addListener('mapClick', this.defaultClickHandler);
		// замораживаем все выделенные объекты, если они есть
		if (this.selectedStaticObjects.length){
			for (var i = 0; i < this.selectedStaticObjects.length; i++){
				this.staticObjects[this.selectedStaticObjects[i]].freeze();
			}
		}
	}	
}
},{}],9:[function(require,module,exports){
/*
	Полигональный капитальный объект
*/
window.MCapitalPlaneObject = class MCapitalPlaneObject extends MGeoZone{
	constructor(data, map){
		super(data, map);		
	}

	/*
		Создание области объекта
	*/
	createArea(coords){
		this.Area = this.map.createPolygon(coords, this, StaticMap.getStyleForObject(this));
		var self = this;
		if (this.isComplete()){
			this.Area.show();
		}
		this.Area.addListener('click', function(context){
			context.objectID = self.objectID;			
			self.fire('mapClick', context);
		});
	}

	subscribe(){}	
}
},{}],10:[function(require,module,exports){
/*
	Точечный капитальный объект
*/
window.MCapitalPointObject = class MCapitalPointObject extends MPointObject{
	constructor(){
		super();
	}
}
},{}],11:[function(require,module,exports){
window.MCircleGeoZone = class MCircleGeoZone extends MCircleObject{

	constructor(data, map){
		super(data, map);		
		this.calc = GeoZoneManager.getCalculator();	
		if (this.radius && this.center){
			this.createStretchers();
		}
		this.subscribe();
	}

	// подписка объекта на события
	subscribe(){
		this.addListener('stretcherDrag', function(context){
			this.stretcherDragHandler(context);
		});
		this.addListener('stretcherDragStart', function(context){
			this.stretcherDragStartHandler(context);
		});
		this.addListener('stretcherDragEnd', function(context){
			this.stretcherDragEndHandler(context);
		});
	}	

	/*
		Создание стретчера (возвращает объект)
	*/	
	createStretcher(index){
		var 
			angle = this.calc.degToRad(index * 90),
			stretcherCoords = this.calc.forwardTask(this.center, angle, this.radius),
			// создаем маркер
			s = this.map.createMarker(stretcherCoords, this, StaticMap.getStyleCollection().markers.defaultStretcher, true),
			// передача контекста через замыкание
			self = this;
		// присваиваем стретчеру индекс, связывающий его с узловой точкой объекта и его границами
		s.index = index;
		// обработчики событий стретчера
		s.addListener('dragstart', function(context){
			context.index = this.index;
			// сгенерировать событие о начале растягивания
			self.fire('stretcherDragStart', context);
		});		
		s.addListener('drag', function(context){
			context.index = this.index;
			self.fire('stretcherDrag', context);
		});		
		s.addListener('dragend', function(context){
			context.index = this.index;
			self.fire('stretcherDragEnd', context);
			
		});
		if (this.isStretching){
			s.show()
		}
		/*s.addListener('click', function(context){
			self.stretcherPopups[this.index].show();
		});*/
		return s;
	}
	//
	// обработчики перетаскивания маркера растягивания
	stretcherDragHandler(context){
		if (this.isComplete()){
			let d = this.calc.getDistance(this.center, context.coords);
			this.ghostArea.setRadius(d);			
		}			
	}

	stretcherDragStartHandler(context){
		if (this.isComplete()){			
			this.ghostArea.setStyle(StaticMap.getStyleCollection().ghostArea.solid);
			for (let i = 0; i < this.stretchers.length; i++){
				if (i !== context.index){
					this.stretchers[i].hide();
				}
			}
		}
	}

	stretcherDragEndHandler(context){
		var r = this.ghostArea.getRadius();
		if (this.isComplete()){			
			this.ghostArea.setRadius(this.radius);
			this.ghostArea.setStyle(StaticMap.getStyleCollection().ghostArea.transparent);
			this.showMarkers();
			this.createStretchers();
		}
		context.objectID = this.objectID;
		context.radius = r; 
		console.log(context)
		this.map.fire('radiusChange', context);		
	}
	//

	/*
		Переводит объект в режим растягивания
	*/
	stretch(){
		super.stretch();
		if (this.ghostArea) {
			this.ghostArea.enableDragging();			
		} else {
			this.Area.enableDragging();
		}
	}

	/*
		Выводит объект из режима растягивания
	*/
	freeze(){
		super.freeze();
		if (this.ghostArea) {
			this.ghostArea.disableDragging();
		} else {
			this.Area.disableDragging();
		}
	}	

	/* Создание маркеров растягивания */
	createStretchers(){
		this.destroyStretchers();
		for (var i = 0; i < 4; i++){
			this.stretchers.push(this.createStretcher(i));
		}
	}

	destroyStretchers(){
		for (var i = 0; i < this.stretchers.length; i++){
			this.map.removePrimitive(this.stretchers[i]);			
		}
		this.stretchers = [];
		this.stretcherPopups = [];
	}

	showStretchers(){
		for (var i = 0; i < this.stretchers.length; i++){
			this.stretchers[i].show();
		}
	}

	hideStretchers(){
		for (var i = 0; i < this.stretchers.length; i++){
			this.stretchers[i].hide();
		}
	}
}
},{}],12:[function(require,module,exports){
/*
	Круглая геозона
*/
window.MCircleObject = class MCircleObject extends StaticObject{
	constructor(data, map){
		super(data, map);
		this.minimumNodes = 1;
		this.radius = data.radius;
		this.center = data.center;
		if (this.radius && this.center){
			this.createArea();
			this.preparePopup();			
			this.createMarkers();
			this.createGhostArea();			
		} else this.isVisible = false;		
	}

	setStyle(style){
		if (this.Area){
			this.Area.setStyle(style);
		}
	}

	getLatLngs(){
		var ll = [];		
		if (this.Area){			
			ll.push(this.Area.getCenter());			
		}
		return ll;
	}

	getArchetype(){
		return 'Circle';
	}

	setCenter(newCenter){
		this.Area.setCenter(newCenter);
		this.center = newCenter;
		this.ghostArea.setCenter(newCenter);
		this.adjustMarkers();		
		this.createStretchers();
	}

	transpose(newCenter){
		this.setCenter(newCenter);
	}

	setRadius(newradius){
		this.Area.setRadius(newradius);
		this.radius = newradius;
		this.ghostArea.setRadius(newradius);		
		this.createStretchers();
	}	

	/*
		Переводит объект в режим растягивания
	*/
	stretch(){
		super.stretch();		
	}

	/*
		Выводит объект из режима растягивания
	*/
	freeze(){
		super.freeze();		
	}

	createArea(){
		this.Area = this.map.createCircle(this.center, this.radius, this, StaticMap.getStyleForObject(this));
		//
		this.popup = null;
		var self = this;
		this.Area.show();
		this.Area.addListener('click', function(context){			
			self.areaClickHandler(context);
		});		
	}

	createGhostArea(){
		this.ghostArea = this.map.createCircle(this.center, this.radius, this, StaticMap.getStyleCollection().ghostArea.transparent);
		this.ghostArea.show();
		var self = this;
		this.ghostArea.addListener('dragstart', function(context) {self.dragStartHandler(context)});
		this.ghostArea.addListener('dragend', function(context) {self.dragEndHandler(context)});
		this.ghostArea.addListener('drag', function(context) {self.dragHandler(context)});
		this.ghostArea.addListener('click', function(context){				
			self.areaClickHandler(context);
		});
	}

	/*
		Создание плашки
	*/
	preparePopup(){
		if (this.props && Object.keys(this.props).length){
			var self = this;
			this.popup = this.map.createHashPopup(this.getCenter(), this, this.props, StaticMap.getStyleCollection().popups.popupOffsets.bigOffset, false);
			this.popup.addListener('fieldsUpdate', function(context){
				for (var i = 0; i < context.data.length; i++){
					self.props[context.data[i].fieldName] = context.data[i].value;
				}				
			});
		}
	}

	/*
		Создание рамки
	*/
	createBorders(){}

	destroyBorders(){}

	showBorders(){}

	hideBorders(){}

	redrawBorders(){}

	/* Создание маркеров растягивания */
	createStretchers(){}

	destroyStretchers(){}

	showStretchers(){}

	hideStretchers(){}

	/*
		Создание маркеров объекта
	*/
	createMarkers(){
		// выходим из метода, если объект не завершен
		if (this.isComplete()){
			this.markers = [this.map.createMarker(this.Area.getCenter(), this, StaticMap.getStyleCollection().markers.defaultMarker)];
			var self = this;
			this.markers[0].addListener('click', function (context) {
				if (self.popup) self.popup.show();
			});
		}
	}

	/*
		Корректирует позицию центрального маркера
	*/
	adjustMarkers(){
		if (this.markers.length){
			this.markers[0].setLatLngs(this.ghostArea.getCenter());
		}
	}

	// клик по области
	areaClickHandler(context){		
		context.objectID = this.objectID;
		this.fire('mapClick', context);
	}

	// начало перетаскивания
	dragStartHandler(context){
		this.hideStretchers();
		this.hideBorders();
		this.hideMarkers();
		this.ghostArea.setStyle(StaticMap.getStyleCollection().ghostArea.solid);		
	}

	// конец перетаскивания
	dragEndHandler(context){
		this.ghostArea.setStyle(StaticMap.getStyleCollection().ghostArea.transparent);
		this.ghostArea.setCenter(this.Area.getCenter());
		this.showStretchers();
		this.showBorders();
		this.showMarkers();
		this.map.fire('objectDragEnd', {objectID: this.objectID, newCenter: context.center, oldCenter: this.getCenter()});
	}

	// перетаскивание
	dragHandler(context){}

	/*
		Возвращает ID всех примитивов, из которых состоит объект
	*/
	grabIDs(){
		var result = [];
		// ID области
		result.push(this.Area.objectID);
		result.push(this.ghostArea.objectID);
		// стретчеры
		for (var i = 0; i < this.stretchers.length; i++){
			result.push(this.stretchers[i].objectID);
		}
		// плашки стретчеров
		/*for (var i = 0; i < this.stretchers.length; i++){
			result.push(this.stretcherPopups[i].objectID);
		}*/
		// границы
		for (var i = 0; i < this.borders.length; i++){
			result.push(this.borders[i].objectID);
		}
		// маркеры
		for (var i = 0; i < this.markers.length; i++){
			result.push(this.markers[i].objectID);
		}
		// плашка
		if (this.popup) result.push(this.popup.objectID);
		return result;
	}
}
},{}],13:[function(require,module,exports){
/*
	Фактический маршрут с указанием остановок.
	Создание: развертывание (через мониторинг);
	ФМ нельзя растягивать, выделять и удалять, но можно скрыть.
	Имеет стрелки, указывающие направление, которые можно показать или скрыть;
	Не взаимодействует с другими объектами.
*/
window.MFactRoute = class MFactRoute extends MSimpleRoute{
	constructor(data, map){
		// создаём маршрут как стандартный линейный объект
		super(data, map);
		this.stops = null;
		this.stopHints = null;
		// если переданы остановки, создаём их
		if (data.stops){
			this.createStops(data.stops);
			this.showStops();
		}		
	}

	createArea(coords){
		// создаем область стандартно
		super.createArea(coords);
		// создаем стрелки
		this.createArrows();
		// показываем стрелки
		this.showArrows();
	}

	/* Создаёт маркеры остановок */
	createStops(data){
		var self = this;
		this.stops = [];
		this.stopHints = [];
		data.forEach(function(item){
			// в зависимости от статуса маркера правим его стиль
			var style = StaticMap.getStyleCollection().markers.defaultMarker;			
			switch (item.status){
				case 'ok':
					style.color = '#008000';
					break;
				case 'badTiming':
					style.color = '#ffa500';
					break;
				case 'alarm':
					style.color = '#FF0000';
					break;
			}
			// добавляем новый остановочный маркер
			self.stops.push(self.map.createMarker(item.coords, self, style, false));
			// задаем ему индекс
			self.stops[self.stops.length-1].index = self.stops.length-1;
			// добавляем плашку-подсказку, содержащую описание			
			self.stopHints.push(self.map.createPopup(item.coords, self, item.descr, StaticMap.getStyleCollection().popups.popupOffsets.bigOffset));			
			// вешаем обработчик клика на маркер остановки, после клика вылазит соответствующая подсказка
			self.stops[self.stops.length-1].addListener('click', function(context){				
				self.stopHints[this.index].show();
			});			
		});
	}

	addPoint(coords){
		if (this.Area){
			this.Area.pushPoint(coords);
		}
	}

	showStops(){
		if (this.stops){
			this.stops.forEach(function(item){
				item.show();
			});
		}
	}

	hideStops(){
		if (this.stops){
			this.stops.forEach(function(item){
				item.hide();
			});
		}
	}

	grabIDs(){
		let res = super.grabIDs();
		for (var i in this.stops){
			res.push(this.stops[i].objectID);
			res.push(this.stopHints[i].objectID);
		}
		return res;
	}
}
},{}],14:[function(require,module,exports){
/*
	Геозона, обозначаемая полигоном
*/
window.MGeoZone = class MGeoZone extends StaticObject{
	constructor(data, map){
		super(data, map);		
		this.minimumNodes = 3;
		this.weight = 0;
		this.props = data.props || null;
		if (data.nodes){			
			this.createArea(data.nodes);			
		} else this.isVisible = false;
		// если в объекте достаточно точек, создаем маркеры и границы
		if (this.isComplete()){
			this.preparePopup();
			this.createBorders();
			this.createMarkers();
			this.createStretchers();
		}
		this.subscribe();
		this.children = [];		
	}

	// подписка объекта на события
	subscribe(){
		this.addListener('stretcherDrag', function(context){
			this.stretcherDragHandler(context);
		});
		this.addListener('stretcherDragStart', function(context){
			this.stretcherDragStartHandler(context);
		});
		this.addListener('stretcherDragEnd', function(context){
			this.stretcherDragEndHandler(context);
		});
	}

	/*
		Создание области объекта
	*/
	createArea(coords){	
		this.Area = this.map.createPolygon(coords, this, StaticMap.getStyleForObject(this));
		this.popup = null;
		var self = this;
		if (this.isComplete()){
			this.Area.show();			
		}
		this.Area.addListener('click', function(context){			
			self.areaClickHandler(context)
		});
		this.createGhostArea(coords);		
	}

	createGhostArea(coords){
		this.ghostArea = this.map.createPolygon(coords, this, StaticMap.getStyleCollection().ghostArea.transparent);
		this.ghostArea.show();
		var self = this;
		this.ghostArea.addListener('dragstart', function(context) {self.dragStartHandler(context)});
		this.ghostArea.addListener('dragend', function(context) {self.dragEndHandler(context)});
		this.ghostArea.addListener('drag', function(context) {self.dragHandler(context)});
		this.ghostArea.addListener('click', function(context){
			self.areaClickHandler(context);
		});
	}

	dragStartHandler(context){		
		this.hideStretchers();
		this.hideBorders();
		this.hideMarkers();
		this.ghostArea.setStyle(StaticMap.getStyleCollection().ghostArea.solid);
	}

	dragEndHandler(context){
		this.ghostArea.setStyle(StaticMap.getStyleCollection().ghostArea.transparent);
		this.ghostArea.setLatLngs(this.Area.getLatLngs());
		this.showStretchers();
		this.showBorders();
		this.showMarkers();
		this.map.fire('objectDragEnd', {objectID: this.objectID, newCenter: context.center, oldCenter: this.getCenter()});
	}

	dragHandler(context){}

	areaClickHandler(context){		
		context.objectID = this.objectID;
		console.log(this.objectID)		;
		this.fire('mapClick', context);
	}

	// меняет стиль курсора при прохождении через полигон
	// работает только когда полигон закончен (имеет 3 и более точек)
	setCursorStyle(style){
		if (this.isComplete()){
			this.Area.setCursorStyle(style);
		}
	}

	/*
		Создание маркеров объекта
	*/
	createMarkers(){
		// выходим из метода, если объект не завершен
		if (this.isComplete()){
			this.markers = [this.map.createMarker(this.Area.getCenter(), this, StaticMap.getStyleCollection().markers.defaultMarker)];
			var self = this;
			this.markers[0].addListener('click', function (context) {
				self.popup.show();
			});			
		}
	}

	/*
		Корректирует позицию центрального маркера
	*/
	adjustMarkers(){
		if (this.markers.length){
			this.markers[0].setLatLngs(this.ghostArea.getCenter());
		}
	}

	/*
		Создание границы с номером index
	*/
	createBorder(index){
		var
			self = this,
			ll = this.getLatLngs(),
			from = ll[index],
			/*
				Сторона        0 1 2 3
				Конечная точка 1 2 3 0
			*/
			to = ll[(index+1) % ll.length],			
			border = this.map.createLine(from, to, this, StaticMap.getStyleCollection().defaultBorder);			
			border.index = index;
			border.addListener('click', function(context){				
				self.map.fire('splitBorderVisual', {objectID: self.objectID, borderIndex: this.index, nodeIndex: this.index+1, coords: context.coords});				
			});
		return border;
	}

	/*
		Создание (пересоздание) границ объекта
	*/
	createBorders(){
		// если в полигоне не хватает вершин, стороны не создаются
		if (this.isComplete()){
			this.borders = [];
			for (var i=0; i<this.Area.getLatLngs().length; i++){
				this.borders.push(this.createBorder(i));
			}			
		}
	}

	/*
		Полная перерисовка границ объекта
	*/
	redrawBorders(){
		// удаляем стороны
		this.destroyBorders();		
		// если в полигоне не хватает вершин, стороны не создаются
		// создаем их заново
		this.createBorders();		
		// показываем, если надо
		if (this.isSelected && this.isVisible && this.isComplete()){
			this.showBorders();
		}
	}

	/*
		Удаление границ объекта
	*/
	destroyBorders(){
		for (var i=0; i<this.borders.length; i++){
			this.map.removePrimitive(this.borders[i]);
		}
		this.borders = [];
	}

	// удаление 1 границы объекта
	destroyBorder(index){
		// удаляет границу с карты
		this.map.removePrimitive(this.borders[i]);
		// убирает ссылку из массива
		this.borders.splice(index, 1);
		// индекс оставшихся границ не меняется
	}

	/*
		Возвращает true, если объект имеет кликабельные границы
	*/	
	hasBorders(){
		return true;
	}

	hasMarkers(){
		return true;
	}

	hasStretchers(){
		return true;
	}

	/*
		Подготавливает плашку для вывода свойств объекта
	*/
	preparePopup(){
		if (this.props && Object.keys(this.props).length){
			var self = this;
			this.popup = this.map.createHashPopup(this.getCenter(), this, this.props, StaticMap.getStyleCollection().popups.popupOffsets.bigOffset, false);
			this.popup.addListener('fieldsUpdate', function(context){
				for (var i = 0; i < context.data.length; i++){
					self.props[context.data[i].fieldName] = context.data[i].value;
				}				
			});
		}
	}	

	/*
		Обновляет объект по пришедшим данным
	*/
	refresh(data){
		if (this.Area){
			this.Area.setLatLngs(data.coords);
		} else {
			this.createArea(data.coords);
		}
		if (this.isComplete()){
			if (!this.isVisible){
				this.Area.show();
				this.isVisible = true;
			}
			this.redrawBorders();
			// меняем положение маркера, т.к. контур объекта мог измениться
			this.adjustMarkers();
		}
	}

	stretch(){
		super.stretch();
		if (this.ghostArea) {
			this.ghostArea.enableDragging();
		} else {
			this.Area.enableDragging();
		}
	}

	freeze(){
		super.freeze();
		if (this.ghostArea) {
			this.ghostArea.disableDragging();
		} else {
			this.Area.disableDragging();
		}
	}

	/*
		Добавляет объекту точку с координатами coords в позицию index. Если позиция не указана, добавляет в конец.
		Если точка добавляется в середину, то происходит расщепление одной границы на 2;
		При добавлении новой точки добавляется новый стретчер.
	*/
	pushPoint(coords){
		var ll = this.getLatLngs();
		ll.push(coords);
		// если объект не завершен
		if (!this.isComplete()){
			// если область отсутствует, создаем её
			if (!this.Area){
				this.createArea([coords]);
			} else {
				// иначе переписываем координаты
				this.Area.setLatLngs(ll);
				this.ghostArea.setLatLngs(ll);
				// если после добавления очередной точки объект завершился, создаем границы и маркеры и выводим их, если объект выделен
				if (this.isComplete()){
					// показываем сам объект
					this.show();
					// создаем границы и маркеры
					this.createBorders();
					this.createMarkers();
					// если объект выделен в данный момент, показываем границы и маркеры
					if (this.isSelected){
						this.showMarkers();
						this.showBorders();
					}
				}
			}
			// добавляем стретчер и его плашку
			this.addStretcher(ll.length-1, ll.length-1);
			this.addStretcherPopup(ll.length-1, ll.length-1);
		} else {
			// если объект завершен, то разделяем его последнюю границу новой точкой
			this.splitBorder(this.borders.length-1, coords);
		}
	}

	/*
		Расщепление границы с номером index путем добавления точки с к-тами coords
	*/
	splitBorder(index, coords){
		// если границы с таким индексом нет, выходим из метода
		if (!this.borders[index]) return;
		let	pointIndex = index + 1;
		// добавляем точку в позицию		
		this.Area.insertPoint(pointIndex, coords);
		// удалить границу index
		this.map.removePrimitive(this.borders[index]);
		// соединить точки, оставшиеся без границ
		this.borders.splice(index, 1, this.createBorder(index));
		this.borders.splice(index+1, 0, this.createBorder(index+1));
		// сдвигаем индексы идущих следом границ на 1
		for (var i=index+2; i<this.borders.length; i++){
			this.borders[i].index = this.borders[i].index + 1;
		}
		// если объект выделен и видим, то созданные границы показываются
		if (this.isVisible && this.isSelected){
			this.borders[index].show();
			this.borders[index+1].show();
		}
		// добавляем новый стретчер
		this.addStretcher(pointIndex, pointIndex);
		this.addStretcherPopup(pointIndex, pointIndex);		
	}

	/*
		Полный перенос объекта
	*/
	traspose(newCenter){
		const 
			oldCenter = this.getCenter(),
			delta = [newCenter[0] - oldCenter[0], newCenter[1] - oldCenter[1]],
			coords = this.getLatLngs();
		let newCoords = coords.map((latlon) => { return [ latlon[0]+delta[0], latlon[1]+delta[1] ]; });
		this.Area.setLatLngs(newCoords);
		this.ghostArea.setLatLngs(newCoords);
		this.adjustMarkers();
		this.redrawBorders();
		this.createStretchers();
	}

	addNode(index, coords){		
		this.Area.insertPoint(index, coords);
		this.redrawBorders();
		this.createStretchers();
		this.adjustMarkers();		
	}

	// обработчики перетаскивания маркера растягивания
	stretcherDragHandler(context){
		if (this.isComplete()){
			var
				ll = this.getLatLngs();
			// изменяем контур
			ll[context.index] = context.coords;		
			this.ghostArea.setLatLngs(ll);
			var adjucentBorders = this.getAdjacentBorders(context.index);
			// двигаем границы (у следующей меняется начало, у предыдущей - конец)
			if (adjucentBorders.hasOwnProperty('next')){
				let bnext = this.borders[adjucentBorders.next].getLatLngs();
				bnext[0] = context.coords;
				this.borders[adjucentBorders.next].setLatLngs(bnext);
			}
			if (adjucentBorders.hasOwnProperty('prev')){
				let bprev = this.borders[adjucentBorders.prev].getLatLngs();
				bprev[1] = context.coords;
				this.borders[adjucentBorders.prev].setLatLngs(bprev);
			}
			this.adjustMarkers();
		}			
	}

	stretcherDragStartHandler(context){
		if (this.isComplete()){
			var adjucentBorders = this.getAdjacentBorders(context.index);
			if (adjucentBorders.hasOwnProperty('next')){
				this.borders[adjucentBorders.next].setStyle(StaticMap.getStyleCollection().dottedBorder);
			}
			if (adjucentBorders.hasOwnProperty('prev')){
				this.borders[adjucentBorders.prev].setStyle(StaticMap.getStyleCollection().dottedBorder);
			}
			this.ghostArea.setStyle(StaticMap.getStyleCollection().ghostArea.solid);
			//this.ghostArea.show();
		}			
	}

	stretcherDragEndHandler(context){		
		if (this.isComplete()){
			var adjucentBorders = this.getAdjacentBorders(context.index);		
			if (adjucentBorders.hasOwnProperty('next')){
				this.borders[adjucentBorders.next].setStyle(StaticMap.getStyleCollection().defaultBorder);
			}
			if (adjucentBorders.hasOwnProperty('prev')){
				this.borders[adjucentBorders.prev].setStyle(StaticMap.getStyleCollection().defaultBorder);
			}
			this.ghostArea.setStyle(StaticMap.getStyleCollection().ghostArea.transparent);
			//this.ghostArea.hide();
		}			
		context.objectID = this.objectID;
		this.map.fire('moveNodeVisual', context);
	}

	/*
		Перезаписывает координаты объекта
	*/
	setLatLngs(ll){
		if (this.Area){
			this.Area.setLatLngs(ll);
			this.redrawBorders();
			this.createStretchers();			
			this.ghostArea.setLatLngs(this.Area.getLatLngs());
			this.adjustMarkers();
		}
	}

	addChild(geoZone){
		this.children.push(geoZone);
		var self = this;
		// при удалении потомка убираем его из списка чилдренов и чекаем вес, чтобы стиль изменился, если нужно
		this.children[this.children.length-1].addListener('delete', function(context){
			self.excludeChild(context.objectID);
			self.checkWeight();
		});
		// если вес потомка изменился, то мог поменяться и вес родителя, проверяем
		this.children[this.children.length-1].addListener('changeweight', function(context){
			self.checkWeight();
		});
		self.checkWeight();
	}

	excludeChild(objectID){
		let i = 0, done = false
		while (i < this.children.length && !done){
			if (this.children[i].objectID === objectID){
				this.children.splice(i, 1);
				done = true;
			}
			i++;
		}
		
	}

	checkWeight(){
		// пробегаем по чилдренам, считаем вес
		let w = -1;
		for (let i = 0; i < this.children.length; i++){
			w = Math.max(w, this.children[i].weight);
		}
		w += 1;
		// если отличается - меняем, перекрашиваем, поджигаем событие
		if (w !== this.weight){
			this.weight = w;
			this.Area.setStyle(StaticMap.getStyleForObject(this));
			this.fire('changeweight');
		}
	}

	getArchetype(){
		return 'Polygon';
	}

	/*
		Возвращает ID всех примитивов, из которых состоит объект
	*/
	grabIDs(){
		var result = [];
		// ID области
		result.push(this.Area.objectID);
		result.push(this.ghostArea.objectID);
		// стретчеры
		for (var i = 0; i < this.stretchers.length; i++){
			result.push(this.stretchers[i].objectID);
		}
		// плашки стретчеров
		for (var i = 0; i < this.stretchers.length; i++){
			result.push(this.stretcherPopups[i].objectID);
		}
		// границы
		for (var i = 0; i < this.borders.length; i++){
			result.push(this.borders[i].objectID);
		}
		// маркеры
		for (var i = 0; i < this.markers.length; i++){
			result.push(this.markers[i].objectID);
		}
		// плашка
		if (this.popup) result.push(this.popup.objectID);
		return result;
	}
}
},{}],15:[function(require,module,exports){
window.MGroup = class MGroup extends StaticObject{

	constructor(data, map, style){
		super(data, map, style);
		this.children = data.children;
		for (var i = 0; i < this.children.length; i++){
			this.children[i].group = this;
		}
	}

	/*
		Расформировывает группу без удаления чилдренов
	*/
	disband(){
		this.children.forEach(function(item){
			item.group = null;
		});
		this.children = [];
	}

	// будет доработан
	getCenter(){return [];}

	// будет доработан
	getBounds(){return null;}

	/*
		Методы, показывающие/прячущие/подсвечивающие объект обходят всех чилдренов и вызывают соответствующий метод у них
	*/
	show(){
		this.isVisible = true;
		for (var i in this.children){
			this.children[i].show();			
		}
	}

	hide(){
		// развыбираем объект
		if (this.isSelected){
			this.unselect();
		}
		this.isVisible = false;		
		this.fire('hideView', {objectID: this.objectID});		
		for (var i in this.children){
			this.children[i].hide();
		}
	}
	
	select(){
		this.isSelected = true;
		for (var objectID in this.children){
			this.children[objectID].select();
		}
	}

	unselect(){
		this.isSelected = false;
		for (var objectID in this.children){
			this.children[objectID].unselect();
		}
	}

	highlightOn(){		
		for (var i in this.children){
			this.children[i].highlightOn();			
		}		
	}

	highlightOff(){		
		for (var i in this.children){
			this.children[i].highlightOff();			
		}	
	}

	/*
		Добавляет объекту обработчики событий
	*/
	subscribe(){

	}

	/*
		Возвращает true если объект находится в стабильном состоянии и его можно в таком виде сохранить
	*/
	isComplete(){		
		return true;
	}

	freeze(){}

	/*
		Возвращает ID всех примитивов, из которых состоит объект
		Группа перебирает всех своих чилдренов и извлекает из них id, формируя большой массив и возвращает его.
	*/
	grabIDs(){
		var result = [], buf = [];
		/*for (var i in this.children){
			buf = this.children[i].grabIDs();
			for (var j in buf){
				result.push(buf[j]);
			}
			
		}*/
		return result;
	}

	/*
		Границ нет, маркеров нет, стретчеров нет, населена роботами.
	*/
	hasBorders(){return false;}

	hasMarkers(){return false;}

	hasStretchers(){return false;}	

	/*
		Т.к. группа, строго говоря, не имеет собственного визуального воплощения, то у неё не работают:
			методы редактирования статических объектов;
			методы, связанные с границами и стретчерами;
			методы, показывающие/скрывающие части объекта (маркеры, границы, стретчеры и проч.)
		Все эти методы заменены на заглушки.
	*/
	
	setLatLngs(ll){}	
	moveNodeTo(index, coords){}	
	removeNode(index){}
	getLatLngs(){return [];}	
	createMarkers(){}
	destroyMarkers(){}	
	adjustMarkers(){}
	showMarkers(){}
	hideMarkers(){}
	createBorders(){}
	destroyBorders(){}
	createBorder(i){}
	redrawBorders(){}
	showBorders(){}
	hideBorders(){}
	destroyStretchers(){}
	createStretchers(){}
	createStretcherPopup(index){return null}
	createStretcher(index){return null;}
	showStretchers(){}
	hideStretchers(){}
	addStretcher(position, node){}
	addStretcherPopup(position, node){}
	removeStretcher(index){}
	removeStretcherPopup(index){}
	setStyle(style){}
	pushPoint(coords, index){}
	stretch(){}
	getAdjacentBorders(index){return null;}
}
},{}],16:[function(require,module,exports){
/*
	Линейный объект, обозначаемый ломаной линией
*/
window.MLinearObject = class MLinearObject extends StaticObject{
	constructor(data, map, style){
		super(data, map);
		this.minimumNodes = 2;
		this.arrows = [];
		this.calc = GeoZoneManager.getCalculator();
		this.isMarking = false;
		this.marks = {markers: []};
		this.markedArea = null;		
		if (data.nodes){
			this.createArea(data.nodes);
			this.createMarkers();
		} else this.isVisible = false;
		this.directionArrow = this.createDirectionArrow();
		this.subscribe();
	}

	// подписка объекта на события
	subscribe(){
		this.addListener('stretcherDrag', function(context){
			this.middleStretcherDragHandler(context);
		});
		this.addListener('endingStretcherDrag', function(context){
			this.stretcherDragHandler(context);
		});
		this.addListener('stretcherDragStart', function(context){
			this.stretcherDragStartHandler(context);
		});
		this.addListener('stretcherDragEnd', function(context){
			this.stretcherDragEndHandler(context);
		});
		this.addListener('areaMouseOver', function(context){
			this.segmentMouseOverHandler(context);
		});
	}

	createArea(coords){
		var self = this;		
		this.Area = new LinearObjectComplexArea(coords, this, StaticMap.getStyleForObject(this));
		if (this.isComplete()){
			this.Area.show();
		}
		this.Area.addListener('click', function(context){			
			self.areaClickHandler(context);
		});
		this.Area.addListener('mouseover', function(context){
			self.fire('areaMouseOver', context);
		});		
		this.createGhostArea(coords);
	}

	areaClickHandler(context){	
		context.objectID = this.objectID;
		if (this.isMarking){
			let d = context.distance + this.Area.segments[context.segIndex].startsAt;
			this.setMark(d);
		} else this.fire('mapClick', context);
	}

	createDirectionArrow(){
		var da = this.map.createMarker(null, this, StaticMap.getStyleCollection().markers.directionArrow, false);
		da.segIndex = -1;
		da.distance = -1;
		var self = this;
		da.addListener('click', function(context){
			context.distance = this.distance;
			context.segIndex = this.segIndex;

			self.areaClickHandler(context);
		});
		da.addListener('mouseout',function(context){
			self.hideDirectionArrow();
		});
		return da;

	}

	createGhostArea(coords){
		this.ghostArea = this.map.createPolyline(coords, this, StaticMap.getStyleCollection()['ghostArea']);		
	}

	/*
		Метод, переводящий линейный объект в режим нанесения разметки для разбивки на пикеты
	*/
	startMarking(){
		if (this.isComplete() && !this.isMarking){
			// пишем, что объект находится в режиме нанесения разметки
			this.isMarking = true;
			// считываем координаты объекта
			let ll = this.Area.getLatLngs();
			// ставим 2 маркера - в начале и в конце объекта, размечая, таким образом, весь объект целиком
			this.setMark(0);
			this.setMark(this.Area.segments[this.Area.segments.length-1].endsAt);
		}
	}

	stopMarking(){
		this.isMarking = false;
		var self = this;
		// стереть маркеры
		if (this.marks.markers.length > 0){
			this.marks.markers.forEach(function(marker){
				self.map.removePrimitive(marker);
			});
			this.marks.markers = [];
		}		
		this.destroyMarkedArea();
	}

	// устанавливает маркер для нанесения пикетной разметки
	// distance - отметка расстояния, на которой стоит метка
	setMark(distance){
		// индекс сегмента, на который мы попадаем, координаты метки, счетчик и т.д.
		let index = -1, coords = null, i = 0, d = 0, ll = this.getLatLngs();
		// по дистанции определяем, на какой сегмент упала разметка	
		while (index < 0 && i < 100){
			if (this.Area.segments[i].startsAt <= distance && this.Area.segments[i].endsAt >= distance) {
				index = i;
			};
			i++;
		}
		// определяем координаты метки
		// смотрим, сколько осталось
		d = distance - this.Area.segments[index].startsAt;
		// откладываем точку
		coords = this.calc.forwardTask(ll[index], this.calc.getAngle(ll[index], ll[index+1]), d);		
		// создаём маркер
		let newMarker = this.map.createMarker(coords, this, StaticMap.getStyleCollection().markedArea.marker, false), oldMarker = null;
		newMarker.index = index;		
		// замеряем расстояние от маркера до начала сегмента, на котором он стоит
		newMarker.distance = distance;
		// если маркеров меньше 2, пушим новый маркер в массив
		if (this.marks.markers.length < 2){
			this.marks.markers.push(newMarker);
		} else {
			// если 2 маркера уже есть, выясняем, ближе к какому из них находится новый и заменяем
			// если оба имеющихся маркера стоят на 1 сегменте, то определяем заменяемый по расстоянию, иначе считаем по номерам сегментов
			if (this.marks.markers[0].index === this.marks.markers[1].index){
				if (Math.abs(newMarker.distance - this.marks.markers[0].distance) <= Math.abs(newMarker.distance - this.marks.markers[1].distance)){
					oldMarker = this.marks.markers[0];
					this.marks.markers[0] = newMarker;
				} else {
					oldMarker = this.marks.markers[1];
					this.marks.markers[1] = newMarker;
				}
			} else {
				if (Math.abs(newMarker.index - this.marks.markers[0].index) <= Math.abs(newMarker.index - this.marks.markers[1].index)){
					oldMarker = this.marks.markers[0];
					this.marks.markers[0] = newMarker;
				} else {
					oldMarker = this.marks.markers[1];
					this.marks.markers[1] = newMarker;
				}
			}
			this.map.removePrimitive(oldMarker);
		}
		newMarker.show();
		this.fire('markPlaced', {objectID: this.objectID, distance: newMarker.distance});
		if (this.marks.markers.length === 2){
			// если у нас есть 2 маркера, определяем, какой из них начальный, какой - конечный
			let swap = false;
			if (this.marks.markers[0].index === this.marks.markers[1].index){
				swap = (this.marks.markers[0].distance > this.marks.markers[1].distance);
			} else {
				swap = (this.marks.markers[0].index > this.marks.markers[1].index);
			}
			if (swap) 
				this.marks.markers = [this.marks.markers[1], this.marks.markers[0]];
			// после того, как оба маркера поставлены и определено их взаиморасположение, создаем размеченную область
			this.createMarkedArea();
		}
	}

	/*
		Создаём размеченную область
			Удаляем старую область, если она есть
			Формируем новую, записываем координату начального маркера, пробегаем все сегменты ЛО от начального маркера к конечному, записываем концы, записываем координату конечного маркера
			Сегменты получают обработчик, вызывающий LO.mark(index, latlng), т.е. ставящий маркер
	*/
	createMarkedArea(){
		// размеченная область рисуется только для объектов в режиме разметки и с 2 маркерами
		if (this.isMarking && this.marks.markers.length === 2){
			if (this.markedArea) this.destroyMarkedArea();
			let nodes = [], ll = this.getLatLngs();
			var self = this;
			// первая точка размеченной области - та, в которой стоит маркер
			nodes.push(this.marks.markers[0].getLatLngs()[0]);
			// собираем остальные точки - стыки между сегментами
			for (let i = this.marks.markers[0].index; i < this.marks.markers[1].index; i++){
				nodes.push(ll[i+1]);
			}
			// последняя точка размеченной области - та, в которой стоит маркер
			nodes.push(this.marks.markers[1].getLatLngs()[0]);
			this.markedArea = new LinearObjectComplexArea(nodes, this, StaticMap.getStyleCollection().markedArea.line, this.marks.markers[0].distance);			
			this.markedArea.addListener('click', function(context){
				let d = context.distance + this.segments[context.segIndex].startsAt;
				self.setMark(d);
			});
			this.markedArea.show();
			this.fire('markupComplete', {objectID: this.objectID, from: this.marks.markers[0].distance, to: this.marks.markers[1].distance});
		}
	}

	destroyMarkedArea(){
		for (let i = 0; i < this.markedArea.segments.length; i++){
			this.map.removePrimitive(this.markedArea.segments[i])
		}
		this.markedArea = null;
	}

	// создание стрелок по всей длине объекта
	createArrows(){		
		/*var calc = GeoZoneManager.getCalculator();
		// стрелки по умолчанию размещаются с интервалом в 100 метров
		const ARROWSTEP = 500;
		// Заряжаем шаг, с которым размещаются стрелки
		var d = ARROWSTEP, ll = [], i = 0, angle = 0, point = null, style = null, arrow = null;
		// Удаляем старые стрелки, если они есть, обнуляем массив с ними
		if (this.arrows && this.arrows.length){
			this.destroyArrows();
		}		
		ll = this.getLatLngs();
		for (var k = 1; k < ll.length-1; k++){
			//this.map.createMarker1(ll[k]);
		}
		// Пока пройденное расстояние не превосходит длину линейного объекта и мы не вышли за пределы его сегментов
		while (d < this.segments[this.segments.length-1].endsAt && i < this.segments.length){			
			// Если счетчик расстояния вышел из текущего сегмента, увеличиваем счетчик сегментов			
			while (d < this.segments[i].startsAt || d >= this.segments[i].endsAt){
				i++;
			}			
			// получаем XY начала и конца сегмента, находим угол наклона сегмента (в радианах)
			angle = calc.getAngle(ll[i], ll[i+1]);
			// решаем ПГЗ, находим точку, в которой будет рисоваться стрелка
			point = calc.forwardTask(ll[i], angle, d - this.segments[i].startsAt);			
			// создаем маркер со стрелкой, повернутой на угол, равный наклону сегмента			
			// изменяем стиль маркера, добавляя ему вращение
			// цвет стрелки считываем из линейного объекта, чтобы они сливались
			style = StaticMap.getStyleCollection().markers.directionArrow;			
			style.color = this.Area.getColor();
			style.rotate = calc.radToDeg(angle)*-1;			
			arrow = this.map.createMarker(point, this, style, false);			
			// пушим маркер в массив
			this.arrows.push(arrow);			
			// увеличиваем счетчик расстояния
			d += ARROWSTEP;
		}*/
	}

	/*
		Показывает все стрелки
	*/
	showArrows(){
		if (this.arrows){
			this.arrows.forEach(function(arrow){
				arrow.show();
			})
		}
	}

	/*
		Прячет все стрелки
	*/
	hideArrows(){
		if (this.arrows){
			this.arrows.forEach(function(arrow){
				arrow.hide();
			})
		}
	}

	showDirectionArrow(coords, segment, distance){
		var angle = this.calc.getAngle(segment.getLatLngs()[0], coords);		
		this.directionArrow.setLatLngs(coords);
		this.directionArrow.segIndex = segment.index;
		this.directionArrow.distance = distance;
		var style = StaticMap.getStyleCollection().markers.directionArrow;
		style.color = '#000000';
		style.rotate = this.calc.radToDeg(angle)*-1;
		this.directionArrow.setStyle(style);		
		if (!this.directionArrow.isVisible){			
			this.directionArrow.show();			
		}		
	}

	hideDirectionArrow(){		
		if (this.directionArrow.isVisible){			
			this.directionArrow.hide();
		}
	}

	hasBorders(){
		return true;
	}

	hasMarkers(){
		return true;
	}

	hasStretchers(){
		return true;
	}

	/*
		Создание (пересоздание) границ объекта
	*/
	createBorders(){
		// если в полигоне не хватает вершин, стороны не создаются
		if (this.isComplete()){
			this.borders = [];
			for (var i=0; i<this.Area.getLatLngs().length-1; i++){
				this.borders.push(this.createBorder(i));
			}			
		}
	}

	/*
		Создание границы с номером index
	*/
	createBorder(index){
		var
			self = this,
			ll = this.getLatLngs(),
			from = ll[index],			
			to = ll[index+1],
			border = this.map.createLine(from, to, this, StaticMap.getStyleCollection().defaultBorder);			
			border.index = index;
			border.addListener('click', function(context){
				self.map.fire('splitBorderVisual', {objectID: self.objectID, borderIndex: this.index, nodeIndex: this.index, coords: context.coords});				
			});
		return border;
	}

	/*
		Расщепление границы с номером index путем добавления точки с к-тами coords
	*/
	splitBorder(index, coords){		
		// если границы с таким индексом нет, выходим из метода
		if (!this.borders[index]) return;
		let	pointIndex = index + 1;
		// добавляем точку в позицию		
		this.Area.insertPoint(pointIndex, coords);
		this.ghostArea.setLatLngs(this.Area.getLatLngs());
		// удалить границу index
		this.map.removePrimitive(this.borders[index]);
		// соединить точки, оставшиеся без границ
		this.borders.splice(index, 1, this.createBorder(index));
		this.borders.splice(index+1, 0, this.createBorder(index+1));
		// сдвигаем индексы идущих следом границ на 1
		for (var i=index+2; i<this.borders.length; i++){
			this.borders[i].index = this.borders[i].index + 1;
		}
		// если объект выделен и видим, то созданные границы показываются
		if (this.isVisible && this.isSelected){
			this.borders[index].show();
			this.borders[index+1].show();
		}
		// добавляем новый стретчер
		this.addStretcher(pointIndex-1, pointIndex);
		this.addStretcherPopup(pointIndex, pointIndex);
		// сдвигаем индекс конечного маркера
		this.markers[1].index = this.Area.getLatLngs().length-1;
	}

	addNode(index, coords){
		let L = this.getLatLngs().length;
		if (index === 0){
			// добавляем точку в позицию		
			this.Area.insertPoint(index, coords);
			this.ghostArea.setLatLngs(this.Area.getLatLngs());
			this.borders.splice(index, 0, this.createBorder(0));
			for (var i = 1; i < this.borders.length; i++){
				this.borders[i].index++;
			}
			// если объект выделен и видим, то созданные границы показываются
			if (this.isVisible && this.isSelected){
				this.borders[index].show();
				this.borders[index+1].show();
			}
			this.adjustMarkers();
		} else {
			if (index < L){
				/*
					Индекс точки   1 2 3 4 5
					Индекс стороны 0 1 2 3 4
				*/
				this.splitBorder(index-1, coords);
			} else this.pushPoint(coords);
		}			
	}

	/*
		Директивно изменяет положение вершины с номером index, передвигая её в положение coords 
	*/
	moveNodeTo(index, coords){
		this.Area.moveNodeTo(index, coords);
		this.ghostArea.setLatLngs(this.Area.getLatLngs());
		// двигаем границы, примыкающие к вершине
		if (this.hasBorders() && this.isComplete()){
			var b = this.getAdjacentBorders(index);
			var l = null;
			if (b.next || b.next === 0){
				l = this.borders[b.next].getLatLngs();
				l[0] = coords;
				this.borders[b.next].setLatLngs(l);
			}
			if (b.prev || b.prev === 0){
				l = this.borders[b.prev].getLatLngs();
				l[1] = coords;
				this.borders[b.prev].setLatLngs(l);
			}
		}
		if (this.hasStretchers()){			
			if (this.stretchers[index-1]){
				this.stretchers[index-1].setLatLngs(coords);
			}
		}
		this.stretcherPopups[index].setLatLngs(coords);
	}

	/*
		Удаляет точку из объекта
	*/
	removeNode(index){
		/*
			Если удаляется 0 вершина, то отвалится самый первый сегмент и конечный маркер переместится на следующую точку
				удаляем 0 плашку, у всех остальных двигаем индексы
				удаляем 0 стретчер, у всех остальных двигаем индексы
				подгоняем маркеры
			Если удаляется конечная вершина
				удаляем последнюю плашку
				удаляем последний стретчер
				подгоняем маркеры
			Если удаляется вершина из середины
				удаляем стретчер и плашку с номером index
				у всех следующих двигаем индексы
		*/
		if (index === 0){
			this.removeStretcher(0);
			this.removeStretcherPopup(0);
		} else if (index === this.getLatLngs().length-1){
			this.removeStretcher(this.stretchers.length-1);
			this.removeStretcherPopup(this.stretcherPopups.length-1);
		} else {
			this.removeStretcher(index-1);
			this.removeStretcherPopup(index);
		}
		this.Area.removeNode(index);
		this.ghostArea.setLatLngs(this.Area.getLatLngs());
		// поправляем маркеры
		this.adjustMarkers();
		// перерисовываем границы
		this.redrawBorders();
	}

	// создание маркеров линейного объекта
	// маркеры ЛО при растягивании ведут себя аналогично стретчерам
	createMarkers(){		
		let latlon = this.getLatLngs();
		// маркеры можно создавать только тогда, когда в объекте есть точки
		if (latlon.length > 0){
			var self = this;
			/*
				Во время поточечного создания ЛО при установке первой точки ставится не стретчер, а основной маркер;
				затем, когда ставится вторая точка, к нему добавляется второй маркер;
				стретчеры появляются тогда, когда точек в ЛО становится 3+;
			*/
			/*
				В цикле создаём маркеры;
				Метод может вызываться дважды при поточечном создании объекта, тогда сначала создастся начальный маркер, затем конечный;
				При развертывании объекта создаются сразу оба;
				Для управления созданием используются переменные start и count.

				Если один маркер уже создан, то будет всего 1 итерация; иначе - от 1 до 2;
				Если в объекте всего 1 точка, то будет всего 1 итерация; иначе - от 1 до 2;
			*/
			let
				start = (this.markers.length === 0) ? 0 : 1,
				count = (latlon.length > 1) ? 2 : 1;

			for (var i = start; i < count; i++){
				// по номеру маркера определяем, к какой координате он относится
				let coord = (i === 0) ? latlon[0] : latlon[latlon.length-1];
				// создаем маркер
				let m = this.map.createMarker(coord, this, StaticMap.getStyleCollection().markers.defaultMarker, this.isStretching);
				// выдаем маркеру индекс
				m.index = (i === 0) ? 0 : latlon.length-1;
				// создаем маркеру плашку
				this.stretcherPopups.splice(m.index, 0, this.createStretcherPopup(m.index));
				// вешаем обработчики
				m.addListener('dragstart', function(context){
					context.index = this.index;					
					self.fire('stretcherDragStart', context);
				});
				m.addListener('drag', function(context){
					context.index = this.index;
					self.fire('endingStretcherDrag', context);
				});
				m.addListener('dragend', function(context){
					context.index = this.index;
					self.fire('stretcherDragEnd', context);
				});
				m.addListener('click', function(context){					
					self.stretcherPopups[this.index].show();
				});
				// пушим маркер в массив
				this.markers.push(m);
			}
		}		
	}

	/*
		Корректирует позицию начального и конечного маркера
	*/
	adjustMarkers(){		
		if (this.markers.length){
			var latlon = this.ghostArea.getLatLngs();			
			this.markers[0].setLatLngs(latlon[0]);
			this.markers[1].index = latlon.length-1;
			this.markers[1].setLatLngs(latlon[latlon.length-1]);			
		}
	}

	/*
		Перебирает все сегменты, пушит коодинаты в массив
	*/
	getLatLngs(){
		var ll = [];
		if (this.Area){			
			ll = this.Area.getLatLngs();
		}
		return ll;
	}

	/*
		Перезаписывает координаты объекта
	*/
	setLatLngs(ll){
		if (this.Area){
			this.Area.setLatLngs(ll);
		}
	}

	/*
		Добавляет точку в конец линейного объекта
	*/
	pushPoint(coords){
		// если области нет, создаём её
		if (!this.Area){
			this.createArea([coords]);
			// создаём маркер в первой точке
			this.createMarkers();
			this.showMarkers();
		} else {
			let ghost = this.ghostArea.getLatLngs(); 
			ghost.push(coords);			
			this.ghostArea.setLatLngs(ghost);
			// если область есть, но объект не завершен
			if (!this.isComplete()){
				// добавляем точку и завершаем объект
				this.Area.pushPoint(coords);
				// создаем маркеры
				this.createMarkers();
				// показываем объект
				this.show();
			} else {
				// если объект завершен
				this.Area.pushPoint(coords);
				this.adjustMarkers();
				// создаём стретчер
				this.addStretcher(this.stretchers.length, this.Area.getLatLngs().length - 2);
				this.addStretcherPopup(this.Area.getLatLngs().length - 1, this.Area.getLatLngs().length - 1);
			}
			// создаем новую границу
			this.borders.push(this.createBorder(this.Area.getLatLngs().length - 2));
			// если объект видим, показываем новый сегмент
			if (this.isVisible){
				// если объект выделен, показываем новую границу
				if (this.isSelected){					
					this.borders[this.borders.length-1].show();
				}
			}
		}		
	}

	/*
		Переводит объект в режим растягивания
	*/
	stretch(){
		super.stretch();
		if (this.markers.length){
			this.markers.forEach(function(m){
				m.enableDragging();
			});
		}
	}

	freeze(){
		super.freeze();
		if (this.markers.length){
			this.markers.forEach(function(m){
				m.disableDragging();
			});
		}
	}

	unselect(){
		super.unselect();
		if (this.isMarking) this.stopMarking();
	}

	middleStretcherDragHandler(context){		
		this.stretcherDragHandler(context);
		// подгоняем положение маркеров
		this.adjustMarkers();
	}

	// обработка передвижения маркера
	stretcherDragHandler(context){
		// находим смежные границы
		var adjucentBorders = this.getAdjacentBorders(context.index);		
		// двигаем границы (у следующей меняется начало, у предыдущей - конец)
		if (adjucentBorders.hasOwnProperty('next')){
			let bnext = this.borders[adjucentBorders.next].getLatLngs();
			bnext[0] = context.coords;
			this.borders[adjucentBorders.next].setLatLngs(bnext);
		}
		if (adjucentBorders.hasOwnProperty('prev')){
			let bprev = this.borders[adjucentBorders.prev].getLatLngs();
			bprev[1] = context.coords;
			this.borders[adjucentBorders.prev].setLatLngs(bprev);
		}
		let ghost = this.ghostArea.getLatLngs(); ghost.splice(context.index, 1, context.coords);		
		this.ghostArea.setLatLngs(ghost);

	}

	// начало движения
	stretcherDragStartHandler(context){
		// при начале движения делаем смежные границы пунктирными
		var adjucentBorders = this.getAdjacentBorders(context.index);		
		if (adjucentBorders.hasOwnProperty('next')){
			this.borders[adjucentBorders.next].setStyle(StaticMap.getStyleCollection().dottedBorder);
		}
		if (adjucentBorders.hasOwnProperty('prev')){
			this.borders[adjucentBorders.prev].setStyle(StaticMap.getStyleCollection().dottedBorder);
		}
	}

	// окончание движения
	stretcherDragEndHandler(context){
		// при окончании движения делаем смежные границы сплошными
		var adjucentBorders = this.getAdjacentBorders(context.index);
		if (adjucentBorders.hasOwnProperty('next')){
			this.borders[adjucentBorders.next].setStyle(StaticMap.getStyleCollection().defaultBorder);
		}
		if (adjucentBorders.hasOwnProperty('prev')){
			this.borders[adjucentBorders.prev].setStyle(StaticMap.getStyleCollection().defaultBorder);
		}
		context.objectID = this.objectID;		
		this.map.fire('moveNodeVisual', context);

	}

	segmentMouseOverHandler(context){		
		this.showDirectionArrow(context.coords, this.Area.segments[context.segIndex], context.distance);
	}	

	getArchetype(){
		return 'Line';
	}

	/*
		Возвращает ID всех примитивов, из которых состоит объект
	*/
	grabIDs(){
		var result = [];
		// ID области
		let segs = 	this.Area.grabIDs();
		for (var i in segs){
			result.push(segs[i]);
		}		
		// стретчеры
		for (var i = 0; i < this.stretchers.length; i++){
			result.push(this.stretchers[i].objectID);
		}
		// границы
		for (var i = 0; i < this.borders.length; i++){
			result.push(this.borders[i].objectID);
		}
		// маркеры
		for (var i = 0; i < this.markers.length; i++){
			result.push(this.markers[i].objectID);
		}
		// стрелки
		for (var i = 0; i < this.arrows.length; i++){
			result.push(this.arrows[i].objectID);
		}		
		return result;
	}	
}
},{}],17:[function(require,module,exports){
/*
	Пикет, обозначаемый полигоном; используется для деления дорог на участки
*/
window.MPicket = class MPicket extends MGeoZone{
	constructor(data, map){
		super(data, map);
		this.minimumNodes = 6;
	}
	
	// подписка объекта на события
	subscribe(){}

	/*
		Создание области объекта
	*/
	createArea(coords){		
		this.Area = this.map.createPolygon(coords, this, StaticMap.getStyleForObject(this));
		this.popup = null;
		var self = this;
		if (this.isComplete()){
			this.Area.show();			
		}
		this.Area.addListener('click', function(context){			
			self.areaClickHandler(context)
		});
	}

	areaClickHandler(context){		
		context.objectID = this.objectID;		
		this.fire('mapClick', context);
	}

	// меняет стиль курсора при прохождении через полигон
	// работает только когда полигон закончен (имеет 3 и более точек)
	setCursorStyle(style){
		if (this.isComplete()){
			this.Area.setCursorStyle(style);
		}
	}

	/*
		Подготавливает плашку для вывода свойств объекта
	*/
	preparePopup(){
		if (this.props && Object.keys(this.props).length){
			var self = this;
			this.popup = this.map.createHashPopup(this.getCenter(), this, this.props, StaticMap.getStyleCollection().popups.popupOffsets.bigOffset, false);
			this.popup.addListener('fieldsUpdate', function(context){
				for (var i = 0; i < context.data.length; i++){
					self.props[context.data[i].fieldName] = context.data[i].value;
				}				
			});
		}
	}

	/*
		Перезаписывает координаты объекта
	*/
	setLatLngs(ll){
		if (this.Area){
			this.Area.setLatLngs(ll);
			this.redrawBorders();
			this.createStretchers();			
			this.ghostArea.setLatLngs(this.Area.getLatLngs());
			this.adjustMarkers();
		}
	}

	hasBorders(){
		return false;
	}

	hasMarkers(){
		return false;
	}

	hasStretchers(){
		return false;
	}

	getArchetype(){
		return 'Polygon';
	}

	/*
		Возвращает ID всех примитивов, из которых состоит объект
	*/
	grabIDs(){
		var result = [];
		// ID области
		result.push(this.Area.objectID);		
		// плашка
		if (this.popup) result.push(this.popup.objectID);
		return result;
	}

	/*
		Пикет не редактируется и не создаётся интерактивно, поэтому методы, отвечающие за анимацию редактирования, границы, стретчеры, добавление точек и т.д. выключены
	*/
	createGhostArea(coords){}
	dragStartHandler(context){}
	dragEndHandler(context){}
	dragHandler(context){}
	createMarkers(){}
	adjustMarkers(){}	
	createBorder(index){}	
	createBorders(){}	
	redrawBorders(){}	
	destroyBorders(){}
	destroyBorder(index){}
	refresh(data){}
	stretch(){}
	freeze(){}	
	pushPoint(coords){}	
	splitBorder(index, coords){}
	traspose(newCenter){}
	addNode(index, coords){}
	stretcherDragHandler(context){}
	stretcherDragStartHandler(context){}
	stretcherDragEndHandler(context){}
}
},{}],18:[function(require,module,exports){

/*
	Плановый маршрут без указания остановок.
	Создание: развертывание (через мониторинг);
	ПМ нельзя растягивать, выделять и удалять, но можно скрыть.
	Имеет стрелки, указывающие направление, которые можно показать или скрыть;
	Не взаимодействует с другими объектами.
*/
window.MPlannedRoute = class MPlannedRoute extends MSimpleRoute{
	constructor(data, map){
		// создаём маршрут как стандартный линейный объект
		super(data, map);		
	}

	createArea(coords){
		// создаем область стандартно
		super.createArea(coords);		
		// создаем стрелки
		this.createArrows();
		// показываем стрелки
		this.showArrows();
	}
}
},{}],19:[function(require,module,exports){
/*
	Точечный объект, обозначаемый маркером
*/
window.MPointObject = class MPointObject extends StaticObject{

	constructor(data, map){
		super(data, map);
		this.minimumNodes = 1;
		if (data.coords){
			this.createArea(data.coords);
			this.subscribe();
		} else this.isVisible = false;
	}

	createArea(coords){
		this.Area = this.map.createMarker(coords, this, StaticMap.getStyleCollection().markers.defaultMarker, this.isStretching);
		var self = this;
		if (this.isComplete()){
			this.Area.show();			
		}		
		this.Area.addListener('click', function(context){
			context.objectID = self.objectID;
			self.fire('mapClick', context);
		});
	}

	/*
		В отличии от других типов объектов, добавление точки перезаписывает координаты полностью (точка одна)
	*/	
	pushPoint(coords, index){		
		if (this.isComplete()){
			this.Area.setLatLngs(coords);			
		} else {
			this.createArea(coords);
		}		
	}

	freeze(){		
		this.isStretching = false;
		this.Area.disableDragging();
	}

	getArchetype(){
		return 'Point';
	}

	grabIDs(){
		var result = [];
		result.push(this.Area.objectID);
		if (this.popup) result.push(this.popup.objectID);
		return result;
	}
}
},{}],20:[function(require,module,exports){
window.MRegion = class MRegion extends MGeoZone{
	constructor(data, map){
		super(data, map);		
	}

	/*
		Создание области объекта
	*/
	createArea(coords){
		this.Area = this.map.createPolygon(coords, this, StaticMap.getStyleForObject(this));
		var self = this;
		if (this.isComplete()){
			this.Area.show();
		}
		this.Area.addListener('click', function(context){
			context.objectID = self.objectID;
			self.fire('mapClick', context);
		});
	}

	subscribe(){}

	/*
		Создание маркеров объекта
	*/
	createMarkers(){}

	/*
		Корректирует позицию центрального маркера региона
	*/
	adjustMarkers(){}

	/*
		Создание границы с номером index
	*/
	createBorder(index){}

	/*
		Создание (пересоздание) границ объекта
	*/
	createBorders(){}

	/*
		Полная перерисовка границ объекта
	*/
	redrawBorders(){}

	/*
		Удаление границ объекта
	*/
	destroyBorders(){}

	/*
		Возвращает true, если объект имеет кликабельные границы
	*/
	hasBorders(){
		return false;
	}

	hasMarkers(){
		return false;
	}

	hasStretchers(){
		return false;
	}
}
},{}],21:[function(require,module,exports){
/*
	Дорога, обозначаемая ломаной. Дробится на пикеты;
	Создание: поточечно, развертывание;
	Можно растягивать, выделять, удалять, скрывать;
	Не взаимодействует с другими объектами.
*/
window.MRoad = class MRoad extends MLinearObject{
	constructor(data, map){
		super(data, map);
	}
}
},{}],22:[function(require,module,exports){
/*
	Маршрут, соединяющий контрольные точки прямыми линиями.
	Создание: поточечно, развертывание;	
	Можно растягивать, выделять, удалять, скрывать.
	Приклеивается к объектам;
*/
window.MSimpleRoute = class MSimpleRoute extends MLinearObject{
	constructor(data, map){
		super(data, map);
		this.subscribe();
	}

	/*createArea(coords){
		var self = this;
		this.Area = this.map.createPolyline(coords, this, StaticMap.getStyleForObject(this));
		if (this.isComplete()){
			this.Area.show();
		}
		this.Area.addListener('click', function(context){
			context.objectID = self.objectID;
			self.fire('mapClick', context);
		});		
	}*/

	subscribe(){
		super.subscribe();
		var self = this;
		this.map.addListener('zoom', function(context){
			if (context.zoom >= 14 && self.arrows.length){				
					self.showArrows();				
			} else {
				self.hideArrows();
			}
		});
	}
}
},{}],23:[function(require,module,exports){
/*
	Составной объект для рисования на карте
*/
window.StaticObject = class StaticObject extends SmartObject{

	constructor(data, map, style){
		super();
		this.objectID = data.objectID;
		// основная область объекта
		this.Area = null;
		// минимальное количество точек в объекте, начиная с которого он начинает отображаться
		this.minimumNodes = 0;
		// границы
		this.borders = [];
		// маркеры
		this.markers = [];
		// стретчеры (маркеры для растягивания)
		this.stretchers = [];
		// плашки маркеров растягивания для точного задания координат и удаления вершин
		this.stretcherPopups = [];
		// плашка, показывающая свойства
		this.infoPopup = null;
		// плашка для редактирования свойств
		this.inputPopup = null;
		// ссылка на карту
		this.map = map;
		// идентификатор группы, в которую входит объект
		this.group = data.groupID || null;
		// видимость объекта
		this.isVisible = true;
		// выделен ли объект
		this.isSelected = false;
		// растягивается ли объект в данный момент
		this.isStretching = false;
	}

	/*
		Перезаписывает координаты объекта;
		обновляется область, границы, маркеры и стретчеры;
	*/
	setLatLngs(ll){
		// метод не даст вывести объект в нестабильное состояние
		if (ll.length < this.minimumNodes) return;
		var delta = 0;
		if (this.Area){
			this.Area.setLatLngs(ll);
		} else {
			this.createArea(ll);
		}
		if (this.isComplete()){
			if (this.hasBorders()){
				// сверяем количество границ				
				delta = this.borders.length - ll.length-1;
				// недобор
				if (delta < 0){					
					// досоздаём границы
					for (var i = this.borders.length; i < ll.length; i++){
						this.borders.push(this.createBorder(i));
					}
				} else if (delta > 0){ 
				// перебор
					this.borders = this.borders.slice(0, ll.length);
				}
				// как раз
				// перебираем границы и меняем их координаты
				for (var i = 0; i < this.borders.length-1; i++){
					this.borders[i].setLatLngs([ll[i], ll[i+1]]);
				}
			}
			// маркеры
			if (this.hasMarkers()){
				if (this.markers.length){
					this.adjustMarkers();
				} else {
					this.createMarkers();
				}
			}
			// стретчеры
			if (this.hasStretchers()){
				// сверяем количество
				delta = this.stretchers.length - ll.length;
				// недобор или переор
				if (delta < 0){
					for (var i = this.stretchers.length; i < ll.length; i++){
						this.stretchers.push(this.createStretcher(i));
						this.stretcherPopups.push(this.createStretcherPopup(i));
					}					
				} else if (delta > 0){
					this.borders = this.borders.slice(0, ll.length);
				}
				for (var i = 0; i < ll.length; i++){
					this.stretchers[i].setLatLngs(ll[i]);
					this.stretcherPopups[i].setLatLngs(ll[i]);
				}
			}
		}
	}

	/*
		Директивно изменяет положение вершины с номером index, передвигая её в положение coords 
	*/
	moveNodeTo(index, coords){
		this.Area.moveNodeTo(index, coords);
		// двигаем границы, примыкающие к вершине
		if (this.hasBorders() && this.isComplete()){
			var b = this.getAdjacentBorders(index);
			var l = null;
			if (b.next || b.next === 0){
				l = this.borders[b.next].getLatLngs();
				l[0] = coords;
				this.borders[b.next].setLatLngs(l);
			}
			if (b.prev || b.prev === 0){
				l = this.borders[b.prev].getLatLngs();
				l[1] = coords;
				this.borders[b.prev].setLatLngs(l);
			}
		}
		if (this.hasStretchers()){
			if (this.stretchers[index]){
				this.stretchers[index].setLatLngs(coords);
				this.stretcherPopups[index].setLatLngs(coords);
			}
		}
	}

	/*
		Удаляет точку из объекта
	*/
	removeNode(index){
		// убираем из координат объекта точку, переписываем координаты области		
		this.Area.removeNode(index);
		this.ghostArea.setLatLngs(this.Area.getLatLngs());			
		// удаляем стретчер и его плашку
		this.removeStretcher(index);
		this.removeStretcherPopup(index);		
		// поправляем маркеры
		this.adjustMarkers();
		// перерисовываем границы
		this.redrawBorders();
	}

	getLatLngs(){
		var ll = [];		
		if (this.Area){			
			ll = this.Area.getLatLngs();			
		}
		return ll;
	}

	getCenter(){
		var res = null
		if (this.Area){
			res = this.Area.getCenter();
		}
		return res;	
	}

	getBounds(){
		if (this.ghostArea) return this.ghostArea.getBounds()
		else return this.Area.getBounds();
	}

	/*
		Создание маркеры объекта
	*/
	createMarkers(){}

	destroyMarkers(){
		for (var i = 0; i < this.markers.length; i++){
			this.map.removePrimitive(this.markers[i]);
		}
		this.markers = [];
	}

	/*
		Подгоняет маркеры статического объекта в случае, если контур изменился
	*/
	adjustMarkers(){}

	/*
		Показ маркеров объекта
	*/
	showMarkers(){
		for (var i = 0; i < this.markers.length; i++){
			this.markers[i].show();			
		}
	}

	/*
		Скрытие маркеров объекта
	*/
	hideMarkers(){
		for (var i = 0; i < this.markers.length; i++){
			this.markers[i].hide();
		}
	}

	/*
		Создание границ объекта
	*/
	createBorders(){}

	/*
		Удаление границ объекта
	*/
	destroyBorders(){
		for (var i=0; i<this.borders.length; i++){
			this.map.removePrimitive(this.borders[i]);
		}
		this.borders = [];
	}

	/*
		Создание отдельной границы
	*/
	createBorder(i){}	

	/*
		Полная перерисовка границ объекта
	*/
	redrawBorders(){		
		// удаляем стороны
		this.destroyBorders();
		// если в объекте не хватает вершин, стороны не создаются
		// создаем их заново		
		this.createBorders();		
		// показываем, если надо
		if (this.isSelected && this.isVisible && this.isComplete()){			
			this.showBorders();
		}		
	}

	/*
		Показ границ
	*/
	showBorders(){	
		for (var i = 0; i < this.borders.length; i++){

			this.borders[i].show();
		}
	}

	/*
		Скрытие границ
	*/
	hideBorders(){
		for (var i = 0; i < this.borders.length; i++){
			this.borders[i].hide();
		}
	}

	/*
		Возвращает true, если объект имеет кликабельные границы
	*/
	hasBorders(){
		return false;
	}

	hasMarkers(){
		return false;
	}

	hasStretchers(){
		return false;
	}

	// уничтожение всех стретчеров объекта
	destroyStretchers(){
		for (var i = 0; i < this.stretchers.length; i++){
			this.map.removePrimitive(this.stretchers[i]);
			this.map.removePrimitive(this.stretcherPopups[i]);
		}
		this.stretchers = [];
		this.stretcherPopups = [];
	}

	/*
		Пересоздание стретчеров объекта и плашек к ним
	*/
	createStretchers(){
		this.destroyStretchers();
		for (var i = 0; i < this.getLatLngs().length; i++){
			this.stretchers.push(this.createStretcher(i));
			if (this.isStretching){
				this.stretchers[this.stretchers.length-1].show();
			}
			this.stretcherPopups.push(this.createStretcherPopup(i));
		}
	}

	/*
		Создание плашки для стретчера
	*/
	createStretcherPopup(index){
		var
			coords = this.getLatLngs()[index],
			content = {'Координаты': {
				value: coords,
				dataType: 'coordinates',
				commands: ['Ok', 'Удалить']
			}},
			p = this.map.createStretcherPopup(coords, this, content, StaticMap.getStyleCollection().popups.popupOffsets.smallOffset, false, index),
			self = this;
			// обработчики событий перемещения и удаления вершины
			p.addListener('moveNodeDirect', function(context){
				context.objectID = self.objectID;
				context.index = this.index;				
				self.map.fire('moveNodeDirect', context);
			});
			p.addListener('removeNode', function(context){
				context.objectID = self.objectID;
				context.index = this.index;				
				self.map.fire('removeNode', context);
			});
		return p;
	}

	/*
		Создание стретчера (возвращает объект)
	*/	
	createStretcher(index){		
		var 
			// создаем маркер
			s = this.map.createMarker(this.getLatLngs()[index], this, StaticMap.getStyleCollection().markers.defaultStretcher, true),
			// передача контекста через замыкание
			self = this;
		// присваиваем стретчеру индекс, связывающий его с узловой точкой объекта и его границами
		s.index = index;
		s.adjucentBorders = {};
		// обработчики событий стретчера
		// драгстарт - сделать смежные со стретчером стороны пунктирными
		s.addListener('dragstart', function(context){
			context.index = this.index;
			// сгенерировать событие о начале растягивания
			self.fire('stretcherDragStart', context);
		});
		// драг - изменить положение связанной вершины и смежных границ, перезаписать координаты полигона
		s.addListener('drag', function(context){
			context.index = this.index;
			self.fire('stretcherDrag', context);
		});
		// драгэнд - вернуть стили связанных сторон взад, кинуть событие (контур объекта изменился)
		s.addListener('dragend', function(context){
			context.index = this.index;
			self.fire('stretcherDragEnd', context);
			
		});
		s.addListener('click', function(context){
			self.stretcherPopups[this.index].show();
		});
		return s;
	}
	
	/*
		Показ стретчеров
	*/
	showStretchers(){		
		for (var i=0; i<this.stretchers.length; i++){
			this.stretchers[i].show();
		}
	}

	/*
		Скрытие стретчеров
	*/
	hideStretchers(){		
		for (var i = 0; i < this.stretchers.length; i++){
			this.stretchers[i].hide();
		}
	}

	// добавление стретчера с автоматическим сдвигом последующих
	addStretcher(position, node){
		var  s = this.createStretcher(node);		
		this.stretchers.splice(position, 0, s);
		for (var i = position + 1; i < this.stretchers.length; i++){
			this.stretchers[i].index++;
		}
		if (this.isStretching){		
			s.show();
		}		
	}

	// добавление плашки стретчера с автоматическим сдвигом последующих
	addStretcherPopup(position, node){
		var  s = this.createStretcherPopup(node);
		this.stretcherPopups.splice(position, 0, s);
		for (var i = position + 1; i < this.stretcherPopups.length; i++){
			this.stretcherPopups[i].index++;
		}		
	}

	// удаление стретчера с автоматическим сдвигом последующих	
	removeStretcher(index){		
		this.map.removePrimitive(this.stretchers[index]);
		this.stretchers.splice(index, 1);
		for (var i = index; i < this.stretchers.length; i++){
			this.stretchers[i].index--;
		}
	}

	// удаление плашки стретчера с автоматическим сдвигом последующих
	removeStretcherPopup(index){
		this.map.removePrimitive(this.stretcherPopups[index]);
		this.stretcherPopups.splice(index, 1);
		for (var i = index; i < this.stretcherPopups.length; i++){
			this.stretcherPopups[i].index--;
		}
	}

	show(){
		this.isVisible = true;
		this.Area.show();
		if (this.isSelected){
			this.showBorders();
			this.showMarkers();
		}
	}

	// скрытие объекта
	hide(){
		// развыбираем объект
		if (this.isSelected){
			this.unselect();
		}
		this.isVisible = false;
		this.Area.hide();
		this.fire('hideView', {objectID: this.objectID});
	}

	setStyle(style){	
		this.Area.setStyle(style);		
	}

	select(){
		this.isSelected = true;
		if (this.isVisible) this.highlightOn();
	}

	unselect(){		
		this.isSelected = false;
		if (this.isVisible) {
			this.highlightOff();
		}
		if (this.isStretching){
			this.freeze();
		}
		let context = {message: 'Object was unselected', objectID: this.objectID};
		this.fire('unselectView', context);
	}

	highlightOn(){		
		this.showMarkers();
		this.showBorders();		
		this.setStyle(StaticMap.getStyleForObject(this));		
	}

	highlightOff(){		
		this.hideMarkers();
		this.hideBorders();
		this.setStyle(StaticMap.getStyleForObject(this));
	}

	/*
		Добавляет объекту точку с координатами coords в позицию index. Если позиция не указана, добавляет в конец.
	*/
	pushPoint(coords, index){}

	/*
		Добавляет объекту обработчики событий
	*/
	subscribe(){

	}

	/*
		Возвращает true если объект находится в стабильном состоянии и его можно в таком виде сохранить
	*/
	isComplete(){		
		return (this.getLatLngs().length >= this.minimumNodes);
	}

	/*
		Переводит объект в режим растягивания
	*/
	stretch(){
		this.isStretching = true;
		this.showStretchers();		
	}

	/*
		Возвращает индексы границ (prev & next), прилегающих к узловой точке объекта с номером index.
	*/
	getAdjacentBorders(index){
		var result = {};		
		if (this.hasBorders()){
			switch(this.getArchetype()){
				case 'Polygon': 
					result.next = index;
					result.prev = (index + this.borders.length - 1) % this.borders.length;
					break;
				case 'Line':
					if (index > 0) result.prev = index - 1;
					if (index < this.getLatLngs().length-1) result.next = index;
					break;
				case 'Point':
				case 'Circle':
					break;
			}
		}			
		return result;
	}

	getArchetype(){
		return 'None';
	}

	freeze(){
		this.isStretching = false;	
		this.hideStretchers();
	}

	/*
		Возвращает ID всех примитивов, из которых состоит объект
	*/
	grabIDs(){
		return [];
	}
}
},{}],24:[function(require,module,exports){
/* 
	Сложная область объекта (абстрактный класс)
	Состоит из нескольких примитивов, организованых определённым образом.
	Имеет те же методы, что и обычный примитив (полигон, линия и т.д.), плюс grabIDs.
*/
window.ComplexArea = class ComplexArea extends SmartObject{

	constructor(ll){
		super();
	}

	getLatLngs(){}

	setLatLngs(){}

	setStyle(style){}

	getCenter(){}

	show(){}

	hide(){}

	grabIDs(){}
}
},{}],25:[function(require,module,exports){
/* 
	Сложная область линейного объекта
	Состоит из совокупности отрезков-сегментов.
	Имеет те же методы, что и обычный примитив (полигон, линия и т.д.), плюс grabIDs.
*/
window.LinearObjectComplexArea = class LinearObjectComplexArea extends ComplexArea{

	constructor(ll, owner, style, startsAt=0){
		super();
		this.owner = owner;
		this.latlngs = ll;
		this.segments = [];
		this.style = style;
		this.isVisible = false;
		this.calc = owner.calc;
		this.startsAt = startsAt;
		this.length = 0;
		// если есть из чего делать отрезки, создаём их
		if (ll.length > 1){
			for (var i = 0; i < ll.length-1; i++){				
				this.addSegment([ll[i], ll[i+1]], this.style, i);
			}
			this.length = this.segments[this.segments.length-1].endsAt;
		}
	}

	/* Общие методы */
	getLatLngs(){
		return this.latlngs;
	}

	setLatLngs(ll){		
		// стираем сегменты, если они есть
		for (var i = 0; i < this.segments.length; i++){
			this.owner.map.removePrimitive(this.segments[i]);
		}
		this.segments = [];		
		this.latlngs = ll;		
		if (this.latlngs.length > 1){			
			for (var i = 0; i < this.latlngs.length-1; i++){
				let coords = [this.latlngs[i], this.latlngs[i+1]];
				let index = i;				
				this.addSegment(coords, this.style, index);
			}
		}
	}

	setStyle(style){
		for (var i = 0; i < this.segments.length; i++){
			this.segments[i].setStyle(style);
		}
	}

	getColor(){
		return this.segments[0].getColor();
	}

	getCenter(){}

	show(){
		this.isVisible = true;
		this.segments.forEach(function(seg){
			seg.show();
		});
	}

	hide(){
		this.isVisible = false;
		this.segments.forEach(function(seg){
			seg.hide();
		});
	}

	grabIDs(){
		var result = [];
		for (var i in this.segments){			
			result.push(this.segments[i].objectID);
		}		
		return result;
	}

	/* Специальные методы */

	// добавление сегмента в позицию index
	addSegment(ll, style, index){
		// создаем линию, овнер примитива - область, а не сам ЛО		
		var 
			seg = this.owner.map.createLine(ll[0], ll[1], this, style),
			self = this;		
		seg.index = index;
		// если сегмент добавляется не в начало, то считаем его параметры отталкиваясь от предыдущего сегмента
		// ставим отметку начала		
		if (seg.index > 0){
			seg.startsAt = this.segments[index-1].endsAt;
		} else {
			seg.startsAt = this.startsAt;
		}
		// находим длину и отметку конца
		seg.length = this.calc.getDistance(ll[0], ll[1]);
		seg.endsAt = seg.startsAt + seg.length;
		seg.addListener('click', function(context){
			context.segIndex = this.index;
			context.distance = self.calc.getDistance( this.getLatLngs()[0], context.coords);
			self.fire('click', context);
		});
		seg.addListener('mouseover', function(context){
			context.segIndex = this.index;
			context.distance = self.calc.getDistance( this.getLatLngs()[0], context.coords);
			self.fire('mouseover', context);
		});
		seg.addListener('mouseout', function(context){
			context.segIndex = this.index;
			self.fire('mouseout', context);
		});
		// кладем новый сегмент в массив
		this.segments.splice(index, 0, seg);		
		if (this.isVisible){
			seg.show();
		}		
	}
	
	// перемещает вершину с номером index в позицию coords
	moveNodeTo(index, coords){
		// определяем, какие сегменты прилегают к перемещаемой вершине
		var adjucentBorders = this.owner.getAdjacentBorders(index);
		// изменяем координаты предыдущего и следующего сегментов в зависимости от их наличия
		if (adjucentBorders.hasOwnProperty('next')){
			let bnext = this.segments[adjucentBorders.next].getLatLngs();			
			bnext[0] = coords;
			this.segments[adjucentBorders.next].setLatLngs(bnext);
		}
		if (adjucentBorders.hasOwnProperty('prev')){
			let bprev = this.segments[adjucentBorders.prev].getLatLngs();
			bprev[1] = coords;
			this.segments[adjucentBorders.prev].setLatLngs(bprev);
		}
		// изменяем общие координаты самой области
		this.latlngs.splice(index, 1, coords);
	}

	removeNode(index){		
		if (index === 0){
			this.owner.map.removePrimitive(this.segments[0]);
			this.segments.splice(0,1);
			this.recalcSegments(0);
		} else if (index === this.latlngs.length-1){
			this.owner.map.removePrimitive(this.segments[this.segments.length-1]);
			this.segments.splice(this.segments.length-1,1);
		} else {
			this.owner.map.removePrimitive(this.segments[index]);
			this.segments[index-1].setLatLngs([this.latlngs[index-1], this.latlngs[index+1]]);
			this.segments.splice(index,1);
			this.recalcSegments(index-1);
		}
		this.latlngs.splice(index, 1);
		
	}
	
	// перемещает вершину с номером index в позицию coords
	pushPoint(coords){
		this.latlngs.push(coords);
		if (this.latlngs.length > 1){
			var ll = [this.latlngs[this.latlngs.length-2], this.latlngs[this.latlngs.length-1]];
			var index = this.segments.length;
			this.addSegment(ll, this.style, index);
		}
	}

	// добавляет точку в середину объекта
	insertPoint(index, coords){
		// вставляем точку в указанную позицию
		this.latlngs.splice(index, 0, coords);
		var 
			ll1 = [], ll2 = [],
			segmentIndex;
		// если точка добавляется в начало
		if (index === 0){
			ll = [coords, this.latlngs[0]];
			this.addSegment(ll, this.style, index);
			// пересчитываем длины и индексы сегментов
			this.recalcSegments(index+1);
		} else 
		// если точка добавляется в конец
		if (index === this.latlngs.length){
			ll = [this.latlngs[this.latlngs.length-1], coords];
			this.addSegment(ll, this.style, index);
			// пересчитывать ничего не нужно
		} else
		// если точка добавляется в середину
		{
			// нужно удалить сегмент и заменить его на 2, сходящихся во вставляемой точке
			// индекс удаляемого сегмента
			segmentIndex = index - 1;
			// готовим координаты
			ll1 = [this.segments[segmentIndex].getLatLngs()[0], coords];
			ll2 = [coords, this.segments[segmentIndex].getLatLngs()[1]];
			// создаём первый сегмент-заменитель			
			this.addSegment(ll1, this.style, segmentIndex);
			// создаём второй сегмент-заменитель
			this.addSegment(ll2, this.style, segmentIndex+1);
			// убираем расщеплённый сегмент
			this.owner.map.removePrimitive(this.segments[segmentIndex+2]);
			this.segments.splice(segmentIndex+2, 1);
			// пересчитываем параметры идущих следом сегментов
			this.recalcSegments(segmentIndex+2);
		}		
	}

	// пересчитывает параметры сегментов ЛО начиная с сегмента с номером index
	recalcSegments(index){		
		var start;
		// если рассчет начинается с самого начала, то первым делом обсчитываем отдельно начальный сегмент
		if (index > 0){
			start = index;
		} else {
			this.segments[0].startsAt = 0;
			this.segments[0].length = this.calc.getDistance(this.segments[0].getLatLngs()[0], this.segments[0].getLatLngs()[1]);
			this.segments[0].endsAt = this.segments[0].startsAt = this.segments[0].length;
			this.segments[0].index = 0;
			start = 1;
		}
		// перебираем сегменты до конца, считаем индекс, начало, конец и длину
		for (var i = start; i < this.segments.length; i++){
			this.segments[i].startsAt = this.segments[i-1].endsAt;
			this.segments[i].length = this.calc.getDistance(this.segments[i].getLatLngs()[0], this.segments[i].getLatLngs()[1]);
			this.segments[i].endsAt = this.segments[i].startsAt = this.segments[i].length;
			this.segments[i].index = this.segments[i-1].index + 1;
		}
	}

	// удаляет сегмент с номером index
	removeSegment(index){
		var ll = null;
		// удаляем примитив с карты		
		this.owner.map.removePrimitive(this.segments[index]);
		// если удаляемый сегмент был не первым/последним, то смыкаем сегменты, между которыми образовалась дырка
		if (index > 0 && index < this.segments.length-1){			
			ll = [this.segments[index-1].getLatLngs()[0], this.segments[index+1].getLatLngs()[0]];
			this.segments[index-1].setLatLngs(ll);
		}
		// удаляем сегмент из массива
		this.segments.splice(index, 1);
	}
}
},{}],26:[function(require,module,exports){
/*
	Класс примитивного объекта, добавляемого на карту
*/
window.MapObject = class MapObject extends SmartObject{
	constructor(id, layer, data, owner, style){
		super();
		this.objectID = id;
		this.style = style;
		this.owner = owner;
		this.isVisible = false;
	}

	/*
		Возвращает массив с координатами объекта, каждый элемент - объект с полями lat и lng
	*/
	getLatLngs(){return []}

	/*
		Перезаписыват координаты объекта
	*/
	setLatLngs(ll){}	

	setStyle(style){}

	show(){}

	hide(){}

	/*
		Возвращает прямоугольник, в который укладывается объект на карте
	*/
	getBounds(){}

	getCenter(){}

	/*
		Параллельный перенос объекта через изменение его центра
	*/
	transpose(newCenter){}
}
},{}],27:[function(require,module,exports){
/*
	Поле для отображения в плашке
*/
window.PopupField = class PopupField extends SmartObject{	
	constructor(key, value, index, dataType, commands, owner){
		super();
		// имя поля
		this.name = key;
		// значение
		this.value = value;
		// порядковый номер в массиве
		this.index = index;
		// тип данных (пока не используется)
		this.dataType = dataType;
		// IDшники элементов для ввода/изменения значения и для статичного отображения
		this.inputElement = owner.objectID+'.inputElement.'+this.index;
		this.displayElement = owner.objectID+'.displayElement.'+this.index;
		// определяем тип поля ввода
		if (this.dataType){
			switch (this.dataType){
				case 'text':
				case 'coordinates':
					this.inputType = 'text';
					break;
				case 'date':
				case 'datetime':
					this.inputType = 'text';
					break;
				case 'number':
				case 'integer':
				case 'float':
					this.inputType = 'text';
					break;
				case 'boolean':
					this.inputType = 'checkbox';
					break;
				case 'list':
					this.inputType = 'combobox';
					break;
			}
		} else {
			// если тип данных не указан, будет использоваться обычное текстовое поле
			this.inputType = 'text';
		}
		// кнопки команд
		this.commands = [];
		if (commands){			
			for (var i = 0; i < commands.length; i++){				
				this.commands.push({
					caption: commands[i],
					elementID: owner.objectID+'.commandBtn.'+i
				});
			}
		}
		// только чтение или нет
		this.readOnly = owner.readOnly;
		// функция, проверяющая значение на корректность
		this.extractValue = this.getExtractor(this.dataType);		
	}

	show(){
		var self = this;
		if (this.readOnly){
			document.getElementById(this.displayElement).textContent = this.value;
		} else {
			document.getElementById(this.inputElement).value = this.value;
			// при фокусе на поле для ввода кидаем событие
			document.getElementById(this.inputElement).onfocus = function(){
				self.fire('startEdit', {index: self.index});
			}
			// при переходе фокуса на другой объект обновляем значение поля
			// тут будет проверка ввода после снятия фокуса с элемента, но это потом
			document.getElementById(this.inputElement).onblur = function(){				
				if (self.extractValue(this.value)){					
					self.fire('validated', {index: self.index});
				} else {
					self.fire('ivalidValue', {index: self.index});
				}
			}
		}
	}

	setValue(newValue){		
		// если новое значение прошло проверку
		if (this.extractValue(newValue)){			
			// если плашка только для чтения
			// проверяем, существует ли html-элемент, в который можно записать значение и пишем в него
			if (this.readOnly){
				if (document.getElementById(this.displayElement)){
					document.getElementById(this.displayElement).textContent = this.value.toString();
				}
			// для редактируемой плашки - аналогично
			} else {
				if (document.getElementById(this.inputElement)){
					document.getElementById(this.inputElement).value = this.value.toString();
				}
			}
		}
	}

	getExtractor(dataType){		
		var extractor = this.extractText;
		switch (dataType){
			case 'text':
			case 'integer':
			case 'float':
			case 'boolean':
			case 'list':
			case 'date':
			case 'datetime':
				extractor = this.extractText;
				break;
			case 'coordinates':
				extractor = this.extractCoordinates;
				break;
		}		
		return extractor;
	}
	
	/*
		Функции для валидации значений
	*/

	// пустой валидатор, не проверяющий ничего
	extractText(value){
		this.value = value;
		return true;
	}

	/*
		Возвращает true и записывает значение в поле, если оно корректное; в противном случае вернет false.
	*/
	extractCoordinates(value){
		var result = false, buf = value.toString();
		buf = buf.split(',');
		if (buf.length === 2){
			if (!isNaN(buf[0]) && buf[0].indexOf('.') != -1 && !isNaN(buf[1]) && buf[1].indexOf('.') != -1){
				result = true;
				this.value = [parseFloat(buf[0]), parseFloat(buf[1])];
			}
		}
		return result;
	}

	extractDate(value){}
	extractTime(value){}
	extractDatetime(value){}
	extractNumber(value){}
	extractInteger(value){}
	extractFloat(value){}
}
},{}],28:[function(require,module,exports){

/*
	Класс, отвечающий за логирование изменений, их откат и повтор
	Определены следующие операции:
		запись - обрезает историю по текущей позиции, записывает в неё новую команду, сдвигается на 1 позицию вперёд;
		откат (ctrl+x) - отменяет текущую команду и смещается по истории команд назад;
		повтор (ctrl+y) - смещается по истории команд вперед и повторно выполняет очередную команду;
		обрезание - обрезает историю по текущей позиции;
		очистка - смещает позицию в начало и обрезает историю, полностью зачищая её;
	Все манипуляции с историей выдают событие logChange, в контексте которого передаётся информация о возможности ctrl+x и ctrl+y
*/
window.History = class History extends SmartObject{
	constructor(){
		super();
		// массив для записи команд
		this.log = [];
		// текущая позиция в логе (при пустой истории равна -1)
		this.position = -1;
		// флаг, показывающий, возможна ли отмена
		Object.defineProperty(this, 'undoEnabled', {			
			get: () => {return (this.position >= 0)}
		});
		// флаг, показывающий, возможен ли возврат
		Object.defineProperty(this, 'redoEnabled', {			
			get: () => {return (this.position < this.log.length-1)}
		});
	}

	// записывает очередную команду в историю
	write(command){
		// обрезаем лог, стирая отменённые операции
		this.truncate();
		this.position++;
		this.log.push(command);
		this.fire('logChange', {undoEnabled: this.undoEnabled, redoEnabled: this.redoEnabled});		
	}

	// отмена предыдущего действия (движение по логу назад)
	undo(){
		// если отмена возможна, откатываем команду, находящуюся в текущей позиции, а позицию сдвигаем на 1 назад
		if (this.undoEnabled){
			this.log[this.position].undo();
			this.position--;
			this.fire('logChange', {undoEnabled: this.undoEnabled, redoEnabled: this.redoEnabled});
		}
	}

	// возврат последнего отменённого действия (движение по логу вперёд)
	redo(){
		// если возврат возможен, то двигаем позицию на 1 вперед и выполняем команду
		if (this.redoEnabled){
			this.position++;
			this.log[this.position].execute();
			this.fire('logChange', {undoEnabled: this.undoEnabled, redoEnabled: this.redoEnabled});
		}
	}

	// обрезает лог до последней задействованной команды, делая невозможным вызов redo()
	truncate(){
		this.log.splice(this.position+1, this.log.length);		
	}

	// полностью стирает историю изменений
	clear(){
		this.position = -1;
		this.truncate();
		this.fire('logChange', {undoEnabled: this.undoEnabled, redoEnabled: this.redoEnabled});
	}
}
},{}],29:[function(require,module,exports){
window.Command = class Command {

	constructor(receiver, context){
		this.receiver = receiver;
	}
	
	execute(){}

	undo(){}
}

/*
	Команда для работы с геообъектами (абстрактная)
	Все подклассы этой команды в прямом методе выделяют изменяемый объект и переводят его в режим растягивания перед выполнением действия;
	Затем действие выполняется, после чего нужно показать изменённый объект на карте, если изменённая часть не попадает в область обзора;
*/
window.GzmCommand = class GzmCommand extends Command{
	constructor(receiver, context, needsStretching = true, needsSelection = true){
		super(receiver, context);
		this.objectID = context.objectID;
		this.needsStretching = needsStretching;
		this.needsSelection = needsSelection;
	}

	/*
		Выделяет изменяемый объект и переводит его в режим растягивания, если это не сделано
	*/
	prepareObject(){		
		// выделяем объект, если он не выделен
		if (this.needsSelection && !this.receiver.map.staticObjects[this.objectID].isSelected){
			this.receiver.map.selectObject(this.objectID, false);
		}
		// Если объект не в режиме растягивания, перевести его в этот режим
		if (this.needsStretching && !this.receiver.map.staticObjects[this.objectID].isStretching){
			this.receiver.editor.stretchObject(this.objectID);
		}
	}

	/*
		Наводит карту на изменённый объект, если изменённая часть не попадает в область обзора
	*/
	locateMap(location){
		/*
		Как проверить, является ли аргумент экземпляром нативных границ?
		(Если арг является нативной границей И hasFullVisionOn) ИЛИ (арг является массивом И hasVisionOn)
		то позиционируем карту на объект
		*/
		/*if ((location.radius && !this.receiver.map.hasFullVisionOn(location)) || !this.receiver.map.hasVisionOn(location)){
			this.receiver.map.goToObject(this.objectID);
		}*/
		let
			invisiblePoint = (location instanceof Array && !this.receiver.map.hasVisionOn(location)),
			invisibleArea = (this.receiver.map.checkNativeBounds(location) && !this.receiver.map.hasFullVisionOn(location));
		if (invisiblePoint || invisibleArea){ this.receiver.map.goToObject(this.objectID); }
	}

	/* Развыделяет объект и отключает ему растягивание */
	dropObject(){
		// развыделяем объект, если он выделен
		if (this.receiver.map.staticObjects[this.objectID].isSelected){
			this.receiver.map.dropSelection();
		}
		// Если объект в режиме растягивания, отключаем этот режим
		if (this.receiver.map.staticObjects[this.objectID].isStretching){
			this.receiver.map.staticObjects[this.objectID].freeze();
		}
	}
}

/*
	Команда удаления объекта
*/
window.DeleteCommand = class DeleteCommand extends GzmCommand {

	constructor(receiver, context){
		super(receiver, context, false, true);		
		this.imprint = JSON.parse(JSON.stringify(context));		
	}

	execute(){		
		this.locateMap(this.receiver.map.staticObjects[this.objectID].getBounds());
		this.dropObject();
		// стираем объект с карты и из хранилища ГЗМ
		this.receiver.deleteStaticObject(this.objectID);		
	}

	undo(){		
		var self = this;
		// функция, рекурсивно выкладывающая на карту объекты из слепка
		function restoreObject(obj){
			let uuid = self.receiver.confirmedObjects[obj.objectID];
			if (uuid && !obj.uuid){
				obj.uuid = uuid;
			}
			self.receiver.deployObject(obj.className, obj);
			if (obj.children.length > 0){
				for (let i = 0; i < obj.children.length; i++){
					restoreObject(obj.children[i]);
				}
			}
		}
		// возвращаем объект с помощью слепка
		restoreObject(this.imprint)		
		//this.receiver.deployObject(this.imprint.className, this.imprint);
		this.prepareObject();		
		this.locateMap(this.receiver.map.staticObjects[this.objectID].getBounds());			
	}
}

/*
	Команда быстрого создания объекта по шаблону
*/
window.QuickCreateCommand = class QuickCreateCommand extends GzmCommand{

	constructor(receiver, context, needsStretching = true, needsSelection = true){
		super(receiver, context, needsStretching, needsSelection);		
		this.imprint = context;
		//this.objectID = this.imprint.objectID;
	}

	execute(){		
		// кладем объект на карту
		this.receiver.deployObject(this.imprint.className, this.imprint);
		this.prepareObject();
		this.locateMap(this.receiver.map.staticObjects[this.objectID].getBounds());
		// отключаем у редактора точкособирательный обработчик
		if (this.receiver.editor.getStatus() !== this.receiver.editor.statuses.idle){
			this.receiver.editor.switchStatus(this.receiver.editor.statuses.idle);
		}
	}

	undo(){
		this.locateMap(this.receiver.map.staticObjects[this.objectID].getBounds());
		this.dropObject();
		// удаляем объект
		this.receiver.deleteStaticObject(this.objectID);
		// отключаем у редактора точкособирательный обработчик
		if (this.receiver.editor.getStatus() !== this.receiver.editor.statuses.idle){
			this.receiver.editor.switchStatus(this.receiver.editor.statuses.idle);
		}
	}
}

/*
	Команда, начинающая поточечное создание объекта
*/
window.CreateCommand = class CreateCommand extends GzmCommand{

	constructor(receiver, context, needsStretching = true, needsSelection = true){
		super(receiver, context, needsStretching, needsSelection);		
		this.imprint = context;		
	}

	execute(){
		// кладем объект на карту
		this.receiver.deployObject(this.imprint.className, this.imprint);
		this.prepareObject();
		this.locateMap(this.receiver.map.staticObjects[this.objectID].getBounds());
		// даем редактору новый обработчик клика по карте, чтобы он мог собирать объект по точкам
		if (this.receiver.editor.getStatus() !== this.receiver.editor.statuses.waitForNext){
			this.receiver.editor.switchStatus(this.receiver.editor.statuses.waitForNext);
		}
	}

	undo(){		
		this.locateMap(this.receiver.map.staticObjects[this.objectID].getBounds());
		this.dropObject();
		// удаляем объект
		this.receiver.deleteStaticObject(this.objectID);
		// отключаем у редактора точкособирательный обработчик
		if (this.receiver.editor.getStatus() !== this.receiver.editor.statuses.idle){
			this.receiver.editor.switchStatus(this.receiver.editor.statuses.idle);
		}
	}
}

/*
	Команда визуального редактирования.
	Помимо перехода на изменяемый объект, этот тип команд переводит карту в тот режим работы, который был активен в момент создания команды.
*/
window.VisualEditCommand = class VisualEditCommand extends GzmCommand{
	constructor(receiver, context, status){
		super(receiver, context);
		this.status = status;
	}

	// переключение статуса
	switchStatus(){
		if (this.receiver.editor.getStatus() !== this.status){
			this.receiver.editor.switchStatus(this.status);
		}
	}
}

/*
	Команда растягивания, передвигающая одну из вершин объекта в новую позицию
*/
window.StretchCommand = class StretchCommand extends VisualEditCommand{

	constructor(receiver, context, status){		
		super(receiver, context, status);		
		this.nodeIndex = context.nodeIndex;
		this.oldCoords = context.oldCoords;
		this.newCoords = context.newCoords;		
	}

	execute(){		
		this.prepareObject();
		// Вызвать метод перетаскивания вершины из старой позиции в новую
		this.receiver.staticObjects[this.objectID].moveNodeTo(this.nodeIndex, this.newCoords);
		this.locateMap(this.newCoords);
		this.switchStatus();
	}

	undo(){		
		this.prepareObject();
		// Вызвать метод перетаскивания вершины из новой позиции в старую
		this.receiver.staticObjects[this.objectID].moveNodeTo(this.nodeIndex, this.oldCoords);
		this.locateMap(this.oldCoords);
		this.switchStatus();	
	}
}

window.ChangeRadiusCommand = class ChangeRadiusCommand extends VisualEditCommand{
	constructor(receiver, context, status){		
		super(receiver, context, status);		
		this.oldRadius = context.oldRadius;
		this.newRadius = context.newRadius;		
	}

	execute(){		
		this.prepareObject();
		// Вызвать метод перетаскивания вершины из старой позиции в новую
		this.receiver.staticObjects[this.objectID].setRadius(this.newRadius);
		this.locateMap(this.newCoords);
		this.switchStatus();
	}

	undo(){		
		this.prepareObject();
		// Вызвать метод перетаскивания вершины из новой позиции в старую
		this.receiver.staticObjects[this.objectID].setRadius(this.oldRadius);
		this.locateMap(this.oldCoords);
		this.switchStatus();	
	}
}

/*
	Команда расщепления границы, добавляющая новую точку в контур объекта
*/
window.SplitBorderCommand = class SplitBorderCommand extends VisualEditCommand{

	constructor(receiver, context, status){		
		super(receiver, context);		
		this.coords = context.coords;
		this.borderIndex = context.borderIndex;
		this.nodeIndex = context.nodeIndex;		
	}

	execute(){
		this.prepareObject();
		// расщепляем границу объекта
		this.receiver.staticObjects[this.objectID].splitBorder(this.borderIndex, this.coords);
		this.locateMap(this.coords);
		this.switchStatus();
	}

	undo(){
		this.prepareObject();
		// удаляем точку из объекта, чтобы схлопнуть 2 границы в 1
		this.receiver.staticObjects[this.objectID].removeNode(this.nodeIndex);
		this.locateMap(this.coords);
		this.switchStatus();
	}
}

/*
	Команда удаления точки из контура
*/
window.RemoveNodeCommand = class RemoveNodeCommand extends VisualEditCommand{

	constructor(receiver, context, status){		
		super(receiver, context);
		this.nodeIndex = context.nodeIndex;
		this.coords = context.coords;
	}

	execute(){
		this.prepareObject();
		// удаляем точку из объекта
		this.receiver.staticObjects[this.objectID].removeNode(this.nodeIndex);
		this.locateMap(this.coords);
		this.switchStatus();
	}

	undo(){
		this.prepareObject();
		// возвращаем точку в объект
		this.receiver.staticObjects[this.objectID].addNode(this.nodeIndex, this.coords);
		this.locateMap(this.coords);
		this.switchStatus();
	}
}

/*
	Команда добавления точки в конец, используется при поточечном создании
*/
window.PushCommand = class PushCommand extends VisualEditCommand{

	constructor(receiver, context, status){
		super(receiver, context);
		this.newCoords = context.newCoords;
	}

	execute(){
		this.prepareObject();
		this.receiver.staticObjects[this.objectID].pushPoint(this.newCoords);
		this.locateMap(this.newCoords);
		this.switchStatus();		
	}

	undo(){
		this.prepareObject();
		this.receiver.staticObjects[this.objectID].removeNode(this.receiver.staticObjects[this.objectID].getLatLngs().length-1);
		this.locateMap(this.newCoords);
		this.switchStatus();		
	}
}



/*
	Команда редактирования невизуальных свойств объекта (плашка)
*/
window.EditCommand = class EditCommand extends VisualEditCommand{

	constructor(receiver, context, status){
		super(receiver, context);
		this.oldProps = context.oldProps;
		this.newProps = context.newProps;
		// растягивание не нужно
		this.needsStretching = false;
	}	

	execute(){
		this.prepareObject();
		this.locateMap(this.receiver.map.staticObjects[this.objectID].getBounds());
		// меняем свойства со старых на новые
		this.receiver.staticObjects[this.objectID].props = this.newProps;
		this.switchStatus();
	}

	undo(){
		this.prepareObject();
		this.locateMap(this.receiver.map.staticObjects[this.objectID].getBounds());
		// меняем свойства с новых на старые
		this.receiver.staticObjects[this.objectID].props = this.oldProps;
		this.switchStatus();
	}
}

/*
	Команда полного переноса объекта
*/
window.TransposeCommand = class TransposeCommand extends VisualEditCommand{

	constructor(receiver, context, status){
		super(receiver, context);
		this.oldCenter = context.oldCenter;
		this.newCenter = context.newCenter;
	}

	execute(){		
		// перетаскиваем объект из старой позиции в новую
		this.receiver.staticObjects[this.objectID].transpose(this.newCenter);
		this.prepareObject();
		this.locateMap(this.receiver.map.staticObjects[this.objectID].getBounds());
		this.switchStatus();
	}

	undo(){		
		// перетаскиваем объект из новой позиции в старую
		this.receiver.staticObjects[this.objectID].transpose(this.oldCenter);
		this.prepareObject();
		this.locateMap(this.receiver.map.staticObjects[this.objectID].getBounds());
		this.switchStatus();
	}
}

window.GroupCommand = class GroupCommand extends GzmCommand{

	constructor(receiver, context){
		super(receiver, context, false, true);		
		this.imprint = context;				
	}
	
	execute(){		
		// кладем объект на карту
		this.receiver.deployObject(this.imprint.className, this.imprint);		
		this.prepareObject();
		this.locateMap(this.receiver.map.staticObjects[this.objectID].getBounds());		
		if (this.receiver.editor.getStatus() !== this.receiver.editor.statuses.idle){
			this.receiver.editor.switchStatus(this.receiver.editor.statuses.idle);
		}
	}

	undo(){
		this.locateMap(this.receiver.map.staticObjects[this.objectID].getBounds());
		this.dropObject();
		// расформировываем группу
		this.receiver.disbandGroup(this.imprint.objectID);
		if (this.receiver.editor.getStatus() !== this.receiver.editor.statuses.idle){
			this.receiver.editor.switchStatus(this.receiver.editor.statuses.idle);
		}
		for (var i in this.imprint.children) {
			this.receiver.map.selectObject(this.imprint.children[i], true);
		}
		
	}	
}

window.UngroupCommand = class UngroupCommand extends GzmCommand{

	constructor(receiver, context){
		super(receiver, context, false, true);		
		this.imprint = context;		
	}
	
	execute(){		
		this.locateMap(this.receiver.map.staticObjects[this.imprint.objectID].getBounds());
		this.dropObject();
		// расформировываем группу
		this.receiver.disbandGroup(this.imprint.objectID);
		if (this.receiver.editor.getStatus() !== this.receiver.editor.statuses.idle){
			this.receiver.editor.switchStatus(this.receiver.editor.statuses.idle);
		}
		for (var i in this.imprint.children) {
			this.receiver.map.selectObject(this.imprint.children[i], true);
		}
	}

	undo(){
		// кладем объект на карту
		this.receiver.deployObject(this.imprint.className, this.imprint);		
		this.prepareObject();
		this.locateMap(this.receiver.map.staticObjects[this.imprint.objectID].getBounds());		
		if (this.receiver.editor.getStatus() !== this.receiver.editor.statuses.idle){
			this.receiver.editor.switchStatus(this.receiver.editor.statuses.idle);
		}
	}	
}

/*
	Команда перезаписи контура объекта (переопределение)
*/
/*
class RewriteCommand extends VisualEditCommand{

	constructor(receiver, context){
		super();
		this.oldLatLngs = context.oldLatLngs;
		this.newLatLngs = context.newLatLngs;
	}

	execute(){
		this.receiver.setLatLngs(this.newLatLngs);
	}

	undo(){
		this.receiver.setLatLngs(this.oldLatLngs);
	}
}
*/

/*
	Макрокоманда, позволяющая создавать вложенные структуры из других команд (и макрокоманд)
*/
window.MacroCommand = class MacroCommand extends Command{

	constructor(receiver, context){
		super(receiver, context);
		this.commands = [];
	}

	execute(){		
		this.commands.forEach(function(cmd){
			cmd.execute();
		});
	}

	undo(){		
		this.commands.forEach(function(cmd){
			cmd.undo();
		});
	}

	addCommand(cmd){
		this.commands.push(cmd);
	}
}
},{}],30:[function(require,module,exports){
/*
	Класс, ответственный за редактирование
*/
window.Editor = class Editor extends SmartObject{
	constructor(){
		super();
		var self = this;		
		// id собираемого в данный момент объекта
		this.inAssemble = null;
		this.pendingObject = null;
		// хэш, хранящий id и класс собираемого в данный момент объекта
		this.newObject = null;
		// ссылка на объект ГЗМ
		this.master = null;
		// статусы редактора
		this.statuses = {
			idle: 0,
			waitForFirst: 1,
			waitForNext: 2,
			waitForInit: 3,
			handlers: {
				0: null,
				1: null,
				2: null,
				3: this.getInitNode,
			},
			switchers: {
				0: this.setIndle,
				1: this.waitForFirst,
				2: this.waitForNext,
				3: this.waitForInit
			}
		}		
		this.status = this.statuses.idle;
		// история изменений
		this.history = new History();
		this.history.addListener('logChange', function(context){
			self.master.fire('logChange', context);
		})
	}

	// откат предыдущего действия
	undo(){
		this.history.undo();
	}

	// повтор отменённого действия
	redo(){
		this.history.redo();
	}

	getStatus(){
		return this.status;
	}

	// переключает редактор и карту в новый статус
	switchStatus(status){
		this.status = status;
		var self = this;
		// достаём подготовительную функцию для нового статуса и вызываем её		
		if (this.statuses.switchers[status]) this.statuses.switchers[status].call(this);		
		// сбрасываем обработчики клика у карты и заменяем на обработчик, прикрепленный к статусу
		// если его нет, используем обработчик по умолчанию
		this.master.map.clearListeners('mapClick');
		if (this.statuses.handlers[status]){
			var handler = this.statuses.handlers[status];
			this.master.map.addListener('mapClick', function(context){
				handler.call(self, context);
			});
		} else {
			this.master.map.addListener('mapClick', function(context){
				this.defaultClickHandler(context);
			});
		}		
	}

	// возвращает список всех несохранённых изменений
	// в виде хэша
	// новые, изменённые, удаленные объекты
	// в новые объекты попадают только те, у которых: нет uuid && (нет родителя || родитель имеет uuid || родитель имеет isDummy = true)
	getChanges(){
		let changes = {new: [], modified: [], removed: []};
		let noParent, confirmedParent, dummyParent;
		for (let objectID in this.master.staticObjects){
			noParent = !this.master.staticObjects[objectID].parent;
			confirmedParent = !noParent && this.master.staticObjects[objectID].parent.uuid;
			dummyParent = !noParent && this.master.staticObjects[objectID].parent.isDummy;
			if (!this.master.staticObjects[objectID].uuid && ( noParent || confirmedParent || dummyParent )){
				changes.new.push(this.master.staticObjects[objectID].getConvertedData());
			} else if (this.master.staticObjects[objectID].isModified){
				changes.modified.push(this.master.staticObjects[objectID].getConvertedData());
			}
		}
		for (let objectID in this.master.confirmedObjects){
			if (!this.master.staticObjects[objectID]){
				changes.removed.push(this.master.confirmedObjects[objectID]);
			}
		}		
		return changes;
	}

	// применяет изменения после записи в БД
	commitChanges(ids){
		// если переданы ID объектов из БД, то записываем их в объекты
		if (ids){
			for (let objectID in ids){
				this.master.setUUID(objectID, ids[objectID]);				
			}
		}
		// после сохранения изменённых объектов больше нет
		for (let objectID in this.master.staticObjects){
			this.master.staticObjects[objectID].isModified = false;
		}
	}

	/*
		Методы, воздействующие на объекты. ID объекта в них не передаётся, т.к. метод считывает ID выбранного объекта с карты во избежание недоразумений.
	*/

	// удаление выделенного объекта
	deleteObject(){
		var self = this;
		var selected = this.master.map.getSelectedStaticObjects();		
		let cmd = new MacroCommand(this.master);
		for (let i in selected){			
			cmd.addCommand(new DeleteCommand(self.master, self.master.staticObjects[selected[i]].getConvertedData()));			
		}		
		cmd.execute();
		this.history.write(cmd);		
	}

	markObject(){
		let s = this.master.map.getSelectedStaticObjects(), objectID = null;
		if (s.length === 1){
			objectID = s[0];
			if (this.master.map.staticObjects[objectID].startMarking)
				this.master.map.staticObjects[objectID].startMarking();
		}
	}

	unmarkObject(){
		let s = this.master.map.getSelectedStaticObjects(), objectID = null;
		if (s.length === 1){
			objectID = s[0];
			if (this.master.map.staticObjects[objectID].stopMarking)
				this.master.map.staticObjects[objectID].stopMarking();
		}
	}

	splitObject(){
		const picketLength = 100, picketWidth = 40;
		/*
			Получаем ссылку на выбранный объект, проверяем можно ли его разбить
			для этого он должен иметь нанесённую пользователем разметку
		*/
		let 
			s = this.master.map.getSelectedStaticObjects(), 
			segments = [], 
			calc = GeoZoneManager.getCalculator(), 
			ll= null,
			obj = null,
			d = 0,
			picketNodes = null;
		if (s.length === 1){
			obj = this.master.map.staticObjects[s[0]];
			if (obj.marks && obj.marks.markers.length === 2){
				// формируем структуру данных, описывающую сегменты размеченной области
				for (let i = 0; i < obj.markedArea.segments.length; i++){
					ll = obj.markedArea.segments[i].getLatLngs();
					segments.push({
						index: /*i*/ obj.markedArea.segments[i].index, // индексация идет с 0, т.к. в markedArea индексы сдвинуты
						startsAt: obj.markedArea.segments[i].startsAt,
						endsAt: obj.markedArea.segments[i].endsAt,
						start: calc.fromLatLngToXY(ll[0]),
						end: calc.fromLatLngToXY(ll[1]),
						angle: calc.getAngle(ll[0], ll[1])
					});
				}				
				d = obj.marks.markers[0].distance;
				let macros = new MacroCommand();
				// если мы имеем дело с временным ЛО (напр. с треком), то вместо пикетов рисуем ГЗ
				let className = this.master.staticObjects[obj.objectID].isDummy ? 'GeoZone' : 'Picket';
				// сегменты записаны
				// рисуем пикеты в цикле, d = <расстояние с которого началась разметка>
				while (d < obj.markedArea.length ){
					picketNodes = Picket.calculate(segments, d, Math.min(picketLength, obj.markedArea.length - d), picketWidth);					
					let objData = {className: className, objectID: this.master.getNewID(), nodes: picketNodes, props: {}};
					let cmd = new QuickCreateCommand(this.master, objData, false, false);
					macros.addCommand(cmd);					
					d += picketLength;					
				}
				macros.execute();
				this.history.write(macros);
				if (obj.isMarking) obj.stopMarking();
			}
		}
	}

	// перевод выделенного объекта в режим растягивания 
	stretchObject(){		
		// считываем ID выделенного объекта
		var ID = this.master.map.getSelectedStaticObjects();		
		if (ID.length === 1){
			ID = ID[0];			
			// переводим представление объекта в режим растягивания
			this.master.map.stretchObject(ID);			
		}
			
	}

	// замораживание выделенного объекта, вывод из режима растягивания
	freeze(){
		// выводим карту из режима растягивания объекта
		this.master.map.freeze();		
	}	

	// разбивка выделенного пикета
	splitPicket(divisions){}

	// объединение выделенных пикетов
	unitePickets(){}

	// растягивание выделенного пикета вдоль
	stretchAlong(back, forth){}

	// объединение выделенных объектов в группу
	groupObjects(){
		let s = this.master.map.getSelectedStaticObjects(), objData = null, cmd = null;
		if (s.length > 1){
			objData = {className: 'Group', objectID: this.master.getNewID(), props: {}, children: s};
			cmd = new GroupCommand(this.master, objData);
			cmd.execute();
			this.history.write(cmd);
		}
	}

	// расформирование выделенной группы объектов
	ungroupObjects(){
		// считываем выделенные объекты, если это группа, то расформировываем её
		let s = this.master.map.getSelectedStaticObjects(), cmd = null;		
		if (s.length === 1 && this.master.map.staticObjects[s[0]].getClassName() === 'MGroup'){
			cmd = new UngroupCommand(this.master, this.master.staticObjects[s[0]].getConvertedData());
			cmd.execute();
			this.history.write(cmd);
		}
	}

	/*
		Возвращает true, если возможно быстрое создание заготовки для объектов className
	*/
	quickCreateEnabled(className){		
		let supported = ['GeoZone', 'PointObject', 'CapitalPlaneObject', 'CapitalPointObject', 'CircleGeoZone'];
		return (supported.indexOf(className) >= 0);
	}
	/*
		Переводим редактор в режим поточечного создания нового статического объекта
	*/
	startNewStaticObject(className){
		// пытаемся "освободить" карту: остановить текущее редактирование, развыделить объекты и т.д.
		// если получилось - всё ок, идём дальше, если нет - кидаем ошибку (incompleteError, например)
		// генерируем ID нового объекта и запоминаем его класс
		this.newObject = {objectID: this.master.getNewID(), className: className};
		// переключаем статус редактора и карты, переводя их в режим ожидания новой точки
		if (this.getStatus() !== this.statuses.waitForFirst){
			this.switchStatus(this.statuses.waitForFirst);
		}		
	}

	getFirstNode(context){
		/*
			проверяем возможность добавить первую точку в это место
			ыщ-ыщ-ыщ
			вложенность не реализована, поэтому пока не работает
		*/
		// создаём сырой объект
		var imprint = {className: this.newObject.className, objectID: this.newObject.objectID, nodes: [context.coords], props: {}};
		// создаём команду для создания объекта
		// выполняем команду
		// записываем её в историю
	}

	getNextNode(context){
		/*
			проверяем возможность добавить очередную точку в это место
			ыщ-ыщ-ыщ
			вложенность не реализована, поэтому пока не работает			
		*/
		// создаём команду
		// выполняем
		// пишем в историю
	}

	getInitNode(context){
		let 
			parentObjectID = context.objectID,
			newObjectCoords = [],
			ok = true,
			objData = null;
		// в зависимости от класса собираемого объекта генерируем координаты для заготовки
		switch (this.pendingObject.className){
			case 'GeoZone':
					newObjectCoords = GeoZone.calculate(context.coords, GeoZone.getDefaultDimension());
					objData = {className: 'GeoZone', objectID: this.pendingObject.objectID, nodes: newObjectCoords, props: {}};
					if (parentObjectID) objData.parentObjectID = parentObjectID;
			case 'CapitalPointObject':				
				break;
			case 'PointObject':
			case 'CapitalPointObject':
				break;
			case 'CircleGeoZone':
				objData = {
					className: 'CircleGeoZone', 
					objectID: this.pendingObject.objectID, 
					center: context.coords, 
					radius: CircleObject.getDefaultRadius(),
					props: {}
				};			
				break;
		}
		if (ok){			
			let cmd = new QuickCreateCommand(this.master, objData);
			cmd.execute();
			this.history.write(cmd);
		}		
	}

	/*
		Функция, обрабатывающая клик по карте для получения координат точки, добавляемой в геообъект
	*/
	getNewPoint(context){
		let 
			noObject = !this.inAssemble,
			noPoint = !context.coords;		
		// выходим из функции, если 
		// в данный момент не идет создание объекта,
		// в событии не переданы координаты		
		if (noObject || noPoint) return;
		// если клик был по объекту, а не по свободному участку
		// проверяем, предполагают ли типы кликнутого и создаваемого объекта вложение второго в первый
		if (context.objectID && this.canInclude(context.objectID, this.inAssemble)){
			// если у объекта уже есть другой родитель, кидаем ошибку и выходим из функции
			if (this.master.staticObjects[this.inAssemble].parentID && this.staticObjects[this.inAssemble].parentID != context.objectID) {
				this.master.throwError('alreadyHasParent', {});
				return;
			}
			// если у нового объекта нет родителя, пристегиваем его к кликнутому объекту
			if (!this.master.staticObjects[this.inAssemble].parentID) {
				//this.staticObjects[context.objectID].addChild(this.staticObjects[this.inAssemble]);
				// меняем уровень объекта на карте, если необходимо
			}
		}
		// проверяем создаваемый объект с новой точкой на конфилкты, если нужно (пока неактивно)
		/*
		if (this.staticObjects[this.inAssemble].isConflicting()){
			var newCoords = this.staticObjects[this.inAssemble].concat(context.coords);
			this.checkConflicts(newCoords);
		}
		*/		
		if (this.master.staticObjects[this.inAssemble].getClassName() === 'SimpleRoute' && context.objectID){
			context.coords = this.master.staticObjects[context.objectID].getCenter();
		}
		// если мы до сих пор не вышли из функции, добавляем в объект новую точку и обновляем его представление на карте
		this.master.staticObjects[this.inAssemble].pushPoint(context.coords);		
		//this.master.map.staticObjects[this.inAssemble].pushPoint(context.coords);
	}

	/*
		Переводит редактор в режим быстрого добавления заготовки статического объекта
		className - класс создаваемого объекта (не все классы поддерживаются)		
	*/
	quickCreateStaticObject(className){		
		// если быстрое создание объектов с указанным классом не поддерживается, выходим
		if (!className || !this.quickCreateEnabled(className)) {
			this.master.throwError('Quick create is not supported.', {className: className});
			return;
		}
		// генерируем ID нового объекта и запоминаем его класс
		this.pendingObject = {objectID: this.master.getNewID(), className: className};
		// переводим карту и редактор в соответствующий режим ожидания клика
		if (this.getStatus() !== this.statuses.waitForInit){
			this.switchStatus(this.statuses.waitForInit);
		}		
	}

	/*
		Создает заготовку объекта вокруг полученной в событии точки
	*/
	getInitPoint(context){	
		let 
			noObject = !this.inAssemble,
			noPoint = !context.coords,
			newObjectCoords = [];
		// выходим из функции, если 
		// в данный момент не идет создание объекта,
		// в событии не переданы координаты		
		if (noObject || noPoint) return;
		// в зависимости от класса собираемого объекта генерируем координаты для заготовки
		switch (context.className){
			case 'GeoZone':
					newObjectCoords = GeoZone.calculate(context.coords, GeoZone.getDefaultDimension());
			case 'CapitalPointObject':				
				break;
			case 'PointObject':
			case 'CapitalPointObject':
				break;
			case 'CircleGeoZone':
				break;
		}
		// когда координаты получены:
		// Создать экземпляр объекта на карте
		this.master.map.addComplexObject(context.className, {objectID: this.inAssemble, coords: newObjectCoords});
		// Дать карте команду на выделение и растягивание нового объекта
		this.master.map.selectObject(this.inAssemble);
		this.master.map.stretchObject(this.inAssemble);
	}


	/*	Переходы
			Первая точка
				Всем полигонам крест, стиль на прозрачный
				Карте крест
			Начальная точка
				Всем полигонам крест, стиль на прозрачный
				Карте крест
			Следующая точка
				// у карты обычный курсор, у родительского полигона, если он есть, - крест, у всех остальных обычный

		Обработчики
			Первая точка
				Получили координату, проверили на пригодность, если прокатило, создаём в переменной объект с 1 точкой
				Создаём команду, отдаём ей созданный объект
					Команда выкладывает объект на карту, выделяет и включает растягивание
					Затем команда должна перевести редактор в режим ожидания следующих точек
			Начальная точка
			Следующая точка
				Получили координату, проверили, если прокатило, создаём команду
				Команда переходит к объекту, выделяет, растягивает, пушит точку в объект
				Затем команда чекает статус редактора, если не тот, ставит ожидание следующей точки

		При пуше точек в объект у родительского полигона должен быть курсор-крестик, где осуществлять замену - в переходе редактора в новый режим или в команде растягивания объекта?
		команда растягивания
			не всякое растягивание переключает курсор
			чтобы определить, надо или нет
				входной параметр при вызове (сверка состояния объекта не годится)
		переход в режим
			при переходе должно быть известно, какой объект родительский
				чекнуть, какой выделен, найти парент

	*/

	waitForInit(){
		/*			
			Всем полигонам крест, стиль на прозрачный
			Карте крест			
		*/		
		this.master.map.setCursorStyle('crosshair');
		/*
		this.master.map.staticObjects.forEach(function(elem){
			if (elem.getArchetype() === 'Polygon'){
				elem.setCursorStyle('crosshair');
			}
		});
		*/
	}

	setIndle(){
		this.master.map.setCursorStyle('default');
	}

	waitForFirst(){
		/*			
			Всем полигонам крест, стиль на прозрачный
			Карте крест			
		*/
		this.master.map.setCursorStyle('crosshair');
		/*
		this.master.map.staticObjects.forEach(function(elem){
			if (elem.getArchetype() === 'Polygon'){
				elem.setCursorStyle('crosshair');
			}
		});
		*/
	}

	waitForNext(){
		this.master.map.setCursorStyle('default');
		/*
		this.master.map.staticObjects.forEach(function(elem){
			if (elem.getArchetype() === 'Polygon'){
				elem.setCursorStyle('default');
			}
		});
		*/
	}

	radiusChange(context){		
		var 
			ID = context.objectID,			
			newRadius = context.radius,
			oldRadius = this.master.staticObjects[ID].getRadius();
		// проверка на конфликты - пока отсутствует
		var ok = true;
		if (ok){
			let cmd = new ChangeRadiusCommand(this.master, {oldRadius: oldRadius, newRadius: newRadius, objectID: ID}, this.status);
			cmd.execute();
			this.history.write(cmd);
		} else {
			// если проверка не прошла, то кидаем событие с ошибкой			
			this.fire('incorrectStretch', {});
		}
	}

	moveNodeVisual(context){		
		var 
			ID = context.objectID,
			index = context.index,
			newCoords = context.coords,
			oldCoords = this.master.staticObjects[ID].getLatLngs()[index];
		// проверка на конфликты - пока отсутствует
		var ok = true;
		if (ok){
			let cmd = new StretchCommand(this.master, {nodeIndex: index, newCoords: newCoords, oldCoords: oldCoords, objectID: ID}, this.status);
			cmd.execute();
			this.history.write(cmd);
		} else {
			// если проверка не прошла, то кидаем событие с ошибкой			
			this.fire('incorrectStretch', {});
		}
	}

	/*
		Обработчик директивного перемещения вершины
	*/
	moveNodeDirect(context){
		var 
			ID = context.objectID,
			index = context.index,
			newCoords = context.coords,
			oldCoords = this.master.staticObjects[ID].getLatLngs()[index];
		// проверка на конфликты - пока отсутствует
		var ok = true;
		if (ok){
			let cmd = new StretchCommand(this.master, {nodeIndex: index, newCoords: newCoords, oldCoords: oldCoords, objectID: ID}, this.status);
			cmd.execute();
			this.history.write(cmd);
		} else {
			// если проверка не прошла, то кидаем событие с ошибкой
			this.fire('incorrectStretch', {});
		}
	}

	removeNode(context){
		// проверка - можно ли удалять вершину - пока не работает
		var ok = true;
		if (ok){
			let coords = this.master.staticObjects[context.objectID].getLatLngs()[context.index];
			let cmd = new RemoveNodeCommand(this.master, {objectID: context.objectID, nodeIndex: context.index, coords: coords}, this.getStatus());
			cmd.execute()
			this.history.write(cmd);
		} else {
			this.fire('incorrectNodeRemove', {})
		}
	}

	splitBorderVisual(context){		
		let cmd = new SplitBorderCommand(this.master, {objectID: context.objectID, coords: context.coords, borderIndex: context.borderIndex, nodeIndex: context.nodeIndex}, this.getStatus());
		cmd.execute();
		this.history.write(cmd);		
	}

	transpose(context){
		let ok = true;
		if (ok){
			let cmd = new TransposeCommand(this.master, {objectID: context.objectID, newCenter: context.newCenter, oldCenter: context.oldCenter}, this.getStatus());
			cmd.execute();
			this.history.write(cmd);
		} else {
			// выброс ошибки
			
		}
	}
}
},{}],31:[function(require,module,exports){
/*
	База
		SmartObject, калькулятор, абстрактные ГО, ГЗМ
*/
require('./basic/SmartObject.js');
require('./basic/Calculator');
require('./basic/GeoObject.js');
require('./basic/AbstractObjects');
require('./basic/Group');
require('./basic/GeoZoneManager.js');
// редактирование
require('./editor/editor.js');
require('./editor/commands.js');
require('./editor/History.js');
// примитивы (основа)
require('./basic/primitives/ComplexArea.js');
require('./basic/primitives/LinearObjectComplexArea.js');
require('./basic/primitives/MapObject.js');
require('./basic/primitives/PopupField.js');
// статическая карта (родительский класс)
require('./basic/StaticMap.js');
// лифлетная реализация
require('./leaflet/LeafletMap.js');
// обработка границ объектов
require('./basic/GzmBounds.js');
require('./leaflet/LeafletBounds.js');
// Статические объекты
require('./basic/StaticObjects/StaticObject.js');
// Полигональные объекты
require('./basic/StaticObjects/MGeoZone.js');
require('./basic/StaticObjects/MPicket.js');
require('./basic/StaticObjects/MRegion.js');
require('./basic/StaticObjects/MCapitalPlaneObject.js');
// Точечные объекты
require('./basic/StaticObjects/MPointObject.js');
require('./basic/StaticObjects/MCapitalPointObject.js');
// Линейные объекты
require('./basic/StaticObjects/MLinearObject.js');
require('./basic/StaticObjects/MRoad.js');
require('./basic/StaticObjects/MSimpleRoute.js');
require('./basic/StaticObjects/MFactRoute.js');
require('./basic/StaticObjects/MPlannedRoute.js');
// круги
require('./basic/StaticObjects/MCircleObject.js');
require('./basic/StaticObjects/MCircleGeoZone.js');
// группировка
require('./basic/StaticObjects/MGroup.js');
// мониторинг
require('./monitoring/monitoring.js');
require('./monitoring/DynamicObject.js');
require('./monitoring/DTruck.js');
},{"./basic/AbstractObjects":1,"./basic/Calculator":2,"./basic/GeoObject.js":3,"./basic/GeoZoneManager.js":4,"./basic/Group":5,"./basic/GzmBounds.js":6,"./basic/SmartObject.js":7,"./basic/StaticMap.js":8,"./basic/StaticObjects/MCapitalPlaneObject.js":9,"./basic/StaticObjects/MCapitalPointObject.js":10,"./basic/StaticObjects/MCircleGeoZone.js":11,"./basic/StaticObjects/MCircleObject.js":12,"./basic/StaticObjects/MFactRoute.js":13,"./basic/StaticObjects/MGeoZone.js":14,"./basic/StaticObjects/MGroup.js":15,"./basic/StaticObjects/MLinearObject.js":16,"./basic/StaticObjects/MPicket.js":17,"./basic/StaticObjects/MPlannedRoute.js":18,"./basic/StaticObjects/MPointObject.js":19,"./basic/StaticObjects/MRegion.js":20,"./basic/StaticObjects/MRoad.js":21,"./basic/StaticObjects/MSimpleRoute.js":22,"./basic/StaticObjects/StaticObject.js":23,"./basic/primitives/ComplexArea.js":24,"./basic/primitives/LinearObjectComplexArea.js":25,"./basic/primitives/MapObject.js":26,"./basic/primitives/PopupField.js":27,"./editor/History.js":28,"./editor/commands.js":29,"./editor/editor.js":30,"./leaflet/LeafletBounds.js":32,"./leaflet/LeafletMap.js":33,"./monitoring/DTruck.js":34,"./monitoring/DynamicObject.js":35,"./monitoring/monitoring.js":36}],32:[function(require,module,exports){
window.LeafletBounds = class LeafletBounds extends GzmBounds{

	fromNative(source){		
		let res = {};
		if (source instanceof Array){
			res.north = source[0];
			res.east = source[1],
			res.south = source[2];
			res.west = source[3];
		} else if (source instanceof LeafletBounds){
			res.north = source.getNorth();
			res.east = source.getEast(),
			res.south = source.getSouth();
			res.west = source.getWest();
		} else if (source instanceof L.LatLngBounds){
			res.north = source.getNorth();
			res.east = source.getEast(),
			res.south = source.getSouth();
			res.west = source.getWest();
		}
		return res;
	}

	toNative(){
		let
			ne = new L.LatLng(this._north, this._east),
			sw = new L.LatLng(this._south, this._west);
		return new L.LatLngBounds(ne, sw);
	}
}
},{}],33:[function(require,module,exports){
window.LeafletStaticMap =  class LeafletStaticMap extends StaticMap{
	
	constructor(container){
		super(container);
		// платформа, на которой реализована карта
		this.platform = 'Leaflet';
		// адрес, с которого загружаются тайлы
		this.tilesUrl = 'http://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png';
		// создаём карту в контейнере		
		this.map = L.map(container, {center: this.defaultCenter, zoom: 3, closePopupOnClick: false});
		// грузим тайлы
		this.loadTiles();
		// изменяем курсор на карте с пальца на стрелку
		this.setCursorStyle('default');		
		// передаём контекст через замыкание и развешиваем события
		var self = this;
		this.map.on('click', function(context){
			self.fire('mapClick', {objectID: null, coords: [context.latlng.lat, context.latlng.lng]});
		});
		this.map.on('zoom', function(context){
			self.calcAreaRadius();
			self.fire('zoom', {zoom: context.target._zoom});
		});
		this.map.on('mousemove', function(context){
			self.cursorLocation = [context.latlng.lat, context.latlng.lng]
			self.fire('mousemove', {message: 'Cursor was moved', cursorLocation: [context.latlng.lat, context.latlng.lng]});
		});
		this.map.on('move', function(context){			
			self.calcAreaRadius();			
			self.calcAreaCenter();
		});
		this.areaRadius = this.calcAreaRadius();
		this.calcAreaCenter();
	}	

	loadTiles(){
		L.tileLayer(this.tilesUrl, {attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a>'}).addTo(this.map);
	}

	setCursorStyle(style){
		// изменяем курсор на карте
		document.getElementsByClassName('leaflet-container')[0].style.cursor = style;
	}

	/*
		Переводит координаты, переданные в виде массива чисел в вид, понятный карте
	*/
	static fromRawToNative(coords){
		var result = null;
		// если пришел массив координат
		if (typeof coords[0] === 'object'){
			result = [];
			for (var i = 0; i < coords.length; i++){
				result.push(L.latLng(coords[i]));
			}
		// если пришло одно значение
		} else {
			result = L.latLng(coords)
		}
		return result;
	}

	/*
		Переводит координаты, переданные в родном для карты формате в массив с числами
	*/
	static fromNativeToRaw(coords){
		var result = null;
		// если пришел массив координат
		if (coords[0]){
			result = [];
			for (var i = 0; i < coords.length; i++){
				if (coords[i]){
					result.push([coords[i].lat, coords[i].lng]);
				}
			}
		// если пришло одно значение
		} else {
			result = [coords.lat, coords.lng];
		}		
		return result;
	}

	/*
		Конвертирует обобщенный стиль в тот вид, который понятен карте
	*/
	static convertStyle(rawStyle){
		var style = {};
		// прозрачность
		if (rawStyle.hasOwnProperty('opacity')){
			style.fillOpacity = rawStyle.opacity;
		}
		// цвет границ (для плоских фигур, не путать с кликабельными границами, рисующимися при выделении)
		if (rawStyle.hasOwnProperty('borderColor')){
			style.color = rawStyle.borderColor;
		}
		// если цвет заливки не указан отдельно, то Leaflet трактует свойство color как цвет границы
		// поэтому разносим цвет границы и цвет самой фигуры
		if (rawStyle.hasOwnProperty('color')){
			if (rawStyle.hasOwnProperty('borderColor')){
				style.fillColor = rawStyle.color;
			} else {
				style.color = rawStyle.color;
			}
		}
		// толщина линий
		// для плоских фигур приходит свойство borderWeight, для линий - просто weight, но трактуются они одинаково
		if (rawStyle.hasOwnProperty('borderWeight')){
			style.weight = rawStyle.borderWeight;
		}
		if (rawStyle.hasOwnProperty('weight')){
			style.weight = rawStyle.weight;
		}
		// пунктирность линии
		if (rawStyle.hasOwnProperty('dashArray')){
			style.dashArray = rawStyle.dashArray
		}
		//
		if (rawStyle.hasOwnProperty('offset')){
			style.offset = L.point(rawStyle.offset.x, rawStyle.offset.y);
		}
		return style;
	}

	// собирает иконку маркера по пришедшему стилю
	// ID самого маркера нужен для того, чтобы потом можно было подцепиться к иконке через DOM и перекрасить её, если понадобится
	static convertIcon(iconStyle, primitiveID){
		var iconSize, iconAnchor;

		switch (iconStyle.pattern){
			case 'baloon':
				iconSize = [44, 44]; // 44 44
				iconAnchor = [22, 47];// 22 44
				break;
			case 'symmetric':
				iconSize = [20, 20];
				iconAnchor = [10, 10];
				break;
			case 'arrow':
				iconSize = [40, 40];
				iconAnchor = [20, 30];
				break;
			case 'dynamic':
				iconSize = [32, 32];
				iconAnchor = [16, 24];
				break;
		}		
		// добавляем инлайн-стиль
		// он обязательно содержит цвет иконки
		var inlineCSS = 'style="color: '+iconStyle.color;
		// опционально содержит градус поворота
		if (iconStyle.rotate){
			inlineCSS += '; transform: rotate('+iconStyle.rotate+'deg)';
		}
		inlineCSS += ';"'
		// '<i id="'+'icon'+primitiveID+'" class = "'+iconStyle.icon+'" style="color:'+iconStyle.color+';" aria-hidden="false"></i>'
		var html = '<i id="'+'icon'+primitiveID+'" class = "'+iconStyle.icon+'" '+inlineCSS+' aria-hidden="false"></i>';
		
		var icon = L.divIcon({
			html: html,
			className: iconStyle.className,
			iconSize: iconSize,
			iconAnchor: iconAnchor
		});		
		return icon;
	}

	// возвращает TRUE, если аргумент является экземпляром LeafletBounds
	checkNativeBounds(obj){
		return (typeof obj === 'object' && obj instanceof LeafletBounds);
	}

	getBounds(){
		return new LeafletBounds(this.map.getBounds());
	}

	/*
		Возвращает зум
	*/
	getZoom(){		
		return this.map._zoom;
	}	

	calcAreaRadius(){
		var b = this.map.getBounds();	
		this.areaRadius = b._northEast.distanceTo(b._southWest)/2;		
	}

	calcAreaCenter(){		
		this.areaCenter = LeafletStaticMap.fromNativeToRaw(this.map.getBounds().getCenter());		
	}

	formXYtoLatLng(xy){		
		return L.Projection.Mercator.unproject(xy);
	}

	fromLatLngToXY(latlon){
		var source = LeafletStaticMap.fromRawToNative(latlon);
		return L.Projection.Mercator.project(source);		
	}

	createPolygon(coords, owner, style){
		this.primitivesCounter++;
		this.primitives[this.primitivesCounter] = new LeafletPolygon(this.primitivesCounter, this.map, {coords: LeafletStaticMap.fromRawToNative(coords)}, owner, LeafletStaticMap.convertStyle(style));		
		return this.primitives[this.primitivesCounter];
	}

	createCircle(center, radius, owner, style){		
		this.primitivesCounter++;
		var s = LeafletStaticMap.convertStyle(style);		
		this.primitives[this.primitivesCounter] = new LeafletCircle(this.primitivesCounter, this.map, {center: LeafletStaticMap.fromRawToNative(center), radius: radius}, owner, s);
		return this.primitives[this.primitivesCounter];
	}

	createRing(center, radius, owner, style){		
		this.primitivesCounter++;
		var s = LeafletStaticMap.convertStyle(style);		
		this.primitives[this.primitivesCounter] = new LeafletRing(this.primitivesCounter, this.map, {center: LeafletStaticMap.fromRawToNative(center), radius: radius}, owner, s);
		return this.primitives[this.primitivesCounter];
	}

	createLine(from, to, owner, style){
		this.primitivesCounter++;
		var data = {coords: LeafletStaticMap.fromRawToNative([from, to])};
		this.primitives[this.primitivesCounter] = new LeafletLine(this.primitivesCounter, this.map, data, owner, LeafletStaticMap.convertStyle(style));		
		return this.primitives[this.primitivesCounter];
	}

	createPolyline(coords, owner, style){
		this.primitivesCounter++;
		var data = {coords: coords};
		this.primitives[this.primitivesCounter] = new LeafletPolyline
		(this.primitivesCounter, this.map, data, owner, LeafletStaticMap.convertStyle(style));		
		return this.primitives[this.primitivesCounter];
	}

	createSegment(from, to, owner, style){		
		this.primitivesCounter++;
		var data = {coords: LeafletStaticMap.fromRawToNative([from, to])};
		this.primitives[this.primitivesCounter] = new LeafletSegment(this.primitivesCounter, this.map, data, owner, LeafletStaticMap.convertStyle(style));		
		return this.primitives[this.primitivesCounter];
	}

	createPopup(point, owner, content, style, readOnly){
		this.primitivesCounter++;		
		var data = {coords: point, content: content, readOnly: readOnly};
		this.primitives[this.primitivesCounter] = new LeafletPopup(this.primitivesCounter, this.map, data, owner, LeafletStaticMap.convertStyle(style));
		return this.primitives[this.primitivesCounter];	
	}

	createHashPopup(point, owner, content, style, readOnly){
		this.primitivesCounter++;		
		var data = {coords: point, content: content, readOnly: readOnly};
		this.primitives[this.primitivesCounter] = new LeafletHashPopup(this.primitivesCounter, this.map, data, owner, LeafletStaticMap.convertStyle(style));
		return this.primitives[this.primitivesCounter];	
	}

	createStretcherPopup(point, owner, content, style, readOnly, index){
		this.primitivesCounter++;		
		var data = {coords: point, content: content, readOnly: readOnly, index: index};
		this.primitives[this.primitivesCounter] = new LeafletStretcherPopup(this.primitivesCounter, this.map, data, owner, LeafletStaticMap.convertStyle(style));
		return this.primitives[this.primitivesCounter];	
	}

	createMarker(point, owner, style, isDraggable){		
		this.primitivesCounter++;
		this.primitives[this.primitivesCounter] = new LeafletMarker(this.primitivesCounter, this.map, {point: point}, owner, LeafletStaticMap.convertIcon(style, this.primitivesCounter), isDraggable);
		return this.primitives[this.primitivesCounter];
	}

	createMarker1(point, owner, style){
		this.primitivesCounter++;
		this.primitives[this.primitivesCounter] = new LeafletMarker1(this.primitivesCounter, this.map, {point: point}, owner, null);		
		return this.primitives[this.primitivesCounter];
	}

	createLabel(coords, owner, text, style, align){		
		this.primitivesCounter++;
		this.primitives[this.primitivesCounter] = new LeafletLabel(this.primitivesCounter, this.map, {coords: coords, text: text, align: align}, owner, style);
		return this.primitives[this.primitivesCounter];
	}

	/*
		Центровка карты с радиусом обзора (крипота страшная)
	*/
	setView(latlng, radius){
		if (radius){
			var c = L.circle(LeafletStaticMap.fromRawToNative(latlng), radius*1000);
			// ААААА!!
			c.addTo(this.map);
			var b = c.getBounds();			
			this.map.fitBounds(b);
			// ЫЫЫЫЫ!!1
			this.map.removeLayer(c);
			/*this.areaRadius = this.calcAreaRadius();		
			this.areaCenter = this.calcAreaCenter();*/
		} else {
			this.map.setView(latlng);
		}
	}

	fitTo(bounds){
		this.map.fitBounds(bounds.toNative());
	}
}

class LeafletObject extends MapObject{
	constructor(id, layer, data, owner, style){
		super(id, layer, data, owner, style);
		// пока вложенности нет - будет так		
		this.map = layer;
		// потом +/- так
		//this.map = layer.map;
	}

	show(){
		this.isVisible = true;
		this.layer.addLayer(this.view);
	}

	hide(){
		this.isVisible = false;
		this.layer.removeLayer(this.view);
	}

	getLatLngs(){
		return LeafletStaticMap.fromNativeToRaw(this.view.getLatLngs());
	}

	setLatLngs(ll){}

	getCenter(){
		let c = this.view.getBounds().getCenter();
		return [c.lat, c.lng];
	}	

	setStyle(style){
		this.style = style;
		this.view.setStyle(LeafletStaticMap.convertStyle(this.style));
	}

	getStyle(){
		return this.style;
	}

	getColor(){
		return this.view.options.color;
	}

	moveNodeTo(index, coords){}

	getBounds(){
		/*
		let b = this.view.getBounds(),
		d = b._northEast.distanceTo(b._southWest)/2,
		c = b.getCenter();
		var result = {
			center: [c.lat, c.lng],
			radius: d >= 500 ? d : 500,
			actualRadius: d
		};
		return result;
		*/		
		return new LeafletBounds(this.view.getBounds());
	}
}

class LeafletPolygon extends LeafletObject{
	constructor(id, layer, data, owner, style){
		super(id, layer, data, owner, style);
		this.layer = layer;		
		this.view = L.polygon(data.coords, style);
		var self = this;
		// временные координаты, которые используются при обработке перетаскивания
		this.tempDragCoords = null;
		// можно ли таскать полигон мышкой
		this.isDraggable = false;
		// обработчик клика по полигону
		this.view.on('click', function(e){			
			// отключаем распространение события на вышестоящие объекты (иначе одновременно будет срабатывать клик по карте, например)
			L.DomEvent.stopPropagation(e);
			// формируем контекст события, передаваемый наверх
			var context = {
				primitiveID: self.objectID,
				event: 'polygonClick',
				coords: LeafletStaticMap.fromNativeToRaw(e.latlng),
				ctrlKey: e.originalEvent.ctrlKey
			};			
			// активируем событие полигона
			self.fire('click', context);
		});		
	}

	enableDragging(){
		// включаем переменную
		this.isDraggable = true;		
		// зажатие мыши при перетаскивании
		this.view.on('mousedown', this.dragMouseDown, this);			
	}

	disableDragging(){
		// убираем флаг, стираем обработчики
		this.isDraggable = false;
		this.view.off('mousedown');
		this.view.off('mouseup');
	}

	dragHandler(context){		
		// считываем координаты указателя
		const latlng = context.latlng;
		// вычисляем разницу с предыдущей позицией
		const delta = {lat: latlng.lat - this.tempDragCoords.lat, lng: latlng.lng - this.tempDragCoords.lng};
		// считываем текущие координаты объекта и преобразуем их с помощью delta
		let coords = this.view._latlngs[0];
		let newCoords = coords.map((latlon) => {
			const c = {
				lat: latlon.lat + delta.lat,
				lng: latlon.lng + delta.lng
			}
			return c;
		});
		this.tempDragCoords = latlng;
		// перерисовываем объект
		this.view.setLatLngs(newCoords).redraw();
		this.fire('drag', {primitiveID: this.objectID, event: 'polygonDrag', center: this.getCenter()});		
	}

	dragMouseDown(context){
		// отключаем драг карты
		this.map.dragging.disable();
		// запоминаем текущее положение курсора
		this.tempDragCoords = context.latlng;
		// даём карте дополнительный обработчик движения мыши, который будет двигать объект
		this.map.on('mousemove', this.dragHandler, this);
		// отпускание мыши при перетаскивании
		this.view.on('mouseup', this.dragMouseUp, this);
		this.fire('dragstart', {primitiveID: this.objectID, event: 'polygonDragStart', center: this.getCenter()});
	}

	dragMouseUp(context){
		var self = this;
		// возвращаем карте возможность протаскивания мышкой
		this.map.dragging.enable();
		// УВАГА! ЖЕСТКИЙ ХАК: ЭТО СВОЙСТВО ПО УМОЛЧАНИЮ ОТСУТСТВУЕТ В ОБЪЕКТЕ this.map.boxZoom, ИЗ-ЗА ЭТОГО ПОСЛЕ ОТПУСКАНИЯ МЫШИ СРАБАТЫВАЕТ СОБЫТИЕ click, ПОЭТОМУ СТАВИМ СЮДА TRUE
		this.map.boxZoom._moved = true;
		// удаляем дополнительный обработчик
		this.map.off('mousemove', this.dragHandler, this);		
		this.view.off('mouseup', this.dragMouseUp, this);
		this.fire('dragend', {primitiveID: this.objectID, event: 'polygonDragEnd', center: this.getCenter()});
		// УВАГА! ЖЕСТКИЙ ХАК: ВОЗВРАЩАЕМ ВСЁ НА МЕСТО, УДАЛЯЕМ СВОЙСТВО С ТАЙМАУТОМ, ЧТОБЫ СОБЫТИЕ НЕ УСПЕЛО СРАБОТАТЬ
		setTimeout(()=>{delete self.map.boxZoom._moved;}, 50);		
	}

	getLatLngs(){		
		return LeafletStaticMap.fromNativeToRaw(this.view.getLatLngs()[0]);
	}

	setLatLngs(ll){
		this.view.setLatLngs(LeafletStaticMap.fromRawToNative(ll));
	}

	moveNodeTo(index, coords){
		var ll = this.view.getLatLngs()[0];
		ll[index] = LeafletStaticMap.fromRawToNative(coords);
		this.view.setLatLngs(ll);
	}

	insertPoint(index, coords){
		let ll = this.view.getLatLngs()[0];
		ll.splice(index, 0, LeafletStaticMap.fromRawToNative(coords));
		this.view.setLatLngs(ll);
	}

	removeNode(index){
		let ll = this.view.getLatLngs()[0];
		ll.splice(index, 1);
		this.view.setLatLngs(ll);
	}

	setCursorStyle(style){
		this.view._path.style.cursor = style;
	}
}

class LeafletCircle extends LeafletObject{
	constructor(id, layer, data, owner, style){
		super(id, layer, data, owner, style);
		this.layer = layer;
		var self = this;
		let options = style;
		options.radius = data.radius;
		this.view = L.circle(data.center, options);
		// обработчик клика по области
		this.view.on('click', function(e){			
			// отключаем распространение события на вышестоящие объекты (иначе одновременно будет срабатывать клик по карте, например)
			L.DomEvent.stopPropagation(e);
			// формируем контекст события, передаваемый наверх
			var context = {
				primitiveID: self.objectID,
				event: 'circleClick',
				coords: LeafletStaticMap.fromNativeToRaw(e.latlng)
			};
			// активируем событие
			self.fire('click', context);
		});				
	}

	setCenter(newCenter){
		this.view.setLatLng(newCenter);
	}

	setRadius(newRadius){		
		this.view.setRadius(newRadius);
	}

	getRadius(){		
		return this.view.getRadius();
	}

	enableDragging(){		
		// включаем переменную
		this.isDraggable = true;		
		// зажатие мыши при перетаскивании
		this.view.on('mousedown', this.dragMouseDown, this);			
	}

	disableDragging(){
		// убираем флаг, стираем обработчики
		this.isDraggable = false;
		this.view.off('mousedown');
		this.view.off('mouseup');
	}

	dragHandler(context){		
		// считываем координаты указателя
		const latlng = context.latlng;
		// вычисляем разницу с предыдущей позицией
		const delta = {lat: latlng.lat - this.tempDragCoords.lat, lng: latlng.lng - this.tempDragCoords.lng};
		// считываем текущие координаты объекта и преобразуем их с помощью delta
		let newCoords = {lat: this.view._latlng.lat+delta.lat, lng: this.view._latlng.lng+delta.lng};		
		this.tempDragCoords = latlng;
		// перерисовываем объект
		this.view.setLatLng(newCoords).redraw();
		this.fire('drag', {primitiveID: this.objectID, event: 'circleDrag', center: this.getCenter()});		
	}

	dragMouseDown(context){		
		// отключаем драг карты
		this.map.dragging.disable();
		// запоминаем текущее положение курсора
		this.tempDragCoords = context.latlng;
		// даём карте дополнительный обработчик движения мыши, который будет двигать объект
		this.map.on('mousemove', this.dragHandler, this);
		// отпускание мыши при перетаскивании
		this.view.on('mouseup', this.dragMouseUp, this);
		this.fire('dragstart', {primitiveID: this.objectID, event: 'circleDragStart', center: this.getCenter()});
	}

	dragMouseUp(context){
		var self = this;
		// возвращаем карте возможность протаскивания мышкой
		this.map.dragging.enable();
		// УВАГА! ЖЕСТКИЙ ХАК: ЭТО СВОЙСТВО ПО УМОЛЧАНИЮ ОТСУТСТВУЕТ В ОБЪЕКТЕ this.map.boxZoom, ИЗ-ЗА ЭТОГО ПОСЛЕ ОТПУСКАНИЯ МЫШИ СРАБАТЫВАЕТ СОБЫТИЕ click, ПОЭТОМУ СТАВИМ СЮДА TRUE
		this.map.boxZoom._moved = true;
		// удаляем дополнительный обработчик
		this.map.off('mousemove', this.dragHandler, this);		
		this.view.off('mouseup', this.dragMouseUp, this);
		this.fire('dragend', {primitiveID: this.objectID, event: 'circleDragEnd', center: this.getCenter()});
		// УВАГА! ЖЕСТКИЙ ХАК: ВОЗВРАЩАЕМ ВСЁ НА МЕСТО, УДАЛЯЕМ СВОЙСТВО С ТАЙМАУТОМ, ЧТОБЫ СОБЫТИЕ НЕ УСПЕЛО СРАБОТАТЬ
		setTimeout(()=>{delete self.map.boxZoom._moved;}, 50);		
	}
}

class LeafletRing extends LeafletObject{
	constructor(id, layer, data, owner, style){
		super(id, layer, data, owner, style);
		this.layer = layer;
		var self = this;
		let options = style;		
		options.fillOpacity = 0;
		options.stroke = true;		
		options.radius = data.radius;
		this.view = L.circle(data.center, options);
		this.view.on('click', function(e){
			//L.DomEvent.stopPropagation(e);			
		})	
	}

	setCenter(newCenter){
		this.view.setLatLng(newCenter);
	}

	setRadius(newRadius){
		this.view.setRadius(newRadius);
	}
}

class LeafletLine extends LeafletObject{	
	constructor(id, layer, data, owner, style){
		super(id, layer, data, owner, style);
		this.layer = layer;
		
		this.view = L.polyline(data.coords, style);		
		
		var self = this;
		this.view.on('click', function(e){
			// отключаем распространение события на вышестоящие объекты (иначе одновременно будет срабатывать клик по карте, например)
			L.DomEvent.stopPropagation(e);			
			// формируем контекст события, передаваемый наверх
			var context = {
				primitiveID: self.objectID,
				event: 'lineClick',
				coords: LeafletStaticMap.fromNativeToRaw(e.latlng)
			};
			// активируем событие линии
			self.fire('click', context);
		});

		this.view.on('mouseover', function(e){
			// отключаем распространение события на вышестоящие объекты (иначе одновременно будет срабатывать клик по карте, например)
			L.DomEvent.stopPropagation(e);			
			// формируем контекст события, передаваемый наверх
			var context = {
				primitiveID: self.objectID,
				event: 'lineMouseOver',
				coords: LeafletStaticMap.fromNativeToRaw(e.latlng)
			};
			// активируем событие линии
			self.fire('mouseover', context);
		});

		this.view.on('mouseout', function(e){
			// отключаем распространение события на вышестоящие объекты (иначе одновременно будет срабатывать клик по карте, например)
			L.DomEvent.stopPropagation(e);			
			// формируем контекст события, передаваемый наверх
			var context = {
				primitiveID: self.objectID,
				event: 'lineMouseOut',
				coords: LeafletStaticMap.fromNativeToRaw(e.latlng)
			};
			// активируем событие линии
			self.fire('mouseout', context);
		});
	}

	setLatLngs(ll){
		this.view.setLatLngs(LeafletStaticMap.fromRawToNative(ll));
	}

	moveNodeTo(index, coords){
		var ll = this.view.getLatLngs()[0];
		ll[index] = LeafletStaticMap.fromRawToNative(coords);
		this.view.setLatLngs(ll);
	}
}

class LeafletSegment extends LeafletLine{
	constructor(id, layer, data, owner, style){
		super(id, layer, data, owner, style);		
		this.startsAt = data.startsAt;
		this.length = this.view.getLatLngs()[0].distanceTo(this.view.getLatLngs()[1]);
		this.endsAt = this.startsAt + this.length;		
	}

	getLength() { return this.length }

	getStart() { return this.startsAt }

	getEnd () { return this.endsAt }
}

class LeafletPolyline extends LeafletObject{
	constructor(id, layer, data, owner, style){
		super(id, layer, data, owner, style);
		this.layer = layer;
		this.view = L.polyline(data.coords, style);
		var self = this;
		this.view.on('click', function(e){
			// отключаем распространение события на вышестоящие объекты (иначе одновременно будет срабатывать клик по карте, например)
			L.DomEvent.stopPropagation(e);			
			// формируем контекст события, передаваемый наверх
			var context = {
				primitiveID: self.objectID,
				event: 'lineClick',
				coords: LeafletStaticMap.fromNativeToRaw(e.latlng)
			};
			// активируем событие линии
			self.fire('click', context);
		});
	}

	setLatLngs(ll){
		this.view.setLatLngs(ll);
	}

	moveNodeTo(index, coords){
		var ll = this.view.getLatLngs()[0];
		ll[index] = LeafletStaticMap.fromRawToNative(coords);
		this.view.setLatLngs(ll);
	}

	insertPoint(index, coords){
		let ll = this.view.getLatLngs()[0];
		ll.splice(index, 0, LeafletStaticMap.fromRawToNative(coords));
		this.view.setLatLngs(ll);
	}

	removeNode(index){
		let ll = this.view.getLatLngs()[0];
		ll.splice(index, 1);
		this.view.setLatLngs(ll);
	}
	
}

class LeafletMarker extends LeafletObject{
	constructor(id, layer, data, owner, style, isDraggable){
		super(id, layer, data, owner, style);
		var self = this;
		this.layer = layer;
		this.draggable = isDraggable || false;
		this.view = L.marker(data.point, {icon: style, draggable :this.draggable});

		this.view.on('click', function(e){
			// отключаем распространение события на вышестоящие объекты (иначе одновременно будет срабатывать клик по карте, например)
			L.DomEvent.stopPropagation(e);
			// активируем событие
			self.fire('click', {
				primitiveID: self.objectID,
				event: 'markerClick',
				coords: [e.latlng.lat, e.latlng.lng]
			});
		});
		this.view.on('mouseout', function(e){
			self.fire('mouseout', {
				primitiveID: self.objectID,
				event: 'markerMouseOut'				
			});
		});

		if (this.draggable){
			this.enableDragging();
		}		
	}

	setLatLngs(ll){		
		let p = null;
		if (typeof ll[0] === 'object'){
			p = ll[0]
		} else
			p = ll;		
		this.view.setLatLng(p);
	}

	getLatLngs(){		
		return LeafletStaticMap.fromNativeToRaw([this.view.getLatLng()]);
	}

	enableDragging(){
		if (!this.view.options.draggable){
			this.view.dragging.enable();
		}
		var self = this;		
		this.view.on('dragstart', function(e){
			var context = {
				primitiveID: self.objectID,
				event: 'markerDragStart',
				coords: [e.target._latlng.lat, e.target._latlng.lng]
			};			
			self.fire('dragstart',e);
		});
		this.view.on('drag', function(e){
			var context = {
				primitiveID: self.objectID,
				event: 'markerDrag',
				coords: [e.latlng.lat, e.latlng.lng]
			};			
			self.fire('drag',context);
		});
		this.view.on('dragend', function(e){
			var context = {
				primitiveID: self.objectID,
				event: 'markerDragEnd',
				distance: e.distance,
				coords: [e.target._latlng.lat, e.target._latlng.lng]
			};			
			self.fire('dragend',context);
		});
	}

	disableDragging(){
		this.view.dragging.disable();		
		this.view.on('dragstart', null);
		this.view.on('drag', null);
		this.view.on('dragend', null);
	}

	moveNodeTo(index, coords){		
		this.view.setLatLng(coords);
	}	

	setColor(color){		
		document.getElementById('icon'+this.objectID).style.color = color;
	}

	getColor(){
		return this.view.options.icon.options.html.match(/#.{6}/)[0];
	}

	setStyle(style){
		this.style = style;
		this.view.options.icon = LeafletStaticMap.convertIcon(this.style);
	}
}

/*
	Подпись с буквами
	Может быть размещена различными способами вокруг объекта, к которому прикреплена.
	По факту является маркером с текстом.
	Возможно выравнивание по горизонтали и по вертикали (left, right, center & top, bottom, middle)
	Если маркер имеет координаты latlon, то подпись относительно данной точки может быть размещена следующими способами:

	X-------X-------X
	.               .
	X-------X-------X
	.               .
	X-------X-------X

	Если задано положение слева от объекта, то горизонтальный добавляется отступ (несколько пикселей);
		положение справа - отрицательный горизонтальный отступ;
		положение сверху - положительный вертикальный отступ;
		положение снизу - отрицательный вертикальный отступ;
	У центральных положений отступов нет.

	Атрибуты:
		align - положение относительно координат, представление - [horizontal, vertical]; horizontal & vertical сверяются с StaticMap.getStyleCollection.label.align;
		style - стиль текста (CSS в 1 строку);
		coords - положение на карте;

*/
class LeafletLabel extends LeafletObject{

	constructor(id, layer, data, owner, style){
		//this.primitivesCounter, this.map, {coords: coords, text: text, align: align}, owner, style
		super(id, layer, data, owner, style);
		var self = this;		
		this.layer = layer;
		// текст подписи
		this.text = data.text;
		this.coords = data.coords;
		// размер текста в пикселях
		this.textSize = this.calcTextSize();
		// выравнивание
		this.align = data.align;		
		// ID элемента, в котором хранится текст
		this.textElement = 'mapLabel'+this.objectID;
		// создаём иконку		
		this.view = L.marker(this.coords, {icon: this.createIcon()});
		// обработчик клика по подписи
		this.view.on('click', function(e){
			// отключаем распространение события на вышестоящие объекты (иначе одновременно будет срабатывать клик по карте, например)
			L.DomEvent.stopPropagation(e);
			self.fire('click', {primitiveID: self.objectID});			
		});
	}

	createIcon(){
		// вычисляем отступ и подставляем результат
		let inlineStyle = this.style.text || '';		
		let anchor = this.calcLeafletIconAnchor(this.align);
		let icon = L.divIcon({iconAnchor: anchor, className: 'mapLabel', html: '<p class="mapText" id="'+this.textElement+'" style="'+inlineStyle+'">'+this.text+'</p>'});
		return icon;
	}

	// хацкерный метод, возвращающий размер текстового блока в пикселях
	// для этого делается невидимый спан, в который вставляется текст
	// после получения ширины и высоты спан удаляется
	calcTextSize(){
		let s = document.createElement('span');
		s.innerHTML = this.text;
		s.style.visibility="hidden";
		s.style.whiteSpace="nowrap";
		if (this.style.text){
			if (this.style.text){
				s.style = this.style.text
			}			
		} else {
			// если стиль не задан, копируем дефолтный из лифлета			
			s.style.font = window.getComputedStyle(document.getElementsByClassName('leaflet-container')[0]).font;
		}
		document.body.appendChild(s);
		let res={width:s.offsetWidth, height:s.offsetHeight};
		document.body.removeChild(s);
		return res;
	}

	// вычисляет параметр иконки iconAnchor, отвечающий за её положение
	calcLeafletIconAnchor(newAlign){		
		// отступы по горизонтали и вертикали (будем вычислять) и перечисление с вариантами выравнивания для сверки
		let marginHor = 0, marginVert = 0, aligns = LeafletStaticMap.getStyleCollection().label.align;
		// отступы по умолчанию
		const defaultMarginHor = -10, defaultMarginVert = -10;
		// находим отступ иконки по горизонтали
		if (newAlign){
			switch (newAlign[0]){
				case  aligns.hor.left:
					marginHor = defaultMarginHor; break;					
				case aligns.hor.right:
					marginHor = this.textSize.width - defaultMarginHor; break;
				case aligns.hor.center:			
					marginHor = Math.ceil(this.textSize.width / 2); break;
			};
			// находим отступ иконки по вертикали
			switch (newAlign[1]){
				case  aligns.vert.top:
					marginVert = defaultMarginVert; break;
				case aligns.vert.bottom:
					marginVert = (this.textSize.height - defaultMarginVert); break;
				case aligns.vert.middle:
					marginVert = Math.ceil(this.textSize.height / 2);
			}
		} else {
			marginHor = defaultMarginHor;
			marginVert = defaultMarginVert;
		}				
		return [marginHor, marginVert];
	}

	// смена шрифта подписи
	setStyle(style){
		// перезаписываем стиль в поле
		this.style.text = style.text;
		// т.к. шрифт поменялся, то мог измениться размер текстового блока, следовательно
		// нужно пересчитать размер надписи и перерисовать выравнивание
		this.textSize = this.calcTextSize();
		// пересоздаём иконку
		this.layer.removeLayer(this.view);
		this.view.options.icon = this.createIcon();		
		this.layer.addLayer(this.view);
	}

	// задает положение подписи
	setAlign(newAlign){
		// перезаписываем поле объекта
		this.align = newAlign;
		// пересоздаём иконку	
		this.layer.removeLayer(this.view);
		this.view.options.icon = this.createIcon();		
		this.layer.addLayer(this.view);		
	}

	setLatLngs(ll){		
		let p = null;
		if (typeof ll[0] === 'object'){
			p = ll[0]
		} else
			p = ll;		
		this.view.setLatLng(p);
		this.coords = p;
	}
}

// плашка
class LeafletPopup extends LeafletObject{
	constructor(id, layer, data, owner, style){
		super(id, layer, data, owner, style);
		this.layer = layer;
		this.view = L.popup(style);
		this.view.setLatLng(data.coords);		
		this.readOnly = data.readOnly || false;
		// корректны ли данные в полях ввода
		this.correct = true;		
		this.setContent(data.content);
	}

	setContent(content){
		this.view.setContent(content);
	}

	fillValues(){}

	setLatLngs(ll){
		let p = null;
		if (typeof ll[0] === 'object'){
			p = ll[0]
		} else
			p = ll;
		this.view.setLatLng(p);
	}
}

class LeafletHashPopup extends LeafletPopup{
	constructor(id, layer, data, owner, style){
		super(id, layer, data, owner, style);
	}

	/*
		Генерируем html-разметку для плашки (с редактированием и без)
	*/
	setContent(content){
		this.inputContent = '';
		this.readOnlyContent = '';
		if(content){
			this.createFields(content);
			var 
				// левая сторона плашки содержит подписи к полям, она одинакова для обоих вариантов
				leftSide = '<div class="wrapper"><div class="gzmleftblock">',
				// правая сторона для плашки с полями для ввода
				rightSide1 = '<div class="gzmrightblock">',
				// правая сторона для плашки readOnly
				rightSide2 = '<div class="gzmrightblock">'
			for (var i=0; i<this.fields.length; i++){
				leftSide += '<span>'+this.fields[i].name+'</span>';
				rightSide1 += '<input type="'+this.fields[i].inputType+'" id ="'+this.fields[i].inputElement+'">';
				rightSide2 += '<span id ="'+this.fields[i].displayElement+'"</span>';
			}
			leftSide += '</div>';
			rightSide1 += '</div>';  
			rightSide2 += '</div>';
			this.inputContent = leftSide+rightSide1+'<div class="gzmbotblock"><div class="gzmbtn" id="smb.'+this.objectID+'">OK</div></div>'+'</div>';
			this.readOnlyContent = leftSide+rightSide2+'</div>';			
		}		
		if (this.readOnly){
			this.view.setContent(this.readOnlyContent);
		} else {
			this.view.setContent(this.inputContent);
		}
	}

	/*
		Создаёт поля для плашки, используя хэш, пришедший в параметре как исходные данные
	*/
	createFields(data){		
		this.fields = [];
		var index = 0, self = this;
		for (var key in data){			
			// при создании поля передаем его название, текущее значение, порядковый номер, тип данных и ссылку на основной объект (т.е. на плашку)			
			this.fields.push(new PopupField(key, data[key].value, index, data[key].dataType || 'text', data[key].commands, this));
			// вешаем на поля обработчики
			// значение проверено
			this.fields[this.fields.length-1].addListener('validated', function(context){
				self.correct = true;
			});
			// начато редактирование
			this.fields[this.fields.length-1].addListener('startEdit', function(context){
				self.correct = false;
			});
			// некорректный ввод
			this.fields[this.fields.length-1].addListener('invalidValue', function(context){
				self.correct = false;
			});
		}
	}

	show(){		
		this.layer.removeLayer(this.view);
		// показываем саму плашку
		this.layer.addLayer(this.view);
		// заполняем значения появившихся элементов		
		for (var i = 0; i < this.fields.length; i++){			
			this.fields[i].show();
		}
		var self = this;
		// обработчик клика кнопки Ok
		document.getElementById('smb.'+this.objectID).onclick = function(){			
			var pack = [];
			if (self.correct){
				// перебираем все поля
				// формируем набор данных для передачи через событие
				for(var i = 0; i < self.fields.length; i++){					
					pack.push({
						fieldName: self.fields[i].name,
						value: self.fields[i].value,
						index: self.fields[i].index
					});
				}
				// кидаем событие с новыми значениями полей
				self.fire('fieldsUpdate', {data: pack});
				self.hide();
			}			
		}
		this.correct = true;
	}
}

class LeafletStretcherPopup extends LeafletHashPopup{
	constructor(id, layer, data, owner, style){
		super(id, layer, data, owner, style);
		this.index = data.index;
	}

	setContent(content){
		this.inputContent = '';		
		if(content){
			this.createFields(content);			
			// контент плашки - одно поле с координатами
			this.inputContent = '<div class="gzmtopblock"><input type="'+this.fields[0].inputType+'" id="'+this.fields[0].inputElement+'">';
			// достаем команды поля и дописываем код разметки
			for (var i = 0; i < this.fields[0].commands.length; i++){
				this.inputContent += '<div class="gzmbtn" id="'+this.fields[0].commands[i].elementID+'">'+this.fields[0].commands[i].caption+'</div>';
			}
			this.inputContent += '</div>';			
		}		
		this.view.setContent(this.inputContent);
	}

	fillValues(){}

	show(){		
		this.layer.removeLayer(this.view);
		// показываем саму плашку
		this.layer.addLayer(this.view);
		// заполняем значения появившихся элементов		
		for (var i = 0; i < this.fields.length; i++){
			this.fields[i].show();
		}
		var self = this;
		// обработчик клика кнопки Ok (перестановка вершины)
		document.getElementById(this.fields[0].commands[0].elementID).onclick = function(){			
			if (self.correct){				
				// кидаем событие с новыми значениями полей
				self.fire('moveNodeDirect', {
					primitiveID: self.objectID,
					event: 'popupMoveNode',
					coords: self.fields[0].value
				});
			}			
		}
		// обработчик клика кнопки удаления вершины
		document.getElementById(this.fields[0].commands[1].elementID).onclick = function(){						
			self.fire('removeNode', {
				primitiveID: self.objectID,
				event: 'popupRemoveNode'
			});
		}
		this.correct = true;
	}

	setLatLngs(ll){		
		let p = null;
		if (typeof ll[0] === 'object'){
			p = ll[0]
		} else
			p = ll;		
		this.view.setLatLng(p);
		// после того, как плашка была передвинута меняем ей значение поля с координатами
		if (this.fields[0]){			
			this.fields[0].setValue(p);
		}		
	}
}

class LeafletMarker1 extends LeafletObject{
	constructor(id, layer, data, owner, style){
		super(id, layer, data, owner, style);
		this.layer = layer;
		this.view = L.marker(data.point);
		layer.addLayer(this.view);
	}
}
},{}],34:[function(require,module,exports){
window.DTruck = class DTruck extends DynamicObject{
	/*
		Атрибуты
			Текущая позиция
			Хинт
			Подпись
		Части
			Маркер
			Подпись
		Методы
			Показать
			Спрятать
			Переставить		
	*/
	constructor(uuid, map, position, hint, title, props){
		super(uuid, map, position, hint, title, props);
	}
}
},{}],35:[function(require,module,exports){
window.DynamicObject = class DynamicObject extends SmartObject{
	/*
		Атрибуты
			Текущая позиция
			Хинт
			Подпись
		Части
			Маркер
			Подпись
		Методы
			Показать
			Спрятать
			Переставить		
	*/
	constructor(uuid, map, position, hint, title, props){
		super();
		this.uuid = uuid;
		this.map = map;
		this.position = position;
		this.hint = hint;
		this.title = title;
		this.props = props;
		this.isVisible = true;
		this.isSelected = false;
		this.style = StaticMap.getStyleForObject(this);
		if (this.position){
			this.createMarker();
			this.createLabel();
		} else {
			this.marker = null;
			this.label = null;
			this.isVisible = false;
		}
	}

	getPosition(){
		return this.position;
	}

	getCenter(){
		return this.getPosition();
	}

	// маркер объекта
	createMarker(){
		if (!this.marker){
			var self = this;
			this.marker = this.map.createMarker(this.position, this, this.style.marker, false);
			this.marker.addListener('click', function(context){				
				self.markerClickHandler(context);
			});
			this.marker.show();
		}
	}

	markerClickHandler(context){		
		let c = {coords: context.coords, uuid: this.uuid};
		this.fire('mapClick', c);
	}

	labelClickHandler(){}

	// подпись к маркеру
	createLabel(){
		if (!this.label){
			let aligns = StaticMap.getStyleCollection().label.align;
			this.label = this.map.createLabel(this.position, this, this.title, this.style.label, this.style.label.align);
			this.label.show();
		}
	}

	show(){
		this.isVisible = true;
		this.marker.show();
		this.label.show();
	}

	hide(){
		this.isVisible = false;
		this.marker.hide();
		this.label.hide();
	}

	// перестановка объекта в указанные координаты
	moveTo(coords){
		this.position = coords;
		if (!this.marker && !this.label){
			this.createMarker();
			this.createLabel();
		}
		if (this.isVisible){
			this.marker.setLatLngs(this.position);
			this.label.setLatLngs(this.position);			
		}
	}

	select(){
		this.isSelected = true;
		if (this.isVisible) this.highlightOn();
	}

	unselect(){
		this.isSelected = false;
		if (this.isVisible) this.highlightOff();
	}

	setStyle(style){
		this.style = style;
		// должен поменяться стиль маркера и подписи
	}

	highlightOn(){		
		this.style = StaticMap.getStyleForObject(this);		
		if (this.marker && this.label){
			this.marker.setColor(this.style.marker.color);
			this.label.setStyle(this.style.label);
		}
		
	}

	highlightOff(){		
		this.style = StaticMap.getStyleForObject(this);
		if (this.marker && this.label){
			this.marker.setColor(this.style.marker.color);
			this.label.setStyle(this.style.label);
		}
	}

	grabIDs(){
		return [this.marker.objectID, this.label.objectID];		
	}
}
},{}],36:[function(require,module,exports){
/*
	Класс, отвечающий за отслеживание объектов
*/
window.Monitor = class Monitor extends SmartObject{
	constructor(master){
		super();
		this.master = master;
		this.trackingObjects = {};
	}
	/* 
		Добавляет в мониторинг объект для отслеживания,
		включающий в себя маршрут, подвижный объект для показа перемещений
		data = {			
			uuid: ***,
			track : {
				plan:{
					coords: []
				},
				fact: {
					coords: [],
					stops: []
				}
			},
			position: [lat, lng]
		}
	*/
	addTrackingObject(data){
		// собираем объект из трека и маркера
		// собираем трек из плана и факта
		var track = null, plan = null, fact = null, buf = null, dynamic = null, self = this;
		if (data.track){
			if (data.track.plan){
				buf = data.track.plan;
				buf.objectID = this.master.getNewID();
				this.master.deployObject('PlannedRoute', buf);
				plan = this.master.map.staticObjects[buf.objectID];
			}
			if (data.track.fact){
				buf = data.track.fact;
				buf.objectID = this.master.getNewID();
				this.master.deployObject('FactRoute', buf);
				fact = this.master.map.staticObjects[buf.objectID];
			}			
			if (plan || fact){
				track = new Track(plan, fact);				
			}
		}		
		let 
			position = data.currentPosition || null,
			hint = data.markerHint || null,
			title = data.title || null,
			props = data.props || null;			
		if (data.className){
			switch (data.className){
				case 'Truck':				
					dynamic = new DTruck(data.uuid, this.master.map, position, hint, title, props);					
					break;
			}
		} else {
			dynamic = new DynamicObject(data.uuid, this.master.map, position, hint, title, props);
		}		
		dynamic.addListener('mapClick', function(context){
			self.master.map.fire('mapClick', context);
		});
		this.master.map.dynamicObjects[data.uuid] = dynamic;
		this.trackingObjects[data.uuid] = new TrackingObject(data.uuid, track, dynamic);
		return this.trackingObjects[data.uuid];
	}

	deleteTrackingObject(ID){
		// получаем ID объектов, из которых состоит отслеживаемый объект
		var ids = this.trackingObjects[ID].grabIDs();		
		// обращаемся к ГЗМ и удаляем эти объекты
		this.master.deleteStaticObject(ids.plan);
		this.master.deleteStaticObject(ids.fact);
		this.master.map.eraseDynamicObject(ids.dynamic);
	}

	updateAll(data){
		for (var uuid in data){
			this.trackingObjects[uuid].updatePosition(data[uuid]);
		}
	}

	updateByID(ID, data){

	}
}

/*
	Класс объектов отслеживания
	Включает всё необходимое для ведения онлайн-мониторинга перемещающегося объекта (человека, автомобиля и т.д.)
		Маршрут (плановый и фактический с остановками)
		Подвижный маркер для отображения на карте текущего местоположения объекта
	Что умеет
		Управление треком (показать, спрятать плановый/фактический маршрут или остановки)
		Обновление данных о своём местоположении в реальном времени (обновляется трек и позиция маркера)
		Выделение		
		Убирание с карты	
*/
window.TrackingObject = class TrackingObject extends SmartObject{
	constructor(uuid, track, dynamic){
		super();
		this.uuid = uuid;		
		this.track = track;		
		this.dynamic = dynamic;
	}

	setTrack(track){
		this.track = track;
	}

	updatePosition(coords){
		this.dynamic.moveTo(coords);
	}

	updateTrack(data){}

	update(data){}

	show(){}

	hide(){}

	subscribe(){}

	grabIDs(){
		var result = {fact: null, plan: null, dynamic: null};		
		if (this.track.fact) result.fact = this.track.fact.objectID;
		if (this.track.plan) result.plan = this.track.plan.objectID;
		if (this.dynamic) {
			result.dynamic = this.dynamic.uuid;			
		}
		return result;
	}
}

/*
	Трек - сложный объект, состоящий из 2 (или 1) маршрутов - планового и фактического
*/
window.Track = class Track extends SmartObject{
	constructor(plan, fact){
		super();
		this.plan = plan;
		this.fact = fact;		
	}

	showFact(){
		if (this.fact) this.fact.show();
	}

	showPlan(){
		if (this.plan) this.plan.show();
	}

	showStops(){
		if (this.fact && this.fact.stops){
			this.fact.showStops();
		}
	}

	hideFact(){
		if (this.fact) this.fact.hide();
	}

	hidePlan(){
		if (this.plan) this.plan.hide();
	}

	hideStops(){
		if (this.fact && this.fact.stops){
			this.fact.hideStops();
		}
	}

	show(){
		this.showPlan();
		this.showFact();
		this.showStops();
	}

	hide(){
		this.hidePlan();
		this.hideFact();
		this.hideStops();
	}

	destroy(){

	}
}
},{}]},{},[31]);
