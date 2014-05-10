define(['objects', 'gfx'], function(objects, gfx) {
    function State() {
        this.displayObjects = [];
        this.objects = [];
        this.objectsToAdd = [];
        this.objectsToRemove = [];

        this._init = function() {
            this.init();
        };

        // When this state has been switched
        this._destroy = function() {
            // Remove all objects
            for (var i=0; i<this.objects.length; ++i) {
                this.objects[i]._destroy(this);
            }

            // Remove any additional displays
            for (var i=0; i<this.displayObjects.length; ++i) {
                this.removeDisplay(this.displayObjects[i]);
            }

            this.destroy();
        };

        this._update = function(delta) {
            // Add queued objects
            for (var i=0; i<this.objectsToAdd.length; ++i) {
                var obj = this.objectsToAdd[i];

                this.objects.push(obj);
                obj._init(this);
            }
            this.objectsToAdd = [];

            // Remove queued objects
            for (var i=0; i<this.objectsToRemove.length; ++i) {
                var obj = this.objectsToRemove[i];
                var index = this.objects.indexOf(obj);

                if (index !== -1) {
                    this.objects.splice(index, 1);
                    obj._destroy(this);
                }
            }
            this.objectsToRemove = [];

            for (var i=0; i<this.objects.length; ++i) {
                this.objects[i]._update(delta);
            }

            this.update(delta);
        };

        this.add = function(obj) {
            this.objectsToAdd.push(obj);
            return obj;
        };

        this.remove = function(obj) {
            this.objectsToRemove.push(obj);
            return obj;
        };

        this.addDisplay = function(display, container) {
            this.displayObjects.push(display);
            if (container) {
                container.addChild(display);
            } else {
                gfx.stage.addChild(display);
            }
            return display;
        };

        this.removeDisplay = function(display) {
            this.displayObjects.splice(this.displayObjects.indexOf(display), 1);
            display.parent.removeChild(display);
            return display;
        };

        this.destroy = function() {};
        this.init = function() {};
        this.update = function(delta) {};
    }

    State.prototype = {
        init: function() {},

        // When this state has been switched
        destroy: function() {
            // Remove all objects
            for (var i=0; i<this.objects.length; ++i) {
                this.objects[i]._destroy(this);
            }

            // Remove any additional displays
            for (var i=0; i<this.displayObjects.length; ++i) {
                this.removeDisplay(this.displayObjects[i]);
            }
        },

        update: function(delta) {
            // Add queued objects
            for (var i=0; i<this.objectsToAdd.length; ++i) {
                var obj = this.objectsToAdd[i];

                this.objects.push(obj);
                obj._init(this);
            }
            this.objectsToAdd = [];

            // Remove queued objects
            for (var i=0; i<this.objectsToRemove.length; ++i) {
                var obj = this.objectsToRemove[i];
                var index = this.objects.indexOf(obj);

                if (index !== -1) {
                    this.objects.splice(index, 1);
                    obj._destroy(this);
                }
            }
            this.objectsToRemove = [];

            for (var i=0; i<this.objects.length; ++i) {
                this.objects[i]._update(delta);
            }
        },

        add: function(obj) {
            this.objectsToAdd.push(obj);
            return obj;
        },

        remove: function(obj) {
            this.objectsToRemove.push(obj);
            return obj;
        },

        addDisplay: function(display, container) {
            this.displayObjects.push(display);
            if (container) {
                container.addChild(display);
            } else {
                gfx.stage.addChild(display);
            }
            return display;
        },

        removeDisplay: function(display) {
            this.displayObjects.splice(this.displayObjects.indexOf(display), 1);
            display.parent.removeChild(display);
            return display;
        }
    };

    inherit(Testing, State);
    function Testing() {

    }

    Testing.prototype = {

    };

    inherit(Field, State);
    function Field() {
        State.call(this);
    }

    Field.prototype = {
        init: function() {
            Field.prototype.init.call(this);
            this.pinBatch = new gfx.pixi.SpriteBatch();
            this.bubbleBatch = new gfx.pixi.SpriteBatch();

            this.shooter = this.add(new objects.PinShooter());
            this.pin = this.add(new objects.PinTest(64,64,0));

            for (var i=0; i<1000; ++i) {
                this.add(new objects.Bubble(randomRange(32, gfx.width-32), randomRange(32, gfx.height-32), Math.random() * 360));
            }

            this.addDisplay(this.pinBatch);
            this.addDisplay(this.bubbleBatch);

            this.prim = this.addDisplay(new gfx.pixi.Graphics());
            this.prim.lineStyle(1, 0x00FF00);
            this.prim.drawRect(0,0,this.pin.width,this.pin.height);
            this.prim.depth = 1;
            gfx.sortDisplays();
        },

        update: function() {
            Field.prototype.init.call(this);
            this.prim.position.x = this.pin.x - this.pin.width*this.pin.anchor.x;
            this.prim.position.y = this.pin.y - this.pin.height*this.pin.anchor.y;
        }
    };

    return {
        Field: Field,
        Testing: Testing
    };
});
