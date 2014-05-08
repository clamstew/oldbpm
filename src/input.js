define(function() {
    function createKeyboard() { //tabindex="1" is required in the canvas tag for keyboard use.
        var down = [],
        downCount = 0,

        pressed = [],
        pressedCount = 0,

        released = [],
        releasedCount = 0;

        var onKeyDown = function(e) {
            if (!down[e.which]) {
                down[e.which] = true;
                downCount++;
                pressed[pressedCount] = e.which;
                pressedCount++;
            }
        };

        var onKeyUp = function(e) {
            if (down[e.which]) {
                down[e.which] = false;
                downCount--;
                released[releasedCount] = e.which;
                releasedCount++;
            }
        };

        return {
            attach: function(element) { //Attach an element to this instance to check for key presses.
                element.addEventListener('keydown', onKeyDown);
                element.addEventListener('keyup', onKeyUp);
            },

            update: function() { //This should be called last in your loop.
                while (pressedCount > 0) {
                    pressedCount--;
                    pressed[pressedCount] = -1;
                }

                while (releasedCount > 0) {
                    releasedCount--;
                    released[releasedCount] = -1;
                }
            },

            isDown: function(key) {
                for (var i = 0; i < down.length; i++) {
                    if (down[(typeof key === "number" ? key:key.charCodeAt(0))]) {
                        return true;
                    }
                }
                return false;
            },

            isPressed: function(key) {
                for (var i = 0; i < pressed.length; i++) {
                    if (pressed[i] === (typeof key === "number" ? key:key.charCodeAt(0))) {
                        return true;
                    }
                }
                return false;
            },

            isReleased: function(key) {
                for (var i = 0; i < released.length; i++) {
                    if (released[i] === (typeof key === "number" ? key:key.charCodeAt(0))) {
                        return true;
                    }
                }
                return false;
            },
        }
    }

    function createMouse() {
        var down = [],
        downCount = 0,

        pressed = [],
        pressedCount = 0,

        released = [],
        releasedCount = 0,

        pX = 0,
        pY = 0,
        oX = 0,
        oY = 0;

        var mouseMoving = false;

        var onMouseMove = function(e) {
            pX = e.pageX;
            pY = e.pageY;
            oX = e.target.offsetLeft;
            oY = e.target.offsetTop;
            mouseMoving = true;
        };

        var onMouseDown = function(e) {
            if (!down[e.which]) {
                down[e.which] = true;
                downCount++;
                pressed[pressedCount] = e.which;
                pressedCount++;
            }
        };

        var onMouseUp = function(e) {
            if (down[e.which]) {
                down[e.which] = false;
                downCount--;
                released[releasedCount] = e.which;
                releasedCount++;
            }
        };

        return {
            x: 0, y: 0,

            attach: function(element) { //Attach an element to this instance to check for mouse events.
                element.addEventListener('mousemove', onMouseMove);
                element.addEventListener('mousedown', onMouseDown);
                element.addEventListener('mouseup', onMouseUp);
            },

            update: function() { //This should be called last in your loop.
                while (pressedCount > 0) {
                    pressedCount--;
                    pressed[pressedCount] = -1;
                }

                while (releasedCount > 0) {
                    releasedCount--;
                    released[releasedCount] = -1;
                }

                this.x = pX - oX;
                this.y = pY - oY;

                mouseMoving = false;
            },

            getX: function(client) {
                var cl = typeof client !== "undefined" ? client : false;
                if (cl)
                    return pX;
                else
                    return this.x;
            },

            getY: function(client) {
                var cl = typeof client !== "undefined" ? client : false;
                if (cl)
                    return pY;
                else
                    return this.y;
            },

            isDown: function(button) {
                for (var i = 0; i < down.length; i++) {
                    if (down[button]) {
                        return true;
                    }
                }
                return false;
            },

            isPressed: function(button) {
                for (var i = 0; i < pressed.length; i++) {
                    if (pressed[i] === button) {
                        return true;
                    }
                }
                return false;
            },

            isReleased: function(button) {
                for (var i = 0; i < released.length; i++) {
                    if (released[i] === button) {
                        return true;
                    }
                }
                return false;
            },

            isColliding: function(x1, y1, x2, y2) {
                if (this.x >= x1 && this.x <= x2) {
                    if (this.y >= y1 && this.y <= y2) {
                        return true;
                    }
                }
                return false;
            },

            isMoving: function() {
                return mouseMoving;
            },

            print: function() {
                console.log("Mouse Object: x"+this.x+", y"+this.y);
            },
        }
    }

    var key = createKeyboard(), mouse = createMouse();
    function init(element) {
        key.attach(element);
        mouse.attach(element);
    }

    function update() {
        key.update();
        mouse.update();
    }

    return {
        createKeyboard: createKeyboard,
        createMouse: createMouse,

        init: init,
        update: update,
        key: key,
        mouse: mouse,

        //Keyboard codes. For letters and numbers on the keyboard use a string of the capital character.
        BACKSPACE: 8,
        TAB: 9,

        ENTER: 13,

        SHIFT: 16,
        CTRL: 17,
        ALT: 18,

        CAPSLOCK: 20,

        ESCAPE: 27,

        PAGEUP: 33,
        PAGEDOWN: 34,
        END: 35,
        HOME: 36,
        LEFT: 37,
        UP: 38,
        RIGHT: 39,
        DOWN: 40,

        INSERT: 45,
        DELETE: 46,

        ZERO: 96,
        ONE: 97,
        TWO: 98,
        THREE: 99,
        FOUR: 100,
        FIVE: 101,
        SIX: 102,
        SEVEN: 103,
        EIGHT: 104,
        NINE: 105,

        SEMICOLON: 186,
        EQUAL: 187,
        COMMA: 188,
        DASH: 189,
        PERIOD: 190,
        SLASH: 191,
        GRAVE: 192,

        OPENBRACKET: 219,
        BACKSLASH: 220,
        CLOSEBRACKET: 221,
        QUOTE: 222,

        MOUSE_LEFT: 1,
        MOUSE_MIDDLE: 2,
        MOUSE_RIGHT: 3,
    };
});

