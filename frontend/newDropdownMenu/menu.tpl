{{#if items}}
    <a class="dropdown-toggle" data-toggle="dropdown">{{title}}
        <b class="caret"></b>
    </a>
    <ul class="dropdown-menu">
        {{#each items}}
        <li id="topMenu_{{../menuKey}}-{{this.key}}" style="cursor: pointer" data-obj="{{../menuKey}}"
            data-name="{{this.key}}" data-caption="{{this.value}}" data-sel=true data-cl=true><a>{{this.value}}</a></li>
        {{/each}}
    </ul>
{{else}}
    <li id="topMenu_{{menuKey}}" style="cursor: pointer" data-obj="{{menuKey}}" data-caption="{{title}}" data-sel=true data-cl=true><a>{{title}}</a>
    </li>
{{/if}}