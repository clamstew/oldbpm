define(function() {
    function init(width, height) {
        this.width = width;
        this.height = height;
        this.stage = new PIXI.Stage(0x505050);
        this.renderer = PIXI.autoDetectRenderer(this.width, this.height);

        // Custom depth property for PIXI display objects.
        Object.defineProperty(PIXI.DisplayObject.prototype, 'depth', {
            get: function() { return this._bpmDepth; },
            set: function(val) { this._bpmDepth = val; },
        });

        this.renderer.view.tabIndex = 0;
        document.body.appendChild(this.renderer.view);
        this.renderer.view.focus();
    }

    function sortDisplays(container) {
        var comparator = function(a, b) {
            var aDepth = a.depth ? a.depth : 0;
            var bDepth = b.depth ? b.depth : 0;
            return aDepth - bDepth;
        };

        if (container) {
            container.children.sort(comparator);
        } else {
            this.stage.children.sort(comparator);
        }
    }

    function render() {
        this.renderer.render(this.stage);
    }

    return {
        init: init,
        sortDisplays: sortDisplays,
        render: render,
    };
});
