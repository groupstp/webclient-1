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