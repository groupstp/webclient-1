import template from './menu.tpl';
import './menu.css';

export default class DropDownMenu{
    constructor(options){
        this._key = options.key || 'undefined';
        this._title = options.title || '';
        this._items = options.items || []; // объекты {key : 'position', value : 'Заявка'}
        this._objView = options.objView;
        this._mainPage = options.mainPage;
    }

    render(){
        const HTML = template({
            menuKey : this._key,
            title : this._title,
            items : this._items,
            objView : this._objView,
            mainPage : this._mainPage
        });

        return HTML;
    }
}