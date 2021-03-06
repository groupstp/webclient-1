import TopMenu from './newTopMenu';
import DropDownMenu from './newDropdownMenu';
import ObjViewSelection from "./newObjViewSelection";
import ContentBuilder from "./newMainScreen";

import CookieService from "./services/cookie-service";
import LocalStorageService from './services/local-storage-service';
import * as tools from './tools';
import config from './config/config.js';

export default class Controller {
    constructor() {
        this._topMenu = null;
        this._objViewSelection = null;
        this._mainScreen = null;
    }

    async init() {
        this._initMenu();
        this._initMainScreen();
        this._initOjViewSelection();

        let urlParams = this._getURLParams();

        // получить данные с сервера
        let mainInterface;
        try {
            mainInterface = await this._getInterface(urlParams.token);
        } catch (err) {
            console.log(err);
            alert('Ошибка при получении интерфейса!');
            this._objViewSelection.hide();
            return;
        }

        // если получили интерфейс с токеном, который получили в url, то сохраним его (скорее всего это поставщик зашел по ссылке)
        if (urlParams.token) {
            CookieService.setCookie(config.name, urlParams.token);
        }

        const allowedObjectViews = [];
        for (let objViewName in mainInterface.objectViews) {
            allowedObjectViews.push(objViewName);
        }

        const currentObjView = LocalStorageService.get('currentObjView');

        if (allowedObjectViews.length > 1) {
            this._objViewSelection.addObjectView(allowedObjectViews);
            // if we already use one of allowed object views
            if (allowedObjectViews.indexOf(currentObjView) !== -1) {
                this._objViewSelection.render();
                this._objViewSelection.hide();
                this._updateMenu(currentObjView);
                this._mainScreen.show();
            } else { // if we use object view that have been forbidden for us
                LocalStorageService.delete('currentObjView');
                this._objViewSelection.render();
                this._objViewSelection.show();
            }
        } else if (allowedObjectViews.length === 1) {
            this._objViewSelection.addObjectView(allowedObjectViews);
            if (currentObjView !== allowedObjectViews[0]) {
                LocalStorageService.set('currentObjView', allowedObjectViews[0]);
            }
            this._updateMenu(allowedObjectViews[0]);
            this._mainScreen.show();
        }

        // если в url передали название объекта и предметной области, то подгрузим этот объект
        if (urlParams.object) {
            let page = this._mainScreen.showPage(`ref-${urlParams.object}`);
            //загружаем содержимое страницы с сервера
            page.load();
        }

    }

    _initMenu() {
        let userName = CookieService.getCookie('userName');
        this._topMenu = new TopMenu({
            el: document.querySelector('#topMenu'),
            userName: userName,
            title: config.caption
        });
        this._topMenu.render();

        //подписка на клик, роутер системы
        this._topMenu.on('menuItemSelected', event => {
            let detail = event.detail;
            //if (detail.obj === 'reference' || detail.obj === 'stage' || detail.obj === 'scheme') {
            let path;
            if (detail.obj === 'scheme') {
                path = 'ref-scheme';
            } else {
                path = 'ref-' + detail.name;
            }

            let page = this._mainScreen.showPage(path, detail.caption);
            //загружаем содержимое страницы с сервера
            page.load();
            //выделить пункт меню
            //menu.selectItem(path);
            //}
        });

        this._topMenu.on('toObjViewSelection', event => {
            this._topMenu.clearDropDownMenus();
            this._topMenu.render();
            this._mainScreen.hide();
            this._objViewSelection.show();
        });

        this._topMenu.on('exit', event => {
            new tools.TokenAuth(config.name).exit('index.html');
        });

    }

    _initOjViewSelection(objViews) {
        this._objViewSelection = new ObjViewSelection({
            el: document.querySelector('#objViewSelection'),
            objViews: objViews
        });
        this._objViewSelection.render();
        this._objViewSelection.hide();

        this._objViewSelection.on('objViewSelected', async (event) => {
            let selectedObjView = event.detail.name;
            // set cookie for one day
            LocalStorageService.set('currentObjView', selectedObjView);
            this._objViewSelection.hide();
            this._updateMenu(selectedObjView);
            this._clearObjects();
            this._mainScreen.show();
            this._mainScreen.clearScreen();
        });

    }

    _initMainScreen() {
        this._mainScreen = new ContentBuilder({box: document.querySelector('#container')});
        this._mainScreen.render();
        this._mainScreen.hide();
    }

    _clearObjects() {
        // delete all w2ui objects because they don't need anymore after we switch object view
        for (let obj in w2ui) {
            delete w2ui[obj];
        }
        for (let obj in stpui) {
            delete stpui[obj];
        }
    }

    _getURLParams() {
        let urlParams = {};
        let queryString = window.location.hash.slice(1);
        urlParams = tools.utils.parseQueryString(queryString);
        return urlParams;
    }

    async _updateMenu(objView) {
        const elements = await this._getMenuFromServer(objView);
        for (let objType in elements) {
            let options = {
                key: objType,
                title: '',
                items: [],
                objView: objView,
                mainPage: config.mainPage
            };
            const element = elements[objType];
            options.title = element.display;

            const innerObjects = element.objects;

            innerObjects.forEach((innerEl) => {
                const item = {
                    key: innerEl.key,
                    value: innerEl.value
                };
                options.items.push(item);
            });

            this._topMenu.addDropDownMenu(new DropDownMenu(options));
        }
        this._topMenu.renderDDMenus();
    }

    async _getMenuFromServer(objView) {
        const request = twoBe.createRequest();
        request.addParam('action', 'getMenu').addParam('objView', objView);
        return request.send();
        //twoBe.showMessage(0, "Не удалось получить навигационное меню с сервера!");
    }

    async _getInterface(token) {
        console.log("Trying create request");
        const request = twoBe.createRequest();
        console.log("Trying getDefaultParams");
        const url = twoBe.getDefaultParams().url + '/getConfigInfo';
        console.log("Trying add token to parameters");
        if (token) request.addParam('token', token);
        console.log("Trying add url to request");
        request.addUrl(url);
        console.log("Trying send request");
        return request.send().catch((err) => {
            if (err.code === 401) {
                window.location.href = 'index.html';
            }
        });

    }
}

