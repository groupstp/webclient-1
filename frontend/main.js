/**
 * Модуль для построения главной страницы приложения
 * @module mainPage
 * @requires menu
 * @requires w2ui {@link https://w2ui.com}
 * @requires jQuery
 * @requires config
 * @requires tools
 * @requires contentBuilder
 */

'use strict'
//подключаем стили - можно создать несколько точек входа для каждого файла стилей
import './libraries/bootstrap/css/bootstrap.css';
import './libraries/fontawesome/css/font-awesome.css';
//еще немного скриптов
require('imports-loader?jQuery=jquery!./libraries/bootstrap/js/bootstrap.js');
//подключаем меню, причем сразу же
import menuTopFixed from './menu/index.js';
//подключаем менеджер страниц
import contentBuilder from './contentBuilder/index.js';
//подключаем конфиг
import {config} from './config/config.js';
//подключаем тулзы
import * as tools from './tools/index.js';
//подключаем библиотеку w2ui и экспортируем переменные из нее
const w2lib = require('imports-loader?jQuery=jquery!exports-loader?w2ui&w2alert&w2popup&w2utils&w2confirm!./libraries/w2ui/w2ui-1.5.js');
//подключаем стили
import './libraries/w2ui/w2ui-1.5.css';
//импортированные переменные делаем доступными всюду, в том числе jQuery;
window.w2popup = w2lib.w2popup;
window.w2alert = w2lib.w2alert;
window.w2ui = w2lib.w2ui;
window.w2utils = w2lib.w2utils;
window.w2confirm = w2lib.w2confirm;
window.jQuery = jQuery;
//проба сокетов

// var socket = new WebSocket("ws://localhost:8081");
// socket.onmessage = function (event) {
//     let incomingMessage = event.data;
//     w2alert(incomingMessage);
// };
//проверка токена
let token = new tools.TokenAuth(config.name).checkToken();
if (token === undefined) {
    document.location.href = 'index.html';
}
let ruLocale = require('./libraries/w2ui/ru-ru.json')
w2utils.locale(ruLocale);
//строим меню или не строим
if (localStorage[config.name + '_ObjInfo'] === undefined) {
    document.location.href = 'index.html';
}
let info = JSON.parse(localStorage[config.name + '_ObjInfo']);
var menu = new menuTopFixed({
    name: config.caption,
    place: 'topMenu',
    objInfo: info
});
let containerDiv = document.getElementById('container');
//строим менеджер страниц
let builder = new contentBuilder({box: containerDiv, onHome: buildMain});
buildMain(builder);
//подписка на клик, роутер системы
menu.on('menuItemSelected', event => {
    let detail = event.detail;
    if (detail.obj === 'ref' || detail.obj === 'doc' || detail.obj === 'st') {
        let path = detail.obj + '-' + detail.name;
        let page = builder.showPage(path, detail.caption);
        //загружаем содержимое страницы с сервера
        page.load();
        //выделить пункт меню
        menu.selectItem(path);
    }
    /*кнопка выход*/
    if (detail.obj === 'exit') {
        new tools.TokenAuth(config.name).exit('index.html');
    }
})

function buildMain(builder) {
    let place = builder.showPage('main', 'Главная страница').generatedBox;
    place.innerHTML = '<div style = "text-align: center"><img src="mainPage.gif" alt="" class="fa-spin"><p><h1>Вы на главной странице!</h1></p></div>';
}





